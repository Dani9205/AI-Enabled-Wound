const User = require('../models/userModel');
const { verifyToken } = require('../utils/security');

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  return scheme && scheme.toLowerCase() === 'bearer' ? token : null;
};

const authenticateToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const user = await User.findByPk(payload.id);

    if (!user || user.account_status === 'deleted') {
      return res.status(401).json({ message: 'User not authorized' });
    }

    req.auth = payload;
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'Authentication failed',
      error: error.message,
    });
  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return next();
};

const adminAuthMiddleware = [
  authenticateToken,
  requireRoles('admin', 'super_admin'),
];

module.exports = {
  adminAuthMiddleware,
  authenticateToken,
  requireRoles,
};
