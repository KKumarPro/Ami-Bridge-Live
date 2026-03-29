"use strict";

const { getModel } = require("../config/ai");
const env    = require("../config/env");
const logger = require("../utils/logger");

const MODELS_TO_TRY = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

const RESUME_PROMPT = (studentName) =>
  "You are an expert career coach and ATS specialist reviewing resumes for engineering/tech placement students in India.\n" +
  "Analyze the resume for " + (studentName || "Student") + " and give detailed, specific, actionable feedback.\n" +
  "Respond ONLY with a raw JSON object — no markdown, no code fences, no explanation.\n" +
  'Use exactly this structure: {"score":0,"summary":"","strengths":["","",""],"improvements":["","",""],"keywords_missing":["","",""],"ats_score":0,"sections_feedback":{"contact":"","education":"","skills":"","experience":"","projects":""}}\n' +
  "Fill every field with real feedback. score and ats_score are integers 0-100.";

function cleanJSON(raw) {
  return raw.trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();
}

/**
 * Analyse a resume using Gemini AI.
 * Tries Vision API first (works on ALL PDF types including scanned).
 * Falls back to text-only, then generic helpful feedback.
 *
 * @param {string} resumeText  - extracted text (may be empty for scanned PDFs)
 * @param {string} studentName
 * @param {string} pdfBase64   - raw PDF as base64 string
 * @returns {Promise<object>}  - analysis result
 */
const analyzeResume = async (resumeText, studentName, pdfBase64) => {
  if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === "your_gemini_api_key_here") {
    return noKeyResponse();
  }

  const prompt = RESUME_PROMPT(studentName);

  // ── METHOD 1: Vision API — send PDF bytes directly ───────────────────────
  if (pdfBase64) {
    for (const modelName of MODELS_TO_TRY) {
      try {
        const sizeMB = (pdfBase64.length * 0.75 / 1_048_576).toFixed(2);
        logger.info("[AI] Vision attempt with " + modelName + " (" + sizeMB + " MB) for: " + studentName);
        const model  = getModel(modelName, { temperature: 0.1 });
        const result = await model.generateContent([
          prompt,
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        ]);
        const parsed = JSON.parse(cleanJSON(result.response.text()));
        logger.info("[AI] Vision SUCCESS (" + modelName + ") — score: " + parsed.score);
        return parsed;
      } catch (err) {
        logger.warn("[AI] Vision failed with " + modelName + ":", err.message);
      }
    }
  }

  // ── METHOD 2: Text-only fallback ─────────────────────────────────────────
  if (resumeText && resumeText.trim().length > 80) {
    for (const modelName of MODELS_TO_TRY) {
      try {
        logger.info("[AI] Text attempt with " + modelName + ", chars: " + resumeText.length);
        const model  = getModel(modelName, { temperature: 0.1 });
        const result = await model.generateContent(
          prompt + "\n\nRESUME TEXT:\n" + resumeText.substring(0, 10_000)
        );
        const parsed = JSON.parse(cleanJSON(result.response.text()));
        logger.info("[AI] Text SUCCESS (" + modelName + ") — score: " + parsed.score);
        return parsed;
      } catch (err) {
        logger.warn("[AI] Text failed with " + modelName + ":", err.message);
      }
    }
  }

  // ── METHOD 3: Generic helpful response ───────────────────────────────────
  logger.warn("[AI] All methods failed — returning generic feedback");
  return genericFeedback(studentName);
};

/**
 * Generate an AI-drafted mentor feedback message.
 *
 * @param {string} mentorName
 * @param {string} studentName
 * @param {string} focusArea
 * @param {string} pdfBase64
 * @returns {Promise<string>}
 */
const generateMentorSuggestion = async (mentorName, studentName, focusArea, pdfBase64) => {
  const prompt =
    "You are helping a mentor named \"" + (mentorName || "Mentor") + "\" write professional placement feedback " +
    "for their student \"" + (studentName || "Student") + "\". " +
    "Focus on: " + (focusArea || "overall resume quality and career readiness") + ". " +
    "Read the resume and write a professional, constructive, encouraging message (3-5 sentences) " +
    "the mentor can send. Write in first person as the mentor. No greetings or sign-offs.";

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model  = getModel(modelName, { temperature: 0.3 });
      const parts  = pdfBase64
        ? [prompt, { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }]
        : [prompt];
      const result = await model.generateContent(parts);
      return result.response.text().trim();
    } catch (err) {
      logger.warn("[AI] Mentor suggest failed with " + modelName + ":", err.message);
    }
  }
  return "Thank you for submitting your resume. I will review it and provide detailed feedback shortly.";
};

// ── Private helpers ──────────────────────────────────────────────────────────

function noKeyResponse() {
  return {
    score: null,
    summary: "Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.",
    strengths: [], improvements: [], keywords_missing: [], ats_score: null, sections_feedback: {},
  };
}

function genericFeedback(studentName) {
  return {
    score: 60,
    summary: "Resume received for " + (studentName || "Student") + ". AI endpoints are currently busy. Please try again in a moment for a detailed analysis.",
    strengths: ["Resume uploaded successfully", "Took initiative to seek feedback"],
    improvements: ["Ensure PDF is text-based (not a scanned image) for best AI results", "Quantify achievements with numbers", "Add GitHub and LinkedIn links"],
    keywords_missing: ["GitHub", "LeetCode", "REST API", "Data Structures", "System Design"],
    ats_score: 50,
    sections_feedback: {
      contact: "Ensure phone, email, LinkedIn, and GitHub are all present",
      education: "List CGPA, relevant coursework, and graduation year clearly",
      skills: "Separate by category: Languages, Frameworks, Tools, Databases",
      experience: "Use action verbs and quantify each achievement",
      projects: "List 2-3 projects with tech stack, your role, and measurable outcome",
    },
  };
}

module.exports = { analyzeResume, generateMentorSuggestion };
