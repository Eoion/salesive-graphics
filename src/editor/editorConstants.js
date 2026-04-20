export const HANDLE_IDS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const CANVAS_PRESETS = [
  { name: 'Instagram Post',  icon: '□', width: 1080, height: 1080 },
  { name: 'Story / Reel',    icon: '▯', width: 1080, height: 1920 },
  { name: 'Flyer Portrait',  icon: '▯', width: 794,  height: 1123 },
  { name: 'Banner 16:9',     icon: '▭', width: 1920, height: 1080 },
];

let _counter = 0;
export function resetCounter() { _counter = 0; }
export function syncCounter(elements) {
  let max = 0;
  for (const el of elements) {
    const m = el.id.match(/_(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  _counter = max;
}

export function makeElement(type, canvasWidth = 800, canvasHeight = 600) {
  const id = `${type}_${++_counter}`;
  const cx = canvasWidth  / 2;
  const cy = canvasHeight / 2;

  const base = {
    id, type,
    fill: type === 'line' || type === 'arrow' ? 'none' : '#e2e8f0',
    stroke: type === 'line' || type === 'arrow' ? '#0D65D9' : 'none',
    strokeWidth: type === 'line' || type === 'arrow' ? 2 : 0,
    strokeDash: 'solid',
    strokeLinecap: 'butt',
    opacity: 1,
    rotation: 0,
    visible: true,
    locked: false,
    description: '',
  };

  switch (type) {
    case 'rect':
      return { ...base, x: cx - 100, y: cy - 60, width: 200, height: 120, rx: 0, ry: 0 };
    case 'circle':
      return { ...base, x: cx - 60, y: cy - 60, width: 120, height: 120, rx: 0, ry: 0 };
    case 'text':
      return {
        ...base, fill: '#1a1a2e',
        x: cx - 80, y: cy - 16,
        width: 160, height: 32,
        text: 'Text', fontSize: 24,
        fontWeight: 'normal', fontFamily: 'sans-serif',
        textAnchor: 'start',
      };
    case 'image':
      return { ...base, fill: '#cbd5e1', x: cx - 100, y: cy - 75, width: 200, height: 150, lockAspect: false };
    case 'line':
      return { ...base, x: cx - 100, y: cy, width: 200, height: 0 };
    case 'polygon':
      return { ...base, fill: '#e2e8f0', stroke: 'none', strokeWidth: 0,
               x: cx - 70, y: cy - 70, width: 140, height: 140, sides: 6 };
    case 'star':
      return { ...base, fill: '#e2e8f0', stroke: 'none', strokeWidth: 0,
               x: cx - 70, y: cy - 70, width: 140, height: 140, arms: 5, innerRatio: 0.4 };
    case 'arrow':
      return { ...base, x: cx - 100, y: cy, width: 200, height: 0,
               arrowStart: false, arrowEnd: true };
    default:
      return { ...base, x: cx - 60, y: cy - 60, width: 120, height: 120 };
  }
}
