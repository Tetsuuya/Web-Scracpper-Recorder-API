const express = require('express');
const router = express.Router();
const { validateCaptureRequest } = require('../utils/validation');
const captureService = require('../services/captureService');
const ttsService = require('../services/ttsService');
const mergeService = require('../services/mergeService');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

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
  const startTime = Date.now();
  const requestMetrics = {
    captureStart: null,
    captureEnd: null,
    ttsStart: null,
    ttsEnd: null,
    mergeStart: null,
    mergeEnd: null
  };

  try {
    // Validate request
    const { error, value } = validateCaptureRequest(req.body);

    if (error) {
      const errorMessages = error.details.map(d => d.message);
      logger.warn(`Validation failure on capture request: ${errorMessages.join(', ')}`, { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errorMessages
      });
    }

    const { url, duration, quality, script, language, voice, options } = value;

    logger.info(`New capture request: ${url} for ${duration}s (quality=${quality}, tts=${!!script})`);
    if (script) {
      logger.info(`TTS parameters: language=${language}, voice=${voice}`);
    }

    // Run capture and TTS in parallel
    requestMetrics.captureStart = Date.now();
    requestMetrics.ttsStart = Date.now();

    logger.info(`Step 1/2: Capturing video and generating TTS in parallel...`);

    const capturePromise = captureService.captureWebsite({ url, duration, quality, options })
      .then(result => {
        requestMetrics.captureEnd = Date.now();
        return result;
      });

    const ttsPromise = script
      ? ttsService.generateAndDownloadSpeech(script, language, voice, `tts-${uuidv4()}.mp3`)
          .then(result => {
            requestMetrics.ttsEnd = Date.now();
            return result;
          })
      : Promise.resolve(null);

    const [captureResult, audioPath] = await Promise.all([capturePromise, ttsPromise]);

    let finalVideoPath = captureResult.filePath;
    let mergeDuration = 0;

    // Merge only if TTS was generated
    if (audioPath) {
      requestMetrics.mergeStart = Date.now();
      logger.info(`Step 2/2: Merging video and audio...`);

      const mergedFilename = `capture-${uuidv4()}.mp4`;
      const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
      const mergedPath = path.join(__dirname, '..', outputDir, mergedFilename);

      finalVideoPath = await mergeService.mergeVideoAudio(captureResult.filePath, audioPath, mergedPath);
      requestMetrics.mergeEnd = Date.now();
      mergeDuration = (requestMetrics.mergeEnd - requestMetrics.mergeStart) / 1000;

      // Clean up temp files
      try {
        fs.unlinkSync(captureResult.filePath);
        fs.unlinkSync(audioPath);
        logger.info(`Cleaned up temporary files`);
      } catch (cleanupErr) {
        logger.warn(`Failed to cleanup temp files: ${cleanupErr.message}`);
      }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    const captureDuration = requestMetrics.captureEnd ? (requestMetrics.captureEnd - requestMetrics.captureStart) / 1000 : 0;
    const ttsDuration = (script && requestMetrics.ttsEnd) ? (requestMetrics.ttsEnd - requestMetrics.ttsStart) / 1000 : 0;

    // Gather process memory usage
    const memUsage = process.memoryUsage();
    const logEntry = {
      url,
      duration,
      quality,
      hasTTS: !!script,
      metrics: {
        total_duration: parseFloat(totalDuration.toFixed(2)),
        capture_duration: parseFloat(captureDuration.toFixed(2)),
        tts_duration: parseFloat(ttsDuration.toFixed(2)),
        merge_duration: parseFloat(mergeDuration.toFixed(2)),
        memory_usage: {
          heapUsed: `${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
          heapTotal: `${(memUsage.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
          rss: `${(memUsage.rss / (1024 * 1024)).toFixed(2)} MB`
        }
      }
    };

    logger.info(`Capture request completed successfully: ${url}`, logEntry);

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
    const totalDuration = (Date.now() - startTime) / 1000;
    const memUsage = process.memoryUsage();
    
    logger.error(`Capture request failed: ${err.message}`, {
      url: req.body.url,
      duration: req.body.duration,
      metrics: {
        total_duration: parseFloat(totalDuration.toFixed(2)),
        memory_usage: {
          heapUsed: `${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
          rss: `${(memUsage.rss / (1024 * 1024)).toFixed(2)} MB`
        }
      },
      stack: err.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to capture video',
      message: err.message
    });
  }
});

module.exports = router;