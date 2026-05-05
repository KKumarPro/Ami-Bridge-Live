"use strict";

const BadgeModel = require("../models/badge.model");
const logger = require("../utils/logger");

// Badge IDs for auto-award logic
const BADGES = {
  PROFILE_STARTER: 1, // First profile view
  PROFILE_COMPLETE: 2, // Profile 50% complete
  RESUME_UPLOADED: 3, // First resume upload
  RESUME_SCORE_50: 4, // Resume score >= 50
  RESUME_SCORE_75: 5, // Resume score >= 75
  RESUME_SCORE_90: 6, // Resume score >= 90
  QUIZ_STARTER: 7, // First quiz attempt
  QUIZ_5_ATTEMPTS: 8, // 5 quiz attempts
  QUIZ_10_ATTEMPTS: 9, // 10 quiz attempts
  CONSISTENCY_7: 10, // 7-day streak
  CONSISTENCY_30: 11, // 30-day streak
  INTERVIEW_READY: 12, // Mentor assigned
};

/**
 * Auto-award badges based on resume score
 */
const awardResumeScoreBadges = async (userId, score) => {
  try {
    const awarded = [];

    if (score >= 50) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.RESUME_SCORE_50,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.RESUME_SCORE_50);
        awarded.push({ id: BADGES.RESUME_SCORE_50, name: "Resume Score 50+" });
        logger.info(`[Badge] Awarded RESUME_SCORE_50 to user ${userId}`);
      }
    }

    if (score >= 75) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.RESUME_SCORE_75,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.RESUME_SCORE_75);
        awarded.push({ id: BADGES.RESUME_SCORE_75, name: "Resume Score 75+" });
        logger.info(`[Badge] Awarded RESUME_SCORE_75 to user ${userId}`);
      }
    }

    if (score >= 90) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.RESUME_SCORE_90,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.RESUME_SCORE_90);
        awarded.push({ id: BADGES.RESUME_SCORE_90, name: "Resume Score 90+" });
        logger.info(`[Badge] Awarded RESUME_SCORE_90 to user ${userId}`);
      }
    }

    return awarded;
  } catch (err) {
    logger.error(`[Badge] Resume score awards failed: ${err.message}`);
    return [];
  }
};

/**
 * Auto-award badges on quiz attempt
 */
const awardQuizBadges = async (userId, totalAttempts) => {
  try {
    const awarded = [];

    if (totalAttempts === 1) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.QUIZ_STARTER,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.QUIZ_STARTER);
        awarded.push({ id: BADGES.QUIZ_STARTER, name: "Quiz Starter" });
        logger.info(`[Badge] Awarded QUIZ_STARTER to user ${userId}`);
      }
    }

    if (totalAttempts === 5) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.QUIZ_5_ATTEMPTS,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.QUIZ_5_ATTEMPTS);
        awarded.push({ id: BADGES.QUIZ_5_ATTEMPTS, name: "5 Attempts Done" });
        logger.info(`[Badge] Awarded QUIZ_5_ATTEMPTS to user ${userId}`);
      }
    }

    if (totalAttempts === 10) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.QUIZ_10_ATTEMPTS,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.QUIZ_10_ATTEMPTS);
        awarded.push({ id: BADGES.QUIZ_10_ATTEMPTS, name: "10 Attempts Done" });
        logger.info(`[Badge] Awarded QUIZ_10_ATTEMPTS to user ${userId}`);
      }
    }

    return awarded;
  } catch (err) {
    logger.error(`[Badge] Quiz awards failed: ${err.message}`);
    return [];
  }
};

/**
 * Auto-award streak badges
 */
const awardStreakBadges = async (userId, currentStreak) => {
  try {
    const awarded = [];

    if (currentStreak === 7) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.CONSISTENCY_7,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.CONSISTENCY_7);
        awarded.push({ id: BADGES.CONSISTENCY_7, name: "7-Day Streak" });
        logger.info(`[Badge] Awarded CONSISTENCY_7 to user ${userId}`);
      }
    }

    if (currentStreak === 30) {
      const exists = await BadgeModel.checkBadgeExists(
        userId,
        BADGES.CONSISTENCY_30,
      );
      if (exists.rows.length === 0) {
        await BadgeModel.awardBadge(userId, BADGES.CONSISTENCY_30);
        awarded.push({ id: BADGES.CONSISTENCY_30, name: "30-Day Streak" });
        logger.info(`[Badge] Awarded CONSISTENCY_30 to user ${userId}`);
      }
    }

    return awarded;
  } catch (err) {
    logger.error(`[Badge] Streak awards failed: ${err.message}`);
    return [];
  }
};

/**
 * Get all earned badges for a user
 */
const getUserBadges = async (userId) => {
  const result = await BadgeModel.getUserBadges(userId);
  return result.rows;
};

/**
 * Get current/latest badge
 */
const getCurrentBadge = async (userId) => {
  const result = await BadgeModel.getCurrentBadge(userId);
  return result.rows.length > 0 ? result.rows[0] : null;
};

module.exports = {
  awardResumeScoreBadges,
  awardQuizBadges,
  awardStreakBadges,
  getUserBadges,
  getCurrentBadge,
};
