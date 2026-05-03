const google = require('googleapis');
import { YouTubeConfig } from '../config/types';
import { UploadConfig } from '../config/types';
import { getYouTubeClient } from './client';
import logger from '../utils/logger';

export interface UploadOptions {
  privacy?: 'public' | 'unlisted' | 'private';
  tags?: string[];
  categoryId?: number;
}

/**
 * Upload a video as a YouTube Short.
 * YouTube automatically detects vertical videos (9:16) as Shorts.
 */
export async function uploadShort(
  filePath: string,
  title: string,
  description: string,
  config: YouTubeConfig,
  uploadConfig: UploadConfig,
  tags?: string[],
  options: UploadOptions = {}
): Promise<string> {
  const yt = await getYouTubeClient(config);
  const fs = require('fs');

  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  logger.info(`Uploading Short: "${title}" (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  const metadata: any = {
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: title.length > 100 ? title.substring(0, 100) : title,
        description: description.substring(0, 5000),
        tags: tags || uploadConfig.tagsDefault,
        categoryId: options.categoryId || uploadConfig.categoryId.toString(),
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en',
      },
      status: {
        privacyStatus: options.privacy || uploadConfig.privacy,
        selfDeclaredMadeForKids: false,
        embeddable: true,
      },
    },
  };

  // Use resumable upload for large files
  const insertResponse = await yt.videos.insert(
    metadata,
    {
      media: {
        body: fs.createReadStream(filePath),
      },
    }
  );

  const videoId = insertResponse.data.id!;
  logger.info(`Upload successful! Video ID: ${videoId}`);
  logger.info(`Watch at: https://youtube.com/shorts/${videoId}`);

  return videoId;
}
