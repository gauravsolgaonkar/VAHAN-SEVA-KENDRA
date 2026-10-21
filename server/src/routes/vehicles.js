import { Router } from 'express';
import { isObjectId, requireRole, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import RcRecord from '../models/RcRecord.js';
import Reminder from '../models/Reminder.js';
import Tenant from '../models/Tenant.js';
import Vehicle, { VEHICLE_TYPES } from '../models/Vehicle.js';
import { buildQueueForTenant } from '../jobs/reminders.js';
import { lookupRc } from '../rc/index.js';
import { RcProviderError } from '../rc/errors.js';
import { syncDocsFromRc } from '../utils/docsFromRc.js';
import { escapeRegex, pick } from '../utils/pick.js';
import { normalizeRegNo } from '../utils/regno.js';
import { CUSTOMER_FIELDS, findCustomer, resolveAgentId } from './customers.js';

const r = Router();

export const VEHICLE_FIELDS = [
  'vehicleType', 'ownerName', 'fatherName', 'presentAddress', 'permanentAddress', 'maker', 'model', 'variant', 'bodyType',
  'vehicleClass', 'vehicleCategory', 'fuel', 'norms', 'colour', 'seatingCapacity', 'cubicCapacity', 'grossWeight',
  'unladenWeight', 'manufacturingYear', 'registrationDate', 'rcValidUpto', 'chassisNo', 'engineNo', 'rto', 'financer',
  'rcStatus', 'blacklisted', 'notes',
];

async function findVehicle(req, id) {
  if (!isObjectId(id)) throw new HttpError(404, 'not_found');
  const v = await Vehicle.findOne({ ...scope(req), _id: id });
  if (!v) throw new HttpError(404, 'not_found');
  return v;
}

async function refreshQueue(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (tenant) await buildQueueForTenant(tenant);
}

r.get('/', asyncH(async (req, res) => {
  const filter = scope(req);
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.replace(/\s/g, '')), 'i');
    filter.$or = [{ regNo: rx }, { chassisNo: rx }, { engineNo: rx }, { ownerName: new RegExp(escapeRegex(q), 'i') }];
  }
  if (req.query.customerId && isObjectId(req.query.customerId)) filter.customerId = req.query.customerId;
  if (req.query.type && VEHICLE_TYPES.includes(req.query.type)) filter.vehicleType = req.query.type;
  const vehicles = await Vehicle.find(filter).sort({ updatedAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 200)).populate('customerId', 'name mobile').lean();
  res.json(vehicles);
}));

/**
 * Create a vehicle. Body: vehicle fields + regNo + (customerId | customer{...}) + optional rcRecordId.
 * With rcRecordId, document records are auto-created from the fetched expiries.
 */
r.post('/', asyncH(async (req, res) => {
  const norm = normalizeRegNo(req.body.regNo);
  if (!norm.ok) throw new HttpError(400, 'invalid_reg_no', norm.error);
  if (await Vehicle.exists({ tenantId: req.tenantId, regNo: norm.regNo })) throw new HttpError(409, 'vehicle_exists');

  let customer;
  if (req.body.customerId) {
    customer = await findCustomer(req, req.body.customerId);
  } else if (req.body.customer?.name) {
    const data = pick(req.body.customer, CUSTOMER_FIELDS);
    if (!data.whatsapp) data.whatsapp = data.mobile;
    customer = await Customer.create({ ...data, tenantId: req.tenantId, agentId: await resolveAgentId(req, req.body.customer.agentId) });
  } else {
    throw new HttpError(400, 'customer_required');
  }

  let rc = null;
  if (req.body.rcRecordId) {
    if (!isObjectId(req.body.rcRecordId)) throw new HttpError(400, 'validation', 'rcRecordId');
    rc = await RcRecord.findOne({ _id: req.body.rcRecordId, tenantId: req.tenantId, regNo: norm.regNo });
    if (!rc) throw new HttpError(400, 'validation', 'rcRecordId');
  }

  const vehicle = await Vehicle.create({
    ...pick(req.body, VEHICLE_FIELDS),
    regNo: norm.regNo,
    tenantId: req.tenantId,
    agentId: customer.agentId,
    customerId: customer._id,
    rcRecordId: rc?._id,
    rcFetchedAt: rc?.fetchedAt,
  });
  const createdDocs = rc ? await syncDocsFromRc(vehicle, rc.normalized) : [];
  await refreshQueue(req.tenantId);
  res.status(201).json({ vehicle, customer, createdDocuments: createdDocs.length });
}));

r.get('/:id', asyncH(async (req, res) => {
  const v = await findVehicle(req, req.params.id);
  const [customer, documents, rc] = await Promise.all([
    Customer.findOne({ _id: v.customerId, tenantId: req.tenantId }).lean(),
    Document.find({ tenantId: req.tenantId, vehicleId: v._id }).sort({ status: 1, expiryDate: 1 }).lean(),
    v.rcRecordId ? RcRecord.findOne({ _id: v.rcRecordId, tenantId: req.tenantId }).select('provider fetchedAt').lean() : null,
  ]);
  res.json({ ...v.toObject(), customer, documents, rc });
}));

r.patch('/:id', asyncH(async (req, res) => {
  const v = await findVehicle(req, req.params.id);
  Object.assign(v, pick(req.body, VEHICLE_FIELDS));
  if (req.body.customerId && String(req.body.customerId) !== String(v.customerId)) {
    const c = await findCustomer(req, req.body.customerId);
    v.customerId = c._id;
    v.agentId = c.agentId;
    await Document.updateMany({ tenantId: req.tenantId, vehicleId: v._id }, { $set: { customerId: c._id, agentId: c.agentId } });
    await Reminder.updateMany({ tenantId: req.tenantId, vehicleId: v._id }, { $set: { customerId: c._id, agentId: c.agentId } });
  }
  await v.save();
  res.json(v);
}));

r.delete('/:id', requireRole('owner'), asyncH(async (req, res) => {
  const v = await findVehicle(req, req.params.id);
  await Document.deleteMany({ tenantId: req.tenantId, vehicleId: v._id });
  await Reminder.deleteMany({ tenantId: req.tenantId, vehicleId: v._id });
  await v.deleteOne();
  res.json({ ok: true });
}));

/** "Refresh" button: forced RC re-fetch (bypasses 30-day cache), then sync documents. */
r.post('/:id/refresh-rc', asyncH(async (req, res) => {
  if (req.body.consent !== true) throw new HttpError(400, 'consent_required');
  const v = await findVehicle(req, req.params.id);
  let result;
  try {
    result = await lookupRc({ tenantId: req.tenantId, user: req.user, regNo: v.regNo, refresh: true, ip: req.ip, userAgent: req.get('user-agent') });
  } catch (e) {
    if (e instanceof RcProviderError) throw new HttpError(e.code === 'not_found' ? 404 : 502, `rc_${e.code}`, e.message);
    throw e;
  }
  const n = result.record.normalized;
  // Status fields always follow VAHAN; descriptive fields only fill gaps so user edits survive.
  for (const k of ['rcStatus', 'blacklisted', 'financer', 'rcValidUpto']) if (n[k] !== undefined) v[k] = n[k];
  for (const k of VEHICLE_FIELDS) if ((v[k] === undefined || v[k] === null || v[k] === '') && n[k] != null) v[k] = n[k];
  v.rcRecordId = result.record._id;
  v.rcFetchedAt = result.record.fetchedAt;
  await v.save();
  const created = await syncDocsFromRc(v, n);
  await refreshQueue(req.tenantId);
  res.json({ vehicle: v, createdDocuments: created.length, fetchedAt: result.record.fetchedAt });
}));

export default r;
