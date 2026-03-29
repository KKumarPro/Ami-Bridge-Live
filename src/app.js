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
app.use(cors());
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
