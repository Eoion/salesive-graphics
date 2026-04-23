export function isInlineSvgDataUrl(href) {
  return typeof href === 'string' && href.startsWith('data:image/svg+xml');
}

export function decodeSvgDataUrl(href) {
  if (!isInlineSvgDataUrl(href)) return null;
  const comma = href.indexOf(',');
  if (comma === -1) return null;

  const meta = href.slice(0, comma);
  const payload = href.slice(comma + 1);

  try {
    if (meta.includes(';base64')) {
      return decodeURIComponent(escape(atob(payload)));
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function encodeSvgDataUrl(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function safeColor(color) {
  const next = String(color || '#cbd5e1').trim();
  return next && !/[<>"']/.test(next) ? next : '#cbd5e1';
}

function uniquePaints(svg) {
  const paints = [];
  const seen = new Set();
  const paintPattern = /\b(?:fill|stroke)="(?!none|transparent|url\(|currentColor)(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)|[a-zA-Z]+)"/g;
  let match;
  while ((match = paintPattern.exec(svg))) {
    const paint = match[1];
    const key = paint.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      paints.push(paint);
    }
  }
  if (svg.includes('currentColor')) paints.unshift('currentColor');
  return paints;
}

export function getInlineSvgPaintChannels(href) {
  const svg = decodeSvgDataUrl(href);
  if (!svg) return [];
  return uniquePaints(svg).slice(0, 4).map((paint, index) => ({
    key: `c${index + 1}`,
    label: index === 0 ? 'Primary' : index === 1 ? 'Secondary' : `Color ${index + 1}`,
    original: paint,
  }));
}

export function colorizeInlineSvgHref(href, colors) {
  const overrides = colors && typeof colors === 'object' ? colors : null;
  if (!overrides || !Object.keys(overrides).length) return href;
  const svg = decodeSvgDataUrl(href);
  if (!svg) return href;

  const channels = getInlineSvgPaintChannels(href);
  let colored = svg;
  for (const channel of channels) {
    const color = overrides[channel.key];
    if (!color || color === 'original') continue;
    const nextColor = safeColor(color);
    if (channel.original === 'currentColor') {
      colored = colored.replace(/currentColor/g, nextColor);
    } else {
      const escaped = channel.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      colored = colored.replace(new RegExp(`(\\b(?:fill|stroke)=")${escaped}(")`, 'g'), `$1${nextColor}$2`);
    }
  }
  return encodeSvgDataUrl(colored);
}
