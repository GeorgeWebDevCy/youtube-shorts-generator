import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as dotenv from 'dotenv';
import { AppConfig, defaultConfig } from './types';

dotenv.config();

function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(process.env.HOME || '/home/george', filePath.slice(1));
  }
  return filePath;
}

export function loadConfig(configPath: string = './config.yaml'): AppConfig {
  // Start with defaults
  const config: AppConfig = JSON.parse(JSON.stringify(defaultConfig));

  // Override from YAML file if present
  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const userConfig = yaml.load(fileContent) as Partial<AppConfig>;

      // Deep merge
      if (userConfig.youtube) {
        config.youtube = { ...config.youtube, ...userConfig.youtube };
        if (userConfig.youtube.clientSecretFile) {
          config.youtube.clientSecretFile = expandPath(userConfig.youtube.clientSecretFile);
        }
        if (userConfig.youtube.tokenFile) {
          config.youtube.tokenFile = expandPath(userConfig.youtube.tokenFile);
        }
      }
      if (userConfig.ai) {
        config.ai = { ...config.ai, ...userConfig.ai };
        if (userConfig.ai.openai) {
          config.ai.openai = { ...config.ai.openai, ...userConfig.ai.openai };
        }
        if (userConfig.ai.claude) {
          config.ai.claude = { ...config.ai.claude, ...userConfig.ai.claude };
        }
      }
      if (userConfig.video) {
        config.video = { ...config.video, ...userConfig.video };
      }
      if (userConfig.processing) {
        config.processing = { ...config.processing, ...userConfig.processing };
      }
      if (userConfig.upload) {
        config.upload = { ...config.upload, ...userConfig.upload };
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not load config from ${configPath}: ${err}`);
  }

  // Environment variable overrides (highest priority)
  if (process.env.OPENAI_API_KEY) {
    config.ai.openai.apiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.CLAUDE_API_KEY) {
    config.ai.claude.apiKey = process.env.CLAUDE_API_KEY;
  }

  return config;
}

export function ensureDir(dirPath: string): void {
  const expanded = expandPath(dirPath);
  if (!fs.existsSync(expanded)) {
    fs.mkdirSync(expanded, { recursive: true });
  }
}
