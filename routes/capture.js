const express = require('express');
const router = express.Router();
const { validateCaptureRequest, validateMergeRequest } = require('../utils/validation');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const queueService = require('../services/queueService');

/**
 * POST /api/capture/merge
 * Fast merge for decoupled jobs
 */
router.post('/merge', async (req, res) => {
  try {
    const { error, value } = validateMergeRequest(req.body);

    if (error) {
      const errorMessages = error.details.map(d => d.message);
      logger.warn(`Validation failure on merge request: ${errorMessages.join(', ')}`, { body: req.body });
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errorMessages
      });
    }

    logger.info(`Starting merge for job: ${value.jobId}`);
    const mergeResult = await queueService.mergeJob(value.jobId, value.ttsSegments);

    res.json({
      success: true,
      message: 'Video and audio segments merged successfully',
      data: mergeResult
    });

  } catch (err) {
    logger.error(`Merge request failed: ${err.message}`, { body: req.body, stack: err.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to merge video and audio segments',
      message: err.message
    });
  }
});

/**
 * POST /api/capture
 * Enqueue a new capture job
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
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

    // Queue the job
    const jobInfo = await queueService.createJob(value);

    res.status(202).json({
      success: true,
      message: 'Capture job enqueued successfully',
      data: jobInfo
    });

  } catch (err) {
    logger.error(`Failed to enqueue capture job: ${err.message}`, { body: req.body, stack: err.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to enqueue capture job',
      message: err.message
    });
  }
});

/**
 * GET /api/capture/status/:jobId
 * Check status of a queued job
 */
router.get('/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await queueService.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found',
      message: `No capture job found with ID: ${jobId}`
    });
  }

  res.json({
    success: true,
    data: job
  });
});

/**
 * GET /api/capture/download/:jobId
 * Download the completed video file for a job
 */
router.get('/download/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await queueService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        message: `No capture job found with ID: ${jobId}`
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Job not completed',
        message: `Job is currently in status: ${job.status}. Download is only available for completed jobs.`
      });
    }

    // If it's a Cloudflare R2 public URL, redirect the client to download/stream directly from R2
    if (job.videoUrl && job.videoUrl.startsWith('http')) {
      return res.redirect(job.videoUrl);
    }

    const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
    const videoPath = path.join(__dirname, '..', outputDir, job.filename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The requested video file does not exist on disk or has been cleaned up'
      });
    }

    res.download(videoPath, job.filename);
  } catch (err) {
    logger.error(`Download failed: ${err.message}`, { stack: err.stack });
    res.status(500).json({
      success: false,
      error: 'Internal server error during file download'
    });
  }
});

module.exports = router;