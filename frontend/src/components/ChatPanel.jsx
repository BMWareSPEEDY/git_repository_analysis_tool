import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { askQuestion, getConversations, getConversation } from '../api';

const SUGGESTIONS = [
  'What does this project do?',
  'Which modules handle user authentication?',
  'Trace the data flow from input to output.',
  'What are the main entry points?',
  'What external dependencies does it use?',
  'Show me the most complex functions.',
];

export default function ChatPanel({ repoId, onChatAction }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation history on mount
  useEffect(() => {
    if (!repoId) return;
    getConversations(repoId)
      .then(data => setConversations(data.conversations || []))
      .catch(() => {});
  }, [repoId]);

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
      const res = await askQuestion(repoId, q, conversationId);
      setMessages(prev => [...prev, { role: 'ai', text: res.answer }]);
      
      // Track conversation ID for follow-ups
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }
      
      // Notify parent if the question was identified as a tracing intent
      if (res.intent && res.intent.type === 'flow' && res.intent.target) {
        if (onChatAction) onChatAction({ type: 'trace', target: res.intent.target });
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${e.message}`, err: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const loadConversation = async (convId) => {
    try {
      const data = await getConversation(repoId, convId);
      setConversationId(convId);
      setMessages((data.messages || []).map(m => ({
        role: m.role, text: m.content,
      })));
      setShowHistory(false);
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Query Engine
          </span>
          {conversationId && (
            <span style={{
              fontSize: '10px', padding: '1px 6px', borderRadius: 10,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.15)',
              color: '#818cf8', fontFamily: 'var(--mono)',
            }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
                <path d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4" />
              </svg>
              memory
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            title="Conversation history"
            style={{
              background: showHistory ? 'var(--bg-3)' : 'none',
              border: '1px solid ' + (showHistory ? 'var(--border-2)' : 'var(--border)'),
              borderRadius: 5, padding: '3px 7px', fontSize: '11px',
              color: 'var(--text-3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {conversations.length > 0 && conversations.length}
          </button>
          <button
            onClick={startNewChat}
            title="New conversation"
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 5, padding: '3px 7px', fontSize: '11px',
              color: 'var(--text-3)', cursor: 'pointer',
            }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* History sidebar overlay */}
      {showHistory && (
        <div className="fade-up" style={{
          borderBottom: '1px solid var(--border)',
          maxHeight: 220, overflowY: 'auto', flexShrink: 0,
          background: 'var(--bg-2)',
        }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-3)', textAlign: 'center' }}>
              No conversations yet. Start chatting!
            </div>
          ) : (
            conversations.map(c => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', padding: '9px 14px',
                  background: conversationId === c.id ? 'var(--bg-3)' : 'none',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: '12px', color: 'var(--text-2)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (conversationId !== c.id) e.currentTarget.style.background = 'var(--bg-1)'; }}
                onMouseLeave={e => { if (conversationId !== c.id) e.currentTarget.style.background = 'none'; }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '12px', fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: 2 }}>
                    {c.message_count} messages
                  </div>
                </div>
                {conversationId === c.id && (
                  <span style={{
                    fontSize: '9px', padding: '1px 5px', borderRadius: 8,
                    background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                    fontWeight: 600, flexShrink: 0,
                  }}>
                    active
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

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
                position: 'relative'
              }}>
                <div className="chat-prose">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
                
                {/* Contextual Trace Button */}
                {m.text && !m.err && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        // Regex to find file-like strings (e.g., vanilla.ts, index.js, src/store.py)
                        const matches = m.text.match(/[a-zA-Z0-9_-]+\.(ts|js|jsx|tsx|py|md|json)/g);
                        if (matches && matches.length > 0) {
                          onChatAction({ type: 'trace', target: matches.join(',') });
                        }
                      }}
                      style={{
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 5, padding: '3px 8px', fontSize: '10px',
                        color: '#818cf8', cursor: 'pointer', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                    >
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4" />
                      </svg>
                      Trace this Path
                    </button>
                  </div>
                )}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, paddingLeft: 4 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Press Enter to send</span>
          {conversationId && (
            <span style={{ fontSize: '10px', color: '#818cf8', fontFamily: 'var(--mono)' }}>
              conv:{conversationId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
