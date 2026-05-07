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
  // Prefer current model families first
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  // Legacy fallbacks for older projects/keys
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
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

function normalizeTargetRole(targetRole) {
  const role = String(targetRole || "").trim();
  return role || "Web Developer";
}

function buildPrompt(studentName, resumeText, targetRole) {
  const role = normalizeTargetRole(targetRole);
  const content = resumeText
    ? `RESUME TEXT:\n---\n${resumeText}\n---`
    : "The resume is provided as a PDF document. Read ALL visible text carefully.";

  return `You are a brutally strict ATS resume evaluator and senior tech recruiter for Indian engineering placements.

Analyze the resume of "${studentName || "the student"}" specifically for the target role: "${role}".

You must think like:
- An ATS system filtering candidates automatically
- A recruiter rejecting 90% of resumes in 10 seconds

STRICT ENFORCEMENT RULES:
1. If the content is NOT a resume/CV (e.g. notes, assignment, blank, random text), output ONLY:
{"not_a_resume":true,"reason":"clear identification of what it actually is"}
2. If it IS a resume, output ONLY ONE raw JSON object. No markdown, no code blocks, no explanations.
3. Do NOT give generic advice. Every point MUST reference actual content or missing content from THIS resume.
4. Be harsh, critical, and realistic. Do NOT sugarcoat.
5. If something is missing, explicitly call it out.
6. If projects/experience are weak or irrelevant, clearly say so.
7. Penalize:
   - Lack of measurable impact
   - Missing tech stack depth
   - Poor formatting for ATS
   - Buzzwords without proof
8. score and ats_score MUST be integers between 0–100.

SCORING LOGIC (STRICT):
- 90+ = top 5% candidate
- 75–89 = strong but not standout
- 60–74 = average / needs improvement
- 40–59 = weak / likely rejected
- <40 = reject immediately

REQUIRED OUTPUT FORMAT:
{
"document_type":"resume",
"not_resume_reason":"",
"score":75,
"ats_score":68,
"summary":"3-5 sharp sentences evaluating THIS resume specifically. Mention role fit, major gaps, and hiring chances.",
"strengths":[
"Specific strength based on resume",
"Specific strength based on resume",
"Specific strength based on resume"
],
"improvements":[
"Clear weakness + exact fix",
"Clear weakness + exact fix",
"Clear weakness + exact fix"
],
"keywords_missing":[
"important keyword for the target role",
"important keyword for the target role",
"important keyword for the target role",
"important keyword for the target role",
"important keyword for the target role"
],
"sections_feedback":{
"contact":"Precise feedback (missing links, formatting issues, etc.)",
"education":"Relevance, clarity, missing details",
"skills":"Depth, categorization, missing tools",
"experience":"Impact, metrics, relevance to the target role",
"projects":"Quality, complexity, real-world relevance"
}
}

${content}

FINAL WARNING:
- Output ONLY JSON
- Any extra text = FAILURE
- No placeholders, no assumptions, no generic lines
- Everything must be derived from the given resume`;
}

// ── Validate parsed result ────────────────────────────────────────────────────
function validateParsed(parsed) {
  if (!parsed) throw new Error("Could not parse JSON from AI response");
  const docType = String(parsed.document_type || "").toLowerCase().trim();
  const nonResumeSignals = [
    String(parsed.summary || ""),
    String(parsed.reason || ""),
    String(parsed.not_resume_reason || ""),
    docType,
  ].join(" ");

  const explicitNonResume =
    docType === "not_resume" ||
    docType === "non_resume" ||
    docType === "other" ||
    /\bnot\s+a?\s*resume\b/i.test(nonResumeSignals) ||
    /\bnon[-\s]?resume\b/i.test(nonResumeSignals) ||
    /\b(this|document|submission|file)\s+(is|looks|appears)\b[\s\S]{0,60}\b(assignment|homework|lab report|project report|question paper|notes?|invoice|receipt|article|research paper)\b/i.test(
      nonResumeSignals,
    );

  if (parsed.not_a_resume || explicitNonResume) {
    const err = new Error(
      parsed.reason ||
        parsed.not_resume_reason ||
        "This does not appear to be a resume or CV.",
    );
    err.code = "NOT_A_RESUME";
    throw err;
  }
  if (typeof parsed.score !== "number")
    throw new Error("AI response missing required score field");
  return parsed;
}

function getRetrySecondsFromError(message) {
  if (!message) return null;
  const m1 = String(message).match(/retry in\s+([\d.]+)s/i);
  if (m1 && m1[1]) return Math.max(1, Math.ceil(Number(m1[1])));
  const m2 = String(message).match(/"retryDelay":"(\d+)s"/i);
  if (m2 && m2[1]) return Math.max(1, Number(m2[1]));
  return null;
}

function normalizeGeminiError(err) {
  const raw = String(err?.message || err || "");
  const lower = raw.toLowerCase();
  const isQuota =
    lower.includes("429") ||
    lower.includes("quota exceeded") ||
    lower.includes("rate limit");

  if (isQuota) {
    const retrySeconds = getRetrySecondsFromError(raw);
    return {
      code: "GEMINI_QUOTA",
      message:
        "Gemini quota/rate-limit reached for scanned PDF analysis." +
        (retrySeconds
          ? ` Please retry in about ${retrySeconds}s.`
          : " Please retry after a short wait.") +
        " If this keeps happening, add billing or increase quota in Google AI Studio.",
    };
  }

  const isInvalidKey =
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("invalid api key");
  if (isInvalidKey) {
    return {
      code: "GEMINI_KEY_INVALID",
      message:
        "Gemini API key is invalid or not active for Generative Language API. Update GEMINI_API_KEY and redeploy/restart the server.",
    };
  }

  const isPermission =
    lower.includes("permission_denied") ||
    lower.includes("403") ||
    lower.includes("forbidden");
  if (isPermission) {
    return {
      code: "GEMINI_PERMISSION",
      message:
        "Gemini request was denied (403). Check API key restrictions and ensure Generative Language API access is enabled.",
    };
  }

  const isModelIssue =
    lower.includes("model") &&
    (lower.includes("not found") || lower.includes("not supported"));
  if (isModelIssue) {
    return {
      code: "GEMINI_MODEL",
      message:
        "Gemini model access/config issue. Try again later or switch to a supported Gemini model for your key/project.",
    };
  }

  return {
    code: "GEMINI_FAILED",
    message:
      "Gemini could not analyze this scanned PDF right now. Check GEMINI_API_KEY and model availability, then retry.",
  };
}

// ── METHOD 1: Groq — text-based PDFs ─────────────────────────────────────────
async function analyzeWithGroq(resumeText, studentName, targetRole) {
  const prompt = buildPrompt(
    studentName,
    resumeText.trim().substring(0, 12000),
    targetRole,
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
async function analyzeWithGemini(pdfBase64, studentName, targetRole) {
  if (!env.GEMINI_API_KEY) {
    logger.error(
      "[AI] GEMINI_API_KEY is not set in .env — image-based PDF analysis requires it. Get free key: https://aistudio.google.com/app/apikey",
    );
    return null;
  }

  const prompt = buildPrompt(studentName, null, targetRole); // no text — Gemini reads PDF visually

  let lastGeminiError = null;

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
      lastGeminiError = err;
      logger.warn(`[AI] Gemini FAILED (${modelName}): ${err.message}`);
    }
  }

  // Surface the actual Gemini error so the user/admin can diagnose it
  if (lastGeminiError) {
    logger.error(
      `[AI] All Gemini models failed. Last error: ${lastGeminiError.message}`,
    );
    const normalized = normalizeGeminiError(lastGeminiError);
    const surfacedErr = new Error(normalized.message);
    surfacedErr.code = normalized.code;
    throw surfacedErr;
  }

  return null;
}

// ── Main entry point ──────────────────────────────────────────────────────────
const analyzeResume = async (resumeText, studentName, pdfBase64, targetRole) => {
  const normalizedRole = normalizeTargetRole(targetRole);

  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY) return noKeyResponse();

  const textIsUsable = resumeText && resumeText.trim().length > 100;

  if (textIsUsable) {
    // ── Text-based PDF: try Groq first ────────────────────────────────────
    logger.info(`[AI] Text PDF (${resumeText.trim().length} chars) → Groq`);
    const groqResult = await analyzeWithGroq(
      resumeText,
      studentName,
      normalizedRole,
    );
    if (groqResult) return groqResult;

    // Groq failed on all models — fall back to Gemini with the text
    logger.warn("[AI] Groq exhausted — falling back to Gemini with text");
    if (env.GEMINI_API_KEY && pdfBase64) {
      try {
        const geminiResult = await analyzeWithGemini(
          pdfBase64,
          studentName,
          normalizedRole,
        );
        if (geminiResult) return geminiResult;
      } catch (gemErr) {
        if (gemErr.code === "NOT_A_RESUME") throw gemErr;
        logger.error(
          `[AI] Gemini text-fallback failed (${gemErr.code || "GEMINI_FAILED"}): ${gemErr.message}`,
        );
        return genericFeedback(studentName, gemErr.message, normalizedRole);
      }
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
      try {
        const geminiResult = await analyzeWithGemini(
          pdfBase64,
          studentName,
          normalizedRole,
        );
        if (geminiResult) return geminiResult;
      } catch (gemErr) {
        if (gemErr.code === "NOT_A_RESUME") throw gemErr;
        // Return a concise actionable message for Gemini failures
        logger.error(
          `[AI] Gemini image analysis failed (${gemErr.code || "GEMINI_FAILED"}): ${gemErr.message}`,
        );
        return genericFeedback(studentName, gemErr.message, normalizedRole);
      }
    }
  }

  logger.error(`[AI] All methods exhausted for: ${studentName}`);
  return genericFeedback(studentName, null, normalizedRole);
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

function genericFeedback(studentName, reason, targetRole) {
  return {
    score: null,
    ats_score: null,
    target_role: normalizeTargetRole(targetRole),
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
