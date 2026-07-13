/**
 * Free TTS Service using Microsoft Edge TTS (edge-tts-node)
 * No API key required - completely free
 * Used as fallback when Replicate credits are unavailable
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Language to Edge TTS voice mapping
const VOICE_MAP = {
  'en-US': {
    'male-foundation':   'en-US-GuyNeural',
    'female-foundation': 'en-US-JennyNeural'
  },
  'fr-FR': {
    'male-foundation':   'fr-FR-HenriNeural',
    'female-foundation': 'fr-FR-DeniseNeural'
  },
  'es-ES': {
    'male-foundation':   'es-ES-AlvaroNeural',
    'female-foundation': 'es-ES-ElviraNeural'
  },
  'de-DE': {
    'male-foundation':   'de-DE-ConradNeural',
    'female-foundation': 'de-DE-KatjaNeural'
  },
  'it-IT': {
    'male-foundation':   'it-IT-DiegoNeural',
    'female-foundation': 'it-IT-ElsaNeural'
  },
  'pt-PT': {
    'male-foundation':   'pt-PT-DuarteNeural',
    'female-foundation': 'pt-PT-RaquelNeural'
  },
  'ja-JP': {
    'male-foundation':   'ja-JP-KeitaNeural',
    'female-foundation': 'ja-JP-NanamiNeural'
  },
  'zh-CN': {
    'male-foundation':   'zh-CN-YunxiNeural',
    'female-foundation': 'zh-CN-XiaoxiaoNeural'
  }
};

/**
 * Generate speech using Edge TTS (free, no API key)
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code (e.g., 'en-US')
 * @param {string} voice - Voice option ('male-foundation' or 'female-foundation')
 * @param {string} filename - Output filename (optional)
 * @returns {Promise<string>} - Local file path to generated audio
 */
async function generateSpeechFree(text, language = 'en-US', voice = 'male-foundation', filename = null) {
  const startTime = Date.now();

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for TTS generation');
  }

  // Get voice name for Edge TTS
  const voiceName = VOICE_MAP[language]?.[voice] || VOICE_MAP['en-US']['male-foundation'];

  // Generate filename if not provided
  if (!filename) {
    filename = `tts-free-${uuidv4()}.mp3`;
  }

  const outputDir = path.join(__dirname, '..', process.env.AUDIO_OUTPUT_DIR || './audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, filename);
  // @andresaya/edge-tts appends .mp3 automatically, strip it to avoid double extension
  const outputPathNoExt = outputPath.replace(/\.mp3$/, '');

  console.log(`🆓 Generating TTS audio (Edge TTS - free)...`);
  console.log(`   Language: ${language}`);
  console.log(`   Voice: ${voice} → ${voiceName}`);
  console.log(`   Text length: ${text.length} characters`);

  try {
    const { EdgeTTS } = require('@andresaya/edge-tts');
    const tts = new EdgeTTS();

    await tts.synthesize(text, voiceName, { rate: '0%', volume: '0%', pitch: '0Hz' });
    await tts.toFile(outputPathNoExt);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Free TTS generation completed in ${duration.toFixed(2)}s`);
    console.log(`   Audio saved: ${outputPath}`);

    return outputPath; // Return the .mp3 path (library adds it back)
  } catch (error) {
    console.error(`❌ Free TTS generation failed: ${error.message}`);
    throw new Error(`Free TTS generation failed: ${error.message}`);
  }
}

/**
 * Get available voices for Edge TTS
 * @param {string} language - Language code
 * @returns {Array<string>}
 */
function getAvailableVoices(language = 'en-US') {
  return Object.keys(VOICE_MAP[language] || VOICE_MAP['en-US']);
}

module.exports = {
  generateSpeechFree,
  getAvailableVoices,
  VOICE_MAP
};
