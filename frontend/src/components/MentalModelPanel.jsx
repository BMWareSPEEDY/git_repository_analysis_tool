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
  const langColor = LANG_COLORS[data.language] || LANG_COLORS.unknown;
  const opacity = data.dimmed ? 0.3 : 1;
  const isGlowing = data.glow;

  return (
    <div 
      style={{
        background: 'rgba(17, 17, 17, 0.9)', border: `1px solid ${data.color || 'var(--border, #2a2a2a)'}`,
        borderRadius: 10, padding: '12px 14px', minWidth: 160, maxWidth: 240,
        fontFamily: "'Inter', sans-serif", cursor: 'grab',
        opacity, 
        boxShadow: isGlowing ? '0 0 20px rgba(99, 102, 241, 0.6)' : (data.dimmed ? 'none' : `0 4px 16px ${data.color || '#000'}30`),
        position: 'relative', backdropFilter: 'blur(10px)',
        transition: 'all 0.1s ease-out'
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
  const borderStyle = selected ? 'solid' : 'dashed';
  const borderColor = 'rgba(255, 255, 255, 0.1)';
  
  return (
    <div style={{
      width: '100%', height: '100%', 
      background: 'rgba(255, 255, 255, 0.01)',
      borderLeft: `1px ${borderStyle} ${borderColor}`,
      borderRight: `1px ${borderStyle} ${borderColor}`,
      borderBottom: `1px ${borderStyle} ${borderColor}`,
      borderTop: '24px solid rgba(255, 255, 255, 0.05)',
      borderRadius: 16,
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

function EdgeDetailOverlay({ edge, nodes, mousePos }) {
  if (!edge || !mousePos) return null;
  
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  const symbols = edge.data?.allImports || [];
  
  return (
    <div style={{
      position: 'fixed', left: mousePos.x + 20, top: mousePos.y + 20,
      width: 280, background: 'rgba(10, 10, 10, 0.95)', border: '1px solid rgba(99, 102, 241, 0.4)',
      borderRadius: 12, padding: '14px', zIndex: 10000, pointerEvents: 'none',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.101 1.101" /></svg>
        Structural Link
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sourceNode?.data.label}</div>
        <div style={{ color: '#6366f1' }}>→</div>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{targetNode?.data.label}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Dependency Type</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{edge.data?.isExternal ? 'External Library' : 'Internal Call Logic'}</div>
        </div>

        {symbols.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Symbols Used</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {symbols.slice(0, 8).map(s => (
                <span key={s} style={{ fontSize: 10, fontFamily: 'var(--mono)', background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '2px 6px', borderRadius: 4 }}>{s}</span>
              ))}
              {symbols.length > 8 && <span style={{ fontSize: 10, color: '#444' }}>+{symbols.length - 8} more</span>}
            </div>
          </div>
        )}

        <div>
           <div style={{ fontSize: 10, color: '#666', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Purpose</div>
           <div style={{ fontSize: 11, color: '#ddd', lineHeight: 1.5 }}>
             Consumes logic from {targetNode?.data.label} to extend module functionality.
           </div>
        </div>
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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

      // Filter nodes based on category and search
      const visibleNodes = rawGraph.nodes.filter(n => {
        if (categoryFilter !== 'all' && n.data.category !== categoryFilter) return false;
        if (searchQuery && !n.data.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });

      const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
      const visibleEdges = rawGraph.edges.filter(e => 
        visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      );

      const text = generateMermaidText(visibleNodes, visibleEdges);
      const renderId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      
      mermaid.render(renderId, text)
        .then(res => setMermaidSvg(res.svg))
        .catch(e => {
          console.error("Mermaid error:", e);
          setMermaidSvg('<div style="color: #666; padding: 20px;">Unable to render static graph. Try refreshing.</div>');
        });
    }
  }, [rawGraph.nodes, rawGraph.edges, format, categoryFilter, searchQuery]);

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

    // Calculation for Focus State (Hovered Edge)
    let focusNodeIds = new Set();
    if (hoveredEdgeId) {
      const hoveredEdge = rawGraph.edges.find(e => e.id === hoveredEdgeId);
      if (hoveredEdge) {
        focusNodeIds.add(hoveredEdge.source);
        focusNodeIds.add(hoveredEdge.target);
      }
    }

    setNodes(currentNodes => {
      // Create maps for both position and dimensions so we don't lose user adjustments
      const posMap = new Map(currentNodes.map(cn => [cn.id, cn.position]));
      const dimMap = new Map(currentNodes.map(cn => [cn.id, { width: cn.width, height: cn.height, measured: cn.measured }]));
      
      return rawGraph.nodes.map(n => {
        let dimmed = false;
        
        // Priority 1: Focus isolation during hover
        if (hoveredEdgeId && !focusNodeIds.has(n.id)) {
          dimmed = true;
        } 
        // Priority 2: Global filters
        else if (categoryFilter !== 'all' && n.data.category !== categoryFilter) {
          dimmed = true;
        }
        else if (searchQuery && !n.data.label.toLowerCase().includes(searchQuery.toLowerCase())) {
          dimmed = true;
        }
        // Priority 3: Trace results
        else if (tracedNodeIds.length > 0 && !traceSet.has(n.id)) {
          dimmed = true;
        }

        const existingDims = dimMap.get(n.id) || {};

        return {
          ...n,
          position: posMap.get(n.id) || n.position,
          width: existingDims.width || n.width,
          height: existingDims.height || n.height,
          measured: existingDims.measured || n.measured,
          data: { ...n.data, dimmed, glow: hoveredEdgeId && focusNodeIds.has(n.id) }
        };
      });
    });

    const getLabelOffset = (id) => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0;
      }
      return { x: (hash % 40) - 20, y: ((hash >> 4) % 30) - 15 };
    };

    let finalEdges = rawGraph.edges.map(e => {
      const isTraced = tracedNodeIds.length > 0 && (traceSet.has(e.source) && traceSet.has(e.target));
      const isHovered = hoveredEdgeId === e.id;
      const offset = getLabelOffset(e.id);

      // Determine visual isolation level
      let edgeOpacity = 0.85;
      if (hoveredEdgeId) {
        edgeOpacity = isHovered ? 1 : 0.05;
      } else if (isTraced) {
        edgeOpacity = 1;
      }

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
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <svg width="40" height="40" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.54-2.44 2.5 2.5 0 01-2-2.44V10a2.5 2.5 0 012-2.44 2.5 2.5 0 012.54-2.44A2.5 2.5 0 019.5 2zM14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.54-2.44 2.5 2.5 0 002-2.44V10a2.5 2.5 0 00-2-2.44 2.5 2.5 0 00-2.54-2.44A2.5 2.5 0 0014.5 2z" />
            </svg>
          </div>
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
          <div style={{ width: '100%', height: '100%', position: 'relative' }} onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeMouseEnter={() => setHoveredEdgeId(null)}
              onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
              onEdgeMouseLeave={() => setHoveredEdgeId(null)}
              onPaneClick={() => { setSelectedNode(null); setTracedNodeIds([]); }}
              onPaneMouseEnter={() => setHoveredEdgeId(null)}
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
            {hoveredEdgeId && (
              <EdgeDetailOverlay 
                edge={edges.find(e => e.id === hoveredEdgeId)} 
                nodes={nodes} 
                mousePos={mousePos} 
              />
            )}
          </div>
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
