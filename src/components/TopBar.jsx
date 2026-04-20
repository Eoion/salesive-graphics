import { useState } from 'react';
import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';
import DocsModal from './DocsModal.jsx';

const STEPS = [
  { key: 'editor',  label: 'Edit' },
  { key: 'mapping', label: 'Map' },
  { key: 'preview', label: 'Preview' },
];
const STEP_ORDER = { editor: 0, mapping: 1, preview: 2 };

export default function TopBar({ mode, templateName, onNameChange, onExport, onNewProject, onNavigate }) {
  const currentIdx = STEP_ORDER[mode] ?? -1;
  const [showDocs, setShowDocs] = useState(false);

  return (<>
    <header style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      className="flex items-center justify-between px-5 h-12 shrink-0 z-20">

      {/* Brand */}
      <div className="flex items-center gap-2" style={{ minWidth: 180 }}>
        <img src="https://salesive.com/favicon-32x32.png" alt="Salesive" style={{ width: 20, height: 20, borderRadius: 4 }} />
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Salesive
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/ Template Builder</span>
      </div>

      {/* Step indicator — centered */}
      {mode !== 'upload' && (
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const idx = STEP_ORDER[step.key];
            const isCurrent = step.key === mode;
            const isPast = idx < currentIdx;
            const isClickable = isPast && !!onNavigate;
            return (
              <div key={step.key} className="flex items-center gap-1">
                {i > 0 && (
                  <span style={{ color: 'var(--border-strong)', fontSize: 13, margin: '0 2px' }}>›</span>
                )}
                <button
                  onClick={isClickable ? () => onNavigate(step.key) : undefined}
                  style={{
                    padding: '3px 10px', borderRadius: 6,
                    background: isCurrent ? 'var(--accent-dim)' : 'transparent',
                    border: `1px solid ${isCurrent ? 'rgba(13,101,217,0.3)' : 'transparent'}`,
                    color: isCurrent ? 'var(--accent)' : isPast ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif',
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'color 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={e => { if (isClickable) { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(13,101,217,0.3)'; } }}
                  onMouseLeave={e => { if (isClickable) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'transparent'; } }}
                >
                  <span style={{ fontSize: 9, opacity: 0.6, marginRight: 4 }}>{i + 1}</span>
                  {step.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-3" style={{ minWidth: 180, justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowDocs(true)}
          title="Documentation"
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--bg-raised)', color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', lineHeight: 1,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >?</button>
        {mode !== 'upload' && onNewProject && (
          <button onClick={onNewProject}
            style={{
              padding: '3px 10px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)', color: 'var(--text-secondary)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
            }}>
            New
          </button>
        )}
        {(mode === 'mapping' || mode === 'preview') && (
          <input
            value={templateName}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Template name…"
            style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 6, padding: '3px 10px',
              fontSize: 12, fontFamily: 'Syne, sans-serif', outline: 'none', width: 140,
            }}
          />
        )}
        {mode === 'preview' && (
          <button onClick={onExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Syne, sans-serif',
            }}>
            <DuotoneIcon svg={ICONS.download} size={12} style={{ color: '#fff' }} />
            Export Schema
          </button>
        )}
      </div>
    </header>

    {showDocs && <DocsModal onClose={() => setShowDocs(false)} />}
  </>);
}
