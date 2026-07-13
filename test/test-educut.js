/**
 * Test EduCut AI Platform capture
 * Run: node test-educut.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testEduCut() {
  console.log('Testing EduCut AI Platform capture...\n');

  const startTime = Date.now();

  try {
    console.log('URL: https://v0-educut-ai-platform.vercel.app/demo/finance');
    console.log('Duration: 30 seconds');
    console.log('Resolution: 1920x1080');
    console.log('FPS: 60');
    console.log('Started at:', new Date().toLocaleTimeString());
    console.log('\nPlease wait...\n');
    
    const response = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://v0-educut-ai-platform.vercel.app/demo/finance',
      duration: 30,
      options: {
        width: 1920,
        height: 1080,
        fps: 60
      }
    });

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('CAPTURE COMPLETE\n');
    console.log('Total Time:', totalTime, 'seconds');
    console.log('Finished at:', new Date().toLocaleTimeString());
    console.log('\nVideo Details:');
    console.log('  Job ID:', response.data.data.jobId);
    console.log('  Filename:', response.data.data.filename);
    console.log('  File Size:', response.data.data.fileSize);
    console.log('  Resolution:', response.data.data.resolution);
    console.log('  FPS:', response.data.data.fps);
    console.log('\nVideo URL:');
    console.log('  ', `${API_URL}${response.data.data.videoUrl}`);
    console.log('\nFile Location:');
    console.log('  ', `Backend/videos/${response.data.data.filename}`);
    console.log('\n');

  } catch (error) {
    if (error.response) {
      console.error('\nAPI Error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\nServer not running. Start it with: npm start');
    } else {
      console.error('\nError:', error.message);
    }
  }
}

testEduCut();
