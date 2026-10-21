import { RcProviderError } from '../errors.js';
import { fromSurepass } from '../normalize.js';
import { SAMPLES, generateSample } from './mockSamples.js';

// Mock provider that mimics Surepass rc-full responses. Special reg nos for testing:
//   MH01ZZ0001 -> not found, MH01ZZ0002 -> timeout, MH01ZZ0003 -> upstream 500.
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

    const data = SAMPLES[regNo] ? SAMPLES[regNo]() : generateSample(regNo);
    const raw = { data, status_code: 200, success: true, message: null, message_code: 'success' };
    return { raw, normalized: fromSurepass(data) };
  },
};
