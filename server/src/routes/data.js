import { Router } from 'express';
import multer from 'multer';
import BulkJob from '../models/BulkJob.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Vehicle, { VEHICLE_TYPES } from '../models/Vehicle.js';
import { buildQueueForTenant } from '../jobs/reminders.js';
import { runBulkJob } from '../jobs/bulk.js';
import { scope } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import { insuranceEnd, parseLooseDate } from '../utils/dates.js';
import { formatDate } from '../utils/messages.js';
import { displayRegNo, normalizeRegNo } from '../utils/regno.js';
import { readTable, sendXlsx, workbook } from '../utils/xlsx.js';

// Excel/CSV import with column mapping, and full data export.
const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const MAX_ROWS = 3000;

// Target fields and header patterns (English, Hindi, Marathi) used to suggest a mapping.
export const IMPORT_FIELDS = {
  customerName: /^(customer|owner|name|insured|ग्राहक|नाम|नाव|मालक)/i,
  mobile: /(mobile|phone|contact|मोबाइल|मोबाईल|फोन)/i,
  whatsapp: /whats ?app|व्हाट्स|व्हॉट्स/i,
  city: /(city|village|town|place|गांव|गाव|शहर)/i,
  regNo: /(reg|vehicle ?no|registration|गाडी|वाहन ?(नं|क्र))/i,
  vehicleType: /(vehicle ?type|type of vehicle|category|प्रकार)/i,
  maker: /^(make|maker|manufacturer|company)$/i,
  model: /^model/i,
  insurer: /(insurer|insurance company|company name|बीमा कंपनी|विमा कंपनी)/i,
  policyNo: /(policy ?(no|number)|पॉलिसी)/i,
  policyType: /(policy ?type|cover)/i,
  insuranceStart: /(start|risk start|from|issue)/i,
  insuranceExpiry: /(insurance.*(exp|upto|end|valid)|policy.*(exp|end)|^expiry|^exp)/i,
  premium: /(premium|प्रीमियम)/i,
  odPremium: /^od/i,
  pucExpiry: /puc/i,
  fitnessExpiry: /fitness|फिटनेस/i,
  permitExpiry: /permit|परमिट/i,
  taxExpiry: /tax|टॅक्स|टैक्स/i,
  notes: /(note|remark|टिप्पणी|नोंद)/i,
};

export function suggestMapping(headers) {
  const mapping = {};
  const used = new Set();
  // Specific fields first so e.g. "PUC expiry" isn't taken by the generic expiry pattern.
  const order = ['whatsapp', 'pucExpiry', 'fitnessExpiry', 'permitExpiry', 'taxExpiry', 'policyNo', 'policyType', 'odPremium', 'premium',
    'insurer', 'regNo', 'vehicleType', 'mobile', 'city', 'customerName', 'maker', 'model', 'insuranceStart', 'insuranceExpiry', 'notes'];
  for (const field of order) {
    const idx = headers.findIndex((h, i) => !used.has(i) && IMPORT_FIELDS[field].test(String(h).trim()));
    if (idx >= 0) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

const VT_ALIASES = { '2w': '2W', bike: '2W', scooter: '2W', 'two wheeler': '2W', car: 'car', jeep: 'car', pickup: 'pickup', bolero: 'pickup',
  dumper: 'dumper', tipper: 'dumper', truck: 'truck', lorry: 'truck', bus: 'bus', tractor: 'tractor', jcb: 'jcb', auto: 'auto', rickshaw: 'auto' };
const vehicleType = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (VEHICLE_TYPES.includes(s)) return s;
  const hit = Object.keys(VT_ALIASES).find((k) => s.includes(k));
  return hit ? VT_ALIASES[hit] : undefined;
};
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : undefined;
};
const phone = (v) => String(v ?? '').replace(/\D/g, '').slice(-10);

r.post('/import/parse', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'file_required');
  if (!/\.(xlsx|csv)$/i.test(req.file.originalname)) throw new HttpError(400, 'file_type', 'xlsx or csv');
  const { headers, rows } = await readTable(req.file.buffer, req.file.originalname);
  if (rows.length > MAX_ROWS) throw new HttpError(400, 'too_many_rows', MAX_ROWS);
  res.json({ headers, rows, mapping: suggestMapping(headers), fields: Object.keys(IMPORT_FIELDS) });
}));

/**
 * Create customers, vehicles and documents from mapped rows. Existing vehicles (same reg no.) get any
 * new documents; existing customers are matched by mobile. Optionally queues RC fetches for the reg nos.
 */
r.post('/import/commit', asyncH(async (req, res) => {
  const { rows = [], mapping = {}, autoFetch = false, consent = false } = req.body;
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new HttpError(400, 'validation', 'rows');
  if (mapping.customerName === undefined && mapping.regNo === undefined) throw new HttpError(400, 'mapping_required');
  if (autoFetch && consent !== true) throw new HttpError(400, 'consent_required');
  const get = (row, f) => (mapping[f] === undefined || mapping[f] === null || mapping[f] === '' ? undefined : row[Number(mapping[f])]);
  const out = { customers: 0, vehicles: 0, documents: 0, skipped: 0, errors: [] };
  const regNos = [];

  for (const [i, row] of rows.entries()) {
    try {
      const rawReg = get(row, 'regNo');
      const reg = rawReg ? normalizeRegNo(rawReg) : null;
      if (rawReg && !reg.ok) throw new Error(`invalid reg no "${rawReg}"`);
      const name = String(get(row, 'customerName') ?? '').trim();
      const mobile = phone(get(row, 'mobile'));
      let vehicle = reg ? await Vehicle.findOne({ tenantId: req.tenantId, regNo: reg.regNo }) : null;
      let customer = vehicle ? await Customer.findOne({ _id: vehicle.customerId, tenantId: req.tenantId }) : null;
      if (!customer && mobile.length === 10) customer = await Customer.findOne({ ...scope(req), mobile });
      if (!customer && name) customer = await Customer.findOne({ ...scope(req), name });
      if (!customer) {
        if (!name && !reg) {
          out.skipped += 1;
          continue;
        }
        customer = await Customer.create({
          tenantId: req.tenantId, agentId: req.user._id, name: name || reg.regNo, mobile: mobile || undefined,
          whatsapp: phone(get(row, 'whatsapp')) || mobile || undefined, city: get(row, 'city') || undefined, tags: [],
        });
        out.customers += 1;
      }
      if (reg && !vehicle) {
        vehicle = await Vehicle.create({
          tenantId: req.tenantId, agentId: customer.agentId, customerId: customer._id, regNo: reg.regNo,
          vehicleType: vehicleType(get(row, 'vehicleType')) || 'other', maker: get(row, 'maker') || undefined, model: get(row, 'model') || undefined,
        });
        out.vehicles += 1;
      }
      if (reg) regNos.push(reg.regNo);

      const docs = [];
      const insExp = parseLooseDate(get(row, 'insuranceExpiry'));
      const insStart = parseLooseDate(get(row, 'insuranceStart'));
      if (insExp || insStart || get(row, 'policyNo')) {
        const pt = String(get(row, 'policyType') || '').toUpperCase();
        docs.push({
          type: 'insurance', number: get(row, 'policyNo') ? String(get(row, 'policyNo')) : undefined, provider: get(row, 'insurer') || undefined,
          startDate: insStart || undefined, expiryDate: insExp || (insStart ? insuranceEnd(insStart) : undefined),
          insurance: { policyType: /TP|THIRD/.test(pt) && !/COMP/.test(pt) ? 'TP' : /COMP|PACKAGE/.test(pt) ? 'COMPREHENSIVE' : /OD/.test(pt) ? 'OD' : null, totalPremium: num(get(row, 'premium')), odPremium: num(get(row, 'odPremium')) },
        });
      }
      for (const [f, type] of [['pucExpiry', 'puc'], ['fitnessExpiry', 'fitness'], ['permitExpiry', 'permit'], ['taxExpiry', 'road_tax']]) {
        const d = parseLooseDate(get(row, f));
        if (d) docs.push({ type, expiryDate: d });
      }
      for (const d of docs) {
        if (!vehicle && d.type !== 'insurance') continue;
        const dup = await Document.exists({ tenantId: req.tenantId, vehicleId: vehicle?._id, customerId: customer._id, type: d.type, expiryDate: d.expiryDate });
        if (dup) continue;
        const current = vehicle && await Document.findOne({ tenantId: req.tenantId, vehicleId: vehicle._id, type: d.type, status: 'active' });
        // Keep whichever is newer as the active one.
        const isNewer = !current || !current.expiryDate || (d.expiryDate && d.expiryDate > current.expiryDate);
        if (current && isNewer) await Document.updateOne({ _id: current._id }, { $set: { status: 'archived' } });
        await Document.create({ ...d, tenantId: req.tenantId, agentId: customer.agentId, customerId: customer._id, vehicleId: vehicle?._id, source: 'import', status: isNewer ? 'active' : 'archived', notes: get(row, 'notes') || undefined });
        out.documents += 1;
      }
    } catch (e) {
      out.errors.push({ row: i + 2, error: e.message });
    }
  }

  const tenant = await Tenant.findById(req.tenantId);
  await buildQueueForTenant(tenant);
  if (autoFetch && regNos.length) {
    const job = await BulkJob.create({ tenantId: req.tenantId, userId: req.user._id, source: 'import', items: [...new Set(regNos)].slice(0, 500).map((regNo) => ({ regNo })) });
    runBulkJob(job._id).catch((e) => console.error('[bulk]', e));
    out.bulkJobId = job._id;
  }
  res.json(out);
}));

r.get('/export/all.xlsx', asyncH(async (req, res) => {
  const s = scope(req);
  const [customers, vehicles, docs, users] = await Promise.all([
    Customer.find(s).sort({ name: 1 }).lean(),
    Vehicle.find(s).sort({ regNo: 1 }).lean(),
    Document.find({ ...s, status: 'active' }).sort({ expiryDate: 1 }).lean(),
    User.find({ tenantId: req.tenantId }).select('name').lean(),
  ]);
  const cM = Object.fromEntries(customers.map((c) => [String(c._id), c]));
  const vM = Object.fromEntries(vehicles.map((v) => [String(v._id), v]));
  const uM = Object.fromEntries(users.map((u) => [String(u._id), u.name]));
  const buf = await workbook([
    {
      name: 'Customers',
      columns: [
        { header: 'Name', key: 'name', width: 26 }, { header: 'Mobile', key: 'mobile' }, { header: 'WhatsApp', key: 'whatsapp' },
        { header: 'Alt no.', key: 'altMobile' }, { header: 'City', key: 'city' }, { header: 'Language', key: 'language' },
        { header: 'Tags', key: 'tags' }, { header: 'Referred by', key: 'referredBy' }, { header: 'Agent', key: 'agent' }, { header: 'Notes', key: 'notes', width: 30 },
      ],
      rows: customers.map((c) => ({ ...c, tags: (c.tags || []).join(', '), agent: uM[String(c.agentId)] })),
    },
    {
      name: 'Vehicles',
      columns: [
        { header: 'Reg no.', key: 'reg' }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Mobile', key: 'mobile' },
        { header: 'Type', key: 'vehicleType' }, { header: 'Maker', key: 'maker', width: 24 }, { header: 'Model', key: 'model', width: 22 },
        { header: 'Fuel', key: 'fuel' }, { header: 'Mfg. year', key: 'manufacturingYear' }, { header: 'Reg. date', key: 'regDate' },
        { header: 'Chassis no.', key: 'chassisNo', width: 22 }, { header: 'Engine no.', key: 'engineNo', width: 18 }, { header: 'RTO', key: 'rto', width: 20 },
        { header: 'Financer', key: 'financer', width: 20 }, { header: 'RC status', key: 'rcStatus' },
      ],
      rows: vehicles.map((v) => ({ ...v, reg: displayRegNo(v.regNo), customer: cM[String(v.customerId)]?.name, mobile: cM[String(v.customerId)]?.mobile, regDate: formatDate(v.registrationDate) })),
    },
    {
      name: 'Documents',
      columns: [
        { header: 'Reg no.', key: 'reg' }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Document', key: 'type' },
        { header: 'Number', key: 'number', width: 22 }, { header: 'Insurer / issuer', key: 'provider', width: 28 },
        { header: 'Start', key: 'start' }, { header: 'Expiry', key: 'expiry' }, { header: 'Policy type', key: 'policyType' },
        { header: 'Premium (₹)', key: 'premium' }, { header: 'Commission (₹)', key: 'commission' },
      ],
      rows: docs.map((d) => ({
        ...d, reg: vM[String(d.vehicleId)] ? displayRegNo(vM[String(d.vehicleId)].regNo) : '', customer: cM[String(d.customerId)]?.name,
        start: formatDate(d.startDate), expiry: formatDate(d.expiryDate), policyType: d.insurance?.policyType,
        premium: d.insurance?.totalPremium ?? d.amount, commission: d.commission?.amount,
      })),
    },
  ]);
  sendXlsx(res, 'vahan-seva-kendra-export.xlsx', buf);
}));

export default r;
