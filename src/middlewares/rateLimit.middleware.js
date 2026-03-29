"use strict";

const hits = new Map();

/**
 * Simple in-memory rate limiter.
 * For production use express-rate-limit + Redis instead.
 *
 * @param {number} maxRequests  - max calls per window
 * @param {number} windowMs     - window in milliseconds
 */
const rateLimit = (maxRequests = 30, windowMs = 60_000) => (req, res, next) => {
  const key  = req.ip + req.path;
  const now  = Date.now();
  const data = hits.get(key) || { count: 0, start: now };

  if (now - data.start > windowMs) {
    data.count = 0;
    data.start = now;
  }

  data.count += 1;
  hits.set(key, data);

  if (data.count > maxRequests) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  next();
};

module.exports = { rateLimit };
