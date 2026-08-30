import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons as lucideIcons } from 'lucide-react';

function toPascalCase(name) {
  return String(name || '')
    .trim()
    .replace(/[_\s]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

// Resolve a Lucide icon name ("music", "arrow-right", "ArrowRight") to an inline
// SVG data URL usable as an <image> href. Returns null if the name is unknown.
export function resolveLucideIconHref(name, { color = 'currentColor', strokeWidth = 2 } = {}) {
  const key = toPascalCase(name);
  const Icon = lucideIcons[key] || lucideIcons[name];
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

export function isKnownLucideIcon(name) {
  return Boolean(lucideIcons[toPascalCase(name)] || lucideIcons[name]);
}
