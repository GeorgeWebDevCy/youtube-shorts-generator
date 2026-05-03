# YouTube Shorts Generator

Automatically turn your long-form YouTube videos into viral Shorts using AI.

**Features**
- Fetches all public videos from your YouTube channel
- AI-powered highlight detection (GPT-4o or Claude)
- Automatic caption selection via YouTube captions
- Generates 9:16 vertical videos with burned-in text overlays
- Uploads directly to YouTube as Shorts
- Tracks processed videos in a local SQLite database

**Tech Stack**
- Node.js + TypeScript
- FFmpeg for video processing
- YouTube Data API v3
- OpenAI GPT-4o / Anthropic Claude

## Installation

```bash
# Clone the repo
cd youtube-shorts-generator

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## Setup

### 1. YouTube OAuth Credentials

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project (or use existing)
- Enable **YouTube Data API v3**
- Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
- Choose **Desktop application**
- Download the JSON file and save to `~/.youtube-shorts/client_secret.json`

### 2. API Keys

Copy `.env.example` to `.env` and add your AI API keys:

```bash
cp .env.example .env
# Edit .env with your keys
```

Or set environment variables:
```bash
export OPENAI_API_KEY=sk-...
# or
export CLAUDE_API_KEY=sk-...
```

### 3. Install FFmpeg

**Ubuntu/Debian:** `sudo apt install ffmpeg`
**macOS:** `brew install ffmpeg`
**Windows (WSL):** `sudo apt install ffmpeg` inside WSL

Verify: `ffmpeg -version`

## Configuration

Edit `config.yaml` (copy from example):

```bash
cp config.yaml.example config.yaml
```

Key options:
- `video.resolution`: default 1080x1920
- `video.max_duration_sec`: 60 (YouTube Shorts limit)
- `processing.output_dir`: where generated Shorts are saved
- `upload.privacy`: `public`, `unlisted`, or `private`
- `ai.provider`: `openai` or `claude`

## Usage

### Initial Authentication

```bash
npx tsx src/index.ts init
# or after build:
npm start -- init
```

Follow the browser flow to grant access. Your token is saved to `~/.youtube-shorts/token.json`.

### List Your Videos

```bash
yts fetch --limit 10
```

### Process One Video

```bash
yts process <VIDEO_ID>
```

 Downloads the video, selects 1–3 highlight segments, generates Shorts in `outputs/`.

### Full Pipeline (Fetch → Process → Upload)

```bash
# Dry-run first (no uploads)
yts full-run --limit 3 --dry-run

# Real run
yts full-run --limit 5
```

This will:
1. Fetch your recent public videos
2. Download each one
3. Extract AI-selected highlights
4. Generate Short MP4 files
5. Upload to YouTube (unless `--dry-run`)

### View Statistics

```bash
yts dashboard
```

### Manual Upload (if you already have a video file)

```bash
yts upload ./outputs/my-short.mp4 --title "Amazing Moment!" --privacy unlisted
```

## How It Works

1. **Fetch**: Uses YouTube Data API to list your channel's public videos
2. **Captions**: Downloads YouTube captions (or falls back to rule-based heuristics)
3. **AI Highlight Selection**: Sends transcript to GPT-4/Claude to pick engaging 5–60s moments
4. **Render**: FFmpeg crops to 9:16, adds bold text overlay, encodes H.264
5. **Upload**: Resumable upload to YouTube with auto-generated title/description/hashtags

## Project Structure

```
youtube-shorts-generator/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── config/            # Config loader & types
│   ├── youtube/           # YouTube API client, auth, uploader
│   ├── video/             # Downloader, analyzer, processor
│   ├── ai/                # OpenAI & Claude wrappers
│   ├── state/             # SQLite DB for tracking
│   └── utils/             # Logger, time/file helpers
├── config.yaml            # User configuration
├── .env                   # API keys
├── outputs/               # Generated Shorts (gitignored)
├── videos/                # Cached source videos (gitignored)
└── data/                  # SQLite DB (gitignored)
```

## Troubleshooting

**`ffmpeg: command not found`**
- Install ffmpeg: see above

**Authentication errors**
- Delete `~/.youtube-shorts/token.json` and re-run `yts init`
- Ensure your OAuth client secret path is correct in `config.yaml`

**No captions found**
- Videos without captions fall back to rule-based highlights (start/middle/end)
- You can enable auto-generated captions on YouTube Studio

**YouTube API quota exceeded**
- YouTube Data API has a 10,000 unit daily quota. Each `videos.list` costs 1 unit. The tool batches requests to minimize usage.
- Consider requesting a quota increase or spread processing over multiple days.

**Upload fails with "403Forbidden"**
- Ensure your OAuth token has `youtube.upload` scope
- Re-authenticate with `yts init`

## Development

```bash
# Run in dev mode (tsx hot-reload not supported for CLI, but fast compile)
npm run dev -- process <VIDEO_ID>

# Build
npm run build

# Run built version
node dist/index.js fetch
```

## Roadmap

- [ ] Local Whisper transcription (no YouTube captions required)
- [ ] Multiple AI highlight strategies (engagement prediction, hook detection)
- [ ] Royalty-free background music library
- [ ] Thumbnail generation
- [ ] Scheduling uploads (queue)
- [ ] Web dashboard (Electron)

## License

MIT
