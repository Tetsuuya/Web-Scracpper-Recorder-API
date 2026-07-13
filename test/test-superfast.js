/**
 * Test SUPERFAST quality (720p24 - quick testing)
 * Run: node test-superfast.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testSuperFast() {
  console.log('Testing SUPERFAST quality (720p24)...\n');
  console.log('This should be much faster!\n');

  const startTime = Date.now();

  try {
    console.log('URL: https://v0-educut-ai-platform.vercel.app/demo/finance');
    console.log('Duration: 15 seconds');
    console.log('Quality: superfast (720p24)');
    console.log('Started at:', new Date().toLocaleTimeString());
    console.log('\nPlease wait...\n');

    const response = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://v0-educut-ai-platform.vercel.app/demo/finance',
      duration: 15,
      quality: 'superfast'
    });

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('CAPTURE COMPLETE\n');
    console.log('Total Time:', totalTime, 'seconds');
    console.log('Finished at:', new Date().toLocaleTimeString());
    console.log('\nVideo Details:');
    console.log('  Quality:', response.data.data.quality);
    console.log('  Resolution:', response.data.data.resolution);
    console.log('  FPS:', response.data.data.fps);
    console.log('  File Size:', response.data.data.fileSize);
    console.log('\nVideo URL:');
    console.log('  ', `${API_URL}${response.data.data.videoUrl}`);
    console.log('\nWas it faster? Compare time to smooth/120fps!\n');

  } catch (error) {
    if (error.response) {
      console.error('\nAPI Error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\nServer not running. Start with: npm start');
    } else {
      console.error('\nError:', error.message);
    }
  }
}

testSuperFast();