import Document from '../models/Document.js';
import { addDays } from './dates.js';

/** Document records implied by a normalized RC response. Only entries with an expiry date. */
export function docsFromNormalized(n) {
  const docs = [];
  const d = (v) => (v ? new Date(v) : null);
  if (n.insurance?.expiry) {
    const exp = d(n.insurance.expiry);
    const start = new Date(exp);
    start.setFullYear(start.getFullYear() - 1);
    docs.push({ type: 'insurance', number: n.insurance.policyNo, provider: n.insurance.company, startDate: addDays(start, 1), expiryDate: exp });
  }
  if (n.puc?.expiry) docs.push({ type: 'puc', number: n.puc.number, expiryDate: d(n.puc.expiry) });
  if (n.fitnessExpiry) docs.push({ type: 'fitness', expiryDate: d(n.fitnessExpiry) });
  if (n.permit?.expiry) docs.push({ type: 'permit', number: n.permit.number, permitType: n.permit.type, startDate: d(n.permit.validFrom), expiryDate: d(n.permit.expiry) });
  if (n.taxPaidUpto && !n.taxLifetime) docs.push({ type: 'road_tax', expiryDate: d(n.taxPaidUpto) });
  if (n.rcValidUpto) docs.push({ type: 'rc', number: n.regNo, expiryDate: d(n.rcValidUpto) });
  return docs;
}

const sameDay = (a, b) => a && b && new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

/**
 * Create/refresh vehicle documents from RC data. A later expiry archives the current
 * document as history and creates a new one; an unchanged expiry is left alone.
 * Returns the list of created document ids.
 */
export async function syncDocsFromRc(vehicle, normalized) {
  const created = [];
  for (const spec of docsFromNormalized(normalized)) {
    const current = await Document.findOne({ tenantId: vehicle.tenantId, vehicleId: vehicle._id, type: spec.type, status: 'active' });
    if (current && (sameDay(current.expiryDate, spec.expiryDate) || current.expiryDate > spec.expiryDate)) continue;
    if (current) {
      current.status = 'archived';
      await current.save();
    }
    const doc = await Document.create({
      ...spec,
      tenantId: vehicle.tenantId,
      agentId: vehicle.agentId,
      customerId: vehicle.customerId,
      vehicleId: vehicle._id,
      source: 'rc_fetch',
    });
    created.push(doc._id);
  }
  return created;
}
