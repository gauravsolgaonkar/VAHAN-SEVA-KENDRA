import Document from '../models/Document.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { lookupRc } from '../rc/index.js';
import { addDays, daysUntil, istDayStart } from '../utils/dates.js';
import { syncDocsFromRc } from '../utils/docsFromRc.js';
import { ensureCase, setStatus } from '../utils/renewal.js';

const AUTO_CONSENT = 'Automated renewal check under the customer\'s earlier consent';

/** "pre" = 3-5 days before insurance expiry, "post" = 1-3 days after. */
export function checkWindow(days) {
  if (days >= 3 && days <= 5) return 'pre';
  if (days <= -1 && days >= -3) return 'post';
  return null;
}

/**
 * Compare fresh VAHAN data with our insurance record.
 * Later expiry + policy number we issued -> renewed_us; later expiry + other policy -> renewed_elsewhere.
 */
export async function classify(doc, normalized) {
  const exp = normalized?.insurance?.expiry ? new Date(normalized.insurance.expiry) : null;
  if (!exp || exp.getTime() <= new Date(doc.expiryDate).getTime() + 86400000) return 'not_yet';
  const policyNo = normalized.insurance.policyNo;
  const ours = policyNo && await Document.exists({
    tenantId: doc.tenantId, vehicleId: doc.vehicleId, type: 'insurance', number: policyNo, source: { $in: ['renewal', 'manual', 'import'] },
  });
  return ours ? 'renewed_us' : 'renewed_elsewhere';
}

export async function runRenewalCheckForTenant(tenant, { force = false, now = new Date() } = {}) {
  const out = { checked: 0, renewedElsewhere: 0, renewedUs: 0, notYet: 0, failed: 0, stoppedNoCredits: false };
  if (!tenant.settings?.renewalCheck && !force) return out;
  const owner = await User.findOne({ tenantId: tenant._id, role: 'owner', active: true });
  if (!owner) return out;
  const today = istDayStart(now);
  const docs = await Document.find({
    tenantId: tenant._id, type: 'insurance', status: 'active', vehicleId: { $ne: null },
    expiryDate: { $gte: addDays(today, -3), $lt: addDays(today, 6) },
  });

  for (const doc of docs) {
    const window = checkWindow(daysUntil(doc.expiryDate, now));
    if (!window) continue;
    const rc = await ensureCase(doc);
    if (['renewed', 'lost'].includes(rc.status) || rc.renewalChecks.some((c) => c.window === window)) continue;
    const vehicle = await Vehicle.findOne({ _id: doc.vehicleId, tenantId: tenant._id });
    if (!vehicle) continue;

    let result;
    try {
      const { record } = await lookupRc({ tenantId: tenant._id, user: owner, regNo: vehicle.regNo, refresh: true, ip: 'renewal-check', userAgent: 'cron', consentText: AUTO_CONSENT });
      result = await classify(doc, record.normalized);
      if (result === 'renewed_elsewhere') {
        setStatus(rc, 'lost', { auto: true, lostReason: 'renewed_elsewhere' });
        await syncDocsFromRc(vehicle, record.normalized); // keep the new policy as current, old one as history
        out.renewedElsewhere += 1;
      } else if (result === 'renewed_us') {
        setStatus(rc, 'renewed', { auto: true });
        out.renewedUs += 1;
      } else {
        out.notYet += 1;
      }
    } catch (e) {
      if (e.code === 'no_credits') {
        out.stoppedNoCredits = true;
        break;
      }
      result = `error: ${e.code || e.message}`;
      out.failed += 1;
    }
    out.checked += 1;
    rc.renewalChecks.push({ window, at: new Date(), result });
    await rc.save();
  }
  return out;
}

export async function runAllRenewalChecks(now = new Date()) {
  const tenants = await Tenant.find({ 'settings.renewalCheck': true });
  for (const t of tenants) await runRenewalCheckForTenant(t, { now });
}
