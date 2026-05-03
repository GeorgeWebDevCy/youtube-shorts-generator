import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import {
  Video, Play, Square, Database, Settings, Terminal,
  Upload, ExternalLink, Activity, HardDrive, Zap
} from 'lucide-react';

// ── State ─────────────────────────────────────────────────────────────────────

interface VideoRow { id: string; title: string; duration: string; status: string; processed_at?: string }
interface UploadRow { id: string; video_id: string; title: string; youtube_id: string; status: string; created_at: string }

interface AppState {
  logs: string[];
  isRunning: boolean;
  videos: VideoRow[];
  uploads: UploadRow[];
  activeTab: string;
  command: string;
  args: string;
  appendLog: (line: string) => void;
  setRunning: (v: boolean) => void;
  setVideos: (v: VideoRow[]) => void;
  setUploads: (u: UploadRow[]) => void;
  setTab: (t: string) => void;
  setCommand: (c: string) => void;
  setArgs: (a: string) => void;
  clearLogs: () => void;
}

const useStore = create<AppState>((set) => ({
  logs: [], isRunning: false, videos: [], uploads: [],
  activeTab: 'dashboard', command: 'fetch', args: '--limit 5',
  appendLog: (line) => set((s) => ({ logs: [...s.logs, line] })),
  setRunning: (v) => set({ isRunning: v }),
  setVideos: (v) => set({ videos: v }),
  setUploads: (u) => set({ uploads: u }),
  setTab: (t) => set({ activeTab: t }),
  setCommand: (c) => set({ command: c }),
  setArgs: (a) => set({ args: a }),
  clearLogs: () => set({ logs: [] }),
}));

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = ({ children, className }: { children: any; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

// ── Components ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="stat-card">
    <div className="stat-icon">{icon}</div>
    <div className="stat-label">{title}</div>
    <div className="stat-value">{value}</div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    completed: 'badge-success',
    processed: 'badge-success',
    pending: 'badge-neutral',
    failed: 'badge-error',
    uploaded: 'badge-success',
    processing: 'badge-warning',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{label}</span>;
};

const VideoTable: React.FC<{ videos: VideoRow[] }> = ({ videos }) => (
  <div style={{ overflowX: 'auto' }}>
    <table className="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Duration</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {videos.map(v => (
          <tr key={v.id}>
            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-quaternary)' }}>{v.id}</td>
            <td title={v.title} style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</td>
            <td style={{ color: 'var(--text-tertiary)' }}>{v.duration}</td>
            <td><StatusBadge status={v.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const UploadList: React.FC<{ uploads: UploadRow[] }> = ({ uploads }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {uploads.map(u => (
      <div key={u.id} className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-quaternary)' }}>{u.youtube_id}</span>
              <StatusBadge status={u.status} />
            </div>
            <div className="text-body" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</div>
            <div className="text-muted" style={{ fontSize: '11px' }}>{new Date(u.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const LogPanel: React.FC = () => {
  const logs = useStore((s) => s.logs);
  const clearLogs = useStore((s) => s.clearLogs);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogClass = (line: string) => {
    if (line.includes('[error]') || line.includes('ERR') || line.includes('Error')) return 'log-error';
    if (line.includes('[warn]') || line.includes('WARN')) return 'log-warn';
    if (line.includes('[info]') || line.includes('✓') || line.includes('✅')) return 'log-success';
    return 'log-info';
  };

  return (
    <div className="terminal-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="terminal-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} /> Terminal Output
        </span>
        <button onClick={clearLogs} className="btn btn-ghost btn-sm">Clear</button>
      </div>
      <div className="terminal-body" style={{ flex: 1, overflowY: 'auto' }}>
        {logs.map((line, i) => (
          <div key={i} className={`log-line ${getLogClass(line)}`}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const { logs, isRunning, videos, uploads, activeTab, command, args, appendLog, setRunning, setVideos, setUploads, setTab, setCommand, setArgs, clearLogs } = useStore();
  const [dbTables, setDbTables] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'database') loadDB();
    if (activeTab === 'uploads') loadUploads();
  }, [activeTab]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onCommandOutput((line: any) => appendLog(line));
    }
  }, [appendLog]);

  const runCommand = () => {
    if (!window.electronAPI) return;
    clearLogs();
    appendLog(`\n> yts ${command} ${args}\n`);
    setRunning(true);
    window.electronAPI.runCommand([command, ...args.split(' ').filter(Boolean)]);
  };

  const stopCommand = () => {
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
    const data = await window.electronAPI.queryDB("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    setDbTables(Array.isArray(data) ? data : []);
  };

  const loadUploads = loadDashboard;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="logo-mark">YS</div>
          <div className="app-title">YouTube Shorts Generator</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            <span className={`status-dot ${isRunning ? 'active' : ''}`}></span>
            {isRunning ? 'Running' : 'Idle'}
          </div>
          <button onClick={() => window.electronAPI?.openExternal('https://github.com/GeorgeWebDevCy/youtube-shorts-generator')}
                  className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ExternalLink size={14} /> GitHub
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside className="app-sidebar">
          <nav className="nav-group" style={{ marginTop: '12px' }}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
              { id: 'commands',  label: 'Run Command', icon: <Play size={16} /> },
              { id: 'uploads',   label: 'Uploads', icon: <Upload size={16} /> },
              { id: 'database',  label: 'Database', icon: <Database size={16} /> },
              { id: 'settings',  label: 'Settings', icon: <Settings size={16} /> },
              { id: 'logs',      label: 'Terminal', icon: <Terminal size={16} /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="app-content">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="content-panel">
              <h1 className="h-xs" style={{ marginBottom: '24px' }}>Dashboard</h1>

              <div className="stats-grid">
                <StatCard title="Videos Fetched" value={videos.length} icon={<Database size={18} />} />
                <StatCard title="Shorts Ready" value={videos.filter(v => v.status === 'processed' || v.status === 'completed').length} icon={<Video size={18} />} />
                <StatCard title="Uploaded" value={uploads.length} icon={<Upload size={18} />} />
                <StatCard title="Processing" value={videos.filter(v => v.status === 'processing').length} icon={<Zap size={18} />} />
              </div>

              <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 className="h-nano" style={{ color: 'var(--text-tertiary)', fontWeight: 590, letterSpacing: '-0.24px' }}>Recent Videos</h3>
                  <button className="btn btn-ghost btn-sm" onClick={loadDashboard}>Refresh</button>
                </div>
                {videos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
                    <HardDrive size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                    <p>No videos fetched yet.</p>
                    <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>
                      Go to <strong>Run Command</strong> and execute <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>fetch --limit 5</code>
                    </p>
                  </div>
                ) : (
                  <VideoTable videos={videos.slice(0, 10)} />
                )}
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 className="h-nano" style={{ color: 'var(--text-tertiary)', fontWeight: 590, letterSpacing: '-0.24px' }}>Recent Uploads</h3>
                </div>
                {uploads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-tertiary)' }}>
                    <Upload size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                    <p>No uploads yet.</p>
                  </div>
                ) : (
                  <UploadList uploads={uploads.slice(0, 5)} />
                )}
              </div>
            </div>
          )}

          {/* Commands */}
          {activeTab === 'commands' && (
            <div className="content-panel">
              <h1 className="h-xs" style={{ marginBottom: '24px' }}>Run Command</h1>

              <div className="card" style={{ maxWidth: '640px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 510, color: 'var(--text-tertiary)', marginBottom: '8px' }}>Command</label>
                    <select
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      className="input"
                      style={{ maxWidth: '320px' }}
                    >
                      <option value="init">init — YouTube OAuth</option>
                      <option value="fetch">fetch — Download video metadata</option>
                      <option value="process">process — Generate Shorts from video</option>
                      <option value="upload">upload — Upload Short to YouTube</option>
                      <option value="full-run">full-run — Complete pipeline</option>
                      <option value="dashboard">dashboard — Show summary</option>
                      <option value="list">list — List all videos</option>
                      <option value="clear">clear — Reset database</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 510, color: 'var(--text-tertiary)', marginBottom: '8px' }}>Arguments</label>
                    <input
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder="e.g. --limit 2 --dry-run"
                      className="input mono"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button onClick={runCommand} disabled={isRunning} className={`btn ${isRunning ? 'btn-secondary' : 'btn-primary'}`} style={{ minWidth: '100px' }}>
                      <Play size={16} /> {isRunning ? 'Running…' : 'Run'}
                    </button>
                    {isRunning && (
                      <button onClick={stopCommand} className="btn btn-secondary" style={{ borderColor: 'var(--text-quaternary)', color: 'var(--text-secondary)' }}>
                        <Square size={16} /> Stop
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '28px', padding: '20px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                  <h4 className="h-nano" style={{ marginBottom: '12px', color: 'var(--text-tertiary)' }}>Quick Reference</h4>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                    {[
                      ['init', 'Start OAuth flow (opens browser)'],
                      ['fetch --limit 5', 'Get latest 5 videos from channel'],
                      ['process <id>', 'Generate Shorts for one video'],
                      ['upload all', 'Upload processed Shorts to YouTube'],
                      ['full-run --limit 2', 'End-to-end pipeline'],
                      ['full-run --limit 2 --dry-run', 'Test without uploading'],
                    ].map(([cmd, desc]) => (
                      <div key={cmd} style={{ display: 'flex', gap: '12px' }}>
                        <code className="mono" style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)', minWidth: '200px' }}>{cmd}</code>
                        <span style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Uploads */}
          {activeTab === 'uploads' && (
            <div className="content-panel">
              <h1 className="h-xs" style={{ marginBottom: '24px' }}>Upload History</h1>
              <div className="card">
                {uploads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                    <Upload size={40} style={{ marginBottom: '16px', opacity: 0.4 }} />
                    <p>No uploads recorded yet.</p>
                    <p className="text-muted" style={{ marginTop: '8px' }}>After a successful upload, Shorts appear here.</p>
                  </div>
                ) : (
                  <UploadList uploads={uploads} />
                )}
              </div>
            </div>
          )}

          {/* Database */}
          {activeTab === 'database' && (
            <div className="content-panel">
              <h1 className="h-xs" style={{ marginBottom: '24px' }}>Database</h1>
              <div className="card">
                <h3 className="h-nano" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>Tables</h3>
                {dbTables.length === 0 ? (
                  <p className="text-muted">Database not initialized. Run <code className="mono" style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>init</code> to create tables.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dbTables.map((row, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <Database size={16} style={{ color: 'var(--accent-violet)' }} />
                        <code className="mono" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{row.name}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <div className="content-panel">
              <h1 className="h-xs" style={{ marginBottom: '24px' }}>Settings</h1>
              <div className="card" style={{ maxWidth: '720px' }}>
                <p className="text-body-medium" style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                  Configuration files stored in the project root. Edit these manually; the app reads them on launch.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    ['config.yaml', 'Main configuration (AI provider, video settings)'],
                    ['.env', 'Environment variables (API keys)'],
                    ['data/processor.db', 'SQLite state database'],
                    ['~/.youtube-shorts/', 'OAuth tokens (auto-generated)'],
                  ].map(([file, desc]) => (
                    <div key={file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div className="mono" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{file}</div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => window.electronAPI?.openExternal('https://hermes-agent.nousresearch.com/docs')} className="btn btn-secondary">
                    <ExternalLink size={16} /> Open Documentation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Terminal / Logs */}
          {activeTab === 'logs' && (
            <div className="content-panel" style={{ padding: '24px' }}>
              <h1 className="h-xs" style={{ marginBottom: '24px' }}>Terminal</h1>
              <LogPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
