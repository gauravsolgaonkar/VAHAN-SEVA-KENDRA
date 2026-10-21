import { config } from '../../config.js';
import { RcProviderError } from '../errors.js';
import { fromSurepass } from '../normalize.js';

// Surepass RC Full: POST /api/v1/rc/rc-full { id_number }. Token stays on the server.
export default {
  name: 'surepass',
  costPerCall: Number(process.env.SUREPASS_COST || 0),
  isConfigured: () => Boolean(config.surepass.token),
  async fetchRc(regNo, { signal } = {}) {
    if (!config.surepass.token) throw new RcProviderError('config', 'SUREPASS_TOKEN not set', 'surepass');
    let res;
    try {
      res = await fetch(`${config.surepass.baseUrl}/api/v1/rc/rc-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.surepass.token}` },
        body: JSON.stringify({ id_number: regNo }),
        signal,
      });
    } catch (e) {
      throw new RcProviderError(e.name === 'AbortError' ? 'timeout' : 'upstream', e.message, 'surepass');
    }
    const raw = await res.json().catch(() => null);
    if (res.status === 422 || res.status === 404) throw new RcProviderError('not_found', raw?.message || 'not found', 'surepass');
    if (!res.ok || !raw?.success || !raw?.data) {
      throw new RcProviderError('upstream', raw?.message || `HTTP ${res.status}`, 'surepass');
    }
    return { raw, normalized: fromSurepass(raw.data) };
  },
};
