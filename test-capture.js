/**
 * Test script for video capture
 * Run: node test-capture.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testCapture() {
  console.log('🧪 Testing video capture...\n');

  try {
    // Test 1: Simple website
    console.log('Test 1: Capturing example.com (10 seconds)');
    const response1 = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://example.com',
      duration: 10
    });
    console.log('✅ Success:', response1.data);
    console.log(`📹 Video URL: ${API_URL}${response1.data.data.videoUrl}\n`);

    // Test 2: With auto-scroll
    console.log('Test 2: Capturing with auto-scroll (15 seconds)');
    const response2 = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://patatap.com/?utm_source=chatgpt.com',
      duration: 15,
      options: {
        width: 1920,
        height: 1080,
        fps: 60,
        autoScroll: true
      }
    });
    console.log('✅ Success:', response2.data);
    console.log(`📹 Video URL: ${API_URL}${response2.data.data.videoUrl}\n`);

    // Test 3: With custom interactions
    console.log('Test 3: Capturing with custom interactions (20 seconds)');
    const response3 = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://www.google.com',
      duration: 20,
      interactions: [
        { action: 'wait', time: 2000 },
        { action: 'scroll', amount: 300, delay: 1000 },
        { action: 'scroll', amount: 300, delay: 1000 },
        { action: 'scroll', amount: -600, delay: 1000 }
      ]
    });
    console.log('✅ Success:', response3.data);
    console.log(`📹 Video URL: ${API_URL}${response3.data.data.videoUrl}\n`);

    console.log('🎉 All tests passed!');
    console.log('\n📂 Check the videos folder for output files');

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running. Start it with: npm start');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testCapture();
