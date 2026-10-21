import { randomUUID } from 'node:crypto';
import { config } from '../../config.js';
import { RcProviderError } from '../errors.js';
import { fromCashfree } from '../normalize.js';

// Cashfree Secure ID vehicle RC verification. Mapping written from public docs;
// verify against a live key before enabling in production.
export default {
  name: 'cashfree',
  costPerCall: Number(process.env.CASHFREE_COST || 0),
  isConfigured: () => Boolean(config.cashfree.clientId && config.cashfree.clientSecret),
  async fetchRc(regNo, { signal } = {}) {
    if (!this.isConfigured()) throw new RcProviderError('config', 'Cashfree credentials not set', 'cashfree');
    let res;
    try {
      res = await fetch(`${config.cashfree.baseUrl}/verification/vehicle-rc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': config.cashfree.clientId,
          'x-client-secret': config.cashfree.clientSecret,
        },
        body: JSON.stringify({ verification_id: randomUUID(), vehicle_number: regNo }),
        signal,
      });
    } catch (e) {
      throw new RcProviderError(e.name === 'AbortError' ? 'timeout' : 'upstream', e.message, 'cashfree');
    }
    const raw = await res.json().catch(() => null);
    if (raw?.status === 'INVALID' || res.status === 404) throw new RcProviderError('not_found', raw?.message || 'not found', 'cashfree');
    if (!res.ok || !raw) throw new RcProviderError('upstream', raw?.message || `HTTP ${res.status}`, 'cashfree');
    return { raw, normalized: fromCashfree(raw) };
  },
};
