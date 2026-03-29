"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/company.controller");
const { validateCreateCompany } = require("../validators/company.validator");

router.get( "/companies",  ctrl.getAll);
router.post("/companies",  validateCreateCompany, ctrl.create);

module.exports = router;
