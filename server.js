"use strict";

// Load & validate env first — throws if DATABASE_URL is missing
require("./src/config/env");

const app               = require("./src/app");
const { initDB }        = require("./src/config/db");
const { startResumeAnalysisJob } = require("./src/jobs/resumeAnalysis.job");
const env               = require("./src/config/env");
const logger            = require("./src/utils/logger");

const start = async () => {
  // 1. Connect DB + run migrations
  await initDB();

  // 2. Start background job (auto-analyses pending resumes every 5 min)
  if (env.NODE_ENV !== "test") {
    startResumeAnalysisJob(5 * 60 * 1000);
  }

  // 3. Listen
  if (env.NODE_ENV !== "production") {
    app.listen(env.PORT, () => {
      logger.info("Server running  →  http://localhost:" + env.PORT);
      logger.info("Gemini AI       →  " + (env.GEMINI_API_KEY ? "Configured ✓" : "NOT configured ✗"));
    });
  }
};

start().catch((err) => {
  console.error("Fatal startup error:", err.message);
  process.exit(1);
});

// Required for Vercel serverless
module.exports = app;
