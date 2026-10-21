import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    docType: String,
    expiryDate: Date,
    offsetDays: Number, // 30 = 30 days before expiry, -1 = 1 day after
    scheduledFor: { type: Date, index: true },
    status: { type: String, enum: ['pending', 'sent', 'skipped'], default: 'pending' },
    channel: { type: String, default: 'wa_link' },
    sentAt: Date,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

reminderSchema.index({ documentId: 1, offsetDays: 1, expiryDate: 1 }, { unique: true });
reminderSchema.index({ tenantId: 1, status: 1, scheduledFor: 1 });

export default mongoose.model('Reminder', reminderSchema);
