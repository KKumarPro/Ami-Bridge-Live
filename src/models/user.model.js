"use strict";

const { pool } = require("../config/db");

const UserModel = {
  findByEmail: (email) =>
    pool.query(
      "SELECT id, name, email, password, role, course, college, phone, city FROM users WHERE email = $1",
      [email]
    ),

  findById: (id) =>
    pool.query(
      "SELECT id, name, email, role, course, college, phone, city, created_at FROM users WHERE id = $1",
      [id]
    ),

  create: (name, email, hashedPassword, role) =>
    pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name, email, hashedPassword, role]
    ),

  getAll: () =>
    pool.query(
      "SELECT id, name, email, role, course, college, phone, city, created_at FROM users ORDER BY created_at DESC"
    ),

  updateProfile: (id, name, course, college, phone, city) =>
    pool.query(
      `UPDATE users
       SET name    = $1,
           course  = $2,
           college = $3,
           phone   = $4,
           city    = $5
       WHERE id = $6
       RETURNING id, name, email, role, course, college, phone, city, created_at`,
      [name, course || null, college || null, phone || null, city || null, id]
    ),
};

module.exports = UserModel;