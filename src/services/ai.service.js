"use strict";

const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("../config/env");
const logger = require("../utils/logger");

// ── Clients ───────────────────────────────────────────────────────────────────
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: env.GROQ_API_KEY });
  return _groq;
}

let _gemini = null;
function getGemini() {
  if (!_gemini) _gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return _gemini;
}

// ── Model lists ───────────────────────────────────────────────────────────────
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

// Free-tier Gemini models with PDF/vision support
const GEMINI_MODELS = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
];

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

// ── Shared prompt ─────────────────────────────────────────────────────────────
const SYSTEM_MSG =
  "You are a resume analysis expert. Always respond with raw JSON only — no markdown, no code fences, no explanations.";

function buildPrompt(studentName, resumeText) {
  const content = resumeText
    ? `RESUME TEXT:\n---\n${resumeText}\n---`
    : "The resume is provided as a PDF document. Read ALL visible text carefully.";

  return `You are a professional resume reviewer and ATS expert for Indian engineering and tech placements.

Analyze the resume of the student named "${studentName || "the student"}".

STRICT RULES:
1. If this is NOT a resume/CV (e.g. article, notes, assignment, blank page), output ONLY: {"not_a_resume":true,"reason":"what it actually is"}
2. If it IS a resume, output ONLY a raw JSON object. No markdown, no code fences, no text before or after.
3. Reference actual content from this specific resume. Do NOT give generic advice.
4. score and ats_score must be integers 0-100.

Required JSON format:
{"score":75,"ats_score":68,"summary":"3-5 sentences about this specific resume.","strengths":["Strength 1","Strength 2","Strength 3"],"improvements":["Weakness + fix 1","Weakness + fix 2","Weakness + fix 3"],"keywords_missing":["kw1","kw2","kw3","kw4","kw5"],"sections_feedback":{"contact":"Feedback.","education":"Feedback.","skills":"Feedback.","experience":"Feedback.","projects":"Feedback."}}

${content}

Output only the JSON. Nothing else.`;
}

// ── Validate parsed result ────────────────────────────────────────────────────
function validateParsed(parsed) {
  if (!parsed) throw new Error("Could not parse JSON from AI response");
  if (parsed.not_a_resume) {
    const err = new Error(
      parsed.reason || "This does not appear to be a resume or CV.",
    );
    err.code = "NOT_A_RESUME";
    throw err;
  }
  if (typeof parsed.score !== "number")
    throw new Error("AI response missing required score field");
  return parsed;
}

// ── METHOD 1: Groq — text-based PDFs ─────────────────────────────────────────
async function analyzeWithGroq(resumeText, studentName) {
  const prompt = buildPrompt(
    studentName,
    resumeText.trim().substring(0, 12000),
  );

  for (const model of GROQ_MODELS) {
    try {
      logger.info(
        `[AI] Groq → ${model} | ${resumeText.trim().length} chars | ${studentName}`,
      );
      const chat = await getGroq().chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_MSG },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });
      const raw = chat.choices[0]?.message?.content || "";
      logger.info(`[AI] Groq raw (300): ${raw.substring(0, 300)}`);
      return validateParsed(extractJSON(raw));
    } catch (err) {
      if (err.code === "NOT_A_RESUME") throw err;
      logger.warn(`[AI] Groq FAILED (${model}): ${err.message}`);
    }
  }
  return null; // all Groq models exhausted
}

// ── METHOD 2: Gemini — image/scanned PDFs ────────────────────────────────────
async function analyzeWithGemini(pdfBase64, studentName) {
  if (!env.GEMINI_API_KEY) {
    logger.error(
      "[AI] GEMINI_API_KEY is not set in .env — image-based PDF analysis requires it. Get free key: https://aistudio.google.com/app/apikey",
    );
    return null;
  }

  const prompt = buildPrompt(studentName, null); // no text — Gemini reads PDF visually

  for (const modelName of GEMINI_MODELS) {
    try {
      const sizeMB = ((pdfBase64.length * 0.75) / 1048576).toFixed(2);
      logger.info(
        `[AI] Gemini → ${modelName} | ${sizeMB} MB PDF | ${studentName}`,
      );

      const model = getGemini().getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.1 },
      });
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      ]);
      const raw = result.response.text();
      logger.info(`[AI] Gemini raw (300): ${raw.substring(0, 300)}`);
      return validateParsed(extractJSON(raw));
    } catch (err) {
      if (err.code === "NOT_A_RESUME") throw err;
      logger.warn(`[AI] Gemini FAILED (${modelName}): ${err.message}`);
    }
  }
  return null; // all Gemini models exhausted
}

// ── Main entry point ──────────────────────────────────────────────────────────
const analyzeResume = async (resumeText, studentName, pdfBase64) => {
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) return noKeyResponse();

  const textIsUsable = resumeText && resumeText.trim().length > 100;

  if (textIsUsable) {
    // ── Text-based PDF: try Groq first ────────────────────────────────────
    logger.info(`[AI] Text PDF (${resumeText.trim().length} chars) → Groq`);
    const groqResult = await analyzeWithGroq(resumeText, studentName);
    if (groqResult) return groqResult;

    // Groq failed on all models — fall back to Gemini with the text
    logger.warn("[AI] Groq exhausted — falling back to Gemini with text");
    if (env.GEMINI_API_KEY && pdfBase64) {
      const geminiResult = await analyzeWithGemini(pdfBase64, studentName);
      if (geminiResult) return geminiResult;
    }
  } else {
    // ── Image/scanned PDF: use Gemini vision ──────────────────────────────
    logger.info(
      `[AI] Image PDF detected (text: ${(resumeText || "").trim().length} chars) → Gemini`,
    );
    if (!env.GEMINI_API_KEY) {
      logger.error(
        "[AI] GEMINI_API_KEY missing — cannot analyse image-based PDF. Add it to .env file.",
      );
      return genericFeedback(
        studentName,
        "This is a scanned/image-based PDF. GEMINI_API_KEY is not set in your .env file. Add: GEMINI_API_KEY=your_key (free at https://aistudio.google.com/app/apikey)",
      );
    }
    if (pdfBase64) {
      const geminiResult = await analyzeWithGemini(pdfBase64, studentName);
      if (geminiResult) return geminiResult;
    }
  }

  logger.error(`[AI] All methods exhausted for: ${studentName}`);
  return genericFeedback(studentName);
};

// ── Mentor suggestion ─────────────────────────────────────────────────────────
const generateMentorSuggestion = async (mentorName, studentName, focusArea) => {
  const prompt =
    `Help mentor "${mentorName || "Mentor"}" write professional feedback for student "${studentName || "Student"}". ` +
    `Focus: ${focusArea || "overall resume quality and career readiness"}. ` +
    `Write 3-5 sentences in first person as the mentor. No greetings or sign-offs.`;

  if (env.GROQ_API_KEY) {
    for (const model of GROQ_MODELS) {
      try {
        const chat = await getGroq().chat.completions.create({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 300,
        });
        const text = chat.choices[0]?.message?.content?.trim() || "";
        if (text) return text;
      } catch (err) {
        logger.warn(`[AI] Mentor Groq FAILED (${model}): ${err.message}`);
      }
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
      "Neither GROQ_API_KEY nor GEMINI_API_KEY is set. Please add them to your .env file.",
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
