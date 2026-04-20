import { useState } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import { CANVAS_PRESETS } from '../../editor/editorConstants.js';

function AspectPreview({ width, height }) {
  const max = 36;
  const ratio = width / height;
  const w = ratio >= 1 ? max : max * ratio;
  const h = ratio <= 1 ? max : max / ratio;
  return (
    <div style={{
      width: w, height: h,
      border: '1.5px solid currentColor',
      borderRadius: 2,
      opacity: 0.6,
      flexShrink: 0,
    }} />
  );
}

export default function CanvasSizePicker({ onClose, onCreate }) {
  const [customW, setCustomW] = useState('1080');
  const [customH, setCustomH] = useState('1080');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="animate-fade" style={{
        width: 480, background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 16,
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              New Canvas
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Choose a size to start editing
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', borderRadius: 8, padding: 6,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}>
            <DuotoneIcon svg={ICONS.close} size={14} />
          </button>
        </div>

        {/* Presets */}
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {CANVAS_PRESETS.map(p => (
            <button key={p.name} onClick={() => onCreate({ width: p.width, height: p.height })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}>
              <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40 }}>
                <AspectPreview width={p.width} height={p.height} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>
                  {p.width} × {p.height}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Custom size */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Custom Size
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Width (px)</span>
              <input type="number" value={customW} min="100" max="8000"
                onChange={e => setCustomW(e.target.value)}
                style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', borderRadius: 8, padding: '8px 10px',
                  fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            <div style={{ paddingBottom: 10, color: 'var(--text-muted)', fontSize: 16 }}>×</div>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Height (px)</span>
              <input type="number" value={customH} min="100" max="8000"
                onChange={e => setCustomH(e.target.value)}
                style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', borderRadius: 8, padding: '8px 10px',
                  fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            <button
              onClick={() => onCreate({ width: parseInt(customW) || 1080, height: parseInt(customH) || 1080 })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                whiteSpace: 'nowrap',
              }}>
              <DuotoneIcon svg={ICONS.plus} size={13} style={{ color: '#fff' }} />
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
