/**
 * Test with SMOOTH quality preset (120 FPS for ultra smooth animations)
 * Run: node test-smooth.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testSmooth() {
  console.log('Testing with SMOOTH quality preset...\n');

  const startTime = Date.now();

  try {
    console.log('URL: https://v0-educut-ai-platform.vercel.app/demo/finance');
    console.log('Duration: 15 seconds');
    console.log('Quality: smooth (1080p120 - ultra smooth animations)');
    console.log('Started at:', new Date().toLocaleTimeString());
    console.log('\nPlease wait...\n');
    
    const response = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://v0-educut-ai-platform.vercel.app/demo/finance',
      duration: 15,
      quality: 'smooth'  // 120 FPS for smooth animations
    });

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('CAPTURE COMPLETE\n');
    console.log('Total Time:', totalTime, 'seconds');
    console.log('Finished at:', new Date().toLocaleTimeString());
    console.log('\nVideo Details:');
    console.log('  Quality Preset:', response.data.data.quality);
    console.log('  Resolution:', response.data.data.resolution);
    console.log('  FPS:', response.data.data.fps, '(ultra smooth)');
    console.log('  File Size:', response.data.data.fileSize);
    console.log('\nVideo URL:');
    console.log('  ', `${API_URL}${response.data.data.videoUrl}`);
    console.log('\nCompare 120 FPS vs 60 FPS to see if animations are smoother!\n');

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

testSmooth();
