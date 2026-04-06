"use strict";

require("dotenv").config();

const required = ["DATABASE_URL"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (
  !process.env.GROQ_API_KEY ||
  process.env.GROQ_API_KEY === "your_groq_api_key_here"
) {
  console.warn(
    "\n⚠️  WARNING: GROQ_API_KEY is not set. AI resume feedback will not work." +
      "\n   Get your free key at: https://console.groq.com" +
      "\n   Then add it to your .env file as: GROQ_API_KEY=your_key_here\n",
  );
}

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  JWT_SECRET: process.env.JWT_SECRET || "ami-bridge-secret-change-in-prod",
  NODE_ENV: process.env.NODE_ENV || "development",
};
