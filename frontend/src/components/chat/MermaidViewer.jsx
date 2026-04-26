import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#6366f1',
    lineColor: '#6366f1',
    secondaryColor: '#1e1b4b',
    tertiaryColor: '#1e293b'
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
    rankSpacing: 80,
    nodeSpacing: 100,
    padding: 20
  }
});

export default function MermaidViewer({ chart }) {
  const ref = useRef(null);
  const [error, setError] = React.useState(null);
  const [svg, setSvg] = React.useState('');

  useEffect(() => {
    setError(null);
    if (ref.current && chart) {
      const renderId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      try {
        mermaid.render(renderId, chart)
          .then(({ svg }) => {
            setSvg(svg);
          })
          .catch(err => {
            console.error("Mermaid render error:", err);
            setError(err);
          });
      } catch (err) {
        console.error("Mermaid caught error:", err);
        setError(err);
      }
    }
  }, [chart]);

  if (error) {
    return (
      <div style={{ margin: '10px 0' }}>
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '11px', borderRadius: '6px 6px 0 0', border: '1px solid rgba(239,68,68,0.2)', borderBottom: 'none' }}>
          Mermaid Syntax Error
        </div>
        <pre style={{ 
          fontSize: '11px', 
          fontFamily: 'var(--mono)', 
          background: 'var(--bg-1)', 
          border: '1px solid var(--border)', 
          borderRadius: '0 0 6px 6px', 
          padding: '12px',
          overflowX: 'auto',
          color: 'var(--text-3)'
        }}>
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className="mermaid-container" style={{ 
      width: '100%', 
      overflow: 'auto', 
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      padding: '20px',
      margin: '10px 0'
    }}>
      <div 
        ref={ref} 
        className="mermaid"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
