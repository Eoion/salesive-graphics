import { useRef, useState } from 'react';
import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';

export default function UploadScreen({ onUpload, onNewCanvas }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      setError('Only SVG files are supported.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = e => onUpload(e.target.result, file.name);
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function loadDemo() {
    const demo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect id="bg_rect" x="0" y="0" width="800" height="600" fill="#1a1a2e"/>
  <rect id="accent_bar" x="0" y="0" width="800" height="8" fill="#0D65D9"/>
  <rect id="hero_image" x="60" y="80" width="680" height="300" fill="#2a2a4a" rx="8"/>
  <text id="placeholder_hint" x="400" y="245" fill="#555" font-size="18" text-anchor="middle" font-family="sans-serif">Hero Image</text>
  <rect id="cta_button" x="60" y="460" width="220" height="56" fill="#0D65D9" rx="8"/>
  <text id="cta_text" x="170" y="494" fill="#ffffff" font-size="18" font-weight="bold" text-anchor="middle" font-family="sans-serif">Shop Now</text>
  <text id="headline_text" x="60" y="430" fill="#ffffff" font-size="36" font-weight="bold" font-family="sans-serif">Summer Sale</text>
  <text id="subheadline_text" x="60" y="458" fill="#aaaacc" font-size="16" font-family="sans-serif">Up to 50% off everything</text>
  <image id="logo_image" x="650" y="520" width="100" height="40" href=""/>
  <circle id="social_icon_ig" cx="350" cy="540" r="16" fill="#333"/>
  <circle id="social_icon_fb" cx="390" cy="540" r="16" fill="#333"/>
  <circle id="social_icon_tw" cx="430" cy="540" r="16" fill="#333"/>
</svg>`;
    onUpload(demo, 'demo-flyer.svg');
  }

  return (
    <div className="flex flex-col items-center justify-center h-full animate-fade"
      style={{ background: 'var(--bg-base)' }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
          SVG Template Builder
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
          Upload an existing SVG or start drawing from scratch
        </p>
      </div>

      {/* Two-column entry points */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {/* Upload drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current.click()}
          style={{
            width: 300, minHeight: 220,
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 12,
            background: dragging ? 'var(--accent-dim)' : 'var(--bg-surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', transition: 'all 0.15s',
            boxShadow: dragging ? '0 0 24px var(--accent-glow)' : 'none',
            padding: 24,
          }}>
          <DuotoneIcon svg={ICONS.upload} size={36} style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: dragging ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 600, fontSize: 14, margin: 0 }}>
              {dragging ? 'Drop SVG here' : 'Upload SVG'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Drag & drop or click to browse
            </p>
          </div>
          <input ref={inputRef} type="file" accept=".svg,image/svg+xml" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>or</span>
          <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
        </div>

        {/* New canvas */}
        <button onClick={onNewCanvas}
          style={{
            width: 300, minHeight: 220,
            border: '2px dashed var(--border-strong)',
            borderRadius: 12,
            background: 'var(--bg-surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', transition: 'all 0.15s', padding: 24,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}>
          <DuotoneIcon svg={ICONS.pencil} size={36} style={{ color: 'var(--text-muted)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, margin: 0 }}>
              New Canvas
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Draw shapes, text & images
            </p>
          </div>
        </button>
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 16 }}>{error}</p>
      )}

      {/* Demo shortcut */}
      <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ height: 1, width: 60, background: 'var(--border)' }} />
        <button onClick={loadDemo}
          style={{
            padding: '6px 18px', borderRadius: 8,
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-raised)', color: 'var(--text-secondary)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
            fontWeight: 500, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
          Load demo SVG
        </button>
        <div style={{ height: 1, width: 60, background: 'var(--border)' }} />
      </div>
    </div>
  );
}
