let _idCounter = 0;
function genId() { return `node_${++_idCounter}`; }

function getStyleProp(el, prop) {
  const style = el.getAttribute('style') || '';
  const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  if (match) return match[1].trim();
  return el.getAttribute(prop) || null;
}

function getBBox(el) {
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width || rect.height) return rect;
  } catch {}
  return null;
}

const EDITABLE_TAGS = new Set(['text', 'image', 'rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'g', 'line', 'tspan']);

function inferType(tag, id, el) {
  const idLower = (id || '').toLowerCase();
  if (tag === 'text' || tag === 'tspan') return 'text';
  if (tag === 'image') return 'image';
  if (/icon|logo_?icon|social/.test(idLower)) return 'icon';
  if (/color|bg|background|fill|primary|secondary|accent/.test(idLower)) return 'color';
  if (/logo|image|photo|hero|banner|picture/.test(idLower)) return 'image';
  if (/text|title|headline|subhead|cta|label|caption|body|copy/.test(idLower)) return 'text';
  if (tag === 'rect' || tag === 'circle' || tag === 'ellipse') return 'color';
  if (tag === 'g') return 'group';
  return 'shape';
}

function extractText(el) {
  return el.textContent?.trim().replace(/\s+/g, ' ') || null;
}

export function parseSVG(svgString) {
  _idCounter = 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return { nodes: [], canvas: null, raw: svgString };

  const vb = svgEl.getAttribute('viewBox');
  const width  = parseFloat(svgEl.getAttribute('width'))  || (vb ? parseFloat(vb.split(/[\s,]+/)[2]) : 800);
  const height = parseFloat(svgEl.getAttribute('height')) || (vb ? parseFloat(vb.split(/[\s,]+/)[3]) : 600);
  const canvas = { width, height, viewBox: vb || `0 0 ${width} ${height}` };

  const nodes = [];
  const seen = new Set();

  function walk(el, depth = 0) {
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase().replace(/.*:/, '');
    if (!EDITABLE_TAGS.has(tag)) { el.childNodes.forEach(c => walk(c, depth)); return; }
    if (tag === 'tspan' && depth > 0) return;

    const rawId = el.getAttribute('id') || null;
    const id = rawId || genId();

    if (!rawId) el.setAttribute('id', id);

    const type = inferType(tag, rawId, el);
    const fill   = getStyleProp(el, 'fill');
    const stroke = getStyleProp(el, 'stroke');
    const href   = el.getAttribute('href') || el.getAttribute('xlink:href') || null;
    const text   = (tag === 'text' || tag === 'tspan') ? extractText(el) : null;

    const node = {
      id,
      rawId,
      tag,
      type,
      depth,
      fill,
      stroke,
      href,
      text,
      visible: getStyleProp(el, 'display') !== 'none' && getStyleProp(el, 'visibility') !== 'hidden',
      dataType: el.getAttribute('data-template-type') || null,
      dataKey:  el.getAttribute('data-template-key')  || null,
    };

    if (!seen.has(id)) {
      seen.add(id);
      nodes.push(node);
    }

    if (tag !== 'g' || depth === 0) {
      el.childNodes.forEach(c => walk(c, depth + 1));
    }
  }

  svgEl.childNodes.forEach(c => walk(c, 0));

  return { nodes, canvas, raw: svgString, normalizedSvg: new XMLSerializer().serializeToString(doc) };
}

export function buildSchema(templateMeta, fields, canvas) {
  return {
    templateId: templateMeta.id || `template-${Date.now()}`,
    name: templateMeta.name || 'Untitled Template',
    canvas,
    fields: fields.map(f => {
      const base = {
        key: f.fieldKey,
        type: f.fieldType,
        label: f.label || f.fieldKey,
        required: f.required ?? false,
      };
      if (f.description) base.description = f.description;
      if (f.fieldType === 'color' && f.targets?.length > 1) {
        base.targets = f.targets.map(t => ({ selector: `#${t.id}`, attr: t.attr || 'fill' }));
      } else {
        base.target = { selector: `#${f.nodeId}` };
      }
      if (f.fieldType === 'text') {
        if (f.maxLength)    base.maxLength    = f.maxLength;
        if (f.autoShrink)   base.autoShrink   = true;
        if (f.minFontSize)  base.minFontSize  = f.minFontSize;
        base.default = f.defaultValue || f.textContent || '';
      }
      if (f.fieldType === 'image') {
        base.fit = f.imageFit || 'cover';
        if (f.defaultValue) base.default = f.defaultValue;
      }
      if (f.fieldType === 'color') {
        base.default = f.defaultValue || '#000000';
      }
      if (f.fieldType === 'enum') {
        base.options = f.enumOptions || [];
        base.default = f.defaultValue || base.options[0] || '';
      }
      if (f.fieldType === 'boolean') {
        base.default = f.defaultValue ?? true;
      }
      return base;
    }),
  };
}

export function applySchema(svgString, schema, values) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  for (const field of schema.fields) {
    const value = values[field.key];
    if (value == null) continue;

    if (field.type === 'text') {
      const el = doc.querySelector(field.target?.selector);
      if (el) el.textContent = value;
    }
    if (field.type === 'image') {
      const el = doc.querySelector(field.target?.selector);
      if (el) {
        el.setAttribute('href', value);
        el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', value);
      }
    }
    if (field.type === 'color') {
      const targets = field.targets || (field.target ? [{ ...field.target, attr: 'fill' }] : []);
      for (const t of targets) {
        const el = doc.querySelector(t.selector);
        if (el) el.setAttribute(t.attr || 'fill', value);
      }
    }
  }

  return new XMLSerializer().serializeToString(doc);
}
