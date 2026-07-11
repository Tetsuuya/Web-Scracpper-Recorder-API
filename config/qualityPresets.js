/**
 * Quality presets for video capture
 * Trade-off: Speed vs Quality vs File Size
 */

const QUALITY_PRESETS = {
  // Super fast for quick testing (lowest quality)
  superfast: {
    width: 1280,
    height: 720,
    fps: 24,
    videoCrf: 28,
    videoPreset: 'ultrafast',
    videoBitrate: 3000,
    description: 'Quick testing - 720p24 (~15s for 10s video)'
  },

  // Fast for normal testing
  fast: {
    width: 1280,
    height: 720,
    fps: 30,
    videoCrf: 23,
    videoPreset: 'veryfast',
    videoBitrate: 5000,
    description: 'Normal testing - 720p30 (~20s for 10s video)'
  },

  // Medium quality (balanced)
  medium: {
    width: 1920,
    height: 1080,
    fps: 30,
    videoCrf: 23,
    videoPreset: 'medium',
    videoBitrate: 6000,
    description: 'Balanced - 1080p30 (~30s for 10s video)'
  },

  // High quality (current)
  high: {
    width: 1920,
    height: 1080,
    fps: 60,
    videoCrf: 18,
    videoPreset: 'medium',
    videoBitrate: 10000,
    description: 'High quality - 1080p60 (~60s for 10s video)'
  },

  // Ultra high (best quality, slowest)
  ultrahigh: {
    width: 1920,
    height: 1080,
    fps: 60,
    videoCrf: 15,
    videoPreset: 'slow',
    videoBitrate: 15000,
    description: 'Best quality - 1080p60 CRF15 (~90s for 10s video)'
  },

  // Smooth (optimized for animations)
  smooth: {
    width: 1920,
    height: 1080,
    fps: 120,  // Very high FPS for smooth animations
    videoCrf: 18,
    videoPreset: 'medium',
    videoBitrate: 12000,
    description: 'Ultra smooth animations - 1080p120 (~75s for 10s video)'
  }
};

/**
 * Get quality preset configuration
 * @param {string} presetName - Name of the preset
 * @param {object} customOptions - Override options
 * @returns {object} Quality configuration
 */
function getQualityPreset(presetName = 'high', customOptions = {}) {
  const preset = QUALITY_PRESETS[presetName] || QUALITY_PRESETS.high;
  
  return {
    ...preset,
    ...customOptions
  };
}

/**
 * Get all available presets
 * @returns {object} All presets with descriptions
 */
function getAllPresets() {
  return Object.entries(QUALITY_PRESETS).map(([name, config]) => ({
    name,
    description: config.description,
    specs: `${config.width}x${config.height} @ ${config.fps}fps, CRF${config.videoCrf}`
  }));
}

module.exports = {
  QUALITY_PRESETS,
  getQualityPreset,
  getAllPresets
};
