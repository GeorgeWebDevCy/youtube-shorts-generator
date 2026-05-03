const path = require('path');
const { createShort } = require('../dist/video/processor');
const { loadConfig } = require('../dist/config/config');
const fs = require('fs');

async function runDemo() {
  console.log('=== YouTube Shorts Generator — Local Demo ===\n');
  
  const inputVideo = path.resolve(__dirname, 'test_input.mp4');
  const outDir = path.resolve(__dirname, 'outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const config = loadConfig();
  console.log('Config loaded, video config:', config.video);

  // Highlight: first 30 seconds
  const start = 0;
  const end = 30;
  const textOverlay = 'Check out this demo! #shorts';

  console.log(`Input:  ${inputVideo}`);
  console.log(`Output: ${outDir}/demo_short.mp4`);
  console.log(`Segment: ${formatDuration(start)} – ${formatDuration(end)}\n`);

  try {
    const shortPath = await createShort(inputVideo, start, end, textOverlay, config.video, outDir);
    console.log('\n✅ Short created:', shortPath);
  } catch (err) {
    console.error('ERROR:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

runDemo();
