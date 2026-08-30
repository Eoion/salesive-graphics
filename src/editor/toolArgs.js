// Normalizes arguments coming from AI agents (WebMCP clients, the Ola socket).
// Models frequently pass JSON-encoded strings for array/object params and
// stringified numbers for coordinates ("96" instead of 96). Left unchecked,
// `ids.filter`, `e.map` and `el.x + el.width` all break or misbehave.

const NUMERIC_KEYS = new Set([
  'x', 'y', 'width', 'height', 'fontSize', 'strokeWidth', 'opacity',
  'rx', 'ry', 'r', 'cx', 'cy', 'rotation', 'lineHeight', 'letterSpacing',
  'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'offset', 'gap', 'padding',
  'columns', 'colGap', 'rowGap', 'steps', 'startX', 'startY', 'margin',
  'gridSize', 'angle', 'maxDimension', 'quality', 'sourceX', 'sourceY',
  'sourceWidth', 'sourceHeight', 'cellWidth', 'cellHeight', 'size',
  'stopOpacity',
]);

// Keys whose string values are identifiers/markup and must never be JSON-parsed
// or number-coerced even if they look parseable.
const OPAQUE_KEYS = new Set([
  'id', 'groupId', 'name', 'text', 'svg', 'd', 'href', 'fill', 'stroke',
  'color', 'stopColor', 'fontFamily', 'fontWeight', 'reason', 'question',
  'topic', 'avatar', 'message', 'thought', 'query', 'pattern',
]);

function maybeParseJson(value) {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!t) return value;
  const first = t[0];
  const last = t[t.length - 1];
  if ((first === '[' && last === ']') || (first === '{' && last === '}')) {
    try { return JSON.parse(t); } catch { return value; }
  }
  return value;
}

function coerceValue(key, value) {
  let v = value;
  if (!OPAQUE_KEYS.has(key)) v = maybeParseJson(v);

  if (Array.isArray(v)) {
    return v.map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? normalizeToolArgs(item)
        : item,
    );
  }
  if (v && typeof v === 'object') return normalizeToolArgs(v);

  if (
    NUMERIC_KEYS.has(key) &&
    typeof v === 'string' &&
    v.trim() !== '' &&
    Number.isFinite(Number(v))
  ) {
    return Number(v);
  }
  return v;
}

export function normalizeToolArgs(args) {
  let a = args;
  if (typeof a === 'string') a = maybeParseJson(a);
  if (Array.isArray(a)) {
    return a.map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? normalizeToolArgs(item)
        : item,
    );
  }
  if (!a || typeof a !== 'object') return a;

  const out = {};
  for (const [k, v] of Object.entries(a)) out[k] = coerceValue(k, v);
  return out;
}
