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
  const { company_id, question_text, option_a, option_b, option_c, option_d, correct_answer } = data;
  if (!company_id || !question_text || !option_a || !option_b) {
    throw new Error("company_id, question_text, option_a, and option_b are required.");
  }
  const result = await InterviewModel.createQuestion(
    company_id,
    question_text,
    option_a,
    option_b,
    option_c ?? null,
    option_d ?? null,
    correct_answer ?? 0,
  );
  return result.rows[0];
};

module.exports = { getAllCompanies, createCompany, getQuestions, createQuestion };