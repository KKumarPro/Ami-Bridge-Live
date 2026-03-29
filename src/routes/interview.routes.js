"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/interview.controller");

// Questions
router.get( "/questions/:companyId",       ctrl.getQuestions);

// Student attempts
router.post("/attempts",                   ctrl.saveAttempt);
router.get( "/student/:id/attempts",       ctrl.getAttempts);

// Feedback
router.get( "/student/:id/feedback",       ctrl.getFeedback);
router.post("/feedback",                   ctrl.saveFeedback);

// Mentor
router.get( "/mentor/:id/students",        ctrl.getAssignedStudents);

// Admin
router.get( "/admin/users",                ctrl.getAllUsers);

module.exports = router;
