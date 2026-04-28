"use strict";

/**
 * Convert an uploaded multer file buffer to base64
 * and generate a virtual storage path.
 *
 * @param {object} file  - multer file object (buffer, originalname, mimetype)
 * @param {string|number} studentId
 * @returns {{ base64: string, filePath: string }}
 */
const processUploadedFile = async (file, studentId) => {
  const base64   = file.buffer.toString("base64");
  const filePath = "db://resumes/" + studentId + "/" + Date.now() + "_" + file.originalname;
  return { base64, filePath };
};

/**
 * Convert a base64 string back to a Buffer ready for streaming.
 *
 * @param {string} base64
 * @returns {Buffer}
 */
const base64ToBuffer = (base64) => Buffer.from(base64, "base64");

module.exports = { processUploadedFile, base64ToBuffer };
