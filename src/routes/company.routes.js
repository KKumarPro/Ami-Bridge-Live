"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/company.controller");
const { validateCreateCompany } = require("../validators/company.validator");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");

router.get( "/companies",           ctrl.getAll);                                                     // public — students need this on login page
router.post("/companies",           authenticate, requireRole("admin"), validateCreateCompany, ctrl.create);

module.exports = router;