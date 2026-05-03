const google = require('googleapis');
import { loadStoredToken, getOAuth2Client, refreshAuth } from './auth';
import { YouTubeConfig } from '../config/types';
import logger from '../utils/logger';

let youtube: any = null;

export async function getYouTubeClient(config: YouTubeConfig): Promise<any> {
  if (youtube) return youtube;

  const client = loadStoredToken(config);
  if (!client) {
    throw new Error(
      'Not authenticated. Run `yts init` to authenticate with YouTube first.'
    );
  }

  // Refresh token if needed
  if (client.credentials?.expiry_date && client.credentials.expiry_date < Date.now()) {
    const refreshed = await refreshAuth(client, config);
    if (!refreshed) {
      throw new Error('Failed to refresh token. Please re-authenticate with `yts init`.');
    }
  }

  youtube = google.youtube({
    version: 'v3',
    auth: client,
  });

  return youtube;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  duration: string;  // ISO 8601 duration
  publishedAt: string;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
  };
}

/**
 * Fetch all public videos from the authenticated user's channel
 */
export async function fetchChannelVideos(
  config: YouTubeConfig,
  maxResults: number = 50
): Promise<YouTubeVideo[]> {
  const yt = await getYouTubeClient(config);

  // Step 1: Get the authenticated user's channel ID
  const channelRes = await yt.channels.list({
    part: ['contentDetails'],
    mine: true,
    maxResults: 1,
  });

  if (!channelRes.data.items || channelRes.data.items.length === 0) {
    throw new Error('No channel found for authenticated user.');
  }

  const uploadsPlaylistId =
    channelRes.data.items[0].contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error('Could not find uploads playlist for channel.');
  }

  logger.info(`Found uploads playlist: ${uploadsPlaylistId}`);

  // Step 2: Get all video IDs from the uploads playlist
  const videos: YouTubeVideo[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const playlistRes = await yt.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    const items = playlistRes.data.items || [];
    for (const item of items) {
      const snippet = item.snippet!;
      const details = item.contentDetails!;

      // Only include public videos
      if (snippet.privacyStatus !== 'public') continue;

      videos.push({
        id: details.videoId!,
        title: snippet.title!,
        description: snippet.description || '',
        duration: '', // Will fetch separately
        publishedAt: snippet.publishedAt!,
        thumbnails: {
          default: snippet.thumbnails!.default!.url!,
          medium: snippet.thumbnails!.medium?.url || '',
          high: snippet.thumbnails!.high?.url || '',
        },
      });

      if (maxResults > 0 && videos.length >= maxResults) {
        break;
      }
    }

    nextPageToken = playlistRes.data.nextPageToken;
  } while (nextPageToken && (maxResults === 0 || videos.length < maxResults));

  // Step 3: Fetch durations in batches
  await fetchVideoDurations(yt, videos);

  logger.info(`Fetched ${videos.length} public videos`);
  return videos;
}

/**
 * Populate the duration field for each video
 */
async function fetchVideoDurations(
  yt: any,
  videos: YouTubeVideo[]
): Promise<void> {
  // Batch up to 50 video IDs per request
  const batchSize = 50;
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    const ids = batch.map((v) => v.id).join(',');

    const res = await yt.videos.list({
      part: ['contentDetails'],
      id: ids,
    });

    const items = res.data.items || [];
    const idToDuration = new Map<string, string>(
      items.map((item: any) => [item.id, (item.contentDetails?.duration as string) || 'PT0S'])
    );

    for (const video of batch) {
      video.duration = idToDuration.get(video.id) || 'PT0S';
    }
  }
}
