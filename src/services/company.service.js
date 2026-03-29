"use strict";

const CompanyModel  = require("../models/company.model");
const InterviewModel = require("../models/interview.model");

const getAllCompanies = async () => {
  const result = await CompanyModel.getAll();
  return result.rows;
};

const createCompany = async (data) => {
  const { company_name, description, icon_class, bg_color, text_color } = data;
  const result = await CompanyModel.create(company_name, description, icon_class, bg_color, text_color);
  return result.rows[0];
};

const getQuestions = async (companyId) => {
  const result = await InterviewModel.getQuestionsByCompany(companyId);
  return result.rows;
};

module.exports = { getAllCompanies, createCompany, getQuestions };
