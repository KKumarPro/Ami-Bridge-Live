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

const createQuestion = async (data) => {
  const { company_id, question_text, options, correct_index } = data;
  if (!company_id || !question_text || !Array.isArray(options) || options.length < 2) {
    throw new Error("company_id, question_text, and at least 2 options are required.");
  }
  const result = await InterviewModel.createQuestion(company_id, question_text, options, correct_index ?? 0);
  return result.rows[0];
};

module.exports = { getAllCompanies, createCompany, getQuestions, createQuestion };