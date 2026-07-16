const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const API_URL = 'http://localhost:3001';

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
  console.log('🧪 Starting validation tests for decoupled edit mode and timestamped merging on port 3001...\n');

  try {
    // 1. Submit Edit Mode job
    console.log('--- Step 1: Submit Edit Mode job (duration 5s, 2 segments) ---');
    const captureRes = await axios.post(`${API_URL}/api/capture`, {
      url: 'https://example.com',
      duration: 5,
      quality: 'superfast',
      options: {
        editMode: true
      },
      ttsSegments: [
        {
          timespamptStart: '00:00:00',
          TexttoTTS: 'This is the start of the edit mode video.'
        },
        {
          timespamptStart: '00:00:04',
          TexttoTTS: 'This is the second segment.'
        }
      ]
    });

    const jobId = captureRes.data.data.jobId;
    console.log(`Submitted Job ID: ${jobId}`);

    // 2. Poll status until completed
    const completedJob = await pollJob(jobId);
    console.log('\n--- Step 2: Edit mode capture finished! ---');
    console.log('Returned Video URL:', completedJob.videoUrl);
    console.log('Returned TTS segments count:', completedJob.ttsSegments.length);

    if (!completedJob.isMerged) {
      console.log('✅ PASS: Video and audio generated but not merged (isMerged is false/falsy).');
    } else {
      console.log('❌ FAIL: Video was merged prematurely.');
    }

    // 3. Perform final merge with new timings
    // We adjust the second segment to start at 7 seconds instead of 4 seconds.
    // The final video duration should extend to around 10-12 seconds because of the freeze frame.
    console.log('\n--- Step 3: Trigger Final Merge with adjusted timing ---');
    console.log('Adjusting Segment 2 start time to 00:00:07');
    const mergeSegments = completedJob.ttsSegments.map((seg, i) => {
      return {
        filename: seg.filename,
        timespamptStart: i === 1 ? '00:00:07' : '00:00:00'
      };
    });

    const mergeRes = await axios.post(`${API_URL}/api/capture/merge`, {
      jobId: jobId,
      ttsSegments: mergeSegments
    });

    console.log('Merge API Response Success:', mergeRes.data.success);
    const finalVideoUrl = mergeRes.data.data.videoUrl;
    console.log('Final Merged Video URL:', finalVideoUrl);

    // 4. Verify output duration
    console.log('\n--- Step 4: Verify final merged video duration ---');
    const videosDir = path.join(__dirname, '..', 'videos');
    const videoSource = finalVideoUrl.startsWith('http') ? finalVideoUrl : path.join(videosDir, path.basename(finalVideoUrl));
    
    console.log(`Checking duration of: ${videoSource}`);
    const duration = await getDuration(videoSource);
    console.log(`Final Video Duration: ${duration.toFixed(2)}s`);

    if (duration > 8.0) {
      console.log('✅ PASS: Video duration extended past initial 5s to fit the shifted 7s audio!');
    } else {
      console.log('❌ FAIL: Video duration was not extended correctly.');
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.data);
    } else {
      console.error('❌ Error occurred:', error.message);
    }
  }
}

runTests();
