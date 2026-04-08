import { useState, useEffect, useMemo } from 'react';
import { getSecurityReport, getCodeSmells } from '../api';

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', label: 'Error', bg: 'rgba(239,68,68,0.08)', icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef444480'}} /> },
  high:     { color: '#f97316', label: 'Error', bg: 'rgba(249,115,22,0.08)', icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#f97316', boxShadow: '0 0 6px #f9731680'}} /> },
  medium:   { color: '#f59e0b', label: 'Warning', bg: 'rgba(245,158,11,0.08)', icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b80'}} /> },
  low:      { color: '#22c55e', label: 'Warning', bg: 'rgba(34,197,94,0.08)',  icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e80'}} /> },
  info:     { color: '#6366f1', label: 'Warning', bg: 'rgba(99,102,241,0.08)', icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 6px #6366f180'}} /> },
  warning:  { color: '#f59e0b', label: 'Warning', bg: 'rgba(245,158,11,0.08)', icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b80'}} /> },
  error:    { color: '#ef4444', label: 'Error', bg: 'rgba(239,68,68,0.08)',  icon: <div style={{width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef444480'}} /> },
};

function RiskMeter({ score }) {
  const color = score > 60 ? '#ef4444' : score > 30 ? '#f59e0b' : '#22c55e';
  const label = score > 60 ? 'High Risk' : score > 30 ? 'Moderate' : 'Low Risk';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 100, height: 6, background: 'var(--bg-3)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${Math.min(100, score)}%`,
          background: color, borderRadius: 3,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, color, fontFamily: 'var(--mono)' }}>
        {score.toFixed(0)}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{label}</span>
    </div>
  );
}

function FindingCard({ finding }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;

  return (
    <div
      onClick={() => setExpanded(o => !o)}
      style={{
        background: sev.bg,
        border: `1px solid ${sev.color}20`,
        borderRadius: 8, padding: '10px 14px',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flexShrink: 0, marginTop: 4 }}>{sev.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>
              {finding.title}
            </span>
            <span style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: 10,
              background: `${sev.color}15`, color: sev.color,
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {finding.severity}
            </span>
          </div>
          <div style={{
            fontSize: '11px', color: 'var(--text-3)',
            fontFamily: 'var(--mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {finding.file_path || finding.module || finding.location}:{finding.line_number || finding.line || ''}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="fade-up" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${sev.color}15` }}>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.55 }}>
            {finding.description || finding.message}
          </p>
          {finding.code_snippet && (
            <pre style={{
              fontSize: '11px', fontFamily: 'var(--mono)',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px', overflow: 'auto',
              color: 'var(--text-2)', marginBottom: 8,
            }}>
              {finding.code_snippet}
            </pre>
          )}
          {finding.recommendation && (
            <div style={{
              fontSize: '11.5px', color: '#22c55e', lineHeight: 1.5,
              display: 'flex', gap: 6,
            }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginTop: 2}}>
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>{finding.recommendation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FilterBar = ({ counts, filter, setFilter }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
    {[
      { id: 'all', label: 'All', count: counts.total },
      { id: 'error', label: 'Errors', count: counts.errors, color: '#ef4444' },
      { id: 'warning', label: 'Warnings', count: counts.warnings, color: '#f59e0b' }
    ].map(f => (
      <button
        key={f.id}
        onClick={() => setFilter(f.id)}
        style={{
          background: filter === f.id ? 'var(--bg-3)' : 'transparent',
          color: filter === f.id ? 'var(--text)' : 'var(--text-3)',
          border: '1px solid',
          borderColor: filter === f.id ? 'var(--border)' : 'transparent',
          borderRadius: 6, padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.1s'
        }}
      >
        <span style={{ fontWeight: 600 }}>{f.label}</span>
        {f.count > 0 && (
          <span style={{ 
            fontSize: '9px', background: f.color ? `${f.color}20` : 'rgba(255,255,255,0.05)', 
            color: f.color || 'inherit', padding: '1px 6px', borderRadius: 10, fontWeight: 700 
          }}>
            {f.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

export default function InsightsPanel({ repoId }) {
  const [activeTab, setActiveTab] = useState('security');
  const [security, setSecurity] = useState(null);
  const [smells, setSmells] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [secData, smellData] = await Promise.all([
          getSecurityReport(repoId).catch(() => null),
          getCodeSmells(repoId).catch(() => null),
        ]);
        if (!cancelled) {
          setSecurity(secData);
          setSmells(smellData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [repoId]);

  const securityCounts = useMemo(() => {
    if (!security) return { total: 0, errors: 0, warnings: 0 };
    let e = 0, w = 0;
    Object.entries(security.summary || {}).forEach(([severity, count]) => {
      if (SEVERITY_CONFIG[severity]?.label === 'Error') e += count;
      else w += count;
    });
    return { total: security.total_findings, errors: e, warnings: w };
  }, [security]);

  const smellCounts = useMemo(() => {
    if (!smells) return { total: 0, errors: 0, warnings: 0 };
    let e = 0, w = 0;
    (smells.smells || []).forEach(s => {
      if (SEVERITY_CONFIG[s.severity]?.label === 'Error' || s.severity === 'critical' || s.severity === 'high') e++;
      else w++;
    });
    return { total: smells.total, errors: e, warnings: w };
  }, [smells]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span className="spinner" />
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading insights…</span>
      </div>
    );
  }

  const tabs = [
    { id: 'security', label: 'Security', counts: securityCounts },
    { id: 'smells',   label: 'Code Smells', counts: smellCounts },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        padding: '0 14px', flexShrink: 0, background: 'var(--bg-1)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 14px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-3)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
            }}
          >
            {tab.label}
            <div style={{ display: 'flex', gap: 4 }}>
              {tab.counts.errors > 0 && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 800 }}>{tab.counts.errors}E</span>}
              {tab.counts.warnings > 0 && <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 800 }}>{tab.counts.warnings}W</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeTab === 'security' && <SecurityTab data={security} counts={securityCounts} />}
        {activeTab === 'smells' && <SmellsTab data={smells} counts={smellCounts} />}
      </div>
    </div>
  );
}

function SecurityTab({ data, counts }) {
  const [filter, setFilter] = useState('all');

  if (!data || data.total_findings === 0) {
    return <EmptyState title="No Security Issues Found" />;
  }

  const filteredFindings = useMemo(() => {
    return Object.values(data.by_severity || {}).flat().filter(f => {
      if (filter === 'all') return true;
      const type = SEVERITY_CONFIG[f.severity]?.label.toLowerCase();
      return type === filter;
    });
  }, [data, filter]);

  return (
    <div className="fade-up">
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '16px', marginBottom: 16,
      }}>
        <RiskMeter score={data.risk_score || 0} />
      </div>
      
      <FilterBar counts={counts} filter={filter} setFilter={setFilter} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredFindings.map((f, i) => <FindingCard key={i} finding={f} />)}
        {filteredFindings.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#555', fontSize: 12 }}>No {filter}s found in this category.</div>}
      </div>
    </div>
  );
}

function SmellsTab({ data, counts }) {
  const [filter, setFilter] = useState('all');

  if (!data || data.total === 0) {
    return <EmptyState title="Clean Architecture" />;
  }

  const filteredSmells = useMemo(() => {
    return (data.smells || []).filter(s => {
      if (filter === 'all') return true;
      const type = SEVERITY_CONFIG[s.severity]?.label.toLowerCase() || (['critical', 'high'].includes(s.severity) ? 'error' : 'warning');
      return type === filter;
    });
  }, [data, filter]);

  return (
    <div className="fade-up">
      <FilterBar counts={counts} filter={filter} setFilter={setFilter} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredSmells.map((smell, i) => (
          <FindingCard key={i} finding={{
            title: smell.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            severity: smell.severity,
            description: smell.message,
            file_path: smell.module,
            line_number: smell.line,
          }} />
        ))}
        {filteredSmells.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#555', fontSize: 12 }}>No {filter}s found.</div>}
      </div>
    </div>
  );
}

const EmptyState = ({ title }) => (
  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
    <div style={{ color: '#22c55e', marginBottom: 12 }}>
      <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
    </div>
    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{title}</h3>
    <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>The codebase passed all checks.</p>
  </div>
);
