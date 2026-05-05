"use strict";

const badgeService = require("../services/badge.service");
const R = require("../utils/response");

const getUserBadges = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const badges = await badgeService.getUserBadges(userId);
    return R.ok(res, badges);
  } catch (err) {
    next(err);
  }
};

const getCurrentBadge = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const badge = await badgeService.getCurrentBadge(userId);
    return R.ok(res, badge || {});
  } catch (err) {
    next(err);
  }
};

module.exports = { getUserBadges, getCurrentBadge };
