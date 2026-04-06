import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getMentalModel, getMentalModelSummary } from '../api';

/* ─── Custom Module Node ──────────────────────────────── */
const LANG_COLORS = {
  python: '#3776ab',
  javascript: '#f7df1e',
  typescript: '#3178c6',
  java: '#b07219',
  go: '#00add8',
  rust: '#dea584',
  ruby: '#701516',
  cpp: '#f34b7d',
  c: '#555555',
  csharp: '#178600',
  swift: '#ffac45',
  kotlin: '#A97BFF',
  php: '#4F5D95',
  dart: '#00B4AB',
  scala: '#c22d40',
  shell: '#89e051',
  unknown: '#555555',
};

function ModuleNodeComponent({ data }) {
  const langColor = LANG_COLORS[data.language] || LANG_COLORS.unknown;

  return (
    <div style={{
      background: 'var(--bg-1, #111)',
      border: '1px solid var(--border, #2a2a2a)',
      borderRadius: 10,
      padding: '12px 16px',
      minWidth: 180,
      maxWidth: 260,
      fontFamily: "'Inter', sans-serif",
      transition: 'border-color 0.2s, box-shadow 0.2s',
      cursor: 'grab',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#6366f1', width: 8, height: 8, border: '2px solid #0a0a0a' }} />

      {/* Header with language indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: langColor,
          boxShadow: `0 0 6px ${langColor}60`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#eee',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {data.label}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.functions > 0 && (
          <span style={{
            fontSize: '10px', padding: '2px 6px', borderRadius: 10,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            color: '#818cf8',
          }}>
            {data.functions} fn
          </span>
        )}
        {data.classes > 0 && (
          <span style={{
            fontSize: '10px', padding: '2px 6px', borderRadius: 10,
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#22c55e',
          }}>
            {data.classes} cls
          </span>
        )}
        <span style={{
          fontSize: '10px', padding: '2px 6px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#999',
        }}>
          {data.loc} LOC
        </span>
      </div>

      {/* Full path tooltip */}
      {data.fullPath && (
        <div style={{
          fontSize: '10px', color: '#555', marginTop: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {data.fullPath}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: '#3b82f6', width: 8, height: 8, border: '2px solid #0a0a0a' }} />
    </div>
  );
}

const nodeTypes = { moduleNode: ModuleNodeComponent };

/* ─── Main MentalModelPanel ───────────────────────── */
export default function MentalModelPanel({ repoId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!repoId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [graphData, summaryData] = await Promise.all([
          getMentalModel(repoId),
          getMentalModelSummary(repoId),
        ]);

        if (cancelled) return;

        // Apply auto-layout: arrange nodes in a grid
        const layoutNodes = (graphData.nodes || []).map((n, i) => ({
          ...n,
          position: n.position || { x: (i % 5) * 300, y: Math.floor(i / 5) * 220 },
        }));

        setNodes(layoutNodes);
        setEdges(graphData.edges || []);
        setSummary(summaryData);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [repoId]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <span className="spinner" style={{ width: 20, height: 20 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading mental model…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '2rem', maxWidth: 400, textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: 12 }}>🧠</div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Mental Model Not Ready
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.6 }}>
            The mental model will be available once the analysis completes. It builds automatically during the analysis pipeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Summary bar */}
      {summary && (
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
          background: 'var(--bg-1)', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>🧠 Mental Model</span>
          {[
            ['Modules', summary.total_modules, '#6366f1'],
            ['Functions', summary.total_functions, '#3b82f6'],
            ['Classes', summary.total_classes, '#22c55e'],
            ['LOC', summary.total_loc?.toLocaleString(), '#f59e0b'],
            ['Smells', summary.code_smells, summary.code_smells > 0 ? '#ef4444' : '#22c55e'],
          ].map(([label, value, color]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '11px', color: 'var(--text-3)',
            }}>
              <span style={{
                fontWeight: 700, color,
                fontSize: '12px',
                fontFamily: 'var(--mono)',
              }}>
                {value}
              </span>
              {label}
            </div>
          ))}
          {summary.languages?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {summary.languages.map(lang => (
                <span key={lang} style={{
                  fontSize: '10px', padding: '2px 7px', borderRadius: 10,
                  background: `${LANG_COLORS[lang] || '#555'}15`,
                  border: `1px solid ${LANG_COLORS[lang] || '#555'}30`,
                  color: LANG_COLORS[lang] || '#555',
                  fontFamily: 'var(--mono)',
                }}>
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ReactFlow canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#3b82f640', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#3b82f660' },
          }}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--bg, #0a0a0a)' }}
        >
          <Background color="#1a1a1a" gap={20} size={1} />
          <Controls
            style={{
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden',
            }}
          />
          <MiniMap
            nodeColor={(n) => LANG_COLORS[n.data?.language] || '#555'}
            maskColor="rgba(0,0,0,0.7)"
            style={{
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
