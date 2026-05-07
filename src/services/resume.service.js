"use strict";

const ResumeModel = require("../models/resume.model");
const { analyzeResume, generateMentorSuggestion } = require("./ai.service");
const { processUploadedFile, base64ToBuffer } = require("./file.service");
const { extractTextFromPDF } = require("../utils/parser");
const logger = require("../utils/logger");
const badgeService = require("./badge.service");

function normalizeTargetRole(targetRole) {
  const role = String(targetRole || "").trim().replace(/\s+/g, " ");
  if (!role) return "Web Developer";
  return role.length > 120 ? role.slice(0, 120) : role;
}

// ── Upload ───────────────────────────────────────────────────────────────────
const uploadResume = async (file, studentId, targetRole) => {
  const normalizedRole = normalizeTargetRole(targetRole);

  // 1. Process the uploaded file
  const { base64, filePath } = await processUploadedFile(file, studentId);

  // 2. Save first, analyze after upload from the dedicated endpoint.
  // This keeps upload fast and prevents client-side upload timeouts
  // for scanned/image-based PDFs that need slower vision models.
  const result = await ResumeModel.create(
    studentId,
    file.originalname,
    filePath,
    base64,
    file.mimetype,
    normalizedRole,
  );

  // Return newly created resume with null score (pending analysis).
  return {
    ...result.rows[0],
    target_role: normalizedRole,
    gemini_score: null,
  };
};

// ── List ─────────────────────────────────────────────────────────────────────
const listResumes = async (studentId) => {
  const result = await ResumeModel.findByStudent(studentId);
  return result.rows;
};

// ── View (stream) ────────────────────────────────────────────────────────────
const getResumeFile = async (resumeId) => {
  const result = await ResumeModel.findFileById(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found");
    err.status = 404;
    throw err;
  }
  const { resume_name, file_data, file_type } = result.rows[0];
  if (!file_data) {
    const err = new Error("Resume file not available");
    err.status = 404;
    throw err;
  }
  return {
    buffer: base64ToBuffer(file_data),
    name: resume_name,
    type: file_type,
  };
};

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteResume = async (resumeId) => {
  await ResumeModel.delete(resumeId);
};

// ── AI Analysis ──────────────────────────────────────────────────────────────
const analyzeResumeAI = async (resumeId) => {
  const result = await ResumeModel.findById(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found");
    err.status = 404;
    throw err;
  }
  const resume = result.rows[0];
  if (!resume.file_data) {
    const err = new Error("Resume file not found. Please re-upload.");
    err.status = 400;
    throw err;
  }

  const normalizedRole = normalizeTargetRole(resume.target_role);
  const pdfBase64 = resume.file_data;
  const fileBuffer = base64ToBuffer(pdfBase64);
  const resumeText = await extractTextFromPDF(fileBuffer);

  const analysis = await analyzeResume(
    resumeText,
    resume.student_name,
    pdfBase64,
    normalizedRole,
  );
  const analysisWithRole = {
    ...analysis,
    target_role: normalizedRole,
  };
  await ResumeModel.saveAIFeedback(
    resumeId,
    JSON.stringify(analysisWithRole),
    analysis.score,
  );

  // Award badges based on resume score
  try {
    await badgeService.awardResumeScoreBadges(
      resume.student_id,
      analysis.score,
    );
  } catch (e) {
    logger.warn(`[Badge] Failed to award badges: ${e.message}`);
  }

  return analysisWithRole;
};

// ── Get cached AI feedback ───────────────────────────────────────────────────
const getAIFeedback = async (resumeId) => {
  const result = await ResumeModel.getAIFeedback(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found");
    err.status = 404;
    throw err;
  }
  const { gemini_feedback, gemini_score, target_role } = result.rows[0];
  if (!gemini_feedback) return { analyzed: false };
  return {
    analyzed: true,
    score: gemini_score,
    target_role: normalizeTargetRole(target_role),
    ...JSON.parse(gemini_feedback),
  };
};

// ── Mentor AI Suggest ────────────────────────────────────────────────────────
const getMentorAISuggestion = async (resumeId, mentorName, focusArea) => {
  const result = await ResumeModel.findById(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found");
    err.status = 404;
    throw err;
  }
  const resume = result.rows[0];
  return generateMentorSuggestion(
    mentorName,
    resume.student_name,
    focusArea,
    resume.file_data,
  );
};

// ── OCR for mentor ───────────────────────────────────────────────────────────
const getOCRForMentor = async (students) => {
  if (!students.length) return [];
  const ids = students.map((s) => s.student_id);
  const resumesResult = await ResumeModel.findByStudentIds(ids);

  const results = [];
  for (const resume of resumesResult.rows) {
    const student = students.find((s) => s.student_id === resume.student_id);
    let extractedData = {};

    if (!resume.gemini_feedback && resume.file_data) {
      // No cached analysis — run AI extraction now and cache the result
      try {
        const fileBuffer = base64ToBuffer(resume.file_data);
        const resumeText = await extractTextFromPDF(fileBuffer);
        const analysis = await analyzeResume(
          resumeText,
          student?.name || "Student",
          resume.file_data,
          normalizeTargetRole(resume.target_role),
        );
        const analysisWithRole = {
          ...analysis,
          target_role: normalizeTargetRole(resume.target_role),
        };
        await ResumeModel.saveAIFeedback(
          resume.resume_id,
          JSON.stringify(analysisWithRole),
          analysis.score,
        );
        extractedData = analysisWithRole;
        logger.info(
          `[OCR] Mentor OCR: analyzed resume ${resume.resume_id} for ${student?.name}`,
        );
      } catch (e) {
        logger.warn(
          `[OCR] Mentor OCR failed for resume ${resume.resume_id}: ${e.message}`,
        );
      }
    } else if (resume.gemini_feedback) {
      // Use cached result
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
      target_role: normalizeTargetRole(
        extractedData.target_role || resume.target_role,
      ),
      upload_date: resume.upload_date,
      gemini_score: extractedData.score ?? resume.gemini_score,
      ...extractedData,
    });
  }
  return results;
};

// ── OCR for admin (all resumes) ──────────────────────────────────────────────
const getOCRForAdmin = async () => {
  const resumesResult = await ResumeModel.findAllWithStudents();

  const results = [];
  for (const resume of resumesResult.rows) {
    let extractedData = {};

    if (!resume.gemini_feedback && resume.file_data) {
      // No cached analysis — run AI extraction now and cache the result
      try {
        const fileBuffer = base64ToBuffer(resume.file_data);
        const resumeText = await extractTextFromPDF(fileBuffer);
        const analysis = await analyzeResume(
          resumeText,
          resume.student_name || "Student",
          resume.file_data,
          normalizeTargetRole(resume.target_role),
        );
        const analysisWithRole = {
          ...analysis,
          target_role: normalizeTargetRole(resume.target_role),
        };
        await ResumeModel.saveAIFeedback(
          resume.resume_id,
          JSON.stringify(analysisWithRole),
          analysis.score,
        );
        extractedData = analysisWithRole;
        logger.info(
          `[OCR] Admin OCR: analyzed resume ${resume.resume_id} for ${resume.student_name}`,
        );
      } catch (e) {
        logger.warn(
          `[OCR] Admin OCR failed for resume ${resume.resume_id}: ${e.message}`,
        );
      }
    } else if (resume.gemini_feedback) {
      // Use cached result
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
      target_role: normalizeTargetRole(
        extractedData.target_role || resume.target_role,
      ),
      upload_date: resume.upload_date,
      gemini_score: extractedData.score ?? resume.gemini_score,
      ...extractedData,
    });
  }
  return results;
};

module.exports = {
  uploadResume,
  listResumes,
  getResumeFile,
  deleteResume,
  analyzeResumeAI,
  getAIFeedback,
  getMentorAISuggestion,
  getOCRForMentor,
  getOCRForAdmin,
};
