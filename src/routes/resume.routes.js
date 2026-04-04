"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/resume.controller");
const { resumeUpload, csvUpload } = require("../middlewares/upload.middleware");
const { requireRole }             = require("../middlewares/auth.middleware");
const { rateLimit }               = require("../middlewares/rateLimit.middleware");

// ── Student routes ────────────────────────────────────────────────────────────
router.post(  "/student/:id/resumes",         resumeUpload.single("resume"), ctrl.upload);
router.get(   "/student/:id/resumes",         ctrl.list);

// ── Per-resume routes ─────────────────────────────────────────────────────────
router.get(   "/resume/:resumeId/view",       ctrl.view);
router.delete("/resume/:resumeId",            ctrl.remove);
router.post(  "/resume/:resumeId/analyze",    rateLimit(10, 60_000), ctrl.analyze);
router.get(   "/resume/:resumeId/ai-feedback",ctrl.getAIFeedback);
router.post(  "/resume/:resumeId/mentor-ai-suggest", rateLimit(20, 60_000), ctrl.mentorAISuggest);

// ── Mentor / Admin OCR ────────────────────────────────────────────────────────
router.get("/mentor/:id/resumes-ocr", ctrl.mentorOCR);
router.get("/admin/resumes-ocr",      ctrl.adminOCR);

// ── CSV Bulk Register ─────────────────────────────────────────────────────────
const interviewCtrl = require("../controllers/interview.controller");
router.post("/admin/bulk-register", csvUpload.single("csvFile"), interviewCtrl.bulkRegister);

module.exports = router;
