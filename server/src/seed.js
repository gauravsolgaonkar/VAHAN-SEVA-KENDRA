// Demo data: `npm run seed` (wipes the demo tenant only).
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from './config.js';
import { buildQueueForTenant } from './jobs/reminders.js';
import ConsentLog from './models/ConsentLog.js';
import Customer from './models/Customer.js';
import Document from './models/Document.js';
import RcCallLog from './models/RcCallLog.js';
import RcRecord from './models/RcRecord.js';
import Reminder from './models/Reminder.js';
import Template from './models/Template.js';
import Tenant from './models/Tenant.js';
import User from './models/User.js';
import Vehicle from './models/Vehicle.js';
import { lookupRc } from './rc/index.js';
import { addDays } from './utils/dates.js';
import { syncDocsFromRc } from './utils/docsFromRc.js';

const OWNER_MOBILE = '9999999999';
const titleCase = (s = '') => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

await mongoose.connect(config.mongoUri);

const old = await User.findOne({ mobile: OWNER_MOBILE });
if (old) {
  const tenantId = old.tenantId;
  for (const M of [ConsentLog, Customer, Document, RcCallLog, RcRecord, Reminder, Template, Vehicle, User]) await M.deleteMany({ tenantId });
  await Tenant.deleteOne({ _id: tenantId });
}

const tenant = await Tenant.create({ name: 'Shree Sai Insurance Services', phone: OWNER_MOBILE, city: 'Kolhapur', trialEndsAt: addDays(new Date(), 15) });
const hash = await bcrypt.hash('demo123', 10);
const owner = await User.create({ tenantId: tenant._id, name: 'Gaurav Solgaonkar', mobile: OWNER_MOBILE, passwordHash: hash, role: 'owner', canViewAll: true, language: 'mr' });
const staff = await User.create({ tenantId: tenant._id, name: 'Rohit Kamble', mobile: '9888888888', passwordHash: hash, role: 'staff', language: 'mr' });

async function addVehicle(regNo, customer, agent = owner) {
  const { record } = await lookupRc({ tenantId: tenant._id, user: agent, regNo, ip: '127.0.0.1', userAgent: 'seed' });
  const n = record.normalized;
  const v = await Vehicle.create({
    tenantId: tenant._id, agentId: customer.agentId, customerId: customer._id, regNo, vehicleType: n.vehicleType,
    ownerName: titleCase(n.ownerName), fatherName: titleCase(n.fatherName), presentAddress: n.presentAddress, permanentAddress: n.permanentAddress,
    maker: n.maker, model: n.model, variant: n.variant, bodyType: n.bodyType, vehicleClass: n.vehicleClass, vehicleCategory: n.vehicleCategory,
    fuel: n.fuel, norms: n.norms, colour: n.colour, seatingCapacity: n.seatingCapacity, grossWeight: n.grossWeight, unladenWeight: n.unladenWeight,
    manufacturingYear: n.manufacturingYear, registrationDate: n.registrationDate, rcValidUpto: n.rcValidUpto, chassisNo: n.chassisNo,
    engineNo: n.engineNo, rto: n.rto, financer: n.financer, rcStatus: n.rcStatus, blacklisted: n.blacklisted,
    rcRecordId: record._id, rcFetchedAt: record.fetchedAt,
  });
  await syncDocsFromRc(v, n);
  return v;
}

const c = (data, agent = owner) => Customer.create({ tenantId: tenant._id, agentId: agent._id, whatsapp: data.mobile, ...data });

const santosh = await c({ name: 'Santosh Patil', mobile: '9822012345', city: 'Khed', language: 'mr', tags: ['walkin'] });
await addVehicle('MH08AB1234', santosh);
await Document.create({
  tenantId: tenant._id, agentId: owner._id, customerId: santosh._id, type: 'health', provider: 'Star Health', number: 'P/151100/01/2025/004512',
  startDate: addDays(new Date(), -355), expiryDate: addDays(new Date(), 10), insurance: { totalPremium: 18450 },
});

const vijay = await c({ name: 'Vijay Jadhav (Shri Ganesh Constructions)', mobile: '9890011223', city: 'Kolhapur', language: 'mr', tags: ['fleet'] });
await addVehicle('MH09CD5678', vijay);
for (const r of ['MH09CD5679', 'MH09CD5680', 'MH09EM2211']) await addVehicle(r, vijay);

const priyanka = await c({ name: 'Priyanka Deshmukh', mobile: '9765432109', city: 'Pune', language: 'en', tags: ['reference'], referredBy: 'Santosh Patil' });
await addVehicle('MH12EF9012', priyanka);

const anil = await c({ name: 'Anil Shinde', mobile: '9922334455', city: 'Sangli', language: 'mr' }, staff);
await addVehicle('MH10GH3456', anil, staff);

const rajesh = await c({ name: 'Rajesh Yadav', mobile: '9811122233', city: 'Chakan', language: 'hi' });
await addVehicle('MH14JK7890', rajesh);

const sunita = await c({ name: 'Sunita Kadam', mobile: '9850098500', city: 'Satara', language: 'mr' }, staff);
await addVehicle('MH11BX4410', sunita, staff);
await addVehicle('MH11CY0907', sunita, staff);

// One lookup that fails, so the audit log shows a failed call.
await lookupRc({ tenantId: tenant._id, user: owner, regNo: 'MH01ZZ0001', ip: '127.0.0.1', userAgent: 'seed' }).catch(() => {});

const queued = await buildQueueForTenant(tenant);
console.log(`Seeded tenant "${tenant.name}". Reminders queued: ${queued}`);
console.log(`Login: owner ${OWNER_MOBILE} / demo123, staff 9888888888 / demo123`);
await mongoose.disconnect();
