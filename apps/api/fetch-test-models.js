const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf-8');
const match = envFile.match(/GEMINI_API_KEY=(.+)/);
const key = match[1].replace(/['"`]/g, '').trim();

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error("API Error:", data.error.message);
  } else {
    console.log("Available models:");
    data.models.forEach(m => console.log(m.name));
  }
})
.catch(console.error);
