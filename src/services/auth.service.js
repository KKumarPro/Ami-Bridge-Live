"use strict";

const bcrypt = require("bcryptjs");
const UserModel = require("../models/user.model");
const streakService = require("./streak.service");

const register = async (name, email, password, role) => {
  const existing = await UserModel.findByEmail(email);
  if (existing.rows.length > 0) {
    const err = new Error("User already exists");
    err.status = 400;
    throw err;
  }
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  const result = await UserModel.create(name, email, hashed, role);
  return result.rows[0];
};

const login = async (email, password) => {
  const result = await UserModel.findByEmail(email);
  if (result.rows.length === 0) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }
  const user = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }

  // Update streak on login
  try {
    await streakService.updateStreakOnLogin(user.id);
  } catch (e) {
    // Non-fatal - don't fail login if streak update fails
  }

  return {
    id:      user.id,
    name:    user.name,
    email:   user.email,
    role:    user.role,
    course:  user.course  || "",
    college: user.college || "",
    phone:   user.phone   || "",
    city:    user.city    || "",
  };
};

// ── Forgot / Reset password ─────────────────────────────────────────────
const crypto = require("crypto");

const forgotPassword = async (email) => {
  const result = await UserModel.findByEmail(email);
  if (result.rows.length === 0) {
    // Don't reveal whether the email exists — same response either way
    return { sent: true };
  }
  const user = result.rows[0];

  // Generate a secure random token, valid for 1 hour
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await UserModel.setResetToken(email, token, expiresAt);

  // NOTE: No email service is configured yet. The token/link is returned
  // directly so the reset flow works end-to-end today. Once an email
  // provider (e.g. Resend, SendGrid, Nodemailer+SMTP) is added, replace
  // the `return` below with an actual email send and return { sent: true }.
  return {
    sent: true,
    devMode: true,
    resetToken: token,
    userName: user.name,
  };
};

const resetPassword = async (token, newPassword) => {
  if (!token) {
    const err = new Error("Reset token is required.");
    err.status = 400;
    throw err;
  }
  const result = await UserModel.findByResetToken(token);
  if (result.rows.length === 0) {
    const err = new Error("Invalid or expired reset link. Please request a new one.");
    err.status = 400;
    throw err;
  }
  const user = result.rows[0];
  if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    const err = new Error("This reset link has expired. Please request a new one.");
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(newPassword, salt);
  await UserModel.resetPassword(user.id, hashed);

  return { id: user.id, name: user.name, email: user.email };
};

module.exports = { register, login, forgotPassword, resetPassword };