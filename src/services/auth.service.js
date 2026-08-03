"use strict";

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const UserModel = require("../models/user.model");
const streakService = require("./streak.service");
const emailService = require("./email.service");

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
  const user = result.rows[0];

  const otp = String(crypto.randomInt(100000, 999999));
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await UserModel.setVerificationOtp(email, hashedOtp, expiresAt);

  const emailResult = await emailService.sendVerificationEmail({
    to: user.email,
    name: user.name,
    otp,
  });

  return {
    ...user,
    verificationRequired: true,
    emailSent: emailResult.sent,
    emailDevMode: emailResult.devMode || false,
  };
};

const login = async (email, password) => {
  const result = await UserModel.findByEmail(email);
  if (result.rows.length === 0) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }

  const user = result.rows[0];
  if (!user.email_verified) {
    const err = new Error("Please verify your email before signing in.");
    err.status = 403;
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }

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

const verifySignupOtp = async (email, otp) => {
  const result = await UserModel.findByVerificationEmail(email);
  if (result.rows.length === 0) {
    const err = new Error("No account found for that email.");
    err.status = 404;
    throw err;
  }

  const user = result.rows[0];
  if (user.email_verified) {
    return { id: user.id, name: user.name, email: user.email, verified: true };
  }

  if (!user.verification_otp || !user.verification_otp_expires) {
    const err = new Error("Verification code expired. Please resend a new one.");
    err.status = 400;
    throw err;
  }

  if (new Date(user.verification_otp_expires) < new Date()) {
    const err = new Error("Verification code expired. Please resend a new one.");
    err.status = 400;
    throw err;
  }

  const ok = await bcrypt.compare(String(otp).trim(), user.verification_otp);
  if (!ok) {
    const err = new Error("Invalid verification code.");
    err.status = 400;
    throw err;
  }

  const verified = await UserModel.verifyEmail(user.id);
  return {
    id: verified.rows[0].id,
    name: verified.rows[0].name,
    email: verified.rows[0].email,
    verified: true,
  };
};

const resendSignupOtp = async (email) => {
  const result = await UserModel.findByVerificationEmail(email);
  if (result.rows.length === 0) {
    const err = new Error("No account found for that email.");
    err.status = 404;
    throw err;
  }

  const user = result.rows[0];
  if (user.email_verified) {
    return { sent: false, alreadyVerified: true, verified: true };
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await UserModel.setVerificationOtp(email, hashedOtp, expiresAt);

  const emailResult = await emailService.sendVerificationEmail({
    to: user.email,
    name: user.name,
    otp,
  });

  return {
    sent: true,
    emailSent: emailResult.sent,
    devMode: emailResult.devMode || false,
    otp: emailResult.devMode ? otp : undefined,
    expiresInMinutes: 10,
  };
};

const forgotPassword = async (email, options = {}) => {
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

  const emailResult = await emailService.sendResetEmail({
    to: user.email,
    name: user.name,
    token,
    baseUrl: options.baseUrl,
  });

  return {
    sent: true,
    emailSent: emailResult.sent,
    devMode: emailResult.devMode || false,
    resetToken: emailResult.devMode ? token : undefined,
    resetLink: emailResult.resetLink,
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

module.exports = {
  register,
  login,
  verifySignupOtp,
  resendSignupOtp,
  forgotPassword,
  resetPassword,
};
