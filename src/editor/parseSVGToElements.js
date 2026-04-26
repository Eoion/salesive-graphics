// Parses an uploaded SVG string into editor element objects
// that can be loaded into useEditorState.

// Reusable off-screen SVG for path bbox measurement
let _measureSvg = null;
function getMeasureSvg() {
  if (_measureSvg && document.body.contains(_measureSvg)) return _measureSvg;
  _measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  _measureSvg.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:0;height:0;overflow:visible;';
  document.body.appendChild(_measureSvg);
  return _measureSvg;
}

function getPathBbox(d) {
  if (typeof document === 'undefined' || !d) return null;
  const svg = getMeasureSvg();
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  const b = path.getBBox();
  svg.removeChild(path);
  return (b.width > 0 || b.height > 0) ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
}

// Reads a CSS property from inline style OR direct attribute (style wins).
// Returns null if not present on this element (caller should check inherited ctx).
function sv(node, prop) {
  const styleStr = node.getAttribute('style') || '';
  const re = new RegExp('(?:^|;)\\s*' + prop.replace('-', '[-]') + '\\s*:\\s*([^;]+)', 'i');
  const m = styleStr.match(re);
  if (m) return m[1].trim();
  const direct = node.getAttribute(prop);
  return direct !== null ? direct : null;
}

function parseStrokeDash(node) {
  const sda = sv(node, 'stroke-dasharray');
  if (!sda || sda === 'none') return 'solid';
  return sda.startsWith('2') ? 'dotted' : 'dashed';
}

// Convert a polygon points string to an SVG path d attribute.
function polygonPointsToPath(points) {
  const nums = [];
  for (const tok of points.trim().split(/[\s,]+/)) {
    const n = parseFloat(tok);
    if (!isNaN(n)) nums.push(n);
  }
  if (nums.length < 4) return null;
  let d = `M ${nums[0]} ${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) d += ` L ${nums[i]} ${nums[i + 1]}`;
  return d + ' Z';
}

export function parseSVGToElements(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { elements: [], canvasSize: { width: 800, height: 600 } };

  const vb = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  const rawW = svg.getAttribute('width');
  const rawH = svg.getAttribute('height');
  const isRelative = (v) => !v || /%|auto|inherit/.test(v);
  const w = isRelative(rawW) ? (vb?.[2] || 800) : (parseFloat(rawW) || vb?.[2] || 800);
  const h = isRelative(rawH) ? (vb?.[3] || 600) : (parseFloat(rawH) || vb?.[3] || 600);
  const canvasSize = { width: w, height: h };

  // Seed root context from the <svg> element's own presentation attributes so
  // that child shapes that rely on SVG inheritance pick them up.
  const rootCtx = {
    fill: sv(svg, 'fill') ?? 'none',
    stroke: sv(svg, 'stroke') ?? 'none',
    strokeWidth: parseFloat(sv(svg, 'stroke-width')) || 0,
    opacity: parseFloat(sv(svg, 'opacity')) || 1,
  };

  const elements = [];
  let counter = 0;

  // ctx carries inherited presentation values from ancestor elements.
  function walk(node, ctx = rootCtx) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();

    // Resolve presentation attributes with inheritance fallback.
    const rawFill   = sv(node, 'fill');
    const rawStroke = sv(node, 'stroke');
    const rawSW     = sv(node, 'stroke-width');
    const rawOp     = sv(node, 'opacity');
    const fill        = (rawFill   !== null && rawFill   !== 'inherit') ? rawFill   : ctx.fill;
    const stroke      = (rawStroke !== null && rawStroke !== 'inherit') ? rawStroke : ctx.stroke;
    const strokeWidth = rawSW !== null ? (parseFloat(rawSW) || 0) : ctx.strokeWidth;
    const opacity     = rawOp !== null ? parseFloat(rawOp)  : ctx.opacity;

    const id         = node.getAttribute('id') || `${tag}_${++counter}`;
    const display    = sv(node, 'display');
    const strokeDash    = parseStrokeDash(node);
    const strokeLinecap = sv(node, 'stroke-linecap') || 'butt';

    // Context to pass into child elements.
    const childCtx = { fill, stroke, strokeWidth, opacity };

    switch (tag) {
      case 'rect': {
        const x = parseFloat(node.getAttribute('x')) || 0;
        const y = parseFloat(node.getAttribute('y')) || 0;
        const width = parseFloat(node.getAttribute('width')) || 100;
        const height = parseFloat(node.getAttribute('height')) || 100;
        const rx = parseFloat(node.getAttribute('rx')) || 0;
        // Skip full-canvas background rects (white/none fill, no stroke, covering whole canvas)
        const normalFill = fill.replace(/\s/g, '').toLowerCase();
        const isBackground = x === 0 && y === 0 &&
          width >= canvasSize.width && height >= canvasSize.height &&
          stroke === 'none' && strokeWidth === 0 &&
          (normalFill === 'white' || normalFill === '#fff' || normalFill === '#ffffff' ||
           normalFill === 'rgb(255,255,255)' || normalFill === 'none');
        if (isBackground) break;
        elements.push({
          id, type: 'rect', x, y, width, height,
          rx, ry: rx, fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'circle': {
        const cx = parseFloat(node.getAttribute('cx')) || 0;
        const cy = parseFloat(node.getAttribute('cy')) || 0;
        const r = parseFloat(node.getAttribute('r')) || 50;
        elements.push({
          id, type: 'circle',
          x: cx - r, y: cy - r, width: r * 2, height: r * 2,
          fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'ellipse': {
        const cx = parseFloat(node.getAttribute('cx')) || 0;
        const cy = parseFloat(node.getAttribute('cy')) || 0;
        const rx = parseFloat(node.getAttribute('rx')) || 50;
        const ry = parseFloat(node.getAttribute('ry')) || 50;
        elements.push({
          id, type: 'circle',
          x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2,
          fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'text':
      case 'tspan': {
        if (tag === 'tspan' && node.parentElement?.tagName?.toLowerCase() === 'text') {
          break;
        }
        const x = parseFloat(node.getAttribute('x')) || 0;
        const y = parseFloat(node.getAttribute('y')) || 0;
        const fontSizeRaw = sv(node, 'font-size');
        const fontSize = parseFloat(fontSizeRaw) || 24;
        const tspans = Array.from(node.children || []).filter(
          (child) => child.tagName?.toLowerCase() === 'tspan',
        );
        const text = tspans.length
          ? tspans.map((child) => child.textContent || '').join('\n')
          : (node.textContent || '');
        const fontWeight  = sv(node, 'font-weight')  || 'normal';
        const fontFamily  = sv(node, 'font-family')  || 'sans-serif';
        const textAnchor  = sv(node, 'text-anchor')  || 'start';
        const textFill    = sv(node, 'fill') ?? fill ?? '#000';
        const lineHeight = (() => {
          if (tspans.length < 2) return 1.2;
          const dy = parseFloat(tspans[1].getAttribute('dy'));
          return Number.isFinite(dy) && fontSize > 0 ? dy / fontSize : 1.2;
        })();
        elements.push({
          id, type: 'text',
          x, y: y - fontSize,
          width: Math.max(text.length * fontSize * 0.6, 80),
          height: Math.max(fontSize * lineHeight, text.split('\n').length * fontSize * lineHeight),
          text, fontSize, fontWeight, fontFamily, textAnchor,
          lineHeight,
          fill: textFill, stroke: 'none', strokeWidth: 0,
          strokeDash: 'solid', strokeLinecap: 'butt', opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'image': {
        const x = parseFloat(node.getAttribute('x')) || 0;
        const y = parseFloat(node.getAttribute('y')) || 0;
        const width = parseFloat(node.getAttribute('width')) || 200;
        const height = parseFloat(node.getAttribute('height')) || 150;
        const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
        elements.push({
          id, type: 'image',
          x, y, width, height, href,
          fill: '#cbd5e1', stroke: 'none', strokeWidth: 0,
          strokeDash: 'solid', strokeLinecap: 'butt', opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'path': {
        const d = node.getAttribute('d') || '';
        if (!d) break;
        // Use pre-computed bbox if available (round-tripped from our serializer)
        const dbx = parseFloat(node.getAttribute('data-bbox-x'));
        const dby = parseFloat(node.getAttribute('data-bbox-y'));
        const dbw = parseFloat(node.getAttribute('data-bbox-w'));
        const dbh = parseFloat(node.getAttribute('data-bbox-h'));
        let bbox = (!isNaN(dbx) && !isNaN(dby) && dbw > 0 && dbh > 0)
          ? { x: dbx, y: dby, width: dbw, height: dbh }
          : getPathBbox(d);
        if (!bbox) break;
        elements.push({
          id, type: 'path', d,
          x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
          bboxX: bbox.x, bboxY: bbox.y, bboxWidth: bbox.width, bboxHeight: bbox.height,
          fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'polyline': {
        // Convert to path so it benefits from the same bbox measurement.
        const points = node.getAttribute('points') || '';
        if (!points.trim()) break;
        const nums = [];
        for (const tok of points.trim().split(/[\s,]+/)) {
          const n = parseFloat(tok);
          if (!isNaN(n)) nums.push(n);
        }
        if (nums.length < 4) break;
        let d = `M ${nums[0]} ${nums[1]}`;
        for (let i = 2; i + 1 < nums.length; i += 2) d += ` L ${nums[i]} ${nums[i + 1]}`;
        const bbox = getPathBbox(d);
        if (!bbox) break;
        elements.push({
          id, type: 'path', d,
          x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
          bboxX: bbox.x, bboxY: bbox.y, bboxWidth: bbox.width, bboxHeight: bbox.height,
          fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'line': {
        const x1 = parseFloat(node.getAttribute('x1')) || 0;
        const y1 = parseFloat(node.getAttribute('y1')) || 0;
        const x2 = parseFloat(node.getAttribute('x2')) || 100;
        const y2 = parseFloat(node.getAttribute('y2')) || 100;
        elements.push({
          id, type: 'line',
          x: x1, y: y1, width: x2 - x1, height: y2 - y1,
          fill: 'none',
          stroke: stroke !== 'none' ? stroke : '#000',
          strokeWidth: strokeWidth || 2,
          strokeDash, strokeLinecap, opacity,
          visible: display !== 'none', locked: false, description: '',
        });
        break;
      }
      case 'polygon': {
        const dataType = node.getAttribute('data-type');
        if (dataType === 'polygon') {
          const x = parseFloat(node.getAttribute('data-x')) || 0;
          const y = parseFloat(node.getAttribute('data-y')) || 0;
          const width = parseFloat(node.getAttribute('data-width')) || 140;
          const height = parseFloat(node.getAttribute('data-height')) || 140;
          const sides = parseInt(node.getAttribute('data-sides')) || 6;
          elements.push({
            id, type: 'polygon', x, y, width, height, sides,
            fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
            visible: display !== 'none', locked: false, description: '',
          });
        } else if (dataType === 'star') {
          const x = parseFloat(node.getAttribute('data-x')) || 0;
          const y = parseFloat(node.getAttribute('data-y')) || 0;
          const width = parseFloat(node.getAttribute('data-width')) || 140;
          const height = parseFloat(node.getAttribute('data-height')) || 140;
          const arms = parseInt(node.getAttribute('data-arms')) || 5;
          const innerRatio = parseFloat(node.getAttribute('data-inner-ratio')) || 0.4;
          elements.push({
            id, type: 'star', x, y, width, height, arms, innerRatio,
            fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
            visible: display !== 'none', locked: false, description: '',
          });
        } else {
          // Raw polygon from external SVG — convert points to a path.
          const points = node.getAttribute('points') || '';
          const d = polygonPointsToPath(points);
          if (!d) break;
          const bbox = getPathBbox(d);
          if (!bbox) break;
          elements.push({
            id, type: 'path', d,
            x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
            bboxX: bbox.x, bboxY: bbox.y, bboxWidth: bbox.width, bboxHeight: bbox.height,
            fill, stroke, strokeWidth, strokeDash, strokeLinecap, opacity,
            visible: display !== 'none', locked: false, description: '',
          });
        }
        break;
      }
      case 'g': {
        const dataType = node.getAttribute('data-type');
        if (dataType === 'arrow') {
          const x = parseFloat(node.getAttribute('data-x')) || 0;
          const y = parseFloat(node.getAttribute('data-y')) || 0;
          const width = parseFloat(node.getAttribute('data-width')) || 200;
          const height = parseFloat(node.getAttribute('data-height')) || 0;
          const arrowStart = node.getAttribute('data-arrow-start') === 'true';
          const arrowEnd = node.getAttribute('data-arrow-end') === 'true';
          const arrowStroke = node.getAttribute('data-stroke') || stroke || '#000';
          const arrowSW = parseFloat(node.getAttribute('data-stroke-width')) || strokeWidth || 2;
          const lineNode = node.querySelector('line');
          const aDash = lineNode ? parseStrokeDash(lineNode) : 'solid';
          const aLinecap = lineNode ? (sv(lineNode, 'stroke-linecap') || 'butt') : 'butt';
          elements.push({
            id, type: 'arrow', x, y, width, height,
            fill: 'none', stroke: arrowStroke, strokeWidth: arrowSW,
            strokeDash: aDash, strokeLinecap: aLinecap,
            arrowStart, arrowEnd, opacity,
            visible: display !== 'none', locked: false, description: '',
          });
        } else {
          for (const child of node.children) walk(child, childCtx);
        }
        break;
      }
      default:
        for (const child of node.children) walk(child, childCtx);
        break;
    }
  }

  for (const child of svg.children) walk(child, rootCtx);

  return { elements, canvasSize };
}
