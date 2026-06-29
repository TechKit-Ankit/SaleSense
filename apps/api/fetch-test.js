const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const key = match[1].replace(/['"`]/g, '').trim();

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'Say exactly: API IS WORKING' }] }] })
})
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error("API Error:", data.error.message);
  } else {
    console.log("Success! Output:", data.candidates[0].content.parts[0].text);
  }
})
.catch(console.error);
