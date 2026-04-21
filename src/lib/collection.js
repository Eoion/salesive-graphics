import { serializeElements } from '../editor/serializeElements.js';

const LS_KEY = 'salesive_collection';

export function loadCollection() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCollection(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

export function addToCollection(name, elements) {
  const items = loadCollection();

  // Normalize positions so top-left is at (0,0)
  let minX = Infinity, minY = Infinity;
  for (const el of elements) {
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
  }
  const normalized = elements.map(el => ({ ...el, x: el.x - minX, y: el.y - minY }));

  // Generate thumbnail SVG
  let maxX = 0, maxY = 0;
  for (const el of normalized) {
    const r = el.x - minX + (el.width || 0);
    const b = el.y - minY + (el.height || 0);
    if (r > maxX) maxX = r;
    if (b > maxY) maxY = b;
  }
  const thumbW = Math.max(maxX + 10, 20);
  const thumbH = Math.max(maxY + 10, 20);
  const thumbnail = serializeElements(normalized, { width: thumbW, height: thumbH });

  const item = {
    id: 'col_' + Date.now(),
    name: name || 'Untitled',
    elements: normalized,
    thumbnail,
    createdAt: Date.now(),
  };
  items.unshift(item);
  saveCollection(items);
  return item;
}

export function removeFromCollection(id) {
  const items = loadCollection().filter(i => i.id !== id);
  saveCollection(items);
  return items;
}
