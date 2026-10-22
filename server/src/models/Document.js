import mongoose from 'mongoose';

export const DOC_TYPES = [
  'insurance', 'puc', 'fitness', 'permit', 'road_tax', 'green_tax', 'speed_governor', 'vltd',
  'reflective_tape', 'fastag', 'rc', 'driving_licence', 'health', 'life',
];
// Types that belong to a customer rather than a vehicle.
export const PERSONAL_DOC_TYPES = ['health', 'life', 'driving_licence'];

const documentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    type: { type: String, enum: DOC_TYPES, required: true },
    number: String,
    provider: String, // insurer / issuing authority / PUC centre
    issueDate: Date,
    startDate: Date,
    expiryDate: { type: Date, index: true },
    amount: Number,
    permitType: String,
    insurance: {
      policyType: { type: String, enum: ['TP', 'OD', 'COMPREHENSIVE', null], default: null },
      idv: Number,
      ncb: Number,
      totalPremium: Number,
      odPremium: Number,
      tpPremium: Number,
    },
    // Commission earned on policies booked through us.
    commission: {
      type: { type: String, enum: ['pct_od', 'pct_tp', 'pct_total', 'flat', null], default: null },
      rate: Number, // % for pct_*, ₹ for flat
      amount: Number,
      platform: String, // Turtlemint, PB Partner, direct insurer, ...
      payoutReceived: { type: Boolean, default: false },
      payoutDate: Date,
    },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookedAt: Date,
    paymentMode: { type: String, enum: ['cash', 'upi', 'card', 'other', null], default: null },
    files: [{ path: String, name: String, mime: String, size: Number, uploadedAt: Date }],
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    source: { type: String, enum: ['manual', 'rc_fetch', 'import', 'renewal', 'puc_entry'], default: 'manual' },
    notes: String,
  },
  { timestamps: true },
);

documentSchema.index({ tenantId: 1, status: 1, expiryDate: 1 });
documentSchema.index({ tenantId: 1, bookedAt: -1 });

export const COMMISSION_TYPES = ['pct_od', 'pct_tp', 'pct_total', 'flat'];

/** Commission in ₹ from the policy's premiums. */
export function computeCommission(c = {}, ins = {}) {
  const rate = Number(c.rate) || 0;
  if (!c.type || !rate) return null;
  if (c.type === 'flat') return Math.round(rate);
  const base = { pct_od: ins.odPremium, pct_tp: ins.tpPremium, pct_total: ins.totalPremium }[c.type];
  return base ? Math.round((Number(base) * rate) / 100) : null;
}

export default mongoose.model('Document', documentSchema);
