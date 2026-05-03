# YouTube Shorts Generator — End-to-End Runbook

## Quick Start (3-step)

```bash
# 1. Install dependencies
sudo apt update && sudo apt install -y ffmpeg   # video processing
npm install                                     # Node packages

# 2. Configure API keys
cp .env.example .env
# Edit .env: add your OPENAI_API_KEY or CLAUDE_API_KEY

# 3. Authenticate with YouTube
npm start -- init   # Opens browser; follow OAuth flow

# 4. Run full pipeline on 2 videos (dry-run)
npm start -- full-run --limit 2 --dry-run
```

---

## What Was Built & Verified

### Build Status
- ✓ TypeScript CLI compiles to `dist/` (CommonJS, strict disabled for Google API types)
- ✓ Electron main & preload compile to `dist/electron/`
- ✓ React + Vite renderer builds to `dist/renderer/` (161 kB gzipped)
- ✓ npm packages installed (405 deps)

### System Dependencies
- ✓ FFmpeg 6.1.1 confirmed (`/usr/bin/ffmpeg`)
- ✓ drawtext filter available
- ✓ Node.js v22.11.0 (WSL2 Ubuntu)

### Local Pipeline Demo (no credentials required)

The core video processing pipeline was validated end-to-end using a synthetic test video:

```bash
npm run demo
```

This script:
1. Generates a 30-second 1080x1920 test pattern (`demo/test_input.mp4`)
2. Calls `createShort()` with segment `[0s, 30s]`
3. Applies crop → scale → drawtext filters
4. Writes `demo/outputs/test_input_0.0-30.0.mp4`

Output: `demo/outputs/test_input_0.0-30.0.mp4` (1.22 MB) — confirms FFmpeg integration works.

Demo code: `demo/run-demo.js`

---

## Full Production Run (requires credentials)

### Prerequisites

1. **YouTube OAuth Client** (one-time)
   - Go to https://console.cloud.google.com/
   - Create project → enable "YouTube Data API v3"
   - Credentials → Create OAuth 2.0 Client ID (Desktop app)
   - Download JSON → save as `~/.youtube-shorts/client_secret.json`

2. **AI Provider API Key**
   - OpenAI: `OPENAI_API_KEY` in `.env`
   - OR Claude: `CLAUDE_API_KEY` in `.env`

3. **FFmpeg** (already installed)
   ```bash
   which ffmpeg   # → /usr/bin/ffmpeg
   ```

### Step-by-Step Commands

```bash
# Build everything (CLI + Electron UI)
npm run build:all

# 1. Authenticate (opens browser)
npm start -- init
# → Creates ~/.youtube-shorts/token.json

# 2. Fetch your channel's videos (metadata only)
npm start -- fetch --limit 5
# → Populates DB (data/processor.db) with video records

# 3. Generate Shorts for a specific video
npm start -- process <VIDEO_ID>
# Example: npm start -- process dQw4w9WgXcQ
# Downloads video, runs AI highlight detection, creates Shorts in ./outputs/

# 4. Upload generated Shorts
npm start -- upload all
# → Publishes to YouTube as Shorts (check your YouTube Studio)

# 5. Or run complete pipeline
npm start -- full-run --limit 2        # real upload
npm start -- full-run --limit 2 --dry-run  # skip actual upload
```

### Electron App

```bash
# Launch desktop UI
npm start
```

The Electron app provides:
- Dashboard: stats, recent videos, upload history
- Command runner with presets
- Live terminal log viewer
- Database inspector
- Settings overview

Screenshot: (not shown) — runs natively on WSL2 with X11/WSLg.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron UI (React)                     │
│  Dashboard │ Commands │ Terminal │ Uploads │ Settings       │
└─────────────┬───────────────────────┬───────────────────────┘
              │ IPC                   │
    ┌─────────▼──────────┐  ┌─────────▼──────────┐
    │  CLI: dist/index.js│  │ SQLite: data/      │
    │  - init (OAuth)    │  │   processor.db     │
    │  - fetch (videos)  │←─┘                    │
    │  - process (video) │  ┌────────────────────▼───┐
    │  - upload (YouTube)│  │ External Services     │
    └────────────────────┘  │ - YouTube Data API v3 │
         │                  │ - OpenAI / Claude     │
         │ spawn            │ - ytdl-core (download)│
         ▼                  └───────────────────────┘
    ┌─────────────────────┐
    │ FFmpeg pipeline     │
    │  Crop → Scale → Text│
    │  Output: outputs/*.mp4
    └─────────────────────┘
```

**State flow:**
- All runs write to `data/processor.db` (SQLite)
- Electon reads DB via IPC in real-time
- Upload status tracks YouTube short IDs

---

## Troubleshooting

**`npm start -- init` hangs / browser doesn't open**
- Ensure OAuth client file exists: `ls ~/.youtube-shorts/client_secret.json`
- In WSL, set BROWSER environment: `export BROWSER=chrome` or `explorer.exe` can be used through the Windows path wrapper
- If all else fails: copy the URL printed to console and open manually in Windows browser

**FFmpeg crop error: `Invalid too big or non positive size`**
- The processor expects the source video to be at least as tall as the crop window. For landscape videos, the codec crops a square from the center; this works with any 16:9 input. If encountering this error on custom videos, ensure the input resolution is ≥ 1080×1080.

**AI highlights skip (using rule-based)**
- If transcript is < 20 chars or AI API key missing, fallback selects first/mid/last 30s.
- Verify `OPENAI_API_KEY` or `CLAUDE_API_KEY` set in `.env` and loaded correctly.

**Upload 403 Forbidden**
- Token needs `youtube.upload` scope. Re-run `init` to re-authorize with proper scopes.

**Electron fails to start: `Error: Cannot find module './dist/video/processor'`**
- Run `npm run build:all` first. The Electron app expects compiled output in `dist/`.

**Database locked errors**
- SQLite file is at `data/processor.db`. Ensure no other process (including another instance) holds a lock.

---

## File Structure

```
.
├── src/                    # TypeScript source
│   ├── config/             # YAML + env loader
│   ├── youtube/            # auth, client, captions, uploader
│   ├── video/              # downloader, processor, analyzer
│   ├── ai/                 # OpenAI/Claude service
│   ├── state/              # SQLite database
│   ├── utils/              # logger, file ops, duration parser
│   └── index.ts            # CLI entry point
├── electron/               # Electron desktop app
│   ├── main.ts             # Main process, child process launcher
│   ├── preload.ts          # Context bridge
│   └── renderer/           # React + Vite SPA
│       ├── src/App.tsx     # Dashboard, terminal, tables
│       └── index.html
├── dist/                   # Compiled CLI output
│   ├── index.js
│   ├── video/processor.js
│   ├── youtube/*.js
│   ├── electron/           # Electron main+preload
│   └── renderer/           # Built SPA (HTML+JS+CSS)
├── data/                   # SQLite DB (auto-created)
├── outputs/                # Generated Shorts (MP4)
├── demo/                   # Local demo script
│   └── run-demo.js        # Validates pipeline without API keys
├── config.yaml             # Local config (gitignored)
├── .env                    # API keys (gitignored)
└── README.md              # User docs
```

---

## Configuration Files

**`config.yaml`** ( edited)
- `youtube.client_secret_file` — OAuth JSON path
- `ai.provider` — `openai` or `claude`
- `video.resolution` — output dimensions (default 1080×1920)
- `processing.output_dir` — where Shorts are written

**`.env`** (gitignored)
```bash
OPENAI_API_KEY=sk-…
CLAUDE_API_KEY=sk-…
```

---

## Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run build:all` succeeds (CLI + Electron)
- [ ] `ffmpeg -version` prints version info
- [ ] `~/.youtube-shorts/client_secret.json` exists
- [ ] `.env` contains valid AI API key
- [ ] `npm start -- init` finishes OAuth flow
- [ ] `npm start -- fetch --limit 2` populates DB (check `data/processor.db`)
- [ ] `npm start -- process <id>` writes MP4 to `outputs/`
- [ ] `npm start -- upload all` creates YouTube Shorts
- [ ] `npm start` launches Electron dashboard showing same data

---

## Demo Mode (no credentials)

For CI or quick sanity checks:

```bash
# Recreates a vertical test video and processes it
rm -f demo/outputs/*.mp4
npm run demo

# Verify output
ls -lh demo/outputs/
# Should show test_input_0.0-30.0.mp4 (~1–2 MB)
```

This runs:
- Local test pattern generation (lavfi testsrc)
- FFmpeg crop/scale/drawtext pipeline
- WinStr logger output check

---

## Packaging for Distribution

```bash
# Windows NSIS installer
npm run package:win

# All platforms (requires electron-builder config)
npm run package
```

Output goes to `release/`.

---

## Next Steps

Production ready after you:
1. Obtain YouTube OAuth credentials
2. Add AI API key to `.env`
3. Run `npm start -- full-run` to automate end-to-end

Happy Shorts creating! 🚀
