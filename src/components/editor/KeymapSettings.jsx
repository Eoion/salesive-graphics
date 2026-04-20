import { useRef } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import { ACTION_LABELS } from '../../editor/keymaps/photoshop.js';

export default function KeymapSettings({ bindings, keymapName, onImport, onReset, onClose }) {
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const ok = onImport(ev.target.result);
      if (!ok) alert('Invalid keymap JSON. Must have a "bindings" object.');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleExport() {
    const blob = new Blob(
      [JSON.stringify({ name: keymapName, bindings }, null, 2)],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${keymapName.toLowerCase().replace(/\s+/g, '-')}-keymap.json`;
    a.click();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="animate-fade" style={{
        width: 440, background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 16,
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', maxHeight: '80vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              Keyboard Shortcuts
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Active: {keymapName}
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

        {/* Bindings table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>Action</th>
                <th style={{ textAlign: 'right', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>Shortcut</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(bindings).map(([action, combo]) => (
                <tr key={action}>
                  <td style={{ padding: '7px 0', fontSize: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                    {ACTION_LABELS[action] || action}
                  </td>
                  <td style={{ padding: '7px 0', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                    <kbd style={{
                      padding: '2px 7px', borderRadius: 4,
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      fontSize: 11, fontFamily: 'DM Mono, monospace',
                      color: 'var(--text-secondary)',
                    }}>
                      {formatCombo(combo)}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
          <button onClick={() => fileRef.current.click()} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 7,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>
            <DuotoneIcon svg={ICONS.upload} size={12} />
            Import JSON
          </button>
          <button onClick={handleExport} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 7,
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>
            <DuotoneIcon svg={ICONS.download} size={12} />
            Export JSON
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onReset} style={{
            padding: '6px 12px', borderRadius: 7,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--red)', fontSize: 11, cursor: 'pointer',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>
            Reset Default
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCombo(combo) {
  return combo
    .replace('Ctrl+', '⌘ ')
    .replace('Shift+', '⇧ ')
    .replace('Alt+', '⌥ ')
    .replace('Delete', '⌫')
    .replace('Escape', 'Esc');
}
