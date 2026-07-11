require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const captureRouter = require('./routes/capture');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create videos directory if it doesn't exist
const videoDir = path.join(__dirname, process.env.VIDEO_OUTPUT_DIR || './videos');
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
  console.log(`✅ Created video directory: ${videoDir}`);
}

// Serve static video files
app.use('/videos', express.static(videoDir));

// Routes
app.use('/api/capture', captureRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Web Capture Server is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Web Screen Capture API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      capture: 'POST /api/capture',
      videos: 'GET /videos/:filename'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📹 Video output directory: ${videoDir}`);
  console.log(`📝 Ready to capture screens!`);
});
