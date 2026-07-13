const express = require('express');
const router = express.Router();
const { validateCaptureRequest } = require('../utils/validation');
const captureService = require('../services/captureService');
const ttsService = require('../services/ttsService');
const mergeService = require('../services/mergeService');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/capture
 * Capture a video of a website with optional TTS audio overlay
 *
 * Body:
 * {
 *   "url": "https://example.com",
 *   "duration": 30,
 *   "quality": "fast",
 *   "script": "Welcome to our website...",       // Optional - generates TTS
 *   "language": "en-US",                         // Optional - TTS language
 *   "voice": "male-foundation",                  // Optional - TTS voice
 *   "options": {
 *     "width": 1920,
 *     "height": 1080,
 *     "fps": 60
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    // Validate request
    const { error, value } = validateCaptureRequest(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { url, duration, quality, script, language, voice, options } = value;

    console.log(`📹 New capture request: ${url} for ${duration}s`);
    if (script) {
      console.log(`🎵 TTS enabled: language=${language}, voice=${voice}`);
    }

    const metrics = {
      startTime: Date.now(),
      captureStart: null,
      ttsStart: null,
      mergeStart: null
    };

    // Step 1: Capture website video
    metrics.captureStart = Date.now();
    console.log(`🎬 Step 1/3: Capturing video...`);
    let videoPath = await captureService.captureWebsite({ url, duration, quality, options });

    let finalVideoPath = videoPath;
    let audioPath = null;

    // Step 2: Generate TTS audio if script provided
    if (script) {
      metrics.ttsStart = Date.now();
      console.log(`🎵 Step 2/3: Generating TTS audio...`);

      const audioFilename = `tts-${uuidv4()}.mp3`;
      audioPath = await ttsService.generateAndDownloadSpeech(script, language, voice, audioFilename);

      // Step 3: Merge video and audio
      metrics.mergeStart = Date.now();
      console.log(`🔧 Step 3/3: Merging video and audio...`);

      const mergedFilename = `capture-${uuidv4()}.mp4`;
      const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
      const mergedPath = path.join(__dirname, '..', outputDir, mergedFilename);

      finalVideoPath = await mergeService.mergeVideoAudio(videoPath, audioPath, mergedPath);

      // Clean up temp files
      try {
        fs.unlinkSync(videoPath);
        fs.unlinkSync(audioPath);
        console.log(`🗑️ Cleaned up temporary files`);
      } catch (cleanupErr) {
        console.warn(`⚠️ Failed to cleanup temp files: ${cleanupErr.message}`);
      }
    }

    const totalDuration = (Date.now() - metrics.startTime) / 1000;

    // Log performance metrics
    const logEntry = {
      timestamp: new Date().toISOString(),
      url,
      duration,
      quality,
      hasTTS: !!script,
      metrics: {
        total: totalDuration.toFixed(2),
        capture: metrics.captureStart ? ((metrics.ttsStart || metrics.mergeStart || Date.now()) - metrics.captureStart) / 1000 : 0,
        tts: metrics.ttsStart ? ((metrics.mergeStart || Date.now()) - metrics.ttsStart) / 1000 : 0,
        merge: metrics.mergeStart ? (Date.now() - metrics.mergeStart) / 1000 : 0
      }
    };
    console.log(`📊 Performance:`, logEntry);

    res.json({
      success: true,
      message: script ? 'Video captured with TTS audio' : 'Video captured successfully',
      data: {
        videoUrl: `/videos/${path.basename(finalVideoPath)}`,
        duration: totalDuration,
        hasTTS: !!script,
        metrics: logEntry.metrics
      }
    });

  } catch (err) {
    console.error('❌ Capture error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to capture video',
      message: err.message
    });
  }
});

module.exports = router;
