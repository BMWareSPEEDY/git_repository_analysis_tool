import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listFiles, getAnalysisStatus, getRepoSummary } from '../api';
import FileTree from '../components/FileTree';
import ExplanationPanel from '../components/ExplanationPanel';
import ChatPanel from '../components/ChatPanel';
import RepoSummary from '../components/RepoSummary';
import MentalModelPanel from '../components/MentalModelPanel';
import InsightsPanel from '../components/InsightsPanel';

const SIDEBAR_W = 260;
const CHAT_W    = 340;

// View tabs for the main content area
const VIEWS = [
  { 
    id: 'code',    
    label: 'Code',          
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
      </svg>
    ) 
  },
  { 
    id: 'model',   
    label: 'Mental Model',  
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 14v-2m0-4h.01" />
        <path d="M15 9a3 3 0 10-6 0c0 1.657 1.343 3 3 3s3-1.343 3-3z" />
      </svg>
    ) 
  },
  { 
    id: 'insights', 
    label: 'Insights',     
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ) 
  },
];

export default function RepoPage() {
  const { repoId } = useParams();
  const navigate = useNavigate();

  const [files,       setFiles]       = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [summary,     setSummary]     = useState(null);
  const [status,      setStatus]      = useState({ status: 'idle' });
  const [showChat,    setShowChat]    = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [activeView,  setActiveView]  = useState('code');
  const [traceTarget, setTraceTarget] = useState(null);

  // Resizable Chat logic
  const [chatWidth, setChatWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing  = useCallback(() => setIsResizing(false), []);
  const onResize      = useCallback((e) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 240 && newWidth < 900) setChatWidth(newWidth);
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', onResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, onResize, stopResizing]);

  const handleChatAction = useCallback((action) => {
    if (action.type === 'trace') {
      setActiveView('model');
      setTraceTarget(action.target);
    }
  }, []);

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

  /* ── Initial file load ─────────────────────────── */
  useEffect(() => {
    listFiles(repoId).then(d => setFiles(d.files)).catch(() => {});
  }, [repoId]);

  const onSelect = useCallback(f => {
    setSelected(f);
    setActiveView('code'); // Switch to code view when selecting a file
  }, []);

  const analyzing  = !['done','error','idle'].includes(status.status);
  const pct        = status.total_files
    ? Math.round((status.files_processed / status.total_files) * 100)
    : 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Top bar ────────────────────────────── */}
      <header style={{
        height: 46, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 14px',
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', color: 'var(--text-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '12px', padding: '4px 8px', borderRadius: 6,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 10px rgba(99,102,241,0.2)',
            }}>
              <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path strokeLinecap="round" d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
              </svg>
            </div>
            <span style={{
              fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em',
              background: 'linear-gradient(135deg, #c7d2fe, #818cf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              PEEK
            </span>
          </div>

          <span style={{
            fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)',
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 7px',
          }}>
            {repoId}
          </span>
        </div>

        {/* Center — View tabs */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', borderRadius: 7, padding: 2 }}>
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              style={{
                padding: '5px 12px', borderRadius: 5,
                background: activeView === v.id ? 'var(--bg-3)' : 'none',
                border: activeView === v.id ? '1px solid var(--border-2)' : '1px solid transparent',
                color: activeView === v.id ? 'var(--text)' : 'var(--text-3)',
                fontSize: '11.5px', fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '12px' }}>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress */}
          {analyzing && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 6, padding: '4px 10px',
            }}>
              <span className="spinner" style={{ width: 12, height: 12, borderWidth: '1.5px', borderTopColor: '#6366f1' }} />
              <span style={{ fontSize: '12px', color: '#818cf8' }}>
                {status.current_phase || status.status}
              </span>
              {status.total_files > 0 && status.status === 'analyzing' && (
                <>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    {status.files_processed}/{status.total_files}
                  </span>
                  <div style={{ width: 48, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </>
              )}
            </div>
          )}
          {status.status === 'done' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '12px', color: 'var(--green)',
              background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 6, padding: '4px 10px',
            }}>
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
              <span>🗂</span>Overview
            </button>
          )}

          {/* Chat toggle */}
          <button
            onClick={() => setShowChat(o => !o)}
            title="Toggle query engine"
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
            Query
          </button>
        </div>
      </header>

      {/* ── Summary bar (collapsible) ─────────────── */}
      {summary && showSummary && (
        <div className="fade-up" style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-1)', flexShrink: 0,
        }}>
          <RepoSummary summary={summary} />
        </div>
      )}

      {/* ── Main layout ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar (always visible for file tree) */}
        <aside style={{
          width: SIDEBAR_W, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-1)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px 8px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{
              fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--text-3)',
            }}>
              Explorer
            </span>
            <span style={{
              fontSize: '11px', color: 'var(--text-3)',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '1px 6px',
            }}>
              {files.length}
            </span>
          </div>
          <FileTree files={files} selected={selected} onSelect={onSelect} />
        </aside>

        {/* Main content area — switches based on activeView */}
        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'var(--bg)',
        }}>
          {activeView === 'code' && (
            <ExplanationPanel repoId={repoId} selectedFile={selected} />
          )}
          {activeView === 'model' && (
            <MentalModelPanel repoId={repoId} traceTarget={traceTarget} />
          )}
          {activeView === 'insights' && (
            <InsightsPanel repoId={repoId} />
          )}
        </main>

        {/* Chat panel (query engine) with Resizer */}
        {showChat && (
          <>
            <div 
              onMouseDown={startResizing}
              style={{
                width: 4, cursor: 'col-resize',
                background: isResizing ? 'var(--blue)' : 'transparent',
                transition: 'background 0.2s', zIndex: 10,
                borderLeft: '1px solid var(--border)',
                marginLeft: -2
              }}
            />
            <aside style={{
              width: chatWidth, flexShrink: 0,
              background: 'var(--bg-1)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <ChatPanel repoId={repoId} onChatAction={handleChatAction} />
            </aside>
          </>
        )}
      </div>

      {/* ── Status bar ────────────────────────────────── */}
      <footer style={{
        height: 24, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 14px',
        background: 'var(--bg-1)', borderTop: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '11px', color: 'var(--text-3)' }}>
          <span>{files.length} files</span>
          {selected && <span style={{ fontFamily: 'var(--mono)' }}>{selected}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px', color: 'var(--text-3)' }}>
          <span style={{
            background: 'linear-gradient(135deg, #c7d2fe, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            fontWeight: 600,
          }}>
            PEEK
          </span>
          <span>·</span>
          <span>gemini-3-flash-preview</span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: analyzing
              ? 'var(--amber)'
              : status.status === 'done' ? 'var(--green)' : 'var(--text-3)',
            display: 'inline-block',
          }} />
        </div>
      </footer>
    </div>
  );
}
