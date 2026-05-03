/**
 * YouTube Shorts Generator — Electron Main Process
 * Wraps the CLI application and exposes IPC channels for the UI.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';

// Get project root (one level up from electron/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY = path.join(PROJECT_ROOT, 'dist', 'index.js');

class ElectronYTSApp extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private cliProcess: ChildProcess | null = null;
  private logLines: string[] = [];

  constructor() {
    super();
    this.setupApp();
    this.setupIPC();
  }

  private setupApp(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.emit('ready');
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
    });
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1300,
      height: 850,
      minWidth: 1024,
      minHeight: 700,
      title: 'YouTube Shorts Generator',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      },
      backgroundColor: '#0f0f0f',
      titleBarStyle: 'hiddenInset'
    });

    this.loadUI();

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private loadUI(): void {
    // Development mode: load from local server
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow?.loadURL('http://localhost:5173');
      this.mainWindow?.webContents.openDevTools();
    } else {
      // Production: load built index.html from project
      const indexPath = path.join(PROJECT_ROOT, 'dist', 'renderer', 'index.html');
      if (fs.existsSync(indexPath)) {
        this.mainWindow?.loadFile(indexPath);
      } else {
        // Fallback: load Vite dev server or show error UI
        this.showFallbackUI();
      }
    }
  }

  private showFallbackUI(): void {
    const fallbackHtml = `
      <!DOCTYPE html>
      <html><body style="background:#0f0f0f;color:#fff;font:14px system-ui;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
        <h1 style="font-size:24px;margin-bottom:12px;">YouTube Shorts Generator</h1>
        <p>The renderer bundle is not yet built.</p>
        <p style="color:#888;">Please run <code>npm run build:all</code> first, or start in development mode.</p>
      </body></html>
    `;
    this.mainWindow?.loadURL(`data:text/html,${encodeURIComponent(fallbackHtml)}`);
  }

  private setupIPC(): void {
    // App lifecycle
    ipcMain.handle('app-get-info', () => ({
      version: app.getVersion(),
      platform: process.platform,
      projectRoot: PROJECT_ROOT
    }));

    // Run CLI command
    ipcMain.on('cli-run', (event: Electron.IpcMainEvent, args: string[]) => {
      this.runCLI(args, (line: string) => {
        event.sender.send('cli-output', line);
      });
    });

    ipcMain.on('cli-stop', () => {
      this.stopCLI();
    });

    // Log streaming
    ipcMain.handle('logs-get', () => this.logLines);
    ipcMain.on('logs-clear', () => {
      this.logLines = [];
    });

    // State database queries (direct read access)
    ipcMain.handle('db-query', (event: Electron.IpcMainEvent, sql: string) => {
      return this.queryDB(sql);
    });

    // File system helpers
    ipcMain.handle('fs-read-dir', (event: Electron.IpcMainEvent, dir: string) => {
      return this.readDirectory(dir);
    });

    ipcMain.handle('fs-read-file', (event: Electron.IpcMainEvent, filePath: string) => {
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch (error) {
        return null;
      }
    });

    // Open external URL (videos, docs)
    ipcMain.on('open-external', (event: Electron.IpcMainEvent, url: string) => {
      require('electron').shell.openExternal(url);
    });
  }

  private runCLI(args: string[], callback: (line: string) => void): void {
    // Build the command: node dist/index.js <args>
    const cmd = process.platform === 'win32' ? 'node.exe' : 'node';
    const fullArgs = [CLI_ENTRY, ...args];

    this.logLines.push(`> ${fullArgs.join(' ')}`);
    callback(`> ${fullArgs.join(' ')}\n`);

    this.cliProcess = spawn(cmd, fullArgs, {
      cwd: PROJECT_ROOT,
      shell: true,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    this.cliProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.logLines.push(...text.split('\n').filter(Boolean));
      callback(text);
    });

    this.cliProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.logLines.push(...text.split('\n').filter(Boolean));
      callback(text);
    });

    this.cliProcess.on('close', (code: number) => {
      this.cliProcess = null;
      callback(`\n[Process exited with code ${code}]\n`);
    });

    this.cliProcess.on('error', (err: Error) => {
      this.cliProcess = null;
      callback(`\n[Process error: ${err.message}]\n`);
    });
  }

  private stopCLI(): void {
    if (this.cliProcess) {
      this.cliProcess.kill('SIGTERM');
      this.cliProcess = null;
      this.emit('log', '[Process stopped]\n');
    }
  }

  private queryDB(sql: string): any {
    try {
      const dbPath = path.join(PROJECT_ROOT, 'data', 'processor.db');
      // Direct read using better-sqlite3 (no separate process)
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const rows = db.prepare(sql).all();
      db.close();
      return rows;
    } catch (error: any) {
      return { error: error.message };
    }
  }

  private readDirectory(dir: string): string[] {
    try {
      return fs.readdirSync(dir);
    } catch (error: any) {
      return [];
    }
  }
}

// Start the app
new ElectronYTSApp();
