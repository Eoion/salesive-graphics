import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';

function svgPreviewUrl(svg) {
  if (!svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function formatUpdatedAt(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function CanvasGallery({
  title,
  subtitle,
  canvases = [],
  emptyMessage = 'No canvases yet.',
  onOpenCanvas,
  onDeleteCanvas,
  showOwner = false,
  compact = false,
}) {
  return (
    <section style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(title || subtitle) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {title && (
            <h3 style={{ margin: 0, fontSize: compact ? 18 : 22, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {canvases.length === 0 ? (
        <div style={{
          borderRadius: 18,
          border: '1px dashed var(--border-strong)',
          padding: compact ? 20 : 28,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          color: 'var(--text-muted)',
          fontSize: 13,
          textAlign: 'center',
        }}>
          {emptyMessage}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fill, minmax(160px, 220px))'
            : 'repeat(auto-fill, minmax(220px, 320px))',
          gap: compact ? 12 : 16,
          justifyContent: 'start',
          alignItems: 'start',
        }}>
          {canvases.map((canvas) => {
            const previewUrl = svgPreviewUrl(canvas.previewSvg || canvas.svg);
            return (
              <article
                key={canvas._id}
                style={{
                  width: '100%',
                  maxWidth: compact ? 220 : 320,
                  justifySelf: 'start',
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '1px solid rgba(148,163,184,0.16)',
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.08))',
                  boxShadow: '0 12px 30px rgba(15,23,42,0.08)',
                }}
              >
                <div style={{
                  aspectRatio: '4 / 3',
                  background: 'linear-gradient(135deg, rgba(13,101,217,0.08), rgba(15,23,42,0.02))',
                  borderBottom: '1px solid rgba(148,163,184,0.12)',
                  padding: 10,
                }}>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={canvas.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.72)',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.5)',
                      fontSize: 12,
                    }}>
                      No preview
                    </div>
                  )}
                </div>

                <div style={{ padding: compact ? 12 : 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {canvas.name}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        Updated {formatUpdatedAt(canvas.updatedAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {canvas.isDraft && (
                        <span style={{
                          padding: '3px 7px',
                          borderRadius: 999,
                          background: 'rgba(245,158,11,0.12)',
                          color: '#f59e0b',
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          Draft
                        </span>
                      )}
                      {canvas.public && (
                        <span style={{
                          padding: '3px 7px',
                          borderRadius: 999,
                          background: 'rgba(16,185,129,0.12)',
                          color: '#10b981',
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          Public
                        </span>
                      )}
                    </div>
                  </div>

                  {showOwner && canvas.user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'var(--accent-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {canvas.user.avatar ? (
                          <img src={canvas.user.avatar} alt={canvas.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
                            {(canvas.user.name || '?').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ minWidth: 0, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {canvas.user.name}
                      </div>
                    </div>
                  )}

                  {onOpenCanvas && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => onOpenCanvas(canvas)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          border: '1px solid rgba(13,101,217,0.28)',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          borderRadius: 12,
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'Syne, sans-serif',
                        }}
                      >
                        <DuotoneIcon svg={ICONS.pencil} size={13} />
                        Edit
                      </button>

                      {onDeleteCanvas && (
                        <button
                          onClick={() => onDeleteCanvas(canvas)}
                          title={`Delete ${canvas.name}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            border: '1px solid rgba(239,68,68,0.22)',
                            background: 'rgba(239,68,68,0.08)',
                            color: 'var(--red)',
                            borderRadius: 12,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'Syne, sans-serif',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <DuotoneIcon svg={ICONS.delete} size={13} />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
