import { useState, useEffect } from 'react';
import { getSecurityReport, getCodeSmells } from '../api';

const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: '🔴' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: '🟠' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '🟡' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  icon: '🟢' },
  info:     { color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: '🔵' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '⚠️' },
  error:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: '🔴' },
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
        <span style={{ fontSize: '12px', flexShrink: 0 }}>{sev.icon}</span>
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
              <span>💡</span>
              <span>{finding.recommendation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


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

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span className="spinner" />
        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading insights…</span>
      </div>
    );
  }

  const tabs = [
    { id: 'security', label: '🔒 Security', count: security?.total_findings || 0 },
    { id: 'smells',   label: '👃 Code Smells', count: smells?.total || 0 },
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
              padding: '10px 14px',  background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-3)',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: 10,
                background: tab.count > 0 ? 'rgba(239,68,68,0.1)' : 'var(--bg-2)',
                color: tab.count > 0 ? '#ef4444' : 'var(--text-3)',
                fontFamily: 'var(--mono)', fontWeight: 600,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {activeTab === 'security' && (
          <SecurityTab data={security} />
        )}
        {activeTab === 'smells' && (
          <SmellsTab data={smells} />
        )}
      </div>
    </div>
  );
}

function SecurityTab({ data }) {
  if (!data || data.total_findings === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '32px', marginBottom: 12 }}>✅</div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          No Security Issues Found
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
          The codebase passed all security checks.
        </p>
      </div>
    );
  }

  const allFindings = Object.values(data.by_severity || {}).flat();

  return (
    <div className="fade-up">
      {/* Risk score */}
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 18px', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Risk Score</span>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
            {data.files_scanned} files scanned
          </span>
        </div>
        <RiskMeter score={data.risk_score || 0} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {/* Complexity */}
          <div style={{ background: 'var(--bg-2)', padding: '8px 12px', borderRadius: 8 }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 4 }}>Complexity</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
              {data.complexity_score || 0}<span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 400 }}>/100</span>
            </div>
          </div>
          {/* Test Coverage */}
          <div style={{ background: 'var(--bg-2)', padding: '8px 12px', borderRadius: 8 }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 4 }}>Test Coverage</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
              ~{data.test_coverage_est || 0}%
            </div>
          </div>
        </div>

        {/* Severity breakdown */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(data.summary || {}).map(([severity, count]) => {
            const sev = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
            return count > 0 ? (
              <span key={severity} style={{
                fontSize: '11px', padding: '3px 8px', borderRadius: 10,
                background: sev.bg, color: sev.color, fontWeight: 600,
              }}>
                {count} {severity}
              </span>
            ) : null;
          })}
        </div>
      </div>

      {/* Findings list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allFindings.map((f, i) => (
          <FindingCard key={i} finding={f} />
        ))}
      </div>
    </div>
  );
}

function SmellsTab({ data }) {
  if (!data || data.total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <div style={{ fontSize: '32px', marginBottom: 12 }}>🌟</div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
          Clean Architecture
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
          No code smells or architecture issues detected.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div style={{
        fontSize: '12px', color: 'var(--text-3)', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{data.total}</span>
        issues detected
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(data.smells || []).map((smell, i) => (
          <FindingCard key={i} finding={{
            title: smell.type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            severity: smell.severity,
            description: smell.message,
            file_path: smell.module,
            line_number: smell.line,
            location: smell.location,
          }} />
        ))}
      </div>
    </div>
  );
}
