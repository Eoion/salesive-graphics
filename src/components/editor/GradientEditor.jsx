import { useState } from 'react';
import ColorPicker from '../ColorPicker.jsx';

export default function GradientEditor({ gradient, onSave, onClose }) {
  const [type, setType] = useState(gradient?.type || 'linear');
  const [stops, setStops] = useState(gradient?.stops?.length ? gradient.stops : [
    { offset: '0%', stopColor: '#3b82f6', stopOpacity: 1 },
    { offset: '100%', stopColor: '#8b5cf6', stopOpacity: 1 },
  ]);
  const [x1, setX1] = useState(gradient?.x1 || '0%');
  const [y1, setY1] = useState(gradient?.y1 || '0%');
  const [x2, setX2] = useState(gradient?.x2 || '100%');
  const [y2, setY2] = useState(gradient?.y2 || '0%');
  const [cx, setCx] = useState(gradient?.cx || '50%');
  const [cy, setCy] = useState(gradient?.cy || '50%');
  const [r, setR]   = useState(gradient?.r || '50%');

  function updateStop(i, patch) {
    setStops(s => s.map((st, idx) => idx === i ? { ...st, ...patch } : st));
  }

  function addStop() {
    const lastOffset = stops.length ? parseInt(stops[stops.length - 1].offset) : 50;
    setStops(s => [...s, { offset: Math.min(lastOffset + 20, 100) + '%', stopColor: '#ffffff', stopOpacity: 1 }]);
  }

  function removeStop(i) {
    if (stops.length <= 2) return;
    setStops(s => s.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    const grad = { type, stops, ...(type === 'linear' ? { x1, y1, x2, y2 } : { cx, cy, r }) };
    onSave(grad);
  }

  const gradientCSS = type === 'linear'
    ? `linear-gradient(to right, ${stops.map(s => s.stopColor).join(', ')})`
    : `radial-gradient(circle, ${stops.map(s => s.stopColor).join(', ')})`;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 }}>
      {/* Preview */}
      <div style={{ height: 32, borderRadius: 6, background: gradientCSS, border: '1px solid var(--border)' }} />

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['linear', 'radial'].map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
            background: type === t ? 'var(--accent-dim)' : 'var(--bg-raised)',
            outline: type === t ? '1px solid var(--accent)' : '1px solid var(--border)',
            color: type === t ? 'var(--accent)' : 'var(--text-muted)',
          }}>{t}</button>
        ))}
      </div>

      {/* Direction (linear) or center/radius (radial) */}
      <div style={{ display: 'flex', gap: 4 }}>
        {type === 'linear' ? (
          <>
            {[
              { label: '→', x1: '0%', y1: '50%', x2: '100%', y2: '50%' },
              { label: '↘', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
              { label: '↓', x1: '50%', y1: '0%', x2: '50%', y2: '100%' },
              { label: '↙', x1: '100%', y1: '0%', x2: '0%', y2: '100%' },
            ].map(d => (
              <button key={d.label} onClick={() => { setX1(d.x1); setY1(d.y1); setX2(d.x2); setY2(d.y2); }}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 13,
                  background: x1 === d.x1 && y1 === d.y1 ? 'var(--accent-dim)' : 'var(--bg-raised)',
                  outline: x1 === d.x1 && y1 === d.y1 ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: x1 === d.x1 && y1 === d.y1 ? 'var(--accent)' : 'var(--text-muted)',
                }}>{d.label}</button>
            ))}
          </>
        ) : (
          <>
            <DirectionInput label="CX" value={cx} onChange={setCx} />
            <DirectionInput label="CY" value={cy} onChange={setCy} />
            <DirectionInput label="R" value={r} onChange={setR} />
          </>
        )}
      </div>

      {/* Stops */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Color Stops</span>
        {stops.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="color" value={s.stopColor} onChange={e => updateStop(i, { stopColor: e.target.value })}
              style={{ width: 28, height: 24, border: '1px solid var(--border)', borderRadius: 4, padding: 0, cursor: 'pointer', background: 'none' }} />
            <input type="range" min={0} max={100} value={parseInt(s.offset)} onChange={e => updateStop(i, { offset: e.target.value + '%' })}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', width: 28 }}>{s.offset}</span>
            {stops.length > 2 && (
              <button onClick={() => removeStop(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                &times;
              </button>
            )}
          </div>
        ))}
        <button onClick={addStop} style={{
          padding: '4px 0', borderRadius: 6, border: '1px dashed var(--border)',
          background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
        }}>+ Add Stop</button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--bg-raised)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
        }}>Cancel</button>
        <button onClick={handleSave} style={{
          padding: '5px 12px', borderRadius: 6, border: 'none',
          background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>Save Gradient</button>
      </div>
    </div>
  );
}

function DirectionInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', textAlign: 'center', background: 'var(--bg-raised)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 4, padding: '3px 4px', fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none',
        }} />
    </label>
  );
}
