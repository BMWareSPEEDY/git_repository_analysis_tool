import { useState, useEffect } from 'react';
import { listFlows, getFlow } from '../api';
import MermaidViewer from './chat/MermaidViewer';

export default function FlowDiagramPanel({ repoId, activeFlowId }) {
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFlows();
  }, [repoId]);

  useEffect(() => {
    if (activeFlowId) {
      handleSelectFlow(activeFlowId);
    }
  }, [activeFlowId]);

  const loadFlows = async () => {
    try {
      const data = await listFlows(repoId);
      setFlows(data);
    } catch (e) {
      console.error('Failed to load flows', e);
    }
  };

  const handleSelectFlow = async (id) => {
    setLoading(true);
    try {
      const data = await getFlow(repoId, id);
      setSelectedFlow(data);
    } catch (e) {
      console.error('Failed to get flow detail', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar - Flow List */}
      <div style={{ 
        width: 280, 
        borderRight: '1px solid var(--border)', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'var(--bg-1)'
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Saved Flows
          </span>
          <button onClick={loadFlows} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '10px', cursor: 'pointer' }}>Refresh</button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {flows.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
              No flows generated yet.
            </div>
          ) : (
            flows.map(f => (
              <div 
                key={f.id}
                onClick={() => handleSelectFlow(f.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: 6,
                  background: selectedFlow?.id === f.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                  border: `1px solid ${selectedFlow?.id === f.id ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ fontSize: '12.5px', color: selectedFlow?.id === f.id ? '#fff' : 'var(--text-2)', fontWeight: 500, marginBottom: 4, lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                  {f.query}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)' }}>
                  <span>{new Date(f.timestamp * 1000).toLocaleDateString()}</span>
                  <span>{f.node_count} nodes</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        ) : selectedFlow ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>{selectedFlow.query}</h2>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: 40, display: 'flex', justifyContent: 'center', background: 'var(--bg)' }}>
              <div style={{ minWidth: '80%', display: 'flex', justifyContent: 'center' }}>
                <MermaidViewer chart={selectedFlow.mermaid} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '14px' }}>
            Select a flow from the list to view the diagram.
          </div>
        )}
      </div>
    </div>
  );
}
