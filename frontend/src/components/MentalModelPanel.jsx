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
  NodeResizer,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getMentalModel, getMentalModelSummary, getMentalModelFunctions } from '../api';
import NodeDetailPanel from './NodeDetailPanel';
import { applyForceLayout } from '../utils/graphLayout';
import { generateTooltipText } from '../utils/graphTransformers';
import mermaid from 'mermaid';
import { generateMermaidText } from '../utils/mermaidUtils';

/* ─── Custom Node Components ──────────────────────────────── */
const LANG_COLORS = {
  python: '#3776ab', javascript: '#f7df1e', typescript: '#3178c6', java: '#b07219',
  go: '#00add8', rust: '#dea584', ruby: '#701516', cpp: '#f34b7d', c: '#555555',
  csharp: '#178600', swift: '#ffac45', kotlin: '#A97BFF', php: '#4F5D95',
  dart: '#00B4AB', scala: '#c22d40', shell: '#89e051', unknown: '#555555',
};

function ModuleNodeComponent({ data }) {
  const [isHovered, setIsHovered] = useState(false);
  const langColor = LANG_COLORS[data.language] || LANG_COLORS.unknown;
  const opacity = data.dimmed ? 0.3 : 1;
  const tooltipTexts = generateTooltipText(data);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'rgba(17, 17, 17, 0.9)', border: `1px solid ${data.color || 'var(--border, #2a2a2a)'}`,
        borderRadius: 10, padding: '12px 14px', minWidth: 160, maxWidth: 240,
        fontFamily: "'Inter', sans-serif", transition: 'border-color 0.2s, box-shadow 0.2s', cursor: 'grab',
        opacity, boxShadow: data.dimmed ? 'none' : `0 4px 16px ${data.color || '#000'}30`,
        position: 'relative', backdropFilter: 'blur(10px)'
      }}>
      {/* Port Configuration for Horizontal Flow */}
      <Handle type="target" position={Position.Left} style={{ background: '#6366f1', width: 8, height: 8, border: '2px solid #000', left: -4 }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: langColor,
          boxShadow: `0 0 8px ${langColor}80`, flexShrink: 0,
        }} />
        <span style={{
          fontSize: '12px', fontWeight: 600, color: '#fff', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace",
        }}>
          {data.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.functions > 0 && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontWeight: 500 }}>{data.functions} fn</span>}
        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#ccc' }}>{data.loc} LOC</span>
      </div>

      {isHovered && tooltipTexts.length > 0 && !data.dimmed && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10, 10, 10, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px', zIndex: 1000, width: 'max-content',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'none'
        }}>
          {tooltipTexts.map((text, i) => (
             <span key={i} style={{ fontSize: 11, color: '#bbb', fontFamily: "'Inter', sans-serif" }}>• {text}</span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: '#3b82f6', width: 8, height: 8, border: '2px solid #000', right: -4 }} />
    </div>
  );
}

function FunctionNodeComponent({ data }) {
  const opacity = data.dimmed ? 0.3 : 1;
  return (
    <div style={{
      background: 'var(--bg-1, #111)', border: `1px solid ${data.color || 'var(--border, #2a2a2a)'}`,
      borderRadius: 20, padding: '8px 16px', minWidth: 120, maxWidth: 220,
      fontFamily: "'Inter', sans-serif", transition: 'all 0.2s', cursor: 'pointer',
      opacity, boxShadow: data.dimmed ? 'none' : `0 4px 12px ${data.color || '#000'}20`
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#a855f7', width: 6, height: 6, border: '1px solid #0a0a0a' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontSize: '11px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace",
        }}>
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#a855f7', width: 6, height: 6, border: '1px solid #0a0a0a' }} />
    </div>
  );
}

function ResizableGroupNode({ data, selected }) {
  return (
    <div style={{
      width: '100%', height: '100%', 
      background: 'rgba(255, 255, 255, 0.01)',
      border: `1px ${selected ? 'solid' : 'dashed'} rgba(255, 255, 255, 0.1)`,
      borderRadius: 16, borderTop: '24px solid rgba(255, 255, 255, 0.05)',
      position: 'relative', overflow: 'visible'
    }}>
      <NodeResizer minWidth={200} minHeight={150} color="#6366f1" isVisible={selected} />
      <div style={{
        position: 'absolute', top: -20, left: 12, fontSize: 11,
        fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { 
  moduleNode: ModuleNodeComponent, 
  functionNode: FunctionNodeComponent,
  group: ResizableGroupNode 
};

/* ─── Main MentalModelPanel ───────────────────────── */
export default function MentalModelPanel({ repoId, traceTarget }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rawGraph, setRawGraph] = useState({ nodes: [], edges: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  
  const [format, setFormat] = useState('interactive'); // 'interactive' | 'static'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'frontend' | 'backend' | 'shared'
  const [searchQuery, setSearchQuery] = useState('');
  const [tracedNodeIds, setTracedNodeIds] = useState([]); // Array of IDs to trace from
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [mermaidSvg, setMermaidSvg] = useState('');
  
  // Static view pan/zoom state
  const [staticZoom, setStaticZoom] = useState(1);
  const [staticPos, setStaticPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const viewMode = 'file'; // Restricted to File View

  useEffect(() => {
    if (!repoId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      setSelectedNode(null);
      setTracedNodeIds([]);
      try {
        const [graphData, summaryData] = await Promise.all([
          getMentalModel(repoId),
          getMentalModelSummary(repoId),
        ]);

        if (cancelled) return;

        setRawGraph({ nodes: graphData.nodes || [], edges: graphData.edges || [] });
        if (summaryData) setSummary(summaryData);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [repoId]);

  // Handle trace action from parent ChatPanel (supports single target or multi-target flow)
  useEffect(() => {
    if (!traceTarget || rawGraph.nodes.length === 0) return;

    // Split target if it's a comma-separated string or already an array
    const targets = Array.isArray(traceTarget) 
      ? traceTarget 
      : (typeof traceTarget === 'string' ? traceTarget.split(',').map(s => s.trim()) : [traceTarget]);

    const matchingIds = new Set();
    targets.forEach(t => {
      const targetLower = t.toString().toLowerCase();
      const node = rawGraph.nodes.find(n => 
         (n.data.label && n.data.label.toLowerCase().includes(targetLower)) ||
         (n.data.fullPath && n.data.fullPath.toLowerCase().includes(targetLower)) ||
         (n.data.qualifiedName && n.data.qualifiedName.toLowerCase().includes(targetLower))
      );
      if (node) matchingIds.add(node.id);
    });

    if (matchingIds.size > 0) {
      setTracedNodeIds([...matchingIds]); 
    } else {
      setTracedNodeIds([]);
    }
  }, [traceTarget, rawGraph.nodes]);

  useEffect(() => {
    if (format === 'static' && rawGraph.nodes.length > 0) {
      mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark',
        securityLevel: 'loose'
      });
      const text = generateMermaidText(rawGraph.nodes, rawGraph.edges);
      const renderId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      mermaid.render(renderId, text)
        .then(res => setMermaidSvg(res.svg))
        .catch(e => {
          console.error("Mermaid error:", e);
          // Fallback or clear if error
          setMermaidSvg('<div style="color: #666; padding: 20px;">Unable to render static graph. Try refreshing.</div>');
        });
    }
  }, [rawGraph.nodes, rawGraph.edges, format]);

  useEffect(() => {
    if (!rawGraph.nodes.length) return;

    // BFS or simple adjacency finding for traces
    let traceSet = new Set();
    if (tracedNodeIds.length > 0) {
      tracedNodeIds.forEach(id => traceSet.add(id));
      
      // Depth 1 (Forward and Backward for all roots)
      let depth1 = new Set();
      rawGraph.edges.forEach(e => {
        if (traceSet.has(e.source)) depth1.add(e.target);
        if (traceSet.has(e.target) && viewMode === 'file') depth1.add(e.source);
      });
      
      // Depth 2
      let depth2 = new Set();
      rawGraph.edges.forEach(e => {
        if (depth1.has(e.source)) depth2.add(e.target);
        if (depth1.has(e.target) && viewMode === 'file') depth2.add(e.source);
      });
      
      [...depth1, ...depth2].forEach(id => traceSet.add(id));
    }

    setNodes(currentNodes => {
      const posMap = new Map(currentNodes.map(cn => [cn.id, cn.position]));
      
      return rawGraph.nodes.map(n => {
        let dimmed = false;
        if (categoryFilter !== 'all' && n.data.category !== categoryFilter) dimmed = true;
        if (searchQuery && !n.data.label.toLowerCase().includes(searchQuery.toLowerCase())) dimmed = true;
        if (tracedNodeIds.length > 0 && !traceSet.has(n.id)) dimmed = true;

        return {
          ...n,
          position: posMap.get(n.id) || n.position,
          data: { ...n.data, dimmed }
        };
      });
    });

    const getLabelOffset = (id) => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0;
      }
      const x = (hash % 40) - 20; // -20 to 20px jitter
      const y = ((hash >> 4) % 30) - 15; // -15 to 15px jitter
      return { x, y };
    };

    let finalEdges = rawGraph.edges.map(e => {
      let isTraced = tracedNodeIds.length > 0 && (traceSet.has(e.source) && traceSet.has(e.target));
      const isHovered = hoveredEdgeId === e.id;
      const offset = getLabelOffset(e.id);

      return {
        ...e,
        type: 'default',
        animated: isTraced ? true : e.animated,
        label: isHovered && e.data?.allImports ? e.data.allImports.join(', ') : (e.data?.shortLabel || e.label),
        labelStyle: { 
          fill: isTraced ? '#f43f5e' : (isHovered ? '#fff' : '#aaa'), 
          fontSize: isHovered ? 11 : 10, 
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          transform: `translate(${offset.x}px, ${offset.y}px)`
        },
        labelBgStyle: { 
          fill: isHovered ? '#6366f1' : 'rgba(10, 10, 10, 0.85)', 
          fillOpacity: 0.9,
          rx: 4, 
          ry: 4,
          transform: `translate(${offset.x}px, ${offset.y}px)`
        },
        labelBgPadding: isHovered ? [8, 4] : [4, 2],
        style: { 
          stroke: isTraced ? '#e11d48' : (isHovered ? '#6366f1' : 'rgba(99, 102, 241, 0.5)'), // Sharper base Indigo
          strokeWidth: isTraced ? 3.5 : (isHovered ? 2.5 : 2.2),
          opacity: isTraced || isHovered ? 1 : 0.85,
          transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s'
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          width: 14, height: 14, 
          color: isTraced ? '#e11d48' : (isHovered ? '#6366f1' : 'rgba(99, 102, 241, 0.9)') 
        },
        zIndex: isTraced ? 100 : (isHovered ? 50 : 1),
      };
    });

    setEdges(finalEdges);
  }, [rawGraph, categoryFilter, searchQuery, tracedNodeIds, hoveredEdgeId, viewMode, setNodes, setEdges]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const handleTraceFlow = useCallback((nodeId) => {
    setTracedNodeIds(prev => prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]);
  }, []);

  if (loading && rawGraph.nodes.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <span className="spinner" style={{ width: 20, height: 20 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading mental model…</span>
      </div>
    );
  }

  if (error && rawGraph.nodes.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '2rem', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: 12 }}>🧠</div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Mental Model Not Ready</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.6 }}>The mental model will be available once the analysis completes.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Controls Bar */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
        background: 'var(--bg-1)', flexWrap: 'wrap', zIndex: 5
      }}>
          {/* Type toggles */}
          <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 2, borderRadius: 6 }}>
            <button 
              onClick={() => setFormat('interactive')}
              style={{
                background: format === 'interactive' ? 'var(--bg-1)' : 'transparent',
                color: format === 'interactive' ? 'var(--text)' : 'var(--text-3)',
                border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: '11px',
                cursor: 'pointer', transition: 'all 0.2s'
              }}>Interactive</button>
            <button 
              onClick={() => setFormat('static')}
              style={{
                background: format === 'static' ? 'var(--bg-1)' : 'transparent',
                color: format === 'static' ? 'var(--text)' : 'var(--text-3)',
                border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: '11px',
                cursor: 'pointer', transition: 'all 0.2s'
              }}>Static</button>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
            System Architecture
          </div>

        <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ fontSize: 12, color: '#666' }}>Filter:</span>
          {['all', 'frontend', 'backend', 'shared'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                background: categoryFilter === cat ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: categoryFilter === cat ? '#eee' : '#888',
                border: '1px solid', borderColor: categoryFilter === cat ? 'rgba(255,255,255,0.2)' : 'transparent',
                padding: '2px 8px', borderRadius: '12px', fontSize: 11, cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >{cat}</button>
          ))}
        </div>

        <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 200 }}>
          <input 
            type="text" 
            placeholder="Search nodes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#eee', padding: '4px 8px', borderRadius: '4px', fontSize: 12, outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Summary bar */}
      {summary && (
        <div style={{
          padding: '6px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
          background: 'var(--bg)', flexWrap: 'wrap',
        }}>
          {[
            ['Modules', summary.total_modules, '#6366f1'],
            ['Functions', summary.total_functions, '#a855f7'],
            ['Classes', summary.total_classes, '#22c55e'],
            ['LOC', summary.total_loc?.toLocaleString(), '#f59e0b'],
          ].map(([label, value, color]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '11px', color: 'var(--text-3)',
            }}>
              <span style={{ fontWeight: 700, color, fontSize: '12px', fontFamily: 'var(--mono)' }}>{value}</span>
              {label}
            </div>
          ))}
          {tracedNodeIds.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#f43f5e', fontWeight: 600 }}>Tracing Flow</span>
              <button 
                onClick={() => setTracedNodeIds([])}
                style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', padding: '2px 6px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}
              >
                Clear Trace
              </button>
            </div>
          )}
        </div>
      )}

      {/* ReactFlow canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {format === 'static' ? (
          <div 
            style={{ 
              width: '100%', height: '100%', overflow: 'hidden', 
              position: 'relative', cursor: isDragging ? 'grabbing' : 'grab',
              background: 'var(--bg, #0a0a0a)'
            }}
            onWheel={(e) => {
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              setStaticZoom(z => Math.min(Math.max(z * delta, 0.2), 5));
            }}
            onMouseDown={(e) => {
              setIsDragging(true);
              setStartPos({ x: e.clientX - staticPos.x, y: e.clientY - staticPos.y });
            }}
            onMouseMove={(e) => {
              if (!isDragging) return;
              setStaticPos({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <div 
              style={{
                width: '100%', height: '100%',
                transform: `translate(${staticPos.x}px, ${staticPos.y}px) scale(${staticZoom})`,
                transformOrigin: 'center',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                pointerEvents: 'none', transition: 'transform 0.05s linear'
              }}
              dangerouslySetInnerHTML={{ __html: mermaidSvg }} 
            />
            
            {/* Static Zoom Controls */}
            <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 100 }}>
              <button onClick={() => setStaticZoom(z => Math.min(z + 0.2, 5))} style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>+</button>
              <button onClick={() => setStaticZoom(z => Math.max(z - 0.2, 0.2))} style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>-</button>
              <button onClick={() => { setStaticZoom(1); setStaticPos({ x: 0, y: 0 }); }} style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>FIT</button>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
            onEdgeMouseLeave={() => setHoveredEdgeId(null)}
            onPaneClick={() => { setSelectedNode(null); setTracedNodeIds([]); }}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={1.5}
            defaultEdgeOptions={{ zIndex: 0 }}
            style={{ background: 'var(--bg, #0a0a0a)' }}
          >
            <Background color="#333" gap={16} />
            <Controls style={{ background: 'var(--bg-2)', borderColor: 'var(--border)', fill: 'var(--text-2)' }} />
            <MiniMap
              nodeColor={(n) => n.data?.color || LANG_COLORS[n.data?.language] || '#555'}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }}
            />
          </ReactFlow>
        )}
        
        {/* Node Detail Side Panel */}
        {selectedNode && (
          <NodeDetailPanel 
            node={selectedNode} 
            repoId={repoId} 
            onClose={() => setSelectedNode(null)} 
            onTraceFlow={handleTraceFlow}
          />
        )}
      </div>
    </div>
  );
}
