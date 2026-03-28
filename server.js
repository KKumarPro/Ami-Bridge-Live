// Main changes done for the vercel live deployment

// --- EXPRESS BACKEND SETUP ---
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // Safe for Vercel
const jwt = require("jsonwebtoken");
const multer = require("multer");
require("dotenv").config();

// --- GEMINI AI SETUP ---
const { GoogleGenerativeAI } = require("@google/generative-ai");
if (
  !process.env.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
) {
  console.warn(
    "\n⚠️  WARNING: GEMINI_API_KEY is not set. AI resume feedback will not work.\n" +
      "   Get your free key at: https://aistudio.google.com/app/apikey\n" +
      "   Then add it to your .env file as: GEMINI_API_KEY=your_key_here\n",
  );
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// --- FILE UPLOAD CONFIGURATION ---
const storage = multer.memoryStorage();

const uploadResume = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF and Word documents are allowed"), false);
  },
});

const uploadCSV = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv"))
      cb(null, true);
    else cb(new Error("Only CSV files are allowed"), false);
  },
});

// --- NEON DB POSTGRESQL CONNECTION ---
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.log("Neon DB background disconnect (ignoring):", err.message);
});

const testDbConnection = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("Successfully connected to PostgreSQL (Neon DB)!");
  } catch (err) {
    console.error("Database connection error:", err.message);
  }
};
testDbConnection();

// ==========================================
// DB MIGRATION: Add new columns if missing
// ==========================================
const runMigrations = async () => {
  try {
    await pool.query(`
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_data TEXT;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gemini_feedback TEXT;
      ALTER TABLE resumes ADD COLUMN IF NOT EXISTS gemini_score INTEGER;
    `);
    console.log("Database migrations applied.");
  } catch (err) {
    console.log("Migration info (non-fatal):", err.message);
  }
};
runMigrations();

// ==========================================
// HELPER: Extract text from PDF buffer
// ==========================================
async function extractTextFromPDF(buffer) {
  try {
    const PDFParser = require("pdf2json");
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(null, 1);
      pdfParser.on("pdfParser_dataError", (errData) =>
        reject(errData.parserError),
      );
      pdfParser.on("pdfParser_dataReady", (pdfData) =>
        resolve(pdfParser.getRawTextContent()),
      );
      pdfParser.parseBuffer(buffer);
    });
  } catch (err) {
    console.error("PDF parse error:", err.message);
    return "";
  }
}

// ==========================================
// HELPER: Analyze resume using Gemini Vision
// ==========================================
async function analyzeResumeWithGemini(resumeText, studentName, pdfBase64) {
  if (
    !process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
  ) {
    return {
      score: null,
      summary: "Gemini API key not configured.",
      strengths: [],
      improvements: [],
      keywords_missing: [],
      ats_score: null,
      sections_feedback: {},
    };
  }

  const prompt = `You are an expert career coach and ATS specialist reviewing resumes for engineering/tech placement students.
Analyze this resume for ${studentName || "Student"} and give detailed, specific, actionable feedback.

${resumeText ? `RESUME TEXT CONTENT:\n---\n${resumeText.substring(0, 10000)}\n---\n` : ""}

You MUST respond ONLY with a valid JSON object. No markdown, no explanation, no code fences. Start your response with { and end with }.

Required format:
{"score":85,"summary":"Overall assessment here in 2-3 sentences.","strengths":["Strength one","Strength two"],"improvements":["Improvement one","Improvement two"],"keywords_missing":["Keyword1","Keyword2"],"ats_score":78,"sections_feedback":{"contact":"Feedback here","education":"Feedback here","skills":"Feedback here","experience":"Feedback here","projects":"Feedback here"}}`;

  // SMART FALLBACK: Try newest flash, then pro.
  const modelsToTry = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Attempting analysis with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2 },
      });

      let result;
      if (pdfBase64) {
        // Vision API
        result = await model.generateContent([
          prompt,
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        ]);
      } else {
        // Text Only
        result = await model.generateContent(prompt);
      }

      let raw = result.response.text().trim();
      // Strip out markdown code blocks if the AI accidentally adds them
      raw = raw
        .replace(/^```(json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      const parsed = JSON.parse(raw);
      console.log(
        `[Gemini] SUCCESS with ${modelName} — Score: ${parsed.score}`,
      );
      return parsed;
    } catch (err) {
      console.error(`[Gemini] Failed with ${modelName}:`, err.message);
      // Loop will continue to the next model in the array
    }
  }

  // --- METHOD 3: Absolute Fallback ---
  console.log(
    "[Gemini] All API endpoints failed. Returning generic structure.",
  );
  return {
    score: 60,
    summary:
      "Resume received, but AI analysis endpoints are currently unavailable. Please manually review formatting.",
    strengths: ["Resume uploaded successfully"],
    improvements: ["Awaiting deeper technical review"],
    keywords_missing: ["Check against job description"],
    ats_score: 50,
    sections_feedback: {
      contact: "Check formatting",
      education: "Ensure dates are clear",
      skills: "List clearly",
      experience: "Use bullet points",
      projects: "Include tech stack",
    },
  };
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userExists.rows.length > 0)
      return res.status(400).json({ error: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, hashedPassword, role],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (user.rows.length === 0)
      return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    res.json({
      id: user.rows[0].id,
      name: user.rows[0].name,
      email: user.rows[0].email,
      role: user.rows[0].role,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ==========================================
// 2. SHARED ROUTES
// ==========================================

app.get("/api/companies", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM companies ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching companies" });
  }
});

app.post("/api/companies", async (req, res) => {
  const { company_name, description, icon_class, bg_color, text_color } =
    req.body;
  try {
    const result = await pool.query(
      "INSERT INTO companies (company_name, description, icon_class, bg_color, text_color) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [company_name, description, icon_class, bg_color, text_color],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error creating company" });
  }
});

app.get("/api/questions/:companyId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM interview_questions WHERE company_id = $1",
      [req.params.companyId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching questions" });
  }
});

// ==========================================
// 3. STUDENT ROUTES
// ==========================================

app.post("/api/attempts", async (req, res) => {
  const { student_id, company_id, total_score, max_score } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO student_attempts (student_id, company_id, total_score, max_score) VALUES ($1, $2, $3, $4) RETURNING *",
      [student_id, company_id, total_score, max_score],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error saving attempt" });
  }
});

app.get("/api/student/:id/attempts", async (req, res) => {
  try {
    const query = `SELECT sa.*, c.company_name, c.icon_class, c.bg_color, c.text_color FROM student_attempts sa JOIN companies c ON sa.company_id = c.company_id WHERE sa.student_id = $1 ORDER BY sa.attempt_date DESC`;
    const result = await pool.query(query, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching history" });
  }
});

// POST: Upload resume
app.post(
  "/api/student/:id/resumes",
  uploadResume.single("resume"),
  async (req, res) => {
    const studentId = req.params.id;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const fileBase64 = req.file.buffer.toString("base64");
      const filePath = `db://resumes/${studentId}/${Date.now()}_${req.file.originalname}`;
      const result = await pool.query(
        `INSERT INTO resumes (student_id, resume_name, file_path, file_data, file_type) VALUES ($1, $2, $3, $4, $5) RETURNING resume_id, student_id, resume_name, upload_date, file_type`,
        [
          studentId,
          req.file.originalname,
          filePath,
          fileBase64,
          req.file.mimetype,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Resume Upload Error:", err);
      res.status(500).json({ error: "Server error uploading resume" });
    }
  },
);

app.get("/api/student/:id/resumes", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT resume_id, student_id, resume_name, upload_date, file_type, gemini_score FROM resumes WHERE student_id = $1 ORDER BY upload_date DESC`,
      [req.params.id],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching resumes" });
  }
});

// GET: View resume inline
app.get("/api/resume/:resumeId/view", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT resume_name, file_data, file_type FROM resumes WHERE resume_id = $1",
      [req.params.resumeId],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Resume not found" });

    const { resume_name, file_data, file_type } = result.rows[0];
    if (!file_data)
      return res.status(404).json({ error: "Resume file not available" });

    const fileBuffer = Buffer.from(file_data, "base64");
    res.setHeader("Content-Type", file_type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${resume_name}"`);
    res.setHeader("Content-Length", fileBuffer.length);
    res.end(fileBuffer);
  } catch (err) {
    res.status(500).json({ error: "Server error viewing resume" });
  }
});

app.delete("/api/resume/:resumeId", async (req, res) => {
  try {
    await pool.query("DELETE FROM resumes WHERE resume_id = $1", [
      req.params.resumeId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error deleting resume" });
  }
});

// POST: AI Resume Analysis
app.post("/api/resume/:resumeId/analyze", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.name as student_name FROM resumes r JOIN users u ON r.student_id = u.id WHERE r.resume_id = $1`,
      [req.params.resumeId],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Resume not found" });

    const resume = result.rows[0];
    if (!resume.file_data)
      return res
        .status(400)
        .json({ error: "Resume file not found. Please re-upload." });

    const pdfBase64 = resume.file_data;
    const fileBuffer = Buffer.from(pdfBase64, "base64");
    const resumeText = await extractTextFromPDF(fileBuffer);

    const analysis = await analyzeResumeWithGemini(
      resumeText,
      resume.student_name,
      pdfBase64,
    );

    await pool.query(
      "UPDATE resumes SET gemini_feedback = $1, gemini_score = $2 WHERE resume_id = $3",
      [JSON.stringify(analysis), analysis.score, req.params.resumeId],
    );
    res.json(analysis);
  } catch (err) {
    console.error("Gemini Analyze Error:", err);
    res.status(500).json({ error: "Server error during AI analysis" });
  }
});

app.get("/api/resume/:resumeId/ai-feedback", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT gemini_feedback, gemini_score FROM resumes WHERE resume_id = $1",
      [req.params.resumeId],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Resume not found" });

    const { gemini_feedback, gemini_score } = result.rows[0];
    if (!gemini_feedback) return res.json({ analyzed: false });

    res.json({
      analyzed: true,
      score: gemini_score,
      ...JSON.parse(gemini_feedback),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// MENTOR ROUTES
// ==========================================

app.get("/api/student/:id/feedback", async (req, res) => {
  try {
    const query = `SELECT f.*, u.name as mentor_name FROM mentor_feedback f JOIN users u ON f.mentor_id = u.id WHERE f.student_id = $1 ORDER BY f.feedback_date DESC`;
    const result = await pool.query(query, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching feedback" });
  }
});

app.post("/api/feedback", async (req, res) => {
  const { mentor_id, student_id, feedback_type, feedback_text } = req.body;
  if (!mentor_id || !student_id || !feedback_text)
    return res
      .status(400)
      .json({ error: "mentor_id, student_id, and feedback_text are required" });
  try {
    const result = await pool.query(
      `INSERT INTO mentor_feedback (mentor_id, student_id, feedback_type, feedback_text) VALUES ($1, $2, $3, $4) RETURNING *`,
      [mentor_id, student_id, feedback_type || "General", feedback_text],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error submitting feedback" });
  }
});

app.post("/api/resume/:resumeId/mentor-ai-suggest", async (req, res) => {
  const { mentor_name, focus_area } = req.body;
  try {
    const result = await pool.query(
      `SELECT r.*, u.name as student_name FROM resumes r JOIN users u ON r.student_id = u.id WHERE r.resume_id = $1`,
      [req.params.resumeId],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Resume not found" });

    const resume = result.rows[0];
    const pdfBase64 = resume.file_data;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });
    const prompt = `You are helping a mentor named "${mentor_name || "Mentor"}" write professional placement feedback for their student "${resume.student_name}". Focus on: ${focus_area || "overall resume quality and career readiness"}. Write a professional, constructive feedback message (3-5 sentences) the mentor can send. Write in first person as the mentor. No greetings or sign-offs needed.`;

    const aiResult = await model.generateContent([
      prompt,
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    ]);
    res.json({ suggestion: aiResult.response.text().trim() });
  } catch (err) {
    console.error("Mentor AI Suggest Error:", err);
    res.status(500).json({ error: "Server error generating AI suggestion" });
  }
});

app.get("/api/mentor/:id/students", async (req, res) => {
  try {
    const query = `SELECT ma.assignment_id, u.id as student_id, u.name, u.email FROM mentor_assignments ma JOIN users u ON ma.student_id = u.id WHERE ma.mentor_id = $1`;
    const result = await pool.query(query, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching assigned students" });
  }
});

app.get("/api/mentor/:id/resumes-ocr", async (req, res) => {
  try {
    const studentsResult = await pool.query(
      `SELECT u.id as student_id, u.name, u.email FROM mentor_assignments ma JOIN users u ON ma.student_id = u.id WHERE ma.mentor_id = $1`,
      [req.params.id],
    );
    const students = studentsResult.rows;
    if (students.length === 0) return res.json([]);

    const studentIds = students.map((s) => s.student_id);
    const resumesResult = await pool.query(
      `SELECT resume_id, student_id, resume_name, upload_date, file_data, gemini_feedback, gemini_score FROM resumes WHERE student_id = ANY($1::int[]) ORDER BY upload_date DESC`,
      [studentIds],
    );

    const results = [];
    for (const resume of resumesResult.rows) {
      const student = students.find((s) => s.student_id === resume.student_id);
      let extractedData = {};

      if (resume.gemini_feedback) {
        try {
          extractedData = JSON.parse(resume.gemini_feedback);
        } catch (e) {}
      }

      results.push({
        resume_id: resume.resume_id,
        student_id: resume.student_id,
        student_name: student?.name || "Unknown",
        student_email: student?.email || "",
        resume_name: resume.resume_name,
        upload_date: resume.upload_date,
        gemini_score: resume.gemini_score,
        ...extractedData,
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Server error during OCR extraction" });
  }
});

// ==========================================
// 5. ADMIN ROUTES
// ==========================================

app.get("/api/admin/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching users" });
  }
});

app.get("/api/admin/resumes-ocr", async (req, res) => {
  try {
    const resumesResult = await pool.query(
      `SELECT r.resume_id, r.student_id, r.resume_name, r.upload_date, r.file_data, r.gemini_feedback, r.gemini_score, u.name as student_name, u.email as student_email FROM resumes r JOIN users u ON r.student_id = u.id ORDER BY r.upload_date DESC`,
    );

    const results = [];
    for (const resume of resumesResult.rows) {
      let extractedData = {};
      if (resume.gemini_feedback) {
        try {
          extractedData = JSON.parse(resume.gemini_feedback);
        } catch (e) {}
      }
      results.push({
        resume_id: resume.resume_id,
        student_id: resume.student_id,
        student_name: resume.student_name,
        student_email: resume.student_email,
        resume_name: resume.resume_name,
        upload_date: resume.upload_date,
        gemini_score: resume.gemini_score,
        ...extractedData,
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Server error during admin OCR" });
  }
});

// POST: CSV Bulk Student Registration
app.post(
  "/api/admin/bulk-register",
  uploadCSV.single("csvFile"),
  async (req, res) => {
    const { requester_role } = req.body;

    if (!["admin", "mentor"].includes(requester_role)) {
      return res
        .status(403)
        .json({ error: "Only mentors and admins can bulk register students" });
    }

    if (!req.file)
      return res.status(400).json({ error: "No CSV file uploaded" });

    try {
      const { parse } = require("csv-parse/sync");
      const csvText = req.file.buffer.toString("utf-8");
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      if (records.length === 0)
        return res.status(400).json({ error: "CSV file is empty" });

      const firstRow = records[0];
      const missing = ["name", "email", "password"].filter(
        (c) => !(c in firstRow),
      );
      if (missing.length > 0) {
        return res.status(400).json({
          error: `CSV missing required columns: ${missing.join(", ")}`,
          hint: "Required: name, email, password. Optional: mentor_email",
        });
      }

      const results = { success: [], failed: [], skipped: [] };

      for (const record of records) {
        const { name, email, password, mentor_email } = record;
        if (!name || !email || !password) {
          results.failed.push({
            email: email || "?",
            reason: "Missing required fields",
          });
          continue;
        }

        const exists = await pool.query(
          "SELECT id FROM users WHERE email = $1",
          [email],
        );
        if (exists.rows.length > 0) {
          results.skipped.push({ email, reason: "Already exists" });
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'student') RETURNING id, name, email",
          [name, email, hashed],
        );
        const studentId = newUser.rows[0].id;

        if (mentor_email) {
          const mentorRes = await pool.query(
            "SELECT id FROM users WHERE email = $1 AND role = 'mentor'",
            [mentor_email],
          );
          if (mentorRes.rows.length > 0) {
            const mentorId = mentorRes.rows[0].id;
            const assignExists = await pool.query(
              "SELECT 1 FROM mentor_assignments WHERE mentor_id=$1 AND student_id=$2",
              [mentorId, studentId],
            );
            if (assignExists.rows.length === 0) {
              await pool.query(
                "INSERT INTO mentor_assignments (mentor_id, student_id) VALUES ($1, $2)",
                [mentorId, studentId],
              );
            }
          }
        }

        results.success.push({ name, email });
      }

      res.status(201).json({
        message: "Bulk registration complete.",
        total: records.length,
        created: results.success.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        details: results,
      });
    } catch (err) {
      console.error("Bulk Register Error:", err);
      res
        .status(500)
        .json({
          error: "Server error during bulk registration: " + err.message,
        });
    }
  },
);

// ==========================================
// SERVER LISTENING / VERCEL EXPORT
// ==========================================
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
    console.log(
      `Gemini AI: ${
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
          ? "Configured"
          : "NOT configured (set GEMINI_API_KEY in .env)"
      }`,
    );
  });
}
module.exports = app;
