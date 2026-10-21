import mongoose from 'mongoose';

const REMINDER_DEFAULT = [30, 15, 7, 3, 1, -1];

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: String,
    city: String,
    mode: { type: String, enum: ['agent', 'puc_centre'], default: 'agent' },
    plan: { type: String, default: 'trial' },
    trialEndsAt: Date,
    rcCredits: { type: Number, default: 25 },
    settings: {
      defaultLanguage: { type: String, enum: ['mr', 'hi', 'en'], default: 'mr' },
      // Days before expiry (negative = after) per document type; "default" applies to the rest.
      reminderOffsets: { type: Map, of: [Number], default: () => ({ default: REMINDER_DEFAULT }) },
      renewalCheck: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export const DEFAULT_REMINDER_OFFSETS = REMINDER_DEFAULT;
export default mongoose.model('Tenant', tenantSchema);
