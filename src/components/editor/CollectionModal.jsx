import { useEffect } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';

export default function CollectionModal({
  items = [],
  loading = false,
  onInsert,
  onDelete,
  onClose,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        width: 560,
        maxHeight: '80vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Collection</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {loading ? 'Loading saved items…' : `${items.length} saved item${items.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <DuotoneIcon svg={ICONS.close} size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
              Loading saved collection items…
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 12 }}>
              No saved items yet. Select elements in the editor and click "Save to Collection".
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {items.map(item => (
                <div
                  key={item._id}
                  onClick={() => onInsert?.(item)}
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div
                    style={{ width: '100%', aspectRatio: '4/3', background: '#fff', position: 'relative', overflow: 'hidden' }}
                    dangerouslySetInnerHTML={{
                      __html: item.thumbnail
                        ? item.thumbnail.replace('<svg', '<svg style="width:100%;height:100%;display:block;"')
                        : '',
                    }}
                  />

                  <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {item.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(item);
                      }}
                      title="Delete"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', display: 'flex', fontSize: 14, lineHeight: 1 }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
