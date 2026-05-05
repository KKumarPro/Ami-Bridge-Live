"use strict";

const StreakModel = require("../models/streak.model");
const logger = require("../utils/logger");

/**
 * Check if user has logged in today and update streak accordingly
 */
const updateStreakOnLogin = async (userId) => {
  try {
    const result = await StreakModel.findByUserId(userId);

    if (result.rows.length === 0) {
      // First login ever - create new streak
      const created = await StreakModel.createStreak(userId);
      return created.rows[0];
    }

    const streak = result.rows[0];
    const lastLogin = new Date(streak.last_login_date);
    const today = new Date();

    // Reset time components for comparison
    lastLogin.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - lastLogin) / (1000 * 60 * 60 * 24));

    let newCurrent = streak.current_streak;
    let newLongest = streak.longest_streak;

    if (daysDiff === 0) {
      // Already logged in today - no change
      return streak;
    } else if (daysDiff === 1) {
      // Consecutive day - increment
      newCurrent += 1;
      newLongest = Math.max(newCurrent, newLongest);
    } else {
      // Gap > 1 day - reset streak
      newCurrent = 1;
    }

    const updated = await StreakModel.updateStreak(
      userId,
      newCurrent,
      newLongest,
      new Date(),
    );
    logger.info(
      `[Streak] User ${userId}: streak=${newCurrent}, longest=${newLongest}`,
    );

    return updated.rows[0];
  } catch (err) {
    logger.error(`[Streak] Update failed for user ${userId}: ${err.message}`);
    throw err;
  }
};

/**
 * Get user's current streak info
 */
const getStreakInfo = async (userId) => {
  const result = await StreakModel.findByUserId(userId);
  if (result.rows.length === 0) {
    return { current_streak: 0, longest_streak: 0, last_login_date: null };
  }
  return result.rows[0];
};

module.exports = { updateStreakOnLogin, getStreakInfo };
