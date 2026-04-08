import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function RepoSummary({ summary }) {
  const [open, setOpen] = useState(true);
  if (!summary) return null;

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v12a2 2 0 01-2 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8M8 17h8" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Architecture Overview</span>
          {summary.files_analyzed > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 8px' }}>
              {summary.files_analyzed} files
            </span>
          )}
        </div>
        <svg 
          width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-3)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="fade-up" style={{ padding: '16px 20px', maxHeight: 360, overflowY: 'auto' }}>
          <div className="prose" style={{ fontSize: '13px' }}>
            <ReactMarkdown>{summary.summary || 'No summary available.'}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
