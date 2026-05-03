// Configuration types for YouTube Shorts Generator

export interface YouTubeConfig {
  clientSecretFile: string;
  tokenFile: string;
  scopes: string[];
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface ClaudeConfig {
  apiKey: string;
  model: string;
}

export interface AIConfig {
  provider: 'openai' | 'claude';
  openai: OpenAIConfig;
  claude: ClaudeConfig;
  promptTemplates: {
    highlightSelector: string;
    metadata: string;
  };
}

export interface SubtitleStyle {
  font: string;
  fontsize: number;
  fontcolor: string;
  borderw: number;
  bordercolor: string;
}

export interface VideoConfig {
  ffmpegPath: string;
  resolution: { width: number; height: number };
  maxDurationSec: number;
  minDurationSec: number;
  subtitleStyle: SubtitleStyle;
}

export interface ProcessingConfig {
  maxConcurrent: number;
  tempDir: string;
  keepTemp: boolean;
  outputDir: string;
}

export interface UploadConfig {
  categoryId: number;
  privacy: 'public' | 'unlisted' | 'private';
  tagsDefault: string[];
}

export interface AppConfig {
  youtube: YouTubeConfig;
  ai: AIConfig;
  video: VideoConfig;
  processing: ProcessingConfig;
  upload: UploadConfig;
}

export const defaultAIConfig: AIConfig = {
  provider: 'openai',
  openai: {
    apiKey: '',
    model: 'gpt-4o',
  },
  claude: {
    apiKey: '',
    model: 'claude-sonnet-4',
  },
  promptTemplates: {
    highlightSelector:
      'Given video "{title}" with transcript:\n{transcript}\n\nSuggest 3 highlight moments (5–60 seconds each) for a YouTube Short. Choose moments with high engagement potential.\n\nReturn JSON array: [{"start": seconds, "end": seconds, "reason": "why this moment works", "textOverlay": "captivating caption for on-screen text"}]',
    metadata:
      'Write a viral-style YouTube Short title (≤70 chars, with emoji), description (≤300 chars), and 3–5 hashtags for a video about:\n\n{topic}\n\nReturn JSON: {"title": "...", "description": "...", "hashtags": ["..."]}',
  },
};

export const defaultVideoConfig: VideoConfig = {
  ffmpegPath: '/usr/bin/ffmpeg',
  resolution: { width: 1080, height: 1920 },
  maxDurationSec: 60,
  minDurationSec: 5,
  subtitleStyle: {
    font: 'Arial',
    fontsize: 48,
    fontcolor: 'white',
    borderw: 3,
    bordercolor: 'black',
  },
};

export const defaultProcessingConfig: ProcessingConfig = {
  maxConcurrent: 2,
  tempDir: '/tmp/youtube-shorts',
  keepTemp: false,
  outputDir: './outputs',
};

export const defaultUploadConfig: UploadConfig = {
  categoryId: 22, // People & Blogs
  privacy: 'public',
  tagsDefault: ['shorts', 'viral', 'fyp'],
};

export const defaultYouTubeConfig: YouTubeConfig = {
  clientSecretFile: '~/.youtube-shorts/client_secret.json',
  tokenFile: '~/.youtube-shorts/token.json',
  scopes: [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ],
};

export const defaultConfig = {
  youtube: defaultYouTubeConfig,
  ai: defaultAIConfig,
  video: defaultVideoConfig,
  processing: defaultProcessingConfig,
  upload: defaultUploadConfig,
};
