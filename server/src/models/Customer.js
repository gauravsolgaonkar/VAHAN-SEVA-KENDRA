import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    altMobile: { type: String, trim: true },
    city: { type: String, trim: true },
    address: String,
    language: { type: String, enum: ['mr', 'hi', 'en'], default: 'mr' },
    tags: [String],
    referredBy: String,
    notes: String,
  },
  { timestamps: true },
);

customerSchema.index({ tenantId: 1, mobile: 1 });
customerSchema.index({ tenantId: 1, name: 1 });

export default mongoose.model('Customer', customerSchema);
