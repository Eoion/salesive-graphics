import { useCallback, useEffect, useRef, useState } from 'react';
import { parseSVG, buildSchema } from './lib/svgParser';
import { useRoute } from './lib/useRoute';
import { updateSession, loadSession, clearSession, clearSessionKeys } from './lib/session';
import { auth, canvases } from './lib/api';
import LoginScreen from './components/LoginScreen.jsx';
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
import MobileOverlay from './components/MobileOverlay';
import { clearStoredEditorAiSession } from './editor/useEditorAgent.js';
import { uploadImageToStore } from './components/editor/EditorAiChat.jsx';
import { Toaster } from 'react-hot-toast';
import './index.css';

const THEME_KEY = 'salesive_theme';

function ignoreStorageError() {}

function getInitialTheme() {
  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  } catch (error) {
    ignoreStorageError(error);
  }
  return 'dark';
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export default function App() {
  const { mode, navigate, token: routeToken, error: routeError } = useRoute();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Sync Session Data ─────────────────────────────────────────────────────────
  const session = loadSession() || {};

  const [theme,        setTheme]        = useState(getInitialTheme);
  const [showPicker,   setShowPicker]   = useState(false);
  const [canvasSize,   setCanvasSize]   = useState(() => session.canvasSize || null);
  const [uploadedElements, setUploadedElements] = useState(null);
  const [editorDefsSeed, setEditorDefsSeed] = useState(null);
  const [pendingImageUploads, setPendingImageUploads] = useState([]);
  const [svgString,    setSvgString]    = useState(() => session.svgString || null);
  const [parsed,       setParsed]       = useState(() => session.svgString ? parseSVG(session.svgString) : null);
  const [selectedId,   setSelectedId]   = useState(null);
  const [mappings,     setMappings]     = useState(() => session.mappings || {});
  const [templateMeta, setTemplateMeta] = useState(() => session.templateMeta || { id: '', name: 'Untitled Template' });
  const [activeCanvasRecord, setActiveCanvasRecord] = useState(() => session.canvasRecord || null);
  const [savedCanvases, setSavedCanvases] = useState([]);
  const [savedCanvasesLoading, setSavedCanvasesLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Authentication Check ──────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      // 1. If we have a token in the URL (from Google callback)
      if (routeToken) {
        updateSession({ token: routeToken });
        // Clean URL search params
        window.history.replaceState({}, document.title, '/#/login');
      }

      // 2. Verify token with backend
      try {
        const session = loadSession();
        if (!session?.token) throw new Error('No token');
        
        const resp = await auth.verifyToken();
        const userData = resp.data.data.user;
        setUser(userData);
        
        // Persist user data in session as well
        updateSession({ user: userData });
        
        if (mode === 'login' || routeToken) {
          navigate('upload');
        }
      } catch {
        // Guest mode: no valid session. Let the user keep working locally
        // instead of forcing them to the login screen.
        setUser(null);
        clearSessionKeys(['token', 'user']);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [routeToken, mode, navigate]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    navigate('login');
  };

  const didRunInitialRedirectRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Redirect based on session if route is root ─────────────────────────────────
  useEffect(() => {
    if (didRunInitialRedirectRef.current) return;
    didRunInitialRedirectRef.current = true;

    if (mode === 'upload' && session.mode && session.mode !== 'upload') {
      if ((session.mode === 'editor' && session.canvasSize) || 
          (['mapping', 'preview'].includes(session.mode) && session.svgString)) {
        navigate(session.mode);
      }
    }
  }, [mode, navigate, session.canvasSize, session.mode, session.svgString]);

  // ── Persist to localStorage on state changes ──────────────────────────────────
  useEffect(() => {
    updateSession({
      mode,
      svgString,
      mappings,
      templateMeta,
      canvasSize,
      canvasRecord: activeCanvasRecord
        ? {
            _id: activeCanvasRecord._id,
            name: activeCanvasRecord.name,
            public: activeCanvasRecord.public,
            isDraft: activeCanvasRecord.isDraft,
            updatedAt: activeCanvasRecord.updatedAt,
          }
        : null,
    });
  }, [mode, svgString, mappings, templateMeta, canvasSize, activeCanvasRecord]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      ignoreStorageError(error);
    }
  }, [theme]);

  useEffect(() => {
    function onKeyDown(e) {
      if (isEditableTarget(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const refreshSavedCanvases = useCallback(async () => {
    if (!loadSession()?.token) return;

    setSavedCanvasesLoading(true);
    try {
      const response = await canvases.listMine();
      setSavedCanvases(response.data.data.canvases || []);
    } catch (error) {
      console.error('Failed to load saved canvases:', error);
    } finally {
      setSavedCanvasesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshSavedCanvases();
  }, [user, refreshSavedCanvases]);

  const handleDeleteCanvas = useCallback(async (canvas) => {
    if (!canvas?._id) return;

    await canvases.deleteCanvas(canvas._id);
    setSavedCanvases((current) => current.filter((item) => item._id !== canvas._id));

    if (activeCanvasRecord?._id === canvas._id) {
      setActiveCanvasRecord(null);
      clearSessionKeys(['canvasRecord']);
    }

    await refreshSavedCanvases();
  }, [activeCanvasRecord?._id, refreshSavedCanvases]);

  function seedEditorStorage(elements = [], defs = {}, groups = {}) {
    try {
      localStorage.setItem('salesive_editor', JSON.stringify(elements));
      localStorage.setItem('salesive_defs', JSON.stringify(defs));
      localStorage.setItem('salesive_editor_groups', JSON.stringify(groups || {}));
    } catch (error) {
      ignoreStorageError(error);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleUpload(svgText, filename) {
    localStorage.removeItem('salesive_editor_viewport');
    localStorage.removeItem('salesive_editor_groups');
    const { elements, canvasSize: cs } = parseSVGToElements(svgText);
    setCanvasSize(cs);
    setUploadedElements(elements);
    setEditorDefsSeed({});
    setActiveCanvasRecord(null);
    setPendingImageUploads([]);
    setTemplateMeta({
      id:   filename.replace(/\.svg$/, '').replace(/[^a-z0-9]/gi, '-'),
      name: filename.replace(/\.svg$/, ''),
    });

    // Best-effort localStorage backup (may fail for large SVGs with embedded images)
    try {
      localStorage.setItem('salesive_editor', JSON.stringify(elements));
      localStorage.setItem('salesive_defs', JSON.stringify({}));
    } catch (error) {
      ignoreStorageError(error);
    }

    navigate('editor');

    // Upload base64 images in the background; patch elements as each resolves
    const base64Images = elements.filter(
      el => el.type === 'image' && typeof el.href === 'string' && el.href.startsWith('data:')
    );
    for (const el of base64Images) {
      const mime = el.href.match(/^data:([^;]+);/)?.[1] || 'image/png';
      const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      fetch(el.href)
        .then(r => r.blob())
        .then(blob => uploadImageToStore(blob, `${el.id || 'image'}.${ext}`))
        .then(url => { if (url) setPendingImageUploads(prev => [...prev, { id: el.id, url }]); })
        .catch(() => {});
    }
  }

  function handleOpenSavedCanvas(canvas) {
    const isOwnedCanvas = !canvas?.user?._id || canvas.user._id === user?._id;
    const nextCanvasSize = canvas.canvasSize || { width: 800, height: 600 };
    setCanvasSize(nextCanvasSize);
    setUploadedElements(Array.isArray(canvas.elements) ? canvas.elements : []);
    setEditorDefsSeed(canvas.defs || {});
    setPendingImageUploads([]);
    setSvgString(canvas.svg || null);
    setParsed(canvas.svg ? parseSVG(canvas.svg) : null);
    setMappings({});
    setSelectedId(null);
    setTemplateMeta({
      id: isOwnedCanvas ? canvas._id : '',
      name: isOwnedCanvas ? (canvas.name || 'Untitled Template') : `${canvas.name || 'Untitled Template'} Copy`,
    });
    setActiveCanvasRecord(isOwnedCanvas ? canvas : null);
    seedEditorStorage(Array.isArray(canvas.elements) ? canvas.elements : [], canvas.defs || {}, canvas.groups || {});
    localStorage.removeItem('salesive_editor_viewport');
    navigate('editor');
  }

  function handleEditorFinish(svgText) {
    setUploadedElements(null);
    setPendingImageUploads([]);
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
    clearSessionKeys(['mode', 'svgString', 'mappings', 'templateMeta', 'canvasSize', 'canvasRecord']);
    updateSession({
      mode: 'upload',
      svgString: null,
      mappings: {},
      templateMeta: { id: '', name: 'Untitled Template' },
      canvasSize: null,
      canvasRecord: null,
    });
    clearStoredEditorAiSession();
    setUploadedElements(null);
    setEditorDefsSeed(null);
    setActiveCanvasRecord(null);
    setPendingImageUploads([]);
    localStorage.removeItem('salesive_editor');
    localStorage.removeItem('salesive_defs');
    localStorage.removeItem('salesive_editor_groups');
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
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontSize: '13px',
            fontFamily: 'Syne, sans-serif',
            borderRadius: '10px',
            padding: '10px 16px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(8px)',
          },
          success: { iconTheme: { primary: 'var(--green)', secondary: '#fff' } },
          error: { iconTheme: { primary: 'var(--red)', secondary: '#fff' } },
        }}
      />
      {isMobile && <MobileOverlay />}

      <TopBar
        mode={mode}
        templateName={templateMeta.name}
        onNameChange={name => setTemplateMeta(m => ({ ...m, name }))}
        onExport={handleExport}
        onNewProject={handleNewProject}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        user={user}
        onLogout={handleLogout}
      />

      {/* Auth Guard for other screens */}
      {authLoading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loader" style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!authLoading && mode === 'login' && <LoginScreen error={routeError} />}

      {/* Main Apps - available to signed-in users and guests (guests save locally) */}
      {!authLoading && mode !== 'login' && (
        <>
          {/* Upload */}
          {mode === 'upload' && (
            <>
              <UploadScreen
                onUpload={handleUpload}
                onNewCanvas={() => setShowPicker(true)}
                savedCanvases={savedCanvases}
                savedCanvasesLoading={savedCanvasesLoading}
                onOpenCanvas={handleOpenSavedCanvas}
                onRefreshCanvases={refreshSavedCanvases}
                onDeleteCanvas={handleDeleteCanvas}
              />
              {showPicker && (
                <CanvasSizePicker
                  onClose={() => setShowPicker(false)}
                  onCreate={size => {
                    localStorage.removeItem('salesive_editor_viewport');
                    localStorage.removeItem('salesive_editor');
                    localStorage.removeItem('salesive_defs');
                    localStorage.removeItem('salesive_editor_groups');
                    setCanvasSize(size);
                    setUploadedElements([]);
                    setEditorDefsSeed({});
                    setActiveCanvasRecord(null);
                    setPendingImageUploads([]);
                    setTemplateMeta({ id: '', name: 'Untitled Template' });
                    setShowPicker(false);
                    navigate('editor');
                  }}
                />
              )}
            </>
          )}

          {/* Editor — used for both new canvas AND uploaded SVGs */}
          {mode === 'editor' && canvasSize && (
            <EditorScreen
              isGuest={!user}
              canvasSize={canvasSize}
              onCanvasResize={setCanvasSize}
              onFinish={handleEditorFinish}
              initialElements={uploadedElements}
              initialDefs={editorDefsSeed || {}}
              canvasRecord={activeCanvasRecord}
              templateName={templateMeta.name}
              onNameChange={name => setTemplateMeta(m => ({ ...m, name }))}
              onCanvasRecordChange={(canvas) => {
                setActiveCanvasRecord(canvas);
                setTemplateMeta((meta) => ({ ...meta, id: canvas?._id || meta.id, name: canvas?.name || meta.name }));
              }}
              onCanvasesRefresh={refreshSavedCanvases}
              pendingImageUploads={pendingImageUploads}
            />
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
        </>
      )}
    </div>
  );
}
