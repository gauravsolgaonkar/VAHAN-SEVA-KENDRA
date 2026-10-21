import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { isObjectId, requireRole } from '../middleware/auth.js';
import { asyncH, HttpError } from '../middleware/errors.js';
import User from '../models/User.js';

// Team management (owner only).
const r = Router();
r.use(requireRole('owner'));

r.get('/', asyncH(async (req, res) => {
  const users = await User.find({ tenantId: req.tenantId }).sort({ createdAt: 1 });
  res.json(users.map((u) => u.toPublic()));
}));

r.post('/', asyncH(async (req, res) => {
  const { name, mobile, password, role = 'staff', canViewAll = false, language = 'mr' } = req.body;
  const m = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (!name || m.length !== 10 || !password || password.length < 6) throw new HttpError(400, 'validation');
  if (!['staff', 'readonly', 'owner'].includes(role)) throw new HttpError(400, 'validation', 'role');
  if (await User.exists({ mobile: m })) throw new HttpError(409, 'mobile_taken');
  const user = await User.create({ tenantId: req.tenantId, name, mobile: m, role, canViewAll, language, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json(user.toPublic());
}));

r.patch('/:id', asyncH(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'not_found');
  const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!user) throw new HttpError(404, 'not_found');
  const { name, role, canViewAll, active, password } = req.body;
  if (String(user._id) === String(req.user._id) && (role && role !== 'owner' || active === false)) {
    throw new HttpError(400, 'cannot_demote_self');
  }
  if (name) user.name = name;
  if (role && ['staff', 'readonly', 'owner'].includes(role)) user.role = role;
  if (typeof canViewAll === 'boolean') user.canViewAll = canViewAll;
  if (typeof active === 'boolean') user.active = active;
  if (password) {
    if (password.length < 6) throw new HttpError(400, 'validation');
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  await user.save();
  res.json(user.toPublic());
}));

export default r;
