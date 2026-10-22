import mongoose from 'mongoose';

// Queue of RC fetches started from bulk fetch or import.
const bulkJobSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['bulk', 'import'], default: 'bulk' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, // all vehicles to this customer; else one per owner
    status: { type: String, enum: ['running', 'done', 'stopped'], default: 'running' },
    items: [{
      regNo: String,
      status: { type: String, enum: ['queued', 'done', 'failed', 'skipped'], default: 'queued' },
      cached: Boolean,
      error: String,
      vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
      ownerName: String,
    }],
    finishedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model('BulkJob', bulkJobSchema);
