"use strict";

const router = require("express").Router();
const ctrl   = require("../controllers/auth.controller");
const { validateRegister, validateLogin } = require("../validators/auth.validator");
const { authenticate } = require("../middlewares/auth.middleware");

router.post("/register", validateRegister, ctrl.register);
router.post("/login",    validateLogin,    ctrl.login);

// Authenticated user — get own profile and change password
router.get( "/me",              authenticate, ctrl.getMe);
router.patch("/me/password",    authenticate, ctrl.changePassword);
router.patch("/me/name",        authenticate, ctrl.changeName);

module.exports = router;