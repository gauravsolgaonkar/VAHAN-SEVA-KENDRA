import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'staff', 'readonly'], default: 'staff' },
    // Staff see only their own customers unless this is set.
    canViewAll: { type: Boolean, default: false },
    language: { type: String, enum: ['mr', 'hi', 'en'], default: 'mr' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  const { _id, tenantId, name, mobile, email, role, canViewAll, language, active } = this;
  return { id: _id, tenantId, name, mobile, email, role, canViewAll, language, active };
};

export default mongoose.model('User', userSchema);
