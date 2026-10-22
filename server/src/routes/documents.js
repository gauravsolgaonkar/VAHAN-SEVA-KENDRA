import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { buildQueueForTenant } from '../jobs/reminders.js';
import { isObjectId, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document, { COMMISSION_TYPES, computeCommission, DOC_TYPES } from '../models/Document.js';
import Reminder from '../models/Reminder.js';
import Tenant from '../models/Tenant.js';
import Vehicle from '../models/Vehicle.js';
import { insuranceEnd, pucEnd } from '../utils/dates.js';
import { pick } from '../utils/pick.js';

const r = Router();
const FIELDS = ['type', 'number', 'provider', 'issueDate', 'startDate', 'expiryDate', 'amount', 'permitType', 'insurance', 'notes', 'commission', 'paymentMode'];

/** Booked-through-us flag and commission amount, shared by create and update. */
function applyBusiness(doc, body, user) {
  if (body.bookedThroughUs === true && !doc.bookedAt) {
    doc.bookedAt = doc.startDate || doc.issueDate || new Date();
    doc.bookedBy = user._id;
  } else if (body.bookedThroughUs === false) {
    doc.bookedAt = undefined;
    doc.bookedBy = undefined;
  }
  if (doc.commission?.type) {
    if (!COMMISSION_TYPES.includes(doc.commission.type)) throw new HttpError(400, 'validation', 'commission.type');
    doc.commission.amount = computeCommission(doc.commission, doc.insurance || {});
    if (doc.commission.payoutReceived && !doc.commission.payoutDate) doc.commission.payoutDate = new Date();
  }
}

fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(config.uploadDir, String(req.tenantId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(file.mimetype)),
});

async function findDoc(req, id) {
  if (!isObjectId(id)) throw new HttpError(404, 'not_found');
  const d = await Document.findOne({ ...scope(req), _id: id });
  if (!d) throw new HttpError(404, 'not_found');
  return d;
}

/** Default expiry when the user gave only a start date. Always editable. */
async function applyAutoExpiry(data, vehicle) {
  if (data.expiryDate || !data.startDate) return;
  if (data.type === 'insurance' || data.type === 'health' || data.type === 'life') data.expiryDate = insuranceEnd(data.startDate);
  else if (data.type === 'puc') data.expiryDate = pucEnd(data.startDate, { fuel: vehicle?.fuel, norms: vehicle?.norms });
}

async function refreshQueue(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (tenant) await buildQueueForTenant(tenant);
}

r.get('/', asyncH(async (req, res) => {
  const filter = scope(req);
  if (req.query.vehicleId && isObjectId(req.query.vehicleId)) filter.vehicleId = req.query.vehicleId;
  if (req.query.customerId && isObjectId(req.query.customerId)) filter.customerId = req.query.customerId;
  if (req.query.type) filter.type = req.query.type;
  filter.status = req.query.status === 'archived' ? 'archived' : req.query.status === 'all' ? { $in: ['active', 'archived'] } : 'active';
  res.json(await Document.find(filter).sort({ expiryDate: 1 }).limit(500).lean());
}));

r.get('/:id', asyncH(async (req, res) => res.json(await findDoc(req, req.params.id))));

r.post('/', asyncH(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!DOC_TYPES.includes(data.type)) throw new HttpError(400, 'validation', 'type');
  let vehicle = null;
  let customer;
  if (req.body.vehicleId) {
    if (!isObjectId(req.body.vehicleId)) throw new HttpError(400, 'validation', 'vehicleId');
    vehicle = await Vehicle.findOne({ ...scope(req), _id: req.body.vehicleId });
    if (!vehicle) throw new HttpError(404, 'vehicle_not_found');
    customer = { _id: vehicle.customerId, agentId: vehicle.agentId };
  } else {
    if (!isObjectId(req.body.customerId)) throw new HttpError(400, 'validation', 'customerId');
    customer = await Customer.findOne({ ...scope(req), _id: req.body.customerId });
    if (!customer) throw new HttpError(404, 'customer_not_found');
  }
  await applyAutoExpiry(data, vehicle);
  // Adding a new document of the same type replaces the current one; the old one becomes history.
  if (vehicle && req.body.replaceCurrent !== false) {
    await Document.updateMany({ tenantId: req.tenantId, vehicleId: vehicle._id, type: data.type, status: 'active' }, { $set: { status: 'archived' } });
  }
  const doc = new Document({ ...data, tenantId: req.tenantId, agentId: customer.agentId, customerId: customer._id, vehicleId: vehicle?._id });
  applyBusiness(doc, req.body, req.user);
  await doc.save();
  await Reminder.updateMany({ tenantId: req.tenantId, vehicleId: vehicle?._id, docType: data.type, status: 'pending', documentId: { $ne: doc._id } }, { $set: { status: 'skipped' } });
  await refreshQueue(req.tenantId);
  res.status(201).json(doc);
}));

r.patch('/:id', asyncH(async (req, res) => {
  const doc = await findDoc(req, req.params.id);
  const data = pick(req.body, FIELDS);
  delete data.type;
  if (data.startDate && !data.expiryDate && req.body.autoExpiry) {
    const vehicle = doc.vehicleId ? await Vehicle.findOne({ _id: doc.vehicleId, tenantId: req.tenantId }) : null;
    const tmp = { ...data, type: doc.type };
    await applyAutoExpiry(tmp, vehicle);
    data.expiryDate = tmp.expiryDate;
  }
  const expiryChanged = data.expiryDate && String(new Date(data.expiryDate)) !== String(doc.expiryDate);
  Object.assign(doc, data);
  if (req.body.status && ['active', 'archived'].includes(req.body.status)) doc.status = req.body.status;
  applyBusiness(doc, req.body, req.user);
  await doc.save();
  if (expiryChanged || doc.status === 'archived') {
    await Reminder.updateMany({ documentId: doc._id, status: 'pending' }, { $set: { status: 'skipped' } });
  }
  await refreshQueue(req.tenantId);
  res.json(doc);
}));

r.delete('/:id', asyncH(async (req, res) => {
  if (req.user.role !== 'owner') throw new HttpError(403, 'forbidden');
  const doc = await findDoc(req, req.params.id);
  await Reminder.deleteMany({ documentId: doc._id });
  for (const f of doc.files) fs.promises.unlink(f.path).catch(() => {});
  await doc.deleteOne();
  res.json({ ok: true });
}));

r.post('/:id/files', upload.single('file'), asyncH(async (req, res) => {
  const doc = await findDoc(req, req.params.id);
  if (!req.file) throw new HttpError(400, 'file_required', 'PDF or image up to 8 MB');
  doc.files.push({ path: req.file.path, name: req.file.originalname, mime: req.file.mimetype, size: req.file.size, uploadedAt: new Date() });
  await doc.save();
  res.status(201).json(doc);
}));

r.get('/:id/files/:idx', asyncH(async (req, res) => {
  const doc = await findDoc(req, req.params.id);
  const f = doc.files[Number(req.params.idx)];
  if (!f) throw new HttpError(404, 'not_found');
  res.type(f.mime);
  res.sendFile(path.resolve(f.path));
}));

export default r;
