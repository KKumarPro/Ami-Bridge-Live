"use strict";

const multer = require("multer");

const memoryStorage = multer.memoryStorage();

// ── Resume upload (PDF / Word, max 5 MB) ────────────────────────────────────
const resumeUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only PDF and Word documents are allowed"), false);
  },
});

// ── CSV upload (max 2 MB) ────────────────────────────────────────────────────
const csvUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv"))
      return cb(null, true);
    cb(new Error("Only CSV files are allowed"), false);
  },
});

module.exports = { resumeUpload, csvUpload };
