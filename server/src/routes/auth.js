import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const cleanMobile = (m) => String(m || '').replace(/\D/g, '').slice(-10);

// Sign up a new business: creates the tenant and its owner.
r.post('/register', limiter, asyncH(async (req, res) => {
  const { businessName, name, mobile, password, city, language = 'mr', mode = 'agent' } = req.body;
  const m = cleanMobile(mobile);
  if (!businessName || !name || m.length !== 10 || !password || password.length < 6) {
    throw new HttpError(400, 'validation', 'businessName, name, 10-digit mobile and 6+ char password are required');
  }
  if (await User.exists({ mobile: m })) throw new HttpError(409, 'mobile_taken');
  const tenant = await Tenant.create({
    name: businessName, phone: m, city, mode, trialEndsAt: new Date(Date.now() + 15 * 86400000),
    settings: { defaultLanguage: language },
  });
  const user = await User.create({
    tenantId: tenant._id, name, mobile: m, passwordHash: await bcrypt.hash(password, 10), role: 'owner', canViewAll: true, language,
  });
  res.status(201).json({ token: signToken(user), user: user.toPublic(), tenant });
}));

r.post('/login', limiter, asyncH(async (req, res) => {
  const m = cleanMobile(req.body.mobile);
  const user = await User.findOne({ mobile: m }).select('+passwordHash');
  if (!user || !user.active || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    throw new HttpError(401, 'invalid_credentials');
  }
  const tenant = await Tenant.findById(user.tenantId);
  res.json({ token: signToken(user), user: user.toPublic(), tenant });
}));

r.get('/me', requireAuth, asyncH(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  res.json({ user: req.user.toPublic(), tenant });
}));

r.patch('/me', requireAuth, asyncH(async (req, res) => {
  const { name, language, email } = req.body;
  if (name) req.user.name = name;
  if (['mr', 'hi', 'en'].includes(language)) req.user.language = language;
  if (email !== undefined) req.user.email = email;
  await req.user.save();
  res.json({ user: req.user.toPublic() });
}));

export default r;
