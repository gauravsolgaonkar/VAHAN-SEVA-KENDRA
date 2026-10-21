// Integration: needs a MongoDB-compatible server at TEST_MONGODB_URI (default local).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/vsk_test';
let server;
let base;

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.db.dropDatabase();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

const register = async (mobile) => (await call('/auth/register', { method: 'POST', body: { businessName: `B${mobile}`, name: 'Owner', mobile, password: 'secret1' } })).body.token;

test('tenant isolation, staff scoping, read-only, RC cache', async () => {
  const a = await register('9000000001');
  const b = await register('9000000002');

  const lookup = await call('/rc/lookup', { token: a, method: 'POST', body: { regNo: 'MH08AB1234', consent: true } });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.cached, false);
  const again = await call('/rc/lookup', { token: a, method: 'POST', body: { regNo: 'MH08AB1234', consent: true } });
  assert.equal(again.body.cached, true, 'second lookup within 30 days uses cache');
  const refresh = await call('/rc/lookup', { token: a, method: 'POST', body: { regNo: 'MH08AB1234', consent: true, refresh: true } });
  assert.equal(refresh.body.cached, false, 'refresh bypasses cache');
  assert.equal((await call('/rc/lookup', { token: a, method: 'POST', body: { regNo: 'MH08AB1234' } })).status, 400, 'consent required');

  const created = await call('/vehicles', { token: a, method: 'POST', body: { regNo: 'MH08AB1234', rcRecordId: lookup.body.rcRecordId, customer: { name: 'Santosh', mobile: '9822012345' } } });
  assert.equal(created.status, 201);
  assert.equal(created.body.createdDocuments, 3);
  const vid = created.body.vehicle._id;

  // Tenant B cannot see or touch tenant A's data, and B's RC cache is separate.
  assert.equal((await call(`/vehicles/${vid}`, { token: b })).status, 404);
  assert.equal((await call('/customers', { token: b })).body.length, 0);
  assert.equal((await call(`/rc/records/${lookup.body.rcRecordId}`, { token: b })).status, 404);
  assert.equal((await call('/rc/lookup', { token: b, method: 'POST', body: { regNo: 'MH08AB1234', consent: true } })).body.cached, false);

  // Staff without view-all sees only their own customers.
  await call('/users', { token: a, method: 'POST', body: { name: 'Staff', mobile: '9000000003', password: 'secret1', role: 'staff' } });
  const s = (await call('/auth/login', { method: 'POST', body: { mobile: '9000000003', password: 'secret1' } })).body.token;
  assert.equal((await call('/customers', { token: s })).body.length, 0);
  assert.equal((await call(`/vehicles/${vid}`, { token: s })).status, 404);
  await call('/customers', { token: s, method: 'POST', body: { name: 'Staff customer' } });
  assert.equal((await call('/customers', { token: s })).body.length, 1);
  assert.equal((await call('/customers', { token: a })).body.length, 2, 'owner sees all');

  // Read-only can view but not write.
  await call('/users', { token: a, method: 'POST', body: { name: 'Viewer', mobile: '9000000004', password: 'secret1', role: 'readonly' } });
  const r = (await call('/auth/login', { method: 'POST', body: { mobile: '9000000004', password: 'secret1' } })).body.token;
  assert.equal((await call('/customers', { token: r })).status, 200);
  assert.equal((await call('/customers', { token: r, method: 'POST', body: { name: 'x' } })).status, 403);

  // Reminders queued for the due insurance / expired PUC, with wa.me links.
  const rem = await call('/reminders', { token: a });
  assert.ok(rem.body.length >= 2);
  assert.ok(rem.body.every((x) => x.waLink.startsWith('https://wa.me/919822012345?text=')));
  const logs = await call('/rc/logs', { token: a });
  assert.equal(logs.body.summary.cached, 1);
});
