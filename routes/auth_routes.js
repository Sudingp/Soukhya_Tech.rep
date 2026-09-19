/**
 * routes/auth_routes.js
 * Authentication REST Endpoints (Login, Refresh, Logout, Me)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Joi = require('joi');
const { stmts } = require('../database/db');
const { authenticate, JWT_ACCESS_SECRET } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit_logger');

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'soukhya_enterprise_jwt_refresh_secret_2026';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.details[0].message }, request_id: req.id });
    }

    const user = await stmts.getUserByUsername.get(value.username);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }, request_id: req.id });
    }

    let isValid = false;
    if (user.password_hash.startsWith('$2')) {
      isValid = await bcrypt.compare(value.password, user.password_hash);
    } else {
      isValid = (user.password_hash === value.password);
    }

    if (!isValid) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }, request_id: req.id });
    }

    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, emp_id: user.emp_id, jti: accessJti },
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, jti: refreshJti },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRY }
    );

    await auditLog({ table: 'users', recordId: user.id, action: 'LOGIN', req });

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900,
        token_type: 'Bearer',
        user: { id: user.id, username: user.username, role: user.role, emp_id: user.emp_id }
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing refresh_token' }, request_id: req.id });
    }

    const decoded = jwt.verify(refresh_token, JWT_REFRESH_SECRET);
    if (decoded.jti) {
      const isBlacklisted = await stmts.isTokenBlacklisted.get(decoded.jti);
      if (isBlacklisted) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Refresh token has been revoked' }, request_id: req.id });
      }
    }

    const user = await stmts.getUserById.get(decoded.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' }, request_id: req.id });
    }

    const newAccessJti = crypto.randomUUID();
    const newAccessToken = jwt.sign(
      { sub: user.id, username: user.username, role: user.role, emp_id: user.emp_id, jti: newAccessJti },
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRY }
    );

    res.json({
      success: true,
      data: { access_token: newAccessToken, expires_in: 900, token_type: 'Bearer' },
      access_token: newAccessToken
    });
  } catch (err) {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: err.message }, request_id: req.id });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    if (req.user?.jti) {
      const expDate = req.user.exp ? new Date(req.user.exp * 1000) : new Date(Date.now() + 24 * 3600 * 1000);
      await stmts.blacklistToken.run(req.user.jti, expDate);
    }
    await auditLog({ table: 'users', recordId: req.user?.sub, action: 'LOGOUT', req });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await stmts.getUserById.get(req.user.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User profile not found' }, request_id: req.id });
    }
    res.json({ success: true, data: user, role: user.role });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, request_id: req.id });
  }
});

module.exports = router;
