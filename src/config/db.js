"use strict";

const { Pool } = require("pg");
const env      = require("./env");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl:              { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  max: 10,
});

pool.on("error", (err) => {
  console.error("[DB] Idle client error (non-fatal):", err.message);
});

/**
 * Run startup health-check + schema migrations.
 * Called once from app.js.
 */
const initDB = async () => {
  // 1. Ping
  try {
    await pool.query("SELECT NOW()");
    console.log("[DB] Connected to PostgreSQL (Neon DB)");
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
  }

  // 2. Migrations — add columns introduced after initial schema
  try {
    await pool.query(`
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_name  VARCHAR(255);
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_data    TEXT;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_type    VARCHAR(100);
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gemini_feedback TEXT;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gemini_score    INTEGER;
    `);
    console.log("[DB] Migrations applied");
  } catch (err) {
    // Non-fatal — columns may already exist
    console.log("[DB] Migration info (non-fatal):", err.message);
  }
};

module.exports = { pool, initDB };
