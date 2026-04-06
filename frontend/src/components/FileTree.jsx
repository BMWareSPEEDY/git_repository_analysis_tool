import { useState, useMemo } from 'react';

const EXT_ICONS = {
  '.py':'🐍', '.js':'📜', '.jsx':'⚛', '.ts':'📘', '.tsx':'⚛',
  '.java':'☕', '.go':'🔷', '.rs':'🦀', '.rb':'💎', '.php':'🐘',
  '.c':'⚙', '.cpp':'⚙', '.h':'📎', '.cs':'🔷', '.swift':'🍎',
  '.html':'🌐', '.css':'🎨', '.scss':'🎨', '.json':'{}',
  '.md':'📝', '.yaml':'⚙', '.yml':'⚙', '.sh':'💲', '.sql':'🗄',
  '.dart':'🎯', '.kt':'🤖', '.scala':'🔴', '.lua':'🌙',
};

function getIcon(name) {
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  return EXT_ICONS[ext.toLowerCase()] || '📄';
}

function buildTree(files) {
  const root = {};
  for (const path of files) {
    const parts = path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
    if (!cur.__files) cur.__files = [];
    cur.__files.push({ name: parts[parts.length - 1], path });
  }
  return root;
}

function DirNode({ name, node, depth, selected, onSelect, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || depth < 2);
  const dirs = Object.keys(node).filter(k => k !== '__files').sort();
  const files = (node.__files || []).slice().sort((a,b) => a.name.localeCompare(b.name));
  const indent = depth * 12;

  return (
    <div>
      {name && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
            gap: 5, padding: `4px 10px 4px ${10 + indent}px`,
            background: 'none', border: 'none', color: 'var(--text-2)',
            fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
            borderRadius: 5, transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: 9, color: 'var(--text-3)', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          <span style={{ fontSize: 13 }}>📁</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </button>
      )}

      {(open || !name) && (
        <div>
          {dirs.map(d => (
            <DirNode key={d} name={d} node={node[d]} depth={depth + 1} selected={selected} onSelect={onSelect} />
          ))}
          {files.map(f => {
            const active = selected === f.path;
            return (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                  gap: 6, padding: `4px 10px 4px ${14 + indent + 12}px`,
                  background: active ? 'var(--blue-dim)' : 'none',
                  borderLeft: active ? '2px solid var(--blue)' : '2px solid transparent',
                  border: 'none', borderRadius: 0,
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  fontSize: '12px', cursor: 'pointer',
                  fontFamily: 'var(--mono)',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ flexShrink: 0, fontSize: 13 }}>{getIcon(f.name)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ files, selected, onSelect }) {
  const tree = useMemo(() => buildTree(files), [files]);

  if (!files.length) return (
    <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
      No files yet
    </div>
  );

  return (
    <div style={{ padding: '6px 0', overflowY: 'auto', flex: 1 }}>
      <DirNode name="" node={tree} depth={0} selected={selected} onSelect={onSelect} />
    </div>
  );
}
