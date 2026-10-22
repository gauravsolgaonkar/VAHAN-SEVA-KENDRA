import Document, { computeCommission } from '../models/Document.js';
import Reminder from '../models/Reminder.js';
import RenewalCase from '../models/RenewalCase.js';
import { insuranceEnd, pucEnd } from './dates.js';

/** Pipeline item for a document; created once, when the document first enters the reminder window. */
export function ensureCase(doc) {
  return RenewalCase.findOneAndUpdate(
    { documentId: doc._id },
    {
      $setOnInsert: {
        tenantId: doc.tenantId, agentId: doc.agentId, customerId: doc.customerId, vehicleId: doc.vehicleId,
        documentId: doc._id, docType: doc.type, expiryDate: doc.expiryDate, status: 'pending',
        history: [{ status: 'pending', at: new Date(), auto: true }],
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
}

export function setStatus(rc, status, { by, auto = false, lostReason } = {}) {
  if (rc.status === status && !lostReason) return;
  rc.status = status;
  rc.history.push({ status, by, at: new Date(), auto });
  if (status === 'lost') rc.lostReason = lostReason || rc.lostReason || 'other';
  if (status !== 'lost') rc.lostReason = null;
  rc.closedAt = ['renewed', 'lost'].includes(status) ? new Date() : null;
}

/**
 * Record a renewal done through us: create next period's document, archive the old one as history,
 * stop its reminders and close the case as renewed.
 */
export async function renewThroughUs(rc, oldDoc, data, user, vehicle) {
  const start = data.startDate ? new Date(data.startDate) : oldDoc.expiryDate ? new Date(oldDoc.expiryDate.getTime() + 86400000) : new Date();
  let expiry = data.expiryDate ? new Date(data.expiryDate) : null;
  if (!expiry) expiry = ['insurance', 'health', 'life'].includes(oldDoc.type) ? insuranceEnd(start) : oldDoc.type === 'puc' ? pucEnd(start, vehicle || {}) : null;
  const insurance = { ...(oldDoc.insurance?.toObject?.() || {}), ...(data.insurance || {}) };
  const commission = data.commission?.type ? { ...data.commission, amount: computeCommission(data.commission, insurance) } : undefined;

  const doc = await Document.create({
    tenantId: oldDoc.tenantId, agentId: oldDoc.agentId, customerId: oldDoc.customerId, vehicleId: oldDoc.vehicleId,
    type: oldDoc.type, number: data.number, provider: data.provider || oldDoc.provider, startDate: start, issueDate: data.issueDate,
    expiryDate: expiry, amount: data.amount, permitType: oldDoc.permitType, insurance, commission,
    source: 'renewal', bookedBy: user?._id, bookedAt: new Date(), paymentMode: data.paymentMode || null, notes: data.notes,
  });
  oldDoc.status = 'archived';
  await oldDoc.save();
  await Reminder.updateMany({ documentId: oldDoc._id, status: 'pending' }, { $set: { status: 'skipped' } });
  rc.renewedDocumentId = doc._id;
  setStatus(rc, 'renewed', { by: user?._id });
  await rc.save();
  return doc;
}
