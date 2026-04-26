import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cloneRepo, analyzeRepo } from '../api';

const EXAMPLES = [
  'tiangolo/fastapi',
  'expressjs/express',
  'vitejs/vite',
];

const FEATURES = [
  {
    icon: '🧠',
    title: 'Mental Model Engine',
    desc: 'Auto-builds a rich, queryable graph of modules, classes, functions, and data flows.',
    color: '#a78bfa',
  },
  {
    icon: '🔍',
    title: 'Automated Code Indexing',
    desc: 'Parses files across 30+ languages. Extracts call graphs, hierarchies, and dependency trees.',
    color: '#3b82f6',
  },
  {
    icon: '💬',
    title: 'Complex Query Engine',
    desc: '"Which modules handle auth?" "Trace data from input to DB." — answered with references.',
    color: '#22c55e',
  },
  {
    icon: '🗺️',
    title: 'Visual Architecture',
    desc: 'Interactive diagrams of module connections, call graphs, and data pipelines via ReactFlow.',
    color: '#f59e0b',
  },
  {
    icon: '🤖',
    title: 'Agent Integration',
    desc: 'Plug-in for AI assistants to reason about codebases — suggesting refactors and generating tests.',
    color: '#ec4899',
  },
  {
    icon: '🔒',
    title: 'Security & Compliance',
    desc: 'Detects hardcoded secrets, insecure patterns, injection risks, and suggests fixes.',
    color: '#ef4444',
  },
  {
    icon: '📖',
    title: 'Living Documentation',
    desc: 'AI-generated docs that update with code changes. Onboarding guides auto-generated.',
    color: '#06b6d4',
  },
  {
    icon: '⏱️',
    title: 'Version-Aware',
    desc: 'Tracks architecture evolution across versions. PR analysis for fast contribution reasoning.',
    color: '#8b5cf6',
  },
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
      setStep('Building mental model…');
      await analyzeRepo(repo_id);
      navigate(`/repo/${repo_id}`);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false); setStep('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', top: '-30%', left: '50%', width: '800px', height: '800px',
        transform: 'translateX(-50%)', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(59,130,246,0.04) 40%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ─── Hero Section ─────────────────────────────── */}
      <section style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6rem 2rem 3rem', position: 'relative', zIndex: 1,
      }}>
        <div style={{ width: '100%', maxWidth: 640 }} className="fade-up">

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.3)',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path strokeLinecap="round" d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
              </svg>
            </div>
            <span style={{
              fontWeight: 700, fontSize: '17px', letterSpacing: '-0.02em', color: 'var(--text)',
              background: 'linear-gradient(135deg, #c7d2fe, #818cf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              PEEK
            </span>
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: 20,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              color: '#818cf8', fontWeight: 500, letterSpacing: '0.03em',
            }}>
              v2.0
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: '36px', fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 1.15, color: 'var(--text)', marginBottom: 14,
          }}>
            Build a <span style={{
              background: 'linear-gradient(135deg, #818cf8, #3b82f6, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Mental Model</span><br />
            of any codebase
          </h1>

          {/* Subtitle */}
          <p style={{
            color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.7, maxWidth: 500, marginBottom: 8,
          }}>
            <strong style={{ color: 'var(--text)' }}>Project Exploration & Examination Kit.</strong>{' '}
            Paste a GitHub URL. Get an AI-powered mental model with architecture graphs, security insights, and natural-language Q&A.
          </p>

          {/* Acronym pill */}
          <div style={{
            display: 'inline-flex', gap: 2, marginBottom: 28,
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)',
          }}>
            {['P','E','E','K'].map((letter, i) => (
              <span key={i} style={{
                fontSize: '11px', fontWeight: 700, color: '#818cf8',
                fontFamily: 'var(--mono)',
              }}>
                {letter}
              </span>
            ))}
            <span style={{ fontSize: '10px', color: 'var(--text-3)', marginLeft: 6 }}>
              Project Exploration & Examination Kit
            </span>
          </div>

          {/* Input card */}
          <div style={{
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '22px', marginBottom: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-3)', marginBottom: 10,
            }}>
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
                style={{
                  flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '10px 14px', color: 'var(--text)',
                  fontSize: '13px', fontFamily: 'var(--mono)', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                id="analyze-button"
                onClick={handleAnalyze}
                disabled={loading || !url.trim()}
                style={{
                  background: (!loading && url.trim())
                    ? 'linear-gradient(135deg, #6366f1, #3b82f6)'
                    : 'var(--bg-3)',
                  color: (!loading && url.trim()) ? '#fff' : 'var(--text-3)',
                  border: 'none',
                  borderRadius: '8px', padding: '10px 20px',
                  fontWeight: 600, fontSize: '13px',
                  cursor: (!loading && url.trim()) ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 7,
                  whiteSpace: 'nowrap',
                  boxShadow: (!loading && url.trim()) ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderWidth: '1.5px' }} />{step}</>
                  : <>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <path strokeLinecap="round" d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83" />
                      </svg>
                      Analyze
                    </>}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="fade-up" style={{
              background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
              color: 'var(--red)', marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          {/* Examples */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Try:</span>
            {EXAMPLES.map(r => (
              <button
                key={r}
                onClick={() => setUrl(`https://github.com/${r}`)}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '3px 10px', fontSize: '12px',
                  color: 'var(--text-2)', cursor: 'pointer',
                  fontFamily: 'var(--mono)', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ────────────────────────────── */}
      <section style={{
        padding: '2rem 2rem 5rem', position: 'relative', zIndex: 1,
        maxWidth: 960, margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{
            fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em',
            color: 'var(--text)', marginBottom: 8,
          }}>
            Everything you need to understand code
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>
            From automated indexing to security compliance — powered by AI reasoning
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="fade-up"
              style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '20px 18px',
                transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
                animationDelay: `${i * 0.04}s`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = f.color + '40';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 4px 20px ${f.color}10`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: `${f.color}12`,
                border: `1px solid ${f.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '17px', marginBottom: 12,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: '13.5px', fontWeight: 600,
                color: 'var(--text)', marginBottom: 6,
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: '12.5px', color: 'var(--text-3)',
                lineHeight: 1.55,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────── */}
      <footer style={{
        padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--border)',
        fontSize: '12px', color: 'var(--text-3)',
      }}>
        <span style={{
          fontWeight: 600,
          background: 'linear-gradient(135deg, #c7d2fe, #818cf8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>PEEK</span>{' '}
        — Project Exploration & Examination Kit
        <br />
        <span style={{ opacity: 0.5 }}>Powered by Google Gemini · 100% Local-First · No Database</span>
      </footer>
    </div>
  );
}





