import { useState, useEffect, useRef, useMemo } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import { loadCollection } from '../../lib/collection.js';
import IconPickerPanel from './IconPickerPanel.jsx';
import { freshId } from '../../editor/editorConstants.js';

const TOOLS = [
  { id: 'select',     svg: ICONS.select,     label: 'Select',  key: 'V' },
  { id: 'rect',       svg: ICONS.rect,       label: 'Rect',    key: 'U' },
  { id: 'circle',     svg: ICONS.circle,     label: 'Circle',  key: 'E' },
  { id: 'polygon',    svg: ICONS.polygon,    label: 'Polygon', key: 'P' },
  { id: 'star',       svg: ICONS.star,       label: 'Star',    key: 'S' },
  { id: 'text',       svg: ICONS.text,       label: 'Text',    key: 'T' },
  { id: 'image',      svg: ICONS.image,      label: 'Image',   key: 'I' },
  { id: 'line',       svg: ICONS.line,       label: 'Line',    key: 'L' },
  { id: 'arrow',      svg: ICONS.arrow,      label: 'Arrow',   key: 'A' },
  { id: 'eyedropper', svg: ICONS.eyedropper, label: 'Sample',  key: 'K' },
];

const ALIGN_BTNS = [
  { dir: 'left',    title: 'Align left',          icon: ICONS.alignLeft    },
  { dir: 'centerH', title: 'Center horizontally', icon: ICONS.alignCenterH },
  { dir: 'right',   title: 'Align right',         icon: ICONS.alignRight   },
  { dir: 'top',     title: 'Align top',           icon: ICONS.alignTop     },
  { dir: 'centerV', title: 'Center vertically',   icon: ICONS.alignCenterV  },
  { dir: 'bottom',  title: 'Align bottom',        icon: ICONS.alignBottom  },
];

const TYPE_DOT = {
  text: '#8B5CF6',
  rect: '#0D65D9',
  circle: '#EAB308',
  line: '#64748b',
  image: '#10B981',
  polygon: '#EC4899',
  star: '#F43F5E',
  arrow: '#6366F1',
  eyedropper: '#14B8A6',
  default: '#6b7280',
};

function layerLabel(el) {
  if (el.type === 'text' && el.text) return el.text.slice(0, 20) || 'Text';
  if (el.type === 'image' && el.href) return 'Image';
  const typeLabel = { rect: 'Rect', circle: 'Circle', line: 'Line', image: 'Image', text: 'Text', polygon: 'Polygon', star: 'Star', arrow: 'Arrow' }[el.type] || el.type;
  const num = el.id.match(/_(\d+)$/)?.[1] || '';
  return `${typeLabel}${num ? ' ' + num : ''}`;
}

const iconBtnBase = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '5px', borderRadius: 5, border: '1px solid var(--border)',
  background: 'var(--bg-raised)', color: 'var(--text-secondary)',
  cursor: 'pointer', transition: 'all 0.1s', flexShrink: 0,
};

function IconBtn({ icon, title, onClick, danger, accent, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...iconBtnBase,
        borderColor: danger ? 'rgba(239,68,68,0.3)' : accent ? 'rgba(13,101,217,0.3)' : 'var(--border)',
        color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--text-secondary)',
        background: danger ? 'rgba(239,68,68,0.08)' : accent ? 'var(--accent-dim)' : 'var(--bg-raised)',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = danger ? 'var(--red)' : 'var(--accent)'; e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--accent)'; }}}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.3)' : accent ? 'rgba(13,101,217,0.3)' : 'var(--border)';
        e.currentTarget.style.color = danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--text-secondary)';
      }}
    >
      <DuotoneIcon svg={icon} size={13} />
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
  onDuplicate,
  onSaveToCollection, onOpenCollection,
  onTextEdit,
  addElement,
}) {
  const selectedEls = elements.filter(e => selectedIds.includes(e.id));
  const [dragOverId, setDragOverId] = useState(null);
  const [collectionVersion, setCollectionVersion] = useState(0);
  const layerScrollRef = useRef();

  const collection = useMemo(() => loadCollection(), [collectionVersion]);
  const isInCollection = useMemo(() =>
    selectedEls.length > 0 && collection.some(item =>
      item.elements.some(e => selectedEls.some(sel => sel.id === e.id))
    ), [collection, selectedEls]);

  function handleSaveToCollection() {
    onSaveToCollection?.(selectedEls);
    setCollectionVersion(v => v + 1);
  }

  useEffect(() => {
    if (!selectedId || !layerScrollRef.current) return;
    const row = layerScrollRef.current.querySelector(`[data-layerid="${selectedId}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const hasVisible  = selectedEls.some(el => el.visible !== false);
  const hasUnlocked = selectedEls.some(el => !el.locked);

  function handleAddIcon(dataUrl, _name, size, options = {}) {
    const w = canvasSize?.width  || size?.width  || 800;
    const h = canvasSize?.height || size?.height || 600;
    addElement({
      id: freshId('image'),
      type: 'image',
      x: w / 2 - 40, y: h / 2 - 40,
      width: 80, height: 80,
      href: dataUrl,
      fill: options.fill, iconColors: options.iconColors,
      stroke: 'none', strokeWidth: 0,
      strokeDash: 'solid', strokeLinecap: 'butt',
      opacity: 1, visible: true, locked: false, description: '',
    });
  }

  return (
    <aside style={{
      width: 220, background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>

      {/* ── Tools (compact 2-col grid) ── */}
      <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3,
        }}>
          {TOOLS.map(t => {
            const active = activeTool === t.id;
            const shortcut = bindings?.[t.id] || t.key || '';
            return (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                title={`${t.label} (${shortcut})`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  outline: active ? '1px solid rgba(13,101,217,0.35)' : '1px solid transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    color: active ? 'var(--accent)' : 'var(--text-muted)' 
                }}>
                  <DuotoneIcon svg={t.svg} size={13} />
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, flex: 1, textAlign: 'left' }}>{t.label}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{shortcut}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Element actions (shown when selected) ── */}
      {selectedEls.length > 0 && (
        <div style={{ padding: '6px 8px 7px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
            {selectedEls.length > 1 ? `${selectedEls.length} selected` : selectedEls[0]?.id}
          </span>
          {/* Row 1: labeled actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 3 }}>
            {[
              { icon: ICONS.paste,  label: 'Duplicate', title: 'Duplicate (Ctrl+D)',         onClick: onDuplicate, accent: true },
              { icon: ICONS.delete, label: 'Delete',    title: 'Delete (Del)',                onClick: () => deleteElements(selectedEls.map(e => e.id)), danger: true },
              { icon: hasVisible ? ICONS.close : ICONS.eye,       label: hasVisible ? 'Hide' : 'Show',       title: hasVisible ? 'Hide (Ctrl+Shift+H)' : 'Show', onClick: () => updateElements(selectedEls.map(e => e.id), { visible: !hasVisible }) },
              { icon: hasUnlocked ? ICONS.lock : ICONS.unlock,    label: hasUnlocked ? 'Lock' : 'Unlock',    title: hasUnlocked ? 'Lock (Ctrl+L)' : 'Unlock (Ctrl+L)', onClick: () => updateElements(selectedEls.map(e => e.id), { locked: hasUnlocked }) },
            ].map(({ icon, label, title, onClick, accent, danger }) => (
              <button key={label} onClick={onClick} title={title} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 7px', borderRadius: 6, cursor: 'pointer',
                border: danger ? '1px solid rgba(239,68,68,0.25)' : accent ? '1px solid rgba(13,101,217,0.25)' : '1px solid var(--border)',
                background: danger ? 'rgba(239,68,68,0.07)' : accent ? 'var(--accent-dim)' : 'var(--bg-raised)',
                color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 11,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = danger ? 'var(--red)' : 'var(--accent)'; e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.25)' : accent ? 'rgba(13,101,217,0.25)' : 'var(--border)'; e.currentTarget.style.color = danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--text-secondary)'; }}
              >
                <DuotoneIcon svg={icon} size={12} />{label}
              </button>
            ))}
          </div>
          {/* Row 2: layer order + collection + text edit */}
          <div style={{ display: 'flex', gap: 3 }}>
            <IconBtn icon={ICONS.bringForward} title="Bring forward" onClick={() => selectedEls.forEach(el => bringForward(el.id))} />
            <IconBtn icon={ICONS.sendBackward} title="Send backward" onClick={() => selectedEls.forEach(el => sendBackward(el.id))} />
            {onSaveToCollection && (
              <IconBtn
                icon={ICONS.bookmark}
                title={isInCollection ? 'Already in collection (Ctrl+Shift+B to update)' : 'Save to Collection (Ctrl+Shift+B)'}
                accent={isInCollection}
                onClick={handleSaveToCollection}
              />
            )}
            {selectedEls.length === 1 && selectedEls[0]?.type === 'text' && onTextEdit && (
              <IconBtn icon={ICONS.pencil} title="Edit text (F2 / double-click)" accent onClick={() => onTextEdit(selectedEls[0].id)} />
            )}
          </div>
        </div>
      )}

      {/* ── Align (icon grid, only when single element selected) ── */}
      {selectedEls.length === 1 && canvasSize && (
        <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {ALIGN_BTNS.map(({ dir, title, icon }) => (
              <IconBtn key={dir} icon={icon} title={title}
                onClick={() => alignElement(selectedId, dir, canvasSize.width, canvasSize.height)} />
            ))}
            <button
              title="Center on canvas"
              onClick={() => alignElement(selectedId, 'center', canvasSize.width, canvasSize.height)}
              style={{
                ...iconBtnBase, flex: 1, fontSize: 9, fontWeight: 600,
                padding: '5px 4px', whiteSpace: 'nowrap',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >⊕</button>
          </div>
        </div>
      )}

      {/* ── Layers header ── */}
      <div style={{
        padding: '5px 8px 4px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 4,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <DuotoneIcon svg={ICONS.layers} size={11} />
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          Layers {elements.length > 0 && `(${elements.length})`}
        </span>
        {onOpenCollection && (
          <IconBtn icon={ICONS.collection} title="Collection" onClick={onOpenCollection} accent />
        )}
      </div>

      {/* ── Layers list (gets all remaining space) ── */}
      <div ref={layerScrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {[...elements].reverse().map(el => {
          const isSelected = selectedIds.includes(el.id);
          const isDragOver = el.id === dragOverId;
          const dot = TYPE_DOT[el.type] || TYPE_DOT.default;
          return (
            <div
              key={el.id}
              data-layerid={el.id}
              draggable
              onClick={() => { setSelectedId(el.id); setActiveTool('select'); }}
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
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 8px 4px 5px',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-dim)' : 'transparent',
                borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                borderTop: isDragOver ? `2px solid ${dot}` : '2px solid transparent',
                opacity: el.visible === false ? 0.4 : 1,
                transition: 'background 0.1s, border-color 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>⠿</span>
              <span style={{ color: dot, flexShrink: 0, lineHeight: 0 }}>
                {ICONS[el.type]
                  ? <DuotoneIcon svg={ICONS[el.type]} size={12} />
                  : <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: dot }} />}
              </span>
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
          <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            No elements yet
          </div>
        )}
      </div>

      <IconPickerPanel onAddIcon={handleAddIcon} canvasSize={canvasSize} />

      {/* ── Undo / Redo footer ── */}
      <div style={{
        padding: '5px 8px', borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', gap: 4,
      }}>
        <button
          onClick={undo} disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '5px 0', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-raised)', color: canUndo ? 'var(--text-secondary)' : 'var(--text-muted)',
            cursor: canUndo ? 'pointer' : 'default', fontSize: 11, opacity: canUndo ? 1 : 0.4,
          }}
          onMouseEnter={e => { if (canUndo) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = canUndo ? 'var(--text-secondary)' : 'var(--text-muted)'; }}
        >
          <DuotoneIcon svg={ICONS.undo} size={12} /> Undo
        </button>
        <button
          onClick={redo} disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '5px 0', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--bg-raised)', color: canRedo ? 'var(--text-secondary)' : 'var(--text-muted)',
            cursor: canRedo ? 'pointer' : 'default', fontSize: 11, opacity: canRedo ? 1 : 0.4,
          }}
          onMouseEnter={e => { if (canRedo) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = canRedo ? 'var(--text-secondary)' : 'var(--text-muted)'; }}
        >
          <DuotoneIcon svg={ICONS.redo} size={12} /> Redo
        </button>
        {onOpenKeymap && (
          <button onClick={onOpenKeymap} title="Keyboard shortcuts"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '5px 7px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-raised)', color: 'var(--text-muted)',
              cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <DuotoneIcon svg={ICONS.layers} size={12} />
          </button>
        )}
      </div>
    </aside>
  );
}
