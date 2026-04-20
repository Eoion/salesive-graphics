import { useState, useEffect } from 'react';
import DuotoneIcon from './DuotoneIcon.jsx';
import { ICONS } from '../editor/duotoneIcons.js';

const FIELD_TYPES = [
  { value: 'text',     label: 'Text',          icon: 'T',  desc: 'Single-line text' },
  { value: 'image',    label: 'Image',         icon: 'I',  desc: 'Swappable image' },
  { value: 'color',    label: 'Color',         icon: '●',  desc: 'Fill / stroke color' },
  { value: 'icon',     label: 'Icon',          icon: '⬡',  desc: 'Icon slot' },
  { value: 'boolean',  label: 'Toggle',        icon: '⦿',  desc: 'Show / hide' },
  { value: 'enum',     label: 'Variant',       icon: '≡',  desc: 'Choose from options' },
];

const IMAGE_FIT = ['cover', 'contain', 'stretch'];

function FieldTypeBtn({ type, selected, onClick }) {
  return (
    <button onClick={() => onClick(type.value)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: selected ? 'var(--accent-dim)' : 'var(--bg-raised)',
        outline: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        transition: 'all 0.12s', flex: 1,
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.outlineColor = 'var(--border-strong)'; }}}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.outlineColor = 'var(--border)'; }}}>
      <span style={{ fontSize: 16, color: selected ? 'var(--accent)' : 'var(--text-secondary)' }}>{type.icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text-secondary)' }}>{type.label}</span>
    </button>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 6, padding: '6px 10px',
          fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none',
          transition: 'border-color 0.15s', ...style,
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}
      />
    </label>
  );
}

export default function FieldMapper({ node, existingMapping, onSave, onRemove, onClose }) {
  const [fieldType,    setFieldType]    = useState('text');
  const [fieldKey,     setFieldKey]     = useState('');
  const [label,        setLabel]        = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [maxLength,    setMaxLength]    = useState('');
  const [autoShrink,   setAutoShrink]   = useState(false);
  const [minFontSize,  setMinFontSize]  = useState('');
  const [imageFit,     setImageFit]     = useState('cover');
  const [required,     setRequired]     = useState(false);
  const [enumOpts,     setEnumOpts]     = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (existingMapping) {
      setFieldType(existingMapping.fieldType || 'text');
      setFieldKey(existingMapping.fieldKey || '');
      setLabel(existingMapping.label || '');
      setDefaultValue(existingMapping.defaultValue || '');
      setMaxLength(existingMapping.maxLength || '');
      setAutoShrink(existingMapping.autoShrink || false);
      setMinFontSize(existingMapping.minFontSize || '');
      setImageFit(existingMapping.imageFit || 'cover');
      setRequired(existingMapping.required || false);
      setEnumOpts((existingMapping.enumOptions || []).join(', '));
      setDescription(existingMapping.description || '');
    } else {
      const guessType = node.type === 'image' ? 'image' : node.type === 'color' ? 'color' : node.type === 'icon' ? 'icon' : 'text';
      setFieldType(guessType);
      const rawId = node.rawId || node.id;
      const key = rawId.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
      setFieldKey(key);
      setLabel('');
      setDefaultValue(node.text || node.fill || '');
      setMaxLength(''); setAutoShrink(false); setMinFontSize('');
      setImageFit('cover'); setRequired(false); setEnumOpts(''); setDescription('');
    }
  }, [node, existingMapping]);

  function handleSave() {
    if (!fieldKey.trim()) return;
    onSave({
      nodeId:       node.id,
      fieldType,
      fieldKey:     fieldKey.trim(),
      label:        label.trim() || fieldKey.trim(),
      defaultValue: defaultValue.trim(),
      maxLength:    maxLength ? parseInt(maxLength) : undefined,
      autoShrink,
      minFontSize:  minFontSize ? parseInt(minFontSize) : undefined,
      imageFit,
      required,
      enumOptions:  enumOpts ? enumOpts.split(',').map(s => s.trim()).filter(Boolean) : [],
      description:  description.trim(),
    });
  }

  if (!node) return null;

  return (
    <div className="animate-fade" style={{
      width: 280, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Field Mapper</div>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>#{node.rawId || node.id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}><DuotoneIcon svg={ICONS.close} size={14} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Node info */}
        <div style={{ background: 'var(--bg-raised)', borderRadius: 8, padding: '8px 10px', marginBottom: 14,
          border: '1px solid var(--border)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>tag</span>
            <span style={{ color: 'var(--blue)' }}>&lt;{node.tag}&gt;</span>
          </div>
          {node.text  && <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}><span style={{ color: 'var(--text-muted)' }}>text</span><span style={{ color: 'var(--green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{node.text}"</span></div>}
          {node.fill  && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>fill</span><div style={{ width: 10, height: 10, borderRadius: 2, background: node.fill }} /><span style={{ color: 'var(--text-secondary)' }}>{node.fill}</span></div>}
          {node.href  && <div style={{ display: 'flex', gap: 6 }}><span style={{ color: 'var(--text-muted)' }}>href</span><span style={{ color: 'var(--purple)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>…{node.href.slice(-20)}</span></div>}
        </div>

        {/* Field type */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Field Type</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {FIELD_TYPES.map(t => <FieldTypeBtn key={t.value} type={t} selected={fieldType === t.value} onClick={setFieldType} />)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input label="Field Key" value={fieldKey} onChange={setFieldKey} placeholder="e.g. headline" />
          <Input label="Display Label" value={label} onChange={setLabel} placeholder="e.g. Headline Text" />
          <Input label="Default Value" value={defaultValue} onChange={setDefaultValue} placeholder="Default…" />
          <Input label="Description" value={description} onChange={setDescription} placeholder="Notes about this field…" />

          {fieldType === 'text' && (
            <>
              <Input label="Max Characters" value={maxLength} onChange={setMaxLength} placeholder="40" type="number" />
              <div style={{ display: 'flex', gap: 8 }}>
                <Input label="Min Font Size" value={minFontSize} onChange={setMinFontSize} placeholder="16" type="number" style={{ flex: 1 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div style={{
                  width: 32, height: 18, borderRadius: 9, background: autoShrink ? 'var(--accent)' : 'var(--bg-raised)',
                  border: `1px solid ${autoShrink ? 'var(--accent)' : 'var(--border-strong)'}`,
                  position: 'relative', transition: 'all 0.15s', cursor: 'pointer', flexShrink: 0,
                }} onClick={() => setAutoShrink(v => !v)}>
                  <div style={{
                    position: 'absolute', top: 2, left: autoShrink ? 14 : 2,
                    width: 12, height: 12, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.15s',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Auto-shrink font</span>
              </label>
            </>
          )}

          {fieldType === 'image' && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Image Fit</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {IMAGE_FIT.map(f => (
                  <button key={f} onClick={() => setImageFit(f)} style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    background: imageFit === f ? 'var(--accent-dim)' : 'var(--bg-raised)',
                    color: imageFit === f ? 'var(--accent)' : 'var(--text-muted)',
                    outline: imageFit === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  }}>{f}</button>
                ))}
              </div>
            </div>
          )}

          {fieldType === 'enum' && (
            <Input label="Options (comma-separated)" value={enumOpts} onChange={setEnumOpts} placeholder="light, dark, vibrant" />
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{
              width: 32, height: 18, borderRadius: 9, background: required ? 'var(--accent)' : 'var(--bg-raised)',
              border: `1px solid ${required ? 'var(--accent)' : 'var(--border-strong)'}`,
              position: 'relative', transition: 'all 0.15s', cursor: 'pointer', flexShrink: 0,
            }} onClick={() => setRequired(v => !v)}>
              <div style={{
                position: 'absolute', top: 2, left: required ? 14 : 2,
                width: 12, height: 12, borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s',
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Required field</span>
          </label>
        </div>
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        {existingMapping && (
          <button onClick={onRemove} style={{
            flex: 0, padding: '7px 12px', borderRadius: 7,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>Remove</button>
        )}
        <button onClick={handleSave} disabled={!fieldKey.trim()} style={{
          flex: 1, padding: '7px 14px', borderRadius: 7,
          background: fieldKey.trim() ? 'var(--accent)' : 'var(--bg-raised)',
          border: 'none', color: fieldKey.trim() ? '#fff' : 'var(--text-muted)',
          fontSize: 12, cursor: fieldKey.trim() ? 'pointer' : 'default',
          fontFamily: 'Syne, sans-serif', fontWeight: 600, transition: 'all 0.15s',
        }}>{existingMapping ? 'Update Field' : 'Map Field'}</button>
      </div>
    </div>
  );
}
