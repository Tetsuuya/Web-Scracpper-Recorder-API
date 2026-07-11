const express = require('express');
const router = express.Router();
const { validateCaptureRequest } = require('../utils/validation');
const captureService = require('../services/captureService');

/**
 * POST /api/capture
 * Capture a video of a website
 * 
 * Body:
 * {
 *   "url": "https://example.com",
 *   "duration": 30,
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

    console.log(`📹 New capture request: ${value.url} for ${value.duration}s`);

    // Start capture (we'll implement this in the service)
    const result = await captureService.captureWebsite(value);

    res.json({
      success: true,
      message: 'Video captured successfully',
      data: result
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
