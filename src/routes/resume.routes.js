"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/resume.controller");
const { resumeUpload, csvUpload }    = require("../middlewares/upload.middleware");
const { authenticate, requireRole }  = require("../middlewares/auth.middleware");
const { rateLimit }                  = require("../middlewares/rateLimit.middleware");

// ── Student routes ────────────────────────────────────────────────────────────
router.post(  "/student/:id/resumes",         authenticate, resumeUpload.single("resume"), ctrl.upload);
router.get(   "/student/:id/resumes",         authenticate, ctrl.list);

// ── Per-resume routes ─────────────────────────────────────────────────────────
router.get(   "/resume/:resumeId/view",
  (req, res, next) => {
    // Allow token as query param for iframe/browser navigation (can't set headers)
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = "Bearer " + req.query.token;
    }
    next();
  },
  authenticate,
  ctrl.view
);
router.delete("/resume/:resumeId",            authenticate, ctrl.remove);
router.post(  "/resume/:resumeId/analyze",    authenticate, rateLimit(10, 60_000), ctrl.analyze);
router.get(   "/resume/:resumeId/ai-feedback",authenticate, ctrl.getAIFeedback);
router.post(  "/resume/:resumeId/mentor-ai-suggest", authenticate, requireRole("mentor", "admin"), rateLimit(20, 60_000), ctrl.mentorAISuggest);

// ── Mentor / Admin OCR ────────────────────────────────────────────────────────
router.get("/mentor/:id/resumes-ocr", authenticate, requireRole("mentor", "admin"), ctrl.mentorOCR);
router.get("/admin/resumes-ocr",      authenticate, requireRole("admin"), ctrl.adminOCR);

// ── CSV Bulk Register ─────────────────────────────────────────────────────────
const interviewCtrl = require("../controllers/interview.controller");
router.post("/admin/bulk-register", authenticate, requireRole("admin"), csvUpload.single("csvFile"), interviewCtrl.bulkRegister);

module.exports = router;