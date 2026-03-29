"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("./env");

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

/**
 * Returns a Gemini model instance.
 * @param {string} modelName
 * @param {object} generationConfig
 */
const getModel = (modelName = "gemini-1.5-flash-latest", generationConfig = {}) => {
  return genAI.getGenerativeModel({ model: modelName, generationConfig });
};

module.exports = { genAI, getModel };
