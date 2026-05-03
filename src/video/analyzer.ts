const google = require('googleapis');
import { AIContentPlanner } from '../ai/ai-service';
import { listCaptions, downloadCaptionSRT, parseSRT, getTranscriptText } from '../youtube/captions';
import { HighlightMoment } from '../ai/ai-service';
import logger from '../utils/logger';

/**
 * Get highlight moments for a video using AI + captions (if available)
 */
export async function analyzeVideo(yt: any,
  videoId: string,
  videoTitle: string,
  durationSec: number,
  aiPlanner: AIContentPlanner
): Promise<HighlightMoment[]> {
  logger.info(`Analyzing video ${videoId} (duration: ${Math.floor(durationSec)}s)...`);

  // Try to get captions
  const captions = await listCaptions(yt, videoId);
  let highlights: HighlightMoment[];

  if (captions.length > 0) {
    logger.info(`Found ${captions.length} caption track(s)`);
    const bestCaption = captions.find(c => c.language === 'en' && c.type === 'manual')
      || captions.find(c => c.language === 'en')
      || captions[0];

    logger.info(`Downloading caption: ${bestCaption.language} (${bestCaption.type})`);
    const srt = await downloadCaptionSRT(yt, bestCaption.id);
    const lines = parseSRT(srt);
    const transcript = getTranscriptText(lines);

    if (transcript.trim().length > 20) {
      highlights = await aiPlanner.suggestHighlights(videoTitle, transcript);
    } else {
      logger.warn('Transcript too short, falling back to rule-based');
      highlights = ruleBasedHighlights(durationSec);
    }
  } else {
    logger.warn('No captions, using rule-based highlights');
    highlights = ruleBasedHighlights(durationSec);
  }

  return highlights
    .filter(h => h.start >= 0 && h.end <= durationSec && (h.end - h.start) >= 5)
    .map(h => ({
      ...h,
      start: Math.max(0, h.start),
      end: Math.min(durationSec, h.end),
    }))
    .slice(0, 3); // max 3 per video
}

/**
 * Fallback: pick up to 3 highlights based on duration
 */
function ruleBasedHighlights(durationSec: number): HighlightMoment[] {
  const moments: HighlightMoment[] = [];

  if (durationSec <= 60) {
    // Whole video fits in a Short
    moments.push({
      start: 0,
      end: Math.min(durationSec, 60),
      reason: 'Complete clip',
      textOverlay: 'Full video!',
    });
  } else {
    // Try picking 3 segments: opening, middle, ending
    const picks = [
      { start: 0, end: Math.min(60, durationSec) },
      { start: Math.max(0, durationSec / 2 - 30), end: Math.min(durationSec, durationSec / 2 + 30) },
      { start: Math.max(0, durationSec - 60), end: durationSec },
    ];

    for (const p of picks) {
      if (p.end - p.start >= 5) {
        moments.push({
          start: p.start,
          end: p.end,
          reason: 'Engaging segment',
          textOverlay: 'Best part!',
        });
      }
    }
  }

  return moments;
}
