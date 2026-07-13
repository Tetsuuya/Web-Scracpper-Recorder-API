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

    // Run capture and TTS in parallel (they're independent)
    metrics.captureStart = Date.now();
    metrics.ttsStart = Date.now();

    console.log(`🎬 Step 1/2: Capturing video and generating TTS in parallel...`);

    const capturePromise = captureService.captureWebsite({ url, duration, quality, options });
    const ttsPromise = script
      ? ttsService.generateAndDownloadSpeech(script, language, voice, `tts-${uuidv4()}.mp3`)
      : Promise.resolve(null);

    const [captureResult, audioPath] = await Promise.all([capturePromise, ttsPromise]);

    let finalVideoPath = captureResult.filePath;
    let mergeDuration = 0;

    // Merge only if TTS was generated
    if (audioPath) {
      metrics.mergeStart = Date.now();
      console.log(`🎵 Step 2/2: Merging video and audio...`);

      const mergedFilename = `capture-${uuidv4()}.mp4`;
      const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
      const mergedPath = path.join(__dirname, '..', outputDir, mergedFilename);

      finalVideoPath = await mergeService.mergeVideoAudio(captureResult.filePath, audioPath, mergedPath);

      mergeDuration = (Date.now() - metrics.mergeStart) / 1000;

      // Clean up temp files
      try {
        fs.unlinkSync(captureResult.filePath);
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
        capture: ((metrics.ttsStart || Date.now()) - metrics.captureStart) / 1000,
        tts: script ? (audioPath ? (metrics.mergeStart ? (metrics.mergeStart - metrics.ttsStart) / 1000 : (Date.now() - metrics.ttsStart) / 1000) : 0) : 0,
        merge: mergeDuration
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