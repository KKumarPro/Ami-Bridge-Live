"use strict";

const companyService = require("../services/company.service");
const R = require("../utils/response");

const getAll = async (req, res, next) => {
  try {
    const companies = await companyService.getAllCompanies();
    return R.ok(res, companies);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const company = await companyService.createCompany(req.body);
    return R.created(res, company);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, create };
