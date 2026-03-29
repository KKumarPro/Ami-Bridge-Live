"use strict";

const validateCreateCompany = (req, res, next) => {
  const { company_name } = req.body;
  if (!company_name || !company_name.trim())
    return res.status(400).json({ error: "company_name is required" });
  next();
};

module.exports = { validateCreateCompany };
