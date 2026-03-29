"use strict";

const { forbidden } = require("../utils/response");

/**
 * Middleware factory — checks req.body.requester_role against allowed roles.
 * For a real JWT setup, decode the token here instead.
 *
 * @param {...string} roles - allowed roles e.g. "admin", "mentor"
 */
const requireRole = (...roles) => (req, res, next) => {
  const role = req.body.requester_role || req.query.requester_role;
  if (!roles.includes(role)) {
    return forbidden(res, `Access restricted to: ${roles.join(", ")}`);
  }
  next();
};

module.exports = { requireRole };
