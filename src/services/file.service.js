"use strict";

const { extractTextFromPDF } = require("../utils/parser");

/**
 * Convert an uploaded multer file buffer to base64
 * and extract any text content from it.
 *
 * @param {object} file  - multer file object (buffer, originalname, mimetype)
 * @param {string|number} studentId
 * @returns {{ base64: string, filePath: string, text: string }}
 */
const processUploadedFile = async (file, studentId) => {
  const base64   = file.buffer.toString("base64");
  const filePath = "db://resumes/" + studentId + "/" + Date.now() + "_" + file.originalname;
  const text     = await extractTextFromPDF(file.buffer);
  return { base64, filePath, text };
};

/**
 * Convert a base64 string back to a Buffer ready for streaming.
 *
 * @param {string} base64
 * @returns {Buffer}
 */
const base64ToBuffer = (base64) => Buffer.from(base64, "base64");

module.exports = { processUploadedFile, base64ToBuffer };
