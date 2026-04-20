import { useState, useEffect } from 'react';
import { parseSVG, buildSchema } from './lib/svgParser';
import { useRoute } from './lib/useRoute';
import { saveSession, loadSession, clearSession } from './lib/session';
import { parseSVGToElements } from './editor/parseSVGToElements';
import DuotoneIcon from './components/DuotoneIcon';
import { ICONS } from './editor/duotoneIcons';
import TopBar from './components/TopBar';
import UploadScreen from './components/UploadScreen';
import LayerInspector from './components/LayerInspector';
import SVGCanvas from './components/SVGCanvas';
import FieldMapper from './components/FieldMapper';
import SchemaPreview from './components/SchemaPreview';
import CanvasSizePicker from './components/editor/CanvasSizePicker.jsx';
import EditorScreen from './components/editor/EditorScreen.jsx';
import './index.css';

export default function App() {
  const { mode, navigate } = useRoute();

  // ── Sync Session Data ─────────────────────────────────────────────────────────
  const session = loadSession() || {};

  const [showPicker,   setShowPicker]   = useState(false);
  const [canvasSize,   setCanvasSize]   = useState(() => session.canvasSize || null);
  const [svgString,    setSvgString]    = useState(() => session.svgString || null);
  const [parsed,       setParsed]       = useState(() => session.svgString ? parseSVG(session.svgString) : null);
  const [selectedId,   setSelectedId]   = useState(null);
  const [mappings,     setMappings]     = useState(() => session.mappings || {});
  const [templateMeta, setTemplateMeta] = useState(() => session.templateMeta || { id: '', name: 'Untitled Template' });

  // ── Redirect based on session if route is root ─────────────────────────────────
  useEffect(() => {
    if (mode === 'upload' && session.mode && session.mode !== 'upload') {
      if ((session.mode === 'editor' && session.canvasSize) || 
          (['mapping', 'preview'].includes(session.mode) && session.svgString)) {
        navigate(session.mode);
      }
    }
  }, []); // Only on mount

  // ── Persist to localStorage on state changes ──────────────────────────────────
  useEffect(() => {
    saveSession({ mode, svgString, mappings, templateMeta, canvasSize });
  }, [mode, svgString, mappings, templateMeta, canvasSize]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleUpload(svgText, filename) {
    localStorage.removeItem('salesive_editor_viewport');
    const { elements, canvasSize: cs } = parseSVGToElements(svgText);
    setCanvasSize(cs);
    setTemplateMeta({
      id:   filename.replace(/\.svg$/, '').replace(/[^a-z0-9]/gi, '-'),
      name: filename.replace(/\.svg$/, ''),
    });

    // Store elements into editor localStorage so EditorScreen picks them up
    try { localStorage.setItem('salesive_editor', JSON.stringify(elements)); } catch {}

    navigate('editor');
  }

  function handleEditorFinish(svgText) {
    const result = parseSVG(svgText);
    setSvgString(svgText);
    setParsed(result);
    setMappings({});
    setSelectedId(null);
    navigate('mapping');
  }

  function handleSelectNode(id) {
    setSelectedId(prev => prev === id ? null : id);
  }

  function handleSaveMapping(config) {
    setMappings(prev => ({ ...prev, [config.nodeId]: config }));
    setSelectedId(null);
  }

  function handleRemoveMapping(nodeId) {
    setMappings(prev => { const n = { ...prev }; delete n[nodeId]; return n; });
    setSelectedId(null);
  }

  function handleExport() {
    const schema = buildSchema(templateMeta, Object.values(mappings), parsed?.canvas);
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${schema.templateId || 'template'}.schema.json`;
    a.click();
  }

  function handleNewProject() {
    clearSession();
    localStorage.removeItem('salesive_editor');
    localStorage.removeItem('salesive_editor_viewport');
    setSvgString(null);
    setParsed(null);
    setMappings({});
    setSelectedId(null);
    setTemplateMeta({ id: '', name: 'Untitled Template' });
    setCanvasSize(null);
    navigate('upload');
  }

  const selectedNode = parsed?.nodes.find(n => n.id === selectedId);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <TopBar
        mode={mode}
        templateName={templateMeta.name}
        onNameChange={name => setTemplateMeta(m => ({ ...m, name }))}
        onExport={handleExport}
        onNewProject={handleNewProject}
        onNavigate={navigate}
      />

      {/* Upload */}
      {mode === 'upload' && (
        <>
          <UploadScreen onUpload={handleUpload} onNewCanvas={() => setShowPicker(true)} />
          {showPicker && (
            <CanvasSizePicker
              onClose={() => setShowPicker(false)}
              onCreate={size => { localStorage.removeItem('salesive_editor_viewport'); setCanvasSize(size); setShowPicker(false); navigate('editor'); }}
            />
          )}
        </>
      )}

      {/* Editor — used for both new canvas AND uploaded SVGs */}
      {mode === 'editor' && canvasSize && (
        <EditorScreen canvasSize={canvasSize} onFinish={handleEditorFinish} />
      )}

      {/* Mapping */}
      {mode === 'mapping' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <LayerInspector
            nodes={parsed?.nodes || []}
            selectedId={selectedId}
            mappings={mappings}
            onSelect={handleSelectNode}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <SVGCanvas
                svgString={svgString}
                nodes={parsed?.nodes || []}
                selectedId={selectedId}
                mappings={mappings}
                onSelectNode={handleSelectNode}
                leftActions={
                  <button onClick={() => navigate('editor')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 7,
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
                      fontFamily: 'Syne, sans-serif', fontWeight: 600,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <DuotoneIcon svg={ICONS.pencil} size={12} />
                    Back to Editor
                  </button>
                }
                rightActions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {Object.keys(mappings).length} mapped field{Object.keys(mappings).length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={() => navigate('preview')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 14px', borderRadius: 7,
                        background: 'var(--accent)', border: 'none',
                        color: '#fff', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                      }}>
                      Preview
                      <DuotoneIcon svg={ICONS.check} size={13} style={{ color: '#fff' }} />
                    </button>
                  </div>
                }
              />
            </div>
          </div>

          {selectedNode ? (
            <FieldMapper
              node={selectedNode}
              existingMapping={mappings[selectedId]}
              onSave={handleSaveMapping}
              onRemove={() => handleRemoveMapping(selectedId)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div style={{
              width: 280, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, flexShrink: 0,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DuotoneIcon svg={ICONS.select} size={20} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 160, margin: 0 }}>
                Click any element in the canvas or layer list to map it
              </p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, width: '80%' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                  Mapped fields
                </div>
                {Object.values(mappings).length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None yet</span>
                ) : (
                  Object.values(mappings).map(m => (
                    <div key={m.nodeId} onClick={() => setSelectedId(m.nodeId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px', borderRadius: 6,
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        cursor: 'pointer', transition: 'border-color 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fieldKey}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{m.fieldType}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {mode === 'preview' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Preview sub-bar */}
          <div style={{
            height: 36, padding: '0 14px', flexShrink: 0,
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <button onClick={() => navigate('mapping')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 7,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
                fontFamily: 'Syne, sans-serif', fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <DuotoneIcon svg={ICONS.layers} size={12} />
              Back to Mapping
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {Object.keys(mappings).length} field{Object.keys(mappings).length !== 1 ? 's' : ''} mapped
            </span>
          </div>
          <SchemaPreview
            mappings={mappings}
            canvas={parsed?.canvas}
            templateMeta={templateMeta}
            svgString={svgString}
            nodes={parsed?.nodes || []}
          />
        </div>
      )}
    </div>
  );
}
