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
          <span style={{ fontSize: '13px' }}>🗂</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Architecture Overview</span>
          {summary.files_analyzed > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 8px' }}>
              {summary.files_analyzed} files
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
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
