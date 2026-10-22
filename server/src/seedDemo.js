// Demo data (wipes the demo tenant only). Used by `npm run seed` and by SEED_DEMO=1 on boot.
import bcrypt from 'bcryptjs';
import { buildQueueForTenant } from './jobs/reminders.js';
import BulkJob from './models/BulkJob.js';
import ConsentLog from './models/ConsentLog.js';
import CreditTxn from './models/CreditTxn.js';
import Customer from './models/Customer.js';
import Document, { computeCommission } from './models/Document.js';
import PaymentOrder from './models/PaymentOrder.js';
import RcCallLog from './models/RcCallLog.js';
import RcRecord from './models/RcRecord.js';
import Reminder from './models/Reminder.js';
import RenewalCase from './models/RenewalCase.js';
import Template from './models/Template.js';
import Tenant from './models/Tenant.js';
import User from './models/User.js';
import Vehicle from './models/Vehicle.js';
import { lookupRc } from './rc/index.js';
import { addDays, insuranceEnd } from './utils/dates.js';
import { setStatus } from './utils/renewal.js';
import { upsertVehicleFromRc } from './utils/vehicleFromRc.js';
import { addCredits } from './wallet.js';

export const OWNER_MOBILE = '9999999999';
const MODELS = [BulkJob, ConsentLog, CreditTxn, Customer, Document, PaymentOrder, RcCallLog, RcRecord, Reminder, RenewalCase, Template, Vehicle, User];

export async function seedDemo() {
  const old = await User.findOne({ mobile: OWNER_MOBILE });
  if (old) {
    for (const M of MODELS) await M.deleteMany({ tenantId: old.tenantId });
    await Tenant.deleteOne({ _id: old.tenantId });
  }

  const tenant = await Tenant.create({
    name: 'Shree Sai Insurance Services', phone: OWNER_MOBILE, city: 'Kolhapur', trialEndsAt: addDays(new Date(), 15),
    settings: { renewalCheck: true },
  });
  const hash = await bcrypt.hash('demo123', 10);
  const owner = await User.create({ tenantId: tenant._id, name: 'Gaurav Solgaonkar', mobile: OWNER_MOBILE, passwordHash: hash, role: 'owner', canViewAll: true, language: 'mr' });
  const staff = await User.create({ tenantId: tenant._id, name: 'Rohit Kamble', mobile: '9888888888', passwordHash: hash, role: 'staff', language: 'mr' });
  await CreditTxn.create({ tenantId: tenant._id, userId: owner._id, type: 'trial', credits: tenant.rcCredits, balanceAfter: tenant.rcCredits, note: 'Free trial credits' });
  await PaymentOrder.create({ tenantId: tenant._id, userId: owner._id, orderId: 'mock_order_seed', packId: 'p50', credits: 50, amountPaise: 25000, status: 'paid', paymentId: 'mock_pay_seed', paidAt: new Date(), mock: true });
  await addCredits(tenant._id, 50, { userId: owner._id, type: 'purchase', orderId: 'mock_order_seed', note: '50 credit pack' });

  const addVehicle = async (regNo, customer, agent = owner) => {
    const { record } = await lookupRc({ tenantId: tenant._id, user: agent, regNo, ip: '127.0.0.1', userAgent: 'seed' });
    return (await upsertVehicleFromRc({ tenantId: tenant._id, agentId: agent._id, record, customer })).vehicle;
  };
  const c = (data, agent = owner) => Customer.create({ tenantId: tenant._id, agentId: agent._id, whatsapp: data.mobile, ...data });

  const santosh = await c({ name: 'Santosh Patil', mobile: '9822012345', city: 'Khed', language: 'mr', tags: ['walkin'] });
  await addVehicle('MH08AB1234', santosh);
  await Document.create({
    tenantId: tenant._id, agentId: owner._id, customerId: santosh._id, type: 'health', provider: 'Star Health', number: 'P/151100/01/2025/004512',
    startDate: addDays(new Date(), -355), expiryDate: addDays(new Date(), 10), insurance: { totalPremium: 18450 },
  });

  const vijay = await c({ name: 'Vijay Jadhav (Shri Ganesh Constructions)', mobile: '9890011223', city: 'Kolhapur', language: 'mr', tags: ['fleet'] });
  for (const r of ['MH09CD5678', 'MH09CD5679', 'MH09CD5680', 'MH09EM2211']) await addVehicle(r, vijay);

  const priyanka = await c({ name: 'Priyanka Deshmukh', mobile: '9765432109', city: 'Pune', language: 'en', tags: ['reference'], referredBy: 'Santosh Patil' });
  await addVehicle('MH12EF9012', priyanka);
  const anil = await c({ name: 'Anil Shinde', mobile: '9922334455', city: 'Sangli', language: 'mr' }, staff);
  await addVehicle('MH10GH3456', anil, staff);
  const rajesh = await c({ name: 'Rajesh Yadav', mobile: '9811122233', city: 'Chakan', language: 'hi' });
  await addVehicle('MH14JK7890', rajesh);
  const sunita = await c({ name: 'Sunita Kadam', mobile: '9850098500', city: 'Satara', language: 'mr' }, staff);
  await addVehicle('MH11BX4410', sunita, staff);
  await addVehicle('MH11CY0907', sunita, staff);
  // Renewal-check demo vehicles (see mock provider): insurance due in 4 days.
  const mahesh = await c({ name: 'Mahesh Pawar', mobile: '9822233344', city: 'Wai', language: 'mr' });
  await addVehicle('MH20RE0001', mahesh);
  const kavita = await c({ name: 'Kavita More', mobile: '9822255566', city: 'Karad', language: 'mr' });
  await addVehicle('MH20RU0002', kavita);

  await lookupRc({ tenantId: tenant._id, user: owner, regNo: 'MH01ZZ0001', ip: '127.0.0.1', userAgent: 'seed' }).catch(() => {});

  // Business history: policies booked through us over the last 6 months, with commission.
  const insurers = ['ICICI Lombard General Insurance Co. Ltd.', 'Tata AIG General Insurance Co. Ltd.', 'Go Digit General Insurance Ltd.', 'HDFC ERGO General Insurance Co. Ltd.'];
  const platforms = ['Turtlemint', 'PB Partner', 'Direct insurer'];
  const vehicles = await Vehicle.find({ tenantId: tenant._id });
  let k = 0;
  for (let m = 5; m >= 0; m -= 1) {
    for (let j = 0; j < 3 + (m % 3); j += 1) {
      const v = vehicles[k % vehicles.length];
      k += 1;
      const booked = addDays(new Date(), -(m * 30 + j * 4 + 2));
      const od = 3000 + ((k * 997) % 9000);
      const tp = v.vehicleType === '2W' ? 1100 : v.vehicleType === 'car' ? 3400 : 16000;
      const ins = { policyType: j % 3 === 2 ? 'TP' : 'COMPREHENSIVE', odPremium: j % 3 === 2 ? 0 : od, tpPremium: tp, totalPremium: Math.round(((j % 3 === 2 ? 0 : od) + tp) * 1.18), idv: 250000 + k * 10000, ncb: 20 };
      const commission = { type: ins.policyType === 'TP' ? 'pct_tp' : 'pct_od', rate: ins.policyType === 'TP' ? 2.5 : 17.5, platform: platforms[k % 3], payoutReceived: m > 1 };
      commission.amount = computeCommission(commission, ins);
      await Document.create({
        tenantId: tenant._id, agentId: v.agentId, customerId: v.customerId, vehicleId: v._id, type: 'insurance', status: 'archived',
        provider: insurers[k % insurers.length], number: `HIST-${1000 + k}`, startDate: booked, expiryDate: insuranceEnd(booked),
        insurance: ins, commission, source: 'renewal', bookedAt: booked, bookedBy: k % 4 === 0 ? staff._id : owner._id,
      });
    }
  }
  // PUC walk-ins today.
  for (const [i, v] of vehicles.slice(0, 5).entries()) {
    await Document.create({
      tenantId: tenant._id, agentId: v.agentId, customerId: v.customerId, vehicleId: v._id, type: 'puc', status: 'archived',
      number: `PUC-${2100 + i}`, issueDate: new Date(), startDate: new Date(), expiryDate: addDays(new Date(), 364), amount: [100, 150, 50, 120, 100][i],
      paymentMode: i % 2 ? 'upi' : 'cash', source: 'puc_entry', bookedAt: addDays(new Date(), 0), bookedBy: owner._id,
    });
  }

  const queued = await buildQueueForTenant(tenant);
  // A pipeline in motion.
  const cases = await RenewalCase.find({ tenantId: tenant._id }).sort({ expiryDate: 1 });
  const plan = [['contacted'], ['quote_sent', 8450], ['lost', null, 'price'], ['contacted'], ['quote_sent', 2150]];
  for (const [i, [status, quote, reason]] of plan.entries()) {
    const rc = cases[i];
    if (!rc) break;
    setStatus(rc, status, { by: owner._id, lostReason: reason });
    if (quote) rc.quoteAmount = quote;
    rc.followUpDate = status === 'lost' ? null : addDays(new Date(), i % 2);
    rc.notes.push({ text: ['Called, asked to send quote on WhatsApp', 'Quote sent: Tata AIG comprehensive', 'Got cheaper quote from local agent', 'Will visit office on Saturday', 'Wants zero-dep add-on'][i], by: owner._id, at: new Date() });
    await rc.save();
  }
  console.log(`Seeded tenant "${tenant.name}". Reminders queued: ${queued}`);
  console.log(`Login: owner ${OWNER_MOBILE} / demo123, staff 9888888888 / demo123`);
}
