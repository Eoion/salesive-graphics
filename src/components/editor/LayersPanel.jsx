import { useState, useRef, useCallback } from 'react';
import { ICONS } from '../../editor/duotoneIcons.js';
import DuotoneIcon from '../DuotoneIcon.jsx';

// Small icon SVGs inlined to avoid deps
function EyeIcon({ open }) {
  return open ? (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M6.5 6.6A2.2 2.2 0 0110.4 9.5M4 4.7C2.6 5.8 1.5 7.4 1 8c.8 1.3 3.3 5 7 5 1.3 0 2.5-.4 3.5-1M7.2 3.1C7.5 3 7.7 3 8 3c3.7 0 6.2 3.7 7 5-.4.7-.9 1.4-1.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function LockIcon({ locked }) {
  return locked ? (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ) : null;
}

const TYPE_ICONS = {
  rect: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  circle: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ),
  text: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M8 4v8M5 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  image: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M2 10l3-3 3 3 2-2 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="5.5" cy="6.5" r="1.2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  line: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  path: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M3 12C3 12 4 4 8 4C12 4 13 12 13 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  arrow: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  polygon: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <polygon points="8,2 14,6 12,13 4,13 2,6" stroke="currentColor" strokeWidth="1.4" fill="none"/>
    </svg>
  ),
  star: (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <polygon points="8,2 9.5,6.5 14,6.5 10.5,9.5 11.5,14 8,11 4.5,14 5.5,9.5 2,6.5 6.5,6.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  ),
};

function typeIcon(type) {
  return TYPE_ICONS[type] || (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

function elementLabel(el) {
  if (el.type === 'text') return `"${(el.text || '').slice(0, 22)}"`;
  if (el.description) return el.description.slice(0, 24);
  return el.id;
}

const sBtn = (active) => ({
  background: active ? 'var(--accent-dim)' : 'transparent',
  border: 'none',
  borderRadius: 4,
  padding: '3px 5px',
  cursor: 'pointer',
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

// ── LayersPanel ──────────────────────────────────────────────────────────────

export default function LayersPanel({
  elements,
  groups,
  selectedIds,
  setSelectedIds,
  setSelectedId,
  updateElement,
  makeGroup,
  dissolveGroup,
  renameGroup,
  reorderElement,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [renamingGroup, setRenamingGroup] = useState(null); // groupId
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  const toggleCollapse = (gid) =>
    setCollapsed((prev) => ({ ...prev, [gid]: !prev[gid] }));

  const startRename = (g) => {
    setRenamingGroup(g.id);
    setRenameValue(g.name || g.id);
    setTimeout(() => renameInputRef.current?.select(), 40);
  };

  const commitRename = () => {
    if (renamingGroup && renameValue.trim()) {
      renameGroup(renamingGroup, renameValue.trim());
    }
    setRenamingGroup(null);
  };

  // Build a reverse-z-order list: top element first.
  // Groups are shown as a single row; their children are indented below when expanded.
  const groupByEl = useCallback(() => {
    const map = {};
    for (const g of Object.values(groups)) {
      for (const eid of g.elementIds) map[eid] = g;
    }
    return map;
  }, [groups]);

  const elToGroup = groupByEl();

  // Build display rows in reverse z-order
  const rows = [];
  const renderedEls = new Set();
  const renderedGroups = new Set();

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const g = elToGroup[el.id];

    if (g) {
      if (!renderedGroups.has(g.id)) {
        renderedGroups.add(g.id);
        rows.push({ kind: 'group', group: g });
        if (!collapsed[g.id]) {
          for (const eid of g.elementIds) {
            const child = elements.find((e) => e.id === eid);
            if (child) rows.push({ kind: 'element', el: child, indent: true });
          }
        }
        g.elementIds.forEach((id) => renderedEls.add(id));
      }
    } else if (!renderedEls.has(el.id)) {
      renderedEls.add(el.id);
      rows.push({ kind: 'element', el, indent: false });
    }
  }

  const selectGroup = (g, e) => {
    const ids = g.elementIds.filter((id) => elements.some((el) => el.id === id));
    if (ids.length === 0) return;
    setSelectedIds(ids);
    setSelectedId(ids[0]);
  };

  const selectEl = (el, e) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const next = selectedIds.includes(el.id)
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id];
      setSelectedIds(next);
      if (next.length > 0) setSelectedId(next[next.length - 1]);
    } else {
      setSelectedIds([el.id]);
      setSelectedId(el.id);
    }
  };

  const rowBase = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    cursor: 'pointer',
    borderRadius: 5,
    userSelect: 'none',
    transition: 'background 0.08s',
    fontSize: 11,
    minWidth: 0,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Layers
        </span>
        {selectedIds.length >= 2 && (
          <button
            onClick={() => {
              const gid = makeGroup(selectedIds);
              setSelectedIds([]);
              setSelectedId(null);
            }}
            title="Group selected elements (G)"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 5,
              border: '1px solid var(--accent)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Group {selectedIds.length}
          </button>
        )}
      </div>

      {/* Layer rows */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        {rows.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 12px', margin: 0 }}>
            No elements yet
          </p>
        )}
        {rows.map((row, idx) => {
          if (row.kind === 'group') {
            const g = row.group;
            const isExpanded = !collapsed[g.id];
            const memberEls = g.elementIds.map((id) => elements.find((e) => e.id === id)).filter(Boolean);
            const allSelected = memberEls.length > 0 && memberEls.every((e) => selectedIds.includes(e.id));
            const anyVisible = memberEls.some((e) => e.visible !== false);

            return (
              <div key={g.id}>
                <div
                  style={{
                    ...rowBase,
                    background: allSelected ? 'var(--accent-dim)' : 'transparent',
                    color: allSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    borderRadius: 5,
                    paddingLeft: 6,
                  }}
                  onClick={(e) => selectGroup(g, e)}
                >
                  {/* Collapse toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(g.id); }}
                    style={{ ...sBtn(false), padding: 2, marginRight: 1 }}
                    title={isExpanded ? 'Collapse group' : 'Expand group'}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {/* Group icon */}
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.7 }}>
                    <rect x="1" y="1" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                    <rect x="9" y="1" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                    <rect x="1" y="9" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                    <rect x="9" y="9" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>

                  {/* Name / rename input */}
                  {renamingGroup === g.id ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingGroup(null); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1, minWidth: 0, fontSize: 11,
                        background: 'var(--bg-raised)', border: '1px solid var(--accent)',
                        borderRadius: 4, padding: '1px 5px', color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); startRename(g); }}
                      style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}
                      title={`Double-click to rename (${g.id})`}
                    >
                      {g.name || g.id}
                    </span>
                  )}

                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 2 }}>
                    {memberEls.length}
                  </span>

                  {/* Visibility */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newVis = !anyVisible;
                      memberEls.forEach((el) => updateElement(el.id, { visible: newVis }));
                    }}
                    style={{ ...sBtn(false), opacity: anyVisible ? 1 : 0.35 }}
                    title={anyVisible ? 'Hide group' : 'Show group'}
                  >
                    <EyeIcon open={anyVisible} />
                  </button>

                  {/* Dissolve */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dissolveGroup(g.id); }}
                    style={{ ...sBtn(false) }}
                    title="Ungroup"
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          }

          // Element row
          const { el, indent } = row;
          const isSelected = selectedIds.includes(el.id);
          const isVisible = el.visible !== false;
          const isLocked = el.locked;

          return (
            <div
              key={el.id}
              style={{
                ...rowBase,
                paddingLeft: indent ? 26 : 10,
                background: isSelected ? 'var(--accent-dim)' : 'transparent',
                color: isSelected ? 'var(--accent)' : isVisible ? 'var(--text-secondary)' : 'var(--text-muted)',
                opacity: isVisible ? 1 : 0.5,
              }}
              onClick={(e) => selectEl(el, e)}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-raised)'; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Type icon */}
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                {typeIcon(el.type)}
              </span>

              {/* Fill swatch */}
              {el.fill && el.fill !== 'none' && (
                <span style={{
                  width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                  background: el.fill.startsWith('#') ? el.fill : 'var(--border)',
                  border: '1px solid var(--border)',
                }} />
              )}

              {/* Label */}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {elementLabel(el)}
              </span>

              {isLocked && (
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <LockIcon locked />
                </span>
              )}

              {/* Visibility toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !isVisible }); }}
                style={{ ...sBtn(false), opacity: isVisible ? 0 : 0.5, transition: 'opacity 0.1s' }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = isVisible ? '0' : '0.5'; }}
                title={isVisible ? 'Hide' : 'Show'}
              >
                <EyeIcon open={isVisible} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
