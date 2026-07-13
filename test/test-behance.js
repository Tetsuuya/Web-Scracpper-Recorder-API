/**
 * Test script for Behance (high-resolution design showcase)
 * Tests video quality with crisp graphics and fine details
 * Run: node test-behance.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testBehance() {
  console.log('🎨 Testing Behance capture (high-resolution design site)...\n');
  console.log('This will test:');
  console.log('  ✅ Image sharpness and clarity');
  console.log('  ✅ Text readability');
  console.log('  ✅ Color accuracy');
  console.log('  ✅ Fine details in designs\n');

  try {
    console.log('📹 Capturing Behance with auto-scroll (30 seconds at 1080p60)');
    
    const response = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://www.behance.net/',
      duration: 30,
      options: {
        width: 1920,
        height: 1080,
        fps: 60,
        autoScroll: true
      }
    });

    console.log('\n✅ Capture Complete!');
    console.log('\n📊 Video Details:');
    console.log('  Job ID:', response.data.data.jobId);
    console.log('  Filename:', response.data.data.filename);
    console.log('  File Size:', response.data.data.fileSize);
    console.log('  Resolution:', response.data.data.resolution);
    console.log('  FPS:', response.data.data.fps);
    console.log('  Status:', response.data.data.status);

    console.log(`\n📹 Watch the video:`);
    console.log(`   ${API_URL}${response.data.data.videoUrl}`);
    console.log(`\n📂 File location:`);
    console.log(`   Backend/videos/${response.data.data.filename}`);

    console.log('\n🔍 Quality Check - Look for:');
    console.log('  1. Can you read small text clearly?');
    console.log('  2. Are design details sharp (not blurry)?');
    console.log('  3. Are colors accurate and vibrant?');
    console.log('  4. No pixelation or compression artifacts?');
    console.log('  5. Smooth scrolling without stuttering?');

    console.log('\n💡 If all 5 points look good = HIGH QUALITY! ✅\n');

  } catch (error) {
    if (error.response) {
      console.error('\n❌ API Error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Server not running!');
      console.error('   Start it with: npm start');
    } else {
      console.error('\n❌ Error:', error.message);
    }
  }
}

testBehance();
