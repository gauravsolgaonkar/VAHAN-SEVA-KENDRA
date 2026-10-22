import CreditTxn from './models/CreditTxn.js';
import Tenant from './models/Tenant.js';

/** Atomically take `n` credits; returns the new balance, or null if the balance is too low. */
export async function takeCredits(tenantId, n, { userId, regNo, type = 'fetch', note } = {}) {
  const t = await Tenant.findOneAndUpdate({ _id: tenantId, rcCredits: { $gte: n } }, { $inc: { rcCredits: -n } }, { returnDocument: 'after' });
  if (!t) return null;
  await CreditTxn.create({ tenantId, userId, type, credits: -n, balanceAfter: t.rcCredits, regNo, note });
  return t.rcCredits;
}

export async function addCredits(tenantId, n, { userId, regNo, type = 'purchase', orderId, note } = {}) {
  const t = await Tenant.findOneAndUpdate({ _id: tenantId }, { $inc: { rcCredits: n } }, { returnDocument: 'after' });
  await CreditTxn.create({ tenantId, userId, type, credits: n, balanceAfter: t.rcCredits, regNo, orderId, note });
  return t.rcCredits;
}
