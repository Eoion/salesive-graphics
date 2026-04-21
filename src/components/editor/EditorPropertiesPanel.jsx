import { useState, useRef, useEffect } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import ColorPicker from '../ColorPicker.jsx';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import GradientEditor from './GradientEditor.jsx';
import AnimationPanel from './AnimationPanel.jsx';
import { GOOGLE_FONTS } from '../../editor/googleFontsList.js';

function Label({ children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </span>
  );
}

function NumInput({ label, value, onChange, min, max, step = 1, style = {} }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, ...style }}>
      <Label>{label}</Label>
      <input
        type="number" value={Math.round(value * 10) / 10} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px',
          fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none', width: '100%',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </label>
  );
}

function ColorInput({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: 32, height: 28, borderRadius: 6,
          border: '1px solid var(--border)', background: value === 'none' ? 'var(--bg-raised)' : value,
          cursor: 'pointer', padding: 0, position: 'relative', overflow: 'hidden',
        }}>
          {value === 'none' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '120%', height: 2, background: 'var(--red)', transform: 'rotate(-45deg)' }} />
            </div>
          )}
        </button>
        <input type="text" value={value || 'none'}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px',
            fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {open && (
          <div style={{ position: 'absolute', top: 34, left: 0, zIndex: 50 }}>
            <ColorPicker value={value} onChange={onChange} onClose={() => setOpen(false)} />
          </div>
        )}
      </div>
    </label>
  );
}

function StrokeDashToggle({ value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Label>Stroke Dash</Label>
      <div style={{ display: 'flex', gap: 5 }}>
        {[['solid', '—'], ['dashed', '- -'], ['dotted', '···']].map(([k, lbl]) => (
          <button key={k} onClick={() => onChange(k)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: 'DM Mono, monospace', fontSize: 13, letterSpacing: 1,
            background: value === k ? 'var(--accent-dim)' : 'var(--bg-raised)',
            outline: value === k ? '1px solid var(--accent)' : '1px solid var(--border)',
            color: value === k ? 'var(--accent)' : 'var(--text-muted)',
          }}>{lbl}</button>
        ))}
      </div>
    </label>
  );
}

function StrokeLinecapToggle({ value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Label>Linecap</Label>
      <div style={{ display: 'flex', gap: 5 }}>
        {[['butt', 'Butt'], ['round', 'Round'], ['square', 'Square']].map(([k, lbl]) => (
          <button key={k} onClick={() => onChange(k)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 11, fontFamily: 'Syne, sans-serif',
            background: value === k ? 'var(--accent-dim)' : 'var(--bg-raised)',
            outline: value === k ? '1px solid var(--accent)' : '1px solid var(--border)',
            color: value === k ? 'var(--accent)' : 'var(--text-muted)',
          }}>{lbl}</button>
        ))}
      </div>
    </label>
  );
}

function Row({ children, gap = 8 }) {
  return <div style={{ display: 'flex', gap, alignItems: 'flex-end' }}>{children}</div>;
}

function Section({ title, children }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Label>{title}</Label>
      {children}
    </div>
  );
}

function FontAutocomplete({ defs, onAddFont, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const loaded = (defs?.fonts || []).map(f => f.name);
  const suggestions = query.trim().length < 1 ? [] :
    GOOGLE_FONTS
      .filter(f => f.toLowerCase().includes(query.toLowerCase()) && !loaded.includes(f))
      .slice(0, 10);

  useEffect(() => { setCursor(0); }, [query]);

  function commit(name) {
    onAddFont?.({ type: 'google', name });
    onSelect?.(name);
    setQuery('');
    setOpen(false);
  }

  function onKey(e) {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (suggestions[cursor]) commit(suggestions[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        placeholder="Search Google Fonts…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px',
          fontSize: 11, outline: 'none',
        }}
        onFocusCapture={e => e.target.style.borderColor = 'var(--accent)'}
        onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
      />
      {open && suggestions.length > 0 && (
        <div ref={listRef} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 6, marginTop: 2, overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {suggestions.map((name, i) => (
            <div key={name}
              onMouseDown={() => commit(name)}
              onMouseEnter={() => setCursor(i)}
              style={{
                padding: '6px 10px', cursor: 'pointer', fontSize: 12,
                fontFamily: name,
                background: i === cursor ? 'var(--accent-dim)' : 'transparent',
                color: i === cursor ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.08s',
              }}
            >{name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditorPropertiesPanel({ elements, selectedId, selectedIds, updateElement, updateElements, deleteElements, defs, onAddGradient, onAddKeyframe, onAddFont, onRemoveFont, onOpenCodeEditor }) {
  const el = elements.find(e => e.id === selectedId);
  const selectedEls = elements.filter(e => selectedIds.includes(e.id));
  const [showGradientEditor, setShowGradientEditor] = useState(false);

  // Batch helpers
  const hasLocked = selectedEls.some(e => e.locked);
  const hasUnlocked = selectedEls.some(e => !e.locked);
  const hasVisible = selectedEls.some(e => e.visible !== false);
  const hasHidden = selectedEls.some(e => e.visible === false);

  const upd = (patch) => updateElement(el.id, patch);
  const updBatch = (patch) => updateElements(selectedEls.map(e => e.id), patch);

  if (!selectedEls.length) {
    return (
      <aside style={{ width: 280, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>✦</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 140, margin: 0 }}>
          Select an element to edit its properties
        </p>
      </aside>
    );
  }

  return (
    <aside style={{ width: 280, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <Label>Properties</Label>
        <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', marginTop: 3 }}>
          {selectedEls.length > 1 ? `${selectedEls.length} selected · ${el.type}` : `${el.id} · ${el.type}`}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Multi-select actions */}
        {selectedEls.length > 1 && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>Batch Actions</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => updBatch({ locked: true })}
                disabled={!hasUnlocked}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: hasUnlocked ? 'var(--bg-raised)' : 'var(--bg-surface)',
                  color: hasUnlocked ? 'var(--text-secondary)' : 'var(--text-muted)',
                  cursor: hasUnlocked ? 'pointer' : 'default', fontSize: 11,
                  opacity: hasUnlocked ? 1 : 0.4,
                }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Lock all
              </button>
              <button
                onClick={() => updBatch({ locked: false })}
                disabled={!hasLocked}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: hasLocked ? 'var(--bg-raised)' : 'var(--bg-surface)',
                  color: hasLocked ? 'var(--text-secondary)' : 'var(--text-muted)',
                  cursor: hasLocked ? 'pointer' : 'default', fontSize: 11,
                  opacity: hasLocked ? 1 : 0.4,
                }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 7V5a3 3 0 016 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
                </svg>
                Unlock all
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => updBatch({ visible: true })}
                disabled={!hasHidden}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: hasHidden ? 'var(--bg-raised)' : 'var(--bg-surface)',
                  color: hasHidden ? 'var(--text-secondary)' : 'var(--text-muted)',
                  cursor: hasHidden ? 'pointer' : 'default', fontSize: 11,
                  opacity: hasHidden ? 1 : 0.4,
                }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 4l3-3 8 8m-8 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Show all
              </button>
              <button
                onClick={() => updBatch({ visible: false })}
                disabled={!hasVisible}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: hasVisible ? 'var(--bg-raised)' : 'var(--bg-surface)',
                  color: hasVisible ? 'var(--text-secondary)' : 'var(--text-muted)',
                  cursor: hasVisible ? 'pointer' : 'default', fontSize: 11,
                  opacity: hasVisible ? 1 : 0.4,
                }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 2l12 12M14 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 2l4 4m8-8 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Hide all
              </button>
            </div>
            <button
              onClick={() => deleteElements(selectedEls.map(e => e.id))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                width: '100%', marginTop: 4, padding: '6px', borderRadius: 7,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: 'var(--red)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 2l12 12M14 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 14l4-4m8 8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete {selectedEls.length} elements
            </button>
          </div>
        )}

        {/* Description */}
        <Section title="Description">
          <textarea
            value={el.description || ''}
            rows={2}
            onChange={e => upd({ description: e.target.value })}
            placeholder="Notes about this element…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 6, padding: '6px 8px',
              fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </Section>

        {/* Position & Size */}
        <Section title="Position & Size">
          <Row>
            <NumInput label="X" value={el.x} onChange={v => upd({ x: v })} style={{ flex: 1 }} />
            <NumInput label="Y" value={el.y} onChange={v => upd({ y: v })} style={{ flex: 1 }} />
          </Row>
          {el.type !== 'line' && (
            <Row gap={4}>
              <NumInput label="W" value={el.width} min={1}
                onChange={v => {
                  const w = Math.max(1, v);
                  upd(el.lockAspect && el.height > 0
                    ? { width: w, height: Math.max(1, Math.round(w / (el.width / el.height))) }
                    : { width: w });
                }}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => upd({ lockAspect: !el.lockAspect })}
                title={el.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                style={{
                  alignSelf: 'flex-end', width: 26, height: 28, borderRadius: 6, flexShrink: 0,
                  border: `1px solid ${el.lockAspect ? 'rgba(13,101,217,0.4)' : 'var(--border)'}`,
                  background: el.lockAspect ? 'var(--accent-dim)' : 'var(--bg-raised)',
                  color: el.lockAspect ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {el.lockAspect
                  ? <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  : <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7V5a3 3 0 016 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/></svg>
                }
              </button>
              <NumInput label="H" value={el.height} min={1}
                onChange={v => {
                  const h = Math.max(1, v);
                  upd(el.lockAspect && el.width > 0
                    ? { height: h, width: Math.max(1, Math.round(h * (el.width / el.height))) }
                    : { height: h });
                }}
                style={{ flex: 1 }}
              />
            </Row>
          )}
          <Row>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <Label>Rotation</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number" min={0} max={359} step={1}
                  value={Math.round(el.rotation || 0)}
                  onChange={e => upd({ rotation: ((parseInt(e.target.value) || 0) % 360 + 360) % 360 })}
                  style={{
                    flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px',
                    fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>°</span>
              </div>
            </label>
            {el.type === 'rect' && (
              <NumInput label="Radius" value={el.rx || 0} min={0} onChange={v => upd({ rx: v, ry: v })} style={{ flex: 1 }} />
            )}
          </Row>
        </Section>

        {/* Fill & Stroke */}
        {el.type !== 'image' && (
          <Section title="Fill & Stroke">
            {el.type !== 'line' && (
              <ColorInput label="Fill" value={el.fill} onChange={v => upd({ fill: v })} />
            )}
            <ColorInput label="Stroke" value={el.stroke} onChange={v => upd({ stroke: v })} />
            {el.stroke !== 'none' && (
              <>
                <NumInput label="Stroke Width" value={el.strokeWidth || 0} min={0} max={100} onChange={v => upd({ strokeWidth: v })} />
                <StrokeDashToggle value={el.strokeDash || 'solid'} onChange={v => upd({ strokeDash: v })} />
                <StrokeLinecapToggle value={el.strokeLinecap || 'butt'} onChange={v => upd({ strokeLinecap: v })} />
              </>
            )}
          </Section>
        )}

        {/* Opacity */}
        <Section title="Opacity">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="range" min={0} max={1} step={0.01}
              value={el.opacity ?? 1} onChange={e => upd({ opacity: parseFloat(e.target.value) })}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)', width: 34, textAlign: 'right' }}>
              {Math.round((el.opacity ?? 1) * 100)}%
            </span>
          </div>
        </Section>

        {/* Text-specific */}
        {el.type === 'text' && (
          <Section title="Text">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Content</Label>
              <textarea
                value={el.text || ''}
                rows={2}
                onChange={e => upd({ text: e.target.value })}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', borderRadius: 6, padding: '6px 8px',
                  fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            <Row>
              <NumInput label="Size" value={el.fontSize || 24} min={6} max={400} onChange={v => upd({ fontSize: v })} style={{ flex: 1 }} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <Label>Weight</Label>
                <select value={el.fontWeight || 'normal'} onChange={e => upd({ fontWeight: e.target.value })}
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }}>
                  {['100','200','300','normal','500','600','bold','800','900'].map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </label>
            </Row>
            {/* Alignment */}
            <div>
              <Label>Align</Label>
              <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                {[
                  { value: 'start',  Icon: AlignLeft },
                  { value: 'middle', Icon: AlignCenter },
                  { value: 'end',    Icon: AlignRight },
                ].map(({ value, Icon }) => (
                  <button key={value} onClick={() => upd({ textAnchor: value })} style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: el.textAnchor === value ? 'var(--accent-dim)' : 'var(--bg-raised)',
                    outline: el.textAnchor === value ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: el.textAnchor === value ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Font Family</Label>
              {/* Font selector — built-in + loaded fonts */}
              <select value={el.fontFamily || 'sans-serif'} onChange={e => upd({ fontFamily: e.target.value })}
                style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none' }}>
                <optgroup label="System">
                  {['sans-serif','serif','monospace','Georgia','Arial','Helvetica','Verdana','Trebuchet MS','Syne'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </optgroup>
                {(defs?.fonts || []).length > 0 && (
                  <optgroup label="Loaded Fonts">
                    {(defs.fonts).map(f => (
                      <option key={f.name} value={f.name}>{f.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {/* Google Font autocomplete */}
              <FontAutocomplete
                defs={defs}
                onAddFont={onAddFont}
                onSelect={name => upd({ fontFamily: name })}
              />
              {/* Custom font upload */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                background: 'var(--bg-raised)', border: '1px dashed var(--border)',
                color: 'var(--text-muted)', transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Upload font (.ttf .otf .woff .woff2)
                <input type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const name = file.name.replace(/\.[^.]+$/, '');
                    const fmt = file.name.endsWith('.woff2') ? 'woff2'
                      : file.name.endsWith('.woff') ? 'woff'
                      : file.name.endsWith('.otf') ? 'opentype'
                      : 'truetype';
                    const reader = new FileReader();
                    reader.onload = ev => {
                      onAddFont?.({ type: 'custom', name, dataUrl: ev.target.result, format: fmt });
                      upd({ fontFamily: name });
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <ColorInput label="Text Color" value={el.fill} onChange={v => upd({ fill: v })} />
          </Section>
        )}

        {/* Image href */}
        {el.type === 'image' && (
          <Section title="Image">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Upload from device</Label>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                background: 'var(--bg-raised)', border: '1px dashed var(--border)',
                color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'Syne, sans-serif',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Choose image…
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => upd({ href: ev.target.result });
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>URL / href</Label>
              <input type="text" value={el.href || ''}
                onChange={e => upd({ href: e.target.value })}
                placeholder="https://…"
                style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px',
                  fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            {el.href && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {el.href.startsWith('data:') && (
                  <img src={el.href} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }} />
                )}
                <button
                  onClick={() => {
                    const img = new Image();
                    img.onload = () => {
                      const nw = img.naturalWidth, nh = img.naturalHeight;
                      const currentScale = Math.sqrt((el.width / nw) * (el.height / nh));
                      const scales = [0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
                      const snapped = scales.reduce((a, b) => Math.abs(b - currentScale) < Math.abs(a - currentScale) ? b : a);
                      upd({ width: Math.round(nw * snapped), height: Math.round(nh * snapped) });
                    };
                    img.src = el.href;
                  }}
                  title="Snap to nearest clean scale of the image's natural size (Ctrl+Shift+M)"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'Syne, sans-serif',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M7 4h2M4 7h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Snap to Scale
                </button>
                {el.href.startsWith('data:') && (
                  <button onClick={() => upd({ href: '' })} style={{ fontSize: 10, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Clear</button>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Polygon-specific */}
        {el.type === 'polygon' && (
          <Section title="Polygon">
            <NumInput label="Sides" value={el.sides || 6} min={3} max={12} onChange={v => upd({ sides: Math.round(v) })} />
          </Section>
        )}

        {/* Star-specific */}
        {el.type === 'star' && (
          <Section title="Star">
            <NumInput label="Arms" value={el.arms || 5} min={3} max={12} onChange={v => upd({ arms: Math.round(v) })} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Label>Inner Radius</Label>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                  {Math.round((el.innerRatio ?? 0.4) * 100)}%
                </span>
              </div>
              <input type="range" min={0.1} max={0.9} step={0.01}
                value={el.innerRatio ?? 0.4}
                onChange={e => upd({ innerRatio: parseFloat(e.target.value) })}
                style={{ accentColor: 'var(--accent)' }}
              />
            </label>
          </Section>
        )}

        {/* Arrow-specific */}
        {el.type === 'arrow' && (
          <Section title="Arrow">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Arrowheads</Label>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => upd({ arrowStart: !el.arrowStart })} style={{
                  flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'DM Mono, monospace',
                  background: el.arrowStart ? 'var(--accent-dim)' : 'var(--bg-raised)',
                  outline: el.arrowStart ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: el.arrowStart ? 'var(--accent)' : 'var(--text-muted)',
                }}>← Start</button>
                <button onClick={() => upd({ arrowEnd: !el.arrowEnd })} style={{
                  flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'DM Mono, monospace',
                  background: el.arrowEnd !== false ? 'var(--accent-dim)' : 'var(--bg-raised)',
                  outline: el.arrowEnd !== false ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: el.arrowEnd !== false ? 'var(--accent)' : 'var(--text-muted)',
                }}>End →</button>
              </div>
            </label>
          </Section>
        )}

        {/* Gradients & Variables picker in Fill/Stroke */}
        {defs && (defs.gradients?.length > 0 || defs.variables?.length > 0) && (
          <Section title="Fill Presets">
            {defs.gradients.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {defs.gradients.map(g => {
                  const stops = g.stops || [];
                  const css = g.type === 'radial'
                    ? `radial-gradient(circle, ${stops.map(s => s.stopColor).join(', ')})`
                    : `linear-gradient(to right, ${stops.map(s => s.stopColor).join(', ')})`;
                  return (
                    <button key={g.id} title={`Apply gradient ${g.id}`}
                      onClick={() => upd({ fill: `url(#${g.id})` })}
                      style={{
                        width: 28, height: 20, borderRadius: 4, border: '1px solid var(--border)',
                        background: css, cursor: 'pointer', padding: 0,
                      }} />
                  );
                })}
              </div>
            )}
            {defs.variables.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: defs.gradients.length ? 6 : 0 }}>
                {defs.variables.map(v => (
                  <button key={v.id} title={`var(--${v.name})`}
                    onClick={() => upd({ fill: `var(--${v.name})` })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px',
                      borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-raised)',
                      cursor: 'pointer', fontSize: 10, color: 'var(--text-secondary)',
                      fontFamily: 'DM Mono, monospace',
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: v.value, flexShrink: 0 }} />
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* New gradient */}
        {showGradientEditor && onAddGradient && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <GradientEditor
              onSave={(grad) => { onAddGradient(grad); setShowGradientEditor(false); }}
              onClose={() => setShowGradientEditor(false)}
            />
          </div>
        )}
        {onAddGradient && (
          <div style={{ padding: '4px 14px 8px' }}>
            <button onClick={() => setShowGradientEditor(s => !s)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px dashed var(--border)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10,
            }}>+ New Gradient</button>
          </div>
        )}

        {/* Animation */}
        {onAddKeyframe && (
          <Section title="Animation">
            <AnimationPanel
              animation={el.animation}
              keyframes={defs?.keyframes || []}
              onApply={(anim, css) => {
                onAddKeyframe({ name: anim.name || anim.type, css });
                upd({ animation: anim });
              }}
              onRemove={() => upd({ animation: null })}
            />
          </Section>
        )}

        {/* Font Library — always visible when fonts are loaded */}
        {(defs?.fonts || []).length > 0 && (
          <Section title="Font Library">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {defs.fonts.map(f => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '3px 8px 3px 6px',
                  fontSize: 11, color: 'var(--text-secondary)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.type === 'google' ? 'var(--accent)' : '#10b981', flexShrink: 0 }} />
                  <span style={{ fontFamily: f.name }}>{f.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveFont?.(f.name); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 2px', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                    title={`Remove ${f.name}`}
                  >×</button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Code editor trigger */}
        {onOpenCodeEditor && (
          <div style={{ padding: '6px 14px 12px' }}>
            <button onClick={() => onOpenCodeEditor(el)} style={{
              display: 'flex', alignItems: 'center', gap: 5, width: '100%',
              padding: '6px 10px', borderRadius: 6,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <DuotoneIcon svg={ICONS.code} size={12} />
              Edit Code
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
