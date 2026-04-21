import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import { TOOL_ACTIONS } from '../../editor/keymaps/photoshop.js';
import { useEditorState } from '../../editor/useEditorState.js';
import { useEditorInteractions } from '../../editor/useEditorInteractions.js';
import { useKeymap } from '../../editor/useKeymap.js';
import { useEditorDefs } from '../../editor/useEditorDefs.js';
import { useEditorAgent } from '../../editor/useEditorAgent.js';
import { serializeElements } from '../../editor/serializeElements.js';
import { parseSVGToElements } from '../../editor/parseSVGToElements.js';
import { addToCollection } from '../../lib/collection.js';
import { syncCounter, freshId } from '../../editor/editorConstants.js';
import EditorToolbar from './EditorToolbar.jsx';
import EditorCanvas from './EditorCanvas.jsx';
import EditorAiPanel from './EditorAiPanel.jsx';
import EditorPropertiesPanel from './EditorPropertiesPanel.jsx';
import KeymapSettings from './KeymapSettings.jsx';
import CollectionModal from './CollectionModal.jsx';
import PasteSVGModal from './PasteSVGModal.jsx';
import VariablesPanel from './VariablesPanel.jsx';
import CodeEditor from './CodeEditor.jsx';

const SCREENSHOT_MIME_TYPES = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function clampScreenshotDimension(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1024;
  return Math.min(Math.max(Math.round(numeric), 128), 2048);
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to render SVG screenshot.'));
    image.src = url;
  });
}

async function createCanvasScreenshot(svg, canvasSize, options = {}) {
  const format = options.format || 'png';
  const mimeType = SCREENSHOT_MIME_TYPES[format] || SCREENSHOT_MIME_TYPES.png;
  const maxDimension = clampScreenshotDimension(options.maxDimension);
  const quality = Number.isFinite(Number(options.quality)) ? Number(options.quality) : 0.92;
  const scale = Math.min(1, maxDimension / Math.max(canvasSize.width, canvasSize.height));
  const width = Math.max(1, Math.round(canvasSize.width * scale));
  const height = Math.max(1, Math.round(canvasSize.height * scale));
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImageFromUrl(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create screenshot canvas.');

    const background = options.background || (mimeType === 'image/jpeg' ? '#ffffff' : null);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(image, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL(mimeType, quality),
      mimeType,
      width,
      height,
      sourceWidth: canvasSize.width,
      sourceHeight: canvasSize.height,
      scale,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function EditorScreen({ canvasSize, onFinish }) {
  const [activeTool,   setActiveTool]   = useState('select');
  const [activeDock,   setActiveDock]   = useState('properties');
  const [showKeymap,   setShowKeymap]   = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showPasteSVG, setShowPasteSVG] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [codeEditElement, setCodeEditElement] = useState(null);
  const [aiDraft, setAiDraft] = useState('');
  const [snapEnabled,  setSnapEnabled]  = useState(false);
  const [zoomDisplay,  setZoomDisplay]  = useState(100);
  const [pickerMode,   setPickerMode]   = useState(false);

  const scaleRef              = useRef(1);
  const canvasRef             = useRef();
  const canvasCtrl            = useRef({});
  const eyedropperPrevIdRef   = useRef(null);

  const {
    elements,
    selectedId, selectedIds,
    setSelectedId, setPrimarySelectedId, setSelectedIds, toggleSelectedId,
    canUndo, canRedo, undo, redo,
    addElement, addElements, updateElementLive, updateElementsLive, updateElement, updateElements,
    snapshotBeforeLive, commitCurrent, deleteElement, deleteElements,
    bringForward, sendBackward,
    alignElement, reorderElement,
  } = useEditorState();

  const { defs, addGradient,
    addVariable, updateVariable, removeVariable,
    addKeyframe,
    addFont, removeFont, setDefsFromImport } = useEditorDefs();

  // Inject / remove loaded fonts in the document head whenever the font list changes
  useEffect(() => {
    const fonts = (defs.fonts || []).filter(font => typeof font?.name === 'string' && font.name.trim());
    const fontDomId = (name) => `font-inject-${name.trim().replace(/\s+/g, '-')}`;
    const activeIds = new Set(fonts.map(f => fontDomId(f.name)));

    // Remove DOM elements for fonts that were deleted
    document.head.querySelectorAll('[id^="font-inject-"]').forEach(el => {
      if (!activeIds.has(el.id)) el.remove();
    });

    // Add DOM elements for newly added fonts
    for (const font of fonts) {
      const domId = fontDomId(font.name);
      if (document.getElementById(domId)) continue;
      if (font.type === 'google') {
        const link = document.createElement('link');
        link.id = domId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.name)}:wght@400;700&display=swap`;
        document.head.appendChild(link);
      } else if (font.type === 'custom' && font.dataUrl) {
        const style = document.createElement('style');
        style.id = domId;
        style.textContent = `@font-face { font-family: '${font.name}'; src: url('${font.dataUrl}') format('${font.format || 'truetype'}'); }`;
        document.head.appendChild(style);
      }
    }
  }, [defs.fonts]);

  const { bindings, keymapName, matchAction, importKeymap, resetToDefault } = useKeymap();

  const { onElementPointerDown, onPointerMove, onPointerUp, onCanvasPointerDown } =
    useEditorInteractions({
      elements,
      selectedId, selectedIds,
      setSelectedId, setPrimarySelectedId, setSelectedIds, toggleSelectedId,
      updateElementLive, updateElementsLive,
      commitCurrent, snapshotBeforeLive,
      deleteElement, deleteElements, activeTool, addElement,
      onAfterAddElement: () => setActiveTool('select'),
      canvasRef, scaleRef, canvasSize,
      snapEnabled, gridSize: 8,
    });

  const handleSetActiveTool = useCallback((tool) => {
    if (tool === 'eyedropper') eyedropperPrevIdRef.current = selectedId;
    setActiveTool(tool);
  }, [selectedId]);

  const duplicateElements = useCallback(() => {
    if (!selectedIds.length) return;
    syncCounter(elements);
    const dupes = selectedIds
      .map(id => elements.find(e => e.id === id))
      .filter(Boolean)
      .map(el => ({ ...structuredClone(el), id: freshId(el.type), x: el.x + 10, y: el.y + 10 }));
    if (dupes.length) addElements(dupes);
  }, [addElements, elements, selectedIds]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setPickerMode(m => !m);
        return;
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateElements();
        return;
      }
      // Lock/unlock selected (Ctrl+L)
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'l') {
        if (selectedIds.length) {
          e.preventDefault();
          const hasUnlocked = selectedIds.some(id => !elements.find(el => el.id === id)?.locked);
          updateElements(selectedIds, { locked: hasUnlocked });
        }
        return;
      }
      // Save to collection (Ctrl+Shift+B)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        if (selectedIds.length) {
          e.preventDefault();
          handleSaveToCollection(elements.filter(el => selectedIds.includes(el.id)));
        }
        return;
      }
      // Edit text (F2 or Enter on text element)
      if ((e.key === 'F2' || e.key === 'Enter') && selectedIds.length === 1) {
        const el = elements.find(el => el.id === selectedId);
        if (el?.type === 'text') {
          e.preventDefault();
          canvasCtrl.current.textEdit?.(selectedId);
          return;
        }
      }
      if (e.key === 'Escape' && activeTool === 'eyedropper') {
        if (eyedropperPrevIdRef.current) setSelectedId(eyedropperPrevIdRef.current);
        setActiveTool('select');
        eyedropperPrevIdRef.current = null;
        return;
      }
      if (e.key === 'Escape' && pickerMode) {
        setPickerMode(false);
        return;
      }
      if (e.key === '0' || (e.ctrlKey && e.key === '0')) {
        e.preventDefault();
        canvasCtrl.current.fitViewport?.();
        return;
      }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); canvasCtrl.current.zoomIn?.(); return; }
      if (e.key === '-') { e.preventDefault(); canvasCtrl.current.zoomOut?.(); return; }

      // Backspace / Delete — delete (hardcoded alias so it works regardless of keymap)
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.length > 0) {
        e.preventDefault();
        deleteElements(selectedIds);
        return;
      }

      // Arrow key nudge
      if (selectedIds.length === 1 && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        const el = elements.find(el => el.id === selectedId);
        if (el && !el.locked) updateElement(selectedId, { x: el.x + dx, y: el.y + dy });
        return;
      }

      const action = matchAction(e);
      if (!action) return;

      if (TOOL_ACTIONS.includes(action)) { e.preventDefault(); handleSetActiveTool(action); return; }

      switch (action) {
        case 'undo':         e.preventDefault(); undo(); break;
        case 'redo':         e.preventDefault(); redo(); break;
        case 'delete':       if (selectedIds.length) { e.preventDefault(); deleteElements(selectedIds); } break;
        case 'selectAll':
          e.preventDefault();
          if (elements.length) setSelectedId(elements[elements.length - 1].id);
          break;
        case 'deselect':     setSelectedIds([]); break;
        case 'bringForward': if (selectedIds.length) bringForward(selectedId); break;
        case 'sendBackward': if (selectedIds.length) sendBackward(selectedId); break;
        case 'matchImageSize': {
          const imgEl = elements.find(el => el.id === selectedId);
          if (imgEl?.type === 'image' && imgEl.href) {
            e.preventDefault();
            const img = new Image();
            img.onload = () => {
              const nw = img.naturalWidth, nh = img.naturalHeight;
              const currentScale = Math.sqrt((imgEl.width / nw) * (imgEl.height / nh));
              const scales = [0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
              const snapped = scales.reduce((a, b) => Math.abs(b - currentScale) < Math.abs(a - currentScale) ? b : a);
              updateElement(selectedId, { width: Math.round(nw * snapped), height: Math.round(nh * snapped) });
            };
            img.src = imgEl.href;
          }
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeTool,
    bringForward,
    deleteElements,
    duplicateElements,
    elements,
    handleSetActiveTool,
    matchAction,
    pickerMode,
    redo,
    selectedId,
    selectedIds,
    sendBackward,
    setSelectedId,
    setSelectedIds,
    undo,
    updateElement,
    updateElements,
  ]);

  function handleEyedrop(targetId, isShift) {
    const sampled = elements.find(e => e.id === targetId);
    const prevId  = eyedropperPrevIdRef.current;
    const prevEl  = elements.find(e => e.id === prevId);
    if (sampled && prevEl) {
      updateElement(prevId, isShift ? { stroke: sampled.stroke } : { fill: sampled.fill });
    }
    setSelectedId(prevId || targetId);
    setActiveTool('select');
    eyedropperPrevIdRef.current = null;
  }

  function handleDownload() {
    const svg = serializeElements(elements, canvasSize, defs);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'canvas.svg';
    a.click();
  }

  function handleFinish() {
    const svg = serializeElements(elements, canvasSize, defs);
    onFinish(svg);
  }

  function handleZoomCommit(val) {
    const pct = Math.min(Math.max(parseInt(val) || 1, 1), 3000);
    setZoomDisplay(pct);
    canvasCtrl.current.setZoomPct?.(pct);
  }

  const buildEditorContext = useCallback(() => ({
    canvasSize,
    selectedId,
    selectedIds,
    elementCount: elements.length,
    defsSummary: {
      gradientCount: defs.gradients?.length || 0,
      variableNames: (defs.variables || []).map(variable => variable.name),
      keyframeNames: (defs.keyframes || []).map(keyframe => keyframe.name || keyframe.id),
      fontNames: (defs.fonts || [])
        .map(font => font?.name)
        .filter(name => typeof name === 'string' && name.trim()),
    },
    svg: serializeElements(elements, canvasSize, defs),
  }), [canvasSize, defs, elements, selectedId, selectedIds]);

  const captureCanvasScreenshot = useCallback(async (options = {}) => {
    const svg = serializeElements(elements, canvasSize, defs);
    return createCanvasScreenshot(svg, canvasSize, options);
  }, [canvasSize, defs, elements]);

  const prepareImportedElements = useCallback((sourceElements, placement = 'original') => {
    if (!Array.isArray(sourceElements) || !sourceElements.length) return [];

    syncCounter(elements);
    const cloned = structuredClone(sourceElements);

    let offsetX = 0;
    let offsetY = 0;

    if (placement === 'center') {
      let minX = Infinity;
      let minY = Infinity;
      for (const element of cloned) {
        minX = Math.min(minX, element.x ?? 0);
        minY = Math.min(minY, element.y ?? 0);
      }
      offsetX = (canvasSize.width / 2) - minX;
      offsetY = (canvasSize.height / 2) - minY;
    }

    return cloned.map((element) => ({
      ...element,
      id: freshId(element.type || 'element'),
      x: (element.x ?? 0) + offsetX,
      y: (element.y ?? 0) + offsetY,
    }));
  }, [canvasSize, elements]);

  const addPreparedElements = useCallback((preparedElements, { selectNew = true } = {}) => {
    if (!preparedElements.length) return [];
    const previousSelection = [...selectedIds];
    addElements(preparedElements);
    if (!selectNew) setSelectedIds(previousSelection);
    return preparedElements.map(element => element.id);
  }, [addElements, selectedIds, setSelectedIds]);

  const insertElementsAtCenter = useCallback((newEls) => {
    addPreparedElements(prepareImportedElements(newEls, 'center'));
  }, [addPreparedElements, prepareImportedElements]);

  function handleSaveToCollection(selectedEls) {
    const name = selectedEls.length === 1
      ? (selectedEls[0].text || selectedEls[0].id)
      : `${selectedEls.length} elements`;
    addToCollection(name, selectedEls);
  }

  function handleInsertFromCollection(item) {
    insertElementsAtCenter(item.elements);
    setShowCollection(false);
  }

  const handlePasteSVG = useCallback((svgText) => {
    const { elements: parsed } = parseSVGToElements(svgText);
    if (parsed.length) insertElementsAtCenter(parsed);
  }, [insertElementsAtCenter]);

  const clientToolHandlers = useMemo(() => {
    const handlers = {
      get_snapshot: async () => ({
        canvasSize,
        selectedId,
        selectedIds,
        elements,
        defs,
        svg: serializeElements(elements, canvasSize, defs),
      }),

      get_selected_elements: async () => {
        const selected = elements.filter(el => selectedIds.includes(el.id));
        return { selected, count: selected.length };
      },

      get_canvas_screenshot: async (options = {}) => captureCanvasScreenshot(options),

      select_elements: async ({ ids = [] } = {}) => {
        const validIds = ids.filter(id => elements.some(element => element.id === id));
        setSelectedIds(validIds);
        return { selectedIds: validIds, selectedCount: validIds.length };
      },

      update_elements: async ({ ids = [], patch = {} } = {}) => {
        const validIds = ids.filter(id => elements.some(element => element.id === id));
        if (!validIds.length) {
          return { updatedIds: [], updatedCount: 0 };
        }
        updateElements(validIds, patch);
        return { updatedIds: validIds, updatedCount: validIds.length };
      },

      delete_elements: async ({ ids = [] } = {}) => {
        const validIds = ids.filter(id => elements.some(element => element.id === id));
        if (!validIds.length) {
          return { deletedIds: [], deletedCount: 0 };
        }
        deleteElements(validIds);
        return { deletedIds: validIds, deletedCount: validIds.length };
      },

      add_elements: async ({ elements: incomingElements = [], selectNew = true } = {}) => {
        const prepared = prepareImportedElements(incomingElements, 'original');
        const addedIds = addPreparedElements(prepared, { selectNew });
        return { addedIds, addedCount: addedIds.length };
      },

      insert_svg: async ({ svg, placement = 'center' } = {}) => {
        if (!svg || typeof svg !== 'string') {
          throw new Error('SVG markup is required.');
        }
        const { elements: parsedElements } = parseSVGToElements(svg);
        const prepared = prepareImportedElements(parsedElements, placement === 'original' ? 'original' : 'center');
        const addedIds = addPreparedElements(prepared, { selectNew: true });
        return { addedIds, addedCount: addedIds.length, placement };
      },

      replace_defs: async ({ defs: nextDefs = {} } = {}) => {
        setDefsFromImport(nextDefs);
        return {
          gradientCount: nextDefs.gradients?.length || 0,
          variableCount: nextDefs.variables?.length || 0,
          keyframeCount: nextDefs.keyframes?.length || 0,
          fontCount: nextDefs.fonts?.length || 0,
        };
      },
    };

    return {
      ...handlers,
      'editor.get_snapshot': handlers.get_snapshot,
      'editor.get_selected_elements': handlers.get_selected_elements,
      'editor.get_canvas_screenshot': handlers.get_canvas_screenshot,
      'editor.select_elements': handlers.select_elements,
      'editor.update_elements': handlers.update_elements,
      'editor.delete_elements': handlers.delete_elements,
      'editor.add_elements': handlers.add_elements,
      'editor.insert_svg': handlers.insert_svg,
      'editor.replace_defs': handlers.replace_defs,
    };
  }, [
    addPreparedElements,
    canvasSize,
    captureCanvasScreenshot,
    defs,
    deleteElements,
    elements,
    prepareImportedElements,
    selectedId,
    selectedIds,
    setDefsFromImport,
    setSelectedIds,
    updateElements,
  ]);

  const {
    messages: aiMessages,
    error: aiError,
    isConfigured: isAiConfigured,
    isConnecting: isAiConnecting,
    isStreaming: isAiStreaming,
    isAgentDone,
    sendMessage: sendAiMessage,
    stop: stopAi,
    clearConversation: clearAiConversation,
  } = useEditorAgent({
    getEditorContext: buildEditorContext,
    clientToolHandlers,
  });

  // ── Paste from clipboard ────────────────────────────────────────────────────
  useEffect(() => {
    function onPaste(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const text = e.clipboardData?.getData('text');
      if (text && (text.trim().startsWith('<svg') || text.trim().startsWith('<?xml'))) {
        e.preventDefault();
        handlePasteSVG(text);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handlePasteSVG]);

  // ── Sub-bar button style ──────────────────────────────────────────────────
  const subBtn = (active = false) => ({
    padding: '4px 8px', borderRadius: 6,
    background: active ? 'var(--accent-dim)' : 'var(--bg-raised)',
    border: `1px solid ${active ? 'rgba(13,101,217,0.4)' : 'var(--border)'}`,
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontFamily: 'Syne, sans-serif',
  });

  const dockBtn = (active = false) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    border: `1px solid ${active ? 'rgba(13,101,217,0.28)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'var(--bg-raised)',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  });

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <EditorToolbar
        activeTool={activeTool}
        setActiveTool={handleSetActiveTool}
        elements={elements}
        selectedId={selectedId}
        selectedIds={selectedIds}
        setSelectedId={setSelectedId}
        setSelectedIds={setSelectedIds}
        toggleSelectedId={toggleSelectedId}
        updateElement={updateElement}
        updateElements={updateElements}
        deleteElements={deleteElements}
        bringForward={bringForward}
        sendBackward={sendBackward}
        alignElement={alignElement}
        reorderElement={reorderElement}
        canvasSize={canvasSize}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        bindings={bindings}
        onOpenKeymap={() => setShowKeymap(true)}
        onDuplicate={duplicateElements}
        onSaveToCollection={handleSaveToCollection}
        onOpenCollection={() => setShowCollection(true)}
        onTextEdit={(id) => canvasCtrl.current.textEdit?.(id)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sub-toolbar */}
        <div style={{
          height: 36, padding: '0 10px',
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          {/* Canvas size */}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', flexShrink: 0, marginRight: 4 }}>
            {canvasSize.width}×{canvasSize.height}
          </span>
          <div style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

          {/* Hint text */}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
            {activeTool === 'eyedropper'
              ? 'Click element to copy fill · Shift+click for stroke · Esc to cancel'
              : activeTool === 'select'
              ? (selectedIds.length > 1
                ? `${selectedIds.length} elements selected · Drag to move · Click element to select · Shift+click to add/remove`
                : selectedId
                ? `${selectedId}`
                : 'Select · Drag to select · Shift+click to add/remove')
              : `Click canvas to place ${activeTool}`}
          </span>
          <div style={{ flex: 1 }} />

          {/* Snap toggle */}
          <button onClick={() => setSnapEnabled(s => !s)} style={subBtn(snapEnabled)} title="Snap to 8px grid">
            <DuotoneIcon svg={ICONS.grid} size={12} />
            Snap
          </button>

          <button onClick={() => setShowPasteSVG(true)} style={subBtn()} title="Paste SVG code (Ctrl+V on canvas)">
            <DuotoneIcon svg={ICONS.paste} size={12} />
            Paste SVG
          </button>

          <button onClick={() => setShowVariables(true)} style={subBtn()} title="Manage color variables">
            <DuotoneIcon svg={ICONS.pencil} size={12} />
            Variables
          </button>

          {/* Element picker */}
          <button
            onClick={() => setPickerMode(m => !m)}
            style={{
              ...subBtn(pickerMode),
              ...(pickerMode ? {
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.5)',
                color: '#60a5fa',
              } : {}),
            }}
            title="Element picker — hover to inspect, click to select (Ctrl+Shift+C)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 1l5.5 13 2-5 5-2L1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
              <path d="M8.5 8.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Inspect
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          {/* Zoom controls */}
          <button onClick={() => canvasCtrl.current.zoomOut?.()}
            style={{ ...subBtn(), padding: '4px 7px', fontSize: 13 }} title="Zoom out (−)">
            −
          </button>

          <input
            type="number" min={1} max={3000} step={5}
            value={zoomDisplay}
            onChange={e => setZoomDisplay(parseInt(e.target.value) || 1)}
            onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
            title="Zoom % — press Enter or blur to apply"
            style={{
              width: 48, textAlign: 'center',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', borderRadius: 6,
              padding: '3px 4px', fontSize: 11,
              fontFamily: 'DM Mono, monospace', outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; handleZoomCommit(e.target.value); }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: -2 }}>%</span>

          <button onClick={() => canvasCtrl.current.zoomIn?.()}
            style={{ ...subBtn(), padding: '4px 7px', fontSize: 13 }} title="Zoom in (+)">
            +
          </button>

          <button onClick={() => canvasCtrl.current.fitViewport?.()} style={subBtn()} title="Fit to screen (0)">
            <DuotoneIcon svg={ICONS.fitScreen} size={12} />
            Fit
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          <button onClick={() => setShowKeymap(true)} style={subBtn()} title="Keyboard shortcuts">
            <DuotoneIcon svg={ICONS.layers} size={12} />
            {keymapName}
          </button>

          <button onClick={handleDownload} style={subBtn()} title="Download SVG">
            <DuotoneIcon svg={ICONS.download} size={12} />
            Save SVG
          </button>

          <button onClick={handleFinish} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 7,
            background: 'var(--accent)', border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Syne, sans-serif',
          }}>
            Map Fields
            <DuotoneIcon svg={ICONS.check} size={13} style={{ color: '#fff' }} />
          </button>
        </div>

        <EditorCanvas
          elements={elements}
          defs={defs}
          selectedId={selectedId}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          toggleSelectedId={toggleSelectedId}
          canvasSize={canvasSize}
          activeTool={activeTool}
          scaleRef={scaleRef}
          canvasRef={canvasRef}
          canvasCtrl={canvasCtrl}
          onViewportChange={v => setZoomDisplay(Math.round(v.scale * 100))}
          updateElement={updateElement}
          updateElementLive={updateElementLive}
          updateElementsLive={updateElementsLive}
          onElementPointerDown={onElementPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onCanvasPointerDown={onCanvasPointerDown}
          onMarqueeEnd={(ids) => {
            setSelectedIds(ids);
            if (ids.length === 1) setPrimarySelectedId(ids[0]);
          }}
          eyedropperActive={activeTool === 'eyedropper'}
          onEyedrop={handleEyedrop}
          pickerMode={pickerMode}
          onPick={id => { setSelectedId(id); setPickerMode(false); setActiveTool('select'); }}
        />
      </div>

      <div style={{ display: 'flex', flexShrink: 0 }}>
        {activeDock === 'properties' ? (
          <EditorPropertiesPanel
            elements={elements}
            selectedId={selectedId}
            selectedIds={selectedIds}
            updateElement={updateElement}
            updateElements={updateElements}
            deleteElements={deleteElements}
            defs={defs}
            onAddGradient={addGradient}
            onAddKeyframe={addKeyframe}
            onAddFont={addFont}
            onRemoveFont={removeFont}
            onOpenCodeEditor={el => setCodeEditElement(el)}
          />
        ) : (
          <EditorAiPanel
            draft={aiDraft}
            onDraftChange={setAiDraft}
            messages={aiMessages}
            error={aiError}
            isConfigured={isAiConfigured}
            isConnecting={isAiConnecting}
            isStreaming={isAiStreaming}
            isAgentDone={isAgentDone}
            onSend={sendAiMessage}
            onStop={stopAi}
            onClear={clearAiConversation}
          />
        )}

        <aside style={{
          width: 44,
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '12px 6px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveDock('properties')}
            style={dockBtn(activeDock === 'properties')}
            title="Properties"
          >
            <DuotoneIcon svg={ICONS.layers} size={15} />
          </button>

          <button
            onClick={() => setActiveDock('ai')}
            style={dockBtn(activeDock === 'ai')}
            title="AI"
          >
            <DuotoneIcon svg={ICONS.ai} size={15} />
          </button>

          <div style={{
            marginTop: 'auto',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 9,
            color: 'var(--text-muted)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}>
            Side Dock
          </div>
        </aside>
      </div>

      {showKeymap && (
        <KeymapSettings
          bindings={bindings}
          keymapName={keymapName}
          onImport={importKeymap}
          onReset={resetToDefault}
          onClose={() => setShowKeymap(false)}
        />
      )}

      {showCollection && (
        <CollectionModal
          onInsert={handleInsertFromCollection}
          onClose={() => setShowCollection(false)}
        />
      )}

      {showPasteSVG && (
        <PasteSVGModal
          onAdd={handlePasteSVG}
          onClose={() => setShowPasteSVG(false)}
        />
      )}

      {showVariables && (
        <VariablesPanel
          variables={defs.variables}
          onAdd={addVariable}
          onUpdate={updateVariable}
          onRemove={removeVariable}
          onClose={() => setShowVariables(false)}
        />
      )}

      {codeEditElement && (
        <CodeEditor
          element={codeEditElement}
          onSave={({ rawStyle, rawAttrs, props }) => {
            updateElement(codeEditElement.id, { rawStyle, rawAttrs, ...(props || {}) });
            setCodeEditElement(null);
          }}
          onClose={() => setCodeEditElement(null)}
        />
      )}
    </div>
  );
}
