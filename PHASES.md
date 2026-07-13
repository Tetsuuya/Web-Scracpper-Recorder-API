# Next Phases - Development Roadmap

## Phase 1: TTS Audio Overlay Feature
**Priority: HIGH**

### Overview
Add text-to-speech functionality to generate audio from scripts and merge with screen capture videos.

### API Input (from frontend)
```json
{
  "url": "https://example.com/page",
  "script": "Welcome to our website. This is a demonstration of our product.",
  "language": "en-US",
  "voice": "male-foundation"
}
```

### Backend Workflow
1. Receive URL + script + language parameters
2. Capture website video (Puppeteer)
3. Generate speech audio (Replicate API for TTS)
4. Merge audio with video using FFmpeg
5. Return final video URL

### Technical Requirements
- Integrate Replicate API for TTS
- Language selection support
- Audio/video sync timing
- FFmpeg audio overlay capabilities

---

## Phase 2: Quality Presets System
**Priority: MEDIUM**

### Overview
Implement configurable quality presets for video capture to balance quality vs processing time.

### Presets Definition

| Preset | Quality | Speed | Use Case |
|--------|---------|-------|----------|
| `superfast` | Low | Fastest | Quick tests, thumbnails |
| `fast` | Medium | Fast | Drafts, previews |
| `standard` | High | Normal | Final deliverables |
| `ultra` | Highest | Slow | High-quality production |

### Implementation
- Use existing `config/qualityPresets.js`
- Parameters per preset:
  - Resolution
  - Frame rate
  - Bitrate
  - Puppeteer options (headless, timeout)
  - FFmpeg encoding settings

### Example Usage
```javascript
// Frontend sends:
{
  "url": "https://example.com",
  "preset": "fast"  // or "ultra", "standard", "superfast"
}
```

---

## Phase 3: Logging & Performance Monitoring
**Priority: MEDIUM**

### Objectives
- Track processing time per task type
- Monitor system performance
- Identify bottlenecks
- Enable debugging and optimization

### Metrics to Log

| Metric | Description |
|--------|-------------|
| `capture_duration` | Time to record video (seconds) |
| `tts_duration` | Time to generate TTS audio (seconds) |
| `merge_duration` | Time to merge audio+video (seconds) |
| `total_duration` | End-to-end processing time |
| `memory_usage` | RAM consumption |
| `error_count` | Failures per task type |

### Implementation
```javascript
// Logger example
{
  timestamp: "2026-07-13T10:30:00Z",
  taskId: "capture-123",
  type: "capture",
  url: "https://example.com",
  preset: "fast",
  metrics: {
    capture_duration: 45.2,
    total_duration: 52.8,
    memory_usage: "512MB"
  },
  status: "completed"
}
```

### Storage
- JSON log files in `/logs` directory
- Structured logging with winston/pino
- Optional: Export to monitoring service (Datadog, etc.)

---

## Phase 4: Request Queue System
**Priority: MEDIUM**

### Objectives
- Process requests sequentially (not parallel)
- Prevent system overload
- Handle high load gracefully
- Provide job status tracking

### Architecture

```
Client Request → Queue → Worker Process → Storage → Client Notification
```

### Implementation Options

#### Option A: In-Memory Queue (Simple)
- Use `p-queue` or `bull` for Node.js
- Store job status in memory/Redis
- Suitable for single-server deployment

#### Option B: Redis Queue (Production)
- `bull` with Redis backend
- Distributed processing
- Job persistence
- Better for scale

### Job States
```
pending → processing → completed | failed
```

### API Endpoints
- `POST /api/capture` - Add job to queue, return jobId
- `GET /api/status/:jobId` - Check job status
- `GET /api/download/:jobId` - Download completed video

---

## Phase 5: Docker & Deployment
**Priority: HIGH**

### Dockerfile Structure
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN apt-get update && apt-get install -y ffmpeg
EXPOSE 3000
CMD ["node", "server.js"]
```

### Deployment Options

#### Option A: Render (Recommended for Stability)
**Pros:**
- Stable uptime, no interruptions
- Easy Docker deployment
- Built-in SSL/custom domains
- Works well with Cloudflare

**Pricing:**
- Web Service: $25+/month (basic)
- Suitable for: Main API server, queue system

#### Option B: VastAI (Cost-Effective GPU)
**Pros:**
- Cheaper GPU: $0.29-$0.59/hr vs $2.79/hr on AWS
- Good for TTS processing

**Cons:**
- Interruptible instances (jobs can be killed)
- Manual setup required
- Data expires after 48 hours
- Less reliable

**Best For:** GPU-heavy tasks, batch processing

#### Recommended: Hybrid Approach
| Service | Role | Why |
|---------|------|-----|
| Render | Main API + Queue | Stability, persistence |
| VastAI | GPU workers (on-demand) | Cost savings for TTS |

### Scale Strategy
- Start with Render (stable, simple)
- Add VastAI workers for GPU processing later
- Implement scale-to-zero for cost efficiency
- Use Cloudflare for domain protection (credits available)

---

## Phase 6: Frontend Interface (Optional)
**Priority: LOW - Defer**

When core features are stable:
- Simple UI for:
  - URL input
  - Script text area
  - Language selector
  - Quality preset dropdown
  - Job status display
  - Video download

---

## Execution Order

```
Phase 1 (TTS) → Phase 2 (Quality) → Phase 3 (Logging) → Phase 4 (Queue) → Phase 5 (Deploy)
```

Each phase builds on the previous. Complete in order for stability.

---

## Notes

- Client available via message only for 2 days (7/12-7/14)
- Use best judgment when blocking issues arise
- Test with small videos first, then 3-minute videos for robustness
- Focus on screen capture stability as priority