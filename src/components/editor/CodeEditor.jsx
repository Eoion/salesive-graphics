import { useState, useEffect } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';

export default function CodeEditor({ element, onSave, onClose }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!element) return;
    // Build a pseudo-SVG snippet from the element
    const lines = [];
    lines.push(`<${element.type === 'circle' ? 'ellipse' : element.type}`);
    const skip = new Set(['id', 'type', 'visible', 'locked', 'description', 'animation', 'rawStyle', 'rawAttrs', 'lockAspect']);
    for (const [k, v] of Object.entries(element)) {
      if (skip.has(k) || v === undefined || v === null || v === '' || v === false || v === 'none' || k.startsWith('data-')) continue;
      if (k === 'fill' || k === 'stroke' || k === 'opacity' || k === 'rotation') continue;
      lines.push(`  ${k}="${v}"`);
    }
    if (element.fill && element.fill !== 'none') lines.push(`  fill="${element.fill}"`);
    if (element.stroke && element.stroke !== 'none') lines.push(`  stroke="${element.stroke}"`);
    if (element.opacity !== undefined && element.opacity !== 1) lines.push(`  opacity="${element.opacity}"`);
    if (element.rawStyle) lines.push(`  style="${element.rawStyle}"`);
    if (element.rawAttrs) {
      for (const [k, v] of Object.entries(element.rawAttrs)) {
        lines.push(`  ${k}="${v}"`);
      }
    }
    lines.push('/>');
    setCode(lines.join('\n'));
  }, [element]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave() {
    const styleMatch = code.match(/style="([^"]*)"/);
    const rawStyle = styleMatch ? styleMatch[1] : null;

    // Map SVG attribute names to element property names + type
    const PROP_MAP = {
      'x': ['x', 'num'], 'y': ['y', 'num'],
      'width': ['width', 'num'], 'height': ['height', 'num'],
      'fill': ['fill', 'str'], 'stroke': ['stroke', 'str'],
      'opacity': ['opacity', 'num'],
      'rx': ['rx', 'num'], 'ry': ['ry', 'num'],
      'font-size': ['fontSize', 'num'], 'font-weight': ['fontWeight', 'str'],
      'font-family': ['fontFamily', 'str'], 'text-anchor': ['textAnchor', 'str'],
      'stroke-width': ['strokeWidth', 'num'],
      'stroke-dasharray': ['strokeDash', 'str'],
      'stroke-linecap': ['strokeLinecap', 'str'],
      'text': ['text', 'str'],
      'sides': ['sides', 'num'], 'arms': ['arms', 'num'],
      'inner-ratio': ['innerRatio', 'num'],
    };

    const props = {};
    const rawAttrs = {};
    const attrRegex = /(\w[\w-]*)="([^"]*)"/g;
    let m;
    while ((m = attrRegex.exec(code)) !== null) {
      const [, key, val] = m;
      if (key === 'style') continue;
      if (PROP_MAP[key]) {
        const [propName, type] = PROP_MAP[key];
        props[propName] = type === 'num' ? (parseFloat(val) || 0) : val;
      } else {
        rawAttrs[key] = val;
      }
    }

    onSave({
      rawStyle: rawStyle || null,
      rawAttrs: Object.keys(rawAttrs).length ? rawAttrs : null,
      props,
    });
    onClose();
  }

  if (!element) return null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      <div style={{
        width: 520, maxHeight: '80vh', background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Edit Code</div>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>#{element.id} · {element.type}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <DuotoneIcon svg={ICONS.close} size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <textarea
            value={code}
            onChange={e => { setCode(e.target.value); setError(null); }}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 200, resize: 'vertical',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px',
              fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none', lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {error && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: 'var(--red)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{
            padding: '6px 14px', borderRadius: 7,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
          }}>Cancel</button>
          <button onClick={handleSave} style={{
            padding: '6px 14px', borderRadius: 7,
            background: 'var(--accent)', border: 'none',
            color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
