#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import { loadConfig, ensureDir } from './config/config';
import { initDB, upsertProcessedVideo, getProcessedVideosByStatus, getAllProcessedVideos, addUploadedShort } from './state/database';
import { getYouTubeClient, fetchChannelVideos } from './youtube/client';
import { downloadVideo } from './video/downloader';
import { analyzeVideo } from './video/analyzer';
import { AIContentPlanner, MetadataGenerator } from './ai/ai-service';
import { createShort } from './video/processor';
import { uploadShort } from './youtube/uploader';
import logger from './utils/logger';
import { formatDuration } from './utils/time-utils';
import { parseISODuration } from './utils/duration';
import * as fs from 'fs';

// Load config early
let config = loadConfig();

const program = new Command();

program
  .name('yts')
  .description('YouTube Shorts Generator — turn long videos into Shorts automatically')
  .version('1.0.0');

/**
 * Initialize OAuth credentials
 */
program
  .command('init')
  .description('Authenticate with YouTube (OAuth2)')
  .action(async () => {
    console.log('\n=== YouTube Shorts Generator — Initial Setup ===\n');
    console.log('This opens a browser for you to authorize this app to manage your YouTube channel.\n');

    const { google } = require('googleapis');
    const oauth2Client = require('./youtube/auth').getOAuth2Client(config.youtube);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: config.youtube.scopes,
      prompt: 'consent',
    });

    console.log(`1. Open this URL in your browser:\n   ${authUrl}\n`);
    console.log('2. Grant access and copy the authorization code.\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const code = await new Promise<string>((resolve) => {
      readline.question('3. Paste the code here: ', (answer: string) => {
        readline.close();
        resolve(answer.trim());
      });
    });

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      require('./youtube/auth').saveToken(config.youtube, tokens);
      console.log('\n✅ Authentication successful! Token saved.\n');
    } catch (err) {
      logger.error('Failed to exchange code for token:', err);
      process.exit(1);
    }
  });

/**
 * Fetch and list channel videos
 */
program
  .command('fetch')
  .description('List your public YouTube videos')
  .option('--limit <N>', 'Max videos to fetch (0 = all)', '50')
  .action(async (options) => {
    try {
      const limit = parseInt(options.limit, 10) || 50;
      initDB();
      const yt = await getYouTubeClient(config.youtube);
      const videos = await fetchChannelVideos(config.youtube, limit);

      console.log(`\nFound ${videos.length} public videos:\n`);
      videos.forEach((v, idx) => {
        console.log(`${idx + 1}. ${v.title}`);
        console.log(`   ID: ${v.id}`);
        console.log(`   Duration: ${parseISODuration(v.duration)}`);
        console.log(`   Published: ${v.publishedAt.split('T')[0]}\n`);
      });
    } catch (err) {
      logger.error(err);
      process.exit(1);
    }
  });

/**
 * Process a single video into Shorts
 */
program
  .command('process <videoId>')
  .description('Download and generate Shorts from one video')
  .option('--output-dir <dir>', 'Output directory', config.processing.outputDir)
  .option('--ai-highlights', 'Use AI to select highlights (default: true)', 'true')
  .action(async (videoId, options) => {
    try {
      initDB();
      const outDir = options.outputDir || config.processing.outputDir;
      ensureDir(outDir);

      upsertProcessedVideo(videoId, 'processing');

      const yt = await getYouTubeClient(config.youtube);

      // Fetch video metadata
      const videoRes = await yt.videos.list({
        part: ['snippet', 'contentDetails'],
        id: [videoId],
      });
      const snippet = videoRes.data.items?.[0]?.snippet;
      if (!snippet) throw new Error('Video not found');

      const videoTitle = snippet.title;
      const videoContentDetails = videoRes.data.items[0].contentDetails!;
      const durationSec = parseISODuration(videoContentDetails.duration!);

      // Download
      const { filePath } = await downloadVideo(videoId, config.processing.tempDir);

      // Generate highlights
      const aiPlanner = new AIContentPlanner(config.ai);
      const highlights = await analyzeVideo(yt, videoId, videoTitle, durationSec, aiPlanner);

      if (highlights.length === 0) {
        logger.warn('No suitable highlights found for this video');
        upsertProcessedVideo(videoId, 'failed');
        process.exit(1);
      }

      console.log(`\nFound ${highlights.length} highlight(s):`);

      // Process each highlight
      const generatedShorts: string[] = [];
      for (let i = 0; i < highlights.length; i++) {
        const h = highlights[i];
        console.log(`\n[${i + 1}/${highlights.length}] ${formatDuration(h.start)}–${formatDuration(h.end)}: ${h.reason}`);

        const outFile = path.join(outDir, `${videoId}_short${i + 1}.mp4`);
        if (fs.existsSync(outFile)) {
          console.log(`  Already exists: ${outFile}`);
          generatedShorts.push(outFile);
          continue;
        }

        const shortPath = await createShort(
          filePath,
          h.start,
          h.end,
          h.textOverlay || 'Watch more!',
          config.video,
          outDir as any // outputDir passed here
        );
        generatedShorts.push(shortPath);
      }

      upsertProcessedVideo(videoId, 'completed', highlights.length);
      console.log(`\n✅ Generated ${generatedShorts.length} Short(s). Output: ${outDir}`);
    } catch (err) {
      logger.error(err);
      upsertProcessedVideo(videoId, 'failed');
      process.exit(1);
    }
  });

/**
 * Upload a generated Short
 */
program
  .command('upload <file>')
  .description('Upload a video file as a YouTube Short')
  .option('--title <title>', 'Video title (extracted from filename if not provided)')
  .option('--description <desc>', 'Video description')
  .option('--privacy <level>', 'Privacy: public|unlisted|private', 'public')
  .option('--tags <list>', 'Comma-separated tags')
  .action(async (filePath, options) => {
    try {
      initDB();
      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

      let title = options.title || path.basename(filePath, path.extname(filePath));
      title = title.replace(/[_\-]/g, ' ').trim();

      const description = options.description || `Generated by YouTube Shorts Generator\n#shorts #viral`;
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : config.upload.tagsDefault;

      const videoId = await uploadShort(
        filePath,
        title,
        description,
        config.youtube,
        config.upload,
        tags,
        { privacy: options.privacy as any }
      );

      addUploadedShort({
        shortId: videoId,
        sourceVideoId: 'unknown',
        title,
        description,
        publishedAt: new Date().toISOString(),
      });

      console.log(`\n✅ Uploaded: https://youtube.com/shorts/${videoId}`);
    } catch (err) {
      logger.error(err);
      process.exit(1);
    }
  });

/**
 * Full pipeline: fetch → process → upload (batch)
 */
program
  .command('full-run')
  .description('Fetch recent videos, generate Shorts, and upload')
  .option('--limit <N>', 'Max videos to process', '5')
  .option('--dry-run', 'Skip actual upload', false)
  .action(async (options) => {
    try {
      initDB();
      const limit = parseInt(options.limit, 10) || 5;
      const dryRun = options.dryRun;

      console.log(`\nStarting full run: ${limit} video(s)${dryRun ? ' [DRY-RUN]' : ''}\n`);

      const yt = await getYouTubeClient(config.youtube);
      const allVideos = await fetchChannelVideos(config.youtube, limit);

      const pendingVideos = allVideos.filter((v) => {
        const record = getProcessedVideosByStatus('completed').find((p: any) => p.videoId === v.id);
        return !record;
      });

      console.log(`Videos to process: ${pendingVideos.length}\n`);

      const aiPlanner = new AIContentPlanner(config.ai);
      const metadataGen = new MetadataGenerator(config.ai);

      for (let i = 0; i < pendingVideos.length; i++) {
        const video = pendingVideos[i];
        console.log(`\n=== [${i + 1}/${pendingVideos.length}] Processing: ${video.title} ===\n`);

        try {
          upsertProcessedVideo(video.id, 'processing');

          // Download
          const { filePath, durationSec } = await downloadVideo(video.id, config.processing.tempDir);

          // Get highlights
          const highlights = await analyzeVideo(yt, video.id, video.title, durationSec, aiPlanner);
          if (highlights.length === 0) {
            console.log('  No highlights found, skipping.');
            upsertProcessedVideo(video.id, 'failed');
            continue;
          }

          // Generate each Short
          for (let j = 0; j < highlights.length; j++) {
            const h = highlights[j];
            console.log(`  Short ${j + 1}: ${formatDuration(h.start)}–${formatDuration(h.end)}`);

            const shortPath = await createShort(
              filePath,
              h.start,
              h.end,
              h.textOverlay || 'Watch more!',
              config.video,
              config.processing.outputDir
            );

            const meta = await metadataGen.generate(video.title);
            const finalTitle = `${meta.title} #shorts`;
            const finalDescription = `${meta.description}\n\nSource: ${video.title}\n#shorts ${meta.hashtags.join(' ')}`;

            if (dryRun) {
              console.log(`  [DRY-RUN] Would upload: ${shortPath}`);
              console.log(`    Title: ${finalTitle}`);
              console.log(`    Tags: ${meta.hashtags.join(', ')}`);
            } else {
              const shortId = await uploadShort(
                shortPath,
                finalTitle,
                finalDescription,
                config.youtube,
                config.upload,
                meta.hashtags
              );
              addUploadedShort({
                shortId,
                sourceVideoId: video.id,
                title: finalTitle,
                description: finalDescription,
                publishedAt: new Date().toISOString(),
              });
            }
          }

          upsertProcessedVideo(video.id, 'completed', highlights.length);
          console.log(`  ✅ Finished ${video.id}`);
        } catch (err) {
          logger.error(`Error processing ${video.id}:`, err);
        }
      }

      console.log('\n✅ All done!');
    } catch (err) {
      logger.error('Full run failed:', err);
      process.exit(1);
    }
  });

/**
 * Dashboard — show statistics
 */
program
  .command('dashboard')
  .description('Show processing and upload statistics')
  .action(() => {
    initDB();
    const all = getAllProcessedVideos();

    const counts: Record<string, number> = {};
    for (const v of all) {
      counts[v.status] = (counts[v.status] || 0) + 1;
    }

    console.log('\n=== Dashboard ===\n');
    console.log('Processed videos:');
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`  ${status.padEnd(12)}: ${count}`);
    });
    console.log(`  Total: ${all.length}\n`);

    const completed = all.filter((v) => v.status === 'completed');
    const totalShorts = completed.reduce((sum, v) => sum + v.shortsCount, 0);
    console.log(`Shorts generated: ${totalShorts}\n`);
  });

// Run CLI
program.parse();
