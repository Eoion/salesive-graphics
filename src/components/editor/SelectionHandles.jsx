import { HANDLE_IDS } from '../../editor/editorConstants.js';

const HANDLE_SIZE = 8;
const HALF = HANDLE_SIZE / 2;
const ROTATE_OFFSET = 22;

const CURSORS = {
  nw: 'var(--cursor-nw-resize)', n: 'var(--cursor-n-resize)', ne: 'var(--cursor-ne-resize)', e: 'var(--cursor-e-resize)',
  se: 'var(--cursor-nw-resize)', s: 'var(--cursor-s-resize)', sw: 'var(--cursor-ne-resize)', w: 'var(--cursor-w-resize)',
};

function handlePos(id, x, y, w, h) {
  const mx = x + w / 2;
  const my = y + h / 2;
  switch (id) {
    case 'nw': return { hx: x,      hy: y      };
    case 'n':  return { hx: mx,     hy: y      };
    case 'ne': return { hx: x + w,  hy: y      };
    case 'e':  return { hx: x + w,  hy: my     };
    case 'se': return { hx: x + w,  hy: y + h  };
    case 's':  return { hx: mx,     hy: y + h  };
    case 'sw': return { hx: x,      hy: y + h  };
    case 'w':  return { hx: x,      hy: my     };
    default:   return { hx: mx,     hy: my     };
  }
}

export default function SelectionHandles({ el, onHandlePointerDown }) {
  if (!el) return null;
  const { x, y, width: w, height: h, rotation } = el;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const padding = 1;

  const rotateHandleCx = cx;
  const rotateHandleCy = y - ROTATE_OFFSET;

  return (
    <g transform={rotation ? `rotate(${rotation},${cx},${cy})` : undefined} pointerEvents="none">
      {/* Selection border */}
      <rect
        x={x - padding} y={y - padding}
        width={w + padding * 2} height={h + padding * 2}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />

      {/* Rotation tether line */}
      <line
        x1={cx} y1={y}
        x2={rotateHandleCx} y2={rotateHandleCy}
        stroke="var(--accent)" strokeWidth={1}
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
      />

      {/* Rotation handle */}
      <circle
        data-handle="rotate"
        cx={rotateHandleCx} cy={rotateHandleCy} r={5}
        fill="white"
        stroke="var(--accent)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        style={{ cursor: 'var(--cursor-crosshair)', pointerEvents: 'all' }}
        onPointerDown={e => onHandlePointerDown(e, el.id)}
      />

      {/* Resize handles */}
      {HANDLE_IDS.map(id => {
        const { hx, hy } = handlePos(id, x, y, w, h);
        return (
          <rect
            key={id}
            data-handle={id}
            x={hx - HALF} y={hy - HALF}
            width={HANDLE_SIZE} height={HANDLE_SIZE}
            fill="white"
            stroke="var(--accent)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: CURSORS[id], pointerEvents: 'all' }}
            onPointerDown={e => onHandlePointerDown(e, el.id)}
          />
        );
      })}
    </g>
  );
}
