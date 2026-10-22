import mongoose from 'mongoose';

export const CASE_STATUSES = ['pending', 'contacted', 'quote_sent', 'renewed', 'lost'];
export const LOST_REASONS = ['price', 'renewed_elsewhere', 'vehicle_sold', 'other'];

// Renewal pipeline item, one per expiring document.
const renewalCaseSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, unique: true },
    docType: String,
    expiryDate: Date,
    status: { type: String, enum: CASE_STATUSES, default: 'pending' },
    lostReason: { type: String, enum: [...LOST_REASONS, null], default: null },
    followUpDate: Date,
    quoteAmount: Number,
    notes: [{ text: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date }],
    history: [{ status: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date, auto: Boolean }],
    renewedDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    closedAt: Date,
    renewalChecks: [{ window: String, at: Date, result: String }],
  },
  { timestamps: true },
);

renewalCaseSchema.index({ tenantId: 1, status: 1, expiryDate: 1 });
renewalCaseSchema.index({ tenantId: 1, closedAt: -1 });

export default mongoose.model('RenewalCase', renewalCaseSchema);
