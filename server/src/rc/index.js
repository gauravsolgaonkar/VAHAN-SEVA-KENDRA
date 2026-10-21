import { config } from '../config.js';
import ConsentLog from '../models/ConsentLog.js';
import RcCallLog from '../models/RcCallLog.js';
import RcRecord from '../models/RcRecord.js';
import { RcProviderError } from './errors.js';
import cashfree from './providers/cashfree.js';
import mock from './providers/mock.js';
import surepass from './providers/surepass.js';

/**
 * Every provider implements:
 *   name: string
 *   costPerCall: number          (our cost, for billing reports)
 *   isConfigured(): boolean
 *   fetchRc(regNo, { signal }): Promise<{ raw, normalized }>   throws RcProviderError
 */
export const PROVIDERS = { mock, surepass, cashfree };

export function activeProviders(names = config.rcProviders) {
  return names.map((n) => PROVIDERS[n]).filter((p) => p && p.isConfigured());
}

async function callWithTimeout(provider, regNo, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await provider.fetchRc(regNo, { signal: ctrl.signal });
  } catch (e) {
    if (e instanceof RcProviderError) throw e;
    throw new RcProviderError(ctrl.signal.aborted ? 'timeout' : 'upstream', e.message, provider.name);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tries providers in order, falling back on timeout/upstream errors.
 * `onAttempt` is called for every attempt so each one is logged.
 */
export async function fetchWithFallback(regNo, { providers = activeProviders(), timeoutMs = config.rcTimeoutMs, onAttempt } = {}) {
  if (!providers.length) throw new RcProviderError('config', 'No RC provider configured');
  let lastErr;
  for (const provider of providers) {
    const started = Date.now();
    try {
      const result = await callWithTimeout(provider, regNo, timeoutMs);
      await onAttempt?.({ provider, success: true, durationMs: Date.now() - started });
      return { ...result, provider: provider.name };
    } catch (err) {
      await onAttempt?.({ provider, success: false, durationMs: Date.now() - started, error: err });
      lastErr = err;
      if (!err.retryable) break;
    }
  }
  throw lastErr;
}

export const CONSENT_TEXT = 'Customer has consented to vehicle detail verification';

/**
 * Full RC lookup for a tenant: consent log -> 30-day cache -> provider chain -> call log -> cache write.
 * Returns { record, cached }.
 */
export async function lookupRc({ tenantId, user, regNo, refresh = false, ip, userAgent }) {
  const consent = await ConsentLog.create({ tenantId, userId: user._id, regNo, text: CONSENT_TEXT, ip, userAgent });

  const existing = await RcRecord.findOne({ tenantId, regNo });
  const fresh = existing && Date.now() - existing.fetchedAt.getTime() < config.rcCacheDays * 86400000;
  if (fresh && !refresh) {
    await RcCallLog.create({ tenantId, userId: user._id, regNo, provider: existing.provider, cached: true, success: true, cost: 0, durationMs: 0, consentLogId: consent._id, ip });
    return { record: existing, cached: true };
  }

  const result = await fetchWithFallback(regNo, {
    onAttempt: ({ provider, success, durationMs, error }) =>
      RcCallLog.create({
        tenantId, userId: user._id, regNo, provider: provider.name, cached: false, success,
        cost: success ? provider.costPerCall : 0, durationMs, error: error ? `${error.code}: ${error.message}` : undefined,
        consentLogId: consent._id, ip,
      }),
  });

  const record = await RcRecord.findOneAndUpdate(
    { tenantId, regNo },
    { $set: { provider: result.provider, raw: result.raw, normalized: result.normalized, fetchedAt: new Date(), fetchedBy: user._id } },
    { upsert: true, returnDocument: 'after' },
  );
  return { record, cached: false };
}
