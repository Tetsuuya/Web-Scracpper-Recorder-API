/**
 * Merge Service - Combine video and audio using FFmpeg
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Merge video and audio files into a single output
 * @param {string} videoPath - Path to video file
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for merged output
 * @param {Object} options - Additional FFmpeg options
 * @returns {Promise<string>} - Path to merged file
 */
async function mergeVideoAudio(videoPath, audioPath, outputPath, options = {}) {
  const startTime = Date.now();

  // Validate files exist
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`🎬 Merging video and audio...`);
  console.log(`   Video: ${videoPath}`);
  console.log(`   Audio: ${audioPath}`);
  console.log(`   Output: ${outputPath}`);

  // Retrieve durations of both input files
  const videoDuration = await getVideoDuration(videoPath);
  const audioDuration = await getVideoDuration(audioPath);
  console.log(`   Durations - Video: ${videoDuration.toFixed(2)}s, Audio: ${audioDuration.toFixed(2)}s`);

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', videoPath,
      '-i', audioPath
    ];

    if (audioDuration > videoDuration) {
      const freezeDuration = audioDuration - videoDuration;
      console.log(`🥶 Audio is longer. Freezing last frame of video for ${freezeDuration.toFixed(2)}s`);
      
      ffmpegArgs.push(
        '-filter_complex', `[0:v]tpad=stop_mode=clone:stop_duration=${freezeDuration}[v]`,
        '-map', '[v]',
        '-map', '1:a:0',
        '-c:v', 'libx264', // Must re-encode to apply filter
        '-c:a', 'aac'
      );
    } else {
      console.log(`▶️ Video is longer or equal. Keeping full video duration: ${videoDuration.toFixed(2)}s`);
      
      ffmpegArgs.push(
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy', // Stream copy (fast, no re-encode)
        '-c:a', 'aac'
      );
    }

    // Apply audio fade effects if options are specified
    const audioFilters = [];
    const finalDuration = Math.max(videoDuration, audioDuration);
    if (options.fadeIn) {
      audioFilters.push(`afade=t=in:st=0:d=${options.fadeIn}`);
    }
    if (options.fadeOut) {
      audioFilters.push(`afade=t=out:st=${finalDuration - options.fadeOut}:d=${options.fadeOut}`);
    }
    if (audioFilters.length > 0) {
      ffmpegArgs.push('-af', audioFilters.join(','));
    }

    ffmpegArgs.push('-y', outputPath);

    console.log(`🔧 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000;

      if (code === 0) {
        console.log(`✅ Merge completed in ${duration.toFixed(2)}s`);
        console.log(`   Output file: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`❌ FFmpeg failed with code ${code}`);
        console.error(`   stderr: ${stderr}`);
        reject(new Error(`FFmpeg merge failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });
  });
}

/**
 * Merge video with multiple audio tracks (background + voiceover)
 * @param {string} videoPath - Path to video file
 * @param {string} voicePath - Voiceover audio path
 * @param {string} bgmPath - Background music path (optional)
 * @param {string} outputPath - Output file path
 * @param {Object} options - Volume and mixing options
 * @returns {Promise<string>}
 */
async function mergeWithMixing(videoPath, voicePath, bgmPath, outputPath, options = {}) {
  const startTime = Date.now();
  const voiceVolume = options.voiceVolume || 1.0;
  const bgmVolume = options.bgmVolume || 0.3;

  console.log(`🎛️ Merging with audio mixing...`);
  console.log(`   Voice volume: ${voiceVolume}`);
  if (bgmPath) console.log(`   BGM volume: ${bgmVolume}`);

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', videoPath,
      '-i', voicePath,
    ];

    if (bgmPath) {
      ffmpegArgs.push('-i', bgmPath);
    }

    ffmpegArgs.push(
      '-filter_complex', `[1:a]volume=${voiceVolume}[voice];[0:a][voice]amix=inputs=2:duration=first[outa]`,
      '-map', '0:v',
      '-map', '[outa]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-y',
      outputPath
    );

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000;

      if (code === 0) {
        console.log(`✅ Audio mixing completed in ${duration.toFixed(2)}s`);
        resolve(outputPath);
      } else {
        reject(new Error(`Audio mixing failed: ${stderr}`));
      }
    });
  });
}

/**
 * Get video duration in seconds
 * @param {string} videoPath - Path to video file
 * @returns {Promise<number>}
 */
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      videoPath
    ]);

    let stdout = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          resolve(parseFloat(info.format.duration));
        } catch (error) {
          reject(new Error(`Failed to parse video duration: ${error.message}`));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}`));
      }
    });
  });
}

/**
 * Trim audio to match video duration
 * @param {string} audioPath - Input audio path
 * @param {string} outputPath - Output path
 * @param {number} duration - Target duration in seconds
 * @returns {Promise<string>}
 */
async function trimAudio(audioPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioPath,
      '-t', duration.toString(),
      '-c', 'copy',
      '-y',
      outputPath
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Failed to trim audio: ${stderr}`));
      }
    });
  });
}

/**
 * Parse timestamp to seconds. Supports numbers (seconds) and strings (hh:mm:ss, mm:ss, ss)
 * @param {string|number} timestamp
 * @returns {number}
 */
function parseTimestamp(timestamp) {
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    const parts = timestamp.split(':').map(Number);
    if (parts.some(isNaN)) {
      return 0;
    }
    if (parts.length === 3) {
      // hh:mm:ss
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      // mm:ss
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 1) {
      // ss
      return parts[0];
    }
  }
  return 0;
}

/**
 * Merge video with multiple timestamped audio tracks
 * @param {string} videoPath - Path to video file
 * @param {Array<Object>} audioSegments - Array of { audioPath, startTime }
 * @param {string} outputPath - Output file path
 * @param {Object} options - Fade and other options
 * @returns {Promise<string>}
 */
async function mergeVideoWithAudioSegments(videoPath, audioSegments, outputPath, options = {}) {
  const startTime = Date.now();

  // Validate files exist
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  if (!audioSegments || audioSegments.length === 0) {
    // No segments: just copy video
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-c:v', 'copy',
        '-an',
        '-y',
        outputPath
      ]);
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error('Copy video failed'));
      });
    });
  }

  for (const segment of audioSegments) {
    if (!fs.existsSync(segment.audioPath)) {
      throw new Error(`Segment audio file not found: ${segment.audioPath}`);
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const videoDuration = await getVideoDuration(videoPath);
  
  // Calculate max audio end time
  let maxAudioEndTime = 0;
  for (const segment of audioSegments) {
    const audioDur = await getVideoDuration(segment.audioPath);
    segment.duration = audioDur;
    const endTime = segment.startTime + audioDur;
    if (endTime > maxAudioEndTime) {
      maxAudioEndTime = endTime;
    }
  }

  console.log(`🎬 Merging video with ${audioSegments.length} audio segments...`);
  console.log(`   Video: ${videoPath} (${videoDuration.toFixed(2)}s)`);
  console.log(`   Max Audio End Time: ${maxAudioEndTime.toFixed(2)}s`);
  console.log(`   Output: ${outputPath}`);

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', videoPath
    ];

    // Add all audio segment inputs
    for (const segment of audioSegments) {
      ffmpegArgs.push('-i', segment.audioPath);
    }

    const filterParts = [];
    const audioLabels = [];
    const isVideoExtended = maxAudioEndTime > videoDuration;

    // 1. Video filter (freeze frame if needed)
    if (isVideoExtended) {
      const freezeDuration = maxAudioEndTime - videoDuration;
      console.log(`🥶 Freezing video last frame for ${freezeDuration.toFixed(2)}s`);
      filterParts.push(`[0:v]tpad=stop_mode=clone:stop_duration=${freezeDuration}[v]`);
    }

    // 2. Audio delay filters
    audioSegments.forEach((segment, index) => {
      const delayMs = Math.round(segment.startTime * 1000);
      const inputIndex = index + 1; // 0 is video
      filterParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[a${inputIndex}]`);
      audioLabels.push(`[a${inputIndex}]`);
    });

    // 3. Audio mixing
    let finalAudioTag = '[mixeda]';
    if (audioSegments.length > 1) {
      filterParts.push(`${audioLabels.join('')}amix=inputs=${audioSegments.length}:duration=longest:normalize=0${finalAudioTag}`);
    } else {
      finalAudioTag = '[a1]';
    }

    // 4. Audio fading (if any)
    const audioFilters = [];
    const finalDuration = Math.max(videoDuration, maxAudioEndTime);
    if (options.fadeIn) {
      audioFilters.push(`afade=t=in:st=0:d=${options.fadeIn}`);
    }
    if (options.fadeOut) {
      audioFilters.push(`afade=t=out:st=${finalDuration - options.fadeOut}:d=${options.fadeOut}`);
    }

    if (audioFilters.length > 0) {
      filterParts.push(`${finalAudioTag}${audioFilters.join(',')}[outa]`);
      finalAudioTag = '[outa]';
    }

    ffmpegArgs.push('-filter_complex', filterParts.join('; '));

    // Map outputs
    if (isVideoExtended) {
      ffmpegArgs.push('-map', '[v]');
    } else {
      ffmpegArgs.push('-map', '0:v:0');
    }
    ffmpegArgs.push('-map', finalAudioTag);

    // Codecs
    if (isVideoExtended) {
      ffmpegArgs.push('-c:v', 'libx264');
    } else {
      ffmpegArgs.push('-c:v', 'copy');
    }
    ffmpegArgs.push('-c:a', 'aac');

    ffmpegArgs.push('-y', outputPath);

    console.log(`🔧 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000;

      if (code === 0) {
        console.log(`✅ Merge completed in ${duration.toFixed(2)}s`);
        resolve(outputPath);
      } else {
        console.error(`❌ FFmpeg failed with code ${code}`);
        reject(new Error(`FFmpeg merge failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });
  });
}

module.exports = {
  mergeVideoAudio,
  mergeWithMixing,
  getVideoDuration,
  getMediaDuration: getVideoDuration, // Alias to clarify it supports audio files too
  trimAudio,
  parseTimestamp,
  mergeVideoWithAudioSegments
};