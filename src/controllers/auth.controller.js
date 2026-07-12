"use strict";

const authService = require("../services/auth.service");
const { requireFields } = require("../utils/validator");
const R = require("../utils/response");

const register = async (req, res, next) => {
  try {
    const err = requireFields(req.body, ["name", "email", "password", "role"]);
    if (err) return R.badRequest(res, err);
    const user = await authService.register(
      req.body.name,
      req.body.email,
      req.body.password,
      req.body.role,
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

    // Get streak info
    const streakService = require("../services/streak.service");
    try {
      const streak = await streakService.getStreakInfo(user.id);
      user.streak = streak;
    } catch (e) {
      // Non-fatal
    }

    return R.ok(res, user);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const err = requireFields(req.body, ["email"]);
    if (err) return R.badRequest(res, err);
    const result = await authService.forgotPassword(req.body.email);
    return R.ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const err = requireFields(req.body, ["token", "password"]);
    if (err) return R.badRequest(res, err);
    if (req.body.password.length < 6) {
      return R.badRequest(res, "Password must be at least 6 characters");
    }
    const result = await authService.resetPassword(req.body.token, req.body.password);
    return R.ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

module.exports = { register, login, forgotPassword, resetPassword };