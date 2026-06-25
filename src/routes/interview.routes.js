"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/interview.controller");

// Questions
router.get("/questions/:companyId", ctrl.getQuestions);
router.post("/questions", ctrl.createQuestion);

// Student attempts
router.post("/attempts", ctrl.saveAttempt);
router.get("/student/:id/attempts", ctrl.getAttempts);

// Feedback
router.get("/student/:id/feedback", ctrl.getFeedback);
router.post("/feedback", ctrl.saveFeedback);

// Mentor — read assigned students
router.get("/mentor/:id/students", ctrl.getAssignedStudents);

// Admin — users
router.get("/admin/users", ctrl.getAllUsers);

// Admin — assignments (was completely missing — root cause of the bug)
router.get("/admin/assignments", ctrl.getAllAssignments);
router.post("/admin/assignments", ctrl.createAssignment);
router.delete("/admin/assignments/:id", ctrl.deleteAssignment);

module.exports = router;