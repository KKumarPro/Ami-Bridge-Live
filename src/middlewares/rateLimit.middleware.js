"use strict";

/**
 * Sliding-window rate limiter using a Map keyed by userId (from JWT) or IP.
 * Resets per window — not cumulative. Works on serverless because Vercel
 * keeps the function warm between requests in the same deployment instance.
 *
 * For a fully stateless/multi-instance deployment, swap the Map for Redis.
 */
const windows = new Map();

// Prune stale entries every 10 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of windows.entries()) {
    if (now - data.start > data.windowMs * 2) windows.delete(key);
  }
}, 10 * 60 * 1000);

/**
 * @param {number} maxRequests  - allowed calls per window
 * @param {number} windowMs     - window length in ms
 */
const rateLimit = (maxRequests = 30, windowMs = 60_000) => (req, res, next) => {
  // Key by authenticated userId if available, otherwise IP
  const id  = req.user?.id || req.ip;
  const key = `${id}::${req.path}`;
  const now = Date.now();

  let data = windows.get(key);
  if (!data || now - data.start > windowMs) {
    data = { count: 0, start: now, windowMs };
  }

  data.count += 1;
  windows.set(key, data);

  // Set standard rate-limit headers
  res.setHeader("X-RateLimit-Limit",     maxRequests);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - data.count));
  res.setHeader("X-RateLimit-Reset",     Math.ceil((data.start + windowMs) / 1000));

  if (data.count > maxRequests) {
    const retryAfter = Math.ceil((data.start + windowMs - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({
      error: `Too many requests. Please wait ${retryAfter}s before trying again.`,
    });
  }

  next();
};

module.exports = { rateLimit };