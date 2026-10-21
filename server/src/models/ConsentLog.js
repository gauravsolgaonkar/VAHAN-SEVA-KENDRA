import mongoose from 'mongoose';

// DPDP: record that the customer consented to vehicle detail verification before each fetch.
const consentLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    regNo: { type: String, required: true },
    purpose: { type: String, default: 'vehicle_rc_verification' },
    text: String,
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);

export default mongoose.model('ConsentLog', consentLogSchema);
