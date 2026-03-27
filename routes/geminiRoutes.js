const express = require("express");
const router = express.Router();

const { getGeminiResponse } = require("../services/geminiService");

router.post("/analyze", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const result = await getGeminiResponse(text);

    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gemini failed" });
  }
});

module.exports = router;
