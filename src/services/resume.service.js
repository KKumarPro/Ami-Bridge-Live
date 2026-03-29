"use strict";

const ResumeModel   = require("../models/resume.model");
const { analyzeResume, generateMentorSuggestion } = require("./ai.service");
const { processUploadedFile, base64ToBuffer }      = require("./file.service");
const logger        = require("../utils/logger");

// ── Upload ───────────────────────────────────────────────────────────────────
const uploadResume = async (file, studentId) => {
  const { base64, filePath } = await processUploadedFile(file, studentId);
  const result = await ResumeModel.create(
    studentId,
    file.originalname,
    filePath,
    base64,
    file.mimetype
  );
  return result.rows[0];
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
    const err = new Error("Resume not found"); err.status = 404; throw err;
  }
  const { resume_name, file_data, file_type } = result.rows[0];
  if (!file_data) {
    const err = new Error("Resume file not available"); err.status = 404; throw err;
  }
  return { buffer: base64ToBuffer(file_data), name: resume_name, type: file_type };
};

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteResume = async (resumeId) => {
  await ResumeModel.delete(resumeId);
};

// ── AI Analysis ──────────────────────────────────────────────────────────────
const analyzeResumeAI = async (resumeId) => {
  const result = await ResumeModel.findById(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found"); err.status = 404; throw err;
  }
  const resume = result.rows[0];
  if (!resume.file_data) {
    const err = new Error("Resume file not found. Please re-upload."); err.status = 400; throw err;
  }

  const pdfBase64  = resume.file_data;
  const fileBuffer = base64ToBuffer(pdfBase64);
  const { extractTextFromPDF } = require("../utils/parser");
  const resumeText = await extractTextFromPDF(fileBuffer);

  const analysis = await analyzeResume(resumeText, resume.student_name, pdfBase64);
  await ResumeModel.saveAIFeedback(resumeId, JSON.stringify(analysis), analysis.score);
  return analysis;
};

// ── Get cached AI feedback ───────────────────────────────────────────────────
const getAIFeedback = async (resumeId) => {
  const result = await ResumeModel.getAIFeedback(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found"); err.status = 404; throw err;
  }
  const { gemini_feedback, gemini_score } = result.rows[0];
  if (!gemini_feedback) return { analyzed: false };
  return { analyzed: true, score: gemini_score, ...JSON.parse(gemini_feedback) };
};

// ── Mentor AI Suggest ────────────────────────────────────────────────────────
const getMentorAISuggestion = async (resumeId, mentorName, focusArea) => {
  const result = await ResumeModel.findById(resumeId);
  if (result.rows.length === 0) {
    const err = new Error("Resume not found"); err.status = 404; throw err;
  }
  const resume = result.rows[0];
  return generateMentorSuggestion(mentorName, resume.student_name, focusArea, resume.file_data);
};

// ── OCR for mentor ───────────────────────────────────────────────────────────
const getOCRForMentor = async (students) => {
  if (!students.length) return [];
  const ids = students.map((s) => s.student_id);
  const resumesResult = await ResumeModel.findByStudentIds(ids);
  return resumesResult.rows.map((resume) => {
    const student = students.find((s) => s.student_id === resume.student_id);
    let extractedData = {};
    if (resume.gemini_feedback) {
      try { extractedData = JSON.parse(resume.gemini_feedback); } catch (e) {}
    }
    return {
      resume_id: resume.resume_id,
      student_id: resume.student_id,
      student_name: student?.name || "Unknown",
      student_email: student?.email || "",
      resume_name: resume.resume_name,
      upload_date: resume.upload_date,
      gemini_score: resume.gemini_score,
      ...extractedData,
    };
  });
};

// ── OCR for admin (all resumes) ──────────────────────────────────────────────
const getOCRForAdmin = async () => {
  const resumesResult = await ResumeModel.findAllWithStudents();
  return resumesResult.rows.map((resume) => {
    let extractedData = {};
    if (resume.gemini_feedback) {
      try { extractedData = JSON.parse(resume.gemini_feedback); } catch (e) {}
    }
    return {
      resume_id: resume.resume_id,
      student_id: resume.student_id,
      student_name: resume.student_name,
      student_email: resume.student_email,
      resume_name: resume.resume_name,
      upload_date: resume.upload_date,
      gemini_score: resume.gemini_score,
      ...extractedData,
    };
  });
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
