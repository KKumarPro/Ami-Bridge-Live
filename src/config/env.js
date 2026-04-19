"use strict";

require("dotenv").config();

const required = ["DATABASE_URL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

if (!process.env.GROQ_API_KEY) {
  console.warn(
    "\n⚠️  GROQ_API_KEY not set — AI text analysis will not work.\n   Get free key: https://console.groq.com\n",
  );
}

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "\n⚠️  GEMINI_API_KEY not set — image/scanned PDF analysis will not work.\n   Get free key: https://aistudio.google.com/\n",
  );
}

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  JWT_SECRET: process.env.JWT_SECRET || "ami-bridge-secret-change-in-prod",
  NODE_ENV: process.env.NODE_ENV || "development",
};
