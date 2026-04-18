"use strict";

const Groq = require("groq-sdk");
const https = require("https");
const env = require("../config/env");
const logger = require("../utils/logger");

// ── Groq models for text-based PDFs ──────────────────────────────────────────
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

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

// ── Shared prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  "You are a resume analysis expert. Always respond with raw JSON only — no markdown, no code fences, no explanations.";

function buildTextPrompt(studentName, resumeText) {
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

function buildImagePrompt(studentName) {
  return `You are a professional resume reviewer and ATS expert for Indian engineering and tech placements.

The attached PDF is the resume of the student named "${studentName || "the student"}". Read ALL the text visible in this scanned/image PDF carefully.

STRICT RULES:
1. If this is NOT a resume/CV (e.g. article, notes, assignment, blank page), output ONLY: {"not_a_resume":true,"reason":"what it actually is"}
2. If it IS a resume, output ONLY a raw JSON object. No markdown, no code fences, no text before or after.
3. Reference actual content from the PDF you see. Do NOT give generic advice.
4. score and ats_score must be integers 0-100.

Required JSON format:
{"score":75,"ats_score":68,"summary":"3-5 sentences about this specific resume quality and career readiness.","strengths":["Specific strength from this resume","Specific strength from this resume","Specific strength from this resume"],"improvements":["Specific weakness + actionable fix","Specific weakness + actionable fix","Specific weakness + actionable fix"],"keywords_missing":["kw1","kw2","kw3","kw4","kw5"],"sections_feedback":{"contact":"Feedback on this contact section.","education":"Feedback on this education section.","skills":"Feedback on this skills section.","experience":"Feedback on this experience section.","projects":"Feedback on this projects section."}}

Output only the JSON. Nothing else.`;
}

// ── METHOD 1: Groq text analysis (text-based PDFs) ────────────────────────────
async function analyzeWithGroq(resumeText, studentName) {
  const prompt = buildTextPrompt(
    studentName,
    resumeText.trim().substring(0, 12000),
  );

  for (const modelName of GROQ_MODELS) {
    try {
      logger.info(
        `[AI] Groq text → ${modelName} | ${resumeText.trim().length} chars | ${studentName}`,
      );
      const chat = await getGroq().chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const raw = chat.choices[0]?.message?.content || "";
      logger.info(`[AI] Groq response (first 300): ${raw.substring(0, 300)}`);

      const parsed = extractJSON(raw);
      if (!parsed) throw new Error("Could not parse JSON from Groq response");

      if (parsed.not_a_resume) {
        const err = new Error(
          parsed.reason || "This does not appear to be a resume or CV.",
        );
        err.code = "NOT_A_RESUME";
        throw err;
      }
      if (typeof parsed.score !== "number")
        throw new Error("Missing score in Groq response");

      logger.info(`[AI] Groq SUCCESS (${modelName}) — score: ${parsed.score}`);
      return parsed;
    } catch (err) {
      if (err.code === "NOT_A_RESUME") throw err;
      logger.warn(`[AI] Groq FAILED (${modelName}): ${err.message}`);
    }
  }
  return null; // Signal caller to try next method
}

// ── METHOD 2: Anthropic Claude (image/scanned PDFs) ───────────────────────────
// Claude accepts PDF as a base64 document natively — no image conversion needed.
async function analyzeWithClaude(pdfBase64, studentName) {
  if (!env.ANTHROPIC_API_KEY) {
    logger.warn(
      "[AI] ANTHROPIC_API_KEY not set — cannot analyse image-based PDF",
    );
    return null;
  }

  const prompt = buildImagePrompt(studentName);

  // Claude models to try for vision/PDF
  const claudeModels = [
    "claude-haiku-4-5-20251001", // Fastest, cheapest, handles PDFs well
    "claude-sonnet-4-6", // More capable fallback
  ];

  for (const model of claudeModels) {
    try {
      logger.info(
        `[AI] Claude PDF vision → ${model} | PDF ${((pdfBase64.length * 0.75) / 1048576).toFixed(2)} MB | ${studentName}`,
      );

      const body = JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const raw = await new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: "api.anthropic.com",
            path: "/v1/messages",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Length": Buffer.byteLength(body),
            },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(data));
          },
        );
        req.on("error", reject);
        req.setTimeout(60000, () => {
          req.destroy();
          reject(new Error("Request timed out"));
        });
        req.write(body);
        req.end();
      });

      const response = JSON.parse(raw);
      if (response.error)
        throw new Error(`Claude API error: ${response.error.message}`);

      const text = response.content?.[0]?.text || "";
      logger.info(
        `[AI] Claude response (first 300): ${text.substring(0, 300)}`,
      );

      const parsed = extractJSON(text);
      if (!parsed) throw new Error("Could not parse JSON from Claude response");

      if (parsed.not_a_resume) {
        const err = new Error(
          parsed.reason || "This does not appear to be a resume or CV.",
        );
        err.code = "NOT_A_RESUME";
        throw err;
      }
      if (typeof parsed.score !== "number")
        throw new Error("Missing score in Claude response");

      logger.info(`[AI] Claude SUCCESS (${model}) — score: ${parsed.score}`);
      return parsed;
    } catch (err) {
      if (err.code === "NOT_A_RESUME") throw err;
      logger.warn(`[AI] Claude FAILED (${model}): ${err.message}`);
    }
  }
  return null;
}

// ── Main entry point ──────────────────────────────────────────────────────────
const analyzeResume = async (resumeText, studentName, pdfBase64) => {
  if (!env.GROQ_API_KEY) return noKeyResponse();

  const textIsUsable = resumeText && resumeText.trim().length > 100;

  // ── PATH A: Text-based PDF → Groq ────────────────────────────────────────
  if (textIsUsable) {
    logger.info(
      `[AI] Text-based PDF detected (${resumeText.trim().length} chars) — using Groq`,
    );
    const result = await analyzeWithGroq(resumeText, studentName);
    if (result) return result;
    // Groq exhausted all models — fall through to Claude as backup
    logger.warn("[AI] Groq exhausted — trying Claude as backup for text PDF");
  }

  // ── PATH B: Image/scanned PDF → Claude ───────────────────────────────────
  if (pdfBase64) {
    logger.info(
      `[AI] ${textIsUsable ? "Groq failed, trying" : "Image-based PDF detected — using"} Claude PDF vision`,
    );
    const result = await analyzeWithClaude(pdfBase64, studentName);
    if (result) return result;

    // If ANTHROPIC_API_KEY is missing, give a clear message
    if (!env.ANTHROPIC_API_KEY) {
      return genericFeedback(
        studentName,
        "This appears to be a scanned/image PDF. To analyse image-based resumes, please add ANTHROPIC_API_KEY to your .env file. Get a free key at https://console.anthropic.com",
      );
    }
  }

  logger.error(`[AI] All methods exhausted for: ${studentName}`);
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

  for (const modelName of GROQ_MODELS) {
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
