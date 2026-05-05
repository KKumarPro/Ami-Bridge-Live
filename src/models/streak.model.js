"use strict";

const { pool } = require("../config/db");

const StreakModel = {
  findByUserId: (userId) =>
    pool.query(
      `SELECT current_streak, longest_streak, last_login_date, streak_reset_date 
       FROM user_streaks WHERE user_id = $1`,
      [userId],
    ),

  createStreak: (userId) =>
    pool.query(
      `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_login_date, streak_reset_date)
       VALUES ($1, 1, 1, NOW(), NOW())
       RETURNING *`,
      [userId],
    ),

  updateStreak: (userId, currentStreak, longestStreak, lastLoginDate) =>
    pool.query(
      `UPDATE user_streaks 
       SET current_streak = $1, longest_streak = $2, last_login_date = $3
       WHERE user_id = $4
       RETURNING *`,
      [currentStreak, longestStreak, lastLoginDate, userId],
    ),

  resetStreak: (userId) =>
    pool.query(
      `UPDATE user_streaks 
       SET current_streak = 0, streak_reset_date = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId],
    ),
};

module.exports = StreakModel;
