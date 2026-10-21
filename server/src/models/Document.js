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
    files: [{ path: String, name: String, mime: String, size: Number, uploadedAt: Date }],
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    source: { type: String, enum: ['manual', 'rc_fetch', 'import'], default: 'manual' },
    notes: String,
  },
  { timestamps: true },
);

documentSchema.index({ tenantId: 1, status: 1, expiryDate: 1 });

export default mongoose.model('Document', documentSchema);
