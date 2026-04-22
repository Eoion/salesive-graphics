import { useState, useRef, useEffect, useCallback } from 'react';

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r, g, b;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    if (max === r)      h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else                h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, s, v];
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function hsvToHex(h, s, v) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

const PRESETS = [
  '#0D65D9', '#ef4444', '#ec4899', '#0D65D9', '#6366f1',
  '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#0D65D9',
  '#0D65D9', '#78716c', '#ffffff', '#a1a1aa', '#000000',
];

export default function ColorPicker({ value, onChange, onClose }) {
  const hex = (value && value !== 'none') ? value : '#000000';
  const [h, s, v] = hexToHsv(hex);
  const [hue, setHue] = useState(h);
  const [sat, setSat] = useState(s);
  const [val, setVal] = useState(v);
  const [hexInput, setHexInput] = useState(hex.toUpperCase());
  const areaRef = useRef();
  const hueRef = useRef();
  const dragging = useRef(null);
  const containerRef = useRef();

  useEffect(() => {
    if (!onClose) return;
    function onDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);

  useEffect(() => {
    const [nh, ns, nv] = hexToHsv(hex);
    setHue(nh); setSat(ns); setVal(nv);
    setHexInput(hex.toUpperCase());
  }, [hex]);

  function emit(h, s, v) {
    onChange(hsvToHex(h, s, v));
  }

  const pickArea = useCallback((e) => {
    const rect = areaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const ns = x / rect.width;
    const nv = 1 - y / rect.height;
    setSat(ns); setVal(nv);
    emit(hue, ns, nv);
    setHexInput(hsvToHex(hue, ns, nv).toUpperCase());
  }, [hue, onChange]);

  const pickHue = useCallback((e) => {
    const rect = hueRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const nh = (y / rect.height) * 360;
    setHue(nh);
    emit(nh, sat, val);
    setHexInput(hsvToHex(nh, sat, val).toUpperCase());
  }, [sat, val, onChange]);

  useEffect(() => {
    function onMove(e) {
      if (dragging.current === 'area') pickArea(e);
      else if (dragging.current === 'hue') pickHue(e);
    }
    function onUp() { dragging.current = null; }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pickArea, pickHue]);

  function handleHexCommit() {
    const clean = hexInput.replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      const [nh, ns, nv] = hexToHsv('#' + clean);
      setHue(nh); setSat(ns); setVal(nv);
      onChange('#' + clean.toLowerCase());
    } else {
      setHexInput(hsvToHex(hue, sat, val).toUpperCase());
    }
  }

  const currentHex = hsvToHex(hue, sat, val);

  return (
    <div ref={containerRef} style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 12, width: 210,
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    }}>
      {/* SV area */}
      <div ref={areaRef}
        onPointerDown={e => { dragging.current = 'area'; pickArea(e); }}
        style={{
          width: '100%', height: 150, borderRadius: 6, cursor: 'crosshair',
          position: 'relative',
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
          `,
        }}>
        {/* Indicator */}
        <div style={{
          position: 'absolute',
          left: sat * 100 + '%',
          top: (1 - val) * 100 + '%',
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 4px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hue slider */}
      <div ref={hueRef}
        onPointerDown={e => { dragging.current = 'hue'; pickHue(e); }}
        style={{
          width: '100%', height: 12, borderRadius: 6, marginTop: 8, cursor: 'crosshair',
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
          position: 'relative',
        }}>
        <div style={{
          position: 'absolute',
          left: (hue / 360) * 100 + '%',
          top: -1, width: 6, height: 14, borderRadius: 3,
          background: '#fff', border: '1px solid rgba(0,0,0,0.3)',
          transform: 'translateX(-50%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Hex input + swatch */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: currentHex,
          border: '1px solid var(--border)', flexShrink: 0,
        }} />
        <input
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleHexCommit(); }}
          onBlur={handleHexCommit}
          style={{
            flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', borderRadius: 6, padding: '4px 8px',
            fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
        {PRESETS.map(c => (
          <button key={c} onClick={() => {
            const [nh, ns, nv] = hexToHsv(c);
            setHue(nh); setSat(ns); setVal(nv);
            setHexInput(c.toUpperCase());
            onChange(c);
          }} style={{
            width: 20, height: 20, borderRadius: 4,
            background: c, border: c === currentHex ? '2px solid var(--accent)' : '1px solid var(--border)',
            cursor: 'pointer', padding: 0,
          }} />
        ))}
      </div>

      {/* None button */}
      <button onClick={() => onChange('none')} style={{
        marginTop: 8, width: '100%', padding: '4px 0', borderRadius: 5,
        background: value === 'none' ? 'var(--accent-dim)' : 'var(--bg-raised)',
        border: value === 'none' ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: value === 'none' ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace',
      }}>None (transparent)</button>
    </div>
  );
}
