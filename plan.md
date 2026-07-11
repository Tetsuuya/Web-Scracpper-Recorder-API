# Web Screen Capture Server - Project Plan

## Project Overview
Build a backend server that captures high-quality video recordings of websites based on URL and duration provided by the frontend client.

## Real Use Case (From Client)
**EduCut AI Platform - E-Learning Video Generation**

This server is part of a larger system:
- **Purpose**: Capture educational animations from client's e-learning platform
- **Platform URL**: https://v0-educut-ai-platform.vercel.app/demo/*
- **Content**: Animated explanations of concepts (finance, etc.)
- **Future**: Add voice-over from JSON (timestamp + text parameters)

**Client's Previous Attempts:**
- ❌ Playwright: Quality issues
- ❌ Remotion: Quality issues
- ✅ Puppeteer: Trying now (uses 5x GPU but worth it if quality is good)

**Priority**: Video capture quality > Everything else

## Core Requirements

### Input (from Frontend)
- **URL**: The website/web page to capture
- **Duration**: How long to record the page (in seconds)

### Output (to Frontend)
- **Video File**: High-quality screen capture of the URL
- **Public URL**: Link to access the captured video

### Priority (from Client)
1. **VIDEO CAPTURE QUALITY** (Priority #1)
   - Interface/visual capture is the main focus
   - Must be better quality than previous Playwright attempts
   
2. **AUDIO INTEGRATION** (Future Phase)
   - Will need FFmpeg for audio overlay later
   - Not immediate priority, but keep architecture audio-ready

## Key Technical Considerations

### Video Quality
- Must produce **very high quality** video output
- Avoid Playwright's debug mode quality issues
- Target production-grade screen recording quality
- Consider formats: MP4 (H.264/H.265) for broad compatibility

### Technology Stack Options

#### Option 1: Puppeteer with Screen Recording
- Use Puppeteer for browser automation
- Implement `page.screencast()` or similar API
- Configure for high quality (resolution, bitrate, FPS)

#### Option 2: Headless Browser + FFmpeg
- Launch headless Chrome/Chromium
- Use FFmpeg to capture the browser window
- Better control over encoding settings
- Higher quality output potential

#### Option 3: Specialized Tools
- Consider tools like:
  - **Puppeteer-screen-recorder**: Wrapper with better quality controls
  - **Chrome DevTools Protocol**: Direct protocol access for recording
  - **Selenium + FFmpeg**: Alternative automation approach

### Server Architecture

```
Frontend → API Endpoint → Processing Queue → Video Generator → Storage → Response
```

#### Components Needed
1. **API Server** (Express.js/Fastify)
   - POST endpoint to receive URL and duration
   - Request validation
   - Job queue management
   - Response with video URL

2. **Video Capture Engine**
   - Browser automation setup
   - High-quality recording configuration
   - Handle dynamic content (animations, videos, interactions)
   - Error handling for failed captures

3. **Storage System**
   - Save captured videos
   - Generate public URLs
   - Consider: Local storage, S3, Cloud Storage
   - Implement cleanup for old videos

4. **Queue System** (Optional for scalability)
   - Handle multiple concurrent requests
   - Bull/BullMQ with Redis
   - Job status tracking

## Project Timeline: 3 Days

### Day 1: Core Functionality (MVP)
**Goal**: Working server that can capture videos

**Morning Session (3-4 hours)**
- [x] Initialize Node.js project
- [ ] Set up Express server with basic structure
- [ ] Install Puppeteer + puppeteer-capture (or puppeteer-screen-recorder)
- [ ] Create POST `/api/capture` endpoint
- [ ] Input validation (URL, duration)
- [ ] Basic error handling

**Afternoon Session (3-4 hours)**
- [ ] Implement core screen recording function
- [ ] Configure high-quality settings (1080p, 60 FPS)
- [ ] Test with 2-3 animated websites
- [ ] Adjust quality/performance settings
- [ ] Return video file in response

**End of Day 1 Deliverable**: 
✅ Working API that accepts URL + duration and returns a video file

---

### Day 2: Storage, URLs & Refinement
**Goal**: Production-ready video storage and serving

**Morning Session (3-4 hours)**
- [ ] Implement video file storage system (local `/videos` folder)
- [ ] Generate unique filenames using UUID
- [ ] Set up static file serving for videos
- [ ] Create public URL generation logic
- [ ] Test file download via URL

**Afternoon Session (3-4 hours)**
- [ ] Add comprehensive error handling:
  - Invalid URLs
  - Timeout handling
  - Failed captures
  - Browser cleanup
- [ ] Implement automatic cleanup of old videos
- [ ] Add proper logging system
- [ ] Memory optimization for browser instances
- [ ] Test with various edge cases

**End of Day 2 Deliverable**: 
✅ Server with storage, public URLs, and robust error handling

---

### Day 3: Testing, Optimization & Documentation
**Goal**: Polished, tested, deployment-ready server

**Morning Session (3-4 hours)**
- [ ] Comprehensive testing:
  - Static websites
  - Animated pages (CSS/canvas)
  - Long-duration captures
  - Multiple concurrent requests
  - Invalid inputs
- [ ] Quality verification and adjustments
- [ ] Performance optimization
- [ ] Add response status tracking

**Afternoon Session (2-3 hours)**
- [ ] Create API documentation (README.md)
- [ ] Add environment configuration (.env file)
- [ ] Optional: Simple queue system if needed
- [ ] Final testing with real-world websites
- [ ] Deployment preparation
- [ ] Demo video for client

**End of Day 3 Deliverable**: 
✅ Production-ready server with documentation, ready to deploy and show client

## Technical Specifications

### API Endpoint Design

```javascript
POST /api/capture
Content-Type: application/json

Request Body:
{
  "url": "https://example.com",
  "duration": 30,  // seconds
  "options": {
    "resolution": "1920x1080",  // optional
    "fps": 60  // optional
  }
}

Response:
{
  "success": true,
  "jobId": "unique-job-id",
  "videoUrl": "https://server.com/videos/unique-id.mp4",
  "duration": 30,
  "fileSize": "15.2 MB"
}
```

### Video Quality Settings (Target)
- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 60 FPS for smooth animations
- **Video Codec**: H.264 (high profile)
- **Bitrate**: 8-10 Mbps for high quality
- **Audio**: Optional, can capture if needed

## Dependencies (Estimated)

```json
{
  "express": "^4.18.0",
  "puppeteer": "^21.0.0",
  "puppeteer-screen-recorder": "^3.0.0",
  "fluent-ffmpeg": "^2.1.0",
  "uuid": "^9.0.0",
  "dotenv": "^16.0.0"
}
```

## Potential Challenges & Solutions

### Challenge 1: Quality vs File Size
- **Issue**: High quality = large files
- **Solution**: Configurable quality settings, compression options

### Challenge 2: Dynamic Content Timing
- **Issue**: Page may load slowly, animations may start late
- **Solution**: Wait for page load, add configurable delay before recording

### Challenge 3: Resource Intensive
- **Issue**: Browser instances consume memory/CPU
- **Solution**: Queue system, instance pooling, automatic cleanup

### Challenge 4: Concurrent Requests
- **Issue**: Multiple captures at once
- **Solution**: Queue system with worker threads/processes

## Success Criteria
1. ✅ Server accepts URL and duration
2. ✅ Produces high-quality video output (better than Playwright debug mode)
3. ✅ Returns accessible video URL to frontend
4. ✅ Handles animated websites properly
5. ✅ Stable and reliable under normal load

## Next Steps
1. Start with Phase 1: Set up basic Express server
2. Implement Phase 2: Test screen capture with Puppeteer-screen-recorder
3. Compare quality output and iterate on settings
4. Show progress with demo capture of an animated website

## Notes
- Focus on **quality first**, then optimize for performance
- Test with real animated websites (not just static pages)
- Keep frontend/backend communication simple initially
- Consider adding progress updates for long captures later
