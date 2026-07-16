const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const API_URL = 'http://localhost:3000';

async function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath
    ]);

    let stdout = '';
    ffprobe.stdout.on('data', (data) => { stdout += data.toString(); });
    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          resolve(parseFloat(info.format.duration));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}`));
      }
    });
  });
}

async function pollJob(jobId) {
  console.log(`Polling job status for ${jobId}...`);
  while (true) {
    const response = await axios.get(`${API_URL}/api/capture/status/${jobId}`);
    const job = response.data.data;
    if (job.status === 'completed') {
      return job;
    }
    if (job.status === 'failed') {
      throw new Error(`Job ${jobId} failed: ${job.error}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function runTests() {
  console.log('🧪 Starting validation tests for freeze-frame and minimum duration...\n');

  try {
    // Test 1: Video duration 10s, Audio is short (~3s)
    // Expectation: Video output should be exactly 10s.
    console.log('--- Test 1: Video duration 10s, Audio is short (~3s) ---');
    const res1 = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://example.com',
      duration: 10,
      quality: 'superfast',
      script: 'Hello, this is a very short test message.'
    });
    const jobId1 = res1.data.data.jobId;
    console.log(`Submitted Job ID: ${jobId1}`);

    // Test 2: Video duration 5s, Audio is longer (~12s)
    // Expectation: Video output should be ~12s (matching audio), with the last 7s frozen.
    console.log('\n--- Test 2: Video duration 5s, Audio is longer (~12s) ---');
    const res2 = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://example.com',
      duration: 5,
      quality: 'superfast',
      script: 'This is a significantly longer message that should take more than five seconds to speak. We want to test if the video will freeze-frame at the end of the 5-second capture while the audio continues playing to the end of this sentence.'
    });
    const jobId2 = res2.data.data.jobId;
    console.log(`Submitted Job ID: ${jobId2}`);

    // Wait for completion
    const job1 = await pollJob(jobId1);
    const job2 = await pollJob(jobId2);

    console.log('\n--- Verification ---');
    
    // Resolve source (remote URL or local path)
    const videosDir = path.join(__dirname, '..', 'videos');
    const videoSource1 = job1.videoUrl.startsWith('http') ? job1.videoUrl : path.join(videosDir, job1.filename);
    const videoSource2 = job2.videoUrl.startsWith('http') ? job2.videoUrl : path.join(videosDir, job2.filename);

    console.log(`Verifying durations using ffprobe on sources:`);
    console.log(`  Source 1: ${videoSource1}`);
    console.log(`  Source 2: ${videoSource2}`);

    const duration1 = await getDuration(videoSource1);
    const duration2 = await getDuration(videoSource2);

    console.log(`Test 1 output file: ${job1.filename}`);
    console.log(`  Expected Duration: >= 10s (minimum duration)`);
    console.log(`  Actual Duration: ${duration1.toFixed(2)}s`);
    if (Math.abs(duration1 - 10) <= 2.0) {
      console.log('  ✅ PASS: Output video duration matches minimum duration.');
    } else {
      console.log('  ❌ FAIL: Output video duration is incorrect.');
    }

    console.log(`\nTest 2 output file: ${job2.filename}`);
    console.log(`  Expected Duration: > 10s (matching the long speech duration)`);
    console.log(`  Actual Duration: ${duration2.toFixed(2)}s`);
    if (duration2 > 10) {
      console.log('  ✅ PASS: Video duration extended to match the longer audio.');
    } else {
      console.log('  ❌ FAIL: Video was not extended.');
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running. Start with "npm start" first.');
    } else {
      console.error('❌ Error occurred:', error.message);
    }
  }
}

runTests();
