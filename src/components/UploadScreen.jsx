import { useEffect, useRef, useState } from 'react';
import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';
import CanvasGallery from './CanvasGallery.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { canvases } from '../lib/api.js';

export default function UploadScreen({
  onUpload,
  onNewCanvas,
  savedCanvases = [],
  savedCanvasesLoading = false,
  onOpenCanvas,
  onRefreshCanvases,
  onDeleteCanvas,
}) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('mine');
  const [publicCanvases, setPublicCanvases] = useState([]);
  const [publicCanvasesLoading, setPublicCanvasesLoading] = useState(true);
  const [pendingDeleteCanvas, setPendingDeleteCanvas] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [refreshAnimating, setRefreshAnimating] = useState(false);
  const refreshAnimationTimerRef = useRef(null);
  const hasSavedCanvases = savedCanvases.length > 0;
  const hasPublicCanvases = publicCanvases.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function refreshPublicCanvases() {
      setPublicCanvasesLoading(true);
      try {
        const response = await canvases.listPublic();
        if (!cancelled) {
          setPublicCanvases(response.data.data.canvases || []);
        }
      } catch (fetchError) {
        console.error('Failed to load public canvases:', fetchError);
      } finally {
        if (!cancelled) setPublicCanvasesLoading(false);
      }
    }

    refreshPublicCanvases();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (refreshAnimationTimerRef.current) {
      clearTimeout(refreshAnimationTimerRef.current);
    }
  }, []);

  const isMineTab = activeTab === 'mine';
  const galleryCanvases = isMineTab ? savedCanvases : publicCanvases;
  const galleryLoading = isMineTab ? savedCanvasesLoading : publicCanvasesLoading;
  const hasGalleryCanvases = isMineTab ? hasSavedCanvases : hasPublicCanvases;

  async function refreshActiveGallery() {
    if (isMineTab) {
      await onRefreshCanvases?.();
      return;
    }

    setPublicCanvasesLoading(true);
    try {
      const response = await canvases.listPublic();
      setPublicCanvases(response.data.data.canvases || []);
    } catch (fetchError) {
      console.error('Failed to refresh public canvases:', fetchError);
    } finally {
      setPublicCanvasesLoading(false);
    }
  }

  async function handleRefreshGallery() {
    if (galleryLoading) return;

    if (refreshAnimationTimerRef.current) {
      clearTimeout(refreshAnimationTimerRef.current);
    }

    setRefreshAnimating(true);

    try {
      await refreshActiveGallery();
    } finally {
      refreshAnimationTimerRef.current = setTimeout(() => {
        setRefreshAnimating(false);
        refreshAnimationTimerRef.current = null;
      }, 450);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteCanvas || !onDeleteCanvas) return;

    setDeleteBusy(true);
    try {
      await onDeleteCanvas(pendingDeleteCanvas);
      setPendingDeleteCanvas(null);
    } finally {
      setDeleteBusy(false);
    }
  }

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
    <div
      className="animate-fade"
      style={{
        background: 'var(--bg-base)',
        flex: 1,
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <div style={{
        width: 'min(1080px, 92vw)',
        margin: '0 auto',
        padding: '40px 0 64px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
          Salesive Graphics Engine
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

      <div style={{ width: '100%', marginTop: 42 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Canvas Gallery
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Switch between your saved work and the public canvas feed.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'inline-flex',
              padding: 3,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)',
              gap: 4,
            }}>
              {[
                { key: 'mine', label: 'My Work' },
                { key: 'public', label: 'Public' },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      padding: '8px 12px',
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'Syne, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleRefreshGallery}
              disabled={galleryLoading}
              title="Refresh Gallery"
              aria-label="Refresh Gallery"
              style={{
                width: 38,
                height: 38,
                padding: 0,
                borderRadius: '50%',
                border: '1px solid var(--border)',
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                cursor: galleryLoading ? 'default' : 'pointer',
                opacity: galleryLoading ? 0.85 : 1,
                transition: 'opacity 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                style={{
                  flexShrink: 0,
                  animation: (galleryLoading || refreshAnimating) ? 'spin 0.45s linear' : 'none',
                }}
              >
                <path
                  opacity="0.4"
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 8.4 20.3025 6.05556 19.4537 5.33333C17.6226 3.2875 14.9617 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  fill="currentColor"
                />
                <path
                  d="M20.0092 2V5.13219C20.0092 5.42605 19.6418 5.55908 19.4537 5.33333C17.6226 3.2875 14.9617 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>

        {galleryLoading && !hasGalleryCanvases ? (
          <div style={{
            borderRadius: 18,
            border: '1px dashed var(--border-strong)',
            padding: 28,
            background: 'rgba(255,255,255,0.02)',
            color: 'var(--text-muted)',
            fontSize: 13,
            textAlign: 'center',
          }}>
            {isMineTab ? 'Loading your canvases…' : 'Loading public canvases…'}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <CanvasGallery
              canvases={galleryCanvases}
              title={isMineTab ? 'Your Work' : 'Public Gallery'}
              subtitle={isMineTab
                ? 'Re-open drafts, continue saved work, and jump back into editing.'
                : 'Browse public canvases shared across the workspace.'}
              emptyMessage={isMineTab
                ? 'Your drafts and saved canvases will appear here once you start working.'
                : 'No public canvases available yet.'}
              onOpenCanvas={onOpenCanvas}
              onDeleteCanvas={isMineTab ? (canvas) => setPendingDeleteCanvas(canvas) : null}
              showOwner={!isMineTab}
              compact
            />
            {galleryLoading && hasGalleryCanvases && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 700,
                pointerEvents: 'none',
              }}>
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '2px solid rgba(13,101,217,0.18)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Refreshing gallery
              </div>
            )}
          </div>
        )}
      </div>

      {pendingDeleteCanvas && (
        <ConfirmModal
          title="Delete canvas?"
          message={`"${pendingDeleteCanvas.name}" will be permanently removed from your work. This action cannot be undone.`}
          confirmLabel="Delete Canvas"
          danger
          busy={deleteBusy}
          onCancel={() => { if (!deleteBusy) setPendingDeleteCanvas(null); }}
          onConfirm={handleConfirmDelete}
        />
      )}
      </div>
    </div>
  );
}
