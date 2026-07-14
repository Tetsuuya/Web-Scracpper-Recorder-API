const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const captureService = require('./captureService');
const ttsService = require('./ttsService');
const mergeService = require('./mergeService');
const logger = require('../utils/logger');

// Queue internal state
const queue = [];
const jobs = new Map();
let isProcessing = false;

/**
 * Create a new background capture job and add it to the queue
 * @param {Object} params - The request body parameters
 * @returns {Object} - The created job object
 */
function createJob(params) {
  const jobId = uuidv4();
  
  const job = {
    id: jobId,
    status: 'pending',
    params: {
      url: params.url,
      duration: params.duration,
      quality: params.quality || 'high',
      script: params.script || null,
      language: params.language || 'en-US',
      voice: params.voice || 'male-foundation',
      options: params.options || {}
    },
    error: null,
    videoUrl: null,
    filename: null,
    metrics: null,
    created_at: new Date(),
    started_at: null,
    completed_at: null
  };

  jobs.set(jobId, job);
  queue.push(jobId);
  logger.info(`Job ${jobId} queued (status: pending). Queue length: ${queue.length}`);
  
  // Start queue processing asynchronously
  processQueue();

  return {
    jobId: job.id,
    status: job.status,
    created_at: job.created_at
  };
}

/**
 * Get job status and details
 * @param {string} jobId - The job ID
 * @returns {Object|null} - The job object or null if not found
 */
function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  
  // Return a user-friendly copy of the job status
  return {
    jobId: job.id,
    status: job.status,
    error: job.error,
    videoUrl: job.videoUrl,
    filename: job.filename,
    metrics: job.metrics,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at
  };
}

/**
 * Process the next job in the queue sequentially
 */
async function processQueue() {
  if (isProcessing) {
    return;
  }
  
  if (queue.length === 0) {
    return;
  }

  isProcessing = true;
  const jobId = queue.shift();
  const job = jobs.get(jobId);

  if (!job) {
    isProcessing = false;
    processQueue();
    return;
  }

  logger.info(`Starting execution of job ${jobId}`);
  job.status = 'processing';
  job.started_at = new Date();

  const startTime = Date.now();
  let audioPath = null;
  let tempVideoPath = null;
  
  const metrics = {
    total_duration: 0,
    capture_duration: 0,
    tts_duration: 0,
    merge_duration: 0,
    memory_usage: null
  };

  try {
    let finalDuration = job.params.duration;

    // Step 1: TTS Generation (if script is provided)
    if (job.params.script) {
      logger.info(`Job ${jobId} [Step 1/3]: Generating TTS Voice-Over...`);
      const ttsStart = Date.now();
      
      const audioFilename = `tts-${uuidv4()}.mp3`;
      audioPath = await ttsService.generateAndDownloadSpeech(
        job.params.script, 
        job.params.language, 
        job.params.voice,
        audioFilename
      );
      
      metrics.tts_duration = parseFloat(((Date.now() - ttsStart) / 1000).toFixed(2));
      logger.info(`Job ${jobId}: TTS generated in ${metrics.tts_duration}s. File: ${audioPath}`);

      // Measure audio duration using ffprobe
      const audioDuration = await mergeService.getVideoDuration(audioPath);
      logger.info(`Job ${jobId}: Measured audio duration: ${audioDuration.toFixed(2)}s`);

      // If audio is longer than requested duration, dynamically extend video capture length
      if (audioDuration > finalDuration) {
        const originalDuration = finalDuration;
        finalDuration = Math.ceil(audioDuration);
        logger.info(`Job ${jobId}: Adjusting capture duration from ${originalDuration}s to ${finalDuration}s to fit voice-over`);
      }
    }

    // Step 2: Capture Website as Video
    logger.info(`Job ${jobId} [Step 2/3]: Capturing website recording...`);
    const captureStart = Date.now();
    
    const captureResult = await captureService.captureWebsite({
      url: job.params.url,
      duration: finalDuration,
      quality: job.params.quality,
      options: job.params.options
    });
    
    tempVideoPath = captureResult.filePath;
    metrics.capture_duration = parseFloat(((Date.now() - captureStart) / 1000).toFixed(2));
    logger.info(`Job ${jobId}: Website capture completed in ${metrics.capture_duration}s. File: ${tempVideoPath}`);

    // Step 3: Merge video and audio (if audio exists)
    if (audioPath) {
      logger.info(`Job ${jobId} [Step 3/3]: Merging video and audio tracks...`);
      const mergeStart = Date.now();

      const mergedFilename = `capture-${uuidv4()}.mp4`;
      const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
      const mergedPath = path.join(__dirname, '..', outputDir, mergedFilename);

      const finalVideoPath = await mergeService.mergeVideoAudio(tempVideoPath, audioPath, mergedPath);
      metrics.merge_duration = parseFloat(((Date.now() - mergeStart) / 1000).toFixed(2));
      logger.info(`Job ${jobId}: Merge completed in ${metrics.merge_duration}s. File: ${finalVideoPath}`);

      // Save public URL
      job.videoUrl = `/videos/${mergedFilename}`;
      job.filename = mergedFilename;

      // Clean up temp files
      try {
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        logger.info(`Job ${jobId}: Cleaned up temporary video and audio tracks`);
      } catch (cleanupErr) {
        logger.warn(`Job ${jobId}: Failed to cleanup temporary files: ${cleanupErr.message}`);
      }
    } else {
      // No TTS: direct public URL of captured video
      const finalFilename = path.basename(tempVideoPath);
      job.videoUrl = `/videos/${finalFilename}`;
      job.filename = finalFilename;
      logger.info(`Job ${jobId} [Step 3/3]: No audio merge needed. Finished.`);
    }

    // Success Status Update
    const totalTime = (Date.now() - startTime) / 1000;
    metrics.total_duration = parseFloat(totalTime.toFixed(2));

    const memUsage = process.memoryUsage();
    metrics.memory_usage = {
      heapUsed: `${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
      rss: `${(memUsage.rss / (1024 * 1024)).toFixed(2)} MB`
    };

    job.status = 'completed';
    job.metrics = metrics;
    job.completed_at = new Date();
    
    logger.info(`Job ${jobId} completed successfully in ${metrics.total_duration}s!`);

  } catch (error) {
    // Failure Status Update
    logger.error(`Job ${jobId} failed: ${error.message}`, { stack: error.stack });
    
    job.status = 'failed';
    job.error = error.message;
    job.completed_at = new Date();

    // Clean up any remaining temp files on failure
    try {
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (tempVideoPath && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
    } catch (cleanupErr) {
      logger.warn(`Job ${jobId}: Failed to cleanup temp files on error: ${cleanupErr.message}`);
    }
  } finally {
    isProcessing = false;
    // Schedule check for next job
    setTimeout(processQueue, 100);
  }
}

module.exports = {
  createJob,
  getJob
};
