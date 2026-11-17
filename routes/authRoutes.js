/**
 * Admin Authentication Routes
 */

const express = require('express');
const router = express.Router();
const { createSession, destroySession, validateSession, extractToken } = require('../middleware/auth');
require('dotenv').config();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * POST /api/auth/login
 * Authenticate administrator with credentials from environment variables
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Both username and password are required.'
    });
  }

  // Secure comparison against environment variables
  if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = createSession(username.trim());

    // Set secure HTTP cookie
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);

    return res.status(200).json({
      success: true,
      message: 'Authentication successful. Access granted to Admin & Database Analytics.',
      token,
      user: { username: username.trim() }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid administrator credentials. Access denied.'
  });
});

/**
 * POST /api/auth/logout
 * Invalidate active admin session
 */
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  destroySession(token);

  // Clear cookie
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Max-Age=0');

  return res.status(200).json({
    success: true,
    message: 'Administrator session terminated.'
  });
});

/**
 * GET /api/auth/verify
 * Check whether the current client holds an active admin session
 */
router.get('/verify', (req, res) => {
  const token = extractToken(req);
  const session = validateSession(token);

  if (session) {
    return res.status(200).json({
      success: true,
      authenticated: true,
      username: session.username
    });
  }

  return res.status(200).json({
    success: true,
    authenticated: false
  });
});

module.exports = router;
