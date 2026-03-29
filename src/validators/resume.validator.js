"use strict";

const validateResumeUpload = (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "A PDF file is required" });
  const allowed = ["application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if (!allowed.includes(req.file.mimetype))
    return res.status(400).json({ error: "Only PDF and Word documents are allowed" });
  if (req.file.size > 5 * 1024 * 1024)
    return res.status(400).json({ error: "File too large. Maximum 5MB." });
  next();
};

module.exports = { validateResumeUpload };
