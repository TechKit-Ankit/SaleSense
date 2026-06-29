const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const envFile = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
if (!match) {
  console.error("Key not found in .env");
  process.exit(1);
}

const key = match[1].replace(/['"`]/g, '').trim();

async function run() {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  try {
    const result = await model.generateContent('Say exactly: API IS WORKING');
    const response = await result.response;
    console.log(response.text());
  } catch (e) {
    console.error("AI Error:", e.message);
  }
}
run();
