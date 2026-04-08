import React, { useState, useEffect } from 'react';
import { getImpactAnalysis, getFileSummary } from '../api';
import ReactMarkdown from 'react-markdown';

export default function NodeDetailPanel({ node, repoId, onClose, onTraceFlow }) {
  const [impactData, setImpactData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node || !repoId) return;

    let target = '';
    let filePath = '';
    
    if (node.type === 'moduleNode') {
      target = node.data.fullPath;
      filePath = node.data.fullPath;
    } else if (node.type === 'functionNode') {
      target = node.data.qualifiedName;
      filePath = node.data.module;
    }

    if (target) {
      setLoading(true);
      Promise.all([
        getImpactAnalysis(repoId, target).catch(() => null),
        filePath ? getFileSummary(repoId, filePath).catch(() => null) : Promise.resolve(null)
      ]).then(([impact, summary]) => {
        setImpactData(impact);
        setSummaryData(summary);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [node, repoId]);

  if (!node) return null;

  const isModule = node.type === 'moduleNode';
  const data = node.data;

  return (
    <div style={{
      position: 'absolute', right: 20, top: 20, width: 360,
      background: 'var(--bg-1, #0f0f0f)', border: '1px solid var(--border, #262626)',
      borderRadius: 12, padding: '20px', boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
      fontFamily: "'Inter', sans-serif", color: '#eee', zIndex: 100,
      display: 'flex', flexDirection: 'column', gap: 16,
      maxHeight: 'calc(100% - 40px)', overflowY: 'auto',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#fff', wordBreak: 'break-all', paddingRight: '12px', letterSpacing: '-0.01em' }}>
          {data.label}
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button 
            onClick={() => onTraceFlow && onTraceFlow(node.id)}
            style={{ 
              background: '#6366f1', border: 'none', color: '#white', fontWeight: 600,
              cursor: 'pointer', fontSize: 11, padding: '4px 10px', borderRadius: '6px'
            }}>
            Trace
          </button>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', border: 'none', color: '#666', 
              cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: '10px'
            }}>
            ✕
          </button>
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', gap: 8, flexWrap: 'wrap', 
        paddingBottom: 12, borderBottom: '1px solid #ffffff10' 
      }}>
        <span style={{ 
          fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
          background: 'rgba(255,255,255,0.05)', color: '#888', textTransform: 'uppercase'
        }}>
          {isModule ? 'Module' : 'Function'}
        </span>
        {data.category && (
          <span style={{ 
            fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
            background: `${data.color}20`, color: data.color, border: `1px solid ${data.color}30`,
            textTransform: 'uppercase'
          }}>
            {data.category}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
           <span className="spinner" style={{ width: 14, height: 14 }} />
           <span style={{ fontSize: 12, color: '#666' }}>Analyzing role...</span>
        </div>
      ) : (
        <>
          {/* Strategic Pillar 1: Why it exists */}
          {summaryData && (
            <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>
                  1. Why this exists
                </div>
                <div style={{ fontSize: 12, color: '#ccc', lineHeight: '1.5', background: 'rgba(99,102,241,0.05)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #6366f1' }}>
                  {summaryData.explanation.split('## Role in Architecture')[1]?.split('##')[0]?.trim() || 
                   "Establishing strategic context..."}
                </div>
              </div>

              {/* Strategic Pillar 2: Architectural Role */}
              <div>
                <div style={{ fontSize: 10, color: '#10b981', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>
                  2. Architectural Role
                </div>
                <div style={{ fontSize: 12, color: '#ccc', lineHeight: '1.5', background: 'rgba(16,185,129,0.05)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                  {summaryData.explanation.split('## Purpose')[1]?.split('##')[0]?.trim() || 
                   summaryData.explanation.split('## Summary')[1]?.split('##')[0]?.trim() ||
                   "Defining component boundaries..."}
                </div>
              </div>
            </div>
          )}

          {/* Strategic Pillar 3: Dependents */}
          {impactData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>
                  3. What depends on this
                </div>
                <div style={{ background: 'rgba(245,158,11,0.05)', borderRadius: 8, padding: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {impactData.impacted_modules.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {impactData.impacted_modules.slice(0, 5).map(m => (
                        <div key={m} style={{ fontSize: '11px', fontFamily: 'var(--mono)', color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 }}>
                           <span style={{ color: '#f59e0b', opacity: 0.6 }}>•</span>
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.split('/').pop()}</span>
                        </div>
                      ))}
                      {impactData.impacted_modules.length > 5 && (
                        <div style={{ fontSize: '10px', color: '#666', marginTop: 4, paddingLeft: 12 }}>+ {impactData.impacted_modules.length - 5} other critical dependents</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>Terminal component (no detected dependents)</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Technical Metadata */}
          <div style={{ 
            marginTop: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 8px' 
          }}>
            {isModule ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase' }}>Language</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{data.language}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase' }}>Scope</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{data.loc} LOC</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase' }}>Complexity</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: data.complexity > 10 ? '#ef4444' : '#eee' }}>{data.complexity}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase' }}>Params</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{data.params?.length || 0}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
