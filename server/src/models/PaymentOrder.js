import mongoose from 'mongoose';

// Razorpay order for a credit pack. Credited once, when the payment is verified.
const paymentOrderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: String, required: true, unique: true },
    packId: String,
    credits: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    paymentId: String,
    paidAt: Date,
    mock: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('PaymentOrder', paymentOrderSchema);
