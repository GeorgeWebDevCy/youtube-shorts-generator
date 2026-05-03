// Electron preload API types
interface ElectronAPI {
  getAppInfo: () => Promise<{ version: string; platform: string; projectRoot: string }>;
  runCommand: (args: string[]) => void;
  stopCommand: () => void;
  onCommandOutput: (callback: (line: string) => void) => void;
  getLogs: () => Promise<string[]>;
  clearLogs: () => void;
  queryDB: (sql: string) => Promise<any>;
  readDir: (dir: string) => Promise<string[]>;
  readFile: (file: string) => Promise<string | null>;
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
