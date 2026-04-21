import { useState, useCallback } from 'react';

const LS_KEY = 'salesive_defs';

function loadDefs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { gradients: [], variables: [], keyframes: [], fonts: [], ...parsed };
    }
  } catch {}
  return { gradients: [], variables: [], keyframes: [], fonts: [] };
}

function storeDefs(defs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(defs)); } catch {}
}

export function useEditorDefs() {
  const [defs, setDefs] = useState(() => loadDefs());

  const updateDefs = useCallback((updater) => {
    setDefs(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      storeDefs(next);
      return next;
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
      const fonts = d.fonts || [];
      if (fonts.find(f => f.name === font.name)) return d;
      return { ...d, fonts: [...fonts, font] };
    });
  }, [updateDefs]);

  const removeFont = useCallback((name) => {
    updateDefs(d => ({ ...d, fonts: (d.fonts || []).filter(f => f.name !== name) }));
  }, [updateDefs]);

  const setDefsFromImport = useCallback((importedDefs) => {
    const merged = {
      gradients: importedDefs.gradients || [],
      variables: importedDefs.variables || [],
      keyframes: importedDefs.keyframes || [],
      fonts: importedDefs.fonts || [],
    };
    updateDefs(merged);
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
