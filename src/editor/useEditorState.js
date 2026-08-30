import { useState, useCallback, useRef } from 'react';
import { syncCounter } from './editorConstants.js';

const MAX_HISTORY = 100;
const LS_KEY = 'salesive_editor';

function deepClone(val) {
  return structuredClone(val);
}

function loadElements() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const els = JSON.parse(raw);
      if (Array.isArray(els) && els.length) {
        syncCounter(els);
        return els;
      }
    }
  } catch {}
  return null;
}

// Returns 'ok' | 'partial' (saved without heavy image data) | 'failed'.
function storeElements(els) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(els));
    return 'ok';
  } catch {
    // Almost always a quota overflow from large embedded base64 images.
    // Retry with those stripped so layout + text still survive a reload.
    try {
      const slim = els.map((e) =>
        e && e.type === 'image' && typeof e.href === 'string' && e.href.length > 512
          ? { ...e, href: '', hrefDropped: true }
          : e,
      );
      localStorage.setItem(LS_KEY, JSON.stringify(slim));
      return 'partial';
    } catch {
      return 'failed';
    }
  }
}

// Coordinates arriving as strings ("96") silently corrupt any arithmetic the
// renderer does (text baseline = y + fontSize, circle centre, line endpoints).
// Coerce known numeric fields on every write so bad data never persists.
const NUMERIC_ELEMENT_FIELDS = [
  'x', 'y', 'width', 'height', 'rx', 'ry', 'r', 'cx', 'cy',
  'x1', 'y1', 'x2', 'y2', 'fontSize', 'strokeWidth', 'opacity', 'rotation',
  'lineHeight', 'letterSpacing',
];

function coerceElementNumbers(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  let out = obj;
  for (const key of NUMERIC_ELEMENT_FIELDS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      if (out === obj) out = { ...obj };
      out[key] = Number(v);
    }
  }
  return out;
}

export function useEditorState(initialElements) {
  const [elements, setElementsState] = useState(() => {
    if (Array.isArray(initialElements)) {
      syncCounter(initialElements);
      return initialElements;
    }
    return loadElements() || [];
  });
  const [selectedId, _setSelectedId]   = useState(null);
  const [selectedIds, _setSelectedIds] = useState([]);
  const [historySize, setHistorySize]  = useState({ past: 0, future: 0 });
  // 'ok' | 'partial' | 'failed' — surfaced so the UI can warn about lost work.
  const [persistStatus, setPersistStatus] = useState('ok');
  const persistStatusRef = useRef('ok');

  const pastRef        = useRef([]);
  const futureRef      = useRef([]);
  const elementsRef    = useRef(elements);
  const beforeLiveRef  = useRef(null);
  // Stable ref so callbacks don't go stale
  const selRef = useRef({ id: null, ids: [] });

  const setElements = useCallback((newEls) => {
    elementsRef.current = newEls;
    setElementsState(newEls);
  }, []);

  const syncHistory = useCallback(() => {
    setHistorySize({ past: pastRef.current.length, future: futureRef.current.length });
  }, []);

  // Internal: update both selectedId and selectedIds atomically
  const applySelection = useCallback((id, ids) => {
    selRef.current = { id, ids };
    _setSelectedId(id);
    _setSelectedIds(ids);
  }, []);

  // Public: select exactly one element (clears multi-selection)
  const setSelectedId = useCallback((idOrFn) => {
    const id = typeof idOrFn === 'function' ? idOrFn(selRef.current.id) : idOrFn;
    applySelection(id, id ? [id] : []);
  }, [applySelection]);

  // Public: set primary without clearing multi-selection (for click on already-selected)
  const setPrimarySelectedId = useCallback((id) => {
    selRef.current = { ...selRef.current, id };
    _setSelectedId(id);
  }, []);

  // Public: replace the full multi-selection
  const setSelectedIds = useCallback((ids) => {
    applySelection(ids.length > 0 ? ids[ids.length - 1] : null, ids);
  }, [applySelection]);

  // Public: toggle one element in/out of multi-selection
  const toggleSelectedId = useCallback((id) => {
    const prev = selRef.current.ids;
    const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
    applySelection(next.length > 0 ? next[next.length - 1] : null, next);
  }, [applySelection]);

  const commit = useCallback((newElements) => {
    pastRef.current  = [...pastRef.current, deepClone(elementsRef.current)].slice(-MAX_HISTORY);
    futureRef.current = [];
    syncHistory();
    setElements(newElements);
    const result = storeElements(newElements);
    if (result !== persistStatusRef.current) {
      persistStatusRef.current = result;
      setPersistStatus(result);
    }
  }, [setElements, syncHistory]);

  const snapshotBeforeLive = useCallback(() => {
    beforeLiveRef.current = deepClone(elementsRef.current);
  }, []);

  const commitCurrent = useCallback(() => {
    const before = beforeLiveRef.current;
    beforeLiveRef.current = null;
    if (!before) {
      commit(elementsRef.current);
      return;
    }
    pastRef.current  = [...pastRef.current, before].slice(-MAX_HISTORY);
    futureRef.current = [];
    syncHistory();
    storeElements(elementsRef.current);
  }, [commit, syncHistory]);

  const addElement = useCallback((el) => {
    const clean = coerceElementNumbers(el);
    const next = [...elementsRef.current, clean];
    commit(next);
    applySelection(clean.id, [clean.id]);
  }, [commit, applySelection]);

  const addElements = useCallback((els) => {
    if (!els.length) return;
    const clean = els.map(coerceElementNumbers);
    const next = [...elementsRef.current, ...clean];
    commit(next);
    applySelection(clean[clean.length - 1].id, clean.map(e => e.id));
  }, [commit, applySelection]);

  const updateElementLive = useCallback((id, patch) => {
    setElements(elementsRef.current.map(el => el.id === id ? { ...el, ...patch } : el));
  }, [setElements]);

  // Live update for multiple elements simultaneously (multi-move)
  const updateElementsLive = useCallback((patches) => {
    setElements(elementsRef.current.map(el => patches[el.id] ? { ...el, ...patches[el.id] } : el));
  }, [setElements]);

  const updateElement = useCallback((id, patch) => {
    const p = coerceElementNumbers(patch);
    const next = elementsRef.current.map(el => el.id === id ? { ...el, ...p } : el);
    commit(next);
  }, [commit]);

  // Batch update multiple elements with the same patch
  const updateElements = useCallback((ids, patch) => {
    const p = coerceElementNumbers(patch);
    const next = elementsRef.current.map(el => ids.includes(el.id) ? { ...el, ...p } : el);
    commit(next);
  }, [commit]);

  const deleteElement = useCallback((id) => {
    const next = elementsRef.current.filter(el => el.id !== id);
    commit(next);
    const { id: curId, ids: curIds } = selRef.current;
    const nextId  = curId === id ? null : curId;
    const nextIds = curIds.filter(i => i !== id);
    applySelection(nextId, nextId ? (nextIds.length ? nextIds : [nextId]) : nextIds);
  }, [commit, applySelection]);

  // Batch delete multiple elements
  const deleteElements = useCallback((ids) => {
    const next = elementsRef.current.filter(el => !ids.includes(el.id));
    commit(next);
    applySelection(null, []);
  }, [commit, applySelection]);

  const alignElement = useCallback((id, dir, cw, ch) => {
    const el = elementsRef.current.find(e => e.id === id);
    if (!el) return;
    const patch = {
      left:    { x: 0 },
      right:   { x: cw - el.width },
      centerH: { x: (cw - el.width) / 2 },
      top:     { y: 0 },
      bottom:  { y: ch - el.height },
      centerV: { y: (ch - el.height) / 2 },
      center:  { x: (cw - el.width) / 2, y: (ch - el.height) / 2 },
    }[dir] || {};
    const next = elementsRef.current.map(e => e.id === id ? { ...e, ...patch } : e);
    commit(next);
  }, [commit]);

  const reorderElement = useCallback((fromId, beforeId) => {
    const from = elementsRef.current.findIndex(e => e.id === fromId);
    const to   = elementsRef.current.findIndex(e => e.id === beforeId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...elementsRef.current];
    const [el] = next.splice(from, 1);
    next.splice(to, 0, el);
    commit(next);
  }, [commit]);

  const bringForward = useCallback((id) => {
    const i = elementsRef.current.findIndex(el => el.id === id);
    if (i === elementsRef.current.length - 1) return;
    const next = [...elementsRef.current];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    commit(next);
  }, [commit]);

  const sendBackward = useCallback((id) => {
    const i = elementsRef.current.findIndex(el => el.id === id);
    if (i === 0) return;
    const next = [...elementsRef.current];
    [next[i], next[i - 1]] = [next[i - 1], next[i]];
    commit(next);
  }, [commit]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const snapshot = pastRef.current[pastRef.current.length - 1];
    futureRef.current = [deepClone(elementsRef.current), ...futureRef.current].slice(0, MAX_HISTORY);
    pastRef.current   = pastRef.current.slice(0, -1);
    syncHistory();
    const restored = deepClone(snapshot);
    setElements(restored);
    storeElements(restored);
    const { id, ids } = selRef.current;
    const nextId  = id && restored.find(e => e.id === id) ? id : null;
    const nextIds = ids.filter(i => restored.find(e => e.id === i));
    applySelection(nextId, nextIds);
  }, [setElements, syncHistory, applySelection]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const [snapshot, ...rest] = futureRef.current;
    pastRef.current   = [...pastRef.current, deepClone(elementsRef.current)].slice(-MAX_HISTORY);
    futureRef.current = rest;
    syncHistory();
    const restored = deepClone(snapshot);
    setElements(restored);
    storeElements(restored);
    const { id, ids } = selRef.current;
    const nextId  = id && restored.find(e => e.id === id) ? id : null;
    const nextIds = ids.filter(i => restored.find(e => e.id === i));
    applySelection(nextId, nextIds);
  }, [setElements, syncHistory, applySelection]);

  const clearElements = useCallback(() => {
    commit([]);
    applySelection(null, []);
  }, [commit, applySelection]);

  return {
    elements,
    elementsRef, // always-current; read this in async tool handlers to avoid stale closures
    persistStatus,
    selectedId, selectedIds,
    setSelectedId, setPrimarySelectedId, setSelectedIds, toggleSelectedId,
    canUndo: historySize.past > 0,
    canRedo: historySize.future > 0,
    addElement, addElements,
    updateElementLive, updateElementsLive,
    updateElement, updateElements,
    snapshotBeforeLive, commitCurrent,
    deleteElement, deleteElements,
    bringForward, sendBackward,
    alignElement, reorderElement,
    undo, redo, clearElements,
  };
}
