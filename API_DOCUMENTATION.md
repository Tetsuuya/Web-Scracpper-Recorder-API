# Web Screen Capture API — Documentation

**Base URL (Production):**
```
https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io
```

**UI Dashboard:**
```
https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/scrapper
```

> **Windows Users (PowerShell):** Use `curl.exe` instead of `curl`. For POST requests with a body, save your JSON to a file (e.g. `body.json`) and pass it with `@body.json` to avoid quote escaping issues.
>
> ```powershell
> # Save your request body to a file first (body.json), then:
> curl.exe -X POST "https://.../api/capture" -H "Content-Type: application/json" -d @body.json
> ```

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `POST` | `/api/capture` | Submit a new capture job |
| `GET` | `/api/capture/status/:jobId` | Poll the status of a job |
| `POST` | `/api/capture/merge` | Fast merge for decoupled edit-mode jobs |
| `GET` | `/api/capture/download/:jobId` | Download or redirect to the final video |

---

## 1. Health Check

**GET** `/health`

```bash
curl https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Web Capture Server is running",
  "timestamp": "2026-07-15T10:00:00.000Z"
}
```

---

## 2. Submit a Capture Job

**POST** `/api/capture`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ Yes | The website URL to capture (must be http/https) |
| `duration` | number | ✅ Yes | Recording duration in seconds (max: 300) |
| `quality` | string | No | Quality preset (default: `high`) |
| `script` | string | No | Legacy single voice-over script text (mutually exclusive with `ttsSegments`) |
| `ttsSegments` | array | No | List of multiple voice-over segments with start timestamps |
| `language` | string | No | TTS language (default: `en-US`) |
| `voice` | string | No | TTS voice (default: `male-foundation`) |
| `interactions` | array | No | List of page interactions to perform |
| `options` | object | No | Custom overrides for resolution/fps/autoScroll/editMode |

### Quality Presets

| Preset | Resolution | FPS | Description |
|--------|-----------|-----|-------------|
| `superfast` | 1280x720 | 24 | Quick testing |
| `fast` | 1280x720 | 30 | Normal testing |
| `medium` | 1920x1080 | 30 | Balanced quality |
| `high` | 1920x1080 | 60 | High quality *(default)* |
| `ultrahigh` | 1920x1080 | 60 | Best quality, slowest |
| `smooth` | 1920x1080 | 120 | Ultra smooth animations |

### Options Object

| Field | Type | Description |
|-------|------|-------------|
| `width` | number | Custom width (320–3840) |
| `height` | number | Custom height (240–2160) |
| `fps` | number | Custom FPS (15–60) |
| `autoScroll` | boolean | Auto-scroll the page during recording |
| `editMode` | boolean | Enables decoupled editing timeline mode (skips immediate mixing, returns separate tracks) |

### Interactions Array

Each interaction object supports:

| Action | Required Fields | Optional Fields |
|--------|----------------|-----------------|
| `scroll` | — | `amount` (px), `delay` (ms) |
| `click` | `selector` | `delay` (ms) |
| `hover` | `selector` | `delay` (ms) |
| `type` | `selector`, `text` | `delay` (ms) |
| `wait` | — | `time` (ms) |

### TTS Segments Array Format

When submitting multiple voice-over clips, specify each segment in `ttsSegments`:

```json
"ttsSegments": [
  {
    "timespamptStart": "00:00:00",
    "TexttoTTS": "Welcome to Finance Flow, your trusted financial management platform."
  },
  {
    "timespamptStart": "00:00:07",
    "TexttoTTS": "Whether you are tracking your income and expenses, Finance Flow has you covered."
  }
]
```

* `timespamptStart` *(string)*: The start timestamp for the segment. Can be formatted as `HH:MM:SS` (e.g. `"00:00:07"`), seconds only (e.g. `"7"`), or minutes/seconds (e.g. `"1:15"`).
* `TexttoTTS` *(string)*: The voice-over script text to synthesize for this segment.

---

### CURL Examples

#### Basic capture (no voice-over):
```bash
curl -X POST \
  https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "duration": 10,
    "quality": "high"
  }'
```

#### Capture with voice-over script:
```bash
curl -X POST \
  https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://v0-educut-ai-platform.vercel.app/demo/finance",
    "duration": 30,
    "quality": "high",
    "script": "Welcome to Finance Flow, your trusted financial management platform designed to make handling your finances simple and efficient. Whether you are tracking your income and expenses, managing budgets, monitoring transactions, or analyzing your financial progress, Finance Flow provides the tools you need in one convenient place. Our goal is to help you stay organized, make informed financial decisions, and achieve your financial goals with confidence through a secure, user-friendly, and reliable experience",
    "voice": "male-foundation",
    "language": "en-US"
  }'
```

#### Capture in Decoupled Edit Mode (multiple segments):
```bash
curl -X POST \
  https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "duration": 15,
    "quality": "high",
    "options": {
      "editMode": true
    },
    "ttsSegments": [
      {
        "timespamptStart": "00:00:00",
        "TexttoTTS": "This is segment one."
      },
      {
        "timespamptStart": "00:00:06",
        "TexttoTTS": "This is segment two."
      }
    ]
  }'
```

#### Capture with auto-scroll:
```bash
curl -X POST \
  https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "duration": 15,
    "quality": "medium",
    "options": {
      "autoScroll": true
    }
  }'
```

#### Capture with custom interactions:
```bash
curl -X POST \
  https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "duration": 20,
    "quality": "high",
    "interactions": [
      { "action": "wait", "time": 2000 },
      { "action": "scroll", "amount": 500 },
      { "action": "click", "selector": "#hero-button", "delay": 1000 },
      { "action": "wait", "time": 2000 }
    ]
  }'
```

### Response (202 Accepted):
```json
{
  "success": true,
  "message": "Capture job enqueued successfully",
  "data": {
    "jobId": "0cda22f3-8eaf-4888-bfc6-6c771aa3f9c1",
    "status": "queued",
    "createdAt": "2026-07-15T10:17:05.000Z"
  }
}
```

---

## 3. Poll Job Status

**GET** `/api/capture/status/:jobId`

```bash
curl https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture/status/0cda22f3-8eaf-4888-bfc6-6c771aa3f9c1
```

### Job Status Values

| Status | Meaning |
|--------|---------|
| `queued` | Job is waiting in queue |
| `processing` | Job is currently running |
| `completed` | Job finished successfully |
| `failed` | Job encountered an error |

### Response (completed job):
```json
{
  "success": true,
  "data": {
    "jobId": "0cda22f3-8eaf-4888-bfc6-6c771aa3f9c1",
    "status": "completed",
    "videoUrl": "https://pub-5547cb5674e6427d8f5eeeefffa3482f.r2.dev/capture-7aed991b.mp4",
    "filename": "capture-7aed991b.mp4",
    "metrics": {
      "total_duration": 285.99,
      "capture_duration": 271.69,
      "tts_duration": 9.92,
      "merge_duration": 0.66
    },
    "completed_at": "2026-07-15T10:22:01.296Z"
  }
}
```

---

## 4. Final Fast Merge (Decoupled Edit Mode)

**POST** `/api/capture/merge`

Enables instant merging of the captured silent video with synthesised voiceover segments at chosen timestamps. Runs in **~1 second** using FFmpeg.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | string | ✅ Yes | The original capture job ID |
| `ttsSegments` | array | ✅ Yes | List of `{ filename, timespamptStart }` objects to merge |

```bash
curl -X POST \
  https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture/merge \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "0cda22f3-8eaf-4888-bfc6-6c771aa3f9c1",
    "ttsSegments": [
      { "filename": "tts-seg-0.mp3", "timespamptStart": "00:00:00" },
      { "filename": "tts-seg-1.mp3", "timespamptStart": "00:00:07" }
    ]
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Video and audio segments merged successfully",
  "data": {
    "jobId": "0cda22f3-8eaf-4888-bfc6-6c771aa3f9c1",
    "status": "completed",
    "videoUrl": "https://pub-5547cb5674e6427d8f5eeeefffa3482f.r2.dev/merged-output.mp4",
    "filename": "merged-output.mp4"
  }
}
```

---

## 5. Download Video

**GET** `/api/capture/download/:jobId`

```bash
curl -L https://web-scrapper-recorder-api.jollygrass-a22ba7ee.northeurope.azurecontainerapps.io/api/capture/download/0cda22f3-8eaf-4888-bfc6-6c771aa3f9c1
```

> If the video is stored on Cloudflare R2, this endpoint redirects to the public R2 URL automatically.

---

## 6. How to Use Decoupled Edit Mode (User Guide)

Follow these steps to fine-tune and align voiceovers perfectly with your screen capture:

1. **Enable Text-to-Speech**: Check the "Add Text-to-Speech Voiceover" checkbox on the dashboard.
2. **Add Segments**: Split your voiceover script into separate sentences/segments, and input their relative start times (e.g. `00:00:00` for Segment 1, `00:00:07` for Segment 2, etc.).
3. **Enable Edit Mode**: Check the "Enable Edit Mode" checkbox and click "Start Screen Capture".
4. **Inspect Silent Output**: Once the browser capture completes, the dashboard will show a silent preview video and list individual voice clips below it.
   * **Why is the video silent?** In Edit Mode, the video and voiceover segments are generated separately and are not merged yet. This allows you to listen to them independently and align them before mixing.
5. **Fine-tune Timings (Previewing Video & Audio)**: 
   * Play the silent preview video to note visual landmarks (e.g., *"The budget section scrolls in at exactly 00:00:08"*).
   * Click **"🔊 Preview Audio"** next to each segment to hear the synthesized TTS voice output.
   * Adjust the segment start timestamps to match the video landmarks you observed (e.g. set Segment 2 to start at `00:00:08`).
6. **Merge & Finalize**: Click "Merge & Finalize Video". FFmpeg will mix the tracks instantly (~1s), loading the combined, high-quality audio video into the player!

---

## Typical Flow for Frontend Integration

### A. Direct Rendering Flow (Simple)
```
1. POST /api/capture           → receive jobId (with editMode = false)
2. Poll GET /api/capture/status/:jobId every 5-10 seconds
3. When status === "completed" → load final merged videoUrl in player
```

### B. Decoupled Edit Mode Flow (With Timeline adjustment)
```
1. POST /api/capture           → receive jobId (with editMode = true)
2. Poll GET /api/capture/status/:jobId every 5-10 seconds
3. When status === "completed" → load silent videoUrl and display segments list with start inputs
4. User adjusts timing values  → triggers POST /api/capture/merge
5. Instant merge response      → load final merged videoUrl in player
```

---

## Performance Benchmarks (Azure — 4 CPU / 8 Gi — North Europe)

| Step | Time |
|------|------|
| TTS generation (Replicate) | ~3s |
| Website capture (high preset, 30s video) | ~110s |
| Audio/video merge (FFmpeg) | ~0.6s |
| Upload to Cloudflare R2 | ~4s |
| **Total (high preset, 30s video)** | **~115s (~2 minutes)** |

> Once GPU acceleration (Vast.ai) is integrated, capture and encoding times are expected to drop significantly further.

---

## Notes for Frontend Integration

- The API is **asynchronous** — submit the job and poll for status. Do not wait on the POST request.
- Videos are stored on **Cloudflare R2** and served via public CDN URL.
- The `videoUrl` in the completed job response is a direct playable/downloadable link.
- CORS is enabled — the API accepts requests from any origin.
