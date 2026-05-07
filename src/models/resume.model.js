"use strict";

const { pool } = require("../config/db");

const ResumeModel = {
  create: (studentId, resumeName, filePath, fileData, fileType, targetRole) =>
    pool.query(
      `INSERT INTO resumes (student_id, resume_name, file_path, file_data, file_type, target_role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING resume_id, student_id, resume_name, upload_date, file_type, target_role`,
      [studentId, resumeName, filePath, fileData, fileType, targetRole]
    ),

  findByStudent: (studentId) =>
    pool.query(
      `SELECT resume_id, student_id, resume_name, upload_date, file_type, target_role, gemini_score, gemini_feedback
       FROM resumes WHERE student_id = $1 ORDER BY upload_date DESC`,
      [studentId]
    ),

  findById: (resumeId) =>
    pool.query(
      `SELECT r.*, u.name AS student_name
       FROM resumes r JOIN users u ON r.student_id = u.id
       WHERE r.resume_id = $1`,
      [resumeId]
    ),

  findFileById: (resumeId) =>
    pool.query(
      "SELECT resume_name, file_data, file_type FROM resumes WHERE resume_id = $1",
      [resumeId]
    ),

  delete: (resumeId) =>
    pool.query("DELETE FROM resumes WHERE resume_id = $1", [resumeId]),

  saveAIFeedback: (resumeId, feedbackJSON, score) =>
    pool.query(
      "UPDATE resumes SET gemini_feedback = $1, gemini_score = $2 WHERE resume_id = $3",
      [feedbackJSON, score, resumeId]
    ),

  getAIFeedback: (resumeId) =>
    pool.query(
      "SELECT gemini_feedback, gemini_score, target_role FROM resumes WHERE resume_id = $1",
      [resumeId]
    ),

  findByStudentIds: (studentIds) =>
    pool.query(
      `SELECT resume_id, student_id, resume_name, upload_date, target_role, file_data, gemini_feedback, gemini_score
       FROM resumes WHERE student_id = ANY($1::int[]) ORDER BY upload_date DESC`,
      [studentIds]
    ),

  findAllWithStudents: () =>
    pool.query(
      `SELECT r.resume_id, r.student_id, r.resume_name, r.upload_date, r.target_role,
              r.file_data, r.gemini_feedback, r.gemini_score,
              u.name AS student_name, u.email AS student_email
       FROM resumes r JOIN users u ON r.student_id = u.id
       ORDER BY r.upload_date DESC`
    ),
};

module.exports = ResumeModel;
