import { Router } from 'express';
import { isObjectId, requireRole, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { escapeRegex, pick } from '../utils/pick.js';

const r = Router();
export const CUSTOMER_FIELDS = ['name', 'mobile', 'whatsapp', 'altMobile', 'city', 'address', 'language', 'tags', 'referredBy', 'notes'];

/** Owners (and view-all staff) may assign a customer to another agent in their tenant. */
export async function resolveAgentId(req, requested) {
  if (!requested || req.user.role === 'staff' && !req.user.canViewAll) return req.user._id;
  if (!isObjectId(requested)) throw new HttpError(400, 'validation', 'agentId');
  const ok = await User.exists({ _id: requested, tenantId: req.tenantId });
  if (!ok) throw new HttpError(400, 'validation', 'agentId');
  return requested;
}

export async function findCustomer(req, id) {
  if (!isObjectId(id)) throw new HttpError(404, 'not_found');
  const c = await Customer.findOne({ ...scope(req), _id: id });
  if (!c) throw new HttpError(404, 'not_found');
  return c;
}

r.get('/', asyncH(async (req, res) => {
  const filter = scope(req);
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { mobile: rx }, { whatsapp: rx }, { city: rx }];
  }
  if (req.query.tag) filter.tags = req.query.tag;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const skip = Math.max(Number(req.query.skip) || 0, 0);
  const customers = await Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean();
  const ids = customers.map((c) => c._id);
  const vehicles = await Vehicle.find({ tenantId: req.tenantId, customerId: { $in: ids } }).select('customerId vehicleType').lean();
  const counts = {};
  for (const v of vehicles) {
    const k = String(v.customerId);
    counts[k] ??= { total: 0, byType: {} };
    counts[k].total += 1;
    counts[k].byType[v.vehicleType] = (counts[k].byType[v.vehicleType] || 0) + 1;
  }
  res.json(customers.map((c) => ({ ...c, vehicles: counts[String(c._id)] || { total: 0, byType: {} } })));
}));

r.post('/', asyncH(async (req, res) => {
  const data = pick(req.body, CUSTOMER_FIELDS);
  if (!data.name) throw new HttpError(400, 'validation', 'name');
  if (!data.whatsapp) data.whatsapp = data.mobile;
  const c = await Customer.create({ ...data, tenantId: req.tenantId, agentId: await resolveAgentId(req, req.body.agentId) });
  res.status(201).json(c);
}));

r.get('/:id', asyncH(async (req, res) => {
  const c = await findCustomer(req, req.params.id);
  const [vehicles, docs] = await Promise.all([
    Vehicle.find({ tenantId: req.tenantId, customerId: c._id }).sort({ regNo: 1 }).lean(),
    Document.find({ tenantId: req.tenantId, customerId: c._id, status: 'active' }).sort({ expiryDate: 1 }).lean(),
  ]);
  const byVehicle = {};
  for (const d of docs) if (d.vehicleId) (byVehicle[String(d.vehicleId)] ??= []).push(d);
  res.json({
    ...c.toObject(),
    vehicles: vehicles.map((v) => ({ ...v, documents: byVehicle[String(v._id)] || [] })),
    personalDocuments: docs.filter((d) => !d.vehicleId),
  });
}));

r.patch('/:id', asyncH(async (req, res) => {
  const c = await findCustomer(req, req.params.id);
  Object.assign(c, pick(req.body, CUSTOMER_FIELDS));
  if (req.body.agentId) {
    c.agentId = await resolveAgentId(req, req.body.agentId);
    // Keep the agent on vehicles/docs in sync so staff scoping stays consistent.
    await Vehicle.updateMany({ tenantId: req.tenantId, customerId: c._id }, { $set: { agentId: c.agentId } });
    await Document.updateMany({ tenantId: req.tenantId, customerId: c._id }, { $set: { agentId: c.agentId } });
  }
  await c.save();
  res.json(c);
}));

r.delete('/:id', requireRole('owner'), asyncH(async (req, res) => {
  const c = await findCustomer(req, req.params.id);
  if (await Vehicle.exists({ tenantId: req.tenantId, customerId: c._id })) throw new HttpError(409, 'has_vehicles');
  await Document.deleteMany({ tenantId: req.tenantId, customerId: c._id });
  await c.deleteOne();
  res.json({ ok: true });
}));

export default r;
