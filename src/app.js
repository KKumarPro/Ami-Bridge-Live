"use strict";

const express      = require("express");
const cors         = require("cors");
const path         = require("path");

// Routes
const authRoutes      = require("./routes/auth.routes");
const resumeRoutes    = require("./routes/resume.routes");
const companyRoutes   = require("./routes/company.routes");
const interviewRoutes = require("./routes/interview.routes");

// Middlewares
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

// ── Core middleware ────────────────────────────────────────────────────────────
// In production restrict CORS to your actual domain.
// For local dev and Vercel previews we allow all origins.
const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    const allowed = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
      : ["http://localhost:5000", "http://127.0.0.1:5000"];
    // In development or if no restriction set, allow all
    if (process.env.NODE_ENV !== "production" || !process.env.ALLOWED_ORIGINS) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: origin not allowed — " + origin));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Static files (frontend) ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public")));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",  authRoutes);
app.use("/api",       resumeRoutes);
app.use("/api",       companyRoutes);
app.use("/api",       interviewRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;