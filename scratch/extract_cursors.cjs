const fs = require('fs');
const path = require('path');

const ICON_DIR = '/home/bash/Documents/design-icons/icons/bulk-rounded';
const MAPPING = {
  'default': { file: 'cursor01.svg', hot: [0, 0] },
  'pointer': { file: 'cursor-pointer01.svg', hot: [0, 0] },
  'move': { file: 'move.svg', hot: [12, 12] },
  'text': { file: 'text.svg', hot: [12, 12] },
  'crosshair': { file: 'cursor-rectangle-selection01.svg', hot: [12, 12] },
  'wait': { file: 'loading01.svg', hot: [12, 12] },
  'progress': { file: 'progress01.svg', hot: [12, 12] },
  'grab': { file: 'hand-grab.svg', hot: [12, 12] },
  'grabbing': { file: 'hand-grip.svg', hot: [12, 12] },
  'n-resize': { file: 'square-arrow-up01.svg', hot: [11, 11] },
  's-resize': { file: 'square-arrow-down01.svg', hot: [11, 11] },
  'e-resize': { file: 'square-arrow-right01.svg', hot: [11, 11] },
  'w-resize': { file: 'square-arrow-left01.svg', hot: [11, 11] },
  'ne-resize': { file: 'square-arrow-up-right01.svg', hot: [11, 11] },
  'nw-resize': { file: 'square-arrow-up-left01.svg', hot: [11, 11] },
  'se-resize': { file: 'square-arrow-down-right01.svg', hot: [11, 11] },
  'sw-resize': { file: 'square-arrow-down-left.svg', hot: [11, 11] },
  'not-allowed': { file: 'cursor-disabled01.svg', hot: [0, 0] }
};

let css = '/* Custom Cursors */\n:root {\n';
for (const [key, config] of Object.entries(MAPPING)) {
  const fullPath = path.join(ICON_DIR, config.file);
  if (fs.existsSync(fullPath)) {
    let svg = fs.readFileSync(fullPath, 'utf8');
    svg = svg.replace(/currentColor/g, '#0D65D9');
    const encoded = encodeURIComponent(svg.replace(/\r?\n|\r/g, "").replace(/"/g, "'"));
    css += `  --cursor-${key}: url("data:image/svg+xml,${encoded}") ${config.hot[0]} ${config.hot[1]}, auto;\n`;
  }
}
css += '}\n\n';

css += `
html, body { cursor: var(--cursor-default); }
a, button, [role="button"], .cursor-pointer { cursor: var(--cursor-pointer); }
input[type="text"], input[type="number"], textarea, .cursor-text { cursor: var(--cursor-text); }
.cursor-move { cursor: var(--cursor-move); }
.cursor-grab { cursor: var(--cursor-grab); }
.cursor-grabbing { cursor: var(--cursor-grabbing); }
[style*="cursor: ns-resize"], .cursor-ns-resize, .cursor-n-resize, .cursor-s-resize { cursor: var(--cursor-n-resize); }
[style*="cursor: ew-resize"], .cursor-ew-resize, .cursor-e-resize, .cursor-w-resize { cursor: var(--cursor-e-resize); }
[style*="cursor: nwse-resize"], .cursor-nwse-resize, .cursor-nw-resize, .cursor-se-resize { cursor: var(--cursor-nw-resize); }
[style*="cursor: nesw-resize"], .cursor-nesw-resize, .cursor-ne-resize, .cursor-sw-resize { cursor: var(--cursor-ne-resize); }
.cursor-crosshair { cursor: var(--cursor-crosshair); }
.cursor-not-allowed { cursor: var(--cursor-not-allowed); }
`;
console.log(css);
