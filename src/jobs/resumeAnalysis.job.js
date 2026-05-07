"use strict";

const { pool }        = require("../config/db");
const { analyzeResume } = require("../services/ai.service");
const { extractTextFromPDF } = require("../utils/parser");
const logger          = require("../utils/logger");

let isRunning = false;

/**
 * Background job: finds resumes without AI feedback and analyzes them.
 * Run on a timer or trigger manually. Skips if already running.
 */
const runResumeAnalysisJob = async () => {
  if (isRunning) {
    logger.info("[Job] Resume analysis already running, skipping.");
    return;
  }
  isRunning = true;

  try {
    const result = await pool.query(
      `SELECT r.resume_id, r.file_data, r.target_role, u.name AS student_name
       FROM resumes r
       JOIN users u ON r.student_id = u.id
       WHERE r.gemini_feedback IS NULL AND r.file_data IS NOT NULL
       LIMIT 5`
    );

    if (result.rows.length === 0) {
      logger.info("[Job] No unanalyzed resumes found.");
      return;
    }

    logger.info("[Job] Analyzing " + result.rows.length + " resume(s) in background...");

    for (const resume of result.rows) {
      try {
        const buffer     = Buffer.from(resume.file_data, "base64");
        const resumeText = await extractTextFromPDF(buffer);
        const analysis   = await analyzeResume(
          resumeText,
          resume.student_name,
          resume.file_data,
          resume.target_role,
        );

        const analysisWithRole = {
          ...analysis,
          target_role: resume.target_role || "Web Developer",
        };

        await pool.query(
          "UPDATE resumes SET gemini_feedback = $1, gemini_score = $2 WHERE resume_id = $3",
          [JSON.stringify(analysisWithRole), analysis.score, resume.resume_id]
        );
        logger.info("[Job] Analyzed resume_id=" + resume.resume_id + " score=" + analysis.score);
      } catch (err) {
        logger.error("[Job] Failed to analyze resume_id=" + resume.resume_id + ":", err.message);
      }
    }
  } catch (err) {
    logger.error("[Job] Job crashed:", err.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the job on a recurring interval.
 * @param {number} intervalMs - default every 5 minutes
 */
const startResumeAnalysisJob = (intervalMs = 5 * 60 * 1000) => {
  logger.info("[Job] Resume analysis job started — interval: " + (intervalMs / 60000) + " min");
  // Run once at startup after a short delay
  setTimeout(runResumeAnalysisJob, 10_000);
  // Then repeat on schedule
  setInterval(runResumeAnalysisJob, intervalMs);
};

module.exports = { startResumeAnalysisJob, runResumeAnalysisJob };
