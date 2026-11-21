const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { User } = require('../models');
const { ApiError } = require('../utils/errors');
async function authenticate(req, _res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, 'Bearer token required');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      audience: 'certiflow-api',
      issuer: 'certiflow',
    });
  } catch {
    throw new ApiError(401, 'Invalid or expired session');
  }
  const user = await User.findOne({
    _id: payload.sub,
    active: true,
  });
  if (!user) throw new ApiError(401, 'Account unavailable');
  req.user = {
    id: String(user._id),
    name: user.name,
    role: user.role,
    centreId: user.centreId?.toString(),
    districtId: user.districtId,
  };
  next();
}
const roles =
  (...allowed) =>
  (req, _res, next) => {
    if (!allowed.includes(req.user.role))
      throw new ApiError(403, 'Your role cannot perform this action');
    next();
  };
function sessionToken(id) {
  return jwt.sign({}, config.jwtSecret, {
    subject: id,
    expiresIn: '8h',
    audience: 'certiflow-api',
    issuer: 'certiflow',
  });
}

module.exports = { authenticate, roles, sessionToken };
