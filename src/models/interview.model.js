"use strict";

const { pool } = require("../config/db");

const InterviewModel = {
  getQuestionsByCompany: (companyId) =>
    pool.query("SELECT * FROM interview_questions WHERE company_id = $1", [
      companyId,
    ]),

  saveAttempt: (student_id, company_id, total_score, max_score) =>
    pool.query(
      `INSERT INTO student_attempts (student_id, company_id, total_score, max_score)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [student_id, company_id, total_score, max_score],
    ),

  getAttemptsByStudent: (studentId) =>
    pool.query(
      `SELECT sa.*, c.company_name, c.icon_class, c.bg_color, c.text_color
       FROM student_attempts sa
       JOIN companies c ON sa.company_id = c.company_id
       WHERE sa.student_id = $1
       ORDER BY sa.attempt_date DESC`,
      [studentId],
    ),

  getFeedbackForStudent: (studentId) =>
    pool.query(
      `SELECT f.*, u.name AS mentor_name
       FROM mentor_feedback f
       JOIN users u ON f.mentor_id = u.id
       WHERE f.student_id = $1
       ORDER BY f.feedback_date DESC`,
      [studentId],
    ),

  saveFeedback: (mentor_id, student_id, feedback_type, feedback_text) =>
    pool.query(
      `INSERT INTO mentor_feedback (mentor_id, student_id, feedback_type, feedback_text)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [mentor_id, student_id, feedback_type, feedback_text],
    ),

  // ── Assignments ──────────────────────────────────────────────────────────────

  getAssignedStudents: (mentorId) =>
    pool.query(
      `SELECT ma.assignment_id, u.id AS student_id, u.name, u.email
       FROM mentor_assignments ma
       JOIN users u ON ma.student_id = u.id
       WHERE ma.mentor_id = $1
       ORDER BY ma.assignment_id DESC`,
      [mentorId],
    ),

  // NEW — fetch all assignments with names joined (for admin table)
  getAllAssignments: () =>
    pool.query(
      `SELECT ma.assignment_id,
              ma.mentor_id,  um.name AS mentor_name,
              ma.student_id, us.name AS student_name
       FROM mentor_assignments ma
       JOIN users um ON ma.mentor_id  = um.id
       JOIN users us ON ma.student_id = us.id
       ORDER BY ma.assignment_id DESC`,
    ),

  assignStudentToMentor: (mentorId, studentId) =>
    pool.query(
      `INSERT INTO mentor_assignments (mentor_id, student_id)
       VALUES ($1, $2)
       RETURNING assignment_id`,
      [mentorId, studentId],
    ),

  checkAssignmentExists: (mentorId, studentId) =>
    pool.query(
      "SELECT 1 FROM mentor_assignments WHERE mentor_id = $1 AND student_id = $2",
      [mentorId, studentId],
    ),

  // NEW — remove one assignment row by PK
  deleteAssignment: (assignmentId) =>
    pool.query(
      "DELETE FROM mentor_assignments WHERE assignment_id = $1 RETURNING assignment_id",
      [assignmentId],
    ),
};

module.exports = InterviewModel;
