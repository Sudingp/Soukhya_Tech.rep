/**
 * middleware/auth.js
 * JWT Authentication, Role Verification (RBAC), and Token Blacklist Middleware
 */

const jwt = require('jsonwebtoken');
const { stmts } = require('../database/db');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'soukhya_enterprise_jwt_access_secret_2026';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
      request_id: req.id
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    if (decoded.jti) {
      const isBlacklisted = await stmts.isTokenBlacklisted.get(decoded.jti);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Token has been revoked/blacklisted' },
          request_id: req.id
        });
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return res.status(401).json({
      success: false,
      error: { code, message: err.message },
      request_id: req.id
    });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        request_id: req.id
      });
    }
    const userRole = (req.user.role || '').toUpperCase();
    const allowed = roles.map(r => r.toUpperCase());
    if (!allowed.includes(userRole) && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Insufficient permissions. Required role: ${roles.join(' or ')}` },
        request_id: req.id
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRoles,
  JWT_ACCESS_SECRET
};
