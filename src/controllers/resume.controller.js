"use strict";

const resumeService = require("../services/resume.service");
const InterviewModel = require("../models/interview.model");
const R = require("../utils/response");

// ── Student ──────────────────────────────────────────────────────────────────

const upload = async (req, res, next) => {
  try {
    if (!req.file) return R.badRequest(res, "No file uploaded");

    // Upload is intentionally save-only; AI runs via /resume/:id/analyze
    const resume = await resumeService.uploadResume(
      req.file,
      req.params.id,
      req.body?.target_role,
    );

    return R.created(res, resume);
  } catch (err) {
    // Kept for backward compatibility if service throws domain-specific errors
    if (err.code === "NOT_A_RESUME") {
      return res.status(422).json({
        error: "NOT_A_RESUME",
        message:
          err.message ||
          "The uploaded document does not appear to be a resume or CV. Please upload a valid resume.",
      });
    }

    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const resumes = await resumeService.listResumes(req.params.id);
    return R.ok(res, resumes);
  } catch (err) {
    next(err);
  }
};

const view = async (req, res, next) => {
  try {
    const { buffer, name, type } = await resumeService.getResumeFile(
      req.params.resumeId,
    );
    res.setHeader("Content-Type", type || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await resumeService.deleteResume(req.params.resumeId);
    return R.ok(res, { success: true });
  } catch (err) {
    next(err);
  }
};

const analyze = async (req, res, next) => {
  try {
    const analysis = await resumeService.analyzeResumeAI(req.params.resumeId);
    return R.ok(res, analysis);
  } catch (err) {
    // NOT_A_RESUME: Gemini confirmed the uploaded PDF is not a resume
    if (err.code === "NOT_A_RESUME") {
      return res.status(422).json({
        error: "NOT_A_RESUME",
        message:
          err.message ||
          "The uploaded document does not appear to be a resume or CV.",
      });
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const getAIFeedback = async (req, res, next) => {
  try {
    const feedback = await resumeService.getAIFeedback(req.params.resumeId);
    return R.ok(res, feedback);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

// ── Mentor ───────────────────────────────────────────────────────────────────

const mentorAISuggest = async (req, res, next) => {
  try {
    const suggestion = await resumeService.getMentorAISuggestion(
      req.params.resumeId,
      req.body.mentor_name,
      req.body.focus_area,
    );
    return R.ok(res, { suggestion });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const mentorOCR = async (req, res, next) => {
  try {
    const studentsResult = await InterviewModel.getAssignedStudents(
      req.params.id,
    );
    const data = await resumeService.getOCRForMentor(studentsResult.rows);
    return R.ok(res, data);
  } catch (err) {
    next(err);
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────

const adminOCR = async (req, res, next) => {
  try {
    const data = await resumeService.getOCRForAdmin();
    return R.ok(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  upload,
  list,
  view,
  remove,
  analyze,
  getAIFeedback,
  mentorAISuggest,
  mentorOCR,
  adminOCR,
};
