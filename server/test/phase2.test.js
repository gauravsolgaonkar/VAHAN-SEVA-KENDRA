// Integration tests for Phase 2. Needs a MongoDB-compatible server at TEST_MONGODB_URI.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';

process.env.PAYMENTS_MOCK = '1';
process.env.BULK_DELAY_MS = '0';
const { createApp } = await import('../src/app.js');
const { classify, checkWindow } = await import('../src/jobs/renewalCheck.js');
const { suggestMapping } = await import('../src/routes/data.js');
const { computeCommission } = await import('../src/models/Document.js');

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/vsk_test2';
let server;
let base;
let token;

async function call(path, { method = 'GET', body, form, tok = token, raw = false } = {}) {
  const headers = { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) };
  const res = await fetch(base + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (raw) return res;
  return { status: res.status, body: await res.json() };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.db.dropDatabase();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  token = (await call('/auth/register', { method: 'POST', tok: null, body: { businessName: 'P2', name: 'Owner', mobile: '9100000001', password: 'secret1' } })).body.token;
});

after(async () => {
  server.close();
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

test('pure helpers', () => {
  assert.equal(computeCommission({ type: 'pct_od', rate: 15 }, { odPremium: 10000 }), 1500);
  assert.equal(computeCommission({ type: 'flat', rate: 500 }, {}), 500);
  assert.equal(computeCommission({ type: 'pct_tp', rate: 2.5 }, {}), null);
  assert.equal(checkWindow(4), 'pre');
  assert.equal(checkWindow(-2), 'post');
  assert.equal(checkWindow(10), null);
  const m = suggestMapping(['Customer Name', 'Mobile No', 'Vehicle No', 'Insurance Company', 'Policy No', 'Policy Expiry', 'PUC Expiry', 'Premium']);
  assert.deepEqual(m, { customerName: 0, mobile: 1, regNo: 2, insurer: 3, policyNo: 4, insuranceExpiry: 5, pucExpiry: 6, premium: 7 });
});

test('wallet: live fetch costs 1 credit, cache is free, failures refunded, zero balance blocks', async () => {
  const start = (await call('/wallet')).body.balance;
  assert.equal(start, 25);
  await call('/rc/lookup', { method: 'POST', body: { regNo: 'MH08AB1234', consent: true } });
  await call('/rc/lookup', { method: 'POST', body: { regNo: 'MH08AB1234', consent: true } });
  assert.equal((await call('/wallet')).body.balance, 24, 'cached lookup is free');
  assert.equal((await call('/rc/lookup', { method: 'POST', body: { regNo: 'MH01ZZ0003', consent: true } })).status, 502);
  const w = (await call('/wallet')).body;
  assert.equal(w.balance, 24, 'failed fetch refunded');
  assert.deepEqual(w.txns.slice(0, 3).map((t) => t.type), ['refund', 'fetch', 'fetch']);

  // Buy a pack (mock payments).
  const order = await call('/wallet/orders', { method: 'POST', body: { packId: 'p50' } });
  assert.equal(order.status, 201);
  assert.equal(order.body.mock, true);
  const v = await call('/wallet/verify', { method: 'POST', body: { orderId: order.body.orderId } });
  assert.equal(v.body.balance, 74);
  await call('/wallet/verify', { method: 'POST', body: { orderId: order.body.orderId } });
  assert.equal((await call('/wallet')).body.balance, 74, 'an order is credited only once');

  await mongoose.connection.db.collection('tenants').updateMany({}, { $set: { rcCredits: 0 } });
  const blocked = await call('/rc/lookup', { method: 'POST', body: { regNo: 'MH12EF9012', consent: true } });
  assert.equal(blocked.status, 402);
  assert.equal(blocked.body.error, 'rc_no_credits');
  await mongoose.connection.db.collection('tenants').updateMany({}, { $set: { rcCredits: 50 } });
});

test('bulk fetch: estimate then queue to completion', async () => {
  const text = 'MH08AB1234\nmh 12 ef 9012\nMH12EF9012\nXX01AA1111\nMH10GH3456';
  const est = (await call('/rc/bulk/estimate', { method: 'POST', body: { text } })).body;
  assert.deepEqual(est.valid, ['MH08AB1234', 'MH12EF9012', 'MH10GH3456']);
  assert.deepEqual(est.invalid, ['XX01AA1111']);
  assert.equal(est.duplicates, 1);
  assert.equal(est.creditsNeeded, 2, 'MH08AB1234 is cached');
  assert.equal((await call('/rc/bulk', { method: 'POST', body: { text } })).status, 400, 'consent required');
  const job = (await call('/rc/bulk', { method: 'POST', body: { text, consent: true } })).body;
  let state;
  for (let i = 0; i < 40; i += 1) {
    state = (await call(`/rc/bulk/${job._id}`)).body;
    if (state.status !== 'running') break;
    await sleep(250);
  }
  assert.equal(state.status, 'done');
  assert.ok(state.items.every((x) => x.status === 'done'));
  assert.equal((await call('/vehicles')).body.length, 3);
});

test('pipeline: status changes, notes, renew through us with commission', async () => {
  const cases = (await call('/pipeline?status=open')).body;
  assert.ok(cases.length > 0, 'cases created by the reminder queue');
  const ins = cases.find((c) => c.docType === 'insurance');
  let r = await call(`/pipeline/${ins._id}`, { method: 'PATCH', body: { status: 'quote_sent', quoteAmount: 9000, note: 'Sent Tata AIG quote', followUpDate: new Date().toISOString() } });
  assert.equal(r.body.status, 'quote_sent');
  assert.equal(r.body.notes.length, 1);
  assert.equal((await call(`/pipeline/${ins._id}`, { method: 'PATCH', body: { status: 'lost' } })).status, 400, 'lost needs a reason');
  r = await call(`/pipeline/${ins._id}/renew`, {
    method: 'POST',
    body: { number: 'NEW-123', provider: 'Tata AIG', insurance: { policyType: 'COMPREHENSIVE', odPremium: 6000, tpPremium: 3400, totalPremium: 11092 }, commission: { type: 'pct_od', rate: 15, platform: 'Turtlemint' } },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.case.status, 'renewed');
  assert.equal(r.body.document.commission.amount, 900);
  assert.equal(r.body.document.source, 'renewal');
  const old = (await call(`/documents/${ins.documentId}`)).body;
  assert.equal(old.status, 'archived');
  const sum = (await call('/pipeline/summary')).body;
  assert.equal(sum.month.renewed, 1);
});

test('renewal check: renewed elsewhere vs renewed through us', async () => {
  for (const reg of ['MH20RE0001', 'MH20RU0002']) {
    const l = (await call('/rc/lookup', { method: 'POST', body: { regNo: reg, consent: true } })).body;
    await call('/vehicles', { method: 'POST', body: { regNo: reg, rcRecordId: l.rcRecordId, customer: { name: reg } } });
  }
  // Record the "through us" renewal number on MH20RU0002's vehicle, as an agent would via the pipeline.
  const ru = (await call('/vehicles?q=MH20RU0002')).body[0];
  const cases = (await call('/pipeline?status=open')).body.filter((c) => c.docType === 'insurance' && c.vehicle?.regNo === 'MH20RU0002');
  await call(`/pipeline/${cases[0]._id}/renew`, { method: 'POST', body: { number: 'VSK-RENEW-0002', provider: 'Tata AIG' } });
  assert.ok(ru);

  const run = (await call('/pipeline/renewal-check/run', { method: 'POST' })).body;
  assert.equal(run.renewedElsewhere, 1);
  const lost = (await call('/pipeline?status=lost')).body.find((c) => c.vehicle?.regNo === 'MH20RE0001');
  assert.equal(lost.lostReason, 'renewed_elsewhere');
  const current = (await call(`/documents?vehicleId=${lost.vehicleId}&type=insurance`)).body;
  assert.equal(current[0].provider, 'Go Digit General Insurance Ltd.', 'new policy from VAHAN is now current');

  const doc = { tenantId: lost.tenantId, vehicleId: ru._id, expiryDate: new Date() };
  assert.equal(await classify(doc, { insurance: { expiry: new Date(Date.now() + 360 * 86400000), policyNo: 'VSK-RENEW-0002' } }), 'renewed_us');
  assert.equal(await classify(doc, { insurance: { expiry: new Date(Date.now() - 86400000), policyNo: 'X' } }), 'not_yet');
});

test('reports and Excel export', async () => {
  const rep = (await call('/reports/business?groupBy=insurer')).body;
  assert.ok(rep.totals.policies >= 1);
  assert.ok(rep.rows.some((x) => x.key === 'Tata AIG' && x.commission === 900));
  const res = await call('/reports/export/business.xlsx', { raw: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /spreadsheetml/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['By month', 'By agent', 'By insurer', 'By vehicle type', 'By platform', 'Policies']);
  assert.equal((await call('/reports/expiring?window=month')).status, 200);
});

test('import with column mapping, then export', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['Customer Name', 'Mobile No', 'Vehicle No', 'Insurance Company', 'Policy No', 'Policy Expiry', 'PUC Expiry']);
  ws.addRow(['Ramesh Gaikwad', '9800011122', 'MH 42 AB 1001', 'United India', 'UI-1', '15/12/2026', '2026-11-30']);
  ws.addRow(['Ramesh Gaikwad', '9800011122', 'MH42AB1002', 'United India', 'UI-2', new Date('2027-01-20'), '']);
  ws.addRow(['Bad Row', '', 'ZZ99', '', '', '', '']);
  const form = new FormData();
  form.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'customers.xlsx');
  const parsed = (await call('/data/import/parse', { method: 'POST', form })).body;
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.mapping.regNo, 2);
  const out = (await call('/data/import/commit', { method: 'POST', body: { rows: parsed.rows, mapping: parsed.mapping } })).body;
  assert.equal(out.customers, 1, 'same mobile -> one customer');
  assert.equal(out.vehicles, 2);
  assert.equal(out.documents, 3);
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].row, 4);
  const exp = await call('/data/export/all.xlsx', { raw: true });
  assert.equal(exp.status, 200);
});

test('PUC centre walk-in entry and day totals', async () => {
  const l = (await call('/rc/lookup', { method: 'POST', body: { regNo: 'MH11ZZ7777', consent: true } })).body;
  const e = await call('/puc/entry', { method: 'POST', body: { regNo: 'MH11ZZ7777', rcRecordId: l.rcRecordId, mobile: '9811111111', amount: 120, paymentMode: 'upi' } });
  assert.equal(e.status, 201);
  assert.ok(e.body.document.expiryDate);
  await call('/puc/entry', { method: 'POST', body: { regNo: 'MH12QQ0001', customerName: 'Walk In', amount: 80, paymentMode: 'cash', vehicleType: '2W' } });
  const day = (await call('/puc/day')).body;
  assert.equal(day.totals.count, 2);
  assert.equal(day.totals.total, 200);
  assert.equal(day.totals.cash, 80);
  const dash = (await call('/dashboard')).body;
  assert.equal(dash.puc.count, 2);
  assert.ok(dash.month.commission >= 900);
});
