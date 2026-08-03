"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/auth.controller");
const { validateRegister, validateLogin } = require("../validators/auth.validator");

router.post("/register", validateRegister, ctrl.register);
router.post("/login",    validateLogin,    ctrl.login);
router.post("/verify-email", ctrl.verifySignupOtp);
router.post("/resend-verification", ctrl.resendSignupOtp);
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password",  ctrl.resetPassword);

module.exports = router;
