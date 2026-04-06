import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { askQuestion } from '../api';

const SUGGESTIONS = [
  'What does this project do?',
  'Explain the overall architecture.',
  'What are the main entry points?',
  'What dependencies does it use?',
];

export default function ChatPanel({ repoId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const res = await askQuestion(repoId, q);
      setMessages(prev => [...prev, { role: 'ai', text: res.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}`, err: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ask about this repo</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: 8 }}>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: 10 }}>Suggested questions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    textAlign: 'left', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
                    padding: '8px 12px', fontSize: '12.5px', color: 'var(--text-2)', cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'user' ? (
              <div style={{
                background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                borderRadius: '10px 10px 2px 10px',
                padding: '8px 12px', maxWidth: '88%',
                fontSize: '13px', color: 'var(--text)',
              }}>
                {m.text}
              </div>
            ) : (
              <div style={{
                background: m.err ? 'var(--red-dim)' : 'var(--bg-1)',
                border: `1px solid ${m.err ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                borderRadius: '2px 10px 10px 10px',
                padding: '10px 14px', maxWidth: '100%', width: '100%',
                color: m.err ? 'var(--red)' : undefined,
              }}>
                <div className="chat-prose">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '2px 10px 10px 10px', width: 'fit-content' }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)', display: 'block', animation: 'pulse-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 4px 4px 12px' }}>
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about the codebase…"
            disabled={loading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text)', padding: '4px 0' }}
          />
          <button
            id="chat-send-button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? 'var(--blue)' : 'var(--bg-3)',
              border: 'none', borderRadius: 6, padding: '6px 10px',
              color: input.trim() && !loading ? '#fff' : 'var(--text-3)',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 5, paddingLeft: 4 }}>Press Enter to send</p>
      </div>
    </div>
  );
}
