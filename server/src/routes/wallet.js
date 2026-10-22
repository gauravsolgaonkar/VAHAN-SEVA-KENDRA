import crypto from 'node:crypto';
import { Router } from 'express';
import Razorpay from 'razorpay';
import { config } from '../config.js';
import { requireRole } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import CreditTxn from '../models/CreditTxn.js';
import PaymentOrder from '../models/PaymentOrder.js';
import { getPlatformSettings, packPrice } from '../models/PlatformSettings.js';
import Tenant from '../models/Tenant.js';
import { addCredits } from '../wallet.js';

const r = Router();
const live = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);
let client;
const razorpay = () => (client ??= new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret }));

const hmac = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');
const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Mark an order paid and add its credits exactly once. */
export async function creditOrder(orderId, paymentId) {
  const order = await PaymentOrder.findOneAndUpdate(
    { orderId, status: 'created' },
    { $set: { status: 'paid', paymentId, paidAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!order) return null; // already credited (or unknown)
  await addCredits(order.tenantId, order.credits, { userId: order.userId, type: 'purchase', orderId, note: `${order.credits} credit pack` });
  return order;
}

r.get('/', asyncH(async (req, res) => {
  const [tenant, settings, txns] = await Promise.all([
    Tenant.findById(req.tenantId).lean(),
    getPlatformSettings(),
    CreditTxn.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(100).populate('userId', 'name').lean(),
  ]);
  res.json({
    balance: tenant.rcCredits,
    lowThreshold: tenant.settings?.lowCreditThreshold ?? 10,
    packs: settings.packs.map((p) => ({ id: p.id, credits: p.credits, discountPct: p.discountPct, pricePaise: packPrice(settings, p) })),
    pricePerCreditPaise: settings.pricePerCreditPaise,
    payments: live() ? 'razorpay' : config.paymentsMock ? 'mock' : 'off',
    txns,
  });
}));

r.post('/orders', requireRole('owner'), asyncH(async (req, res) => {
  const settings = await getPlatformSettings();
  const pack = settings.packs.find((p) => p.id === req.body.packId);
  if (!pack) throw new HttpError(400, 'validation', 'packId');
  const amountPaise = packPrice(settings, pack);
  let orderId;
  if (live()) {
    const o = await razorpay().orders.create({ amount: amountPaise, currency: 'INR', receipt: `vsk_${Date.now()}`, notes: { tenantId: String(req.tenantId), packId: pack.id } });
    orderId = o.id;
  } else if (config.paymentsMock) {
    orderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
  } else {
    throw new HttpError(503, 'payments_off');
  }
  await PaymentOrder.create({ tenantId: req.tenantId, userId: req.user._id, orderId, packId: pack.id, credits: pack.credits, amountPaise, mock: !live() });
  const tenant = await Tenant.findById(req.tenantId).lean();
  res.status(201).json({
    orderId, amountPaise, credits: pack.credits, currency: 'INR', mock: !live(), keyId: live() ? config.razorpay.keyId : null,
    prefill: { name: req.user.name, contact: req.user.mobile, email: req.user.email || undefined }, businessName: tenant.name,
  });
}));

// Called by the app after Razorpay Checkout succeeds.
r.post('/verify', requireRole('owner'), asyncH(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  const order = await PaymentOrder.findOne({ orderId, tenantId: req.tenantId });
  if (!order) throw new HttpError(404, 'not_found');
  if (order.mock) {
    if (live() || !config.paymentsMock) throw new HttpError(400, 'invalid_signature');
  } else if (!signature || !safeEqual(hmac(config.razorpay.keySecret, `${orderId}|${paymentId}`), String(signature))) {
    throw new HttpError(400, 'invalid_signature');
  }
  await creditOrder(orderId, paymentId || `mock_pay_${Date.now()}`);
  const tenant = await Tenant.findById(req.tenantId).lean();
  res.json({ balance: tenant.rcCredits });
}));

export default r;

/** Razorpay webhook (payment.captured / order.paid). Needs the raw body for signature checks. */
export async function razorpayWebhook(req, res) {
  const sig = req.get('x-razorpay-signature') || '';
  if (!config.razorpay.webhookSecret || !safeEqual(hmac(config.razorpay.webhookSecret, req.body), sig)) {
    return res.status(400).json({ error: 'invalid_signature' });
  }
  const event = JSON.parse(req.body.toString('utf8'));
  const payment = event.payload?.payment?.entity;
  if (['payment.captured', 'order.paid'].includes(event.event) && payment?.order_id) {
    await creditOrder(payment.order_id, payment.id);
  }
  res.json({ ok: true });
}
