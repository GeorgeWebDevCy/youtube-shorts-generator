import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(process.env.HOME || os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export function getTempFileName(prefix: string = 'tmp', ext: string = 'mp4'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return path.join(os.tmpdir(), `${prefix}_${timestamp}_${random}.${ext}`);
}

export function safeDelete(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    // ignore
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
