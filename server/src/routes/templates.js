import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Template from '../models/Template.js';
import { DEFAULT_TEMPLATES } from '../utils/messages.js';
import { templatesFor } from './reminders.js';

const r = Router();

r.get('/', asyncH(async (req, res) => {
  res.json({ templates: await templatesFor(req.tenantId), defaults: DEFAULT_TEMPLATES, variables: ['name', 'vehicle', 'doc', 'expiry', 'agent_name', 'agent_phone'] });
}));

r.put('/', requireRole('owner'), asyncH(async (req, res) => {
  const { docType = 'default', language, body } = req.body;
  if (!['mr', 'hi', 'en'].includes(language) || !body?.trim()) throw new HttpError(400, 'validation');
  if (!/^[a-z_]+(:expired)?$/.test(docType)) throw new HttpError(400, 'validation', 'docType');
  const t = await Template.findOneAndUpdate({ tenantId: req.tenantId, docType, language }, { $set: { body: body.trim() } }, { upsert: true, returnDocument: 'after' });
  res.json(t);
}));

r.delete('/', requireRole('owner'), asyncH(async (req, res) => {
  const { docType = 'default', language } = req.query;
  await Template.deleteOne({ tenantId: req.tenantId, docType, language });
  res.json({ ok: true });
}));

export default r;
