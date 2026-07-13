/**
 * Validate capture request input
 * @param {Object} data - Request body
 * @returns {Object} - { error, value }
 */
function validateCaptureRequest(data) {
  const errors = [];
  
  // Validate URL
  if (!data.url) {
    errors.push({ message: 'URL is required' });
  } else {
    try {
      const urlObj = new URL(data.url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push({ message: 'URL must use http or https protocol' });
      }
    } catch (err) {
      errors.push({ message: 'Invalid URL format' });
    }
  }

  // Validate duration
  if (!data.duration) {
    errors.push({ message: 'Duration is required' });
  } else if (typeof data.duration !== 'number') {
    errors.push({ message: 'Duration must be a number' });
  } else if (data.duration <= 0) {
    errors.push({ message: 'Duration must be greater than 0' });
  } else if (data.duration > parseInt(process.env.MAX_DURATION || 300)) {
    errors.push({ 
      message: `Duration cannot exceed ${process.env.MAX_DURATION || 300} seconds` 
    });
  }

  // Validate quality preset
  const validPresets = ['superfast', 'fast', 'medium', 'high', 'ultrahigh', 'smooth'];
  const quality = data.quality || 'high';
  if (quality && !validPresets.includes(quality)) {
    errors.push({ 
      message: `Quality must be one of: ${validPresets.join(', ')}` 
    });
  }

  // Validate optional parameters
  const options = data.options || {};
  
  if (options.width && (options.width < 320 || options.width > 3840)) {
    errors.push({ message: 'Width must be between 320 and 3840' });
  }
  
  if (options.height && (options.height < 240 || options.height > 2160)) {
    errors.push({ message: 'Height must be between 240 and 2160' });
  }
  
  if (options.fps && (options.fps < 15 || options.fps > 60)) {
    errors.push({ message: 'FPS must be between 15 and 60' });
  }

  // Validate TTS parameters (optional)
  if (data.script !== undefined && typeof data.script !== 'string') {
    errors.push({ message: 'Script must be a string' });
  }

  if (data.language && !['en-US', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'ja-JP', 'zh-CN'].includes(data.language)) {
    errors.push({ message: 'Language must be one of: en-US, fr-FR, es-ES, de-DE, it-IT, pt-PT, ja-JP, zh-CN' });
  }

  if (data.voice) {
    const validVoices = ['male-foundation', 'female-foundation'];
    if (!validVoices.includes(data.voice)) {
      errors.push({ message: `Voice must be one of: ${validVoices.join(', ')}` });
    }
  }

  // Validate interactions array
  const interactions = data.interactions || [];
  if (interactions && !Array.isArray(interactions)) {
    errors.push({ message: 'Interactions must be an array' });
  }

  // Validate each interaction
  interactions.forEach((interaction, index) => {
    if (!interaction.action) {
      errors.push({ message: `Interaction ${index}: action is required` });
    }
    
    const validActions = ['scroll', 'click', 'hover', 'type', 'wait'];
    if (interaction.action && !validActions.includes(interaction.action)) {
      errors.push({ 
        message: `Interaction ${index}: action must be one of: ${validActions.join(', ')}` 
      });
    }
    
    if (interaction.action === 'click' || interaction.action === 'hover') {
      if (!interaction.selector) {
        errors.push({ message: `Interaction ${index}: selector is required for ${interaction.action}` });
      }
    }
    
    if (interaction.action === 'type') {
      if (!interaction.selector || !interaction.text) {
        errors.push({ message: `Interaction ${index}: selector and text are required for type` });
      }
    }
  });

  // Return validation result
  if (errors.length > 0) {
    return { 
      error: { details: errors }, 
      value: null 
    };
  }

  // Return validated and sanitized values
  return {
    error: null,
    value: {
      url: data.url,
      duration: data.duration,
      quality: quality,
      script: data.script || null,
      language: data.language || 'en-US',
      voice: data.voice || 'male-foundation',
      interactions: interactions || [],
      options: {
        width: options.width || parseInt(process.env.DEFAULT_RESOLUTION_WIDTH || 1920),
        height: options.height || parseInt(process.env.DEFAULT_RESOLUTION_HEIGHT || 1080),
        fps: options.fps || parseInt(process.env.DEFAULT_FPS || 60),
        autoScroll: options.autoScroll !== undefined ? options.autoScroll : false
      }
    }
  };
}

module.exports = {
  validateCaptureRequest
};
