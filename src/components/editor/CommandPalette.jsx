import { useState, useEffect, useRef, useMemo, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons as lucideIcons } from 'lucide-react';
import docRaw from '../../../doc.md?raw';

// ── Doc parsing ──────────────────────────────────────────────────────────────
// Keep raw lines so we can render them properly in the detail view.

function parseDocs(raw) {
  const lines = raw.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h = line.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      if (current) sections.push(current);
      current = {
        title: h[2].replace(/[*_`]/g, ''),
        level: h[1].length,
        lines: [],
        body: '',
      };
    } else if (current) {
      current.lines.push(line);
      current.body += line + ' ';
    }
  }
  if (current) sections.push(current);
  return sections;
}

const DOC_SECTIONS = parseDocs(docRaw);

// ── Simple markdown renderer ─────────────────────────────────────────────────

function renderInline(text) {
  // Bold **x** / __x__, inline code `x`, italic *x*
  const parts = [];
  const re = /(\*\*|__)(.*?)\1|`([^`]+)`|(\*|_)(.*?)\4/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) parts.push(
      <code key={m.index} style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.9em', background: 'var(--bg-raised)', padding: '1px 4px', borderRadius: 3 }}>{m[3]}</code>
    );
    else if (m[4]) parts.push(<em key={m.index}>{m[5]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function DocContent({ section }) {
  const { lines } = section;
  const elements = [];
  let i = 0;
  let tableRows = null;

  function flushTable() {
    if (!tableRows) return;
    const [headerRow, , ...bodyRows] = tableRows;
    const headers = headerRow.split('|').map(s => s.trim()).filter(Boolean);
    elements.push(
      <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '6px 0' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
          <thead>
            <tr>
              {headers.map((h, ci) => (
                <th key={ci} style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => {
              const cells = row.split('|').map(s => s.trim()).filter(Boolean);
              return (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--bg-raised)' }}>
                  {cells.map((c, ci) => (
                    <td key={ci} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 11, verticalAlign: 'top' }}>
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.trim().startsWith('|')) {
      if (!tableRows) tableRows = [];
      tableRows.push(line);
      i++;
      continue;
    } else {
      flushTable();
    }

    // Headings inside section
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const sz = [16, 14, 13, 12, 11, 11][hm[1].length - 1] || 11;
      elements.push(
        <div key={i} style={{ fontSize: sz, fontWeight: 700, color: 'var(--text-primary)', margin: '10px 0 3px' }}>
          {renderInline(hm[2])}
        </div>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />);
      i++; continue;
    }

    // Unordered list
    const lm = line.match(/^(\s*)([-*+])\s+(.+)/);
    if (lm) {
      const items = [];
      while (i < lines.length && lines[i].match(/^(\s*)([-*+])\s+(.+)/)) {
        const m2 = lines[i].match(/^(\s*)([-*+])\s+(.+)/);
        items.push(
          <li key={i} style={{ marginBottom: 2 }}>{renderInline(m2[3])}</li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 16, margin: '4px 0', fontSize: 11 }}>{items}</ul>
      );
      continue;
    }

    // Numbered list
    const nm = line.match(/^\s*\d+\.\s+(.+)/);
    if (nm) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+(.+)/)) {
        const m2 = lines[i].match(/^\s*\d+\.\s+(.+)/);
        items.push(
          <li key={i} style={{ marginBottom: 2 }}>{renderInline(m2[1])}</li>
        );
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: 16, margin: '4px 0', fontSize: 11 }}>{items}</ol>
      );
      continue;
    }

    // Code block
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing ```
      elements.push(
        <pre key={`code-${i}`} style={{
          background: 'var(--bg-raised)', borderRadius: 6, padding: '8px 10px',
          fontSize: 10.5, fontFamily: 'DM Mono, monospace', overflowX: 'auto',
          margin: '4px 0', color: 'var(--text-secondary)',
        }}>{codeLines.join('\n')}</pre>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Paragraph
    elements.push(
      <p key={i} style={{ margin: '3px 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  flushTable();
  return <>{elements}</>;
}

// ── Tool catalogue ───────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'select',     label: 'Select',     key: 'V', icon: '↖' },
  { id: 'rect',       label: 'Rectangle',  key: 'U', icon: '▭' },
  { id: 'circle',     label: 'Circle',     key: 'E', icon: '○' },
  { id: 'polygon',    label: 'Polygon',    key: 'P', icon: '⬡' },
  { id: 'star',       label: 'Star',       key: 'S', icon: '★' },
  { id: 'text',       label: 'Text',       key: 'T', icon: 'T' },
  { id: 'image',      label: 'Image',      key: 'I', icon: '⬜' },
  { id: 'line',       label: 'Line',       key: 'L', icon: '╱' },
  { id: 'arrow',      label: 'Arrow',      key: 'A', icon: '→' },
  { id: 'eyedropper', label: 'Eyedropper', key: 'K', icon: '💧' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function humanize(s) {
  return s.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').trim().toLowerCase();
}

function score(haystack, needle) {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.startsWith(n)) return 3;
  if (h.includes(n)) return 2;
  let hi = 0, ni = 0;
  while (hi < h.length && ni < n.length) { if (h[hi] === n[ni]) ni++; hi++; }
  return ni === n.length ? 1 : 0;
}

function buildLocalSvgDataUrl(name) {
  const Icon = lucideIcons[name];
  if (!Icon) return null;
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      xmlns: 'http://www.w3.org/2000/svg',
      width: 24, height: 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      color: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  );
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ── Style constants ──────────────────────────────────────────────────────────

const SECTION_COLORS = {
  element: { bg: '#3b82f620', accent: '#3b82f6', label: 'Element' },
  tool:    { bg: '#10b98120', accent: '#10b981', label: 'Tool' },
  icon:    { bg: '#8b5cf620', accent: '#8b5cf6', label: 'Icon' },
  doc:     { bg: '#f59e0b20', accent: '#f59e0b', label: 'Docs' },
};

const MAX_ICONS = 12;
const MAX_ELEMENTS = 8;
const MAX_DOCS = 5;

// ── CommandPalette ────────────────────────────────────────────────────────────

export default function CommandPalette({
  isOpen,
  onClose,
  elements,
  onSelectElement,
  onActivateTool,
  onInsertIcon,
  canvasSize,
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [docView, setDocView] = useState(null); // null or a section object
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCursor(0);
      setDocView(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Re-focus input when returning from doc view
  useEffect(() => {
    if (!docView) setTimeout(() => inputRef.current?.focus(), 30);
  }, [docView]);

  // Build result list
  const results = useMemo(() => {
    const q = query.trim();
    const rows = [];

    // Tools
    const toolMatches = TOOLS
      .map((t) => ({ ...t, s: score(t.label, q) }))
      .filter((t) => q === '' || t.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, q ? 5 : 3);
    for (const t of toolMatches) {
      rows.push({
        kind: 'tool', id: 'tool:' + t.id, label: t.label,
        hint: `Press ${t.key}`,
        icon: t.icon,
        action: () => { onActivateTool(t.id); onClose(); },
      });
    }

    // Elements
    if (q) {
      const elMatches = elements
        .map((el) => {
          const terms = [el.id, el.type, el.description || '', el.text || ''];
          const s = Math.max(...terms.map((t) => score(t, q)));
          return { el, s };
        })
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, MAX_ELEMENTS);
      for (const { el } of elMatches) {
        const label = el.type === 'text'
          ? `"${(el.text || '').slice(0, 28)}"`
          : el.description || el.id;
        rows.push({
          kind: 'element', id: 'el:' + el.id,
          label, hint: el.id + ' · ' + el.type,
          color: el.fill && el.fill.startsWith('#') ? el.fill : null,
          action: () => { onSelectElement(el.id); onClose(); },
        });
      }
    }

    // Icons
    if (q.length >= 1) {
      const iconNames = Object.keys(lucideIcons);
      const iconMatches = iconNames
        .map((name) => ({ name, s: score(humanize(name), q) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, MAX_ICONS);
      for (const { name } of iconMatches) {
        rows.push({
          kind: 'icon', id: 'icon:' + name,
          label: humanize(name),
          hint: 'Insert icon',
          iconName: name,
          action: () => {
            const dataUrl = buildLocalSvgDataUrl(name);
            if (dataUrl) onInsertIcon(dataUrl, name);
            onClose();
          },
        });
      }
    }

    // Docs
    if (q.length >= 2) {
      const docMatches = DOC_SECTIONS
        .map((sec) => ({
          sec,
          s: Math.max(score(sec.title, q), score(sec.body, q) > 0 ? 0.5 : 0),
        }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, MAX_DOCS);
      for (const { sec } of docMatches) {
        const snippet = sec.body.replace(/\s+/g, ' ').slice(0, 80).trim();
        rows.push({
          kind: 'doc', id: 'doc:' + sec.title,
          label: sec.title,
          hint: snippet || 'Documentation',
          section: sec,
          action: () => setDocView(sec),
        });
      }
    }

    return rows;
  }, [query, elements, onActivateTool, onSelectElement, onInsertIcon]);

  // Clamp cursor
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(results.length - 1, 0)));
  }, [results.length]);

  // Scroll active row into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  function handleKeyDown(e) {
    if (docView) {
      if (e.key === 'Escape') { e.preventDefault(); setDocView(null); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[cursor]?.action(); }
    else if (e.key === 'Escape') { onClose(); }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '72vh',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {docView ? (
          /* ── Doc detail view ───────────────────────────────────────────── */
          <>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <button
                onClick={() => setDocView(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '4px 8px',
                  color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M7 1L3 5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </button>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {docView.title}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#f59e0b', background: '#f59e0b20',
                padding: '2px 6px', borderRadius: 4, flexShrink: 0,
              }}>
                Docs
              </span>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <DocContent section={docView} />
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 12, padding: '7px 14px',
              borderTop: '1px solid var(--border)', flexShrink: 0,
              fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontSize: 9 }}>Esc</kbd>
                back to search
              </span>
            </div>
          </>
        ) : (
          /* ── Search view ───────────────────────────────────────────────── */
          <>
            {/* Search bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                placeholder="Search elements, tools, icons, docs…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
              />
              <kbd style={{
                fontSize: 10, color: 'var(--text-muted)',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '2px 5px', fontFamily: 'DM Mono, monospace',
                flexShrink: 0,
              }}>Esc</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
              {results.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  {query ? 'No results' : 'Type to search elements, tools, icons or docs'}
                </div>
              )}
              {results.map((row, i) => {
                const { bg, accent, label: kindLabel } = SECTION_COLORS[row.kind];
                const isActive = i === cursor;
                return (
                  <div
                    key={row.id}
                    data-active={isActive}
                    onClick={row.action}
                    onMouseEnter={() => setCursor(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: isActive ? 'var(--accent-dim)' : 'transparent',
                      borderLeft: `3px solid ${isActive ? accent : 'transparent'}`,
                      transition: 'background 0.06s',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: accent, fontWeight: 700,
                    }}>
                      {row.kind === 'element' && row.color ? (
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: row.color, display: 'block', border: '1px solid rgba(0,0,0,0.15)' }} />
                      ) : row.kind === 'icon' && row.iconName ? (
                        <LucideIcon name={row.iconName} size={13} color={accent} />
                      ) : (
                        <span style={{ fontSize: row.kind === 'tool' ? 13 : 11 }}>
                          {row.kind === 'tool' ? row.icon :
                           row.kind === 'element' ? '◈' :
                           row.kind === 'doc' ? '§' : '?'}
                        </span>
                      )}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 500,
                        color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {row.label}
                      </div>
                      {row.hint && (
                        <div style={{
                          fontSize: 10.5, color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {row.hint}
                        </div>
                      )}
                    </div>

                    {/* Kind chip + doc chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: accent, background: bg,
                        padding: '2px 6px', borderRadius: 4,
                      }}>
                        {kindLabel}
                      </span>
                      {row.kind === 'doc' && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ color: 'var(--text-muted)' }}>
                          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 12, padding: '7px 14px',
              borderTop: '1px solid var(--border)', flexShrink: 0,
              fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace',
            }}>
              {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([key, hint]) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontSize: 9 }}>{key}</kbd>
                  {hint}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LucideIcon({ name, size = 14, color = 'currentColor' }) {
  const Icon = lucideIcons[name];
  if (!Icon) return null;
  return createElement(Icon, { width: size, height: size, strokeWidth: 2, color });
}
