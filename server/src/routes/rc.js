import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { isObjectId, requireRole, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import ConsentLog from '../models/ConsentLog.js';
import RcCallLog from '../models/RcCallLog.js';
import RcRecord from '../models/RcRecord.js';
import Vehicle from '../models/Vehicle.js';
import { lookupRc } from '../rc/index.js';
import { RcProviderError } from '../rc/errors.js';
import { istDayStart } from '../utils/dates.js';
import { normalizeRegNo } from '../utils/regno.js';

const r = Router();

const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rcRateLimitPerMinute,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

/** Look up a registration number. Body: { regNo, consent: true, refresh?: boolean } */
r.post('/lookup', perUserLimiter, asyncH(async (req, res) => {
  if (req.body.consent !== true) throw new HttpError(400, 'consent_required');
  const norm = normalizeRegNo(req.body.regNo);
  if (!norm.ok) throw new HttpError(400, 'invalid_reg_no', norm.error);

  const liveToday = await RcCallLog.countDocuments({ userId: req.user._id, cached: false, createdAt: { $gte: istDayStart() } });
  if (liveToday >= config.rcDailyLimitPerUser) throw new HttpError(429, 'daily_limit');

  try {
    const { record, cached } = await lookupRc({
      tenantId: req.tenantId, user: req.user, regNo: norm.regNo, refresh: Boolean(req.body.refresh),
      ip: req.ip, userAgent: req.get('user-agent'),
    });
    const existing = await Vehicle.findOne({ tenantId: req.tenantId, regNo: norm.regNo }).select('_id customerId agentId');
    res.json({
      regNo: norm.regNo,
      cached,
      provider: record.provider,
      fetchedAt: record.fetchedAt,
      rcRecordId: record._id,
      normalized: record.normalized,
      // Only reveal the existing vehicle if this user can see it.
      existingVehicleId: existing && (!scope(req).agentId || String(existing.agentId) === String(req.user._id)) ? existing._id : null,
      alreadyInTenant: Boolean(existing),
    });
  } catch (e) {
    if (e instanceof RcProviderError) {
      const status = e.code === 'not_found' ? 404 : e.code === 'config' ? 503 : 502;
      throw new HttpError(status, `rc_${e.code}`, e.message);
    }
    throw e;
  }
}));

r.get('/records/:id', asyncH(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'not_found');
  const rec = await RcRecord.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
  if (!rec) throw new HttpError(404, 'not_found');
  res.json(rec);
}));

// Audit: who fetched what, via which provider, cost and outcome.
r.get('/logs', requireRole('owner'), asyncH(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await RcCallLog.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(limit).populate('userId', 'name').lean();
  const monthStart = istDayStart();
  monthStart.setUTCDate(1);
  const month = await RcCallLog.find({ tenantId: req.tenantId, createdAt: { $gte: monthStart } }).select('cached success cost').lean();
  res.json({
    logs,
    summary: {
      live: month.filter((l) => !l.cached && l.success).length,
      cached: month.filter((l) => l.cached).length,
      failed: month.filter((l) => !l.success).length,
      cost: month.reduce((s, l) => s + (l.cost || 0), 0),
    },
  });
}));

r.get('/consents', requireRole('owner'), asyncH(async (req, res) => {
  const logs = await ConsentLog.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(200).populate('userId', 'name').lean();
  res.json(logs);
}));

export default r;
