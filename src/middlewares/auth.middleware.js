"use strict";

const jwt      = require("jsonwebtoken");
const env      = require("../config/env");
const { forbidden, unauthorized } = require("../utils/response");

/**
 * Verify the Bearer JWT sent in Authorization header.
 * Attaches decoded payload to req.user = { id, name, email, role }.
 */
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return unauthorized(res, "Authentication token required");
  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    next();
  } catch {
    return unauthorized(res, "Invalid or expired token");
  }
};

/**
 * Middleware factory — check req.user.role against allowed roles.
 * Must be used AFTER authenticate().
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res, "Not authenticated");
  if (!roles.includes(req.user.role))
    return forbidden(res, `Access restricted to: ${roles.join(", ")}`);
  next();
};

module.exports = { authenticate, requireRole };