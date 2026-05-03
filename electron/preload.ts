/**
 * Electron Preload Script
 * Exposes safe IPC channels to the renderer process.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App metadata
  getAppInfo: () => ipcRenderer.invoke('app-get-info'),

  // CLI integration
  runCommand: (args: string[]) => ipcRenderer.send('cli-run', args),
  stopCommand: () => ipcRenderer.send('cli-stop'),
  onCommandOutput: (callback: (line: string) => void) =>
    ipcRenderer.on('cli-output', (_: any, line: string) => callback(line)),

  // Logs
  getLogs: () => ipcRenderer.invoke('logs-get'),
  clearLogs: () => ipcRenderer.send('logs-clear'),

  // Direct DB queries (readonly)
  queryDB: (sql: string) => ipcRenderer.invoke('db-query', sql),

  // Filesystem helpers
  readDir: (dir: string) => ipcRenderer.invoke('fs-read-dir', dir),
  readFile: (file: string) => ipcRenderer.invoke('fs-read-file', file),

  // External URLs
  openExternal: (url: string) => ipcRenderer.send('open-external', url)
});
