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
import EditorAiChat, { uploadImageToStore } from './EditorAiChat.jsx';
import EditorPropertiesPanel from './EditorPropertiesPanel.jsx';
import KeymapSettings from './KeymapSettings.jsx';
import CollectionModal from './CollectionModal.jsx';
import PasteSVGModal from './PasteSVGModal.jsx';
import VariablesPanel from './VariablesPanel.jsx';
import CodeEditor from './CodeEditor.jsx';
import toast from 'react-hot-toast';

// ─── Agent cursor overlay ─────────────────────────────────────────────────────
function AgentCursorOverlay({ elementId, thought, phase, elements, canvasViewport }) {
  const el = elements.find(e => e.id === elementId);
  if (!el) return null;
  const cx = el.x + (el.width || 0) / 2;
  const cy = el.y + (el.height || 0) / 2;
  const sx = canvasViewport.tx + cx * canvasViewport.scale;
  const sy = canvasViewport.ty + cy * canvasViewport.scale;
  const PHASE_COLORS = {
    thinking: '#a78bfa', reading: '#60a5fa', selecting: '#34d399',
    editing: '#fb923c', responding: '#60a5fa', working: '#fb923c',
  };
  const c = PHASE_COLORS[phase] || '#0d65d9';
  return (
    <div style={{
      position: 'absolute', left: sx, top: sy, zIndex: 61,
      pointerEvents: 'none', transform: 'translate(-4px, -4px)',
    }}>
      {/* Thought bubble */}
      {thought && (
        <div style={{
          position: 'absolute', bottom: 30, left: 0, minWidth: 90, maxWidth: 220,
          background: 'var(--bg-surface)', border: `1px solid ${c}55`,
          borderRadius: 10, padding: '6px 10px', fontSize: 11, color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: `0 4px 20px ${c}30, 0 1px 4px rgba(0,0,0,0.4)`,
          animation: 'aiFadeUp 0.2s ease-out', lineHeight: 1.45,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{ display: 'flex', gap: 2 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: c, display: 'inline-block', animation: `aiPulse 1.1s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </span>
            <span style={{ fontSize: 9, color: c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI</span>
          </div>
          {thought}
          <div style={{ position: 'absolute', bottom: -6, left: 12, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `6px solid var(--bg-surface)` }} />
          <div style={{ position: 'absolute', bottom: -7, left: 11, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `7px solid ${c}55` }} />
        </div>
      )}
      {/* Cursor SVG */}
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none" style={{
        filter: `drop-shadow(0 2px 6px ${c}90)`,
        animation: 'agentCursorFloat 2.2s ease-in-out infinite',
      }}>
        <path d="M2 2l5.2 13.5 2.4-4.1 4.1-2.4L2 2z" fill={c} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" strokeLinejoin="round"/>
        <path d="M9.3 11L13.5 15.2" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
        <path d="M9.3 11L13.5 15.2" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {/* Phase indicator dot */}
      <div style={{
        position: 'absolute', top: 0, right: -8,
        width: 10, height: 10, borderRadius: '50%',
        background: c, border: '2px solid var(--bg-base)',
        animation: 'aiPulseRing 1.5s ease-out infinite',
      }} />
    </div>
  );
}

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

async function sampleImagePixel(href, relX, relY) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = href; });
  const size = Math.min(img.naturalWidth || 64, 512);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const px = Math.max(0, Math.min(Math.round(relX * size), size - 1));
  const py = Math.max(0, Math.min(Math.round(relY * size), size - 1));
  const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
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

export default function EditorScreen({ canvasSize, onCanvasResize, onFinish }) {
  const [activeTool,   setActiveTool]   = useState('select');
  const [activeDock,   setActiveDock]   = useState('ai');
  const [showKeymap,   setShowKeymap]   = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showPasteSVG, setShowPasteSVG] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [codeEditElement, setCodeEditElement] = useState(null);
  const [snapEnabled,  setSnapEnabled]  = useState(false);
  const [zoomDisplay,  setZoomDisplay]  = useState(100);
  const [pickerMode,   setPickerMode]   = useState(false);
  const [inspectMode,  setInspectMode]  = useState(false);
  const [canvasViewport, setCanvasViewport] = useState({ tx: 0, ty: 0, scale: 1 });
  const [panelWidth,   setPanelWidth]   = useState(300);

  const scaleRef              = useRef(1);
  const canvasRef             = useRef();
  const canvasCtrl            = useRef({});
  const eyedropperPrevIdRef   = useRef(null);
  const panelDragRef          = useRef(null);

  // ── Panel drag-resize ─────────────────────────────────────────────────────
  useEffect(() => {
    function onMove(e) {
      if (!panelDragRef.current) return;
      const dx = panelDragRef.current.startX - e.clientX;
      const next = Math.min(Math.max(panelDragRef.current.startW + dx, 240), 560);
      setPanelWidth(next);
    }
    function onUp() { panelDragRef.current = null; }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

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
  
  // Auto-switch to properties tab when selecting an element if currently in AI tab
  useEffect(() => {
    if (selectedId && activeDock === 'ai') {
      setActiveDock('properties');
    }
  }, [selectedId]);


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
        case 'inspect':      e.preventDefault(); setInspectMode(v => !v); break;
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

  async function handleEyedrop(targetId, isShift, clientX, clientY) {
    const sampled = elements.find(e => e.id === targetId);
    const prevId  = eyedropperPrevIdRef.current;
    const prevEl  = elements.find(e => e.id === prevId);

    if (sampled && prevEl) {
      let color = isShift ? sampled.stroke : sampled.fill;

      // For image elements, sample the actual pixel color
      if (sampled.type === 'image' && sampled.href && clientX != null && clientY != null) {
        try {
          const scale = scaleRef.current || 1;
          const svgRect = canvasRef.current?.getBoundingClientRect();
          if (svgRect) {
            const canvasX = (clientX - svgRect.left) / scale;
            const canvasY = (clientY - svgRect.top) / scale;
            const relX = (canvasX - sampled.x) / sampled.width;
            const relY = (canvasY - sampled.y) / sampled.height;
            const pixelColor = await sampleImagePixel(sampled.href, relX, relY);
            if (pixelColor) color = pixelColor;
          }
        } catch {}
      }

      if (color && color !== 'none') {
        updateElement(prevId, isShift ? { stroke: color } : { fill: color });
      }
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

  const buildEditorContext = useCallback(() => {
    const W = canvasSize.width;
    const H = canvasSize.height;
    const elementsWithBounds = elements.map(el => {
      const w = el.width || 0;
      const h = el.height || 0;
      const oL = el.x < 0 ? -el.x : 0;
      const oT = el.y < 0 ? -el.y : 0;
      const oR = (el.x + w) > W ? (el.x + w) - W : 0;
      const oB = (el.y + h) > H ? (el.y + h) - H : 0;
      const hasOverflow = oL > 0 || oT > 0 || oR > 0 || oB > 0;
      return {
        id: el.id, type: el.type,
        x: el.x, y: el.y, width: w, height: h,
        right: el.x + w, bottom: el.y + h,
        fill: el.fill, fontSize: el.fontSize,
        text: el.type === 'text' ? el.text?.slice(0, 80) : undefined,
        locked: el.locked, visible: el.visible !== false,
        ...(hasOverflow ? { OVERFLOW: { left: oL, top: oT, right: oR, bottom: oB } } : {}),
      };
    });
    const overflowCount = elementsWithBounds.filter(e => e.OVERFLOW).length;
    return {
      canvas: {
        width: W, height: H,
        origin: 'top-left (0,0). x increases →, y increases ↓.',
        rule: `x >= 0, y >= 0, x+width <= ${W}, y+height <= ${H}`,
        centerX: W / 2, centerY: H / 2,
      },
      selectedId, selectedIds,
      elements: elementsWithBounds,
      elementCount: elements.length,
      ...(overflowCount > 0 ? { WARNING: `${overflowCount} element(s) overflow canvas bounds — call check_layout for details.` } : {}),
      defsSummary: {
        gradientCount: defs.gradients?.length || 0,
        variableNames: (defs.variables || []).map(v => v.name),
        fontNames: (defs.fonts || []).map(f => f?.name).filter(Boolean),
      },
      svg: serializeElements(elements, canvasSize, defs),
    };
  }, [canvasSize, defs, elements, selectedId, selectedIds]);

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
    // Render canvas to PNG, upload, and return URL
    async function screenshotAndUpload() {
      const result = await captureCanvasScreenshot({ format: 'png', maxDimension: 1024 });
      const blob = await (await fetch(result.dataUrl)).blob();
      return uploadImageToStore(blob, 'canvas.png');
    }

    const h = {
      // ── Read ──────────────────────────────────────────────────────────────
      get_canvas_state: async () => ({
        canvasSize, elementCount: elements.length,
        elements: elements.map(el => ({ id: el.id, type: el.type, x: el.x, y: el.y, width: el.width, height: el.height, fill: el.fill, stroke: el.stroke, opacity: el.opacity, text: el.text, locked: el.locked, visible: el.visible, fontSize: el.fontSize })),
        selectedId, selectedIds,
      }),
      list_elements: async () => elements.map(el => ({ id: el.id, type: el.type, x: el.x, y: el.y, width: el.width, height: el.height, fill: el.fill, stroke: el.stroke, text: el.text, locked: el.locked, visible: el.visible })),
      get_element: async ({ id } = {}) => {
        const el = elements.find(e => e.id === id);
        if (!el) throw new Error(`Element "${id}" not found`);
        return el;
      },
      get_snapshot: async () => ({ canvasSize, elements, defs, selectedId, selectedIds, svg: serializeElements(elements, canvasSize, defs) }),

      // ── Screenshot ────────────────────────────────────────────────────────
      take_screenshot: async () => {
        const url = await screenshotAndUpload();
        return url || 'Screenshot failed: could not upload';
      },
      get_canvas_screenshot: async (opts = {}) => {
        const result = await captureCanvasScreenshot(opts);
        const blob = await (await fetch(result.dataUrl)).blob();
        const url = await uploadImageToStore(blob, `screenshot.${opts.format || 'png'}`);
        return { url, width: result.width, height: result.height, sourceWidth: result.sourceWidth, sourceHeight: result.sourceHeight };
      },

      // ── Select ────────────────────────────────────────────────────────────
      select_element: async ({ id } = {}) => {
        if (!elements.some(e => e.id === id)) throw new Error(`Element "${id}" not found`);
        setSelectedIds([id]);
        setPrimarySelectedId(id);
        return { selectedId: id };
      },
      select_elements: async ({ ids = [] } = {}) => {
        const valid = ids.filter(id => elements.some(e => e.id === id));
        setSelectedIds(valid);
        if (valid.length) setPrimarySelectedId(valid[0]);
        return { selectedIds: valid, count: valid.length };
      },

      // ── Update ────────────────────────────────────────────────────────────
      update_element: async ({ id, ...patch } = {}) => {
        if (!elements.some(e => e.id === id)) throw new Error(`Element "${id}" not found`);
        updateElement(id, patch);
        return { id, updated: Object.keys(patch) };
      },
      update_elements: async ({ ids = [], patch = {} } = {}) => {
        const valid = ids.filter(id => elements.some(e => e.id === id));
        if (valid.length) updateElements(valid, patch);
        return { updatedIds: valid, count: valid.length };
      },
      set_fill: async ({ id, fill } = {}) => { updateElement(id, { fill }); return { id, fill }; },
      set_stroke: async ({ id, stroke, strokeWidth } = {}) => { updateElement(id, { stroke, ...(strokeWidth != null ? { strokeWidth } : {}) }); return { id, stroke }; },
      set_opacity: async ({ id, opacity } = {}) => { updateElement(id, { opacity }); return { id, opacity }; },
      set_text: async ({ id, text } = {}) => { updateElement(id, { text }); return { id, text }; },
      move_element: async ({ id, x, y } = {}) => { updateElement(id, { x, y }); return { id, x, y }; },
      resize_element: async ({ id, width, height } = {}) => { updateElement(id, { width, height }); return { id, width, height }; },
      lock_element: async ({ id, locked = true } = {}) => { updateElement(id, { locked }); return { id, locked }; },
      unlock_element: async ({ id } = {}) => { updateElement(id, { locked: false }); return { id, locked: false }; },

      // ── Delete ────────────────────────────────────────────────────────────
      delete_element: async ({ id } = {}) => {
        if (!elements.some(e => e.id === id)) throw new Error(`Element "${id}" not found`);
        deleteElements([id]);
        return { deleted: id };
      },
      delete_elements: async ({ ids = [] } = {}) => {
        const valid = ids.filter(id => elements.some(e => e.id === id));
        if (valid.length) deleteElements(valid);
        return { deletedIds: valid, count: valid.length };
      },

      // ── Add ───────────────────────────────────────────────────────────────
      add_element: async ({ type, ...props } = {}) => {
        // Sanitize: replace NaN/undefined coords with canvas-safe defaults
        const safe = {};
        for (const [k, v] of Object.entries(props)) {
          if (typeof v === 'number' && isNaN(v)) continue;
          safe[k] = v;
        }
        syncCounter(elements);
        const id = freshId(type || 'rect');
        addElement({ type: type || 'rect', id, x: safe.x ?? canvasSize.width / 2 - 50, y: safe.y ?? canvasSize.height / 2 - 50, width: safe.width ?? 100, height: safe.height ?? 100, fill: safe.fill || '#0d65d9', stroke: 'none', strokeWidth: 0, opacity: 1, ...safe });
        return { id };
      },
      add_elements: async ({ elements: els = [], selectNew = true } = {}) => {
        // Strip elements with NaN coordinates before adding
        const clean = (els || []).filter(el => {
          return ['x', 'y', 'width', 'height'].every(
            k => el[k] === undefined || el[k] === null || (typeof el[k] === 'number' && !isNaN(el[k]))
          );
        });
        // Normalize geometry: derive x/y/width/height from cx/cy/r (circles) or x1/y1/x2/y2 (lines)
        const normalized = clean.map(el => {
          const e = { ...el };
          if (e.type === 'circle' || e.type === 'ellipse') {
            const rx = e.rx ?? e.r ?? (typeof e.width === 'number' ? e.width / 2 : 0);
            const ry = e.ry ?? e.r ?? (typeof e.height === 'number' ? e.height / 2 : 0);
            if (e.x === undefined && e.cx !== undefined) e.x = e.cx - rx;
            if (e.y === undefined && e.cy !== undefined) e.y = e.cy - ry;
            if (e.width === undefined) e.width = rx * 2;
            if (e.height === undefined) e.height = ry * 2;
          } else if (e.type === 'line') {
            const x1 = e.x1 ?? e.x ?? 0;
            const y1 = e.y1 ?? e.y ?? 0;
            const x2 = e.x2 ?? ((e.x ?? 0) + (e.width ?? 0));
            const y2 = e.y2 ?? ((e.y ?? 0) + (e.height ?? 0));
            e.x = x1; e.y = y1;
            e.width = x2 - x1; e.height = y2 - y1;
            e.x1 = x1; e.y1 = y1; e.x2 = x2; e.y2 = y2;
          }
          return e;
        });
        const skipped = els.length - clean.length;
        const prepared = prepareImportedElements(normalized, 'original');
        const ids = addPreparedElements(prepared, { selectNew });
        return { addedIds: ids, count: ids.length, ...(skipped > 0 ? { skippedNaN: skipped } : {}) };
      },
      duplicate_element: async ({ id } = {}) => {
        const src = elements.find(e => e.id === id);
        if (!src) throw new Error(`Element "${id}" not found`);
        syncCounter(elements);
        const newId = freshId(src.type);
        addElement({ ...structuredClone(src), id: newId, x: src.x + 10, y: src.y + 10 });
        return { originalId: id, newId };
      },

      // ── Layer ─────────────────────────────────────────────────────────────
      bring_forward: async ({ id } = {}) => { bringForward(id); return { id }; },
      send_backward: async ({ id } = {}) => { sendBackward(id); return { id }; },

      // ── Alignment & distribution helpers ──────────────────────────────────
      fix_elements: async ({ ids = null } = {}) => {
        const targets = ids ? elements.filter(e => ids.includes(e.id)) : elements;
        const fixed = [], removed = [];
        for (const el of targets) {
          const coords = { x: el.x, y: el.y, width: el.width, height: el.height };
          const hasNaN = Object.values(coords).some(v => v !== undefined && (typeof v !== 'number' || isNaN(v)));
          if (!hasNaN) continue;
          // Lines / shapes with NaN coords can't be saved — delete them
          const unfixable = (el.type === 'line' || el.type === 'circle' || el.type === 'ellipse')
            && (isNaN(el.x1) || isNaN(el.y1) || isNaN(el.x2) || isNaN(el.y2) || isNaN(el.cx) || isNaN(el.cy) || isNaN(el.rx) || isNaN(el.ry));
          if (unfixable) {
            deleteElements([el.id]);
            removed.push(el.id);
          } else {
            const patch = {};
            if (typeof el.x !== 'number' || isNaN(el.x)) patch.x = 0;
            if (typeof el.y !== 'number' || isNaN(el.y)) patch.y = 0;
            if (typeof el.width !== 'number' || isNaN(el.width)) patch.width = 100;
            if (typeof el.height !== 'number' || isNaN(el.height)) patch.height = 40;
            updateElement(el.id, patch);
            fixed.push({ id: el.id, patch });
          }
        }
        return { fixed: fixed.length, removed: removed.length, fixedElements: fixed, removedElements: removed };
      },

      align_elements: async ({ ids = [], align = 'center-h', margin = 0 } = {}) => {
        const W = canvasSize.width;
        const H = canvasSize.height;
        const targets = elements.filter(e => ids.includes(e.id));
        if (!targets.length) return { aligned: 0, message: 'No matching element IDs' };
        const updates = [];
        for (const el of targets) {
          const w = el.width || 0;
          const h = el.height || 0;
          let patch = {};
          if (align === 'left')       patch = { x: margin };
          else if (align === 'right') patch = { x: W - w - margin };
          else if (align === 'center-h') patch = { x: Math.round((W - w) / 2) };
          else if (align === 'top')   patch = { y: margin };
          else if (align === 'bottom') patch = { y: H - h - margin };
          else if (align === 'center-v') patch = { y: Math.round((H - h) / 2) };
          else if (align === 'center') patch = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
          updateElement(el.id, patch);
          updates.push({ id: el.id, ...patch });
        }
        return { aligned: updates.length, align, updates };
      },

      distribute_elements: async ({ ids = [], axis = 'vertical', spacing = null, margin = 0 } = {}) => {
        const W = canvasSize.width;
        const H = canvasSize.height;
        const targets = elements
          .filter(e => ids.length ? ids.includes(e.id) : true)
          .sort((a, b) => axis === 'vertical' ? a.y - b.y : a.x - b.x);
        if (targets.length < 2) return { distributed: 0, message: 'Need at least 2 elements' };
        const updates = [];
        if (axis === 'vertical') {
          const totalH = targets.reduce((s, e) => s + (e.height || 0), 0);
          const gap = spacing !== null ? spacing : Math.max(0, (H - margin * 2 - totalH) / (targets.length - 1));
          let y = margin;
          for (const el of targets) {
            updateElement(el.id, { y: Math.round(y) });
            updates.push({ id: el.id, y: Math.round(y) });
            y += (el.height || 0) + gap;
          }
          return { distributed: targets.length, axis, gap: Math.round(gap), updates };
        } else {
          const totalW = targets.reduce((s, e) => s + (e.width || 0), 0);
          const gap = spacing !== null ? spacing : Math.max(0, (W - margin * 2 - totalW) / (targets.length - 1));
          let x = margin;
          for (const el of targets) {
            updateElement(el.id, { x: Math.round(x) });
            updates.push({ id: el.id, x: Math.round(x) });
            x += (el.width || 0) + gap;
          }
          return { distributed: targets.length, axis, gap: Math.round(gap), updates };
        }
      },

      estimate_text: async ({ text = '', fontSize = 16, maxWidth = null } = {}) => {
        const W = canvasSize.width;
        const charW = fontSize * 0.56;
        const lineH = Math.ceil(fontSize * 1.45);
        const singleLineW = Math.round(text.length * charW);
        const effectiveMax = maxWidth || (W - 120);
        const lines = maxWidth ? Math.ceil(singleLineW / maxWidth) : 1;
        const estH = lines * lineH;
        return {
          singleLineWidth: singleLineW,
          fitsOnOneLine: singleLineW <= effectiveMax,
          recommendedWidth: Math.min(singleLineW, effectiveMax),
          estimatedLines: lines,
          estimatedHeight: estH,
          suggestedX: 60,
          suggestedWidth: effectiveMax,
          note: singleLineW > effectiveMax
            ? `Text overflows at fontSize ${fontSize}. Either reduce fontSize or set width=${effectiveMax} and allow wrapping.`
            : `Text fits in ${singleLineW}px. Safe to use.`,
        };
      },

      // ── Layout helpers ────────────────────────────────────────────────────
      check_layout: async () => {
        const W = canvasSize.width;
        const H = canvasSize.height;
        const overflow = elements
          .map(el => {
            const w = el.width || 0;
            const h = el.height || 0;
            const oL = el.x < 0 ? -el.x : 0;
            const oT = el.y < 0 ? -el.y : 0;
            const oR = (el.x + w) > W ? (el.x + w) - W : 0;
            const oB = (el.y + h) > H ? (el.y + h) - H : 0;
            if (!oL && !oT && !oR && !oB) return null;
            return {
              id: el.id, type: el.type,
              text: el.type === 'text' ? el.text?.slice(0, 40) : undefined,
              x: el.x, y: el.y, width: w, height: h,
              right: el.x + w, bottom: el.y + h,
              overflow: { left: oL, top: oT, right: oR, bottom: oB },
              fix: {
                x: oL > 0 ? 0 : (oR > 0 ? W - w : el.x),
                y: oT > 0 ? 0 : (oB > 0 ? H - h : el.y),
              },
            };
          })
          .filter(Boolean);
        return {
          canvasSize: { width: W, height: H },
          totalElements: elements.length,
          overflowCount: overflow.length,
          overflowingElements: overflow,
          allGood: overflow.length === 0,
          hint: overflow.length > 0
            ? 'Call constrain_elements to auto-fix, or update_elements with the suggested fix.x / fix.y values.'
            : 'No overflow detected.',
        };
      },

      constrain_elements: async ({ ids = null, padding = 0 } = {}) => {
        const W = canvasSize.width;
        const H = canvasSize.height;
        const targets = ids
          ? elements.filter(e => ids.includes(e.id))
          : elements.filter(e => {
              const w = e.width || 0;
              const h = e.height || 0;
              return e.x < padding || e.y < padding
                || (e.x + w) > W - padding || (e.y + h) > H - padding;
            });
        const updates = [];
        for (const el of targets) {
          const w = el.width || 0;
          const h = el.height || 0;
          const nx = Math.min(Math.max(el.x || 0, padding), Math.max(padding, W - w - padding));
          const ny = Math.min(Math.max(el.y || 0, padding), Math.max(padding, H - h - padding));
          if (nx !== el.x || ny !== el.y) {
            updateElement(el.id, { x: nx, y: ny });
            updates.push({ id: el.id, type: el.type, from: { x: el.x, y: el.y }, to: { x: nx, y: ny } });
          }
        }
        return { constrained: updates.length, updates, canvasSize: { width: W, height: H } };
      },

      // ── Layout helpers ────────────────────────────────────────────────────
      create_labeled_rect: async ({
        x = 0, y = 0, width = 200, height = 60, label = '',
        fontSize = 16, fontWeight = 'normal', fontFamily = 'sans-serif', fontColor = '#000000',
        fill = '#ffffff', stroke = 'none', strokeWidth = 0, rx = 0, opacity = 1,
      } = {}) => {
        syncCounter(elements);
        const rectId = freshId('rect');
        const textId = freshId('text');
        const textW = Math.max(label.length * fontSize * 0.6, 80);
        // For textAnchor='middle', el.x is the center anchor x
        const textAnchorX = x + width / 2;
        // Vertical centering: SVG baseline = el.y + fontSize; we want center = rect center
        const textY = y + (height / 2) - (fontSize / 2);
        addElements([
          { type: 'rect', id: rectId, x, y, width, height, fill, stroke, strokeWidth: strokeWidth || 0, rx: rx || 0, ry: rx || 0, opacity, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'text', id: textId, x: textAnchorX, y: textY, width: textW, height: fontSize * 1.4, text: label, fontSize, fontWeight, fontFamily, textAnchor: 'middle', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ]);
        return { rectId, textId };
      },

      create_button: async ({
        x = 0, y = 0, label = 'Button',
        width: wOpt, height: hOpt,
        fontSize = 14, fontWeight = '600', fontFamily = 'sans-serif',
        fontColor = '#ffffff', fill = '#0d65d9',
        stroke = 'none', strokeWidth = 0, rx = 8,
        paddingX = 24, paddingY = 10,
      } = {}) => {
        syncCounter(elements);
        const rectId = freshId('rect');
        const textId = freshId('text');
        const autoW = Math.max(label.length * fontSize * 0.6 + paddingX * 2, 80);
        const autoH = fontSize + paddingY * 2;
        const width = wOpt ?? autoW;
        const height = hOpt ?? autoH;
        const textAnchorX = x + width / 2;
        const textY = y + (height / 2) - (fontSize / 2);
        addElements([
          { type: 'rect', id: rectId, x, y, width, height, fill, stroke, strokeWidth: strokeWidth || 0, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'text', id: textId, x: textAnchorX, y: textY, width: Math.max(label.length * fontSize * 0.6, 80), height: fontSize * 1.4, text: label, fontSize, fontWeight, fontFamily, textAnchor: 'middle', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ]);
        return { rectId, textId, width, height };
      },

      arrange_row: async ({ ids = [], startX = 0, y = 0, gap = 10, alignment = 'center' } = {}) => {
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) return { arranged: 0 };
        const maxH = Math.max(...targets.map(e => e.height || 0));
        let curX = startX;
        const updates = [];
        for (const el of targets) {
          const elH = el.height || 0;
          const elY = alignment === 'center' ? y + (maxH - elH) / 2
            : alignment === 'bottom' ? y + maxH - elH
            : y;
          updateElement(el.id, { x: curX, y: elY });
          updates.push({ id: el.id, x: curX, y: elY });
          curX += (el.width || 0) + gap;
        }
        return { arranged: updates.length, totalWidth: curX - gap - startX, rowHeight: maxH, updates };
      },

      arrange_column: async ({ ids = [], x = 0, startY = 0, gap = 10, alignment = 'left' } = {}) => {
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) return { arranged: 0 };
        const maxW = Math.max(...targets.map(e => e.width || 0));
        let curY = startY;
        const updates = [];
        for (const el of targets) {
          const elW = el.width || 0;
          const elX = alignment === 'center' ? x + (maxW - elW) / 2
            : alignment === 'right' ? x + maxW - elW
            : x;
          updateElement(el.id, { x: elX, y: curY });
          updates.push({ id: el.id, x: elX, y: curY });
          curY += (el.height || 0) + gap;
        }
        return { arranged: updates.length, columnWidth: maxW, totalHeight: curY - gap - startY, updates };
      },

      arrange_grid: async ({ ids = [], x = 0, y = 0, columns = 3, colGap = 12, rowGap = 12, cellWidth, cellHeight } = {}) => {
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) return { arranged: 0 };
        const cw = cellWidth ?? Math.max(...targets.map(e => e.width || 0));
        const ch = cellHeight ?? Math.max(...targets.map(e => e.height || 0));
        const updates = [];
        targets.forEach((el, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const nx = x + col * (cw + colGap);
          const ny = y + row * (ch + rowGap);
          updateElement(el.id, { x: nx, y: ny });
          updates.push({ id: el.id, x: nx, y: ny });
        });
        const rows = Math.ceil(targets.length / columns);
        return { arranged: updates.length, columns, rows, cellWidth: cw, cellHeight: ch, updates };
      },

      align_to_element: async ({ ids = [], refId, align = 'center' } = {}) => {
        const ref = elements.find(e => e.id === refId);
        if (!ref) throw new Error(`Reference element "${refId}" not found`);
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(e => e && e.id !== refId);
        const updates = [];
        for (const el of targets) {
          const w = el.width || 0, h = el.height || 0;
          let patch = {};
          if (align === 'left')       patch = { x: ref.x };
          else if (align === 'right') patch = { x: ref.x + (ref.width || 0) - w };
          else if (align === 'center-h') patch = { x: ref.x + (ref.width || 0) / 2 - w / 2 };
          else if (align === 'top')   patch = { y: ref.y };
          else if (align === 'bottom') patch = { y: ref.y + (ref.height || 0) - h };
          else if (align === 'center-v') patch = { y: ref.y + (ref.height || 0) / 2 - h / 2 };
          else if (align === 'center') patch = {
            x: ref.x + (ref.width || 0) / 2 - w / 2,
            y: ref.y + (ref.height || 0) / 2 - h / 2,
          };
          updateElement(el.id, patch);
          updates.push({ id: el.id, ...patch });
        }
        return { aligned: updates.length, align, refId, updates };
      },

      fit_frame_around: async ({ ids = [], padding = 16, fill = '#ffffff', stroke = 'none', strokeWidth = 0, rx = 8, opacity = 1 } = {}) => {
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) throw new Error('No valid element IDs provided');
        const minX = Math.min(...targets.map(e => e.x));
        const minY = Math.min(...targets.map(e => e.y));
        const maxX = Math.max(...targets.map(e => e.x + (e.width || 0)));
        const maxY = Math.max(...targets.map(e => e.y + (e.height || 0)));
        syncCounter(elements);
        const frameId = freshId('rect');
        addElement({
          type: 'rect', id: frameId,
          x: minX - padding, y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
          fill, stroke, strokeWidth: strokeWidth || 0, rx, ry: rx,
          opacity, visible: true, locked: false, description: '',
          strokeDash: 'solid', strokeLinecap: 'butt',
        });
        // Move frame behind the group
        for (let i = 0; i < targets.length; i++) sendBackward(frameId);
        return { frameId, x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 };
      },

      center_in_canvas: async ({ ids = [], axis = 'both' } = {}) => {
        const W = canvasSize.width, H = canvasSize.height;
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) return { centered: 0 };
        const minX = Math.min(...targets.map(e => e.x));
        const minY = Math.min(...targets.map(e => e.y));
        const maxX = Math.max(...targets.map(e => e.x + (e.width || 0)));
        const maxY = Math.max(...targets.map(e => e.y + (e.height || 0)));
        const groupW = maxX - minX, groupH = maxY - minY;
        const offsetX = axis !== 'vertical' ? Math.round((W - groupW) / 2) - minX : 0;
        const offsetY = axis !== 'horizontal' ? Math.round((H - groupH) / 2) - minY : 0;
        const updates = [];
        for (const el of targets) {
          const nx = el.x + offsetX, ny = el.y + offsetY;
          updateElement(el.id, { x: nx, y: ny });
          updates.push({ id: el.id, x: nx, y: ny });
        }
        return { centered: updates.length, offsetX, offsetY, updates };
      },

      place_at: async ({ id, anchor = 'center', margin = 0 } = {}) => {
        const W = canvasSize.width, H = canvasSize.height;
        const el = elements.find(e => e.id === id);
        if (!el) throw new Error(`Element "${id}" not found`);
        const w = el.width || 0, h = el.height || 0;
        const col = anchor.includes('right') ? W - w - margin : anchor.includes('center') && !anchor.includes('left') && !anchor.includes('right') ? Math.round((W - w) / 2) : margin;
        const row = anchor.includes('bottom') ? H - h - margin : anchor.includes('center') && !anchor.includes('top') && !anchor.includes('bottom') ? Math.round((H - h) / 2) : margin;
        updateElement(id, { x: col, y: row });
        return { id, x: col, y: row, anchor };
      },

      stack_center: async ({ ids = [], cx: cxOpt, cy: cyOpt } = {}) => {
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) return { stacked: 0 };
        const avgCx = cxOpt ?? targets.reduce((s, e) => s + e.x + (e.width || 0) / 2, 0) / targets.length;
        const avgCy = cyOpt ?? targets.reduce((s, e) => s + e.y + (e.height || 0) / 2, 0) / targets.length;
        const updates = [];
        for (const el of targets) {
          const nx = Math.round(avgCx - (el.width || 0) / 2);
          const ny = Math.round(avgCy - (el.height || 0) / 2);
          updateElement(el.id, { x: nx, y: ny });
          updates.push({ id: el.id, x: nx, y: ny });
        }
        return { stacked: updates.length, cx: avgCx, cy: avgCy, updates };
      },

      measure_elements: async ({ ids = [] } = {}) => {
        const targets = ids.map(id => elements.find(e => e.id === id)).filter(Boolean);
        if (!targets.length) return { elements: [], group: null };
        const measured = targets.map(el => ({
          id: el.id, type: el.type,
          x: el.x, y: el.y,
          width: el.width || 0, height: el.height || 0,
          right: el.x + (el.width || 0),
          bottom: el.y + (el.height || 0),
          centerX: el.x + (el.width || 0) / 2,
          centerY: el.y + (el.height || 0) / 2,
        }));
        const minX = Math.min(...measured.map(e => e.x));
        const minY = Math.min(...measured.map(e => e.y));
        const maxX = Math.max(...measured.map(e => e.right));
        const maxY = Math.max(...measured.map(e => e.bottom));
        return {
          elements: measured,
          group: { x: minX, y: minY, width: maxX - minX, height: maxY - minY, right: maxX, bottom: maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 },
        };
      },

      // ── Component helpers ─────────────────────────────────────────────────
      create_badge: async ({
        x = 0, y = 0, label = '',
        fontSize = 11, fontWeight = '600', fontFamily = 'sans-serif', fontColor = '#ffffff',
        fill = '#0d65d9', stroke = 'none', strokeWidth = 0,
        paddingX = 10, paddingY = 4, rx: rxOpt, width: wOpt,
      } = {}) => {
        syncCounter(elements);
        const rectId = freshId('rect');
        const textId = freshId('text');
        const autoW = label.length * fontSize * 0.6 + paddingX * 2;
        const width = wOpt ?? Math.max(autoW, 30);
        const height = fontSize + paddingY * 2;
        const rx = rxOpt ?? height / 2;
        const textY = y + (height / 2) - (fontSize / 2);
        addElements([
          { type: 'rect', id: rectId, x, y, width, height, fill, stroke, strokeWidth: strokeWidth || 0, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'text', id: textId, x: x + width / 2, y: textY, width: Math.max(label.length * fontSize * 0.6, 30), height: fontSize * 1.4, text: label, fontSize, fontWeight, fontFamily, textAnchor: 'middle', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ]);
        return { rectId, textId, width, height };
      },

      create_card: async ({
        x = 0, y = 0, width = 280, title = '',
        body, titleFontSize = 16, titleFontWeight = '700', bodyFontSize = 13,
        titleColor = '#111111', bodyColor = '#555555',
        fill = '#ffffff', stroke = '#e2e8f0', strokeWidth = 1, rx = 10,
        padding = 20, gap = 8, height: hOpt,
      } = {}) => {
        syncCounter(elements);
        const cardId = freshId('rect');
        const titleId = freshId('text');
        const ids = [cardId, titleId];
        const titleH = titleFontSize * 1.4;
        const bodyH = body ? bodyFontSize * 1.4 : 0;
        const autoH = padding + titleH + (body ? gap + bodyH : 0) + padding;
        const height = hOpt ?? autoH;
        const titleY = y + padding;
        const elems = [
          { type: 'rect', id: cardId, x, y, width, height, fill, stroke, strokeWidth, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'text', id: titleId, x: x + padding, y: titleY, width: width - padding * 2, height: titleH, text: title, fontSize: titleFontSize, fontWeight: titleFontWeight, fontFamily: 'sans-serif', textAnchor: 'start', fill: titleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        let bodyId;
        if (body) {
          bodyId = freshId('text');
          ids.push(bodyId);
          elems.push({ type: 'text', id: bodyId, x: x + padding, y: titleY + titleH + gap, width: width - padding * 2, height: bodyH, text: body, fontSize: bodyFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: bodyColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { cardId, titleId, ...(bodyId ? { bodyId } : {}), width, height };
      },

      create_stat_block: async ({
        x = 0, y = 0, value = '0', label = '',
        width = 160, valueFontSize = 40, labelFontSize = 13,
        valueFontWeight = '700', valueColor = '#111111', labelColor = '#888888',
        gap = 6, align = 'center',
      } = {}) => {
        syncCounter(elements);
        const valueId = freshId('text');
        const labelId = freshId('text');
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const anchorX = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x;
        const valueH = valueFontSize * 1.2;
        addElements([
          { type: 'text', id: valueId, x: anchorX, y, width, height: valueH, text: value, fontSize: valueFontSize, fontWeight: valueFontWeight, fontFamily: 'sans-serif', textAnchor: anchor, fill: valueColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'text', id: labelId, x: anchorX, y: y + valueH + gap, width, height: labelFontSize * 1.4, text: label, fontSize: labelFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: anchor, fill: labelColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ]);
        return { valueId, labelId, totalHeight: valueH + gap + labelFontSize * 1.4 };
      },

      create_progress_bar: async ({
        x = 0, y = 0, width = 200, height: barH = 10, percent = 50,
        trackFill = '#e2e8f0', fillColor = '#0d65d9', rx: rxOpt,
        showLabel = false, labelFontSize = 11, labelColor = '#555555',
      } = {}) => {
        syncCounter(elements);
        const trackId = freshId('rect');
        const fillId = freshId('rect');
        const rx = rxOpt ?? barH / 2;
        const fillW = Math.max(0, Math.round((percent / 100) * width));
        const elems = [
          { type: 'rect', id: trackId, x, y, width, height: barH, fill: trackFill, stroke: 'none', strokeWidth: 0, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'rect', id: fillId, x, y, width: Math.max(fillW, rx * 2), height: barH, fill: fillColor, stroke: 'none', strokeWidth: 0, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        let labelId;
        if (showLabel) {
          labelId = freshId('text');
          const lbl = `${Math.round(percent)}%`;
          elems.push({ type: 'text', id: labelId, x: x + width + 8, y: y - (labelFontSize / 2) + barH / 2, width: 36, height: labelFontSize * 1.4, text: lbl, fontSize: labelFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: labelColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { trackId, fillId, ...(labelId ? { labelId } : {}), width, height: barH, percent };
      },

      create_avatar: async ({
        x = 0, y = 0, size = 48, imageSrc, initials,
        fill = '#94a3b8', name, nameFontSize = 12, nameColor = '#333333', gap = 6,
      } = {}) => {
        syncCounter(elements);
        const circleId = freshId('circle');
        const ids = [circleId];
        const elems = [
          imageSrc
            ? { type: 'image', id: circleId, x, y, width: size, height: size, href: imageSrc, fill, stroke: 'none', strokeWidth: 0, rx: size / 2, ry: size / 2, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' }
            : { type: 'circle', id: circleId, x, y, width: size, height: size, fill, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        if (!imageSrc && initials) {
          const initId = freshId('text');
          ids.push(initId);
          const fs = Math.round(size * 0.38);
          elems.push({ type: 'text', id: initId, x: x + size / 2, y: y + (size / 2) - (fs / 2), width: size, height: fs * 1.4, text: initials, fontSize: fs, fontWeight: '600', fontFamily: 'sans-serif', textAnchor: 'middle', fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        let labelId;
        if (name) {
          labelId = freshId('text');
          ids.push(labelId);
          elems.push({ type: 'text', id: labelId, x: x + size / 2, y: y + size + gap, width: size, height: nameFontSize * 1.4, text: name, fontSize: nameFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'middle', fill: nameColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { circleId, ...(labelId ? { labelId } : {}), size };
      },

      create_section_header: async ({
        x = 0, y = 0, title = '', subtitle,
        width = 500, titleFontSize = 28, titleFontWeight = '700',
        subtitleFontSize = 14, titleColor = '#111111', subtitleColor = '#666666',
        gap = 8, align = 'left',
      } = {}) => {
        syncCounter(elements);
        const titleId = freshId('text');
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const anchorX = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x;
        const titleH = titleFontSize * 1.3;
        const elems = [
          { type: 'text', id: titleId, x: anchorX, y, width, height: titleH, text: title, fontSize: titleFontSize, fontWeight: titleFontWeight, fontFamily: 'sans-serif', textAnchor: anchor, fill: titleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        let subtitleId;
        if (subtitle) {
          subtitleId = freshId('text');
          elems.push({ type: 'text', id: subtitleId, x: anchorX, y: y + titleH + gap, width, height: subtitleFontSize * 1.4, text: subtitle, fontSize: subtitleFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: anchor, fill: subtitleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { titleId, ...(subtitleId ? { subtitleId } : {}), totalHeight: titleH + (subtitle ? gap + subtitleFontSize * 1.4 : 0) };
      },

      create_image_card: async ({
        x = 0, y = 0, width = 240, imageHeight: imgH,
        title = '', subtitle, imageSrc, imageFill = '#e2e8f0',
        titleFontSize = 15, subtitleFontSize = 12,
        titleColor = '#111111', subtitleColor = '#888888',
        cardFill, stroke = '#e2e8f0', rx = 10, padding = 14, gap = 6,
      } = {}) => {
        syncCounter(elements);
        const imageHeight = imgH ?? Math.round(width * 0.6);
        const titleH = titleFontSize * 1.4;
        const subH = subtitle ? subtitleFontSize * 1.4 : 0;
        const textAreaH = padding + titleH + (subtitle ? gap + subH : 0) + padding;
        const totalH = imageHeight + textAreaH;
        const elems = [];
        let bgId;
        if (cardFill) {
          bgId = freshId('rect');
          elems.push({ type: 'rect', id: bgId, x, y, width, height: totalH, fill: cardFill, stroke, strokeWidth: 1, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        const imageId = freshId('image');
        elems.push({ type: 'image', id: imageId, x, y, width, height: imageHeight, href: imageSrc || '', fill: imageFill, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        const titleId = freshId('text');
        elems.push({ type: 'text', id: titleId, x: x + padding, y: y + imageHeight + padding, width: width - padding * 2, height: titleH, text: title, fontSize: titleFontSize, fontWeight: '600', fontFamily: 'sans-serif', textAnchor: 'start', fill: titleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        let subtitleId;
        if (subtitle) {
          subtitleId = freshId('text');
          elems.push({ type: 'text', id: subtitleId, x: x + padding, y: y + imageHeight + padding + titleH + gap, width: width - padding * 2, height: subH, text: subtitle, fontSize: subtitleFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: subtitleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { ...(bgId ? { bgId } : {}), imageId, titleId, ...(subtitleId ? { subtitleId } : {}), width, height: totalH };
      },

      create_callout: async ({
        x = 0, y = 0, width = 400, text = '',
        accentColor = '#0d65d9', barWidth = 4, fontSize = 13, fontColor = '#1e293b',
        padding = 14, rx = 6, height: hOpt,
      } = {}) => {
        syncCounter(elements);
        const barId = freshId('rect');
        const bgId = freshId('rect');
        const textId = freshId('text');
        const autoH = fontSize * 1.5 + padding * 2;
        const height = hOpt ?? autoH;
        const bgFill = accentColor + '18';
        addElements([
          { type: 'rect', id: bgId, x, y, width, height, fill: bgFill, stroke: accentColor, strokeWidth: 1, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'rect', id: barId, x, y, width: barWidth, height, fill: accentColor, stroke: 'none', strokeWidth: 0, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'text', id: textId, x: x + barWidth + padding, y: y + (height / 2) - (fontSize / 2), width: width - barWidth - padding * 2, height: fontSize * 1.4, text, fontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ]);
        return { barId, bgId, textId, width, height };
      },

      create_input_field: async ({
        x = 0, y = 0, width = 240, label = '', placeholder = '',
        labelFontSize = 12, placeholderFontSize = 13,
        inputHeight = 38, labelColor = '#374151', placeholderColor = '#9ca3af',
        fill = '#ffffff', stroke = '#d1d5db', strokeWidth = 1, rx = 6, gap = 6,
      } = {}) => {
        syncCounter(elements);
        const labelId = freshId('text');
        const inputId = freshId('rect');
        const labelH = labelFontSize * 1.4;
        const inputY = y + labelH + gap;
        const elems = [
          { type: 'text', id: labelId, x, y, width, height: labelH, text: label, fontSize: labelFontSize, fontWeight: '500', fontFamily: 'sans-serif', textAnchor: 'start', fill: labelColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          { type: 'rect', id: inputId, x, y: inputY, width, height: inputHeight, fill, stroke, strokeWidth, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        let placeholderId;
        if (placeholder) {
          placeholderId = freshId('text');
          const pl = placeholderFontSize;
          elems.push({ type: 'text', id: placeholderId, x: x + 10, y: inputY + (inputHeight / 2) - (pl / 2), width: width - 20, height: pl * 1.4, text: placeholder, fontSize: pl, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: placeholderColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { labelId, inputId, ...(placeholderId ? { placeholderId } : {}), totalHeight: labelH + gap + inputHeight };
      },

      create_icon_text: async ({
        x = 0, y = 0, text = '', iconSrc, iconSize = 24, iconFill = '#0d65d9', iconRx = 4,
        fontSize = 13, fontColor = '#333333', fontWeight = 'normal',
        layout = 'horizontal', gap = 8,
      } = {}) => {
        syncCounter(elements);
        const iconId = freshId(iconSrc ? 'image' : 'rect');
        const textId = freshId('text');
        const textW = Math.max(text.length * fontSize * 0.6, 80);
        let iconEl, textEl;
        if (layout === 'horizontal') {
          const centerY = y + iconSize / 2;
          iconEl = iconSrc
            ? { type: 'image', id: iconId, x, y, width: iconSize, height: iconSize, href: iconSrc, fill: iconFill, stroke: 'none', strokeWidth: 0, rx: iconRx, ry: iconRx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' }
            : { type: 'rect', id: iconId, x, y, width: iconSize, height: iconSize, fill: iconFill, stroke: 'none', strokeWidth: 0, rx: iconRx, ry: iconRx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' };
          textEl = { type: 'text', id: textId, x: x + iconSize + gap, y: centerY - fontSize / 2, width: textW, height: fontSize * 1.4, text, fontSize, fontWeight, fontFamily: 'sans-serif', textAnchor: 'start', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' };
        } else {
          const centerX = x + iconSize / 2;
          iconEl = iconSrc
            ? { type: 'image', id: iconId, x, y, width: iconSize, height: iconSize, href: iconSrc, fill: iconFill, stroke: 'none', strokeWidth: 0, rx: iconRx, ry: iconRx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' }
            : { type: 'rect', id: iconId, x, y, width: iconSize, height: iconSize, fill: iconFill, stroke: 'none', strokeWidth: 0, rx: iconRx, ry: iconRx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' };
          textEl = { type: 'text', id: textId, x: centerX, y: y + iconSize + gap, width: Math.max(textW, iconSize), height: fontSize * 1.4, text, fontSize, fontWeight, fontFamily: 'sans-serif', textAnchor: 'middle', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' };
        }
        addElements([iconEl, textEl]);
        return { iconId, textId };
      },

      create_divider: async ({
        x = 0, y = 0, length = 200, orientation = 'horizontal',
        color = '#e2e8f0', thickness = 1, label,
        labelFontSize = 11, labelColor = '#94a3b8', labelBg = '#ffffff',
      } = {}) => {
        syncCounter(elements);
        const lineId = freshId('line');
        const x2 = orientation === 'horizontal' ? x + length : x;
        const y2 = orientation === 'horizontal' ? y : y + length;
        const elems = [
          { type: 'line', id: lineId, x, y, width: x2 - x, height: y2 - y, fill: 'none', stroke: color, strokeWidth: thickness, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        let labelBgId, labelId;
        if (label) {
          const lw = label.length * labelFontSize * 0.65 + 12;
          const lh = labelFontSize * 1.4;
          const lx = orientation === 'horizontal' ? x + length / 2 - lw / 2 : x - lw / 2;
          const ly = orientation === 'horizontal' ? y - lh / 2 : y + length / 2 - lh / 2;
          labelBgId = freshId('rect');
          labelId = freshId('text');
          elems.push(
            { type: 'rect', id: labelBgId, x: lx, y: ly, width: lw, height: lh, fill: labelBg, stroke: 'none', strokeWidth: 0, rx: 3, ry: 3, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
            { type: 'text', id: labelId, x: lx + lw / 2, y: ly, width: lw, height: lh, text: label, fontSize: labelFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'middle', fill: labelColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
          );
        }
        addElements(elems);
        return { lineId, ...(labelId ? { labelBgId, labelId } : {}) };
      },

      create_table_row: async ({
        x = 0, y = 0, width = 400, height: rowH = 40,
        cells = [], fill = '#ffffff', stroke = '#e2e8f0', strokeWidth = 1,
        fontSize = 13, fontWeight = 'normal', fontColor = '#1e293b',
      } = {}) => {
        syncCounter(elements);
        if (!cells.length) return { rowId: null, cellIds: [] };
        const cellW = width / cells.length;
        const rowId = freshId('rect');
        const cellIds = [];
        const elems = [
          { type: 'rect', id: rowId, x, y, width, height: rowH, fill, stroke, strokeWidth, rx: 0, ry: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' },
        ];
        cells.forEach((cell, i) => {
          const cellX = x + i * cellW;
          const textId = freshId('text');
          cellIds.push(textId);
          const textW = Math.max(cell.length * fontSize * 0.6, 40);
          elems.push({ type: 'text', id: textId, x: cellX + cellW / 2, y: y + (rowH / 2) - (fontSize / 2), width: textW, height: fontSize * 1.4, text: cell, fontSize, fontWeight, fontFamily: 'sans-serif', textAnchor: 'middle', fill: fontColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          if (i > 0) {
            const sepId = freshId('line');
            elems.push({ type: 'line', id: sepId, x: cellX, y, width: 0, height: rowH, fill: 'none', stroke, strokeWidth, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          }
        });
        addElements(elems);
        return { rowId, cellIds, cellWidth: cellW, height: rowH };
      },

      create_list: async ({
        x = 0, y = 0, width = 300, items = [],
        bulletType = 'bullet', fontSize = 13, lineHeight: lhOpt,
        bulletColor, textColor = '#1e293b', fontWeight = 'normal', fontFamily = 'sans-serif',
        fill, stroke = 'none', rx = 0, padding = 12, indentX = 20,
      } = {}) => {
        syncCounter(elements);
        const lh = lhOpt ?? Math.round(fontSize * 1.8);
        const bullets = { bullet: '• ', number: null, check: '✓ ', none: '' };
        const prefix = bullets[bulletType] ?? '• ';
        const elems = [];
        let bgId;
        const totalH = padding * 2 + items.length * lh;
        if (fill) {
          bgId = freshId('rect');
          elems.push({ type: 'rect', id: bgId, x, y, width, height: totalH, fill, stroke, strokeWidth: 1, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        const itemIds = items.map((item, i) => {
          const id = freshId('text');
          const itemPrefix = bulletType === 'number' ? `${i + 1}. ` : prefix;
          const bColor = bulletColor || textColor;
          const textX = x + (fill ? padding : 0) + indentX;
          const itemY = y + (fill ? padding : 0) + i * lh;
          elems.push({ type: 'text', id, x: textX, y: itemY, width: width - (fill ? padding * 2 : 0) - indentX, height: fontSize * 1.4, text: `${itemPrefix}${item}`, fontSize, fontWeight, fontFamily, textAnchor: 'start', fill: i === 0 && bulletType !== 'none' ? bColor : textColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          return id;
        });
        addElements(elems);
        return { ...(bgId ? { bgId } : {}), itemIds, totalHeight: totalH };
      },

      create_tag_group: async ({
        x = 0, y = 0, tags = [],
        spacing = 6, fill = '#e2e8f0', textColor = '#334155',
        fontSize = 11, fontWeight = '600', rx: rxOpt,
        paddingX = 10, paddingY = 4,
      } = {}) => {
        syncCounter(elements);
        const height = fontSize + paddingY * 2;
        const rxVal = rxOpt ?? height / 2;
        const elems = [];
        const ids = [];
        let curX = x;
        tags.forEach(tag => {
          const w = Math.max(tag.length * fontSize * 0.62 + paddingX * 2, 30);
          const rectId = freshId('rect');
          const textId = freshId('text');
          const textY = y + (height / 2) - (fontSize / 2);
          elems.push({ type: 'rect', id: rectId, x: curX, y, width: w, height, fill, stroke: 'none', strokeWidth: 0, rx: rxVal, ry: rxVal, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          elems.push({ type: 'text', id: textId, x: curX + w / 2, y: textY, width: Math.max(tag.length * fontSize * 0.62, 20), height: fontSize * 1.4, text: tag, fontSize, fontWeight, fontFamily: 'sans-serif', textAnchor: 'middle', fill: textColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          ids.push({ rectId, textId });
          curX += w + spacing;
        });
        addElements(elems);
        return { ids, totalWidth: curX - x - spacing, height };
      },

      create_timeline: async ({
        x = 0, y = 0, items = [],
        dotColor = '#0d65d9', lineColor = '#cbd5e1', dotSize = 12,
        titleFontSize = 14, subtitleFontSize = 12, dateFontSize = 11,
        titleColor = '#111111', subtitleColor = '#555555', dateColor = '#94a3b8',
        itemSpacing = 60, textOffsetX = 24, width: textWidth = 220,
      } = {}) => {
        syncCounter(elements);
        if (!items.length) return { lineId: null, items: [] };
        const totalH = items.length * itemSpacing;
        const lineId = freshId('line');
        const elems = [
          { type: 'line', id: lineId, x1: x, y1: y + dotSize / 2, x2: x, y2: y + totalH - dotSize / 2, x: x, y: y + dotSize / 2, width: 0, height: totalH - dotSize, fill: 'none', stroke: lineColor, strokeWidth: 2, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'round' },
        ];
        const resultItems = items.map((item, i) => {
          const cy = y + i * itemSpacing;
          const dotId = freshId('circle');
          const titleId = freshId('text');
          const textX = x + textOffsetX;
          const titleY = cy - titleFontSize / 2;
          elems.push({ type: 'circle', id: dotId, cx: x, cy, r: dotSize / 2, x: x - dotSize / 2, y: cy - dotSize / 2, width: dotSize, height: dotSize, fill: dotColor, stroke: '#ffffff', strokeWidth: 2, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          elems.push({ type: 'text', id: titleId, x: textX, y: titleY, width: textWidth, height: titleFontSize * 1.4, text: item.title, fontSize: titleFontSize, fontWeight: '600', fontFamily: 'sans-serif', textAnchor: 'start', fill: titleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          let subtitleId, dateId;
          if (item.subtitle) {
            subtitleId = freshId('text');
            elems.push({ type: 'text', id: subtitleId, x: textX, y: titleY + titleFontSize * 1.4, width: textWidth, height: subtitleFontSize * 1.4, text: item.subtitle, fontSize: subtitleFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: subtitleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          }
          if (item.date) {
            dateId = freshId('text');
            elems.push({ type: 'text', id: dateId, x: textX, y: titleY - dateFontSize * 1.4, width: textWidth, height: dateFontSize * 1.4, text: item.date, fontSize: dateFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: dateColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          }
          return { dotId, titleId, ...(subtitleId ? { subtitleId } : {}), ...(dateId ? { dateId } : {}) };
        });
        addElements(elems);
        return { lineId, items: resultItems };
      },

      create_rating: async ({
        x = 0, y = 0, value = 4, maxStars = 5,
        starSize = 20, filledColor = '#f59e0b', emptyColor = '#d1d5db',
        spacing = 2, showLabel = false, labelColor = '#64748b',
        labelFontSize = 12, labelGap = 8,
      } = {}) => {
        syncCounter(elements);
        const elems = [];
        const starIds = [];
        const filled = Math.round(value);
        for (let i = 0; i < maxStars; i++) {
          const id = freshId('text');
          starIds.push(id);
          elems.push({ type: 'text', id, x: x + i * (starSize + spacing), y, width: starSize, height: starSize * 1.2, text: i < filled ? '★' : '☆', fontSize: starSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: i < filled ? filledColor : emptyColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        let labelId;
        if (showLabel) {
          labelId = freshId('text');
          const labelX = x + maxStars * (starSize + spacing) + labelGap;
          elems.push({ type: 'text', id: labelId, x: labelX, y: y + (starSize - labelFontSize) / 2, width: 60, height: labelFontSize * 1.4, text: `${value} / ${maxStars}`, fontSize: labelFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: labelColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }
        addElements(elems);
        return { starIds, ...(labelId ? { labelId } : {}), width: maxStars * (starSize + spacing) - spacing };
      },

      create_price_tag: async ({
        x = 0, y = 0, price = '0', currency,
        originalPrice, label,
        priceFontSize = 36, currencyFontSize = 18, originalFontSize = 14,
        priceColor = '#111111', currencyColor,
        originalColor = '#94a3b8',
        labelFill = '#ef4444', labelTextColor = '#ffffff',
      } = {}) => {
        syncCounter(elements);
        const elems = [];
        let curX = x;
        let labelId, currencyId, originalId, strikeId;
        const cColor = currencyColor || priceColor;

        if (label) {
          const lW = Math.max(label.length * 10 * 0.6 + 16, 40);
          const lH = 10 + 8;
          const lRx = lH / 2;
          labelId = freshId('rect');
          const labelTextId = freshId('text');
          elems.push({ type: 'rect', id: labelId, x: curX, y, width: lW, height: lH, fill: labelFill, stroke: 'none', strokeWidth: 0, rx: lRx, ry: lRx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          elems.push({ type: 'text', id: labelTextId, x: curX + lW / 2, y: y + lH / 2 - 5, width: lW, height: 14, text: label, fontSize: 10, fontWeight: '700', fontFamily: 'sans-serif', textAnchor: 'middle', fill: labelTextColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          curX = x;
          y += lH + 6;
        }

        if (currency) {
          currencyId = freshId('text');
          elems.push({ type: 'text', id: currencyId, x: curX, y: y + (priceFontSize - currencyFontSize) * 0.6, width: currencyFontSize * 0.8, height: currencyFontSize * 1.4, text: currency, fontSize: currencyFontSize, fontWeight: '700', fontFamily: 'sans-serif', textAnchor: 'start', fill: cColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          curX += currencyFontSize * 0.8 + 2;
        }

        const priceId = freshId('text');
        const priceW = price.length * priceFontSize * 0.6;
        elems.push({ type: 'text', id: priceId, x: curX, y, width: priceW + 10, height: priceFontSize * 1.2, text: price, fontSize: priceFontSize, fontWeight: '700', fontFamily: 'sans-serif', textAnchor: 'start', fill: priceColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });

        if (originalPrice) {
          const origX = curX + priceW + 14;
          originalId = freshId('text');
          strikeId = freshId('rect');
          const origW = originalPrice.length * originalFontSize * 0.6 + 4;
          const origY = y + (priceFontSize - originalFontSize) * 0.7;
          elems.push({ type: 'text', id: originalId, x: origX, y: origY, width: origW, height: originalFontSize * 1.4, text: originalPrice, fontSize: originalFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: originalColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          elems.push({ type: 'rect', id: strikeId, x: origX - 2, y: origY + originalFontSize * 0.55, width: origW, height: 1.5, fill: originalColor, stroke: 'none', strokeWidth: 0, rx: 0, ry: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }

        addElements(elems);
        return { priceId, ...(currencyId ? { currencyId } : {}), ...(originalId ? { originalId, strikeId } : {}), ...(labelId ? { labelId } : {}) };
      },

      create_testimonial: async ({
        x = 0, y = 0, width = 320, quote = '', author = '', role,
        initials, avatarFill = '#0d65d9',
        quoteColor = '#0d65d9', textColor = '#334155',
        authorColor = '#111111', roleColor = '#94a3b8',
        fill, stroke = '#e2e8f0', rx = 12, padding = 24,
        quoteFontSize = 14, avatarSize = 36,
      } = {}) => {
        syncCounter(elements);
        const elems = [];
        let bgId;
        const quoteMark = '"';
        const quoteMarkSize = 48;
        const quoteMarkH = quoteMarkSize * 1.1;
        const textW = width - padding * 2;
        const quoteLines = Math.ceil(quote.length / (textW / (quoteFontSize * 0.6)));
        const textH = quoteLines * quoteFontSize * 1.6;
        const divY = y + padding + quoteMarkH + textH + 12;
        const avatarY = divY + 12;
        const totalH = avatarY + avatarSize + padding - y;

        if (fill) {
          bgId = freshId('rect');
          elems.push({ type: 'rect', id: bgId, x, y, width, height: totalH, fill, stroke, strokeWidth: 1, rx, ry: rx, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }

        const quoteMarkId = freshId('text');
        elems.push({ type: 'text', id: quoteMarkId, x: x + padding, y: y + padding, width: quoteMarkSize, height: quoteMarkH, text: quoteMark, fontSize: quoteMarkSize, fontWeight: '700', fontFamily: 'Georgia, serif', textAnchor: 'start', fill: quoteColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });

        const textId = freshId('text');
        elems.push({ type: 'text', id: textId, x: x + padding, y: y + padding + quoteMarkH, width: textW, height: textH, text: quote, fontSize: quoteFontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: textColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });

        const divId = freshId('line');
        elems.push({ type: 'line', id: divId, x1: x + padding, y1: divY, x2: x + width - padding, y2: divY, x: x + padding, y: divY, width: width - padding * 2, height: 0, fill: 'none', stroke: '#e2e8f0', strokeWidth: 1, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });

        const avatarId = freshId('circle');
        const avatarCx = x + padding + avatarSize / 2;
        const avatarCy = avatarY + avatarSize / 2;
        elems.push({ type: 'circle', id: avatarId, cx: avatarCx, cy: avatarCy, r: avatarSize / 2, x: avatarCx - avatarSize / 2, y: avatarCy - avatarSize / 2, width: avatarSize, height: avatarSize, fill: avatarFill, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        if (initials) {
          const initId = freshId('text');
          elems.push({ type: 'text', id: initId, x: avatarCx, y: avatarCy - 7, width: avatarSize, height: 14, text: initials, fontSize: 13, fontWeight: '700', fontFamily: 'sans-serif', textAnchor: 'middle', fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }

        const authorId = freshId('text');
        const textLeftX = x + padding + avatarSize + 10;
        elems.push({ type: 'text', id: authorId, x: textLeftX, y: avatarY + (role ? 2 : (avatarSize / 2 - 7)), width: textW - avatarSize - 10, height: 18, text: author, fontSize: 13, fontWeight: '700', fontFamily: 'sans-serif', textAnchor: 'start', fill: authorColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });

        let roleId;
        if (role) {
          roleId = freshId('text');
          elems.push({ type: 'text', id: roleId, x: textLeftX, y: avatarY + 20, width: textW - avatarSize - 10, height: 16, text: role, fontSize: 11, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'start', fill: roleColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }

        addElements(elems);
        return { ...(bgId ? { bgId } : {}), quoteMarkId, textId, divId, avatarId, authorId, ...(roleId ? { roleId } : {}), totalHeight: totalH };
      },

      create_qr_placeholder: async ({
        x = 0, y = 0, size = 120, url, label,
        fgColor = '#000000', bgColor = '#ffffff',
        fontSize = 11, labelColor = '#64748b',
      } = {}) => {
        syncCounter(elements);
        const elems = [];
        const cornerIds = [];
        const pad = size * 0.08;
        const finderSize = size * 0.28;
        const innerSize = finderSize * 0.55;
        const coreSize = innerSize * 0.55;

        // Background
        const frameId = freshId('rect');
        elems.push({ type: 'rect', id: frameId, x, y, width: size, height: size, fill: bgColor, stroke: fgColor, strokeWidth: 2, rx: 4, ry: 4, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });

        // 3 corner finder patterns: TL, TR, BL
        const corners = [
          { cx: x + pad, cy: y + pad },
          { cx: x + size - pad - finderSize, cy: y + pad },
          { cx: x + pad, cy: y + size - pad - finderSize },
        ];
        corners.forEach(({ cx, cy }) => {
          const outerId = freshId('rect');
          const innerId = freshId('rect');
          const coreId = freshId('rect');
          cornerIds.push(outerId);
          const innerOff = (finderSize - innerSize) / 2;
          const coreOff = (finderSize - coreSize) / 2;
          elems.push({ type: 'rect', id: outerId, x: cx, y: cy, width: finderSize, height: finderSize, fill: fgColor, stroke: 'none', strokeWidth: 0, rx: 2, ry: 2, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          elems.push({ type: 'rect', id: innerId, x: cx + innerOff, y: cy + innerOff, width: innerSize, height: innerSize, fill: bgColor, stroke: 'none', strokeWidth: 0, rx: 1, ry: 1, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
          elems.push({ type: 'rect', id: coreId, x: cx + coreOff, y: cy + coreOff, width: coreSize, height: coreSize, fill: fgColor, stroke: 'none', strokeWidth: 0, rx: 1, ry: 1, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        });

        let labelId;
        const displayLabel = label || url;
        if (displayLabel) {
          labelId = freshId('text');
          const maxLabelW = Math.max(size, displayLabel.length * fontSize * 0.6);
          elems.push({ type: 'text', id: labelId, x: x + size / 2, y: y + size + 8, width: maxLabelW, height: fontSize * 1.4, text: displayLabel, fontSize, fontWeight: 'normal', fontFamily: 'sans-serif', textAnchor: 'middle', fill: labelColor, stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, locked: false, description: '', strokeDash: 'solid', strokeLinecap: 'butt' });
        }

        addElements(elems);
        return { frameId, cornerIds, ...(labelId ? { labelId } : {}), size };
      },

      // ── Font loading ──────────────────────────────────────────────────────
      load_font: async ({ fontFamily, ids = [] } = {}) => {
        if (!fontFamily) throw new Error('fontFamily is required');
        addFont({ type: 'google', name: fontFamily });
        if (ids.length) updateElements(ids, { fontFamily });
        return { loaded: fontFamily, applied_to: ids };
      },

      // ── Canvas resize ─────────────────────────────────────────────────────
      resize_canvas: async ({ width, height } = {}) => {
        if (!width || !height) throw new Error('width and height are required');
        onCanvasResize?.({ width, height });
        return { width, height };
      },

      // ── SVG import ────────────────────────────────────────────────────────
      insert_svg: async ({ svg, placement = 'center' } = {}) => {
        if (!svg) throw new Error('SVG markup required');
        const { elements: parsed } = parseSVGToElements(svg);
        const prepared = prepareImportedElements(parsed, placement === 'original' ? 'original' : 'center');
        const ids = addPreparedElements(prepared, { selectNew: true });
        return { addedIds: ids, count: ids.length };
      },
      replace_defs: async ({ defs: d = {} } = {}) => { setDefsFromImport(d); return { ok: true }; },
    };

    // Alias with "editor." prefix too
    const aliased = {};
    for (const [k, v] of Object.entries(h)) aliased[`editor.${k}`] = v;
    return { ...h, ...aliased };
  }, [
    addElement, addFont, addPreparedElements, bringForward, canvasSize, captureCanvasScreenshot,
    defs, deleteElements, elements, onCanvasResize, prepareImportedElements, selectedId, selectedIds,
    sendBackward, setDefsFromImport, setPrimarySelectedId, setSelectedIds,
    updateElement, updateElements,
  ]);

  const agentRef = useEditorAgent({ getEditorContext: buildEditorContext, clientToolHandlers });
  const { agentCursor } = agentRef;

  const lastToastRef = useRef(0);
  const triggerWaitToast = () => {
    const now = Date.now();
    if (now - lastToastRef.current < 2000) return;
    lastToastRef.current = now;
    
    toast.dismiss('ai-working-toast');
    toast((t) => (
      <div 
        onClick={() => toast.dismiss(t.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <div style={{ 
          color: 'var(--accent)', 
          flexShrink: 0, 
          display: 'flex', 
          background: 'rgba(13,101,217,0.1)',
          padding: 6,
          borderRadius: 8
        }}>
          <DuotoneIcon svg={ICONS.ai} size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>AI is working</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click elements once AI finishes.</span>
        </div>
      </div>
    ), {
      id: 'ai-working-toast',
      duration: 3000,
      style: {
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        padding: '10px 14px',
        minWidth: '220px'
      },
    });
  };

  // ── Paste from clipboard ────────────────────────────────────────────────────
  useEffect(() => {
    async function onPaste(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Image file paste
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(it => it.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (blob) {
          try {
            const url = await uploadImageToStore(blob, `paste.${blob.type.split('/')[1] || 'png'}`);
            if (url) {
              syncCounter(elements);
              const id = freshId('image');
              const w = 300, h = 200;
              addElement({
                type: 'image', id,
                x: Math.round(canvasSize.width / 2 - w / 2),
                y: Math.round(canvasSize.height / 2 - h / 2),
                width: w, height: h,
                href: url,
                fill: '#cbd5e1', stroke: 'none', strokeWidth: 0,
                strokeDash: 'solid', strokeLinecap: 'butt', opacity: 1,
                visible: true, locked: false, description: '',
              });
            }
          } catch {}
        }
        return;
      }

      const text = e.clipboardData?.getData('text');
      if (!text) return;

      // SVG paste
      if (text.trim().startsWith('<svg') || text.trim().startsWith('<?xml')) {
        e.preventDefault();
        handlePasteSVG(text);
        return;
      }

      // Plain text → create text element
      if (text.trim()) {
        e.preventDefault();
        syncCounter(elements);
        const id = freshId('text');
        const fontSize = 24;
        addElement({
          type: 'text', id,
          x: Math.round(canvasSize.width / 2 - 100),
          y: Math.round(canvasSize.height / 2 - fontSize),
          width: Math.max(text.length * fontSize * 0.6, 80),
          height: fontSize * 1.4,
          text, fontSize, fontWeight: 'normal', fontFamily: 'sans-serif',
          textAnchor: 'start', fill: '#000000',
          stroke: 'none', strokeWidth: 0,
          strokeDash: 'solid', strokeLinecap: 'butt', opacity: 1,
          visible: true, locked: false, description: '',
        });
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handlePasteSVG, addElement, canvasSize, elements]);

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
        addElement={addElement}
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
            onClick={() => setInspectMode(m => !m)}
            style={{
              ...subBtn(inspectMode),
              ...(inspectMode ? {
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.5)',
                color: '#60a5fa',
              } : {}),
            }}
            title="Inspect Canvas — hover to see element info (Ctrl+I)"
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

        {/* Canvas wrapper — position:relative so overlays work */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
          <EditorCanvas
            isWorking={!agentRef.isAgentDone || agentRef.isThinking || agentRef.isStreaming}
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
            onViewportChange={v => { setZoomDisplay(Math.round(v.scale * 100)); setCanvasViewport({ tx: v.tx, ty: v.ty, scale: v.scale }); }}
            agentHighlightId={agentCursor.visible ? agentCursor.elementId : null}
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
            inspectMode={inspectMode}
            addElement={addElement}
          />

          {/* Agent lock overlay — blocks user interaction while AI is working */}
          {!agentRef.isAgentDone && (
            <div 
              onPointerDown={triggerWaitToast}
              style={{
                position: 'absolute', inset: 0, zIndex: 60,
                cursor: 'not-allowed', pointerEvents: 'all',
                background: 'rgba(0,0,0,0.03)',
              }}
            >
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 20,
                background: 'rgba(13,101,217,0.12)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(13,101,217,0.25)',
                fontSize: 11, color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 600,
                pointerEvents: 'none', whiteSpace: 'nowrap',
                animation: 'aiFadeUp 0.2s ease-out',
              }}>
                <span style={{ display: 'flex', gap: 3 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: `aiPulse 1.2s ease-in-out ${i * 0.18}s infinite` }} />
                  ))}
                </span>
                AI is working…
              </div>
            </div>
          )}

          {/* Agent cursor overlay */}
          {agentCursor.visible && agentCursor.elementId && (
            <AgentCursorOverlay
              elementId={agentCursor.elementId}
              thought={agentCursor.thought}
              phase={agentCursor.phase}
              elements={elements}
              canvasViewport={canvasViewport}
            />
          )}
        </div>
      </div>

      {/* ── Right panel (Properties / AI) with drag-resize ─────────────────── */}
      <div style={{ width: panelWidth, display: 'flex', flexDirection: 'row', flexShrink: 0, position: 'relative' }}>
        {/* Drag handle */}
        <div
          onPointerDown={e => { e.preventDefault(); panelDragRef.current = { startX: e.clientX, startW: panelWidth }; e.currentTarget.setPointerCapture(e.pointerId); }}
          style={{ width: 5, cursor: 'col-resize', background: 'transparent', flexShrink: 0, borderLeft: '1px solid var(--border)', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(13,101,217,0.3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        />
        {/* Panel content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface)' }}>
            {[
              { key: 'properties', icon: ICONS.layers, label: 'Properties' },
              { key: 'ai', icon: ICONS.ai, label: 'AI', indicator: agentCursor.visible },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveDock(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: 'none',
                background: activeDock === tab.key ? 'var(--accent-dim)' : 'transparent',
                color: activeDock === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Syne, sans-serif', position: 'relative',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { if (activeDock !== tab.key) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (activeDock !== tab.key) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <DuotoneIcon svg={tab.icon} size={12} />
                {tab.label}
                {tab.indicator && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c', position: 'absolute', top: 2, right: 2, animation: 'aiPulse 1.2s infinite' }} />}
              </button>
            ))}
          </div>
          {/* Panel body */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
              <EditorAiChat agent={agentRef} />
            )}
          </div>
        </div>
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
