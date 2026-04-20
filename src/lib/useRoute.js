import { useState, useEffect, useCallback } from 'react';

export function useRoute() {
  const parse = () => {
    const h = window.location.hash.slice(1) || '/';
    if (h === '/editor') return { mode: 'editor' };
    if (h === '/mapping') return { mode: 'mapping' };
    if (h === '/preview') return { mode: 'preview' };
    return { mode: 'upload' };
  };

  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((mode) => {
    if (mode === 'mapping') window.location.hash = '/mapping';
    else if (mode === 'editor') window.location.hash = '/editor';
    else if (mode === 'preview') window.location.hash = '/preview';
    else window.location.hash = '/';
  }, []);

  return { mode: route.mode, navigate };
}
