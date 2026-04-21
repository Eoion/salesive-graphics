import { useState, useEffect } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';

export default function VariablesPanel({ variables, onAdd, onUpdate, onRemove, onClose }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({ name: name.trim().replace(/[^a-z0-9-]/gi, '-').toLowerCase(), value, type: 'color' });
    setName(''); setValue('');
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      <div style={{
        width: 400, maxHeight: '70vh', background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Variables</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <DuotoneIcon svg={ICONS.close} size={16} />
          </button>
        </div>

        {/* Existing variables */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {variables.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
              No variables defined yet. Add one below.
            </div>
          )}
          {variables.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6,
            }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: v.value, border: '1px solid var(--border)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', flex: 1 }}>
                --{v.name}
              </span>
              <input type="color" value={v.value} onChange={e => onUpdate(v.id, { value: e.target.value })}
                style={{ width: 24, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }} />
              <button onClick={() => onRemove(v.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>&times;</button>
            </div>
          ))}
        </div>

        {/* Add new variable */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="variable-name"
            style={{
              flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 6, padding: '5px 8px',
              fontSize: 11, fontFamily: 'DM Mono, monospace', outline: 'none',
            }} />
          <input type="color" value={value || '#3b82f6'} onChange={e => setValue(e.target.value)}
            style={{ width: 32, height: 28, border: '1px solid var(--border)', borderRadius: 4, padding: 0, cursor: 'pointer', background: 'none' }} />
          <button onClick={handleAdd} disabled={!name.trim()} style={{
            padding: '5px 12px', borderRadius: 6, border: 'none',
            background: name.trim() ? 'var(--accent)' : 'var(--bg-raised)',
            color: name.trim() ? '#fff' : 'var(--text-muted)',
            cursor: name.trim() ? 'pointer' : 'default', fontSize: 11, fontWeight: 600,
          }}>Add</button>
        </div>
      </div>
    </div>
  );
}
