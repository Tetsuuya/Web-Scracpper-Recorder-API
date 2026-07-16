const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const captureService = require('./captureService');
const ttsService = require('./ttsService');
const mergeService = require('./mergeService');
const { parseTimestamp } = require('./mergeService');
const logger = require('../utils/logger');
const db = require('../config/firebase');
const r2 = require('../config/r2');

/**
 * Downloads a file if it is an HTTP link and not present locally
 */
async function ensureLocalFile(urlOrPath, localPath) {
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  if (urlOrPath && urlOrPath.startsWith('http')) {
    logger.info(`Downloading file from R2: ${urlOrPath} -> ${localPath}`);
    const response = await axios({
      method: 'GET',
      url: urlOrPath,
      responseType: 'stream'
    });
    
    // Ensure parent directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(localPath));
      writer.on('error', reject);
    });
  }
  throw new Error(`Local file not found and URL is invalid: ${urlOrPath}`);
}

// Queue internal state
const queue = [];
const jobs = new Map();
let isProcessing = false;

/**
 * Helper to update job state in both local map and Firestore
 * @param {string} jobId 
 * @param {Object} updates 
 */
async function updateJobState(jobId, updates) {
  const localJob = jobs.get(jobId);
  if (localJob) {
    Object.assign(localJob, updates);
  }
  if (db) {
    try {
      await db.collection('jobs').doc(jobId).update(updates);
      logger.info(`Job ${jobId} state updated in Firestore: ${JSON.stringify(updates)}`);
    } catch (error) {
      logger.error(`Failed to update job ${jobId} in Firestore: ${error.message}`);
    }
  }
}

/**
 * Create a new background capture job and add it to the queue
 * @param {Object} params - The request body parameters
 * @returns {Promise<Object>} - The created job object
 */
async function createJob(params) {
  const jobId = uuidv4();
  
  const job = {
    id: jobId,
    status: 'pending',
    params: {
      url: params.url,
      duration: params.duration,
      quality: params.quality || 'high',
      script: params.script || null,
      ttsSegments: params.ttsSegments || [],
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

  if (db) {
    try {
      await db.collection('jobs').doc(jobId).set(job);
      logger.info(`Job ${jobId} saved to Firestore.`);
    } catch (error) {
      logger.error(`Failed to save job ${jobId} to Firestore: ${error.message}`);
    }
  }

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
 * @returns {Promise<Object|null>} - The job object or null if not found
 */
async function getJob(jobId) {
  if (db) {
    try {
      const doc = await db.collection('jobs').doc(jobId).get();
      if (doc.exists) {
        const data = doc.data();
        const convertTimestamp = (val) => val && typeof val.toDate === 'function' ? val.toDate() : val;
        return {
          jobId: data.id,
          status: data.status,
          error: data.error,
          videoUrl: data.videoUrl,
          filename: data.filename,
          ttsSegments: data.ttsSegments || [],
          isMerged: !!data.isMerged,
          metrics: data.metrics,
          created_at: convertTimestamp(data.created_at),
          started_at: convertTimestamp(data.started_at),
          completed_at: convertTimestamp(data.completed_at)
        };
      }
    } catch (error) {
      logger.error(`Failed to get job ${jobId} from Firestore: ${error.message}`);
    }
  }

  const job = jobs.get(jobId);
  if (!job) return null;
  
  // Return a user-friendly copy of the job status
  return {
    jobId: job.id,
    status: job.status,
    error: job.error,
    videoUrl: job.videoUrl,
    filename: job.filename,
    ttsSegments: job.ttsSegments || [],
    isMerged: !!job.isMerged,
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
  
  let job = jobs.get(jobId);
  if (!job && db) {
    try {
      const doc = await db.collection('jobs').doc(jobId).get();
      if (doc.exists) {
        job = doc.data();
      }
    } catch (e) {
      logger.error(`Error loading job ${jobId} from Firestore: ${e.message}`);
    }
  }

  if (!job) {
    isProcessing = false;
    processQueue();
    return;
  }

  logger.info(`Starting execution of job ${jobId}`);
  const startedAt = new Date();
  await updateJobState(jobId, {
    status: 'processing',
    started_at: startedAt
  });
  job.status = 'processing';
  job.started_at = startedAt;

  const startTime = Date.now();
  let audioSegments = [];
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

    // Step 1: TTS Generation (either segments list or single script)
    const hasSegments = job.params.ttsSegments && job.params.ttsSegments.length > 0;
    const hasScript = !!job.params.script;

    if (hasSegments || hasScript) {
      logger.info(`Job ${jobId} [Step 1/3]: Generating TTS Voice-Over segments...`);
      const ttsStart = Date.now();

      if (hasSegments) {
        for (let i = 0; i < job.params.ttsSegments.length; i++) {
          const seg = job.params.ttsSegments[i];
          const text = seg.TexttoTTS;
          const startTimeOffset = parseTimestamp(seg.timespamptStart);
          
          const audioFilename = `tts-${uuidv4()}-seg-${i}.mp3`;
          const audioPath = await ttsService.generateAndDownloadSpeech(
            text, 
            job.params.language, 
            job.params.voice,
            audioFilename
          );
          
          audioSegments.push({
            audioPath,
            startTime: startTimeOffset,
            TexttoTTS: text,
            timespamptStart: seg.timespamptStart,
            filename: audioFilename,
            audioUrl: null
          });
        }
      } else {
        // Fallback to legacy single script
        const audioFilename = `tts-${uuidv4()}.mp3`;
        const audioPath = await ttsService.generateAndDownloadSpeech(
          job.params.script, 
          job.params.language, 
          job.params.voice,
          audioFilename
        );
        
        audioSegments.push({
          audioPath,
          startTime: 0,
          TexttoTTS: job.params.script,
          timespamptStart: "00:00:00",
          filename: audioFilename,
          audioUrl: null
        });
      }

      metrics.tts_duration = parseFloat(((Date.now() - ttsStart) / 1000).toFixed(2));
      logger.info(`Job ${jobId}: TTS segments generated in ${metrics.tts_duration}s. Count: ${audioSegments.length}`);

      // Upload audio segments to R2 if editMode is true
      if (job.params.options.editMode && r2.s3Client) {
        for (const seg of audioSegments) {
          try {
            logger.info(`Job ${jobId}: Uploading segment to R2: ${seg.audioPath}`);
            const r2Url = await r2.uploadFile(seg.audioPath, seg.filename);
            seg.audioUrl = r2Url;
          } catch (uploadErr) {
            logger.error(`Job ${jobId}: R2 upload of segment failed: ${uploadErr.message}`);
          }
        }
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

    // Step 3: Handle Merge or EditMode separation
    let videoUrl = `/videos/${path.basename(tempVideoPath)}`;
    let filename = path.basename(tempVideoPath);

    if (job.params.options.editMode) {
      logger.info(`Job ${jobId} [Step 3/3]: EditMode is enabled. Skipping immediate audio merge.`);
      
      // Upload silent video to R2
      if (r2.s3Client) {
        try {
          logger.info(`Job ${jobId}: Uploading raw silent video to Cloudflare R2...`);
          const r2Url = await r2.uploadFile(tempVideoPath, filename);
          videoUrl = r2Url;
          
          if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
            logger.info(`Job ${jobId}: Deleted local raw silent video after uploading to R2`);
          }
        } catch (uploadErr) {
          logger.error(`Job ${jobId}: R2 upload of raw video failed: ${uploadErr.message}`);
        }
      }

      // Save segment list with public URLs to the job state
      job.ttsSegments = audioSegments.map(seg => ({
        timespamptStart: seg.timespamptStart,
        TexttoTTS: seg.TexttoTTS,
        filename: seg.filename,
        audioUrl: seg.audioUrl || `/audio/${seg.filename}`
      }));
      job.videoUrl = videoUrl;
      job.filename = filename;

      // Clean up local segment audio files since they are saved/uploaded
      for (const seg of audioSegments) {
        try {
          if (fs.existsSync(seg.audioPath)) {
            fs.unlinkSync(seg.audioPath);
          }
        } catch (cleanupErr) {
          logger.warn(`Job ${jobId}: Failed to cleanup segment audio file: ${cleanupErr.message}`);
        }
      }

    } else if (audioSegments.length > 0) {
      logger.info(`Job ${jobId} [Step 3/3]: Merging video and audio segments...`);
      const mergeStart = Date.now();

      const mergedFilename = `capture-${uuidv4()}.mp4`;
      const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
      const mergedPath = path.join(__dirname, '..', outputDir, mergedFilename);

      const finalVideoPath = await mergeService.mergeVideoWithAudioSegments(
        tempVideoPath, 
        audioSegments, 
        mergedPath
      );
      metrics.merge_duration = parseFloat(((Date.now() - mergeStart) / 1000).toFixed(2));
      logger.info(`Job ${jobId}: Merge completed in ${metrics.merge_duration}s. File: ${finalVideoPath}`);

      // Upload merged video to R2 and get public URL
      videoUrl = `/videos/${mergedFilename}`;
      filename = mergedFilename;
      
      if (r2.s3Client) {
        try {
          logger.info(`Job ${jobId}: Uploading merged video to Cloudflare R2...`);
          const r2Url = await r2.uploadFile(finalVideoPath, mergedFilename);
          videoUrl = r2Url;
          
          if (fs.existsSync(finalVideoPath)) {
            fs.unlinkSync(finalVideoPath);
            logger.info(`Job ${jobId}: Deleted local merged video file after uploading to R2`);
          }
        } catch (uploadErr) {
          logger.error(`Job ${jobId}: R2 upload failed, fallback to local file serving: ${uploadErr.message}`);
        }
      }

      // Save public URL
      job.videoUrl = videoUrl;
      job.filename = filename;

      // Clean up temp files
      try {
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        for (const seg of audioSegments) {
          if (fs.existsSync(seg.audioPath)) fs.unlinkSync(seg.audioPath);
        }
        logger.info(`Job ${jobId}: Cleaned up temporary video and audio tracks`);
      } catch (cleanupErr) {
        logger.warn(`Job ${jobId}: Failed to cleanup temporary files: ${cleanupErr.message}`);
      }
    } else {
      // No TTS: direct public URL of captured video
      if (r2.s3Client) {
        try {
          logger.info(`Job ${jobId}: Uploading captured video to Cloudflare R2...`);
          const r2Url = await r2.uploadFile(tempVideoPath, filename);
          videoUrl = r2Url;

          if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
            logger.info(`Job ${jobId}: Deleted local captured video file after uploading to R2`);
          }
        } catch (uploadErr) {
          logger.error(`Job ${jobId}: R2 upload failed, fallback to local file serving: ${uploadErr.message}`);
        }
      }

      job.videoUrl = videoUrl;
      job.filename = filename;
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
    
    await updateJobState(jobId, {
      status: 'completed',
      videoUrl: job.videoUrl,
      filename: job.filename,
      ttsSegments: job.ttsSegments || [],
      metrics: metrics,
      completed_at: job.completed_at
    });

    logger.info(`Job ${jobId} completed successfully in ${metrics.total_duration}s!`);

  } catch (error) {
    // Failure Status Update
    logger.error(`Job ${jobId} failed: ${error.message}`, { stack: error.stack });
    
    job.status = 'failed';
    job.error = error.message;
    job.completed_at = new Date();

    await updateJobState(jobId, {
      status: 'failed',
      error: error.message,
      completed_at: job.completed_at
    });

    // Clean up any remaining temp files on failure
    try {
      if (tempVideoPath && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      for (const seg of audioSegments) {
        if (seg.audioPath && fs.existsSync(seg.audioPath)) fs.unlinkSync(seg.audioPath);
      }
    } catch (cleanupErr) {
      logger.warn(`Job ${jobId}: Failed to cleanup temp files on error: ${cleanupErr.message}`);
    }
  } finally {
    isProcessing = false;
    // Schedule check for next job
    setTimeout(processQueue, 100);
  }
}

/**
 * Perform the final fast merge for a decoupled edit-mode job
 * @param {string} jobId - The original job ID
 * @param {Array<Object>} ttsSegments - Array of { filename, timespamptStart }
 * @returns {Promise<Object>} - The updated job info
 */
async function mergeJob(jobId, ttsSegments) {
  let job = jobs.get(jobId);
  if (!job && db) {
    const doc = await db.collection('jobs').doc(jobId).get();
    if (doc.exists) {
      job = doc.data();
    }
  }

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Ensure directories exist
  const outputDir = process.env.VIDEO_OUTPUT_DIR || './videos';
  const audioDir = process.env.AUDIO_OUTPUT_DIR || './audio';
  const absoluteOutputDir = path.join(__dirname, '..', outputDir);
  const absoluteAudioDir = path.join(__dirname, '..', audioDir);

  if (!fs.existsSync(absoluteOutputDir)) fs.mkdirSync(absoluteOutputDir, { recursive: true });
  if (!fs.existsSync(absoluteAudioDir)) fs.mkdirSync(absoluteAudioDir, { recursive: true });

  // 1. Resolve source video path (either local or download from R2)
  const videoFilename = job.filename || `capture-${jobId}.mp4`;
  const localVideoPath = path.join(absoluteOutputDir, videoFilename);
  
  logger.info(`Merging job ${jobId}. Resolving video: ${localVideoPath}`);
  await ensureLocalFile(job.videoUrl, localVideoPath);

  // 2. Resolve each audio segment
  const audioSegments = [];
  for (let i = 0; i < ttsSegments.length; i++) {
    const seg = ttsSegments[i];
    const localAudioPath = path.join(absoluteAudioDir, seg.filename);
    
    // Find matching segment URL from original job to download if missing
    const origSeg = job.ttsSegments && job.ttsSegments.find(s => s.filename === seg.filename);
    const audioUrl = origSeg ? origSeg.audioUrl : `${r2.getPublicUrl()}/${seg.filename}`;

    logger.info(`Resolving segment ${i} (${seg.filename}): ${localAudioPath}`);
    await ensureLocalFile(audioUrl, localAudioPath);

    audioSegments.push({
      audioPath: localAudioPath,
      startTime: parseTimestamp(seg.timespamptStart)
    });
  }

  // 3. Perform FFmpeg merge
  const mergedFilename = `merged-${uuidv4()}.mp4`;
  const mergedPath = path.join(absoluteOutputDir, mergedFilename);

  logger.info(`Starting FFmpeg merge for ${jobId} -> ${mergedPath}`);
  const finalVideoPath = await mergeService.mergeVideoWithAudioSegments(
    localVideoPath, 
    audioSegments, 
    mergedPath
  );

  // 4. Upload merged output to R2
  let videoUrl = `/videos/${mergedFilename}`;
  let filename = mergedFilename;

  if (r2.s3Client) {
    logger.info(`Uploading finalized merged video to R2...`);
    const r2Url = await r2.uploadFile(finalVideoPath, mergedFilename);
    videoUrl = r2Url;
    if (fs.existsSync(finalVideoPath)) {
      fs.unlinkSync(finalVideoPath);
    }
  }

  // 5. Clean up local downloaded video/audio copies to save space
  if (fs.existsSync(localVideoPath)) {
    fs.unlinkSync(localVideoPath);
  }
  for (const seg of audioSegments) {
    if (fs.existsSync(seg.audioPath)) {
      fs.unlinkSync(seg.audioPath);
    }
  }

  // 6. Update local and Firestore job state
  const updates = {
    status: 'completed',
    videoUrl: videoUrl,
    filename: filename,
    completed_at: new Date(),
    isMerged: true
  };

  if (jobs.has(jobId)) {
    Object.assign(jobs.get(jobId), updates);
  }

  if (db) {
    await db.collection('jobs').doc(jobId).update(updates);
  }

  return {
    jobId,
    status: 'completed',
    videoUrl,
    filename
  };
}

module.exports = {
  createJob,
  getJob,
  mergeJob
};
