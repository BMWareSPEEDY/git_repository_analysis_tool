import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listFiles, getAnalysisStatus, getRepoSummary } from '../api';
import FileTree from '../components/FileTree';
import ExplanationPanel from '../components/ExplanationPanel';
import ChatPanel from '../components/ChatPanel';
import RepoSummary from '../components/RepoSummary';

const SIDEBAR_W = 260;
const CHAT_W    = 340;

export default function RepoPage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const [files,     setFiles]     = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [summary,   setSummary]   = useState(null);
  const [status,    setStatus]    = useState({ status: 'idle' });
  const [showChat,  setShowChat]  = useState(true);
  const [showSummary, setShowSummary] = useState(false);

  /* ── Poll analysis status ──────────────────────── */
  useEffect(() => {
    let timer;
    let mounted = true;

    const poll = async () => {
      try {
        const s = await getAnalysisStatus(repoId);
        if (!mounted) return;
        setStatus(s);

        if (s.status === 'done') {
          // load files + summary once done
          try { const f = await listFiles(repoId); if (mounted) setFiles(f.files); } catch {}
          try { const r = await getRepoSummary(repoId); if (mounted) { setSummary(r); setShowSummary(true); } } catch {}
        } else if (s.status !== 'error') {
          timer = setTimeout(poll, 2000);
        }
      } catch { /* ignore */ }
    };

    poll();
    return () => { mounted = false; clearTimeout(timer); };
  }, [repoId]);

  /* ── Initial file load (even while running) ─── */
  useEffect(() => {
    listFiles(repoId).then(d => setFiles(d.files)).catch(() => {});
  }, [repoId]);

  const onSelect = useCallback(f => setSelected(f), []);

  const analyzing  = !['done','error','idle'].includes(status.status);
  const pct        = status.total_files
    ? Math.round((status.files_processed / status.total_files) * 100)
    : 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Top bar ────────────────────────────── */}
      <header style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px', padding: '4px 8px', borderRadius: 6, transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>CodeExplainer</span>
          </div>

          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px' }}>{repoId}</span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress */}
          {analyzing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', borderRadius: 6, padding: '4px 10px' }}>
              <span className="spinner" style={{ width: 12, height: 12, borderWidth: '1.5px' }} />
              <span style={{ fontSize: '12px', color: 'var(--blue)' }}>
                {status.status === 'scanning' ? 'Scanning…' :
                 status.status === 'summarizing' ? 'Summarizing…' :
                 `${status.files_processed}/${status.total_files} files`}
              </span>
              {status.total_files > 0 && (
                <div style={{ width: 48, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          )}
          {status.status === 'done' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '4px 10px' }}>
              <span>✓</span> Done
            </div>
          )}

          {/* Summary toggle */}
          {summary && (
            <button
              onClick={() => setShowSummary(o => !o)}
              title="Toggle architecture overview"
              style={{
                background: showSummary ? 'var(--bg-3)' : 'none',
                border: '1px solid ' + (showSummary ? 'var(--border-2)' : 'var(--border)'),
                borderRadius: 6, padding: '4px 10px',
                fontSize: '12px', color: showSummary ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span>🗂</span> Overview
            </button>
          )}

          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(o => !o)}
            title="Toggle chat"
            style={{
              background: showChat ? 'var(--bg-3)' : 'none',
              border: '1px solid ' + (showChat ? 'var(--border-2)' : 'var(--border)'),
              borderRadius: 6, padding: '4px 10px',
              fontSize: '12px', color: showChat ? 'var(--text)' : 'var(--text-2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </button>
        </div>
      </header>

      {/* ── Summary bar (collapsible under header) ── */}
      {summary && showSummary && (
        <div className="fade-up" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', flexShrink: 0 }}>
          <RepoSummary summary={summary} />
        </div>
      )}

      {/* ── Main 3-panel layout ───────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside style={{ width: SIDEBAR_W, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-1)', overflow: 'hidden' }}>
          {/* Sidebar header */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>Explorer</span>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>{files.length}</span>
          </div>
          <FileTree files={files} selected={selected} onSelect={onSelect} />
        </aside>

        {/* Main explanation panel */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
          <ExplanationPanel repoId={repoId} selectedFile={selected} />
        </main>

        {/* Chat panel */}
        {showChat && (
          <aside style={{ width: CHAT_W, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatPanel repoId={repoId} />
          </aside>
        )}
      </div>

      {/* ── Status bar ─────────────────────────────── */}
      <footer style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', background: 'var(--bg-1)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '11px', color: 'var(--text-3)' }}>
          <span>{files.length} files</span>
          {selected && <span style={{ fontFamily: 'var(--mono)' }}>{selected}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px', color: 'var(--text-3)' }}>
          <span>gemini-3-flash-preview</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: analyzing ? 'var(--amber)' : status.status === 'done' ? 'var(--green)' : 'var(--text-3)', display: 'inline-block' }} />
        </div>
      </footer>
    </div>
  );
}
