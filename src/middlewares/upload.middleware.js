"use strict";

const multer = require("multer");

const memoryStorage = multer.memoryStorage();

// ── Resume upload (PDF only, max 5 MB) ──────────────────────────────────────
const resumeUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept PDF only — Word docs cannot be reliably parsed for AI text extraction
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    if (isPdf) return cb(null, true);
    cb(
      new Error(
        "Only PDF files are accepted. Please convert your document to PDF and try again.",
      ),
      false,
    );
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
