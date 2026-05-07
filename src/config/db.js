"use strict";

const { Pool } = require("pg");
const env = require("./env");

function getConnectionString() {
  try {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch (_) {
    return env.DATABASE_URL;
  }
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
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

  // 2. Migrations — add columns and tables introduced after initial schema
  try {
    await pool.query(`
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS resume_name  VARCHAR(255);
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_data    TEXT;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_type    VARCHAR(100);
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gemini_feedback TEXT;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gemini_score    INTEGER;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS target_role     VARCHAR(120);

      CREATE TABLE IF NOT EXISTS user_streaks (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_streak INT DEFAULT 0,
        longest_streak INT DEFAULT 0,
        last_login_date TIMESTAMPTZ DEFAULT NOW(),
        streak_reset_date TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS badge_types (
        badge_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(20),
        criteria VARCHAR(255),
        earned_count INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        badge_id INT REFERENCES badge_types(badge_id) ON DELETE CASCADE,
        earned_date TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, badge_id)
      );
    `);
    console.log("[DB] Migrations applied");
  } catch (err) {
    // Non-fatal — columns may already exist
    console.log("[DB] Migration info (non-fatal):", err.message);
  }

  // 3. Seed badge types
  try {
    await pool.query(`
      INSERT INTO badge_types (name, description, icon, color, criteria)
      VALUES
        ('Profile Starter', 'Viewed your first profile', 'user', 'blue', 'first_view'),
        ('Profile Complete', '50% profile complete', 'check-circle', 'green', 'profile_50'),
        ('Resume Uploaded', 'Uploaded first resume', 'file', 'purple', 'resume_1'),
        ('Resume Score 50+', 'Achieved resume score >= 50', 'star', 'amber', 'resume_50'),
        ('Resume Score 75+', 'Achieved resume score >= 75', 'star-fill', 'yellow', 'resume_75'),
        ('Resume Score 90+', 'Achieved resume score >= 90', 'award', 'gold', 'resume_90'),
        ('Quiz Starter', 'Completed first quiz', 'play-circle', 'blue', 'quiz_1'),
        ('5 Quizzes Done', 'Completed 5 quizzes', 'list-check', 'cyan', 'quiz_5'),
        ('10 Quizzes Done', 'Completed 10 quizzes', 'trophy', 'lime', 'quiz_10'),
        ('7-Day Streak', 'Maintained 7-day streak', 'flame', 'red', 'streak_7'),
        ('30-Day Streak', 'Maintained 30-day streak', 'lightning-fill', 'orange', 'streak_30'),
        ('Interview Ready', 'Assigned to mentor', 'handshake', 'indigo', 'mentor_assigned')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log("[DB] Badge types seeded");
  } catch (err) {
    console.log("[DB] Badge seeding info (non-fatal):", err.message);
  }
};

module.exports = { pool, initDB };
