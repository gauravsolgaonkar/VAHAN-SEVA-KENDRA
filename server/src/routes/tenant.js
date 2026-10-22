import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Tenant from '../models/Tenant.js';

const r = Router();

r.get('/', asyncH(async (req, res) => res.json(await Tenant.findById(req.tenantId))));

r.patch('/', requireRole('owner'), asyncH(async (req, res) => {
  const t = await Tenant.findById(req.tenantId);
  const { name, phone, city, mode, settings = {} } = req.body;
  if (name) t.name = name;
  if (phone !== undefined) t.phone = phone;
  if (city !== undefined) t.city = city;
  if (mode && ['agent', 'puc_centre'].includes(mode)) t.mode = mode;
  if (settings.defaultLanguage) t.settings.defaultLanguage = settings.defaultLanguage;
  if (typeof settings.renewalCheck === 'boolean') t.settings.renewalCheck = settings.renewalCheck;
  if (Number.isInteger(settings.lowCreditThreshold) && settings.lowCreditThreshold >= 0) t.settings.lowCreditThreshold = settings.lowCreditThreshold;
  if (settings.pucRates) {
    for (const [k, v] of Object.entries(settings.pucRates)) {
      if (!Number.isFinite(Number(v)) || Number(v) < 0) throw new HttpError(400, 'validation', 'pucRates');
      t.settings.pucRates.set(k, Number(v));
    }
  }
  if (settings.reminderOffsets) {
    for (const [k, v] of Object.entries(settings.reminderOffsets)) {
      if (!Array.isArray(v) || !v.every((n) => Number.isInteger(n) && n >= -30 && n <= 90)) throw new HttpError(400, 'validation', 'reminderOffsets');
      t.settings.reminderOffsets.set(k, v);
    }
  }
  await t.save();
  res.json(t);
}));

export default r;
