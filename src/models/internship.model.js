"use strict";

const { pool } = require("../config/db");

const InternshipModel = {
  getAll: () =>
    pool.query(`SELECT * FROM internships ORDER BY created_at DESC`),

  getById: (id) =>
    pool.query(`SELECT * FROM internships WHERE internship_id = $1`, [id]),

  create: (data) =>
    pool.query(
      `INSERT INTO internships
         (company_name, role, location, type, stipend, duration, description, requirements, apply_contact, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.company_name,
        data.role,
        data.location,
        data.type, // "paid" | "unpaid"
        data.stipend || null,
        data.duration,
        data.description,
        data.requirements || null,
        data.apply_contact,
        true,
      ],
    ),

  update: (id, data) =>
    pool.query(
      `UPDATE internships
       SET company_name  = $1,
           role          = $2,
           location      = $3,
           type          = $4,
           stipend       = $5,
           duration      = $6,
           description   = $7,
           requirements  = $8,
           apply_contact = $9,
           is_active     = $10
       WHERE internship_id = $11
       RETURNING *`,
      [
        data.company_name,
        data.role,
        data.location,
        data.type,
        data.stipend || null,
        data.duration,
        data.description,
        data.requirements || null,
        data.apply_contact,
        data.is_active !== false,
        id,
      ],
    ),

  remove: (id) =>
    pool.query(`DELETE FROM internships WHERE internship_id = $1`, [id]),
};

module.exports = InternshipModel;
