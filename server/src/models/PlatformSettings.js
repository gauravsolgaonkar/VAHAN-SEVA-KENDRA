import mongoose from 'mongoose';

// Single document of platform-wide settings (edited by the super-admin in Phase 3).
const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    pricePerCreditPaise: { type: Number, default: 500 }, // ₹5 per credit
    packs: {
      type: [{ id: String, credits: Number, discountPct: { type: Number, default: 0 } }],
      default: () => [
        { id: 'p50', credits: 50, discountPct: 0 },
        { id: 'p200', credits: 200, discountPct: 10 },
        { id: 'p500', credits: 500, discountPct: 20 },
      ],
    },
  },
  { timestamps: true },
);

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

export async function getPlatformSettings() {
  return (await PlatformSettings.findOne({ key: 'global' })) || PlatformSettings.create({ key: 'global' });
}

export function packPrice(settings, pack) {
  return Math.round(pack.credits * settings.pricePerCreditPaise * (1 - (pack.discountPct || 0) / 100));
}

export default PlatformSettings;
