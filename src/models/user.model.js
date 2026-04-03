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

  delete: (id) =>
    pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]),

  updatePassword: (id, hashedPassword) =>
    pool.query("UPDATE users SET password = $1 WHERE id = $2 RETURNING id", [hashedPassword, id]),

  updateName: (id, name) =>
    pool.query("UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name", [name, id]),
};

module.exports = UserModel;