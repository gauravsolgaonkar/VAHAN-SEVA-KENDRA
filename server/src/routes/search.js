import { Router } from 'express';
import { scope } from '../middleware/auth.js';
import { asyncH } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import Vehicle from '../models/Vehicle.js';
import { escapeRegex } from '../utils/pick.js';

// Global search across name, mobile, reg no, policy no and chassis no.
const r = Router();

r.get('/', asyncH(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ customers: [], vehicles: [], documents: [] });
  const s = scope(req);
  const rx = new RegExp(escapeRegex(q), 'i');
  const compact = new RegExp(escapeRegex(q.replace(/[\s-]/g, '')), 'i');
  const [customers, vehicles, documents] = await Promise.all([
    Customer.find({ ...s, $or: [{ name: rx }, { mobile: compact }, { whatsapp: compact }] }).limit(10).lean(),
    Vehicle.find({ ...s, $or: [{ regNo: compact }, { chassisNo: compact }, { engineNo: compact }] }).limit(10).populate('customerId', 'name').lean(),
    Document.find({ ...s, status: 'active', number: rx }).limit(10).populate('vehicleId', 'regNo').populate('customerId', 'name').lean(),
  ]);
  res.json({ customers, vehicles, documents });
}));

export default r;
