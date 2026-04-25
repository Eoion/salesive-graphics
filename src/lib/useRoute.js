import { useState, useEffect, useCallback } from 'react';

function buildHashUrl(pathname) {
  return pathname === '/' ? '/#/' : `/#${pathname}`;
}

function getModeFromPath(pathname) {
  if (pathname === '/login') return 'login';
  if (pathname === '/editor') return 'editor';
  if (pathname === '/mapping') return 'mapping';
  if (pathname === '/preview') return 'preview';
  return 'upload';
}

export function useRoute() {
  const parse = () => {
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const [hashPath = '', hashQuery = ''] = rawHash.split('?');
    const pathname = window.location.pathname || '/';
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(hashQuery);
    const activePath = hashPath || pathname;
    const token = searchParams.get('token') ?? hashParams.get('token');
    const error = searchParams.get('error') ?? hashParams.get('error');

    return {
      mode: getModeFromPath(activePath),
      token,
      error,
    };
  };

  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    const onPopState = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const navigate = useCallback((mode) => {
    let pathname = '/';
    if (mode === 'login') pathname = '/login';
    else if (mode === 'mapping') pathname = '/mapping';
    else if (mode === 'editor') pathname = '/editor';
    else if (mode === 'preview') pathname = '/preview';

    window.history.pushState({}, document.title, buildHashUrl(pathname));
    setRoute(parse());
  }, []);

  return { mode: route.mode, token: route.token, error: route.error, navigate };
}
