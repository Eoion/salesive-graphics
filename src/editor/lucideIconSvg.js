// Lazily resolves a Lucide icon name to an inline SVG data URL. The heavy deps
// (react-dom/server, the full lucide-react icon set) are dynamically imported so
// they stay out of the main bundle and its init order.

function toPascalCase(name) {
  return String(name || '')
    .trim()
    .replace(/[_\s]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

let _modsPromise = null;
function loadMods() {
  if (!_modsPromise) {
    _modsPromise = Promise.all([
      import('react'),
      import('react-dom/server'),
      import('lucide-react'),
    ]).then(([react, server, lucide]) => ({
      createElement: react.createElement || react.default.createElement,
      renderToStaticMarkup: server.renderToStaticMarkup,
      icons: lucide.icons,
    }));
  }
  return _modsPromise;
}

// Resolve "music" / "arrow-right" / "ArrowRight" → data:image/svg+xml URL, or
// null if the name is unknown.
export async function resolveLucideIconHref(
  name,
  { color = 'currentColor', strokeWidth = 2 } = {},
) {
  const { createElement, renderToStaticMarkup, icons } = await loadMods();
  const Icon = icons[toPascalCase(name)] || icons[name];
  if (!Icon) return null;
  const svg = renderToStaticMarkup(
    createElement(Icon, {
      xmlns: 'http://www.w3.org/2000/svg',
      width: 24,
      height: 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  );
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
