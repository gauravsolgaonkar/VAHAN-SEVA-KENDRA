import mongoose from 'mongoose';

// Wallet ledger. Every change to Tenant.rcCredits writes one row.
const creditTxnSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['trial', 'purchase', 'fetch', 'refund', 'adjust'], required: true },
    credits: { type: Number, required: true }, // + added, - used
    balanceAfter: Number,
    regNo: String,
    orderId: String,
    note: String,
  },
  { timestamps: true },
);

creditTxnSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('CreditTxn', creditTxnSchema);
