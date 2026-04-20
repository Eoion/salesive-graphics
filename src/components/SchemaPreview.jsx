import { useState } from 'react';
import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';
import { buildSchema, applySchema } from '../lib/svgParser';

const TYPE_COLOR = {
  text:    '#60a5fa',
  image:   '#c084fc',
  color:   '#0D65D9',
  icon:    '#4ade80',
  boolean: '#f472b6',
  enum:    '#2dd4bf',
};

export default function SchemaPreview({ mappings, canvas, templateMeta, svgString, nodes }) {
  const [tab, setTab] = useState('schema');
  const [previewValues, setPreviewValues] = useState({});

  const fields = Object.values(mappings);
  const schema = buildSchema(templateMeta, fields, canvas);
  const json = JSON.stringify(schema, null, 2);

  const previewSvg = svgString && fields.length
    ? applySchema(svgString, schema, previewValues)
    : svgString;

  // Make SVG responsive: replace fixed pixel width/height so it scales to container
  function makeResponsive(svg) {
    if (!svg) return svg;
    return svg
      .replace(/(<svg[^>]*?)\s+width="\d+"/, '$1 width="100%"')
      .replace(/(<svg[^>]*?)\s+height="\d+"/, '$1');
  }

  const responsiveSvg = makeResponsive(previewSvg);

  function setVal(key, val) {
    setPreviewValues(v => ({ ...v, [key]: val }));
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0 }}>
        {[['schema', 'Schema JSON'], ['live', 'Preview & Form']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'Syne, sans-serif',
            color: tab === k ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.12s',
          }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => {
          const blob = new Blob([json], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${schema.templateId}.schema.json`;
          a.click();
        }} style={{
          margin: '6px 0', padding: '4px 12px', borderRadius: 6,
          background: 'var(--accent-dim)', border: '1px solid rgba(13,101,217,0.3)',
          color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 600,
        }}><DuotoneIcon svg={ICONS.download} size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: 'var(--accent)' }} />Download JSON</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {tab === 'schema' && (
          <div className="animate-fade" style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                {fields.length} mapped field{fields.length !== 1 ? 's' : ''} · {canvas?.width} × {canvas?.height}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fields.map(f => (
                  <div key={f.nodeId} style={{
                    padding: '3px 10px', borderRadius: 20,
                    background: `${TYPE_COLOR[f.fieldType] || '#fff'}18`,
                    border: `1px solid ${TYPE_COLOR[f.fieldType] || '#fff'}40`,
                    color: TYPE_COLOR[f.fieldType] || 'var(--text-secondary)',
                    fontSize: 11, fontFamily: 'DM Mono, monospace',
                  }}>
                    {f.fieldKey} <span style={{ opacity: 0.6 }}>· {f.fieldType}</span>
                  </div>
                ))}
              </div>
            </div>
            <pre style={{
              background: 'var(--bg-raised)', borderRadius: 10, padding: 16,
              border: '1px solid var(--border)', overflowX: 'auto',
              fontSize: 11, lineHeight: 1.7, color: 'var(--text-secondary)',
              fontFamily: 'DM Mono, monospace', margin: 0,
            }}>
              <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(json) }} />
            </pre>
          </div>
        )}

        {tab === 'live' && (
          <div className="animate-fade" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Form — left */}
            <div style={{ width: 320, flexShrink: 0, overflow: 'auto', padding: 20, borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Sample Form
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {schema.fields.map(field => (
                  <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {field.label || field.key}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: `${TYPE_COLOR[field.type] || '#fff'}18`,
                        color: TYPE_COLOR[field.type] || 'var(--text-secondary)',
                        fontFamily: 'DM Mono, monospace',
                      }}>{field.type}</span>
                      {field.required && <span style={{ fontSize: 10, color: 'var(--red)' }}>required</span>}
                    </div>
                    {field.type === 'color' ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="color" value={previewValues[field.key] || field.default || '#000000'}
                          onChange={e => setVal(field.key, e.target.value)}
                          style={{ width: 36, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                          {previewValues[field.key] || field.default || '#000000'}
                        </span>
                      </div>
                    ) : field.type === 'boolean' ? (
                      <div style={{
                        width: 36, height: 20, borderRadius: 10,
                        background: (previewValues[field.key] ?? field.default) ? 'var(--accent)' : 'var(--bg-raised)',
                        border: '1px solid var(--border-strong)', position: 'relative', cursor: 'pointer',
                      }} onClick={() => setVal(field.key, !(previewValues[field.key] ?? field.default))}>
                        <div style={{
                          position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
                          background: '#fff', left: (previewValues[field.key] ?? field.default) ? 18 : 2,
                          transition: 'left 0.15s',
                        }} />
                      </div>
                    ) : field.type === 'enum' ? (
                      <select value={previewValues[field.key] || field.default || ''} onChange={e => setVal(field.key, e.target.value)}
                        style={{
                          background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                          borderRadius: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'DM Mono, monospace',
                        }}>
                        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={field.type === 'image' ? 'url' : 'text'}
                        value={previewValues[field.key] ?? (field.default || '')}
                        onChange={e => setVal(field.key, e.target.value)}
                        placeholder={`Enter ${field.type}…`}
                        maxLength={field.maxLength}
                        style={{
                          background: 'var(--bg-raised)', border: '1px solid var(--border)',
                          color: 'var(--text-primary)', borderRadius: 6, padding: '7px 10px',
                          fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Preview — right */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg-base)' }}>
              <div style={{
                maxWidth: 600, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                borderRadius: 8, overflow: 'hidden',
              }}
                dangerouslySetInnerHTML={{ __html: responsiveSvg }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      let cls = 'color:#60a5fa'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = 'color:#c084fc'; // key
        else cls = 'color:#4ade80'; // string
      } else if (/true|false/.test(match)) cls = 'color:#0D65D9';
      else if (/null/.test(match)) cls = 'color:#f472b6';
      return `<span style="${cls}">${match}</span>`;
    });
}
