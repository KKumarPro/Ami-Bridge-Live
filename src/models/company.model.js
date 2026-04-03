"use strict";

const { pool } = require("../config/db");

const CompanyModel = {
  getAll: () =>
    pool.query("SELECT * FROM companies ORDER BY created_at DESC"),

  create: (company_name, description, icon_class, bg_color, text_color) =>
    pool.query(
      `INSERT INTO companies (company_name, description, icon_class, bg_color, text_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [company_name, description, icon_class, bg_color, text_color]
    ),

  delete: (company_id) =>
    pool.query("DELETE FROM companies WHERE company_id = $1 RETURNING company_id", [company_id]),
};

module.exports = CompanyModel;