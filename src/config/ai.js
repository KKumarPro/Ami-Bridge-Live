"use strict";

// Groq client configuration
// Previously this file configured the Google Gemini SDK.
// It now configures the Groq SDK used for all AI features.

const Groq = require("groq-sdk");
const env = require("./env");

let _client = null;

/**
 * Returns a singleton Groq client instance.
 */
const getGroqClient = () => {
  if (!_client) _client = new Groq({ apiKey: env.GROQ_API_KEY });
  return _client;
};

module.exports = { getGroqClient };
