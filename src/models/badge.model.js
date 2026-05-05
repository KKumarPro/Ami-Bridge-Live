"use strict";

const { pool } = require("../config/db");

const BadgeModel = {
  getAllBadgeTypes: () =>
    pool.query(
      `SELECT badge_id, name, description, icon, color, criteria, earned_count 
       FROM badge_types ORDER BY badge_id`,
    ),

  getUserBadges: (userId) =>
    pool.query(
      `SELECT bt.badge_id, bt.name, bt.description, bt.icon, bt.color, ub.earned_date
       FROM user_badges ub
       JOIN badge_types bt ON ub.badge_id = bt.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_date DESC`,
      [userId],
    ),

  awardBadge: (userId, badgeId) =>
    pool.query(
      `INSERT INTO user_badges (user_id, badge_id, earned_date)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, badge_id) DO NOTHING
       RETURNING *`,
      [userId, badgeId],
    ),

  checkBadgeExists: (userId, badgeId) =>
    pool.query(
      `SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2`,
      [userId, badgeId],
    ),

  getCurrentBadge: (userId) =>
    pool.query(
      `SELECT bt.badge_id, bt.name, bt.description, bt.icon, bt.color
       FROM user_badges ub
       JOIN badge_types bt ON ub.badge_id = bt.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.earned_date DESC
       LIMIT 1`,
      [userId],
    ),
};

module.exports = BadgeModel;
