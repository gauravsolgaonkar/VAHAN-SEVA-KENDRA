import { Router } from 'express';
import { scope } from '../middleware/auth.js';
import { asyncH } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import RcCallLog from '../models/RcCallLog.js';
import Reminder from '../models/Reminder.js';
import RenewalCase from '../models/RenewalCase.js';
import Tenant from '../models/Tenant.js';
import Vehicle from '../models/Vehicle.js';
import { addDays, daysUntil, istDayStart } from '../utils/dates.js';

const r = Router();

export function bucketOf(days) {
  if (days === null) return null;
  if (days < 0) return 'expired';
  if (days <= 7) return 'due7';
  if (days <= 15) return 'due15';
  if (days <= 30) return 'due30';
  return 'active';
}

r.get('/', asyncH(async (req, res) => {
  const s = scope(req);
  const now = new Date();
  const today = istDayStart(now);
  const monthStart = new Date(today);
  monthStart.setUTCDate(1);

  const [docs, customers, vehicles, tenant, rcMonth, pendingReminders, closedCases, booked, pucToday] = await Promise.all([
    Document.find({ ...s, status: 'active', expiryDate: { $ne: null } }).select('type expiryDate').lean(),
    Customer.countDocuments(s),
    Vehicle.countDocuments(s),
    Tenant.findById(req.tenantId).lean(),
    RcCallLog.countDocuments({ tenantId: req.tenantId, cached: false, success: true, createdAt: { $gte: monthStart } }),
    Reminder.countDocuments({ ...s, status: 'pending' }),
    RenewalCase.find({ ...s, closedAt: { $gte: monthStart } }).select('status').lean(),
    Document.find({ ...s, bookedAt: { $gte: monthStart }, type: { $in: ['insurance', 'health', 'life'] } }).select('commission insurance amount').lean(),
    Document.find({ ...s, type: 'puc', source: 'puc_entry', bookedAt: { $gte: today } }).select('amount paymentMode').lean(),
  ]);

  const byType = {};
  for (const d of docs) {
    const b = bucketOf(daysUntil(d.expiryDate, now));
    byType[d.type] ??= { expired: 0, due7: 0, due15: 0, due30: 0, active: 0 };
    byType[d.type][b] += 1;
  }

  const callDocs = await Document.find({
    ...s, status: 'active', vehicleId: { $ne: null },
    expiryDate: { $gte: addDays(today, -7), $lt: addDays(today, 8) },
  }).sort({ expiryDate: 1 }).limit(40).lean();
  const custIds = [...new Set(callDocs.map((d) => String(d.customerId)))];
  const vehIds = [...new Set(callDocs.map((d) => String(d.vehicleId)))];
  const [cs, vs] = await Promise.all([
    Customer.find({ tenantId: req.tenantId, _id: { $in: custIds } }).select('name mobile whatsapp language').lean(),
    Vehicle.find({ tenantId: req.tenantId, _id: { $in: vehIds } }).select('regNo vehicleType maker model').lean(),
  ]);
  const cMap = Object.fromEntries(cs.map((c) => [String(c._id), c]));
  const vMap = Object.fromEntries(vs.map((v) => [String(v._id), v]));

  res.json({
    totals: { customers, vehicles, documents: docs.length, pendingReminders },
    byType,
    callList: callDocs.map((d) => ({
      documentId: d._id, type: d.type, expiryDate: d.expiryDate, daysLeft: daysUntil(d.expiryDate, now),
      customer: cMap[String(d.customerId)], vehicle: vMap[String(d.vehicleId)],
    })),
    rc: {
      credits: tenant?.rcCredits ?? 0, fetchesThisMonth: rcMonth,
      low: (tenant?.rcCredits ?? 0) <= (tenant?.settings?.lowCreditThreshold ?? 10),
    },
    month: {
      renewed: closedCases.filter((c) => c.status === 'renewed').length,
      lost: closedCases.filter((c) => c.status === 'lost').length,
      policies: booked.length,
      premium: booked.reduce((sum, d) => sum + (d.insurance?.totalPremium ?? d.amount ?? 0), 0),
      commission: booked.reduce((sum, d) => sum + (d.commission?.amount || 0), 0),
    },
    puc: tenant?.mode === 'puc_centre' || pucToday.length
      ? { count: pucToday.length, total: pucToday.reduce((sum, d) => sum + (d.amount || 0), 0), cash: pucToday.filter((d) => d.paymentMode === 'cash').reduce((sum, d) => sum + (d.amount || 0), 0) }
      : null,
    mode: tenant?.mode,
  });
}));

export default r;
