import { RcProviderError } from '../errors.js';
import { fromSurepass } from '../normalize.js';
import { SAMPLES, generateSample } from './mockSamples.js';

// Mock provider that mimics Surepass rc-full responses. Special reg nos for testing:
//   MH01ZZ0001 -> not found, MH01ZZ0002 -> timeout, MH01ZZ0003 -> upstream 500.
// Renewal-check demos: MH20RE#### insurance expires in 4 days, and from the 2nd fetch on shows a new
// policy with another insurer (renewed elsewhere). MH20RU#### does the same with policy no. VSK-RENEW-<last 4>
// (record that number when renewing through the pipeline and the check marks it renewed).
const fetchCount = new Map();

function renewalDemo(regNo, data) {
  const m = regNo.match(/^MH20R([EU])(\d{4})$/);
  if (!m) return data;
  const n = (fetchCount.get(regNo) || 0) + 1;
  fetchCount.set(regNo, n);
  const day = (k) => new Date(Date.now() + k * 86400000).toISOString().slice(0, 10);
  if (n === 1) return { ...data, insurance_upto: day(4), insurance_company: 'Tata AIG General Insurance Co. Ltd.', insurance_policy_number: `OLD-${m[2]}` };
  return m[1] === 'E'
    ? { ...data, insurance_upto: day(369), insurance_company: 'Go Digit General Insurance Ltd.', insurance_policy_number: `D${m[2]}99887766` }
    : { ...data, insurance_upto: day(369), insurance_company: 'Tata AIG General Insurance Co. Ltd.', insurance_policy_number: `VSK-RENEW-${m[2]}` };
}

export default {
  name: 'mock',
  costPerCall: 0,
  isConfigured: () => true,
  async fetchRc(regNo, { signal } = {}) {
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, 600 + Math.random() * 600);
      signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new RcProviderError('timeout', 'mock timeout', 'mock'));
      });
    });
    if (regNo === 'MH01ZZ0001') throw new RcProviderError('not_found', 'Vehicle not found in VAHAN', 'mock');
    if (regNo === 'MH01ZZ0002') {
      await new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new RcProviderError('timeout', 'mock timeout', 'mock'))));
    }
    if (regNo === 'MH01ZZ0003') throw new RcProviderError('upstream', 'Provider returned 500', 'mock');

    const data = renewalDemo(regNo, SAMPLES[regNo] ? SAMPLES[regNo]() : generateSample(regNo));
    const raw = { data, status_code: 200, success: true, message: null, message_code: 'success' };
    return { raw, normalized: fromSurepass(data) };
  },
};
