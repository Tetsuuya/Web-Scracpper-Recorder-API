/**
 * TTS Service using Replicate API with Kokoro-82m model
 * Reuses the same setup from Dubber/Backend
 */

const Replicate = require('replicate');
const path = require('path');
const fs = require('fs');

// Initialize Replicate client (lazy - reads token at call time)
function getReplicateClient() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not set in environment variables');
  }
  return new Replicate({ auth: token });
}

// Kokoro-82m model from Dubber/Backend
const KOKORO_MODEL = 'alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5';

/**
 * Generate speech from text using Replicate Kokoro-82m
 * @param {string} text - The text to convert to speech
 * @param {string} language - Language code (e.g., 'en-US', 'fr-FR', 'es-ES')
 * @param {string} voice - Voice option (e.g., 'male-foundation', 'female-foundation')
 * @returns {Promise<string>} - Path to generated audio file
 */
async function generateSpeech(text, language = 'en-US', voice = 'male-foundation') {
  const startTime = Date.now();

  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS generation');
  }

  // Map language to Kokoro voice codes
  const voiceMap = {
    'en-US': {
      'male-foundation': 'en_us_male_2',
      'female-foundation': 'en_us_female_1'
    },
    'fr-FR': {
      'male-foundation': 'fr_fr_male_1',
      'female-foundation': 'fr_fr_female_1'
    },
    'es-ES': {
      'male-foundation': 'es_es_male_1',
      'female-foundation': 'es_es_female_1'
    },
    'de-DE': {
      'male-foundation': 'de_de_male_1',
      'female-foundation': 'de_de_female_1'
    },
    'it-IT': {
      'male-foundation': 'it_it_male_1',
      'female-foundation': 'it_it_female_1'
    },
    'pt-PT': {
      'male-foundation': 'pt_pt_male_1',
      'female-foundation': 'pt_pt_female_1'
    },
    'ja-JP': {
      'male-foundation': 'jp_jp_male_1',
      'female-foundation': 'jp_jp_female_1'
    },
    'zh-CN': {
      'male-foundation': 'zh_cn_male_1',
      'female-foundation': 'zh_cn_female_1'
    }
  };

  // Default to en_US_male_2 if not found
  const voiceCode = voiceMap[language]?.[voice] || 'en_us_male_2';

  console.log(`🎵 Generating TTS audio...`);
  console.log(`   Language: ${language}`);
  console.log(`   Voice: ${voice} (${voiceCode})`);
  console.log(`   Text length: ${text.length} characters`);
  console.log(`   Token loaded: ${process.env.REPLICATE_API_TOKEN ? '✅ yes' : '❌ missing'}`);

  try {
    // Call Replicate API with Kokoro model
    const replicate = getReplicateClient();
    const output = await replicate.run(KOKORO_MODEL, {
      input: {
        text: text,
        voice: voiceCode,
        speed: 1.0,
        pad_between_chunks: 0.1
      }
    });

    // Output is typically a URL to the audio file
    const audioUrl = output;
    const duration = (Date.now() - startTime) / 1000;

    console.log(`✅ TTS generation completed in ${duration.toFixed(2)}s`);
    console.log(`   Audio URL: ${audioUrl}`);

    return audioUrl;
  } catch (error) {
    console.error(`❌ TTS generation failed: ${error.message}`);
    throw new Error(`TTS generation failed: ${error.message}`);
  }
}

/**
 * Download audio from URL and save to local file
 * @param {string} audioUrl - URL of the audio file
 * @param {string} outputPath - Local path to save the file
 * @returns {Promise<string>} - Local file path
 */
async function downloadAudio(audioUrl, outputPath) {
  const axios = require('axios');
  const fs = require('fs');
  const path = require('path');

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`📥 Downloading audio to ${outputPath}...`);

  try {
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Audio saved: ${outputPath}`);
        resolve(outputPath);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}

/**
 * Generate and download TTS audio
 * Tries Replicate/Kokoro first, falls back to Edge TTS (free) on billing errors
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code
 * @param {string} voice - Voice option
 * @param {string} filename - Output filename (optional)
 * @returns {Promise<string>} - Local file path
 */
async function generateAndDownloadSpeech(text, language = 'en-US', voice = 'male-foundation', filename = null) {
  // Generate unique filename if not provided
  if (!filename) {
    const { v4: uuidv4 } = require('uuid');
    filename = `tts-${uuidv4()}.mp3`;
  }

  // Try Replicate (Kokoro) first if token is available
  if (process.env.REPLICATE_API_TOKEN) {
    try {
      const audioUrl = await generateSpeech(text, language, voice);
      const outputDir = path.join(__dirname, '..', process.env.AUDIO_OUTPUT_DIR || './audio');
      const outputPath = path.join(outputDir, filename);
      await downloadAudio(audioUrl, outputPath);
      return outputPath;
    } catch (error) {
      // Fallback to free TTS on billing/auth errors
      const isBillingError = error.message.includes('402') || error.message.includes('Payment') || error.message.includes('credit');
      const isAuthError = error.message.includes('401') || error.message.includes('Unauthenticated');

      if (isBillingError || isAuthError) {
        console.warn(`⚠️  Replicate unavailable (${isBillingError ? 'insufficient credits' : 'auth error'}), falling back to free Edge TTS...`);
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  } else {
    console.warn(`⚠️  No REPLICATE_API_TOKEN set, using free Edge TTS...`);
  }

  // Fallback: Edge TTS (free)
  const { generateSpeechFree } = require('./freeTtsService');
  return await generateSpeechFree(text, language, voice, filename);
}

/**
 * Get available voices for a language
 * @param {string} language - Language code
 * @returns {Array<string>} - List of available voices
 */
function getAvailableVoices(language = 'en-US') {
  const voices = {
    'en-US': ['male-foundation', 'female-foundation'],
    'fr-FR': ['male-foundation', 'female-foundation'],
    'es-ES': ['male-foundation', 'female-foundation'],
    'de-DE': ['male-foundation', 'female-foundation'],
    'it-IT': ['male-foundation', 'female-foundation'],
    'pt-PT': ['male-foundation', 'female-foundation'],
    'ja-JP': ['male-foundation', 'female-foundation'],
    'zh-CN': ['male-foundation', 'female-foundation']
  };

  return voices[language] || voices['en-US'];
}

module.exports = {
  generateSpeech,
  generateAndDownloadSpeech,
  downloadAudio,
  getAvailableVoices,
  KOKORO_MODEL
};