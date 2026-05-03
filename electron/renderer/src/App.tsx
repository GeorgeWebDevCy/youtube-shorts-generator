import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import { Trash2, Play, Square, Database, Settings, Terminal, Video, Upload, ExternalLink } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface VideoRow { id: string; title: string; duration: string; status: string; processed_at?: string }
interface UploadRow { id: string; video_id: string; title: string; youtube_id: string; status: string; created_at: string }

interface AppState {
  logs: string[];
  isRunning: boolean;
  videos: VideoRow[];
  uploads: UploadRow[];
  activeTab: string;
  appendLog: (line: string) => void;
  setRunning: (v: boolean) => void;
  setVideos: (v: VideoRow[]) => void;
  setUploads: (u: UploadRow[]) => void;
  setTab: (t: string) => void;
  clearLogs: () => void;
}

const useStore = create<AppState>((set) => ({
  logs: [],
  isRunning: false,
  videos: [],
  uploads: [],
  activeTab: 'dashboard',
  appendLog: (line) => set((s) => ({ logs: [...s.logs, line] })),
  setRunning: (v) => set({ isRunning: v }),
  setVideos: (v) => set({ videos: v }),
  setUploads: (u) => set({ uploads: u }),
  setTab: (t) => set({ activeTab: t }),
  clearLogs: () => set({ logs: [] }),
}));

// ── Helper Components ─────────────────────────────────────────────────────────

const LogPanel: React.FC = () => {
  const logs = useStore((s) => s.logs);
  const clearLogs = useStore((s) => s.clearLogs);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#262626]">
        <div className="flex items-center gap-2 text-sm">
          <Terminal size={16} /> Terminal Output
        </div>
        <button onClick={clearLogs} className="btn btn-secondary text-xs px-2 py-1">Clear</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 text-[#e5e5e5]">
        {logs.map((line, i) => (
          <div key={i} className="log-line" style={{
            color: line.includes('[error]') || line.includes('ERR') ? '#f87171' :
                   line.includes('warn') || line.includes('WARN') ? '#fbbf24' :
                   line.includes('[info]') || line.includes('✓') ? '#4ade80' : '#d4d4d4'
          }}>
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="card">
    <div className="flex items-center gap-2 text-[#a3a3a3] text-sm mb-1">{icon}{title}</div>
    <div className="text-2xl font-semibold">{value}</div>
  </div>
);

const VideoTable: React.FC<{ videos: VideoRow[] }> = ({ videos }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead className="text-[#a3a3a3] border-b border-[#262626]">
        <tr>
          <th className="pb-2 pl-3">Video ID</th>
          <th className="pb-2">Title</th>
          <th className="pb-2">Duration</th>
          <th className="pb-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {videos.map(v => (
          <tr key={v.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
            <td className="py-2 pl-3 font-mono text-xs text-[#888]">{v.id}</td>
            <td className="py-2 truncate max-w-md">{v.title}</td>
            <td className="py-2 text-[#888]">{v.duration}</td>
            <td className="py-2">
              <span className={`px-2 py-0.5 rounded text-xs ${
                v.status === 'processed' ? 'bg-[#166534] text-[#4ade80]' :
                v.status === 'pending' ? 'bg-[#854d0e] text-[#fbbf24]' :
                'bg-[#991b1b] text-[#f87171]'
              }`}>{v.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── Main App ───────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const {
    logs, isRunning, videos, uploads, activeTab,
    appendLog, setRunning, setVideos, setUploads, setTab
  } = useStore();

  const [command, setCommand] = useState('fetch');
  const [args, setArgs] = useState('--limit 5');
  const [dbData, setDbData] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Load data on tab switch
  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'database') loadDB();
    if (activeTab === 'uploads') loadUploads();
  }, [activeTab]);

  // IPC listeners
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onCommandOutput((line) => appendLog(line));
    }
  }, [appendLog]);

  const runCommandHandler = () => {
    if (!window.electronAPI) return;
    setErr(null);
    appendLog(`\n> Starting: ${command} ${args}\n`);
    setRunning(true);
    window.electronAPI.runCommand([command, ...args.split(' ').filter(Boolean)]);
  };

  const stopCommandHandler = () => {
    window.electronAPI?.stopCommand();
    setRunning(false);
    appendLog('\n[Process stopped by user]\n');
  };

  const loadDashboard = async () => {
    const v = await window.electronAPI.queryDB('SELECT * FROM videos ORDER BY id DESC LIMIT 20');
    setVideos(Array.isArray(v) ? v : []);
    const u = await window.electronAPI.queryDB('SELECT * FROM uploads ORDER BY id DESC LIMIT 20');
    setUploads(Array.isArray(u) ? u : []);
  };

  const loadDB = async () => {
    const data = await window.electronAPI.queryDB('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name');
    setDbData(Array.isArray(data) ? data : []);
  };

  const loadUploads = loadDashboard;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0f0f0f] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Video size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">YouTube Shorts Generator</h1>
            <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-[#666]'}`}></span>
              {isRunning ? 'Running' : 'Idle'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.electronAPI.openExternal('https://github.com/GeorgeWebDevCy/youtube-shorts-generator')}
                  className="btn btn-secondary flex items-center gap-1.5 text-xs">
            <ExternalLink size={14} /> GitHub
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col">
          <nav className="flex-1 p-2 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Database },
              { id: 'commands',  label: 'Run Command', icon: Play },
              { id: 'uploads',   label: 'Uploads', icon: Upload },
              { id: 'database',  label: 'Database', icon: Database },
              { id: 'settings',  label: 'Settings', icon: Settings },
              { id: 'logs',      label: 'Terminal', icon: Terminal },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  activeTab === id ? 'bg-[#262626] text-[#fff]' : 'text-[#a3a3a3] hover:text-[#fff] hover:bg-[#1a1a1a]'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Panels */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold">Dashboard</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Videos Fetched" value={videos.length} icon={<Database size={16} />} />
                <StatCard title="Shorts Ready" value={videos.filter(v => v.status === 'processed').length} icon={<Video size={16} />} />
                <StatCard title="Uploaded" value={uploads.length} icon={<Upload size={16} />} />
                <StatCard title="Queue" value={videos.filter(v => v.status === 'pending').length} icon={<Play size={16} />} />
              </div>

              <div className="card">
                <h3 className="text-sm font-medium mb-3 text-[#a3a3a3]">Recent Videos</h3>
                <VideoTable videos={videos.slice(0, 10)} />
              </div>

              <div className="card">
                <h3 className="text-sm font-medium mb-3 text-[#a3a3a3]">Recent Uploads</h3>
                {uploads.length === 0 ? (
                  <p className="text-[#666] text-sm">No uploads yet. Run the full pipeline to see results.</p>
                ) : (
                  <div className="space-y-2">
                    {uploads.slice(0, 5).map(u => (
                      <div key={u.id} className="flex items-center justify-between text-sm p-2 bg-[#1a1a1a] rounded">
                        <div className="flex-1 truncate">
                          <span className="font-mono text-xs text-[#888] mr-2">{u.video_id}</span>
                          <span>{u.title}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          u.status === 'uploaded' ? 'bg-[#166534] text-[#4ade80]' :
                          u.status === 'failed' ? 'bg-[#991b1b] text-[#f87171]' : 'bg-[#854d0e] text-[#fbbf24]'
                        }`}>{u.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Commands Tab */}
          {activeTab === 'commands' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold">Run CLI Command</h2>
              <div className="card max-w-2xl">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#a3a3a3] mb-1">Command</label>
                    <select value={command} onChange={(e) => setCommand(e.target.value)}
                            className="input w-48 bg-[#1a1a1a]">
                      <option value="init">init</option>
                      <option value="fetch">fetch</option>
                      <option value="process">process</option>
                      <option value="upload">upload</option>
                      <option value="full-run">full-run</option>
                      <option value="dashboard">dashboard</option>
                      <option value="list">list</option>
                      <option value="clear">clear</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#a3a3a3] mb-1">Arguments (space separated)</label>
                    <input value={args} onChange={(e) => setArgs(e.target.value)}
                           placeholder="e.g. --limit 5 --dry-run"
                           className="input w-full font-mono text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={runCommandHandler}
                            disabled={isRunning}
                            className={`btn ${isRunning ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}>
                      <Play size={16} /> {isRunning ? 'Running…' : 'Run'}
                    </button>
                    {isRunning && (
                      <button onClick={stopCommandHandler} className="btn btn-danger flex items-center gap-2">
                        <Square size={16} /> Stop
                      </button>
                    )}
                  </div>
                </div>

                {err && (
                  <div className="mt-4 p-3 bg-[#991b1b] border border-red-900/50 rounded text-sm text-red-200">
                    {err}
                  </div>
                )}

                <div className="mt-6 border-t border-[#262626] pt-4">
                  <h3 className="text-sm font-medium mb-2">Quick Start</h3>
                  <div className="space-y-1 text-xs text-[#888]">
                    <div className="flex items-center gap-2">
                      <code className="bg-[#262626] px-2 py-0.5 rounded">init</code>
                      <span>Initialize the database</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#262626] px-2 py-0.5 rounded">fetch --limit 5</code>
                      <span>Download metadata for last 5 videos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#262626] px-2 py-0.5 rounded">process 1</code>
                      <span>Generate Shorts for video ID 1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#262626] px-2 py-0.5 rounded">upload</code>
                      <span>Upload processed videos to YouTube</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#262626] px-2 py-0.5 rounded">full-run --limit 2 --dry-run</code>
                      <span>Test the full pipeline (dry-run)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Uploads Tab */}
          {activeTab === 'uploads' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold">Upload History</h2>
              <div className="card">
                {uploads.length === 0 ? (
                  <p className="text-[#666] text-sm text-center py-8">No uploads yet.</p>
                ) : (
                  <div className="space-y-2">
                    {uploads.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded border border-[#262626]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-[#888]">{u.youtube_id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              u.status === 'uploaded' ? 'bg-[#166534] text-[#4ade80]' :
                              u.status === 'failed' ? 'bg-[#991b1b] text-[#f87171]' : 'bg-[#854d0e] text-[#fbbf24]'
                            }`}>{u.status}</span>
                          </div>
                          <div className="text-sm truncate">{u.title}</div>
                          <div className="text-xs text-[#666]">{new Date(u.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Database Tab */}
          {activeTab === 'database' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold">Database</h2>
              <div className="card">
                <h3 className="text-sm font-medium mb-3 text-[#a3a3a3]">Tables</h3>
                <div className="space-y-2">
                  {dbData.map((row, i) => (
                    <div key={i} className="flex items-center px-3 py-2 bg-[#1a1a1a] rounded">
                      <Database size={16} className="text-[#6366f1] mr-2" />
                      <code className="font-mono text-sm">{row.name}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold">Settings</h2>
              <div className="card max-w-2xl">
                <p className="text-[#a3a3a3] text-sm mb-4">
                  Configuration files are stored in the project root:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                    <span>config.yaml</span>
                    <span className="text-[#666] font-mono">./config.yaml</span>
                  </li>
                  <li className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                    <span>.env</span>
                    <span className="text-[#666] font-mono">./.env</span>
                  </li>
                  <li className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                    <span>SQLite Database</span>
                    <span className="text-[#666] font-mono">./data/processor.db</span>
                  </li>
                  <li className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                    <span>CLI Output</span>
                    <span className="text-[#666] font-mono">./outputs/</span>
                  </li>
                </ul>
                <div className="mt-6 pt-4 border-t border-[#262626]">
                  <button onClick={() => window.electronAPI.openExternal('https://hermes-agent.nousresearch.com/docs')}
                          className="btn btn-secondary text-sm">Open Documentation</button>
                </div>
              </div>
            </div>
          )}

          {/* Terminal Tab */}
          {activeTab === 'logs' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <LogPanel />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
