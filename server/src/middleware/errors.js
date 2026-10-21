export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, code, details) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, details: err.details });
  if (err?.name === 'ValidationError') return res.status(400).json({ error: 'validation', details: err.message });
  if (err?.code === 11000) return res.status(409).json({ error: 'duplicate', details: err.keyValue });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
}
