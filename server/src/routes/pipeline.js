import { Router } from 'express';
import { runRenewalCheckForTenant } from '../jobs/renewalCheck.js';
import { isObjectId, requireRole, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document, { COMMISSION_TYPES } from '../models/Document.js';
import RenewalCase, { CASE_STATUSES, LOST_REASONS } from '../models/RenewalCase.js';
import Tenant from '../models/Tenant.js';
import Vehicle from '../models/Vehicle.js';
import { addDays, istDayStart } from '../utils/dates.js';
import { ensureCase, renewThroughUs, setStatus } from '../utils/renewal.js';

const r = Router();

async function findCase(req, id) {
  if (!isObjectId(id)) throw new HttpError(404, 'not_found');
  const rc = await RenewalCase.findOne({ ...scope(req), _id: id });
  if (!rc) throw new HttpError(404, 'not_found');
  return rc;
}

async function hydrate(tenantId, cases) {
  const ids = (k) => [...new Set(cases.map((c) => String(c[k])).filter((x) => x && x !== 'undefined' && x !== 'null'))];
  const [cs, vs, ds] = await Promise.all([
    Customer.find({ tenantId, _id: { $in: ids('customerId') } }).select('name mobile whatsapp language').lean(),
    Vehicle.find({ tenantId, _id: { $in: ids('vehicleId') } }).select('regNo vehicleType maker model fuel norms').lean(),
    Document.find({ tenantId, _id: { $in: [...ids('documentId'), ...ids('renewedDocumentId')] } }).lean(),
  ]);
  const m = (a) => Object.fromEntries(a.map((x) => [String(x._id), x]));
  const [cM, vM, dM] = [m(cs), m(vs), m(ds)];
  return cases.map((c) => ({
    ...c, customer: cM[String(c.customerId)], vehicle: vM[String(c.vehicleId)], document: dM[String(c.documentId)],
    renewedDocument: c.renewedDocumentId ? dM[String(c.renewedDocumentId)] : undefined,
  }));
}

r.get('/', asyncH(async (req, res) => {
  const filter = scope(req);
  const { status, followUp } = req.query;
  if (status === 'open') filter.status = { $in: ['pending', 'contacted', 'quote_sent'] };
  else if (CASE_STATUSES.includes(status)) filter.status = status;
  if (followUp === 'due') filter.followUpDate = { $lt: addDays(istDayStart(), 1) };
  if (req.query.docType) filter.docType = req.query.docType;
  const sort = ['renewed', 'lost'].includes(status) ? { closedAt: -1 } : followUp ? { followUpDate: 1 } : { expiryDate: 1 };
  const cases = await RenewalCase.find(filter).sort(sort).limit(300).lean();
  res.json(await hydrate(req.tenantId, cases));
}));

r.get('/summary', asyncH(async (req, res) => {
  const s = scope(req);
  const monthStart = istDayStart();
  monthStart.setUTCDate(1);
  const [open, closed, followUps] = await Promise.all([
    RenewalCase.find({ ...s, status: { $in: ['pending', 'contacted', 'quote_sent'] } }).select('status').lean(),
    RenewalCase.find({ ...s, closedAt: { $gte: monthStart } }).select('status lostReason').lean(),
    RenewalCase.countDocuments({ ...s, status: { $in: ['pending', 'contacted', 'quote_sent'] }, followUpDate: { $lt: addDays(istDayStart(), 1) } }),
  ]);
  const count = (arr, k) => arr.filter((x) => x.status === k).length;
  res.json({
    open: { pending: count(open, 'pending'), contacted: count(open, 'contacted'), quote_sent: count(open, 'quote_sent') },
    month: {
      renewed: count(closed, 'renewed'), lost: count(closed, 'lost'),
      lostByReason: Object.fromEntries(LOST_REASONS.map((x) => [x, closed.filter((c) => c.lostReason === x).length])),
    },
    followUpsDue: followUps,
  });
}));

// Open a case for any active document (e.g. from the vehicle page).
r.post('/', asyncH(async (req, res) => {
  if (!isObjectId(req.body.documentId)) throw new HttpError(400, 'validation', 'documentId');
  const doc = await Document.findOne({ ...scope(req), _id: req.body.documentId, status: 'active' });
  if (!doc) throw new HttpError(404, 'not_found');
  res.status(201).json(await ensureCase(doc));
}));

r.get('/:id', asyncH(async (req, res) => {
  const rc = await findCase(req, req.params.id);
  const [out] = await hydrate(req.tenantId, [rc.toObject()]);
  res.json(out);
}));

r.patch('/:id', asyncH(async (req, res) => {
  const rc = await findCase(req, req.params.id);
  const { status, lostReason, followUpDate, note, quoteAmount } = req.body;
  if (status) {
    if (!CASE_STATUSES.includes(status) || status === 'renewed') throw new HttpError(400, 'validation', 'status');
    if (status === 'lost' && !LOST_REASONS.includes(lostReason)) throw new HttpError(400, 'validation', 'lostReason');
    setStatus(rc, status, { by: req.user._id, lostReason });
  }
  if (followUpDate !== undefined) rc.followUpDate = followUpDate || null;
  if (quoteAmount !== undefined) rc.quoteAmount = quoteAmount === '' ? null : Number(quoteAmount);
  if (note?.trim()) rc.notes.push({ text: note.trim(), by: req.user._id, at: new Date() });
  await rc.save();
  res.json(rc);
}));

/** Renewed through us: capture the new policy. */
r.post('/:id/renew', asyncH(async (req, res) => {
  const rc = await findCase(req, req.params.id);
  if (rc.status === 'renewed') throw new HttpError(409, 'already_renewed');
  const oldDoc = await Document.findOne({ _id: rc.documentId, tenantId: req.tenantId });
  if (!oldDoc) throw new HttpError(404, 'not_found');
  const c = req.body.commission;
  if (c?.type && !COMMISSION_TYPES.includes(c.type)) throw new HttpError(400, 'validation', 'commission.type');
  const vehicle = oldDoc.vehicleId ? await Vehicle.findOne({ _id: oldDoc.vehicleId, tenantId: req.tenantId }).lean() : null;
  const doc = await renewThroughUs(rc, oldDoc, req.body, req.user, vehicle);
  res.status(201).json({ case: rc, document: doc });
}));

r.post('/renewal-check/run', requireRole('owner'), asyncH(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  res.json(await runRenewalCheckForTenant(tenant, { force: true }));
}));

export default r;
