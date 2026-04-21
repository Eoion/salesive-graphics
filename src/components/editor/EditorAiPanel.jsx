import { useEffect, useMemo, useRef, useState } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';

const TOOL_LABELS = {
  get_snapshot: 'Inspect canvas',
  get_selected_elements: 'Get selected layers',
  get_canvas_screenshot: 'Capture screenshot',
  select_elements: 'Select layers',
  update_elements: 'Update layers',
  delete_elements: 'Delete layers',
  add_elements: 'Add layers',
  insert_svg: 'Insert SVG',
  replace_defs: 'Replace defs',
  'editor.get_snapshot': 'Inspect canvas',
  'editor.get_selected_elements': 'Get selected layers',
  'editor.get_canvas_screenshot': 'Capture screenshot',
  'editor.select_elements': 'Select layers',
  'editor.update_elements': 'Update layers',
  'editor.delete_elements': 'Delete layers',
  'editor.add_elements': 'Add layers',
  'editor.insert_svg': 'Insert SVG',
  'editor.replace_defs': 'Replace defs',
};

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getToolLabel(tool) {
  return TOOL_LABELS[tool] || tool || 'Tool action';
}

function serializeResult(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.startsWith('data:image/')
      ? `[image data URL ${Math.round(value.length / 1024)}KB]`
      : value;
  }
  try {
    return JSON.stringify(redactImageDataUrls(value), null, 2);
  } catch {
    return String(value);
  }
}

function redactImageDataUrls(value) {
  if (Array.isArray(value)) return value.map(redactImageDataUrls);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key === 'dataUrl' && typeof entry === 'string' && entry.startsWith('data:image/')) {
        return [key, `[image data URL ${Math.round(entry.length / 1024)}KB]`];
      }
      return [key, redactImageDataUrls(entry)];
    }),
  );
}

function safeHref(href) {
  const trimmed = String(href || '').trim();
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed;
  return undefined;
}

function renderInlineMarkdown(text, keyPrefix) {
  const parts = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let matchIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${matchIndex++}`;

    if (token.startsWith('`')) {
      parts.push(
        <code key={key} style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '1px 4px',
          color: 'var(--accent)',
          fontSize: 11,
          fontFamily: 'DM Mono, monospace',
        }}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      parts.push(
        <strong key={key} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {renderInlineMarkdown(token.slice(2, -2), `${key}-strong`)}
        </strong>
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = safeHref(linkMatch?.[2]);
      parts.push(href ? (
        <a
          key={key}
          href={href}
          target={href.startsWith('#') || href.startsWith('/') ? undefined : '_blank'}
          rel={href.startsWith('#') || href.startsWith('/') ? undefined : 'noopener noreferrer'}
          style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          {renderInlineMarkdown(linkMatch[1], `${key}-link`)}
        </a>
      ) : token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function MarkdownContent({ content }) {
  const lines = String(content || '').split(/\r?\n/);
  const blocks = [];
  let index = 0;
  let blockIndex = 0;

  const isListLine = (line) => /^(\s*)([-*]|\d+\.)\s+/.test(line);
  const isHeadingLine = (line) => /^#{1,4}\s+/.test(line);
  const isQuoteLine = (line) => /^>\s?/.test(line);

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      blocks.push(
        <pre key={`code-${blockIndex++}`} style={{
          margin: '6px 0',
          padding: '9px 10px',
          borderRadius: 6,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 10,
          lineHeight: 1.5,
          overflowX: 'auto',
          fontFamily: 'DM Mono, monospace',
          whiteSpace: 'pre-wrap',
        }}>
          {lang && (
            <div style={{
              color: 'var(--text-muted)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              {lang}
            </div>
          )}
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <div key={`heading-${blockIndex++}`} style={{
          margin: blocks.length ? '8px 0 4px' : '0 0 4px',
          color: 'var(--text-primary)',
          fontSize: level <= 2 ? 13 : 12,
          fontWeight: 700,
          lineHeight: 1.35,
        }}>
          {renderInlineMarkdown(heading[2], `heading-${blockIndex}`)}
        </div>
      );
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${blockIndex++}`} style={{
          margin: '4px 0 6px',
          paddingLeft: 18,
          color: 'var(--text-primary)',
          fontSize: 12,
          lineHeight: 1.55,
        }}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} style={{ marginBottom: 2 }}>
              {renderInlineMarkdown(item, `ul-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${blockIndex++}`} style={{
          margin: '4px 0 6px',
          paddingLeft: 18,
          color: 'var(--text-primary)',
          fontSize: 12,
          lineHeight: 1.55,
        }}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} style={{ marginBottom: 2 }}>
              {renderInlineMarkdown(item, `ol-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (isQuoteLine(line)) {
      const quoteLines = [];
      while (index < lines.length && isQuoteLine(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${blockIndex++}`} style={{
          margin: '6px 0',
          padding: '6px 9px',
          borderLeft: '2px solid var(--accent)',
          background: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          lineHeight: 1.55,
        }}>
          {renderInlineMarkdown(quoteLines.join(' '), `quote-${blockIndex}`)}
        </blockquote>
      );
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('```') &&
      !isHeadingLine(lines[index]) &&
      !isListLine(lines[index]) &&
      !isQuoteLine(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`p-${blockIndex++}`} style={{
        margin: blocks.length ? '6px 0 0' : 0,
        color: 'var(--text-primary)',
        fontSize: 12,
        lineHeight: 1.6,
        wordBreak: 'break-word',
      }}>
        {renderInlineMarkdown(paragraphLines.join(' '), `p-${blockIndex}`)}
      </p>
    );
  }

  return <div>{blocks}</div>;
}

function StatusChip({ isConfigured, isConnecting, isStreaming, isAgentDone }) {
  const config = !isConfigured
    ? { label: 'Config required', tone: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)', color: '#fbbf24' } }
    : isConnecting
      ? { label: 'Connecting', tone: { bg: 'var(--bg-raised)', border: 'var(--border)', color: 'var(--text-secondary)' } }
      : (isStreaming || !isAgentDone)
        ? { label: 'Working', tone: { bg: 'var(--accent-dim)', border: 'rgba(13,101,217,0.26)', color: 'var(--accent)' } }
        : { label: 'Ready', tone: { bg: 'var(--bg-raised)', border: 'var(--border)', color: 'var(--text-secondary)' } };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      borderRadius: 999,
      border: `1px solid ${config.tone.border}`,
      background: config.tone.bg,
      color: config.tone.color,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontFamily: 'DM Mono, monospace',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'currentColor',
        boxShadow: isStreaming || !isAgentDone ? '0 0 0 4px var(--accent-dim)' : 'none',
      }} />
      {config.label}
    </span>
  );
}

function EmptyState({ isConfigured }) {
  const prompts = [
    'Move the headline 24px down and center it',
    'Change all blue fills to a warmer red tone',
    'Insert this SVG icon near the top-right corner',
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '14px 14px 18px',
      margin: 'auto 0 0',
    }}>
      <div style={{
        borderRadius: 10,
        padding: '14px 14px 13px',
        border: '1px solid var(--border)',
        background: 'var(--bg-raised)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: '1px solid rgba(13,101,217,0.24)',
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            <DuotoneIcon svg={ICONS.ai} size={14} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
              Editor Assistant
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              AI actions for this canvas
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
          Use plain instructions for layer changes, color updates, spacing fixes, and SVG insertions. Supported tool actions are applied directly to the editor.
        </p>
      </div>

      <div style={{
        borderRadius: 10,
        border: '1px dashed var(--border-strong)',
        background: 'var(--bg-surface)',
        padding: '12px 13px',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>
          Try prompts
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {prompts.map((prompt) => (
            <div key={prompt} style={{
              padding: '8px 9px',
              borderRadius: 7,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
              fontFamily: 'DM Mono, monospace',
            }}>
              {prompt}
            </div>
          ))}
        </div>
      </div>

      {!isConfigured && (
        <div style={{
          borderRadius: 8,
          border: '1px solid rgba(245,158,11,0.22)',
          background: 'rgba(245,158,11,0.1)',
          padding: '10px 11px',
          fontSize: 11,
          color: '#fbbf24',
          lineHeight: 1.55,
        }}>
          Add <code style={{ fontFamily: 'DM Mono, monospace' }}>VITE_EDITOR_AI_URL</code> to enable live chat and tool execution.
        </div>
      )}
    </div>
  );
}

function ToolCallMessage({ message }) {
  const preview = serializeResult(message.error || message.result);
  const tone = message.status === 'error'
    ? {
        border: 'rgba(239,68,68,0.24)',
        background: 'rgba(239,68,68,0.08)',
        color: 'var(--red)',
      }
    : message.status === 'done'
      ? {
          border: 'rgba(13,101,217,0.24)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
        }
      : {
          border: 'var(--border)',
          background: 'var(--bg-raised)',
          color: 'var(--text-secondary)',
        };

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        maxWidth: '100%',
        width: '100%',
        borderRadius: 8,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        padding: '9px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tone.color,
            flexShrink: 0,
          }}>
            <DuotoneIcon svg={ICONS.ai} size={11} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
              {getToolLabel(message.tool)}
            </div>
            <div style={{ fontSize: 10, color: tone.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>
              {message.status === 'done' ? 'Applied' : message.status === 'error' ? 'Failed' : 'Running'}
            </div>
          </div>
        </div>
        {preview && (
          <pre style={{
            margin: 0,
            padding: '8px 9px',
            borderRadius: 6,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 120,
            overflow: 'auto',
            fontFamily: 'DM Mono, monospace',
          }}>
            {preview}
          </pre>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const content = message.content || (message.isStreaming ? 'Thinking…' : '');

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '100%',
        borderRadius: 8,
        padding: '10px 11px 9px',
        background: isUser ? 'var(--accent-dim)' : 'var(--bg-raised)',
        border: isUser ? '1px solid rgba(13,101,217,0.24)' : '1px solid var(--border)',
        color: isUser ? 'var(--accent)' : 'var(--text-primary)',
      }}>
        {isUser ? (
          <div style={{
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            opacity: message.isStreaming ? 0.96 : 1,
          }}>
            {content}
          </div>
        ) : (
          <div style={{ opacity: message.isStreaming ? 0.96 : 1 }}>
            <MarkdownContent content={content} />
          </div>
        )}
        <div style={{
          marginTop: 7,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          fontSize: 10,
          color: isUser ? 'var(--accent)' : 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          fontFamily: 'DM Mono, monospace',
        }}>
          <span>{isUser ? 'You' : 'AI'}</span>
          <span>{message.isStreaming ? 'Live' : formatTime(message.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function EditorAiPanel({
  draft,
  onDraftChange,
  messages,
  error,
  isConfigured,
  isConnecting,
  isStreaming,
  isAgentDone,
  onSend,
  onStop,
  onClear,
}) {
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);

  const canSend = draft.trim().length > 0 && isConfigured && !isConnecting && !isSending;
  const isWorking = isStreaming || !isAgentDone || isSending;

  const renderedMessages = useMemo(() => (
    messages.map((message) => (
      message.role === 'tool_call'
        ? <ToolCallMessage key={message.id || message.toolCallId} message={message} />
        : <ChatMessage key={message.id || message.createdAt} message={message} />
    ))
  ), [messages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, isStreaming, isSending]);

  async function handleSend() {
    if (!canSend) return;
    setIsSending(true);
    try {
      const didSend = await onSend(draft);
      if (didSend) onDraftChange('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside style={{
      width: 280,
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0,
            }}>
              <DuotoneIcon svg={ICONS.ai} size={14} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                Right Sidebar
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1 }}>
                Editor AI
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Canvas-aware assistant for SVG edits.
              </div>
            </div>
          </div>
          <StatusChip
            isConfigured={isConfigured}
            isConnecting={isConnecting}
            isStreaming={isStreaming}
            isAgentDone={isAgentDone}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onStop}
            disabled={!isWorking}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: isWorking ? 'var(--bg-raised)' : 'transparent',
              color: isWorking ? 'var(--text-secondary)' : 'var(--text-muted)',
              cursor: isWorking ? 'pointer' : 'default',
              opacity: isWorking ? 1 : 0.5,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Syne, sans-serif',
            }}
          >
            Stop
          </button>
          <button
            onClick={onClear}
            disabled={!messages.length}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: messages.length ? 'var(--bg-raised)' : 'transparent',
              color: messages.length ? 'var(--text-secondary)' : 'var(--text-muted)',
              cursor: messages.length ? 'pointer' : 'default',
              opacity: messages.length ? 1 : 0.5,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Syne, sans-serif',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: messages.length ? '12px' : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {messages.length ? renderedMessages : <EmptyState isConfigured={isConfigured} />}
      </div>

      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '10px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--bg-surface)',
      }}>
        {error && (
          <div style={{
            borderRadius: 6,
            padding: '8px 9px',
            background: 'rgba(239,68,68,0.09)',
            border: '1px solid rgba(239,68,68,0.2)',
            fontSize: 11,
            color: 'var(--red)',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <div style={{
          position: 'relative',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-raised)',
          padding: 8,
        }}>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={isConfigured ? 'Ask for a canvas change or layer edit…' : 'Set VITE_EDITOR_AI_URL to enable chat…'}
            disabled={!isConfigured}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none',
              fontSize: 12,
              lineHeight: 1.6,
              minHeight: 68,
              fontFamily: 'inherit',
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            paddingTop: 8,
            borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>
              {isConfigured ? 'Tool-enabled canvas chat' : 'Environment setup needed'}
            </span>
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                minWidth: 74,
                height: 28,
                borderRadius: 6,
                border: `1px solid ${canSend ? 'rgba(13,101,217,0.28)' : 'var(--border)'}`,
                padding: '0 14px',
                background: canSend ? 'var(--accent-dim)' : 'transparent',
                color: canSend ? 'var(--accent)' : 'var(--text-muted)',
                cursor: canSend ? 'pointer' : 'default',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'Syne, sans-serif',
              }}
            >
              {isSending ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
