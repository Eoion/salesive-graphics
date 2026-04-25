export default function ConfirmModal({
  title = 'Confirm action',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        width: 'min(420px, 100%)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            {title}
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {message}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '9px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)',
              color: 'var(--text-secondary)',
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'Syne, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              minWidth: 104,
              padding: '9px 14px',
              borderRadius: 12,
              border: 'none',
              background: danger ? 'var(--red)' : 'var(--accent)',
              color: '#fff',
              cursor: busy ? 'default' : 'pointer',
              fontFamily: 'Syne, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
