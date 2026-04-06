import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getFileSummary } from '../api';

function Skeleton() {
  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span className="spinner" />
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Generating explanation…</span>
      </div>
      {[120, 90, 160, 100, 200, 80, 140].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: `${w}px`, maxWidth: '100%', marginBottom: 10 }} />
      ))}
    </div>
  );
}

export default function ExplanationPanel({ repoId, selectedFile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('explanation');

  useEffect(() => {
    if (!selectedFile || !repoId) { setData(null); return; }
    let cancelled = false;
    setLoading(true); setError('');
    getFileSummary(repoId, selectedFile)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [repoId, selectedFile]);

  if (!selectedFile) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexDirection: 'column', gap: 10 }}>
      <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span style={{ fontSize: '13px' }}>Select a file to view its explanation</span>
    </div>
  );

  if (loading) return <Skeleton />;

  if (error) return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: '13px', color: 'var(--red)' }}>
        {error}
      </div>
    </div>
  );

  if (!data) return null;

  const explanation = data.explanation || '';
  const rawContent = data.content || '';
  const ext = selectedFile.split('.').pop() || 'text';

  return (
    <div className="fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* File header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-1)', flexShrink: 0 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" fill="none" stroke="var(--text-3)" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-2)' }}>{selectedFile}</span>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-2)', padding: 3, borderRadius: 6, marginLeft: '12px' }}>
          <button
            onClick={() => setActiveTab('explanation')}
            style={{
              background: activeTab === 'explanation' ? 'var(--bg-3)' : 'transparent',
              color: activeTab === 'explanation' ? 'var(--text)' : 'var(--text-3)',
              border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Explanation
          </button>
          <button
            onClick={() => setActiveTab('code')}
            style={{
              background: activeTab === 'code' ? 'var(--bg-3)' : 'transparent',
              color: activeTab === 'code' ? 'var(--text)' : 'var(--text-3)',
              border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Raw Code
          </button>
        </div>

        {data.cached && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>
            cached
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: activeTab === 'explanation' ? '1.5rem 2rem' : '1rem' }}>
        {activeTab === 'explanation' ? (
          <div className="prose">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        ) : (
          <div className="chat-prose" style={{ margin: 0, padding: 0 }}>
            {/* Wrap in Markdown to get automatic VS code-like syntax highlighting */}
            <ReactMarkdown>{`\`\`\`${ext}\n${rawContent}\n\`\`\``}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
