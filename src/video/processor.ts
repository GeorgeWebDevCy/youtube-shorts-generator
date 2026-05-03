import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import { ensureDir, safeDelete, getTempFileName } from '../utils/file-utils';
import { VideoConfig } from '../config/types';
import logger from '../utils/logger';

export interface ProcessingOptions {
  width: number;
  height: number;
  textOverlay: string;
}

/**
 * Process a video segment into a Short.
 * - Extract segment [start, end]
 * - Crop to 9:16 vertical
 * - Overlay text caption
 * - Encode MP4 H.264
 */
export async function createShort(
  inputPath: string,
  startSec: number,
  endSec: number,
  textOverlay: string,
  config: VideoConfig,
  outputDir: string
): Promise<string> {
  const duration = endSec - startSec;
  if (duration < config.minDurationSec || duration > config.maxDurationSec) {
    throw new Error(`Duration ${duration}s out of range (${config.minDurationSec}-${config.maxDurationSec})`);
  }

  ensureDir(outputDir);

  const inputName = path.basename(inputPath, path.extname(inputPath));
  const outputName = `${inputName}_${startSec.toFixed(1)}-${endSec.toFixed(1)}.mp4`;
  const outputPath = path.join(outputDir, outputName);

  if (fs.existsSync(outputPath)) {
    logger.info(`Short already exists: ${outputPath}`);
    return outputPath;
  }

  logger.info(`Processing Short: ${startSec.toFixed(1)}s–${endSec.toFixed(1)}s`);

  return new Promise<string>((resolve, reject) => {
    const command = ffmpeg(inputPath);

    command
      .setStartTime(startSec)
      .duration(duration)
      .videoFilters([
        // Crop to 9:16 center
        `crop=${config.resolution.height * 9 / 16}:${config.resolution.height}:(iw-${config.resolution.height * 9 / 16})/2:0`,
        // Scale to target resolution
        `scale=${config.resolution.width}:${config.resolution.height}`,
        // Burned-in text overlay
        `drawtext=text='${escapeText(textOverlay)}':fontsize=${config.subtitleStyle.fontsize}:fontcolor=${config.subtitleStyle.fontcolor}:borderw=${config.subtitleStyle.borderw}:bordercolor=${config.subtitleStyle.bordercolor}:x=(w-text_w)/2:y=(h-text_h)/2`,
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-r 30',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
      ])
      .on('start', (cmd) => logger.debug(`FFmpeg: ${cmd}`))
      .on('progress', (progress: any) => {
        if (progress.percent) {
          process.stdout.write(`\rProcessing: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log();
        logger.info(`Short created: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: any) => {
        console.log();
        logger.error(`FFmpeg error: ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}

function escapeText(text: string): string {
  return text.replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/%/g, '\\%');
}
