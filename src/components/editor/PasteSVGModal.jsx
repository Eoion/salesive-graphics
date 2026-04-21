import { useState, useEffect } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import { parseSVGToElements } from '../../editor/parseSVGToElements.js';

export default function PasteSVGModal({ onAdd, onClose }) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handlePreview() {
    try {
      const { elements, canvasSize } = parseSVGToElements(code);
      setPreview({ count: elements.length, canvasSize });
    } catch {
      setPreview({ error: true });
    }
  }

  function handleAdd() {
    if (!code.trim()) return;
    onAdd(code);
    onClose();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      <div style={{
        width: 520, maxHeight: '80vh', background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Paste SVG</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <DuotoneIcon svg={ICONS.close} size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={code}
            onChange={e => { setCode(e.target.value); setPreview(null); }}
            placeholder="Paste or type SVG code here..."
            spellCheck={false}
            style={{
              flex: 1, minHeight: 200, resize: 'vertical',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 8, padding: '10px 12px',
              fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none', lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />

          {preview && (
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              background: preview.error ? 'rgba(239,68,68,0.1)' : 'var(--accent-dim)',
              border: `1px solid ${preview.error ? 'rgba(239,68,68,0.3)' : 'rgba(13,101,217,0.2)'}`,
              fontSize: 11, color: preview.error ? 'var(--red)' : 'var(--accent)',
              fontFamily: 'DM Mono, monospace',
            }}>
              {preview.error
                ? 'Failed to parse SVG — check the code and try again'
                : `${preview.count} element${preview.count !== 1 ? 's' : ''} found · canvas ${preview.canvasSize?.width}×${preview.canvasSize?.height}`}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={handlePreview} disabled={!code.trim()} style={{
            padding: '6px 14px', borderRadius: 7,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: code.trim() ? 'pointer' : 'default',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>Preview</button>
          <button onClick={handleAdd} disabled={!code.trim()} style={{
            padding: '6px 14px', borderRadius: 7,
            background: code.trim() ? 'var(--accent)' : 'var(--bg-raised)',
            border: 'none', color: code.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 12, cursor: code.trim() ? 'pointer' : 'default',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>Add to Canvas</button>
        </div>
      </div>
    </div>
  );
}
