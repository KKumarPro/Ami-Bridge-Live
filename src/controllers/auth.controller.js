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

module.exports = { register, login };
