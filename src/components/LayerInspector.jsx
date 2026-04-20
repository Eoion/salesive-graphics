const TYPE_COLORS = {
  text:    { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa',  label: 'T' },
  image:   { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc',  label: 'I' },
  color:   { bg: 'rgba(13,101,217,0.15)',  color: '#0D65D9',  label: 'C' },
  icon:    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80',  label: 'Ic' },
  shape:   { bg: 'rgba(13,101,217,0.15)',   color: '#0D65D9',  label: 'S' },
  group:   { bg: 'rgba(99,102,241,0.15)', color: '#818cf8',  label: 'G' },
};

function TypeBadge({ type }) {
  const t = TYPE_COLORS[type] || TYPE_COLORS.shape;
  return (
    <span style={{ background: t.bg, color: t.color, width: 20, height: 20,
      borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
      {t.label}
    </span>
  );
}

export default function LayerInspector({ nodes, selectedId, mappings, onSelect }) {
  const groups = {
    text:  nodes.filter(n => n.type === 'text'),
    image: nodes.filter(n => n.type === 'image'),
    icon:  nodes.filter(n => n.type === 'icon'),
    color: nodes.filter(n => n.type === 'color' || n.type === 'shape'),
    group: nodes.filter(n => n.type === 'group'),
  };

  const groupLabels = { text: 'Text', image: 'Images', icon: 'Icons', color: 'Shapes', group: 'Groups' };

  return (
    <aside style={{
      width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Layers
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {nodes.length} elements · {Object.keys(mappings).length} mapped
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {Object.entries(groups).map(([key, items]) => {
          if (!items.length) return null;
          return (
            <div key={key}>
              <div style={{ padding: '4px 14px 2px', fontSize: 10, fontWeight: 600,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {groupLabels[key]}
              </div>
              {items.map(node => {
                const isSelected = node.id === selectedId;
                const isMapped   = !!mappings[node.id];
                return (
                  <div key={node.id}
                    onClick={() => onSelect(node.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px',
                      cursor: 'pointer', position: 'relative',
                      background: isSelected ? 'var(--accent-dim)' : 'transparent',
                      borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                    <TypeBadge type={node.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 400,
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {node.rawId || node.id}
                      </div>
                      {node.text && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          "{node.text}"
                        </div>
                      )}
                      {node.fill && !node.text && (
                        <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: node.fill, border: '1px solid rgba(255,255,255,0.1)' }} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{node.fill}</span>
                        </div>
                      )}
                    </div>
                    {isMapped && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
