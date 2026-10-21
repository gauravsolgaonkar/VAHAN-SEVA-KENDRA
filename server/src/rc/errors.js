export class RcProviderError extends Error {
  /**
   * @param {'not_found'|'timeout'|'upstream'|'config'|'invalid'} code
   *   not_found and invalid are authoritative answers and do not trigger fallback.
   */
  constructor(code, message, provider) {
    super(message || code);
    this.code = code;
    this.provider = provider;
  }

  get retryable() {
    return !['not_found', 'invalid'].includes(this.code);
  }
}
