import { useState } from 'react';

const PRESETS = [
  { type: 'fadeIn',      label: 'Fade In',  css: '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }' },
  { type: 'scalePulse',  label: 'Scale',    css: '@keyframes scalePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }' },
  { type: 'rotateAnim',  label: 'Rotate',   css: '@keyframes rotateAnim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' },
  { type: 'slideIn',     label: 'Slide In', css: '@keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }' },
];

const EASINGS = ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'];

export default function AnimationPanel({ animation, keyframes, onApply, onRemove }) {
  const [duration, setDuration] = useState(animation?.duration || 1);
  const [delay,    setDelay]    = useState(animation?.delay    || 0);
  const [easing,   setEasing]   = useState(animation?.easing   || 'ease');
  const [repeat,   setRepeat]   = useState(animation?.repeat   || 'infinite');

  function handlePreset(preset) {
    onApply({ type: preset.type, name: preset.type, duration, delay, easing, repeat }, preset.css);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {animation && (
        <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace',
          padding: '4px 8px', background: 'var(--accent-dim)', borderRadius: 4, border: '1px solid rgba(13,101,217,0.2)' }}>
          {animation.type} · {animation.duration}s
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {PRESETS.map(p => (
          <button key={p.type} onClick={() => handlePreset(p)} style={{
            padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            background: animation?.type === p.type ? 'var(--accent-dim)' : 'var(--bg-raised)',
            outline: animation?.type === p.type ? '1px solid var(--accent)' : '1px solid var(--border)',
            color: animation?.type === p.type ? 'var(--accent)' : 'var(--text-secondary)',
          }}>{p.label}</button>
        ))}
      </div>

      {/* Duration & Delay */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Duration (s)</span>
          <input type="number" min={0.1} step={0.1} value={duration} onChange={e => setDuration(parseFloat(e.target.value) || 1)}
            style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, padding: '4px 6px', fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delay (s)</span>
          <input type="number" min={0} step={0.1} value={delay} onChange={e => setDelay(parseFloat(e.target.value) || 0)}
            style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, padding: '4px 6px', fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
        </label>
      </div>

      {/* Easing */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Easing</span>
        <select value={easing} onChange={e => setEasing(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, padding: '4px 6px', fontSize: 11, outline: 'none' }}>
          {EASINGS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </label>

      {animation && (
        <button onClick={onRemove} style={{
          padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.1)', color: 'var(--red)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        }}>Remove Animation</button>
      )}
    </div>
  );
}
