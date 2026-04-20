import { useEffect, useRef } from 'react';
import docRaw from '../../doc.md?raw';

// ── Minimal markdown → JSX renderer ──────────────────────────────────────────

function parseInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length) {
    const codeIdx = remaining.indexOf('`');
    const boldIdx = remaining.indexOf('**');
    const tryCode = codeIdx !== -1 && (boldIdx === -1 || codeIdx <= boldIdx);
    const tryBold = boldIdx !== -1 && (codeIdx === -1 || boldIdx < codeIdx);

    if (tryCode) {
      const code = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
      if (code) {
        if (code[1]) parts.push(<span key={key++}>{code[1]}</span>);
        parts.push(<code key={key++} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontSize: '0.9em', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{code[2]}</code>);
        remaining = code[3];
        continue;
      }
    }
    if (tryBold) {
      const bold = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
      if (bold) {
        if (bold[1]) parts.push(<span key={key++}>{bold[1]}</span>);
        parts.push(<strong key={key++}>{bold[2]}</strong>);
        remaining = bold[3];
        continue;
      }
    }
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }
  return parts;
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  const nodes = [];
  let i = 0;
  let listItems = null;
  let tableRows = null;

  function flushList() {
    if (!listItems) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} style={{ margin: '6px 0 12px 16px', padding: 0, listStyle: 'disc' }}>
        {listItems.map((li, j) => (
          <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 2 }}>{parseInline(li)}</li>
        ))}
      </ul>
    );
    listItems = null;
  }

  function flushTable() {
    if (!tableRows) return;
    const [header, , ...body] = tableRows;
    const headers = header.split('|').map(c => c.trim()).filter(Boolean);
    nodes.push(
      <div key={`tbl-${nodes.length}`} style={{ overflowX: 'auto', margin: '8px 0 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {headers.map((h, j) => (
                <th key={j} style={{ padding: '6px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{parseInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => {
              const cells = row.split('|').map(c => c.trim()).filter(Boolean);
              return (
                <tr key={ri} style={{ background: ri % 2 ? 'var(--bg-surface)' : 'transparent' }}>
                  {cells.map((c, ci) => (
                    <td key={ci} style={{ padding: '5px 10px', border: '1px solid var(--border)', color: 'var(--text-secondary)', verticalAlign: 'top' }}>{parseInline(c)}</td>
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

    // Fenced code block
    if (line.startsWith('```')) {
      flushList(); flushTable();
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={`pre-${nodes.length}`} style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 14px', overflowX: 'auto',
          fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)',
          margin: '8px 0 16px', lineHeight: 1.6,
        }}>
          {lang && <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lang}</span>}
          {codeLines.join('\n')}
        </pre>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      flushList(); flushTable();
      nodes.push(<hr key={`hr-${nodes.length}`} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />);
      i++; continue;
    }

    // Headings — match deepest first to avoid false positives
    const h4 = line.match(/^#### (.+)/);
    if (h4) {
      flushList(); flushTable();
      nodes.push(<h4 key={`h4-${nodes.length}`} style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', margin: '16px 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{parseInline(h4[1])}</h4>);
      i++; continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      flushList(); flushTable();
      nodes.push(<h3 key={`h3-${nodes.length}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '20px 0 6px', letterSpacing: '-0.2px' }}>{parseInline(h3[1])}</h3>);
      i++; continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      flushList(); flushTable();
      nodes.push(<h2 key={`h2-${nodes.length}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '28px 0 8px', letterSpacing: '-0.3px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{parseInline(h2[1])}</h2>);
      i++; continue;
    }
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      flushList(); flushTable();
      nodes.push(<h1 key={`h1-${nodes.length}`} style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px', letterSpacing: '-0.4px' }}>{parseInline(h1[1])}</h1>);
      i++; continue;
    }

    // Table row
    if (line.startsWith('|')) {
      flushList();
      if (!tableRows) tableRows = [];
      tableRows.push(line);
      i++; continue;
    } else {
      flushTable();
    }

    // List item
    if (/^[-*] /.test(line)) {
      if (!listItems) listItems = [];
      listItems.push(line.slice(2));
      i++; continue;
    } else {
      flushList();
    }

    // Blank line
    if (!line.trim()) {
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={`p-${nodes.length}`} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 10px' }}>
        {parseInline(line)}
      </p>
    );
    i++;
  }

  flushList();
  flushTable();
  return nodes;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocsModal({ onClose }) {
  const scrollRef = useRef();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
      <div style={{
        width: '100%', maxWidth: 780, maxHeight: '90vh',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 14, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              Documentation
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>doc.md</span>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', borderRadius: 7, padding: '4px 10px',
            fontSize: 11, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ fontSize: 10 }}>ESC</span> Close
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 32px' }}>
          {renderMarkdown(docRaw)}
        </div>
      </div>
    </div>
  );
}
