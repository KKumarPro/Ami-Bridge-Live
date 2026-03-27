const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getGeminiResponse = async (text) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `
    Analyze this resume:

    Give:
    - Strengths
    - Weaknesses
    - Improvements

    Resume:
    ${text}
    `;

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
};

module.exports = { getGeminiResponse };
