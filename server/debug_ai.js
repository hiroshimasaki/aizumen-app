require('dotenv').config();
const aiService = require('./src/services/aiService');

async function testAI() {
    console.log('--- AI Service Connectivity Test ---');
    try {
        const dummyBuffer = Buffer.from('Connectivity Test Content');
        const mimeType = 'text/plain';

        console.log('Sending request to Gemini...');
        const result = await aiService.analyzeDocument(dummyBuffer, mimeType);
        console.log('SUCCESS: API returned data correctly.');
        console.log('Result Preview:', JSON.stringify(result).substring(0, 100) + '...');
    } catch (err) {
        console.error('FAILED: Detailed Error Information:');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err);
        }
    }
}

testAI();
