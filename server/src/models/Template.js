import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    docType: { type: String, default: 'default' },
    language: { type: String, enum: ['mr', 'hi', 'en'], required: true },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

templateSchema.index({ tenantId: 1, docType: 1, language: 1 }, { unique: true });

export default mongoose.model('Template', templateSchema);
