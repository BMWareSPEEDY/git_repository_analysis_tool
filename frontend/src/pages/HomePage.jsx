import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cloneRepo, analyzeRepo } from '../api';

const EXAMPLES = [
  'tiangolo/fastapi',
  'expressjs/express',
  'vitejs/vite',
];

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError('');

    try {
      setStep('Cloning…');
      const { repo_id } = await cloneRepo(trimmed);
      setStep('Starting analysis…');
      await analyzeRepo(repo_id);
      navigate(`/repo/${repo_id}`);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false); setStep('');
    }
  };

  const inputStyle = {
    flex: 1,
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'var(--text)',
    fontSize: '13px',
    fontFamily: 'var(--mono)',
    outline: 'none',
  };

  const btnStyle = (active) => ({
    background: active ? 'var(--blue)' : 'var(--bg-3)',
    color: active ? '#fff' : 'var(--text-3)',
    border: `1px solid ${active ? 'var(--blue)' : 'var(--border-2)'}`,
    borderRadius: '8px',
    padding: '8px 16px',
    fontWeight: 500,
    fontSize: '13px',
    cursor: active ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 520 }} className="fade-up">

        {/* Logo + title */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', color: 'var(--text)' }}>CodeExplainer</span>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, color: 'var(--text)', marginBottom: 10 }}>
            Understand any codebase<br />with AI
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.6 }}>
            Paste a GitHub URL. Get file-by-file explanations, an architecture summary, and a chat assistant — all running locally.
          </p>
        </div>

        {/* Input card */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 8 }}>
            GitHub Repository URL
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="repo-url-input"
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleAnalyze()}
              placeholder="https://github.com/user/repository"
              disabled={loading}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              id="analyze-button"
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              style={btnStyle(!loading && !!url.trim())}
            >
              {loading
                ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: '1.5px' }} />{step}</>
                : 'Analyze →'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="fade-up" style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* Examples */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Try:</span>
          {EXAMPLES.map(r => (
            <button
              key={r}
              onClick={() => setUrl(`https://github.com/${r}`)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Features */}
        <div style={{ display: 'flex', gap: 8, marginTop: '2.5rem', flexWrap: 'wrap' }}>
          {[
            ['⚡', 'File-by-file analysis'],
            ['🗂', 'Architecture overview'],
            ['💬', 'Chat with your codebase'],
            ['💾', 'Cached locally'],
          ].map(([icon, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 20, fontSize: '12px', color: 'var(--text-2)' }}>
              <span style={{ fontSize: '13px' }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
