"use strict";

const Groq = require("groq-sdk");
const env = require("../config/env");
const logger = require("../utils/logger");

// Groq free-tier models ordered by capability
const MODELS_TO_TRY = [
  "llama-3.3-70b-versatile", // Best: 14,400 req/day free
  "llama-3.1-8b-instant", // Fast fallback
  "gemma2-9b-it", // Google Gemma via Groq
  "mixtral-8x7b-32768", // Mixtral fallback
];

// Singleton Groq client
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: env.GROQ_API_KEY });
  return _groq;
}

// ── JSON extractor ────────────────────────────────────────────────────────────
function extractJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  let text = raw.trim();
  text = text
    .replace(/^```(?:json)?[\r\n]*/im, "")
    .replace(/[\r\n]*```\s*$/im, "")
    .trim();
  try {
    return JSON.parse(text);
  } catch (_) {}
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

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(studentName, resumeText) {
  return `You are a professional resume reviewer and ATS expert for Indian engineering and tech placements.

Analyze the resume text below for the student named "${studentName || "the student"}".

STRICT RULES:
1. If this is NOT a resume/CV (e.g. article, notes, assignment), output ONLY: {"not_a_resume":true,"reason":"what it actually is"}
2. If it IS a resume, output ONLY a raw JSON object. No markdown, no code fences, no text before or after.
3. Reference actual content from this specific resume. Do NOT give generic advice.
4. score and ats_score must be integers 0-100.

Required JSON format:
{"score":75,"ats_score":68,"summary":"3-5 sentences about this specific resume quality and career readiness.","strengths":["Specific strength from this resume","Specific strength from this resume","Specific strength from this resume"],"improvements":["Specific weakness + actionable fix","Specific weakness + actionable fix","Specific weakness + actionable fix"],"keywords_missing":["kw1","kw2","kw3","kw4","kw5"],"sections_feedback":{"contact":"Feedback on this contact section.","education":"Feedback on this education section.","skills":"Feedback on this skills section.","experience":"Feedback on this experience section.","projects":"Feedback on this projects section."}}

RESUME TEXT:
---
${resumeText}
---

Output only the JSON. Nothing else.`;
}

// ── Resume analysis ───────────────────────────────────────────────────────────
const analyzeResume = async (resumeText, studentName, pdfBase64) => {
  if (!env.GROQ_API_KEY) return noKeyResponse();

  const textIsUsable = resumeText && resumeText.trim().length > 100;
  if (!textIsUsable) {
    logger.warn(
      `[AI] Resume text too short (${(resumeText || "").trim().length} chars) — likely a scanned image PDF.`,
    );
    return genericFeedback(
      studentName,
      "The uploaded PDF appears to be a scanned image and contains no readable text. Please upload a text-based PDF resume.",
    );
  }

  const prompt = buildPrompt(
    studentName,
    resumeText.trim().substring(0, 12000),
  );

  for (const modelName of MODELS_TO_TRY) {
    try {
      logger.info(
        `[AI] Groq → ${modelName} | ${resumeText.trim().length} chars | student: ${studentName}`,
      );
      const chat = await getGroq().chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "You are a resume analysis expert. Always respond with raw JSON only — no markdown, no code fences, no explanations.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const raw = chat.choices[0]?.message?.content || "";
      logger.info(`[AI] Response (first 400): ${raw.substring(0, 400)}`);

      const parsed = extractJSON(raw);
      if (!parsed) {
        logger.warn(
          `[AI] JSON extraction failed. Full response: ${raw.substring(0, 800)}`,
        );
        throw new Error("Could not parse JSON from AI response");
      }

      if (parsed.not_a_resume) {
        const err = new Error(
          parsed.reason || "This does not appear to be a resume or CV.",
        );
        err.code = "NOT_A_RESUME";
        throw err;
      }

      if (typeof parsed.score !== "number") {
        logger.warn(
          `[AI] Missing score. Parsed: ${JSON.stringify(parsed).substring(0, 300)}`,
        );
        throw new Error("AI response missing required score field");
      }

      logger.info(
        `[AI] SUCCESS (${modelName}) — score: ${parsed.score}, ats: ${parsed.ats_score}`,
      );
      return parsed;
    } catch (err) {
      if (err.code === "NOT_A_RESUME") throw err;
      logger.warn(`[AI] FAILED (${modelName}): ${err.message}`);
    }
  }

  logger.error(`[AI] All models exhausted for: ${studentName}`);
  return genericFeedback(studentName);
};

// ── Mentor suggestion ─────────────────────────────────────────────────────────
const generateMentorSuggestion = async (mentorName, studentName, focusArea) => {
  if (!env.GROQ_API_KEY)
    return "AI suggestion unavailable — GROQ_API_KEY not configured.";

  const prompt =
    `Help mentor "${mentorName || "Mentor"}" write professional feedback for student "${studentName || "Student"}". ` +
    `Focus: ${focusArea || "overall resume quality and career readiness"}. ` +
    `Write 3-5 sentences in first person as the mentor. No greetings or sign-offs.`;

  for (const modelName of MODELS_TO_TRY) {
    try {
      const chat = await getGroq().chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
      });
      const text = chat.choices[0]?.message?.content?.trim() || "";
      if (text) return text;
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
      "GROQ_API_KEY is not set in your .env file. Get a free key at https://console.groq.com",
    strengths: [],
    improvements: [],
    keywords_missing: [],
    sections_feedback: {},
  };
}

function genericFeedback(studentName, reason) {
  return {
    score: null,
    ats_score: null,
    _generic: true,
    summary:
      reason ||
      `AI analysis could not be completed for ${studentName || "this resume"}. Check your server terminal for the exact error.`,
    strengths: [],
    improvements: [],
    keywords_missing: [],
    sections_feedback: {},
  };
}

module.exports = { analyzeResume, generateMentorSuggestion };
