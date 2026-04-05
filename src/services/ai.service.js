"use strict";

const { getModel } = require("../config/ai");
const env = require("../config/env");
const logger = require("../utils/logger");

const MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

// ── JSON extractor ────────────────────────────────────────────────────────────
// Handles markdown fences, preamble text, trailing commentary — all common
// ways Gemini wraps its response even when told not to.

function extractJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  let text = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  text = text
    .replace(/^```(?:json)?[\r\n]*/im, "")
    .replace(/[\r\n]*```\s*$/im, "")
    .trim();

  // Direct parse (best case — model obeyed instructions)
  try {
    return JSON.parse(text);
  } catch (_) {}

  // Find and extract the outermost { ... } block
  let depth = 0,
    start = -1,
    end = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        break;
      }
    }
  }
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (_) {}
  }

  return null;
}

// ── Prompt ────────────────────────────────────────────────────────────────────
// Kept deliberately simple and concrete so every Gemini version returns
// a clean JSON object without preamble or markdown wrapping.

function buildPrompt(studentName, resumeText) {
  return `You are a professional resume reviewer and ATS (Applicant Tracking System) expert for Indian engineering/tech placements.

Analyze the resume text below for the student named "${studentName || "the student"}".

IMPORTANT RULES:
1. First verify this is actually a resume or CV. If it is NOT a resume (e.g. article, notes, assignment), output ONLY: {"not_a_resume":true,"reason":"describe what it actually is"}
2. If it IS a resume, output ONLY a raw JSON object with no markdown, no code fences, no text before or after the JSON.
3. Be specific — reference actual names, skills, companies, or projects from the resume. Do NOT give generic advice.

Required JSON format (output this and nothing else):
{"score":75,"ats_score":68,"summary":"Write 3-5 sentences evaluating the overall quality, completeness, and impact of this specific resume.","strengths":["Specific strength #1 from this resume","Specific strength #2 from this resume","Specific strength #3 from this resume"],"improvements":["Specific weakness #1 with an actionable fix","Specific weakness #2 with an actionable fix","Specific weakness #3 with an actionable fix"],"keywords_missing":["keyword1","keyword2","keyword3","keyword4","keyword5"],"sections_feedback":{"contact":"Feedback on the contact/header section of this resume.","education":"Feedback on the education section of this resume.","skills":"Feedback on the skills section of this resume.","experience":"Feedback on the experience/internships section of this resume.","projects":"Feedback on the projects section of this resume."}}

Scoring:
- score: Overall resume quality (0-100). Consider content, formatting, impact, completeness.
- ats_score: ATS compatibility (0-100). Consider keywords, formatting, section headers.

RESUME TEXT:
---
${resumeText}
---

Output only the JSON. No explanation, no markdown.`;
}

// ── Main analysis function ────────────────────────────────────────────────────

const analyzeResume = async (resumeText, studentName, pdfBase64) => {
  if (
    !env.GEMINI_API_KEY ||
    env.GEMINI_API_KEY === "your_gemini_api_key_here"
  ) {
    return noKeyResponse();
  }

  const textIsUsable = resumeText && resumeText.trim().length > 100;

  // ── METHOD 1: Text mode — preferred for all standard text-based PDFs ──────
  if (textIsUsable) {
    const prompt = buildPrompt(
      studentName,
      resumeText.trim().substring(0, 12000),
    );

    for (const modelName of MODELS_TO_TRY) {
      try {
        logger.info(
          `[AI] Text mode → ${modelName} | ${resumeText.trim().length} chars | student: ${studentName}`,
        );
        const model = getModel(modelName, { temperature: 0.1 });
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        logger.info(`[AI] Response (first 300): ${raw.substring(0, 300)}`);

        const parsed = extractJSON(raw);
        if (!parsed) {
          logger.warn(
            `[AI] extractJSON returned null. Full raw response: ${raw.substring(0, 600)}`,
          );
          throw new Error("Could not parse JSON from Gemini response");
        }

        if (parsed.not_a_resume) {
          logger.warn(`[AI] Not a resume: ${parsed.reason}`);
          const err = new Error(
            parsed.reason || "This does not appear to be a resume or CV.",
          );
          err.code = "NOT_A_RESUME";
          throw err;
        }

        if (typeof parsed.score !== "number") {
          logger.warn(
            `[AI] Parsed JSON missing score field: ${JSON.stringify(parsed).substring(0, 200)}`,
          );
          throw new Error("JSON response missing required score field");
        }

        logger.info(
          `[AI] SUCCESS via text mode (${modelName}) — score: ${parsed.score}`,
        );
        return parsed;
      } catch (err) {
        if (err.code === "NOT_A_RESUME") throw err;
        logger.warn(`[AI] Text mode FAILED (${modelName}): ${err.message}`);
      }
    }
  } else {
    logger.info(
      `[AI] Text too short (${(resumeText || "").trim().length} chars) — skipping text mode, going to vision`,
    );
  }

  // ── METHOD 2: Vision mode — fallback for scanned/image PDFs ──────────────
  if (pdfBase64) {
    const visionPrompt = buildPrompt(
      studentName,
      "[The resume is provided as a PDF image below. Please read it and analyze it.]",
    );

    for (const modelName of MODELS_TO_TRY) {
      try {
        const sizeMB = ((pdfBase64.length * 0.75) / 1048576).toFixed(2);
        logger.info(
          `[AI] Vision mode → ${modelName} | ${sizeMB} MB | student: ${studentName}`,
        );
        const model = getModel(modelName, { temperature: 0.1 });
        const result = await model.generateContent([
          visionPrompt,
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        ]);
        const raw = result.response.text();
        logger.info(
          `[AI] Vision response (first 300): ${raw.substring(0, 300)}`,
        );

        const parsed = extractJSON(raw);
        if (!parsed) {
          logger.warn(
            `[AI] Vision extractJSON null. Raw: ${raw.substring(0, 600)}`,
          );
          throw new Error("Could not parse JSON from Gemini vision response");
        }

        if (parsed.not_a_resume) {
          const err = new Error(
            parsed.reason || "This does not appear to be a resume or CV.",
          );
          err.code = "NOT_A_RESUME";
          throw err;
        }

        if (typeof parsed.score !== "number")
          throw new Error("Vision JSON missing score field");

        logger.info(
          `[AI] SUCCESS via vision mode (${modelName}) — score: ${parsed.score}`,
        );
        return parsed;
      } catch (err) {
        if (err.code === "NOT_A_RESUME") throw err;
        logger.warn(`[AI] Vision mode FAILED (${modelName}): ${err.message}`);
      }
    }
  }

  logger.error(`[AI] All methods exhausted for student: ${studentName}`);
  return genericFeedback(studentName);
};

// ── Mentor suggestion ─────────────────────────────────────────────────────────

const generateMentorSuggestion = async (
  mentorName,
  studentName,
  focusArea,
  pdfBase64,
) => {
  const prompt =
    `You are helping mentor "${mentorName || "Mentor"}" write placement feedback for student "${studentName || "Student"}". ` +
    `Focus on: ${focusArea || "overall resume quality and career readiness"}. ` +
    `Write a professional, constructive, encouraging message (3-5 sentences) in first person as the mentor. No greetings or sign-offs.`;

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = getModel(modelName, { temperature: 0.3 });
      const parts = pdfBase64
        ? [
            prompt,
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          ]
        : [prompt];
      const result = await model.generateContent(parts);
      return result.response.text().trim();
    } catch (err) {
      logger.warn(`[AI] Mentor suggest FAILED (${modelName}): ${err.message}`);
    }
  }
  return "Thank you for submitting your resume. I will review it carefully and provide detailed feedback soon.";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function noKeyResponse() {
  return {
    score: null,
    ats_score: null,
    summary:
      "Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.",
    strengths: [],
    improvements: [],
    keywords_missing: [],
    sections_feedback: {},
  };
}

function genericFeedback(studentName) {
  return {
    score: null,
    ats_score: null,
    _generic: true,
    summary: `AI analysis could not be completed for ${studentName || "this resume"} right now. Please check your server logs for the exact error, then try again.`,
    strengths: [],
    improvements: [],
    keywords_missing: [],
    sections_feedback: {},
  };
}

module.exports = { analyzeResume, generateMentorSuggestion };
