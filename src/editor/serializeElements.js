import { polygonPoints, starPoints, arrowheadPoints } from './shapeHelpers.js';
import { colorizeInlineSvgHref } from './svgIconHref.js';

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');
}

function rotateTransform(el) {
  if (!el.rotation) return '';
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return ` transform="rotate(${el.rotation},${cx},${cy})"`;
}

const DASH_MAP = { dashed: '8,4', dotted: '2,4' };
function dashAttr(d) { return DASH_MAP[d]; }

function serializeOne(el) {
  const vis  = el.visible === false ? ' display="none"' : '';
  const desc = el.description ? ` data-description="${esc(el.description)}"` : '';
  const rot  = rotateTransform(el);
  const da   = dashAttr(el.strokeDash);
  const lc   = (el.strokeLinecap && el.strokeLinecap !== 'butt') ? el.strokeLinecap : undefined;

  // Animation style
  let animStyle = '';
  if (el.animation) {
    const a = el.animation;
    const kfName = a.name || a.type;
    animStyle = `animation: ${kfName} ${a.duration || 1}s ${a.easing || 'ease'} ${a.delay || 0}s ${a.repeat === 'infinite' ? 'infinite' : (a.repeat || 1)} forwards;`;
  }
  if (el.rawStyle) animStyle += (animStyle ? ' ' : '') + el.rawStyle;
  const styleAttr = animStyle ? ` style="${esc(animStyle)}"` : '';

  // Extra raw attributes
  let rawAttrStr = '';
  if (el.rawAttrs) {
    rawAttrStr = Object.entries(el.rawAttrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  }

  switch (el.type) {
    case 'rect':
      return `<rect ${attrs({
        id: el.id,
        x: el.x, y: el.y,
        width: Math.max(el.width, 1),
        height: Math.max(el.height, 1),
        rx: el.rx || 0, ry: el.ry || 0,
        fill: el.fill || 'none',
        stroke: el.stroke !== 'none' ? el.stroke : undefined,
        'stroke-width': el.strokeWidth || undefined,
        'stroke-dasharray': da,
        'stroke-linecap': lc,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
      })}${desc}${vis}${rot}${styleAttr}${rawAttrStr} />`;

    case 'circle':
      return `<ellipse ${attrs({
        id: el.id,
        cx: el.x + el.width / 2,
        cy: el.y + el.height / 2,
        rx: Math.max(el.width / 2, 1),
        ry: Math.max(el.height / 2, 1),
        fill: el.fill || 'none',
        stroke: el.stroke !== 'none' ? el.stroke : undefined,
        'stroke-width': el.strokeWidth || undefined,
        'stroke-dasharray': da,
        'stroke-linecap': lc,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
      })}${desc}${vis}${rot}${styleAttr}${rawAttrStr} />`;

    case 'text': {
      const baseline = el.y + (el.fontSize || 24);
      return `<text ${attrs({
        id: el.id,
        x: el.x,
        y: baseline,
        'font-size': el.fontSize || 24,
        'font-weight': el.fontWeight || 'normal',
        'font-family': el.fontFamily || 'sans-serif',
        'text-anchor': el.textAnchor || 'start',
        fill: el.fill || '#000000',
        opacity: el.opacity !== 1 ? el.opacity : undefined,
      })}${desc}${vis}${rot}${styleAttr}${rawAttrStr}>${esc(el.text || '')}</text>`;
    }

    case 'image': {
      let imgStyle = animStyle;
      if (el.cssFilter) imgStyle += (imgStyle ? ' ' : '') + `filter: ${el.cssFilter};`;
      if (el.rawStyle) imgStyle += (imgStyle ? ' ' : '') + el.rawStyle;
      const imgStyleAttr = imgStyle ? ` style="${esc(imgStyle)}"` : '';
      return `<image ${attrs({
        id: el.id,
        x: el.x, y: el.y,
        width: Math.max(el.width, 1),
        height: Math.max(el.height, 1),
        href: colorizeInlineSvgHref(el.href, el.iconColors) || '',
        preserveAspectRatio: 'xMidYMid slice',
        opacity: el.opacity !== 1 ? el.opacity : undefined,
      })}${vis}${rot}${imgStyleAttr}${rawAttrStr} />`;
    }

    case 'path': {
      const bboxX = el.bboxX ?? el.x;
      const bboxY = el.bboxY ?? el.y;
      const bboxW = el.bboxWidth ?? el.width;
      const bboxH = el.bboxHeight ?? el.height;
      const sx = bboxW > 0 ? el.width / bboxW : 1;
      const sy = bboxH > 0 ? el.height / bboxH : 1;
      const tx = el.x - bboxX * sx;
      const ty = el.y - bboxY * sy;
      const posTransform = (sx !== 1 || sy !== 1 || tx !== 0 || ty !== 0)
        ? `translate(${tx},${ty}) scale(${sx},${sy})` : undefined;
      const rotStr = el.rotation
        ? `rotate(${el.rotation},${el.x + el.width / 2},${el.y + el.height / 2})` : undefined;
      const transformVal = [rotStr, posTransform].filter(Boolean).join(' ') || undefined;
      return `<path ${attrs({
        id: el.id, d: el.d || '',
        fill: el.fill || 'none',
        stroke: el.stroke !== 'none' ? el.stroke : undefined,
        'stroke-width': el.strokeWidth || undefined,
        'stroke-dasharray': da,
        'stroke-linecap': lc,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
        transform: transformVal,
        'data-bbox-x': bboxX, 'data-bbox-y': bboxY,
        'data-bbox-w': bboxW, 'data-bbox-h': bboxH,
      })}${desc}${vis}${styleAttr}${rawAttrStr} />`;
    }

    case 'line':
      return `<line ${attrs({
        id: el.id,
        x1: el.x, y1: el.y,
        x2: el.x + el.width,
        y2: el.y + el.height,
        stroke: el.stroke !== 'none' ? (el.stroke || '#000') : '#000',
        'stroke-width': el.strokeWidth || 2,
        'stroke-dasharray': da,
        'stroke-linecap': lc,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
      })}${vis}${rot}${styleAttr}${rawAttrStr} />`;

    case 'polygon':
      return `<polygon ${attrs({
        id: el.id,
        points: polygonPoints(el),
        fill: el.fill || 'none',
        stroke: el.stroke !== 'none' ? el.stroke : undefined,
        'stroke-width': el.strokeWidth || undefined,
        'stroke-dasharray': da,
        'stroke-linecap': lc,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
        'data-type': 'polygon',
        'data-sides': el.sides || 6,
        'data-x': el.x, 'data-y': el.y,
        'data-width': el.width, 'data-height': el.height,
      })}${desc}${vis}${rot}${styleAttr}${rawAttrStr} />`;

    case 'star':
      return `<polygon ${attrs({
        id: el.id,
        points: starPoints(el),
        fill: el.fill || 'none',
        stroke: el.stroke !== 'none' ? el.stroke : undefined,
        'stroke-width': el.strokeWidth || undefined,
        'stroke-dasharray': da,
        'stroke-linecap': lc,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
        'data-type': 'star',
        'data-arms': el.arms || 5,
        'data-inner-ratio': el.innerRatio ?? 0.4,
        'data-x': el.x, 'data-y': el.y,
        'data-width': el.width, 'data-height': el.height,
      })}${desc}${vis}${rot}${styleAttr}${rawAttrStr} />`;

    case 'arrow': {
      const x1 = el.x, y1 = el.y, x2 = el.x + el.width, y2 = el.y + el.height;
      const color = el.stroke !== 'none' ? (el.stroke || '#000') : '#000';
      const sw = el.strokeWidth || 2;
      const gA = attrs({
        id: el.id,
        opacity: el.opacity !== 1 ? el.opacity : undefined,
        'data-type': 'arrow',
        'data-x': el.x, 'data-y': el.y,
        'data-width': el.width, 'data-height': el.height,
        'data-arrow-start': el.arrowStart ? 'true' : undefined,
        'data-arrow-end': el.arrowEnd !== false ? 'true' : undefined,
        'data-stroke': color,
        'data-stroke-width': sw,
        'data-stroke-dash': el.strokeDash || undefined,
        'data-stroke-linecap': lc,
      });
      let lineEl = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${esc(color)}" stroke-width="${sw}"`;
      if (da) lineEl += ` stroke-dasharray="${da}"`;
      if (lc) lineEl += ` stroke-linecap="${lc}"`;
      lineEl += ' />';
      let heads = '';
      if (el.arrowEnd !== false) heads += `\n    <polygon points="${arrowheadPoints(x1,y1,x2,y2,sw,1)}" fill="${esc(color)}" />`;
      if (el.arrowStart) heads += `\n    <polygon points="${arrowheadPoints(x1,y1,x2,y2,sw,-1)}" fill="${esc(color)}" />`;
      return `<g ${gA}${desc}${vis}${rot}${styleAttr}${rawAttrStr}>\n    ${lineEl}${heads}\n  </g>`;
    }

    default:
      return '';
  }
}

export function serializeElements(elements, { width, height }, defs) {
  const body = elements.map(el => serializeOne(el)).filter(Boolean).join('\n  ');

  let defsSection = '';
  if (defs) {
    const parts = [];
    if (defs.gradients?.length) {
      for (const g of defs.gradients) {
        const stops = g.stops.map(s =>
          `<stop offset="${s.offset}" stop-color="${s.stopColor}"${s.stopOpacity !== undefined && s.stopOpacity !== 1 ? ` stop-opacity="${s.stopOpacity}"` : ''} />`
        ).join('');
        if (g.type === 'radial') {
          parts.push(`<radialGradient id="${g.id}" cx="${g.cx || '50%'}" cy="${g.cy || '50%'}" r="${g.r || '50%'}">${stops}</radialGradient>`);
        } else {
          parts.push(`<linearGradient id="${g.id}" x1="${g.x1 || '0%'}" y1="${g.y1 || '0%'}" x2="${g.x2 || '100%'}" y2="${g.y2 || '0%'}">${stops}</linearGradient>`);
        }
      }
    }
    if (defs.variables?.length) {
      const varBlock = defs.variables.map(v => `--${v.name}: ${v.value};`).join(' ');
      parts.push(`<style><![CDATA[:root { ${varBlock} }]]></style>`);
    }
    if (defs.keyframes?.length) {
      parts.push(`<style><![CDATA[${defs.keyframes.map(k => k.css).join('\n')}]]></style>`);
    }
    const fonts = (defs.fonts || []).filter(f => typeof f?.name === 'string' && f.name.trim());
    if (fonts.length) {
      const fontCss = fonts.map(f => {
        if (f.type === 'google') {
          return `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.name)}:wght@400;700&display=swap');`;
        }
        if (f.type === 'custom' && f.dataUrl) {
          return `@font-face { font-family: '${f.name}'; src: url('${f.dataUrl}') format('${f.format || 'truetype'}'); }`;
        }
        return '';
      }).filter(Boolean).join('\n');
      if (fontCss) parts.push(`<style><![CDATA[${fontCss}]]></style>`);
    }
    if (parts.length) defsSection = `  <defs>\n    ${parts.join('\n    ')}\n  </defs>\n`;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `     viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    defsSection,
    `  ${body}`,
    `</svg>`,
  ].filter(Boolean).join('\n');
}
