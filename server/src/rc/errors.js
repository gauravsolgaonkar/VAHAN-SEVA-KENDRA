export class RcProviderError extends Error {
  /**
   * @param {'not_found'|'timeout'|'upstream'|'config'|'invalid'|'no_credits'} code
   *   not_found and invalid are authoritative answers and do not trigger fallback.
   */
  constructor(code, message, provider) {
    super(message || code);
    this.code = code;
    this.provider = provider;
  }

  get retryable() {
    return !['not_found', 'invalid', 'no_credits'].includes(this.code);
  }
}

const STATUS = { not_found: 404, config: 503, no_credits: 402 };

/** HTTP status for an RcProviderError surfaced by a route. */
export const rcErrorStatus = (e) => STATUS[e.code] || 502;
