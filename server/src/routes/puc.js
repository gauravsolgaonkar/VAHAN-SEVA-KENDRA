import { Router } from 'express';
import { buildQueueForTenant } from '../jobs/reminders.js';
import { isObjectId, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import RcRecord from '../models/RcRecord.js';
import Reminder from '../models/Reminder.js';
import Tenant from '../models/Tenant.js';
import Vehicle from '../models/Vehicle.js';
import { addDays, istDayStart, pucEnd } from '../utils/dates.js';
import { normalizeRegNo } from '../utils/regno.js';
import { titleCase, upsertVehicleFromRc } from '../utils/vehicleFromRc.js';

// PUC centre walk-ins: reg no. -> (RC fetch) -> PUC certificate + cash in one step.
const r = Router();
const phone = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

r.post('/entry', asyncH(async (req, res) => {
  const norm = normalizeRegNo(req.body.regNo);
  if (!norm.ok) throw new HttpError(400, 'invalid_reg_no', norm.error);
  const mobile = phone(req.body.mobile);
  const name = String(req.body.customerName || '').trim();
  const rc = req.body.rcRecordId && isObjectId(req.body.rcRecordId)
    ? await RcRecord.findOne({ _id: req.body.rcRecordId, tenantId: req.tenantId, regNo: norm.regNo }) : null;

  let vehicle = await Vehicle.findOne({ tenantId: req.tenantId, regNo: norm.regNo });
  if (vehicle && scope(req).agentId && String(vehicle.agentId) !== String(req.user._id)) vehicle = null; // not theirs: treated as new
  let customer = vehicle ? await Customer.findOne({ _id: vehicle.customerId, tenantId: req.tenantId }) : null;
  if (!customer && mobile.length === 10) customer = await Customer.findOne({ ...scope(req), mobile });
  if (!customer && !vehicle) {
    const ownerName = name || rc?.normalized?.ownerName || norm.regNo;
    customer = await Customer.create({
      tenantId: req.tenantId, agentId: req.user._id, name: titleCase(ownerName),
      mobile: mobile || undefined, whatsapp: mobile || undefined, tags: ['walkin'],
    });
  } else if (customer && mobile && !customer.mobile) {
    customer.mobile = mobile;
    customer.whatsapp ||= mobile;
    await customer.save();
  }
  if (!vehicle) {
    vehicle = rc
      ? (await upsertVehicleFromRc({ tenantId: req.tenantId, agentId: req.user._id, record: rc, customer })).vehicle
      : await Vehicle.create({ tenantId: req.tenantId, agentId: customer.agentId, customerId: customer._id, regNo: norm.regNo, vehicleType: req.body.vehicleType || 'other', fuel: req.body.fuel });
  }

  const issue = req.body.issueDate ? new Date(req.body.issueDate) : istDayStart();
  const expiry = req.body.expiryDate ? new Date(req.body.expiryDate) : pucEnd(issue, { fuel: vehicle.fuel || '', norms: vehicle.norms || '' });
  const old = await Document.find({ tenantId: req.tenantId, vehicleId: vehicle._id, type: 'puc', status: 'active' }).select('_id');
  await Document.updateMany({ _id: { $in: old.map((d) => d._id) } }, { $set: { status: 'archived' } });
  await Reminder.updateMany({ documentId: { $in: old.map((d) => d._id) }, status: 'pending' }, { $set: { status: 'skipped' } });
  const doc = await Document.create({
    tenantId: req.tenantId, agentId: vehicle.agentId, customerId: vehicle.customerId, vehicleId: vehicle._id, type: 'puc',
    number: req.body.certNo || undefined, issueDate: issue, startDate: issue, expiryDate: expiry, amount: Number(req.body.amount) || 0,
    paymentMode: ['cash', 'upi', 'card', 'other'].includes(req.body.paymentMode) ? req.body.paymentMode : 'cash',
    source: 'puc_entry', bookedAt: new Date(), bookedBy: req.user._id,
  });
  buildQueueForTenant(await Tenant.findById(req.tenantId)).catch(() => {});
  res.status(201).json({ document: doc, vehicle, customer });
}));

r.get('/day', asyncH(async (req, res) => {
  const day = req.query.date ? istDayStart(new Date(req.query.date)) : istDayStart();
  const docs = await Document.find({ ...scope(req), type: 'puc', source: 'puc_entry', bookedAt: { $gte: day, $lt: addDays(day, 1) } }).sort({ bookedAt: -1 }).lean();
  const vehicles = await Vehicle.find({ tenantId: req.tenantId, _id: { $in: docs.map((d) => d.vehicleId) } }).select('regNo vehicleType').lean();
  const vM = Object.fromEntries(vehicles.map((v) => [String(v._id), v]));
  const totals = { count: docs.length, total: 0, cash: 0, upi: 0, other: 0 };
  for (const d of docs) {
    totals.total += d.amount || 0;
    const k = d.paymentMode === 'cash' ? 'cash' : d.paymentMode === 'upi' ? 'upi' : 'other';
    totals[k] += d.amount || 0;
  }
  res.json({ date: day, totals, entries: docs.map((d) => ({ ...d, vehicle: vM[String(d.vehicleId)] })) });
}));

export default r;
