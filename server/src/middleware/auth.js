import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import User from '../models/User.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), tid: String(user.tenantId), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Verifies the JWT and loads the user fresh so role/permission changes apply immediately. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || !user.active || String(user.tenantId) !== payload.tid) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'forbidden' });

/** Read-only users may only GET. */
export function blockReadOnlyWrites(req, res, next) {
  if (req.user?.role === 'readonly' && req.method !== 'GET') {
    return res.status(403).json({ error: 'read_only' });
  }
  next();
}

/**
 * Base filter for every tenant-owned query. Always includes tenantId; staff without
 * "view all" are further limited to records assigned to them.
 */
export function scope(req) {
  const filter = { tenantId: req.tenantId };
  if (req.user.role === 'staff' && !req.user.canViewAll) filter.agentId = req.user._id;
  return filter;
}

export function isObjectId(id) {
  return mongoose.isValidObjectId(id);
}
