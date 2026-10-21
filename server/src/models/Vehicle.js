import mongoose from 'mongoose';

export const VEHICLE_TYPES = ['2W', 'car', 'pickup', 'dumper', 'truck', 'bus', 'tractor', 'jcb', 'auto', 'other'];

const vehicleSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    regNo: { type: String, required: true, uppercase: true, trim: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, default: 'car' },

    ownerName: String,
    fatherName: String,
    presentAddress: String,
    permanentAddress: String,
    maker: String,
    model: String,
    variant: String,
    bodyType: String,
    vehicleClass: String,
    vehicleCategory: String,
    fuel: String,
    norms: String,
    colour: String,
    seatingCapacity: Number,
    cubicCapacity: Number,
    grossWeight: Number,
    unladenWeight: Number,
    manufacturingYear: Number,
    registrationDate: Date,
    rcValidUpto: Date,
    chassisNo: String,
    engineNo: String,
    rto: String,
    financer: String,
    rcStatus: String,
    blacklisted: { type: Boolean, default: false },

    // Last RC fetch snapshot (raw JSON lives in RcRecord).
    rcRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'RcRecord' },
    rcFetchedAt: Date,
    notes: String,
  },
  { timestamps: true },
);

vehicleSchema.index({ tenantId: 1, regNo: 1 }, { unique: true });
vehicleSchema.index({ tenantId: 1, chassisNo: 1 });

export default mongoose.model('Vehicle', vehicleSchema);
