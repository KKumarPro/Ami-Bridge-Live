"use strict";

const logger = require("../utils/logger");

// Global error handler — must have 4 params so Express recognises it
// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, next) => {
  logger.error(`[${req.method}] ${req.path} —`, err.message);

  // Multer file filter errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large." });
  }
  if (err.message && err.message.includes("Only")) {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
};

module.exports = errorMiddleware;
