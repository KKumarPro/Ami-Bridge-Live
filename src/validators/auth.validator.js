"use strict";

const { isEmail } = require("../utils/validator");

const validateRegister = (req, res, next) => {
  const { name, email, password, role } = req.body;
  const validRoles = ["student", "mentor", "admin"];

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: "All fields are required: name, email, password, role" });
  if (!isEmail(email))
    return res.status(400).json({ error: "Invalid email format" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (!validRoles.includes(role))
    return res.status(400).json({ error: "Role must be one of: " + validRoles.join(", ") });

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  if (!isEmail(email))
    return res.status(400).json({ error: "Invalid email format" });
  next();
};

module.exports = { validateRegister, validateLogin };
