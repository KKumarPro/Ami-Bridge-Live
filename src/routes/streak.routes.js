"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/streak.controller");

router.get("/student/:id/streak", ctrl.getStreak);
router.post("/student/:id/streak", ctrl.updateStreak);

module.exports = router;
