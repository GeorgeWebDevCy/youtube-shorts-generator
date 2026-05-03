import OpenAI from 'openai';
import * as Anthropic from '@anthropic-ai/sdk';
import { AIConfig } from '../config/types';
import logger from '../utils/logger';

export interface HighlightMoment {
  start: number;
  end: number;
  reason: string;
  textOverlay: string;
}

export interface MetadataResult {
  title: string;
  description: string;
  hashtags: string[];
}

export class AIContentPlanner {
  private openai: OpenAI | null = null;
  private claude: Anthropic.Anthropic | null = null;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    if (config.provider === 'openai' && config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    } else if (config.provider === 'claude' && config.claude.apiKey) {
      this.claude = new Anthropic.Anthropic({ apiKey: config.claude.apiKey });
    }
  }

  async suggestHighlights(
    videoTitle: string,
    transcript: string
  ): Promise<HighlightMoment[]> {
    const prompt = this.config.promptTemplates.highlightSelector
      .replace('{title}', videoTitle)
      .replace('{transcript}', transcript.substring(0, 15000)); // limit length

    if (this.config.provider === 'openai' && this.openai) {
      return this.callOpenAI(prompt);
    } else if (this.config.provider === 'claude' && this.claude) {
      return this.callClaude(prompt);
    }
    throw new Error('No AI provider configured with API key');
  }

  private async callOpenAI(prompt: string): Promise<HighlightMoment[]> {
    logger.info('Calling OpenAI GPT-4o for highlight selection...');

    const response = await this.openai!.chat.completions.create({
      model: this.config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a YouTube Shorts expert. Return only a JSON array of highlight moments.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);
    // Expect either { highlights: [...] } or [...]
    const arr = parsed.highlights || parsed;
    return arr.map((h: any) => ({
      start: Number(h.start),
      end: Number(h.end),
      reason: h.reason || '',
      textOverlay: h.textOverlay || '',
    }));
  }

  private async callClaude(prompt: string): Promise<HighlightMoment[]> {
    logger.info('Calling Claude for highlight selection...');

    const response = await this.claude!.messages.create({
      model: this.config.claude.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt + '\n\nReturn only a JSON array of highlight moments.',
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected Claude response type');

    const text = content.text;
    // Try to extract JSON from response
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']') + 1;
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON array found in Claude response');
    }

    const arr = JSON.parse(text.slice(jsonStart, jsonEnd));
    return arr.map((h: any) => ({
      start: Number(h.start),
      end: Number(h.end),
      reason: h.reason || '',
      textOverlay: h.textOverlay || '',
    }));
  }
}

export class MetadataGenerator {
  private openai: OpenAI | null = null;
  private claude: Anthropic.Anthropic | null = null;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    if (config.provider === 'openai' && config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    } else if (config.provider === 'claude' && config.claude.apiKey) {
      this.claude = new Anthropic.Anthropic({ apiKey: config.claude.apiKey });
    }
  }

  async generate(topic: string): Promise<MetadataResult> {
    const prompt = this.config.promptTemplates.metadata.replace('{topic}', topic);

    if (this.config.provider === 'openai' && this.openai) {
      return this.callOpenAI(prompt);
    } else if (this.config.provider === 'claude' && this.claude) {
      return this.callClaude(prompt);
    }
    throw new Error('No AI provider configured');
  }

  private async callOpenAI(prompt: string): Promise<MetadataResult> {
    const response = await this.openai!.chat.completions.create({
      model: this.config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a YouTube Shorts metadata specialist. Return only JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('Empty response from OpenAI');

    return JSON.parse(content) as MetadataResult;
  }

  private async callClaude(prompt: string): Promise<MetadataResult> {
    const response = await this.claude!.messages.create({
      model: this.config.claude.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt + '\n\nReturn only JSON.',
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected Claude response');

    const text = content.text;
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    if (jsonStart === -1) throw new Error('No JSON found in Claude response');

    return JSON.parse(text.slice(jsonStart, jsonEnd)) as MetadataResult;
  }
}
