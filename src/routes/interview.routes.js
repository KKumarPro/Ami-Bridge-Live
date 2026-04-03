"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/interview.controller");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");

// ── Questions (admin writes, anyone authenticated reads) ──────────────────────
router.get(   "/questions/:companyId",    authenticate, ctrl.getQuestions);
router.post(  "/questions",              authenticate, requireRole("admin"), ctrl.createQuestion);
router.delete("/questions/:id",          authenticate, requireRole("admin"), ctrl.deleteQuestion);

// ── Student attempts (student writes own, mentor/admin read) ──────────────────
router.post("/attempts",                 authenticate, ctrl.saveAttempt);
router.get( "/student/:id/attempts",    authenticate, ctrl.getAttempts);

// ── Feedback ──────────────────────────────────────────────────────────────────
router.get( "/student/:id/feedback",    authenticate, ctrl.getFeedback);
router.post("/feedback",                authenticate, requireRole("mentor", "admin"), ctrl.saveFeedback);

// ── Mentor ────────────────────────────────────────────────────────────────────
router.get( "/mentor/:id/students",     authenticate, requireRole("mentor", "admin"), ctrl.getAssignedStudents);

// ── Admin — users ─────────────────────────────────────────────────────────────
router.get(   "/admin/users",           authenticate, requireRole("admin"), ctrl.getAllUsers);
router.delete("/admin/users/:id",       authenticate, requireRole("admin"), ctrl.deleteUser);

// ── Admin — companies ─────────────────────────────────────────────────────────
router.delete("/admin/companies/:id",   authenticate, requireRole("admin"), ctrl.deleteCompany);

// ── Admin — assignments ───────────────────────────────────────────────────────
router.get(   "/admin/assignments",     authenticate, requireRole("admin"), ctrl.getAllAssignments);
router.post(  "/admin/assignments",     authenticate, requireRole("admin"), ctrl.createAssignment);
router.delete("/admin/assignments/:id", authenticate, requireRole("admin"), ctrl.deleteAssignment);

module.exports = router;