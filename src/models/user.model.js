"use strict";

const { pool } = require("../config/db");

const UserModel = {
  findByEmail: (email) =>
    pool.query("SELECT * FROM users WHERE email = $1", [email]),

  findById: (id) =>
    pool.query("SELECT id, name, email, role, created_at FROM users WHERE id = $1", [id]),

  create: (name, email, hashedPassword, role) =>
    pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, hashedPassword, role]
    ),

  getAll: () =>
    pool.query("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"),
};

module.exports = UserModel;
