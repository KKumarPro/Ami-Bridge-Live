"use strict";

const companyService  = require("../services/company.service");
const InterviewModel  = require("../models/interview.model");
const UserModel       = require("../models/user.model");
const CompanyModel    = require("../models/company.model");
const { pool }        = require("../config/db");
const R               = require("../utils/response");
const bcrypt          = require("bcryptjs");
const { parse }       = require("csv-parse/sync");

// ── Questions ─────────────────────────────────────────────────────────────────
const getQuestions = async (req, res, next) => {
  try {
    const questions = await companyService.getQuestions(req.params.companyId);
    return R.ok(res, questions);
  } catch (err) { next(err); }
};

const createQuestion = async (req, res, next) => {
  try {
    const { company_id, question_text, options, correct_answer } = req.body;
    if (!company_id || !question_text || !options || correct_answer === undefined)
      return R.badRequest(res, "company_id, question_text, options, and correct_answer are required");
    if (!Array.isArray(options) || options.length < 2)
      return R.badRequest(res, "options must be an array with at least 2 choices");
    const result = await InterviewModel.saveQuestion(company_id, question_text, options, correct_answer);
    return R.created(res, result.rows[0]);
  } catch (err) { next(err); }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const result = await InterviewModel.deleteQuestion(req.params.id);
    if (result.rows.length === 0) return R.notFound(res, "Question not found");
    return R.ok(res, { deleted: true });
  } catch (err) { next(err); }
};

// ── Attempts ──────────────────────────────────────────────────────────────────
const saveAttempt = async (req, res, next) => {
  try {
    const { student_id, company_id, total_score, max_score } = req.body;
    const result = await InterviewModel.saveAttempt(student_id, company_id, total_score, max_score);
    return R.created(res, result.rows[0]);
  } catch (err) { next(err); }
};

const getAttempts = async (req, res, next) => {
  try {
    const result = await InterviewModel.getAttemptsByStudent(req.params.id);
    return R.ok(res, result.rows);
  } catch (err) { next(err); }
};

// ── Feedback ──────────────────────────────────────────────────────────────────
const getFeedback = async (req, res, next) => {
  try {
    const result = await InterviewModel.getFeedbackForStudent(req.params.id);
    return R.ok(res, result.rows);
  } catch (err) { next(err); }
};

const saveFeedback = async (req, res, next) => {
  try {
    const { mentor_id, student_id, feedback_type, feedback_text } = req.body;
    if (!mentor_id || !student_id || !feedback_text)
      return R.badRequest(res, "mentor_id, student_id, and feedback_text are required");
    const result = await InterviewModel.saveFeedback(
      mentor_id, student_id, feedback_type || "General", feedback_text
    );
    return R.created(res, result.rows[0]);
  } catch (err) { next(err); }
};

// ── Mentor ────────────────────────────────────────────────────────────────────
const getAssignedStudents = async (req, res, next) => {
  try {
    const result = await InterviewModel.getAssignedStudents(req.params.id);
    return R.ok(res, result.rows);
  } catch (err) { next(err); }
};

// ── Admin — users ─────────────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const result = await UserModel.getAll();
    return R.ok(res, result.rows);
  } catch (err) { next(err); }
};

const deleteUser = async (req, res, next) => {
  try {
    // Prevent admin from deleting themselves
    if (String(req.params.id) === String(req.user.id))
      return R.badRequest(res, "You cannot delete your own account");
    const result = await UserModel.delete(req.params.id);
    if (result.rows.length === 0) return R.notFound(res, "User not found");
    return R.ok(res, { deleted: true });
  } catch (err) { next(err); }
};

// ── Admin — companies ─────────────────────────────────────────────────────────
const deleteCompany = async (req, res, next) => {
  try {
    const result = await CompanyModel.delete(req.params.id);
    if (result.rows.length === 0) return R.notFound(res, "Company not found");
    return R.ok(res, { deleted: true });
  } catch (err) { next(err); }
};

// ── Admin — assignments ───────────────────────────────────────────────────────
const getAllAssignments = async (req, res, next) => {
  try {
    const result = await InterviewModel.getAllAssignments();
    return R.ok(res, result.rows);
  } catch (err) { next(err); }
};

const createAssignment = async (req, res, next) => {
  try {
    const { mentor_id, student_id } = req.body;
    if (!mentor_id || !student_id)
      return R.badRequest(res, "mentor_id and student_id are required");
    const exists = await InterviewModel.checkAssignmentExists(mentor_id, student_id);
    if (exists.rows.length > 0)
      return R.badRequest(res, "This student is already assigned to that mentor");
    await InterviewModel.assignStudentToMentor(mentor_id, student_id);
    const all = await InterviewModel.getAllAssignments();
    return R.created(res, all.rows);
  } catch (err) { next(err); }
};

const deleteAssignment = async (req, res, next) => {
  try {
    const result = await InterviewModel.deleteAssignment(req.params.id);
    if (result.rows.length === 0) return R.notFound(res, "Assignment not found");
    return R.ok(res, { deleted: true, assignment_id: req.params.id });
  } catch (err) { next(err); }
};

// ── Bulk Register ─────────────────────────────────────────────────────────────
const bulkRegister = async (req, res, next) => {
  if (!req.file) return R.badRequest(res, "No CSV file uploaded");
  try {
    const csvText = req.file.buffer.toString("utf-8");
    const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
    if (records.length === 0) return R.badRequest(res, "CSV file is empty");
    const firstRow = records[0];
    const missing  = ["name", "email", "password"].filter((c) => !(c in firstRow));
    if (missing.length > 0)
      return R.badRequest(res, "CSV missing required columns: " + missing.join(", "));
    const results = { success: [], failed: [], skipped: [] };
    for (const record of records) {
      const { name, email, password, mentor_email } = record;
      if (!name || !email || !password) {
        results.failed.push({ email: email || "?", reason: "Missing required fields" }); continue;
      }
      const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (exists.rows.length > 0) {
        results.skipped.push({ email, reason: "Already exists" }); continue;
      }
      const salt    = await bcrypt.genSalt(10);
      const hashed  = await bcrypt.hash(password, salt);
      const newUser = await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'student') RETURNING id, name, email",
        [name, email, hashed]
      );
      const studentId = newUser.rows[0].id;
      if (mentor_email) {
        const mentorRes = await pool.query(
          "SELECT id FROM users WHERE email = $1 AND role = 'mentor'", [mentor_email]
        );
        if (mentorRes.rows.length > 0) {
          const mentorId    = mentorRes.rows[0].id;
          const assignCheck = await InterviewModel.checkAssignmentExists(mentorId, studentId);
          if (assignCheck.rows.length === 0)
            await InterviewModel.assignStudentToMentor(mentorId, studentId);
        }
      }
      results.success.push({ name, email });
    }
    return R.created(res, {
      message: "Bulk registration complete.",
      total:   records.length,
      created: results.success.length,
      skipped: results.skipped.length,
      failed:  results.failed.length,
      details: results,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getQuestions, createQuestion, deleteQuestion,
  saveAttempt, getAttempts,
  getFeedback, saveFeedback,
  getAssignedStudents,
  getAllUsers, deleteUser,
  deleteCompany,
  getAllAssignments, createAssignment, deleteAssignment,
  bulkRegister,
};