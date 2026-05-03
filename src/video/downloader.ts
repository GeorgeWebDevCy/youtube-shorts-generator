import ytdl from 'ytdl-core';
import * as fs from 'fs';
import * as path from 'path';
import { ensureDir } from '../utils/file-utils';
import logger from '../utils/logger';

export interface VideoInfo {
  videoId: string;
  title: string;
  durationSec: number;
  filePath: string;
}

/**
 * Download a YouTube video as MP4 (highest quality)
 * Caches downloads in the videos directory
 */
export async function downloadVideo(
  videoId: string,
  outputDir: string = './videos'
): Promise<VideoInfo> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  ensureDir(outputDir);

  const outputPath = path.join(outputDir, `${videoId}.mp4`);

  // Check if already cached
  if (fs.existsSync(outputPath)) {
    logger.info(`Video ${videoId} already cached`);
    // Get info separately
    const info = await ytdl.getInfo(url);
    return {
      videoId,
      title: info.videoDetails.title,
      durationSec: parseInt(info.videoDetails.lengthSeconds, 10),
      filePath: outputPath,
    };
  }

  logger.info(`Downloading ${videoId}...`);

  return new Promise((resolve, reject) => {
    const stream = ytdl(url, {
      quality: 'highest',
      filter: 'videoandaudio',
    });

    stream.pipe(fs.createWriteStream(outputPath))
      .on('finish', async () => {
        try {
          const info = await ytdl.getInfo(url);
          resolve({
            videoId,
            title: info.videoDetails.title,
            durationSec: parseInt(info.videoDetails.lengthSeconds, 10),
            filePath: outputPath,
          });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}
