"use strict";

const InternshipModel = require("../models/internship.model");
const { pool } = require("../config/db");
const R = require("../utils/response");

// ── Ensure table exists (auto-migration on first request) ────────────────────
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS internships (
      internship_id  SERIAL PRIMARY KEY,
      company_name   TEXT        NOT NULL,
      role           TEXT        NOT NULL,
      location       TEXT        NOT NULL,
      type           TEXT        NOT NULL DEFAULT 'unpaid',
      stipend        TEXT,
      duration       TEXT        NOT NULL,
      description    TEXT        NOT NULL,
      requirements   TEXT,
      apply_contact  TEXT        NOT NULL,
      is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const getAll = async (req, res, next) => {
  try {
    await ensureTable();
    const result = await InternshipModel.getAll();
    return R.ok(res, result.rows);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      company_name,
      role,
      location,
      type,
      stipend,
      duration,
      description,
      requirements,
      apply_contact,
    } = req.body;
    if (
      !company_name ||
      !role ||
      !location ||
      !duration ||
      !description ||
      !apply_contact
    ) {
      return R.badRequest(
        res,
        "Missing required fields: company_name, role, location, duration, description, apply_contact",
      );
    }
    const result = await InternshipModel.create(req.body);
    return R.created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      role,
      location,
      duration,
      description,
      apply_contact,
    } = req.body;
    if (
      !company_name ||
      !role ||
      !location ||
      !duration ||
      !description ||
      !apply_contact
    ) {
      return R.badRequest(res, "Missing required fields");
    }
    const result = await InternshipModel.update(id, req.body);
    if (result.rows.length === 0)
      return R.notFound(res, "Internship not found");
    return R.ok(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await InternshipModel.remove(req.params.id);
    return R.ok(res, { success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, create, update, remove };
