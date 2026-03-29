"use strict";

const logger = require("./logger");

/**
 * Attempt to extract raw text from a PDF buffer.
 * Returns empty string if extraction fails (e.g. scanned / image PDF).
 * Gemini Vision will handle those cases instead.
 *
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
const extractTextFromPDF = async (buffer) => {
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err) {
    logger.warn("[Parser] pdf-parse failed (non-fatal):", err.message);
    return "";
  }
};

module.exports = { extractTextFromPDF };
