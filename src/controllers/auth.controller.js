"use strict";

const authService = require("../services/auth.service");
const UserModel   = require("../models/user.model");
const bcrypt      = require("bcryptjs");
const { requireFields } = require("../utils/validator");
const R = require("../utils/response");

const register = async (req, res, next) => {
  try {
    const err = requireFields(req.body, ["name", "email", "password", "role"]);
    if (err) return R.badRequest(res, err);
    const user = await authService.register(
      req.body.name, req.body.email, req.body.password, req.body.role
    );
    return R.created(res, user);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const err = requireFields(req.body, ["email", "password"]);
    if (err) return R.badRequest(res, err);
    const user = await authService.login(req.body.email, req.body.password);
    return R.ok(res, user);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

// GET /api/auth/me  — return current user's profile (no password)
const getMe = async (req, res, next) => {
  try {
    const result = await UserModel.findById(req.user.id);
    if (result.rows.length === 0) return R.notFound(res, "User not found");
    return R.ok(res, result.rows[0]);
  } catch (err) { next(err); }
};

// PATCH /api/auth/me/name  { name }
const changeName = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return R.badRequest(res, "name is required");
    await UserModel.updateName(req.user.id, name.trim());
    return R.ok(res, { message: "Name updated successfully" });
  } catch (err) { next(err); }
};

// PATCH /api/auth/me/password  { current_password, new_password }
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return R.badRequest(res, "current_password and new_password are required");
    if (new_password.length < 6)
      return R.badRequest(res, "New password must be at least 6 characters");

    // Verify current password
    const result = await UserModel.findByEmail(req.user.email);
    if (result.rows.length === 0) return R.notFound(res, "User not found");
    const isMatch = await bcrypt.compare(current_password, result.rows[0].password);
    if (!isMatch) return R.badRequest(res, "Current password is incorrect");

    // Hash and save new password
    const salt   = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(new_password, salt);
    await UserModel.updatePassword(req.user.id, hashed);

    return R.ok(res, { message: "Password changed successfully" });
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe, changeName, changePassword };