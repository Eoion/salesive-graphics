import { useRef, useEffect, useState } from 'react';
import DuotoneIcon from '../DuotoneIcon.jsx';
import { ICONS } from '../../editor/duotoneIcons.js';
import { TOOL_ACTIONS } from '../../editor/keymaps/photoshop.js';
import { useEditorState } from '../../editor/useEditorState.js';
import { useEditorInteractions } from '../../editor/useEditorInteractions.js';
import { useKeymap } from '../../editor/useKeymap.js';
import { serializeElements } from '../../editor/serializeElements.js';
import EditorToolbar from './EditorToolbar.jsx';
import EditorCanvas from './EditorCanvas.jsx';
import EditorPropertiesPanel from './EditorPropertiesPanel.jsx';
import KeymapSettings from './KeymapSettings.jsx';

export default function EditorScreen({ canvasSize, onFinish }) {
  const [activeTool,   setActiveTool]   = useState('select');
  const [showKeymap,   setShowKeymap]   = useState(false);
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
    addElement, updateElementLive, updateElementsLive, updateElement,
    snapshotBeforeLive, commitCurrent, deleteElement, deleteElements,
    bringForward, sendBackward,
    alignElement, reorderElement,
  } = useEditorState();

  const { bindings, keymapName, matchAction, importKeymap, resetToDefault } = useKeymap();

  const { onElementPointerDown, onPointerMove, onPointerUp, onCanvasPointerDown } =
    useEditorInteractions({
      elements,
      selectedId, selectedIds,
      setSelectedId, setPrimarySelectedId, setSelectedIds, toggleSelectedId,
      updateElementLive, updateElementsLive,
      commitCurrent, snapshotBeforeLive,
      deleteElement, deleteElements, activeTool, addElement,
      canvasRef, scaleRef, canvasSize,
      snapEnabled, gridSize: 8,
    });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setPickerMode(m => !m);
        return;
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
  }, [matchAction, undo, redo, selectedId, selectedIds, deleteElements, elements, setSelectedId, bringForward, sendBackward, pickerMode, updateElement]);

  function handleSetActiveTool(tool) {
    if (tool === 'eyedropper') eyedropperPrevIdRef.current = selectedId;
    setActiveTool(tool);
  }

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
    const svg = serializeElements(elements, canvasSize);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'canvas.svg';
    a.click();
  }

  function handleFinish() {
    const svg = serializeElements(elements, canvasSize);
    onFinish(svg);
  }

  function handleZoomCommit(val) {
    const pct = Math.min(Math.max(parseInt(val) || 1, 1), 3000);
    setZoomDisplay(pct);
    canvasCtrl.current.setZoomPct?.(pct);
  }

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
        updateElements={updateElement}
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
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sub-toolbar */}
        <div style={{
          height: 36, padding: '0 10px',
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
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
          updateElementsLive={updateElementsLive}
          onElementPointerDown={onElementPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
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

      <EditorPropertiesPanel
        elements={elements}
        selectedId={selectedId}
        selectedIds={selectedIds}
        updateElement={updateElement}
        updateElements={updateElement}
        deleteElements={deleteElements}
      />

      {showKeymap && (
        <KeymapSettings
          bindings={bindings}
          keymapName={keymapName}
          onImport={importKeymap}
          onReset={resetToDefault}
          onClose={() => setShowKeymap(false)}
        />
      )}
    </div>
  );
}
