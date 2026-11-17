/**
 * Admin Authentication & Session Middleware
 * 
 * Protects administrative routes and database analytical endpoints.
 * Validates admin sessions via HTTP cookies or Bearer Authorization headers.
 */

const crypto = require('crypto');
require('dotenv').config();

const activeSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Extract cookie by name from request headers
 */
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extract auth token from Authorization header or Cookie
 */
function extractToken(req) {
  // 1. Check Bearer Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check custom x-admin-token header
  if (req.headers['x-admin-token']) {
    return req.headers['x-admin-token'].trim();
  }

  // 3. Check admin_token Cookie
  return getCookie(req, 'admin_token');
}

/**
 * Create a new admin session token
 */
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

/**
 * Validate an active session token
 */
function validateSession(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

/**
 * Destroy an admin session (Logout)
 */
function destroySession(token) {
  if (token) {
    activeSessions.delete(token);
  }
}

/**
 * Middleware: Enforces Admin Authentication on routes
 */
function requireAdminAuth(req, res, next) {
  const token = extractToken(req);
  const session = validateSession(token);

  if (session) {
    req.adminUser = session;
    return next();
  }

  // All /api/ requests should return 401 Unauthorized JSON
  const isApiRequest = req.originalUrl && req.originalUrl.startsWith('/api/');
  if (isApiRequest) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Administrative authentication is required to access this resource.'
    });
  }

  // For browser page navigation (/admin, /reports, .html), redirect to admin login
  return res.redirect('/admin-login.html?error=unauthorized');
}

module.exports = {
  createSession,
  validateSession,
  destroySession,
  requireAdminAuth,
  extractToken
};
