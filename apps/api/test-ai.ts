import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function testAi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No API key found in .env');
    process.exit(1);
  }

  console.log('Testing Gemini API with the provided key...');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say exactly: "API IS WORKING!"');
    const response = await result.response;
    console.log('Response from Gemini:', response.text());
    console.log('✅ AI integration is fully functional!');
  } catch (error) {
    console.error('❌ Failed to connect to Gemini API:', error);
  }
}

testAi();
