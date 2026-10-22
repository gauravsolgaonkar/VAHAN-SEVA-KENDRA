import { Router } from 'express';
import { scope } from '../middleware/auth.js';
import { asyncH } from '../middleware/errors.js';
import Customer from '../models/Customer.js';
import Document from '../models/Document.js';
import RenewalCase from '../models/RenewalCase.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { addDays, istDayStart } from '../utils/dates.js';
import { formatDate } from '../utils/messages.js';
import { displayRegNo } from '../utils/regno.js';
import { sendXlsx, workbook } from '../utils/xlsx.js';

const r = Router();
const POLICY_TYPES = ['insurance', 'health', 'life'];
const GROUPS = ['month', 'agent', 'insurer', 'vehicleType', 'platform'];
const monthKey = (d) => {
  const x = new Date(new Date(d).getTime() + 330 * 60000);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
};

function range(q) {
  const to = q.to ? addDays(new Date(q.to), 1) : addDays(istDayStart(), 1);
  const from = q.from ? new Date(q.from) : (() => {
    const d = istDayStart();
    d.setUTCMonth(d.getUTCMonth() - 11, 1);
    return d;
  })();
  return { from, to };
}

/** Policies booked through us (with premium and commission), joined with agent and vehicle. */
async function bookedPolicies(req) {
  const { from, to } = range(req.query);
  const docs = await Document.find({ ...scope(req), type: { $in: POLICY_TYPES }, bookedAt: { $gte: from, $lt: to } }).sort({ bookedAt: -1 }).lean();
  const ids = (k) => [...new Set(docs.map((d) => String(d[k])).filter((x) => x && x !== 'undefined' && x !== 'null'))];
  const [users, vehicles, customers] = await Promise.all([
    User.find({ tenantId: req.tenantId }).select('name').lean(),
    Vehicle.find({ tenantId: req.tenantId, _id: { $in: ids('vehicleId') } }).select('regNo vehicleType').lean(),
    Customer.find({ tenantId: req.tenantId, _id: { $in: ids('customerId') } }).select('name mobile').lean(),
  ]);
  const m = (a) => Object.fromEntries(a.map((x) => [String(x._id), x]));
  const [uM, vM, cM] = [m(users), m(vehicles), m(customers)];
  return docs.map((d) => {
    const premium = d.insurance?.totalPremium ?? d.amount ?? 0;
    const commission = d.commission?.amount ?? 0;
    return {
      id: d._id, bookedAt: d.bookedAt, month: monthKey(d.bookedAt), type: d.type, number: d.number, insurer: d.provider || '—',
      policyType: d.insurance?.policyType, premium, odPremium: d.insurance?.odPremium ?? 0, tpPremium: d.insurance?.tpPremium ?? 0,
      commission, platform: d.commission?.platform || '—', payoutReceived: Boolean(d.commission?.payoutReceived),
      agent: uM[String(d.bookedBy || d.agentId)]?.name || '—', vehicleType: vM[String(d.vehicleId)]?.vehicleType || (d.type === 'insurance' ? 'other' : d.type),
      regNo: vM[String(d.vehicleId)]?.regNo, customer: cM[String(d.customerId)]?.name, mobile: cM[String(d.customerId)]?.mobile,
      vehicleId: d.vehicleId, customerId: d.customerId,
    };
  });
}

export function groupPolicies(policies, groupBy) {
  const rows = {};
  for (const p of policies) {
    const key = p[groupBy] ?? '—';
    rows[key] ??= { key, policies: 0, premium: 0, odPremium: 0, commission: 0, received: 0, pending: 0 };
    const g = rows[key];
    g.policies += 1;
    g.premium += p.premium;
    g.odPremium += p.odPremium;
    g.commission += p.commission;
    if (p.payoutReceived) g.received += p.commission;
    else g.pending += p.commission;
  }
  const out = Object.values(rows);
  return groupBy === 'month' ? out.sort((a, b) => b.key.localeCompare(a.key)) : out.sort((a, b) => b.premium - a.premium);
}

r.get('/business', asyncH(async (req, res) => {
  const groupBy = GROUPS.includes(req.query.groupBy) ? req.query.groupBy : 'month';
  const policies = await bookedPolicies(req);
  const sum = (k) => policies.reduce((s, p) => s + (p[k] || 0), 0);
  res.json({
    groupBy,
    totals: {
      policies: policies.length, premium: sum('premium'), commission: sum('commission'),
      pending: policies.filter((p) => !p.payoutReceived).reduce((s, p) => s + p.commission, 0),
    },
    rows: groupPolicies(policies, groupBy),
    recent: policies.slice(0, 50),
  });
}));

const EXPIRY_WINDOWS = { today: 1, week: 7, month: 30 };

async function expiring(req) {
  const days = EXPIRY_WINDOWS[req.query.window] || 7;
  const today = istDayStart();
  const docs = await Document.find({ ...scope(req), status: 'active', expiryDate: { $gte: today, $lt: addDays(today, days) } }).sort({ expiryDate: 1 }).limit(1000).lean();
  const ids = (k) => [...new Set(docs.map((d) => String(d[k])).filter((x) => x && x !== 'undefined' && x !== 'null'))];
  const [vs, cs, cases] = await Promise.all([
    Vehicle.find({ tenantId: req.tenantId, _id: { $in: ids('vehicleId') } }).select('regNo vehicleType').lean(),
    Customer.find({ tenantId: req.tenantId, _id: { $in: ids('customerId') } }).select('name mobile').lean(),
    RenewalCase.find({ tenantId: req.tenantId, documentId: { $in: docs.map((d) => d._id) } }).select('documentId status').lean(),
  ]);
  const m = (a, k = '_id') => Object.fromEntries(a.map((x) => [String(x[k]), x]));
  const [vM, cM, rM] = [m(vs), m(cs), m(cases, 'documentId')];
  return docs.map((d) => ({
    id: d._id, type: d.type, expiryDate: d.expiryDate, number: d.number, provider: d.provider,
    regNo: vM[String(d.vehicleId)]?.regNo, vehicleId: d.vehicleId, vehicleType: vM[String(d.vehicleId)]?.vehicleType,
    customer: cM[String(d.customerId)]?.name, mobile: cM[String(d.customerId)]?.mobile, customerId: d.customerId,
    caseStatus: rM[String(d._id)]?.status || null,
  }));
}

r.get('/expiring', asyncH(async (req, res) => res.json(await expiring(req))));

r.get('/export/business.xlsx', asyncH(async (req, res) => {
  const policies = await bookedPolicies(req);
  const money = '#,##0';
  const summaryCols = (h) => [
    { header: h, key: 'key', width: 22 }, { header: 'Policies', key: 'policies' }, { header: 'Premium (₹)', key: 'premium', numFmt: money },
    { header: 'OD premium (₹)', key: 'odPremium', numFmt: money }, { header: 'Commission (₹)', key: 'commission', numFmt: money },
    { header: 'Received (₹)', key: 'received', numFmt: money }, { header: 'Pending (₹)', key: 'pending', numFmt: money },
  ];
  const buf = await workbook([
    { name: 'By month', columns: summaryCols('Month'), rows: groupPolicies(policies, 'month') },
    { name: 'By agent', columns: summaryCols('Agent'), rows: groupPolicies(policies, 'agent') },
    { name: 'By insurer', columns: summaryCols('Insurer'), rows: groupPolicies(policies, 'insurer') },
    { name: 'By vehicle type', columns: summaryCols('Vehicle type'), rows: groupPolicies(policies, 'vehicleType') },
    { name: 'By platform', columns: summaryCols('Platform'), rows: groupPolicies(policies, 'platform') },
    {
      name: 'Policies',
      columns: [
        { header: 'Booked on', key: 'bookedOn' }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Mobile', key: 'mobile' },
        { header: 'Reg no.', key: 'regNo' }, { header: 'Type', key: 'type' }, { header: 'Policy type', key: 'policyType' },
        { header: 'Insurer', key: 'insurer', width: 30 }, { header: 'Policy no.', key: 'number', width: 22 },
        { header: 'Premium (₹)', key: 'premium', numFmt: money }, { header: 'OD (₹)', key: 'odPremium', numFmt: money },
        { header: 'TP (₹)', key: 'tpPremium', numFmt: money }, { header: 'Commission (₹)', key: 'commission', numFmt: money },
        { header: 'Platform', key: 'platform' }, { header: 'Payout received', key: 'payout' }, { header: 'Agent', key: 'agent' },
      ],
      rows: policies.map((p) => ({ ...p, bookedOn: formatDate(p.bookedAt), regNo: p.regNo ? displayRegNo(p.regNo) : '', payout: p.payoutReceived ? 'Yes' : 'No' })),
    },
  ]);
  sendXlsx(res, 'business-report.xlsx', buf);
}));

r.get('/export/expiring.xlsx', asyncH(async (req, res) => {
  const rows = await expiring(req);
  const buf = await workbook([{
    name: 'Expiring',
    columns: [
      { header: 'Expiry', key: 'expiry' }, { header: 'Document', key: 'type' }, { header: 'Reg no.', key: 'reg' },
      { header: 'Customer', key: 'customer', width: 24 }, { header: 'Mobile', key: 'mobile' }, { header: 'Number', key: 'number', width: 22 },
      { header: 'Insurer / issuer', key: 'provider', width: 28 }, { header: 'Pipeline', key: 'caseStatus' },
    ],
    rows: rows.map((x) => ({ ...x, expiry: formatDate(x.expiryDate), reg: x.regNo ? displayRegNo(x.regNo) : '' })),
  }]);
  sendXlsx(res, `expiring-${req.query.window || 'week'}.xlsx`, buf);
}));

export default r;
