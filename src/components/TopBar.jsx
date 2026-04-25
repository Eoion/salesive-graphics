import { useState, useRef, useEffect } from 'react';
import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';
import DocsModal from './DocsModal.jsx';


const STEPS = [
  { key: 'editor',  label: 'Edit' },
  { key: 'mapping', label: 'Map' },
  { key: 'preview', label: 'Preview' },
];
const STEP_ORDER = { editor: 0, mapping: 1, preview: 2 };
const SHOW_EDITOR_STEPS = new Set(['editor', 'mapping', 'preview']);

export default function TopBar({
  mode,
  templateName,
  onNameChange,
  onExport,
  onNewProject,
  onNavigate,
  theme = 'dark',
  onToggleTheme,
  user,
  onLogout,
}) {
  const currentIdx = STEP_ORDER[mode] ?? -1;
  const [showDocs, setShowDocs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const isLight = theme === 'light';
  const toggleTitle = `Switch to ${isLight ? 'dark' : 'light'} mode (Ctrl+Shift+L / Cmd+Shift+L)`;

  const hasAuthenticatedUser = Boolean(
    user && (user._id || user.email || user.name)
  );
  const displayUser = hasAuthenticatedUser ? user : null;
  const initials = displayUser?.initials || displayUser?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const avatarSrc = displayUser?.avatar || '';

  useEffect(() => {
    if (!hasAuthenticatedUser) {
      setShowUserMenu(false);
    }
  }, [hasAuthenticatedUser]);

  useEffect(() => {
    if (!showUserMenu) return;
    function onClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showUserMenu]);

  return (<>
    <header style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
      className="flex items-center justify-between px-5 h-12 shrink-0 z-20">

      {/* Brand */}
      <div className="flex items-center gap-2" style={{ minWidth: 180 }}>
        <img src="https://salesive.com/favicon-32x32.png" alt="Salesive" style={{ width: 20, height: 20, borderRadius: 4 }} />
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Salesive Graphics Engine
        </span>
      </div>

      {/* Step indicator — centered */}
      {SHOW_EDITOR_STEPS.has(mode) && (
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
        {onToggleTheme && (
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 2, gap: 1,
          }}>
            {[
              { key: 'light', icon: ICONS.sun,  label: 'Light mode' },
              { key: 'dark',  icon: ICONS.moon, label: 'Dark mode'  },
            ].map(({ key, icon, label }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => !active && onToggleTheme()}
                  title={label}
                  aria-label={label}
                  style={{
                    width: 26, height: 24, borderRadius: 6, border: 'none',
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: active ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <DuotoneIcon svg={icon} size={13} />
                </button>
              );
            })}
          </div>
        )}
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
        {(mode === 'editor' || mode === 'mapping' || mode === 'preview') && (
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

        {hasAuthenticatedUser && (
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(m => !m)}
              title={displayUser.name}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: avatarSrc ? 'var(--bg-raised)' : showUserMenu ? 'var(--accent)' : 'var(--accent-dim)',
                border: `1px solid ${showUserMenu ? 'var(--accent)' : 'rgba(13,101,217,0.3)'}`,
                color: showUserMenu ? '#fff' : 'var(--accent)',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s', flexShrink: 0,
                letterSpacing: '0.02em',
                overflow: 'hidden',
                padding: 0,
              }}
              onMouseEnter={e => {
                if (!showUserMenu && !avatarSrc) {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }
              }}
              onMouseLeave={e => {
                if (!showUserMenu && !avatarSrc) {
                  e.currentTarget.style.background = 'var(--accent-dim)';
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.borderColor = 'rgba(13,101,217,0.3)';
                }
              }}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={displayUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                initials
              )}
            </button>

            {showUserMenu && (
              <div style={{
                position: 'absolute', top: 36, right: 0, zIndex: 200,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
                minWidth: 210, overflow: 'hidden',
              }}>
                {/* User info */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    overflow: 'hidden',
                  }}>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={displayUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      initials
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayUser.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{displayUser.email}</div>
                  </div>
                </div>

                {/* Menu items */}
                <div style={{ padding: '4px' }}>
                  {[
                    { label: 'Profile', icon: ICONS.pencil },
                    { label: 'Settings', icon: ICONS.layers },
                  ].map(({ label, icon }) => (
                    <button key={label} onClick={() => setShowUserMenu(false)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 6, border: 'none',
                      background: 'transparent', color: 'var(--text-secondary)',
                      fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'Syne, sans-serif',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <DuotoneIcon svg={icon} size={12} />
                      {label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 10px' }} />
                  <button onClick={() => { setShowUserMenu(false); onLogout?.(); }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 6, border: 'none',
                    background: 'transparent', color: 'var(--red)',
                    fontSize: 12, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Syne, sans-serif',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <DuotoneIcon svg={ICONS.close} size={12} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

    {showDocs && <DocsModal onClose={() => setShowDocs(false)} />}
  </>);
}
