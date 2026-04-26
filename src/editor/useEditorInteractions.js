import { useRef } from 'react';
import { makeElement } from './editorConstants.js';

const MIN_SIZE = 4;

function clampToCanvas(x, y, width, height, handleId, cw, ch) {
  if (cw === undefined) return { x, y, width, height };
  // Right edge
  if (x + width > cw) {
    if (handleId === 'e' || handleId === 'ne' || handleId === 'se' || handleId === 'n' || handleId === 's') width = cw - x;
    else x = cw - width;
  }
  // Bottom edge
  if (y + height > ch) {
    if (handleId === 's' || handleId === 'se' || handleId === 'sw' || handleId === 'e' || handleId === 'w') height = ch - y;
    else y = ch - height;
  }
  // Left edge
  if (x < 0) {
    if (handleId === 'w' || handleId === 'nw' || handleId === 'sw') { width += x; x = 0; }
    else x = 0;
  }
  // Top edge
  if (y < 0) {
    if (handleId === 'n' || handleId === 'nw' || handleId === 'ne') { height += y; y = 0; }
    else y = 0;
  }
  width = Math.max(MIN_SIZE, width);
  height = Math.max(MIN_SIZE, height);
  return { x, y, width, height };
}

function applyHandleDelta(el, handleId, dx, dy, cw, ch) {
  let { x, y, width, height } = el;

  switch (handleId) {
    case 'nw': x += dx; y += dy; width -= dx; height -= dy; break;
    case 'n':  y += dy; height -= dy; break;
    case 'ne': width += dx; y += dy; height -= dy; break;
    case 'e':  width += dx; break;
    case 'se': width += dx; height += dy; break;
    case 's':  height += dy; break;
    case 'sw': x += dx; width -= dx; height += dy; break;
    case 'w':  x += dx; width -= dx; break;
    default: break;
  }

  if (width < MIN_SIZE) {
    if (handleId.includes('w')) x -= (MIN_SIZE - width);
    width = MIN_SIZE;
  }
  if (height < MIN_SIZE) {
    if (handleId.includes('n')) y -= (MIN_SIZE - height);
    height = MIN_SIZE;
  }

  return clampToCanvas(x, y, width, height, handleId, cw, ch);
}

function applyHandleDeltaLocked(el, handleId, dx, dy, cw, ch) {
  const ratio = el.width / el.height;
  let { x, y, width, height } = el;

  if (['nw', 'ne', 'se', 'sw'].includes(handleId)) {
    const dw = handleId.includes('e') ? dx : -dx;
    const dh = handleId.includes('s') ? dy : -dy;
    let newW, newH;
    if (Math.abs(dw) >= Math.abs(dh)) {
      newW = Math.max(MIN_SIZE, width + dw);
      newH = newW / ratio;
    } else {
      newH = Math.max(MIN_SIZE, height + dh);
      newW = newH * ratio;
    }
    if (handleId.includes('w')) x += width - newW;
    if (handleId.includes('n')) y += height - newH;
    width = newW; height = newH;
  } else if (handleId === 'e' || handleId === 'w') {
    const newW = Math.max(MIN_SIZE, width + (handleId === 'e' ? dx : -dx));
    const newH = newW / ratio;
    if (handleId === 'w') x += width - newW;
    y -= (newH - height) / 2;
    width = newW; height = newH;
  } else if (handleId === 'n' || handleId === 's') {
    const newH = Math.max(MIN_SIZE, height + (handleId === 's' ? dy : -dy));
    const newW = newH * ratio;
    if (handleId === 'n') y += height - newH;
    x -= (newW - width) / 2;
    width = newW; height = newH;
  }

  return clampToCanvas(x, y, width, height, handleId, cw, ch);
}

export function useEditorInteractions({
  elements,
  selectedId,
  selectedIds,
  setSelectedId,
  setPrimarySelectedId,
  setSelectedIds,
  updateElementLive,
  updateElementsLive,
  commitCurrent,
  snapshotBeforeLive,
  deleteElement,
  deleteElements,
  activeTool,
  addElement,
  onAfterAddElement,
  canvasRef,
  scaleRef,
  canvasSize,
  snapEnabled = false,
  gridSize = 8,
  groups = {},
}) {
  const dragState = useRef(null);

  function snapVal(v) {
    return snapEnabled ? Math.round(v / gridSize) * gridSize : v;
  }

  // Find which group (if any) contains this element ID.
  function groupOf(elId) {
    return Object.values(groups).find(g => g.elementIds.includes(elId)) ?? null;
  }

  // Expand a single element ID to its whole group's element IDs (that exist on canvas).
  // Returns [elId] when the element has no group, or Alt is held (solo-select mode).
  function resolveGroupIds(elId, altHeld) {
    if (altHeld) return [elId];
    const g = groupOf(elId);
    if (!g) return [elId];
    return g.elementIds.filter(id => elements.some(e => e.id === id));
  }

  function onElementPointerDown(e, elId) {
    if (activeTool !== 'select') return;

    const handle = e.target.dataset?.handle;
    const el = elements.find(el => el.id === elId);
    if (!el || el.locked) return;

    // Shift+click: toggle selection. If element is in a group (and no Alt),
    // toggle all group members together.
    if (e.shiftKey) {
      e.stopPropagation();
      const ids = resolveGroupIds(elId, e.altKey);
      const allIn = ids.every(id => selectedIds.includes(id));
      if (allIn) {
        setSelectedIds(selectedIds.filter(id => !ids.includes(id)));
      } else {
        const next = [...new Set([...selectedIds, ...ids])];
        setSelectedIds(next);
        setPrimarySelectedId(elId);
      }
      return;
    }

    // Regular click: if element belongs to a group (and Alt not held), select
    // all group members so they move together. Alt = select this element only.
    const groupIds = resolveGroupIds(elId, e.altKey);
    const isAlreadySelected = groupIds.every(id => selectedIds.includes(id));

    if (isAlreadySelected) {
      // Already have the whole group selected — just update the primary
      setPrimarySelectedId(elId);
    } else {
      if (groupIds.length > 1) {
        setSelectedIds(groupIds);
        setPrimarySelectedId(elId);
      } else {
        setSelectedId(elId);
      }
    }

    // Set pointer capture after selection updates
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    // Start drag/resize
    if (handle === 'rotate') {
      const svgRect = canvasRef.current?.getBoundingClientRect();
      const scale = scaleRef.current || 1;
      const screenCX = (svgRect?.left || 0) + (el.x + el.width / 2) * scale;
      const screenCY = (svgRect?.top  || 0) + (el.y + el.height / 2) * scale;
      dragState.current = {
        type: 'rotate',
        elId,
        screenCX,
        screenCY,
        startRotation: el.rotation || 0,
        startAngle: Math.atan2(e.clientY - screenCY, e.clientX - screenCX) * 180 / Math.PI,
      };
    } else if (handle) {
      dragState.current = {
        type: 'resize',
        handleId: handle,
        elId,
        startX: e.clientX,
        startY: e.clientY,
        startEl: { ...el },
        lockAspect: !!el.lockAspect,
      };
    } else {
      // Start move for all selected elements
      const moveIds = isAlreadySelected ? selectedIds : [elId];
      const startPositions = {};
      for (const id of moveIds) {
        const el = elements.find(e => e.id === id);
        if (el) startPositions[id] = { x: el.x, y: el.y };
      }
      dragState.current = {
        type: 'move',
        elId,
        moveIds,
        startPositions,
        startX: e.clientX,
        startY: e.clientY,
        startEl: { ...el },
      };
    }
  }

  function onPointerMove(e) {
    if (!dragState.current) return;
    const scale = scaleRef.current || 1;
    const dx = (e.clientX - dragState.current.startX) / scale;
    const dy = (e.clientY - dragState.current.startY) / scale;
    const { startEl, elId } = dragState.current;

    if (dragState.current.type === 'move') {
      const { moveIds, startPositions } = dragState.current;
      const cw = canvasSize?.width;
      const ch = canvasSize?.height;
      const patches = {};
      for (const id of moveIds) {
        const start = startPositions[id];
        if (start) {
          const elData = elements.find(e => e.id === id);
          let nx = snapVal(start.x + dx);
          let ny = snapVal(start.y + dy);
          if (cw !== undefined && elData) {
            nx = Math.max(0, Math.min(nx, cw - (elData.width || 0)));
            ny = Math.max(0, Math.min(ny, ch - (elData.height || 0)));
          }
          patches[id] = { x: nx, y: ny };
        }
      }
      updateElementsLive(patches);
    } else if (dragState.current.type === 'resize') {
      const isText = startEl.type === 'text';
      const fn = (isText || dragState.current.lockAspect || e.shiftKey) ? applyHandleDeltaLocked : applyHandleDelta;
      const updated = fn(startEl, dragState.current.handleId, dx, dy, canvasSize?.width, canvasSize?.height);
      
      if (isText) {
        const scale = updated.height / (startEl.height || 1);
        updated.fontSize = Math.max(1, Math.round((startEl.fontSize || 24) * scale));
      }
      
      updateElementLive(elId, updated);
    } else if (dragState.current.type === 'rotate') {
      const { screenCX, screenCY, startRotation, startAngle } = dragState.current;
      const angle = Math.atan2(e.clientY - screenCY, e.clientX - screenCX) * 180 / Math.PI;
      let rotation = ((startRotation + angle - startAngle) % 360 + 360) % 360;
      if (e.shiftKey) rotation = Math.round(rotation / 15) * 15;
      updateElementLive(elId, { rotation });
    }
  }

  function onPointerUp() {
    if (dragState.current) {
      commitCurrent();
      dragState.current = null;
    }
  }

  function onCanvasPointerDown(e) {
    if (activeTool === 'select' || activeTool === 'eyedropper') {
      if (activeTool === 'select') setSelectedIds([]);
      return;
    }

    const scale = scaleRef.current || 1;
    const rect  = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const svgX = (e.clientX - rect.left) / scale;
    const svgY = (e.clientY - rect.top)  / scale;

    const x = Math.max(0, Math.min(svgX - 60, canvasSize.width  - 120));
    const y = Math.max(0, Math.min(svgY - 40, canvasSize.height -  80));

    const el = makeElement(activeTool, canvasSize.width, canvasSize.height);
    addElement({ ...el, x, y });
    onAfterAddElement?.(el.id);
  }

  return { onElementPointerDown, onPointerMove, onPointerUp, onCanvasPointerDown };
}
