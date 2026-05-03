import Database from 'better-sqlite3';
import * as path from 'path';
import { expandPath, ensureDir } from '../utils/file-utils';
import logger from '../utils/logger';

let db: Database.Database | null = null;

export interface ProcessedVideo {
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  shortsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedShort {
  shortId: string;
  sourceVideoId: string;
  title: string;
  description: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
}

export function initDB(dbPath: string = './data/shorts.db'): Database.Database {
  if (db) return db;

  const fullPath = expandPath(dbPath);
  ensureDir(path.dirname(fullPath));

  db = new Database(fullPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_videos (
      video_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      shorts_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploaded_shorts (
      short_id TEXT PRIMARY KEY,
      source_video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      published_at TEXT,
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      FOREIGN KEY (source_video_id) REFERENCES processed_videos(video_id)
    );

    CREATE INDEX IF NOT EXISTS idx_processed_status ON processed_videos(status);
    CREATE INDEX IF NOT EXISTS idx_uploaded_source ON uploaded_shorts(source_video_id);
  `);

  logger.info(`Database initialized at ${fullPath}`);
  return db;
}

export function getDB(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

// Processed videos
export function upsertProcessedVideo(
  videoId: string,
  status: ProcessedVideo['status'],
  shortsCount?: number
): void {
  const database = getDB();
  const now = new Date().toISOString();

  const existing = database
    .prepare('SELECT video_id FROM processed_videos WHERE video_id = ?')
    .get(videoId);

  if (existing) {
    database
      .prepare(`
        UPDATE processed_videos 
        SET status = ?, shorts_count = ?, updated_at = ?
        WHERE video_id = ?
      `)
      .run(status, shortsCount ?? 0, now, videoId);
  } else {
    database
      .prepare(`
        INSERT INTO processed_videos (video_id, status, shorts_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(videoId, status, shortsCount ?? 0, now, now);
  }
}

export function getProcessedVideo(videoId: string): ProcessedVideo | null {
  const database = getDB();
  const row = database
    .prepare('SELECT * FROM processed_videos WHERE video_id = ?')
    .get(videoId) as any;
  return row ? mapProcessedVideo(row) : null;
}

export function getProcessedVideosByStatus(
  status: ProcessedVideo['status']
): ProcessedVideo[] {
  const database = getDB();
  const rows = database
    .prepare('SELECT * FROM processed_videos WHERE status = ? ORDER BY created_at DESC')
    .all(status) as any[];
  return rows.map(mapProcessedVideo);
}

export function getAllProcessedVideos(): ProcessedVideo[] {
  const database = getDB();
  const rows = database
    .prepare('SELECT * FROM processed_videos ORDER BY created_at DESC')
    .all() as any[];
  return rows.map(mapProcessedVideo);
}

// Uploaded shorts
export function addUploadedShort(short: Omit<UploadedShort, 'viewCount' | 'likeCount'>): void {
  const database = getDB();
  database
    .prepare(`
      INSERT OR REPLACE INTO uploaded_shorts 
      (short_id, source_video_id, title, description, published_at, view_count, like_count)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `)
    .run(short.shortId, short.sourceVideoId, short.title, short.description, short.publishedAt);
}

export function incrementShortStats(
  shortId: string,
  viewDelta: number = 0,
  likeDelta: number = 0
): void {
  const database = getDB();
  database
    .prepare(`
      UPDATE uploaded_shorts 
      SET view_count = view_count + ?, like_count = like_count + ?
      WHERE short_id = ?
    `)
    .run(viewDelta, likeDelta, shortId);
}

export function getUploadedShortsBySource(
  sourceVideoId: string
): UploadedShort[] {
  const database = getDB();
  const rows = database
    .prepare('SELECT * FROM uploaded_shorts WHERE source_video_id = ?')
    .all(sourceVideoId) as any[];
  return rows.map(mapUploadedShort);
}

function mapProcessedVideo(row: any): ProcessedVideo {
  return {
    videoId: row.video_id,
    status: row.status,
    shortsCount: row.shorts_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUploadedShort(row: any): UploadedShort {
  return {
    shortId: row.short_id,
    sourceVideoId: row.source_video_id,
    title: row.title,
    description: row.description || '',
    publishedAt: row.published_at,
    viewCount: row.view_count,
    likeCount: row.like_count,
  };
}
