"use strict";

const streakService = require("../services/streak.service");
const R = require("../utils/response");

const getStreak = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const streak = await streakService.getStreakInfo(userId);
    return R.ok(res, streak);
  } catch (err) {
    next(err);
  }
};

const updateStreak = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const streak = await streakService.updateStreakOnLogin(userId);
    return R.ok(res, streak);
  } catch (err) {
    next(err);
  }
};

module.exports = { getStreak, updateStreak };
