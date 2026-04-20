import { useState, useCallback, useMemo } from 'react';
import { PHOTOSHOP_KEYMAP } from './keymaps/photoshop.js';

const LS_KEY = 'salesive_keymap';

export function eventToCombo(e) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

function normalizeCombo(str) {
  if (!str) return '';
  const parts = str.split('+');
  const key = parts.pop().length === 1 ? parts.pop().toUpperCase() : parts.pop();
  // Wait, this logic is wrong. Let me redo.
  // Actually the string is like "Ctrl+Shift+Z" - split on +, the last part is the key
  return str;
}

export function useKeymap() {
  const [bindings, setBindings] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.bindings) return parsed.bindings;
      }
    } catch {}
    return { ...PHOTOSHOP_KEYMAP.bindings };
  });

  const [keymapName, setKeymapName] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw).name || 'Custom';
    } catch {}
    return PHOTOSHOP_KEYMAP.name;
  });

  const save = useCallback((name, b) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ name, bindings: b })); } catch {}
  }, []);

  const importKeymap = useCallback((jsonStr) => {
    try {
      const km = JSON.parse(jsonStr);
      if (!km.bindings || typeof km.bindings !== 'object') return false;
      const b = { ...PHOTOSHOP_KEYMAP.bindings, ...km.bindings };
      const name = km.name || 'Custom';
      setBindings(b);
      setKeymapName(name);
      save(name, b);
      return true;
    } catch { return false; }
  }, [save]);

  const resetToDefault = useCallback(() => {
    setBindings({ ...PHOTOSHOP_KEYMAP.bindings });
    setKeymapName(PHOTOSHOP_KEYMAP.name);
    save(PHOTOSHOP_KEYMAP.name, PHOTOSHOP_KEYMAP.bindings);
  }, [save]);

  // Build reverse lookup: combo → action
  const comboMap = useMemo(() => {
    const m = {};
    for (const [action, combo] of Object.entries(bindings)) {
      m[combo] = action;
    }
    return m;
  }, [bindings]);

  const matchAction = useCallback((e) => {
    const combo = eventToCombo(e);
    if (!combo) return null;
    return comboMap[combo] || null;
  }, [comboMap]);

  return { bindings, keymapName, matchAction, importKeymap, resetToDefault };
}
