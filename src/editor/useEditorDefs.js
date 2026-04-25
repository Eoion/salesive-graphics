import { useState, useCallback } from 'react';

const LS_KEY = 'salesive_defs';

function normalizeFont(font) {
  if (!font || typeof font.name !== 'string' || !font.name.trim()) return null;
  return {
    ...font,
    name: font.name.trim(),
    type: font.type === 'custom' ? 'custom' : 'google',
  };
}

function normalizeDefs(defs = {}) {
  return {
    gradients: Array.isArray(defs.gradients) ? defs.gradients : [],
    variables: Array.isArray(defs.variables) ? defs.variables : [],
    keyframes: Array.isArray(defs.keyframes) ? defs.keyframes : [],
    fonts: (Array.isArray(defs.fonts) ? defs.fonts : []).map(normalizeFont).filter(Boolean),
  };
}

function loadDefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeDefs(parsed);
    }
  } catch {
    // Ignore malformed persisted defs and fall back to a safe empty set.
  }
  return normalizeDefs();
}

function storeDefs(defs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(defs)); } catch {
    // Storage can fail in private mode or quota exhaustion; editor state still works in memory.
  }
}

export function useEditorDefs(initialDefs) {
  const [defs, setDefs] = useState(() => (
    initialDefs && typeof initialDefs === 'object'
      ? normalizeDefs(initialDefs)
      : loadDefs()
  ));

  const updateDefs = useCallback((updater) => {
    setDefs(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const normalized = normalizeDefs(next);
      storeDefs(normalized);
      return normalized;
    });
  }, []);

  const addGradient = useCallback((grad) => {
    updateDefs(d => ({ ...d, gradients: [...d.gradients, { id: 'grad_' + Date.now(), ...grad }] }));
  }, [updateDefs]);

  const updateGradient = useCallback((id, patch) => {
    updateDefs(d => ({
      ...d,
      gradients: d.gradients.map(g => g.id === id ? { ...g, ...patch } : g),
    }));
  }, [updateDefs]);

  const removeGradient = useCallback((id) => {
    updateDefs(d => ({ ...d, gradients: d.gradients.filter(g => g.id !== id) }));
  }, [updateDefs]);

  const addVariable = useCallback((v) => {
    updateDefs(d => ({ ...d, variables: [...d.variables, { id: 'var_' + Date.now(), ...v }] }));
  }, [updateDefs]);

  const updateVariable = useCallback((id, patch) => {
    updateDefs(d => ({
      ...d,
      variables: d.variables.map(v => v.id === id ? { ...v, ...patch } : v),
    }));
  }, [updateDefs]);

  const removeVariable = useCallback((id) => {
    updateDefs(d => ({ ...d, variables: d.variables.filter(v => v.id !== id) }));
  }, [updateDefs]);

  const addKeyframe = useCallback((kf) => {
    updateDefs(d => ({ ...d, keyframes: [...d.keyframes, { id: 'kf_' + Date.now(), ...kf }] }));
  }, [updateDefs]);

  const removeKeyframe = useCallback((id) => {
    updateDefs(d => ({ ...d, keyframes: d.keyframes.filter(k => k.id !== id) }));
  }, [updateDefs]);

  const addFont = useCallback((font) => {
    updateDefs(d => {
      const normalized = normalizeFont(font);
      if (!normalized) return d;
      const fonts = d.fonts || [];
      if (fonts.find(f => f.name === normalized.name)) return d;
      return { ...d, fonts: [...fonts, normalized] };
    });
  }, [updateDefs]);

  const removeFont = useCallback((name) => {
    updateDefs(d => ({ ...d, fonts: (d.fonts || []).filter(f => f.name !== name) }));
  }, [updateDefs]);

  const setDefsFromImport = useCallback((importedDefs) => {
    updateDefs(normalizeDefs(importedDefs));
  }, [updateDefs]);

  return {
    defs,
    addGradient, updateGradient, removeGradient,
    addVariable, updateVariable, removeVariable,
    addKeyframe, removeKeyframe,
    addFont, removeFont,
    setDefsFromImport,
  };
}
