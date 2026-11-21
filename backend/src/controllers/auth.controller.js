const asyncHandler = require('../middlewares/asyncHandler');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/user.model');
const { sessionToken } = require('../middlewares/auth');
const { config } = require('../config/env');
const { assert } = require('../utils/errors');

function identity(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    centreId: user.centreId,
    districtId: user.districtId,
  };
}
exports.login = asyncHandler(async (req, res) => {
  // Validate the request before looking up the account.
  const loginSchema = z
    .object({
      email: z.email().toLowerCase(),
      password: z.string().min(1).max(200),
    })
    .strict();
  const { email, password } = loginSchema.parse(req.body);

  // Password hashes are excluded from normal queries, so request this field explicitly.
  const user = await User.findOne({ email, active: true }).select('+passwordHash');
  assert(user, 401, 'Invalid email or password');

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  assert(passwordMatches, 401, 'Invalid email or password');

  const token = sessionToken(String(user._id));
  res.json({ token, user: identity(user) });
});

exports.listDemoUsers = asyncHandler(async (_req, res) => {
  assert(config.demo, 404, 'Not found');
  res.json({ users: (await User.find({ active: true })).map(identity) });
});

exports.demoLogin = asyncHandler(async (req, res) => {
  assert(config.demo, 404, 'Not found');
  const { email } = z.object({ email: z.email().toLowerCase() }).strict().parse(req.body);
  const user = await User.findOne({ email, active: true });
  assert(user, 404, 'Demo user not found');
  res.json({ token: sessionToken(String(user._id)), user: identity(user) });
});

exports.getCurrentUser = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
