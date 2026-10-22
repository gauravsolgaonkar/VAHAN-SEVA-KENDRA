import { Router } from 'express';
import { buildQueueForTenant } from '../jobs/reminders.js';
import { isObjectId, requireRole, scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import Reminder from '../models/Reminder.js';
import RenewalCase from '../models/RenewalCase.js';
import { setStatus } from '../utils/renewal.js';
import Template from '../models/Template.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { daysUntil } from '../utils/dates.js';
import { buildVars, DEFAULT_TEMPLATES, renderTemplate, waLink } from '../utils/messages.js';

const r = Router();

export async function templatesFor(tenantId) {
  const custom = await Template.find({ tenantId }).lean();
  const out = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  for (const t of custom) {
    out[t.docType] ??= {};
    out[t.docType][t.language] = t.body;
  }
  return out;
}

function pickTemplate(templates, docType, language, expired) {
  const lang = ['mr', 'hi', 'en'].includes(language) ? language : 'mr';
  const key = expired ? 'expired' : 'default';
  return templates[`${docType}${expired ? ':expired' : ''}`]?.[lang] || templates[key]?.[lang] || DEFAULT_TEMPLATES[key][lang];
}

/** The day's queue (everything still pending), with the message and wa.me link ready to tap. */
r.get('/', asyncH(async (req, res) => {
  const filter = { ...scope(req), status: req.query.status === 'sent' ? 'sent' : 'pending' };
  const reminders = await Reminder.find(filter).sort({ expiryDate: 1 }).limit(300).lean();
  const ids = (k) => [...new Set(reminders.map((x) => String(x[k])).filter((x) => x !== 'undefined'))];
  const [customers, vehicles, docs, agents, templates, cases] = await Promise.all([
    Customer.find({ tenantId: req.tenantId, _id: { $in: ids('customerId') } }).lean(),
    Vehicle.find({ tenantId: req.tenantId, _id: { $in: ids('vehicleId') } }).select('regNo vehicleType maker model').lean(),
    Document.find({ tenantId: req.tenantId, _id: { $in: ids('documentId') } }).select('type expiryDate number provider').lean(),
    User.find({ tenantId: req.tenantId, _id: { $in: ids('agentId') } }).select('name mobile').lean(),
    templatesFor(req.tenantId),
    RenewalCase.find({ tenantId: req.tenantId, documentId: { $in: ids('documentId') } }).select('documentId status followUpDate').lean(),
  ]);
  const caseByDoc = Object.fromEntries(cases.map((c) => [String(c.documentId), c]));
  const m = (arr) => Object.fromEntries(arr.map((x) => [String(x._id), x]));
  const [cM, vM, dM, aM] = [m(customers), m(vehicles), m(docs), m(agents)];
  const now = new Date();

  res.json(reminders.map((rem) => {
    const customer = cM[String(rem.customerId)];
    const vehicle = vM[String(rem.vehicleId)];
    const doc = dM[String(rem.documentId)] || { type: rem.docType, expiryDate: rem.expiryDate };
    const agent = aM[String(rem.agentId)] || req.user;
    const language = customer?.language || 'mr';
    const daysLeft = daysUntil(doc.expiryDate, now);
    const text = renderTemplate(pickTemplate(templates, doc.type, language, daysLeft < 0), buildVars({ customer, vehicle, doc, agent, language }));
    const phone = customer?.whatsapp || customer?.mobile;
    const rc = caseByDoc[String(rem.documentId)];
    return {
      ...rem, customer, vehicle, document: doc, daysLeft, message: text, waLink: phone ? waLink(phone, text) : null,
      case: rc ? { _id: rc._id, status: rc.status, followUpDate: rc.followUpDate } : null,
    };
  }));
}));

r.post('/:id/sent', asyncH(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'not_found');
  const rem = await Reminder.findOneAndUpdate(
    { ...scope(req), _id: req.params.id },
    { $set: { status: 'sent', sentAt: new Date(), sentBy: req.user._id, channel: 'wa_link' } },
    { returnDocument: 'after' },
  );
  if (!rem) throw new HttpError(404, 'not_found');
  // First reminder sent moves the pipeline item from Pending to Contacted.
  const rc = await RenewalCase.findOne({ tenantId: req.tenantId, documentId: rem.documentId, status: 'pending' });
  if (rc) {
    setStatus(rc, 'contacted', { by: req.user._id, auto: true });
    await rc.save();
  }
  res.json(rem);
}));

r.post('/:id/skip', asyncH(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'not_found');
  const rem = await Reminder.findOneAndUpdate({ ...scope(req), _id: req.params.id }, { $set: { status: 'skipped' } }, { returnDocument: 'after' });
  if (!rem) throw new HttpError(404, 'not_found');
  res.json(rem);
}));

r.post('/rebuild', requireRole('owner'), asyncH(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  res.json({ created: await buildQueueForTenant(tenant) });
}));

export default r;
