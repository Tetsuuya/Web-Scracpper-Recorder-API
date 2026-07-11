# Web Screen Capture Server

High-quality web screen capture API using Puppeteer + puppeteer-stream

## Setup Instructions

### 1. Install Dependencies

```bash
cd Backend
npm install
```

This will install:
- Express (API server)
- Puppeteer (browser automation)
- puppeteer-stream (high-quality video recording with audio support)
- Other utilities

### 2. Configure Environment

The `.env` file is already created with defaults:

```
PORT=3000
VIDEO_OUTPUT_DIR=./videos
MAX_DURATION=300
DEFAULT_RESOLUTION_WIDTH=1920
DEFAULT_RESOLUTION_HEIGHT=1080
DEFAULT_FPS=60
```

You can modify these as needed.

### 3. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 4. Test the Server

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Capture a Website (placeholder for now):**
```bash
curl -X POST http://localhost:3000/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "duration": 10
  }'
```

**With custom options:**
```bash
curl -X POST http://localhost:3000/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "duration": 30,
    "options": {
      "width": 1920,
      "height": 1080,
      "fps": 60
    }
  }'
```

## API Endpoints

### POST /api/capture

Capture a website as video.

**Request Body:**
```json
{
  "url": "https://example.com",
  "duration": 30,
  "options": {
    "width": 1920,
    "height": 1080,
    "fps": 60,
    "autoScroll": false
  },
  "interactions": [
    {
      "action": "wait",
      "time": 2000
    },
    {
      "action": "click",
      "selector": ".menu-button",
      "delay": 1000
    },
    {
      "action": "scroll",
      "amount": 500,
      "delay": 2000
    }
  ]
}
```

**Available Interactions:**
- `scroll`: Scroll by amount (pixels)
- `click`: Click an element (requires selector)
- `hover`: Hover over an element (requires selector)
- `type`: Type text into input (requires selector and text)
- `wait`: Wait for specified time (milliseconds)

**Examples:**

1. **Simple capture (no interactions)**
```json
{
  "url": "https://example.com",
  "duration": 10
}
```

2. **Auto-scroll through page**
```json
{
  "url": "https://example.com",
  "duration": 20,
  "options": {
    "autoScroll": true
  }
}
```

3. **Custom interactions**
```json
{
  "url": "https://example.com",
  "duration": 30,
  "interactions": [
    { "action": "wait", "time": 3000 },
    { "action": "click", "selector": ".play-button" },
    { "action": "scroll", "amount": 500, "delay": 2000 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video captured successfully",
  "data": {
    "jobId": "uuid",
    "videoUrl": "/videos/capture-uuid.webm",
    "filename": "capture-uuid.webm",
    "duration": 30
  }
}
```

### GET /videos/:filename

Download a captured video.

**Example:**
```
http://localhost:3000/videos/capture-uuid.webm
```

## Project Structure

```
Backend/
├── server.js              # Main server file
├── routes/
│   └── capture.js         # Capture endpoint routes
├── services/
│   └── captureService.js  # Video capture logic
├── utils/
│   └── validation.js      # Input validation
├── videos/                # Output directory (auto-created)
├── .env                   # Environment configuration
├── package.json           # Dependencies
└── README.md             # This file
```

## Next Steps (Phase 1 Afternoon)

✅ **COMPLETED!** Video capture is now fully implemented with puppeteer-stream

### Test the Video Capture

**Method 1: Using the test script (Easiest)**
```bash
npm install axios
node test-capture.js
```

This will:
- Capture example.com (10 seconds)
- Capture an animated website (15 seconds)
- Capture with custom resolution (5 seconds)
- Videos will be saved in the `videos/` folder

**Method 2: Manual API test**
```bash
curl -Method POST -Uri http://localhost:3000/api/capture -ContentType "application/json" -Body '{"url":"https://example.com","duration":10}'
```

**Method 3: Using Postman**
POST to `http://localhost:3000/api/capture` with body:
```json
{
  "url": "https://example.com",
  "duration": 10
}
```

### Watch the Videos

After capture completes:
1. Check the `videos/` folder for .webm files
2. Access via browser: `http://localhost:3000/videos/capture-[uuid].webm`
3. Or open the file directly with VLC or any video player

## Technology Stack

- **Node.js** - Runtime
- **Express** - API framework
- **Puppeteer** - Browser automation
- **puppeteer-stream** - High-quality video recording (audio-ready)
- **FFmpeg** - Video encoding (via puppeteer-stream)

All free and open source! 🎉
