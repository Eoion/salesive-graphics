import { useState, useCallback, useRef } from 'react';

const FLIP_DURATION = 300;
const FADE_DURATION = 250;

export function useAiAnimations() {
  const [animOverrides, setAnimOverrides] = useState({});
  const pendingRef = useRef(new Map());

  function clearPending(id) {
    if (pendingRef.current.has(id)) {
      cancelAnimationFrame(pendingRef.current.get(id));
      pendingRef.current.delete(id);
    }
  }

  function playAfterPaint(id, ids) {
    clearPending(id);
    const h1 = requestAnimationFrame(() => {
      const h2 = requestAnimationFrame(() => {
        setAnimOverrides(prev => {
          const next = { ...prev };
          for (const eid of ids) delete next[eid];
          return next;
        });
        pendingRef.current.delete(id);
      });
      pendingRef.current.set(id, h2);
    });
    pendingRef.current.set(id, h1);
  }

  const scheduleFlip = useCallback((id, oldEl, newEl) => {
    const dx = (oldEl.x ?? 0) - (newEl.x ?? 0);
    const dy = (oldEl.y ?? 0) - (newEl.y ?? 0);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    setAnimOverrides(prev => ({
      ...prev,
      [id]: { dx, dy, transition: `transform ${FLIP_DURATION}ms ease-out` },
    }));
    playAfterPaint(id, [id]);
  }, []);

  const scheduleFadeIn = useCallback((id) => {
    setAnimOverrides(prev => ({
      ...prev,
      [id]: { opacity: 0, transition: `opacity ${FADE_DURATION}ms ease-out` },
    }));
    playAfterPaint(id, [id]);
  }, []);

  const scheduleFlipBatch = useCallback((entries) => {
    const updates = {};
    const ids = [];
    for (const { id, oldEl, newEl } of entries) {
      const dx = (oldEl.x ?? 0) - (newEl.x ?? 0);
      const dy = (oldEl.y ?? 0) - (newEl.y ?? 0);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      updates[id] = { dx, dy, transition: `transform ${FLIP_DURATION}ms ease-out` };
      ids.push(id);
    }
    if (!ids.length) return;

    setAnimOverrides(prev => ({ ...prev, ...updates }));
    playAfterPaint('batch', ids);
  }, []);

  return { animOverrides, scheduleFlip, scheduleFadeIn, scheduleFlipBatch };
}
