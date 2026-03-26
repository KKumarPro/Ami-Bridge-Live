// --- EXPRESS BACKEND SETUP ---
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // FIXED: Using bcryptjs to prevent Vercel crashes
const jwt = require("jsonwebtoken");
const multer = require("multer");
const PDFParser = require("pdf2json"); // FIXED: Serverless-safe PDF parser
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON requests

// --- NEON DB POSTGRESQL CONNECTION ---
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

// Catch errors on idle clients in the pool (Prevents Neon Sleep Crashes)
pool.on("error", (err, client) => {
  console.log("Neon DB background disconnect (ignoring):", err.message);
});

// Test Connection safely
const testDbConnection = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("Successfully connected to PostgreSQL (Neon DB)!");
  } catch (err) {
    console.error("Database connection error:", err.message);
  }
};
testDbConnection();

// --- INITIALIZE GEMINI AI & MULTER ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure Multer to store the uploaded file in RAM (Memory) temporarily
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

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
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

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
    if (user.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

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
// 2. SHARED ROUTES (Companies & Questions)
// ==========================================

app.get("/api/companies", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM companies ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Companies Error:", err);
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
    console.error("Create Company Error:", err);
    res.status(500).json({ error: "Server error creating company" });
  }
});

app.get("/api/questions/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const result = await pool.query(
      "SELECT * FROM interview_questions WHERE company_id = $1",
      [companyId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Questions Error:", err);
    res.status(500).json({ error: "Server error fetching questions" });
  }
});

// ==========================================
// 3. STUDENT DYNAMIC ROUTES
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
    console.error("Save Attempt Error:", err);
    res.status(500).json({ error: "Server error saving attempt" });
  }
});

app.get("/api/student/:id/attempts", async (req, res) => {
  try {
    const query = `
      SELECT sa.*, c.company_name, c.icon_class, c.bg_color, c.text_color
      FROM student_attempts sa
      JOIN companies c ON sa.company_id = c.company_id
      WHERE sa.student_id = $1
      ORDER BY sa.attempt_date DESC
    `;
    const result = await pool.query(query, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Student Attempts Error:", err);
    res.status(500).json({ error: "Server error fetching history" });
  }
});

app.get("/api/student/:id/resumes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM resumes WHERE student_id = $1 ORDER BY upload_date DESC",
      [req.params.id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Resumes Error:", err);
    res.status(500).json({ error: "Server error fetching resumes" });
  }
});

app.get("/api/student/:id/feedback", async (req, res) => {
  try {
    const query = `
      SELECT f.*, u.name as mentor_name 
      FROM mentor_feedback f
      JOIN users u ON f.mentor_id = u.id
      WHERE f.student_id = $1
      ORDER BY f.feedback_date DESC
    `;
    const result = await pool.query(query, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Feedback Error:", err);
    res.status(500).json({ error: "Server error fetching feedback" });
  }
});

// ==========================================
// 4. MENTOR DYNAMIC ROUTES
// ==========================================

app.get("/api/mentor/:id/students", async (req, res) => {
  try {
    const query = `
      SELECT ma.assignment_id, u.id as student_id, u.name, u.email
      FROM mentor_assignments ma
      JOIN users u ON ma.student_id = u.id
      WHERE ma.mentor_id = $1
    `;
    const result = await pool.query(query, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Assigned Students Error:", err);
    res.status(500).json({ error: "Server error fetching assigned students" });
  }
});

// ==========================================
// 5. ADMIN DYNAMIC ROUTES
// ==========================================

app.get("/api/admin/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch All Users Error:", err);
    res.status(500).json({ error: "Server error fetching users" });
  }
});

// ==========================================
// 6. AI & RESUME UPLOAD ROUTES
// ==========================================

// Raw Text AI Feedback Route (Fallback)
app.post("/api/ai/resume-feedback", async (req, res) => {
  const { resumeText, targetRole } = req.body;

  if (!resumeText) {
    return res
      .status(400)
      .json({ error: "Resume text is required for analysis." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an expert strict Technical Recruiter and ATS system analyzing a resume.
      The candidate is targeting the role of: ${targetRole || "Software Engineer"}.
      
      Review the following resume text and provide structured feedback in exactly 3 sections:
      1. Technical Strengths (What they did well)
      2. Areas for Improvement (Missing skills, weak phrasing)
      3. ATS Formatting & General Advice
      
      Keep the tone professional, direct, and actionable. Do not use markdown formatting like ** or *, just plain text separated by newlines.
      
      RESUME TEXT:
      """
      ${resumeText}
      """
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ feedback: responseText });
  } catch (err) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: "Failed to generate AI feedback." });
  }
});

// File Upload & Parse AI Route (Serverless Safe)
app.post("/api/resumes/analyze", upload.single("resume"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No PDF file uploaded." });
  }

  // Initialize the serverless-safe PDF parser
  // FIXED: Using `null` instead of `this` to prevent Vercel crashes
  const pdfParser = new PDFParser(null, 1);

  // Event 1: If the PDF fails to parse
  pdfParser.on("pdfParser_dataError", (errData) => {
    console.error("PDF Parsing Error:", errData.parserError);
    return res.status(500).json({ error: "Failed to parse the PDF document." });
  });

  // Event 2: If the PDF parses successfully
  pdfParser.on("pdfParser_dataReady", async (pdfData) => {
    try {
      const extractedText = pdfParser.getRawTextContent();

      if (!extractedText || extractedText.trim().length === 0) {
        return res
          .status(400)
          .json({ error: "Could not extract text. Is this a scanned image?" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
        You are an expert strict Technical Recruiter reviewing a resume.
        Review the following resume text and provide structured feedback in exactly 3 sections:
        1. Technical Strengths
        2. Areas for Improvement
        3. ATS Formatting Advice
        
        Keep it professional, direct, and under 150 words total. Do not use markdown like **.
        
        RESUME TEXT:
        """
        ${extractedText}
        """
      `;

      const aiResult = await model.generateContent(prompt);
      const aiFeedback = aiResult.response.text();

      return res.json({
        message: "Resume analyzed successfully!",
        extractedText: extractedText.substring(0, 200) + "...",
        aiFeedback: aiFeedback,
      });
    } catch (err) {
      console.error("Gemini AI Error:", err);
      return res.status(500).json({ error: "Failed to generate AI feedback." });
    }
  });

  // Start parsing the file buffer from RAM
  try {
    pdfParser.parseBuffer(req.file.buffer);
  } catch (err) {
    console.error("Buffer Parse Error:", err);
    return res.status(500).json({ error: "Failed to read file buffer." });
  }
});

// ==========================================
// SERVER LISTENING / VERCEL EXPORT
// ==========================================
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
  });
}
// This is required for Vercel to work!
module.exports = app;
