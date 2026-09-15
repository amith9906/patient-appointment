const jwt = require('jsonwebtoken');
const { User } = require('../models');

const userAuthCache = new Map();
const USER_CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.isPatientPortal || decoded.role === 'patient') {
      return res.status(403).json({ message: 'Access denied: Patient portal tokens cannot access staff routes' });
    }

    const cached = userAuthCache.get(decoded.id);
    let user;
    if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL_MS) {
      user = cached.user;
    } else {
      user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
      if (user && user.isActive) {
        userAuthCache.set(decoded.id, { user, timestamp: Date.now() });
      }
    }

    if (!user || !user.isActive) return res.status(401).json({ message: 'Unauthorized' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (req.user?.isPatientPortal || req.user?.role === 'patient') {
    return res.status(403).json({ message: 'Access denied: Patient portal tokens cannot access staff routes' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

module.exports = { authenticate, authorize };
