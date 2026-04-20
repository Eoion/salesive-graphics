import { useState, useEffect, useRef } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';

const TOOLS = [
  { id: 'select',      svg: ICONS.select,      label: 'Select' },
  { id: 'rect',        svg: ICONS.rect,        label: 'Rectangle' },
  { id: 'circle',      svg: ICONS.circle,      label: 'Circle' },
  { id: 'polygon',     svg: ICONS.polygon,     label: 'Polygon' },
  { id: 'star',        svg: ICONS.star,        label: 'Star' },
  { id: 'text',        svg: ICONS.text,        label: 'Text' },
  { id: 'image',       svg: ICONS.image,       label: 'Image' },
  { id: 'line',        svg: ICONS.line,        label: 'Line' },
  { id: 'arrow',       svg: ICONS.arrow,       label: 'Arrow' },
  { id: 'eyedropper',  svg: ICONS.eyedropper,  label: 'Eyedropper' },
];

const ALIGN_BTNS = [
  { dir: 'left',    title: 'Align left',     icon: ICONS.alignLeft    },
  { dir: 'centerH', title: 'Center horizontal', icon: ICONS.alignCenterH },
  { dir: 'right',   title: 'Align right',    icon: ICONS.alignRight   },
  { dir: 'top',     title: 'Align top',      icon: ICONS.alignTop     },
  { dir: 'centerV', title: 'Center vertical', icon: ICONS.alignCenterV  },
  { dir: 'bottom',  title: 'Align bottom',   icon: ICONS.alignBottom  },
];

const TYPE_DOT = {
  rect: '#0D65D9', circle: '#0D65D9', text: '#3b82f6',
  image: '#c084fc', line: '#0D65D9',
  polygon: '#10b981', star: '#f59e0b', arrow: '#0D65D9',
  default: '#6b7280',
};

function layerLabel(el) {
  if (el.type === 'text' && el.text) return el.text.slice(0, 18) || 'Text';
  if (el.type === 'image' && el.href) return 'Image';
  const typeLabel = { rect: 'Rectangle', circle: 'Circle', line: 'Line', image: 'Image', text: 'Text', polygon: 'Polygon', star: 'Star', arrow: 'Arrow' }[el.type] || el.type;
  const num = el.id.match(/_(\d+)$/)?.[1] || '';
  return `${typeLabel}${num ? ' ' + num : ''}`;
}

function ToolBtn({ tool, active, onClick, shortcut }) {
  return (
    <button
      onClick={() => onClick(tool.id)}
      title={`${tool.label} (${shortcut})`}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
        background: active ? 'var(--accent-dim)' : 'transparent',
        outline: active ? '1px solid rgba(13,101,217,0.4)' : '1px solid transparent',
        transition: 'all 0.1s',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <DuotoneIcon svg={tool.svg} size={14} />
      <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, flex: 1, textAlign: 'left' }}>
        {tool.label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{shortcut}</span>
    </button>
  );
}

export default function EditorToolbar({
  activeTool, setActiveTool,
  elements, selectedId, selectedIds,
  setSelectedId,
  updateElements,
  deleteElements, bringForward, sendBackward,
  alignElement, reorderElement, canvasSize,
  canUndo, canRedo, undo, redo,
  bindings, onOpenKeymap,
}) {
  const selectedEls = elements.filter(e => selectedIds.includes(e.id));
  const [dragOverId, setDragOverId] = useState(null);
  const layerScrollRef = useRef();

  // Auto-scroll layers list to show the selected element
  useEffect(() => {
    if (!selectedId || !layerScrollRef.current) return;
    const row = layerScrollRef.current.querySelector(`[data-layerid="${selectedId}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  // Batch lock/unlock/delete helpers
  const hasVisible = selectedEls.some(el => el.visible !== false);
  const hasUnlocked = selectedEls.some(el => !el.locked);

  const actionButtons = selectedEls.length > 0 ? [
    { svg: ICONS.layers,  label: 'Forward',  action: () => selectedEls.forEach(el => bringForward(el.id)) },
    { svg: ICONS.layers,  label: 'Backward', action: () => selectedEls.forEach(el => sendBackward(el.id)) },
    { svg: hasVisible ? ICONS.close : ICONS.eye,
      label: hasVisible ? 'Hide' : 'Show',
      action: () => updateElements(selectedEls.map(e => e.id), { visible: hasVisible ? false : true }) },
    { svg: hasUnlocked ? ICONS.lock : ICONS.unlock,
      label: hasUnlocked ? 'Lock' : 'Unlock',
      action: () => updateElements(selectedEls.map(e => e.id), { locked: hasUnlocked ? true : false }) },
  ] : [];

  const SECTION_LABEL = {
    fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7,
  };

  const ICON_BTN = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '6px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-raised)', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.1s',
  };

  return (
    <aside style={{
      width: 240, background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Tools */}
      <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={SECTION_LABEL}>Tools</div>
        {TOOLS.map(t => (
          <ToolBtn key={t.id} tool={t} active={activeTool === t.id} onClick={setActiveTool}
            shortcut={bindings?.[t.id] || ''} />
        ))}
      </div>

      {/* Selected actions */}
      {selectedEls.length > 0 && (
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={SECTION_LABEL}>
            {selectedEls.length > 1 ? `${selectedEls.length} elements` : 'Element'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {actionButtons.map(({ svg, label, action }) => (
              <button key={label} onClick={action} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-raised)', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 11,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <DuotoneIcon svg={svg} size={11} />
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => deleteElements(selectedEls.map(e => e.id))} style={{
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            width: '100%', marginTop: 6, padding: '6px', borderRadius: 7,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--red)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>
            <DuotoneIcon svg={ICONS.delete} size={12} style={{ color: 'var(--red)' }} />
            Delete {selectedEls.length > 1 ? 'elements' : 'element'}
          </button>
        </div>
      )}

      {/* Alignment */}
      {selectedEls.length === 1 && canvasSize && (
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={SECTION_LABEL}>Align to canvas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {ALIGN_BTNS.map(({ dir, title, icon }) => (
              <button key={dir} title={title}
                onClick={() => alignElement(selectedId, dir, canvasSize.width, canvasSize.height)}
                style={ICON_BTN}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <DuotoneIcon svg={icon} size={13} />
              </button>
            ))}
          </div>
          <button title="Center on canvas"
            onClick={() => alignElement(selectedId, 'center', canvasSize.width, canvasSize.height)}
            style={{ ...ICON_BTN, width: '100%', marginTop: 5, gap: 5, fontSize: 11 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Center on canvas
          </button>
        </div>
      )}

      {/* Layers */}
      <div style={{ padding: '10px 10px 4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DuotoneIcon svg={ICONS.layers} size={12} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Layers ({elements.length})
          </span>
        </div>
      </div>
      <div ref={layerScrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        {[...elements].reverse().map(el => {
          const isSelected = selectedIds.includes(el.id);
          const isDragOver = el.id === dragOverId;
          const dot = TYPE_DOT[el.type] || TYPE_DOT.default;
          return (
            <div key={el.id}
              data-layerid={el.id}
              draggable
              onClick={() => {
                // Click behavior: if shift held, toggle; otherwise select only this one
                if (selectedIds.includes(el.id)) {
                  // Clicking already-selected in multi-select mode requires explicit handling
                  setSelectedId(el.id);
                } else {
                  setSelectedId(el.id);
                }
                setActiveTool('select');
              }}
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', el.id);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
              }}
              onDragEnd={e => { e.target.style.opacity = '1'; setDragOverId(null); }}
              onDragOver={e => { e.preventDefault(); setDragOverId(el.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverId(null);
                const fromId = e.dataTransfer.getData('text/plain');
                if (fromId !== el.id) reorderElement(fromId, el.id);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 6px',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-dim)' : 'transparent',
                borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                borderTop: isDragOver ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: el.visible === false ? 0.4 : 1,
                transition: 'background 0.1s, border-color 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Drag handle */}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>⠿</span>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: dot, flexShrink: 0 }} />
              <span style={{
                fontSize: 11, fontFamily: 'DM Mono, monospace',
                color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {layerLabel(el)}
              </span>
              {el.locked && <DuotoneIcon svg={ICONS.lock} size={9} />}
            </div>
          );
        })}
        {elements.length === 0 && (
          <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            No elements yet
          </div>
        )}
      </div>

      {/* Undo / Redo */}
      <div style={{ padding: '10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={undo} disabled={!canUndo} title="Undo" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '6px', borderRadius: 7,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          color: canUndo ? 'var(--text-secondary)' : 'var(--text-muted)',
          cursor: canUndo ? 'pointer' : 'default', fontSize: 11,
          opacity: canUndo ? 1 : 0.4,
        }}>
          <DuotoneIcon svg={ICONS.undo} size={12} /> Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '6px', borderRadius: 7,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          color: canRedo ? 'var(--text-secondary)' : 'var(--text-muted)',
          cursor: canRedo ? 'pointer' : 'default', fontSize: 11,
          opacity: canRedo ? 1 : 0.4,
        }}>
          <DuotoneIcon svg={ICONS.redo} size={12} /> Redo
        </button>
      </div>
    </aside>
  );
}
