export function polygonPoints(el) {
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const rx = el.width / 2, ry = el.height / 2;
  const n = el.sides || 6;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`;
  }).join(' ');
}

export function starPoints(el) {
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const orx = el.width / 2, ory = el.height / 2;
  const n = el.arms || 5, ratio = el.innerRatio ?? 0.4;
  const irx = orx * ratio, iry = ory * ratio;
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const [rx, ry2] = i % 2 === 0 ? [orx, ory] : [irx, iry];
    return `${cx + rx * Math.cos(a)},${cy + ry2 * Math.sin(a)}`;
  }).join(' ');
}

export function arrowheadPoints(x1, y1, x2, y2, sw, dir) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  const size = Math.max(sw * 4, 10);
  const [tx, ty] = dir === 1 ? [x2, y2] : [x1, y1];
  const bd = dir === 1 ? -1 : 1;
  const bx = tx + bd * ux * size, by = ty + bd * uy * size;
  return `${tx},${ty} ${bx - uy * size * 0.4},${by + ux * size * 0.4} ${bx + uy * size * 0.4},${by - ux * size * 0.4}`;
}
