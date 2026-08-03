"use strict";

const { pool } = require("../config/db");

const UserModel = {
  findByEmail: (email) =>
    pool.query(
      `SELECT id, name, email, password, role, course, college, phone, city,
              email_verified, verified_at, verification_otp, verification_otp_expires,
              reset_token_expires
       FROM users WHERE email = $1`,
      [email]
    ),

  findById: (id) =>
    pool.query(
      `SELECT id, name, email, role, course, college, phone, city, email_verified,
              verified_at, created_at
       FROM users WHERE id = $1`,
      [id]
    ),

  create: (name, email, hashedPassword, role) =>
    pool.query(
      `INSERT INTO users (name, email, password, role, email_verified)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, name, email, role, email_verified`,
      [name, email, hashedPassword, role]
    ),

  getAll: () =>
    pool.query(
      `SELECT id, name, email, role, course, college, phone, city, email_verified,
              verified_at, created_at
       FROM users ORDER BY created_at DESC`
    ),

  updateProfile: (id, name, course, college, phone, city) =>
    pool.query(
      `UPDATE users
       SET name    = $1,
           course  = $2,
           college = $3,
           phone   = $4,
           city    = $5
       WHERE id = $6
       RETURNING id, name, email, role, course, college, phone, city, created_at`,
      [name, course || null, college || null, phone || null, city || null, id]
    ),

  // ── Password reset ──────────────────────────────────────────────────
  setResetToken: (email, token, expiresAt) =>
    pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2
       WHERE email = $3 RETURNING id, name, email`,
      [token, expiresAt, email]
    ),

  findByResetToken: (token) =>
    pool.query(
      `SELECT id, name, email, reset_token_expires FROM users
       WHERE reset_token = $1`,
      [token]
    ),

  resetPassword: (id, hashedPassword) =>
    pool.query(
      `UPDATE users
       SET password = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2 RETURNING id, name, email`,
      [hashedPassword, id]
    ),

  setVerificationOtp: (email, hashedOtp, expiresAt) =>
    pool.query(
      `UPDATE users
       SET verification_otp = $1, verification_otp_expires = $2
       WHERE email = $3
       RETURNING id, name, email, role, email_verified`,
      [hashedOtp, expiresAt, email]
    ),

  findByVerificationEmail: (email) =>
    pool.query(
      `SELECT id, name, email, role, email_verified, verification_otp, verification_otp_expires
       FROM users WHERE email = $1`,
      [email]
    ),

  verifyEmail: (id) =>
    pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           verified_at = NOW(),
           verification_otp = NULL,
           verification_otp_expires = NULL
       WHERE id = $1
       RETURNING id, name, email, role, email_verified, verified_at`,
      [id]
    ),

  clearVerificationOtp: (id) =>
    pool.query(
      `UPDATE users
       SET verification_otp = NULL,
           verification_otp_expires = NULL
       WHERE id = $1`,
      [id]
    ),
};

module.exports = UserModel;
