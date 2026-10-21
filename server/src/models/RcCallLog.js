import mongoose from 'mongoose';

// One row per RC lookup attempt (including cache hits) for audit and billing.
const rcCallLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    regNo: { type: String, required: true },
    provider: String,
    cached: { type: Boolean, default: false },
    success: Boolean,
    cost: { type: Number, default: 0 },
    durationMs: Number,
    error: String,
    consentLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsentLog' },
    ip: String,
  },
  { timestamps: true },
);

rcCallLogSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('RcCallLog', rcCallLogSchema);
