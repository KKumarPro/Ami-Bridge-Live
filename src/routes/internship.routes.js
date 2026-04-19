"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/internship.controller");

router.get("/internships", ctrl.getAll);
router.post("/internships", ctrl.create);
router.put("/internships/:id", ctrl.update);
router.delete("/internships/:id", ctrl.remove);

module.exports = router;
