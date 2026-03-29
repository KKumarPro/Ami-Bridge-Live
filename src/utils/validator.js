"use strict";

const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const isNonEmpty = (val) => val !== undefined && val !== null && String(val).trim() !== "";

const requireFields = (obj, fields) => {
  const missing = fields.filter((f) => !isNonEmpty(obj[f]));
  return missing.length ? `Missing required fields: ${missing.join(", ")}` : null;
};

module.exports = { isEmail, isNonEmpty, requireFields };
