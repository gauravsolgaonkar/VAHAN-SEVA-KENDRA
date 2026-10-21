import mongoose from 'mongoose';

// Cached RC lookup per tenant + registration number. Raw provider JSON kept for audit.
const rcRecordSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    regNo: { type: String, required: true },
    provider: String,
    raw: mongoose.Schema.Types.Mixed,
    normalized: mongoose.Schema.Types.Mixed,
    fetchedAt: { type: Date, required: true },
    fetchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

rcRecordSchema.index({ tenantId: 1, regNo: 1 }, { unique: true });

export default mongoose.model('RcRecord', rcRecordSchema);
