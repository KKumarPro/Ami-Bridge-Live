"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/badge.controller");

router.get("/student/:id/badges", ctrl.getUserBadges);
router.get("/student/:id/badge-current", ctrl.getCurrentBadge);

module.exports = router;
