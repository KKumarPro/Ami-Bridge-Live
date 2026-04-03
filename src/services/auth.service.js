"use strict";

const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const UserModel = require("../models/user.model");
const env       = require("../config/env");

const EXPIRES_IN = "7d";

const signToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );

const register = async (name, email, password, role) => {
  const existing = await UserModel.findByEmail(email);
  if (existing.rows.length > 0) {
    const err = new Error("User already exists");
    err.status = 400;
    throw err;
  }
  const salt   = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  const result = await UserModel.create(name, email, hashed, role);
  const user   = result.rows[0];
  return { ...user, token: signToken(user) };
};

const login = async (email, password) => {
  const result = await UserModel.findByEmail(email);
  if (result.rows.length === 0) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }
  const user    = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  return { ...payload, token: signToken(payload) };
};

module.exports = { register, login };