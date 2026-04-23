import { useRef, useEffect, useLayoutEffect, useState, useMemo } from "react";
import SelectionHandles from "./SelectionHandles.jsx";
import DuotoneIcon from "../DuotoneIcon.jsx";
import { ICONS } from "../../editor/duotoneIcons.js";
import { polygonPoints, starPoints, arrowheadPoints } from "../../editor/shapeHelpers.js";
import { colorizeInlineSvgHref } from "../../editor/svgIconHref.js";
import { freshId } from "../../editor/editorConstants.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DASH_PRESETS = { solid: undefined, dashed: '8,4', dotted: '2,4' };
function dashArray(d) { return DASH_PRESETS[d]; }

function rotTransform(el) {
    if (!el.rotation) return undefined;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return `rotate(${el.rotation},${cx},${cy})`;
}

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
}

function zoomAround(v, factor, cx, cy) {
    const newScale = clamp(v.scale * factor, 0.03, 30);
    return {
        scale: newScale,
        tx: cx - (cx - v.tx) * (newScale / v.scale),
        ty: cy - (cy - v.ty) * (newScale / v.scale),
    };
}

function rectsIntersect(a, b) {
    return !(
        a.x + a.width < b.x ||
        a.x > b.x + b.width ||
        a.y + a.height < b.y ||
        a.y > b.y + b.height
    );
}

// Returns the visual bounding box, adjusting x for SVG text anchor offsets
function elBounds(el) {
    if (el.type === 'text') {
        const vx = el.textAnchor === 'middle' ? el.x - el.width / 2
                 : el.textAnchor === 'end'    ? el.x - el.width
                 : el.x;
        return { x: vx, y: el.y, width: el.width, height: el.height };
    }
    return { x: el.x, y: el.y, width: el.width, height: el.height };
}

// ── Element renderers ─────────────────────────────────────────────────────────

function RenderPath({ el }) {
    const bboxX = el.bboxX ?? el.x;
    const bboxY = el.bboxY ?? el.y;
    const bboxW = el.bboxWidth ?? el.width;
    const bboxH = el.bboxHeight ?? el.height;
    const sx = bboxW > 0 ? el.width / bboxW : 1;
    const sy = bboxH > 0 ? el.height / bboxH : 1;
    const tx = el.x - bboxX * sx;
    const ty = el.y - bboxY * sy;
    const posTransform = `translate(${tx},${ty}) scale(${sx},${sy})`;
    const rot = rotTransform(el);
    const transform = rot ? `${rot} ${posTransform}` : posTransform;
    return (
        <path
            id={el.id}
            d={el.d || ''}
            fill={el.fill || 'none'}
            stroke={el.stroke !== 'none' ? el.stroke : 'none'}
            strokeWidth={el.strokeWidth || 0}
            strokeDasharray={dashArray(el.strokeDash)}
            strokeLinecap={el.strokeLinecap || 'butt'}
            opacity={el.opacity}
            transform={transform}
            display={el.visible === false ? 'none' : undefined}
        />
    );
}

function RenderRect({ el }) {
    return (
        <rect
            id={el.id}
            x={el.x}
            y={el.y}
            width={Math.max(el.width, 1)}
            height={Math.max(el.height, 1)}
            rx={el.rx || 0}
            ry={el.ry || 0}
            fill={el.fill || "none"}
            stroke={el.stroke !== "none" ? el.stroke : "none"}
            strokeWidth={el.strokeWidth || 0}
            strokeDasharray={dashArray(el.strokeDash)}
            strokeLinecap={el.strokeLinecap || "butt"}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        />
    );
}

function RenderCircle({ el }) {
    const cx = el.cx ?? ((el.x ?? 0) + (el.width ?? 0) / 2);
    const cy = el.cy ?? ((el.y ?? 0) + (el.height ?? 0) / 2);
    const rx = Math.max(el.rx ?? el.r ?? (el.width ?? 0) / 2, 1);
    const ry = Math.max(el.ry ?? el.r ?? (el.height ?? 0) / 2, 1);
    return (
        <ellipse
            id={el.id}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={el.fill || "none"}
            stroke={el.stroke !== "none" ? el.stroke : "none"}
            strokeWidth={el.strokeWidth || 0}
            strokeDasharray={dashArray(el.strokeDash)}
            strokeLinecap={el.strokeLinecap || "butt"}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        />
    );
}

function RenderText({ el }) {
    const fontSize = el.fontSize || 24;
    const lineHeight = el.lineHeight || 1.2;
    const lines = useMemo(() => (el.text || "").split("\n"), [el.text]);
    const baselineY = useMemo(() => el.y + fontSize, [el.y, fontSize]);

    return (
        <text
            id={el.id}
            x={el.x}
            y={baselineY}
            fontSize={fontSize}
            fontWeight={el.fontWeight || "normal"}
            fontFamily={el.fontFamily || "sans-serif"}
            textAnchor={el.textAnchor || "start"}
            fill={el.fill || "#000"}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
            style={{
                userSelect: "none",
                letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.textDecoration || "none",
                textTransform: el.textTransform || "none",
                whiteSpace: "pre",
            }}
        >
            {lines.map((line, i) => (
                <tspan
                    key={i}
                    x={el.x}
                    dy={i === 0 ? 0 : fontSize * lineHeight}
                >
                    {line || " "}
                </tspan>
            ))}
        </text>
    );
}



function RenderImage({ el }) {
    const hasHref = !!(el.href && el.href.trim());
    const processedHref = useMemo(() => {
        return hasHref ? colorizeInlineSvgHref(el.href, el.iconColors) : null;
    }, [el.href, el.iconColors, hasHref]);

    const rectProps = useMemo(() => ({
        x: el.x,
        y: el.y,
        width: Math.max(el.width, 1),
        height: Math.max(el.height, 1),
        fill: hasHref ? "none" : "#cbd5e1",
        stroke: hasHref ? "none" : "#94a3b8",
        strokeWidth: 1,
        strokeDasharray: hasHref ? "none" : "6 3",
    }), [el.x, el.y, el.width, el.height, hasHref]);

    return (
        <g
            id={el.id}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        >
            <rect {...rectProps} />
            {!hasHref && (
                <>
                    <line
                        x1={el.x}
                        y1={el.y}
                        x2={el.x + el.width}
                        y2={el.y + el.height}
                        stroke="#94a3b8"
                        strokeWidth={1}
                    />
                    <line
                        x1={el.x + el.width}
                        y1={el.y}
                        x2={el.x}
                        y2={el.y + el.height}
                        stroke="#94a3b8"
                        strokeWidth={1}
                    />
                </>
            )}
            {hasHref && (
                <image
                    href={processedHref}
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    preserveAspectRatio="xMidYMid slice"
                    style={el.cssFilter ? { filter: el.cssFilter } : undefined}
                />
            )}
        </g>
    );
}

function RenderLine({ el }) {
    const x1 = el.x1 ?? el.x ?? 0;
    const y1 = el.y1 ?? el.y ?? 0;
    const x2 = el.x2 ?? ((el.x ?? 0) + (el.width ?? 0));
    const y2 = el.y2 ?? ((el.y ?? 0) + (el.height ?? 0));
    return (
        <line
            id={el.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={el.stroke !== "none" ? el.stroke || "#000" : "#000"}
            strokeWidth={el.strokeWidth || 2}
            strokeDasharray={dashArray(el.strokeDash)}
            strokeLinecap={el.strokeLinecap || "butt"}
            opacity={el.opacity}
            display={el.visible === false ? "none" : undefined}
        />
    );
}

function RenderPolygon({ el }) {
    return (
        <polygon
            id={el.id}
            points={polygonPoints(el)}
            fill={el.fill || "none"}
            stroke={el.stroke !== "none" ? el.stroke : "none"}
            strokeWidth={el.strokeWidth || 0}
            strokeDasharray={dashArray(el.strokeDash)}
            strokeLinecap={el.strokeLinecap || "butt"}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        />
    );
}

function RenderStar({ el }) {
    return (
        <polygon
            id={el.id}
            points={starPoints(el)}
            fill={el.fill || "none"}
            stroke={el.stroke !== "none" ? el.stroke : "none"}
            strokeWidth={el.strokeWidth || 0}
            strokeDasharray={dashArray(el.strokeDash)}
            strokeLinecap={el.strokeLinecap || "butt"}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        />
    );
}

function RenderArrow({ el }) {
    const x1 = el.x, y1 = el.y, x2 = el.x + el.width, y2 = el.y + el.height;
    const sw = el.strokeWidth || 2;
    const color = el.stroke !== "none" ? (el.stroke || "#000") : "#000";
    return (
        <g id={el.id} opacity={el.opacity} display={el.visible === false ? "none" : undefined}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth={sw}
                strokeDasharray={dashArray(el.strokeDash)}
                strokeLinecap={el.strokeLinecap || "butt"} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
            {el.arrowEnd !== false && (
                <polygon points={arrowheadPoints(x1, y1, x2, y2, sw, 1)} fill={color} />
            )}
            {el.arrowStart && (
                <polygon points={arrowheadPoints(x1, y1, x2, y2, sw, -1)} fill={color} />
            )}
        </g>
    );
}

function ElementRenderer({ el }) {
    switch (el.type) {
        case "rect":    return <RenderRect    el={el} />;
        case "circle":  return <RenderCircle  el={el} />;
        case "text":    return <RenderText    el={el} />;
        case "image":   return <RenderImage   el={el} />;
        case "line":    return <RenderLine    el={el} />;
        case "polygon": return <RenderPolygon el={el} />;
        case "star":    return <RenderStar    el={el} />;
        case "arrow":   return <RenderArrow   el={el} />;
        case "path":    return <RenderPath    el={el} />;
        default:        return null;
    }
}

// ── Floating text editor ──────────────────────────────────────────────────────

function FloatingTextEditor({ el, scale, canvasRect, onCommit, onDismiss }) {
    if (!el || !canvasRect) return null;
    return (
        <textarea
            autoFocus
            defaultValue={el.text || ""}
            onBlur={(e) => onCommit(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Escape") onDismiss();
            }}
            style={{
                position: "fixed",
                left: canvasRect.left + el.x * scale,
                top: canvasRect.top + el.y * scale,
                width: Math.max(el.width * scale, 80),
                height: Math.max(el.height * scale, 28),
                zIndex: 200,
                background: "rgba(255,255,255,0.95)",
                border: "2px solid var(--accent)",
                borderRadius: 4,
                padding: "2px 4px",
                fontSize: (el.fontSize || 24) * scale,
                fontFamily: el.fontFamily || "sans-serif",
                fontWeight: el.fontWeight || "normal",
                color: "#000",
                resize: "none",
                outline: "none",
            }}
        />
    );
}

// ── Main component ────────────────────────────────────────────────────────────

const PICK_COLORS = {
    text: "#8B5CF6",
    rect: "#0D65D9",
    circle: "#EAB308",
    line: "#64748b",
    image: "#10B981",
    polygon: "#EC4899",
    star: "#F43F5E",
    arrow: "#6366F1",
};

export default function EditorCanvas({
    elements,
    defs,
    selectedId,
    selectedIds,
    setSelectedIds,
    canvasSize,
    onElementPointerDown,
    onPointerMove,
    onPointerUp,
    onCanvasPointerDown,
    onMarqueeEnd,
    activeTool,
    updateElement,
    updateElementLive,
    scaleRef,
    canvasRef,
    canvasCtrl,
    onViewportChange,
    pickerMode,
    onPick,
    eyedropperActive,
    onEyedrop,
    agentHighlightId,
    isWorking = false,
    inspectMode = false,
    addElement,
}) {
    const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });

    // Close menu on click outside
    useEffect(() => {
        if (!contextMenu.visible) return;
        const hide = () => setContextMenu({ x: 0, y: 0, visible: false });
        window.addEventListener("mousedown", hide);
        return () => window.removeEventListener("mousedown", hide);
    }, [contextMenu.visible]);

    function handleContextMenu(e) {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
    }

    function handleAddFromMenu(toolId) {
        const { x, y } = clientToCanvas(contextMenu.x, contextMenu.y);
        setContextMenu({ x: 0, y: 0, visible: false });

        if (toolId === 'select') return;
        if (toolId === 'eyedropper') return;

        // Default dimensions and styles for new elements
        const defaults = {
            rect: { width: 100, height: 100, fill: "#0D65D9" },
            circle: { width: 100, height: 100, fill: "#EAB308" },
            text: { width: 150, height: 40, text: "New Text", fontSize: 24, fill: "#000000" },
            polygon: { width: 100, height: 100, fill: "#EC4899", sides: 6 },
            star: { width: 100, height: 100, fill: "#F43F5E", spikes: 5, innerRadius: 0.5 },
            line: { width: 200, height: 0, stroke: "#64748B", strokeWidth: 2 },
            arrow: { width: 200, height: 0, stroke: "#6366F1", strokeWidth: 2 }
        };

        const config = defaults[toolId];
        if (!config) return;

        addElement({
            type: toolId,
            id: freshId(toolId),
            x: Math.round(x - (config.width / 2)),
            y: Math.round(y - (config.height / 2)),
            opacity: 1,
            visible: true,
            locked: false,
            stroke: config.stroke || 'none',
            strokeWidth: config.strokeWidth ?? 0,
            strokeDash: 'solid',
            strokeLinecap: 'butt',
            description: '',
            ...config
        });
    }

    const outerRef = useRef();
    const svgRef = useRef();

    // ── Viewport Persistence ──────────────────────────────────────────────────
    const [viewport, setViewport] = useState(() => {
        try {
            const saved = localStorage.getItem('salesive_editor_viewport');
            if (saved) return JSON.parse(saved);
        } catch {}
        return { scale: 1, tx: 0, ty: 0 };
    });
    const [fitted, setFitted] = useState(() => {
        try {
            const saved = localStorage.getItem('salesive_editor_viewport');
            return !!saved;
        } catch { return false; }
    });

    useEffect(() => {
        try {
            localStorage.setItem('salesive_editor_viewport', JSON.stringify(viewport));
        } catch {}
    }, [viewport]);

    const [textEditId, setTextEditId] = useState(null);
    const [hoveredPickId, setHoveredPickId] = useState(null);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [ctrlHeld, setCtrlHeld] = useState(false);
    const [marquee, setMarquee] = useState(null); // { x, y, w, h }
    const marqueeStartRef = useRef(null); // { x, y }
    const panningRef = useRef(null);

    // ── Sync viewport to scaleRef + callback ──────────────────────────────────
    useEffect(() => {
        if (scaleRef) scaleRef.current = viewport.scale;
        onViewportChange?.(viewport);
    }, [viewport]);

    // ── Fit to screen ─────────────────────────────────────────────────────────
    function fitViewport() {
        const outer = outerRef.current;
        if (!outer) return;
        const { width: ow, height: oh } = outer.getBoundingClientRect();
        if (!ow || !oh) return;

        const fitScale = Math.min(ow / canvasSize.width, oh / canvasSize.height) * 0.92;
        const newViewport = {
            scale: fitScale,
            tx: (ow - canvasSize.width * fitScale) / 2,
            ty: (oh - canvasSize.height * fitScale) / 2,
        };

        setViewport(newViewport);
        setFitted(true);
    }

    // ── Populate canvasCtrl API ───────────────────────────────────────────────
    useEffect(() => {
        if (!canvasCtrl) return;
        canvasCtrl.current = {
            textEdit: (id) => setTextEditId(id),
            getViewport: () => viewport,
            fitViewport,
            zoomIn: () =>
                setViewport((v) => {
                    const r = outerRef.current?.getBoundingClientRect();
                    return zoomAround(
                        v,
                        1.2,
                        r ? r.width / 2 : 400,
                        r ? r.height / 2 : 300,
                    );
                }),
            zoomOut: () =>
                setViewport((v) => {
                    const r = outerRef.current?.getBoundingClientRect();
                    return zoomAround(
                        v,
                        0.8,
                        r ? r.width / 2 : 400,
                        r ? r.height / 2 : 300,
                    );
                }),
            setZoomPct: (pct) =>
                setViewport((v) => {
                    const r = outerRef.current?.getBoundingClientRect();
                    const cx = r ? r.width / 2 : 400;
                    const cy = r ? r.height / 2 : 300;
                    const newScale = clamp(pct / 100, 0.03, 30);
                    return {
                        scale: newScale,
                        tx: cx - (cx - v.tx) * (newScale / v.scale),
                        ty: cy - (cy - v.ty) * (newScale / v.scale),
                    };
                }),
        };
    });

    // ── Initial fit ───────────────────────────────────────────────────────────
    const firstRun = useRef(true);
    useEffect(() => {
        if (!outerRef.current) return;
        const obs = new ResizeObserver(() => {
            if (firstRun.current) {
                firstRun.current = false;
                if (fitted) return;
            }
            fitViewport();
        });
        obs.observe(outerRef.current);
        return () => obs.disconnect();
    }, [canvasSize]);

    // ── Wheel zoom ────────────────────────────────────────────────────────────
    useEffect(() => {
        const el = outerRef.current;
        if (!el) return;
        function onWheel(e) {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            setViewport((v) => zoomAround(v, e.deltaY > 0 ? 0.9 : 1.1, mx, my));
        }
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    // ── Space / Ctrl key ──────────────────────────────────────────────────────
    useEffect(() => {
        function onKeyDown(e) {
            if (
                e.code === "Space" &&
                e.target.tagName !== "INPUT" &&
                e.target.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                setSpaceHeld(true);
            }
            if (e.key === "Control") setCtrlHeld(true);
        }
        function onKeyUp(e) {
            if (e.code === "Space") setSpaceHeld(false);
            if (e.key === "Control") setCtrlHeld(false);
        }
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // Auto-measure text elements and sync width/height to actual rendered bbox
    useLayoutEffect(() => {
        const svg = svgRef.current;
        if (!svg || !updateElementLive) return;
        for (const el of elements) {
            if (el.type !== 'text') continue;
            const node = svg.querySelector(`[id="${el.id}"]`);
            if (!node) continue;
            try {
                const bbox = node.getBBox();
                if (bbox.width < 1) continue;
                if (Math.abs(bbox.width - el.width) > 1 || Math.abs(bbox.height - el.height) > 1) {
                    updateElementLive(el.id, { width: bbox.width, height: bbox.height });
                }
            } catch {}
        }
    }, [elements]);

    const selectedEl = elements.find((e) => e.id === selectedId) || null;
    const textEditEl = elements.find((e) => e.id === textEditId) || null;
    const canvasRect = svgRef.current?.getBoundingClientRect() || null;

    function handleDoubleClick(elId) {
        const el = elements.find((el) => el.id === elId);
        if (el?.type === "text") setTextEditId(elId);
    }

    function commitTextEdit(value) {
        if (textEditId) {
            updateElement(textEditId, { text: value });
            setTextEditId(null);
        }
    }

    // ── Shared marquee coordinate helper ─────────────────────────────────────
    function clientToCanvas(clientX, clientY) {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return { x: 0, y: 0 };
        const scale = scaleRef?.current || 1;
        return { x: (clientX - svgRect.left) / scale, y: (clientY - svgRect.top) / scale };
    }

    // ── Pan and pointer routing ───────────────────────────────────────────────
    function handleOuterPointerDown(e) {
        if (spaceHeld || e.button === 1 || e.ctrlKey) {
            e.preventDefault();
            panningRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                tx: viewport.tx,
                ty: viewport.ty,
            };
            outerRef.current?.setPointerCapture(e.pointerId);
        } else if (activeTool === 'select' && !(pickerMode || eyedropperActive)) {
            // Start marquee from outside the SVG canvas
            const clickedInsideCanvas = svgRef.current?.contains(e.target);
            if (!clickedInsideCanvas) {
                e.preventDefault();
                const { x: startX, y: startY } = clientToCanvas(e.clientX, e.clientY);
                marqueeStartRef.current = { x: startX, y: startY };
                setMarquee({ x: startX, y: startY, width: 0, height: 0 });
                setSelectedIds([]);
                outerRef.current?.setPointerCapture(e.pointerId);
            }
        }
    }

    function handleOuterPointerMove(e) {
        const pan = panningRef.current;
        if (pan) {
            const dx = e.clientX - pan.clientX;
            const dy = e.clientY - pan.clientY;
            const startTx = pan.tx;
            const startTy = pan.ty;
            
            setViewport((v) => ({
                ...v,
                tx: startTx + dx,
                ty: startTy + dy,
            }));
        } else if (marqueeStartRef.current && !isPanMode) {
            // Update marquee (handles both inside-canvas and outside-canvas drags)
            const { x: curX, y: curY } = clientToCanvas(e.clientX, e.clientY);
            const start = marqueeStartRef.current;
            setMarquee({
                x: Math.min(start.x, curX),
                y: Math.min(start.y, curY),
                width: Math.abs(curX - start.x),
                height: Math.abs(curY - start.y),
            });
        } else {
            onPointerMove(e);
        }
    }

    function handleOuterPointerUp(e) {
        if (panningRef.current) {
            panningRef.current = null;
        } else if (marqueeStartRef.current) {
            marqueeStartRef.current = null;
            if (marquee) {
                const intersecting = elements.filter(el =>
                    el.visible !== false && !el.locked &&
                    rectsIntersect(marquee, elBounds(el))
                );
                setSelectedIds(intersecting.map(el => el.id));
                setMarquee(null);
                onMarqueeEnd?.(intersecting.map(el => el.id));
            } else {
                setMarquee(null);
            }
        } else {
            onPointerUp(e);
        }
    }

    const CURSOR_MAP = {
        select: "var(--cursor-default)",
        rect: "var(--cursor-crosshair)",
        circle: "var(--cursor-crosshair)",
        text: "var(--cursor-text)",
        image: "var(--cursor-crosshair)",
        line: "var(--cursor-crosshair)",
        polygon: "var(--cursor-crosshair)",
        star: "var(--cursor-crosshair)",
        arrow: "var(--cursor-crosshair)",
        eyedropper: "var(--cursor-crosshair)",
    };
    const isPanMode = spaceHeld || ctrlHeld;
    const isOverlayMode = pickerMode || eyedropperActive || inspectMode;
    const outerCursor = isOverlayMode
        ? "var(--cursor-crosshair)"
        : isPanMode
          ? panningRef.current
              ? "var(--cursor-grabbing)"
              : "var(--cursor-grab)"
          : CURSOR_MAP[activeTool] || "var(--cursor-default)";

    const hoveredEl = isOverlayMode
        ? elements.find((e) => e.id === hoveredPickId) || null
        : null;
    const pickColor = hoveredEl
        ? PICK_COLORS[hoveredEl.type] || "#0D65D9"
        : "#0D65D9";

    // ── Marquee selection ─────────────────────────────────────────────────────
    function handleSvgPointerDown(e) {
        if (isPanMode || pickerMode || eyedropperActive) return;

        // Non-select tool: place a new element at click position
        if (activeTool !== 'select') {
            onCanvasPointerDown?.(e);
            return;
        }

        // Select mode: start marquee. Element clicks stop propagation before reaching here.
        e.preventDefault();
        const { x: startX, y: startY } = clientToCanvas(e.clientX, e.clientY);
        marqueeStartRef.current = { x: startX, y: startY };
        setMarquee({ x: startX, y: startY, width: 0, height: 0 });
        setSelectedIds([]);
    }

    function handleSvgPointerMove(e) {
        // Marquee coordinate updates are handled in handleOuterPointerMove via bubbling.
        // Just suppress default to avoid text selection.
        if (marqueeStartRef.current && !isPanMode) e.preventDefault();
    }

    function handleSvgPointerUp() {
        // Delegated to handleOuterPointerUp via event bubbling.
    }

    return (
        <div
            ref={outerRef}
            className="grid-bg"
            style={{
                flex: 1,
                overflow: "hidden",
                position: "relative",
                cursor: outerCursor,
                opacity: fitted ? 1 : 0,
                transition: "opacity 0.15s ease-in-out",
            }}
            onPointerDown={handleOuterPointerDown}
            onPointerMove={handleOuterPointerMove}
            onPointerUp={handleOuterPointerUp}
            onContextMenu={handleContextMenu}
        >
            {isWorking && (
               <div className="ai-working-border" style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none' }} />
            )}
            {/* Viewport-transformed canvas */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `translate(${viewport.tx}px,${viewport.ty}px) scale(${viewport.scale})`,
                    transformOrigin: "0 0",
                    lineHeight: 0,
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                    backgroundImage:
                        "linear-gradient(45deg,#d0d0d0 25%,transparent 25%),linear-gradient(-45deg,#d0d0d0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d0d0d0 75%),linear-gradient(-45deg,transparent 75%,#d0d0d0 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                    backgroundColor: "#f8f8f8",
                }}
            >

                {/* Content SVG */}
                <svg
                    ref={(el) => {
                        svgRef.current = el;
                        if (canvasRef) canvasRef.current = el;
                    }}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                    style={{
                        display: "block",
                        cursor: isPanMode
                            ? "inherit"
                            : CURSOR_MAP[activeTool] || "var(--cursor-default)",
                    }}
                    onPointerDown={handleSvgPointerDown}
                    onPointerMove={handleSvgPointerMove}
                    onPointerUp={() => handleSvgPointerUp()}
                >
                    {/* Defs: gradients, variables, keyframes */}
                    <defs>
                        {defs?.gradients?.map(g => {
                            const stops = g.stops?.map((s, i) =>
                                <stop key={i} offset={s.offset} stopColor={s.stopColor} stopOpacity={s.stopOpacity ?? 1} />
                            );
                            if (g.type === 'radial') {
                                return <radialGradient key={g.id} id={g.id} cx={g.cx || '50%'} cy={g.cy || '50%'} r={g.r || '50%'}>{stops}</radialGradient>;
                            }
                            return <linearGradient key={g.id} id={g.id} x1={g.x1 || '0%'} y1={g.y1 || '0%'} x2={g.x2 || '100%'} y2={g.y2 || '0%'}>{stops}</linearGradient>;
                        })}
                        {(defs?.variables?.length || defs?.keyframes?.length) ? (
                            <style>{`
                                ${defs.variables?.map(v => `--${v.name}: ${v.value};`).join('\n') || ''}
                                ${defs.keyframes?.map(k => k.css).join('\n') || ''}
                            `}</style>
                        ) : null}
                    </defs>
                    {elements.map((el) => (
                        <g
                            key={el.id}
                            style={{
                                cursor: isOverlayMode
                                    ? "var(--cursor-crosshair)"
                                    : activeTool === "select"
                                      ? el.locked
                                          ? "var(--cursor-not-allowed)"
                                          : "var(--cursor-move)"
                                      : "var(--cursor-crosshair)",
                                pointerEvents: el.locked ? "none" : undefined,
                                ...(el.animation ? {
                                    animation: `${el.animation.name || el.animation.type} ${el.animation.duration || 1}s ${el.animation.easing || 'ease'} ${el.animation.delay || 0}s ${el.animation.repeat === 'infinite' ? 'infinite' : (el.animation.repeat || 1)} forwards`,
                                } : {}),
                            }}
                            onPointerEnter={
                                isOverlayMode
                                    ? () => setHoveredPickId(el.id)
                                    : undefined
                            }
                            onPointerLeave={
                                isOverlayMode
                                    ? () => setHoveredPickId((id) => id === el.id ? null : id)
                                    : undefined
                            }
                            onPointerDown={
                                pickerMode
                                    ? (e) => { e.stopPropagation(); onPick?.(el.id); }
                                    : eyedropperActive
                                      ? (e) => { e.stopPropagation(); onEyedrop?.(el.id, e.shiftKey, e.clientX, e.clientY); }
                                      : isPanMode
                                        ? undefined
                                        : (e) => onElementPointerDown(e, el.id)
                            }
                            onDoubleClick={
                                (pickerMode || eyedropperActive) ? undefined : () => handleDoubleClick(el.id)
                            }
                        >
                            <ElementRenderer el={el} />
                            {el.type === "line" && (
                                <line
                                    x1={el.x}
                                    y1={el.y}
                                    x2={el.x + el.width}
                                    y2={el.y + el.height}
                                    stroke="transparent"
                                    strokeWidth={12}
                                />
                            )}
                            {el.type === "text" && (() => {
                                const b = elBounds(el);
                                return (
                                    <rect
                                        x={b.x}
                                        y={b.y}
                                        width={Math.max(b.width, 1)}
                                        height={Math.max(b.height, 1)}
                                        fill="transparent"
                                        stroke="none"
                                        transform={rotTransform(el)}
                                    />
                                );
                            })()}
                        </g>
                    ))}
                </svg>

                {/* Handles overlay */}
                <svg
                    width={canvasSize.width}
                    height={canvasSize.height}
                    viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                    style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        overflow: "visible",
                    }}
                >
                    {/* Agent highlight ring */}
                    {agentHighlightId && (() => {
                        const el = elements.find(e => e.id === agentHighlightId);
                        if (!el || el.visible === false) return null;
                        const b = elBounds(el);
                        return (
                            <rect
                                x={b.x - 4} y={b.y - 4}
                                width={Math.max(b.width, 1) + 8} height={Math.max(b.height, 1) + 8}
                                fill="none" stroke="var(--accent)" strokeWidth={2}
                                rx={4} ry={4}
                                transform={rotTransform(el)}
                                style={{ animation: 'agentHighlight 1s ease-in-out infinite' }}
                                strokeDasharray="6 3"
                            />
                        );
                    })()}
                    {/* Multi-selection outlines */}
                    {selectedIds.length > 1 && selectedIds
                        .filter(id => id !== selectedId)
                        .map(id => {
                            const el = elements.find(e => e.id === id);
                            if (!el || el.visible === false) return null;
                            const b = elBounds(el);
                            return (
                                <rect
                                    key={id}
                                    x={b.x} y={b.y}
                                    width={Math.max(b.width, 1)} height={Math.max(b.height, 1)}
                                    fill="none" stroke="var(--accent)" strokeWidth={1}
                                    transform={rotTransform(el)}
                                    strokeDasharray="4 3"
                                />
                            );
                        })}
                    {selectedEl && (
                        <SelectionHandles
                            el={{ ...selectedEl, ...elBounds(selectedEl) }}
                            color="#0D65D9"
                            onHandlePointerDown={onElementPointerDown}
                        />
                    )}
                </svg>

                {/* Marquee overlay */}
                {marquee && (
                    <svg
                        width={canvasSize.width}
                        height={canvasSize.height}
                        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                        overflow="visible"
                        style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                        }}
                    >
                        <rect
                            x={marquee.x}
                            y={marquee.y}
                            width={marquee.width}
                            height={marquee.height}
                            fill="rgba(13,101,217,0.1)"
                            stroke="var(--accent)"
                            strokeWidth={1}
                            strokeDasharray="4 2"
                        />
                    </svg>
                )}

                {/* Picker / eyedropper overlay */}
                {isOverlayMode && hoveredEl && (() => {
                    const pb = elBounds(hoveredEl);
                    return (
                    <div
                        style={{
                            position: "absolute",
                            left: pb.x,
                            top: pb.y,
                            width: pb.width,
                            height: pb.height,
                            outline: `2px solid ${pickColor}`,
                            background: `${pickColor}18`,
                            pointerEvents: "none",
                            transform: hoveredEl.rotation
                                ? `rotate(${hoveredEl.rotation}deg)`
                                : undefined,
                            transformOrigin: `${hoveredEl.width / 2}px ${hoveredEl.height / 2}px`,
                        }}
                    >
                        {/* Label badge / eyedropper swatch */}
                        {eyedropperActive ? (
                            <div style={{
                                position: "absolute", top: -26, left: 0,
                                display: "flex", alignItems: "center", gap: 4,
                                pointerEvents: "none",
                            }}>
                                {hoveredEl.fill && hoveredEl.fill !== "none" && (
                                    <div title={`Fill: ${hoveredEl.fill}`} style={{
                                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                                        background: hoveredEl.fill,
                                        border: "1px solid rgba(255,255,255,0.7)",
                                        outline: "1px solid rgba(0,0,0,0.25)",
                                    }} />
                                )}
                                {hoveredEl.stroke && hoveredEl.stroke !== "none" && (
                                    <div title={`Stroke: ${hoveredEl.stroke}`} style={{
                                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                                        background: hoveredEl.stroke,
                                        border: "1px solid rgba(255,255,255,0.7)",
                                        outline: "1px solid rgba(0,0,0,0.25)",
                                    }} />
                                )}
                                <span style={{
                                    fontSize: 9, color: "#fff", fontFamily: "DM Mono, monospace",
                                    background: "rgba(0,0,0,0.7)", padding: "2px 8px", borderRadius: 20,
                                    display: "flex", alignItems: "center", lineHeight: "normal",
                                    zIndex: 10,
                                }}>
                                    {hoveredEl.id}
                                </span>
                            </div>
                        ) : (
                            <div style={{
                                position: "absolute", top: -24, left: 0,
                                background: pickColor, color: "#fff",
                                fontSize: 10, fontFamily: "DM Mono, monospace", fontWeight: 600,
                                padding: "2px 10px", borderRadius: 20, whiteSpace: "nowrap",
                                display: "flex", alignItems: "center", lineHeight: "normal",
                                pointerEvents: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                                zIndex: 10,
                            }}>
                                {hoveredEl.id} · {hoveredEl.type} · {Math.round(hoveredEl.width)}×{Math.round(hoveredEl.height)}
                            </div>
                        )}
                        {/* Corner dots */}
                        {[
                            [-3, -3],
                            ["calc(100% - 3px)", -3],
                            [-3, "calc(100% - 3px)"],
                            ["calc(100% - 3px)", "calc(100% - 3px)"],
                        ].map(([l, t], i) => (
                            <div
                                key={i}
                                style={{
                                    position: "absolute",
                                    left: l,
                                    top: t,
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: pickColor,
                                }}
                            />
                        ))}
                    </div>
                    );
                })()}

                {/* Floating text editor */}
                {textEditEl && (
                    <FloatingTextEditor
                        el={textEditEl}
                        scale={viewport.scale}
                        canvasRect={canvasRect}
                        onCommit={commitTextEdit}
                        onDismiss={() => setTextEditId(null)}
                    />
                )}

                {/* ── Context Menu Overlay ── */}
                {contextMenu.visible && (
                    <div style={{
                        position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
                        background: 'rgba(23, 23, 23, 0.85)', backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10,
                        padding: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        animation: 'cmIn 0.15s ease-out',
                        width: 180,
                    }}>
                        <style>{`
                            @keyframes cmIn { from { opacity: 0; transform: scale(0.95) translateY(-5px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                        `}</style>
                        <div style={{ 
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
                        }}>
                            {[
                                { id: 'select',     label: 'Select',  icon: ICONS.select },
                                { id: 'rect',       label: 'Rect',    icon: ICONS.rect },
                                { id: 'circle',     label: 'Circle',  icon: ICONS.circle },
                                { id: 'polygon',    label: 'Polygon', icon: ICONS.polygon },
                                { id: 'star',       label: 'Star',    icon: ICONS.star },
                                { id: 'text',       label: 'Text',    icon: ICONS.text },
                                { id: 'image',      label: 'Image',   icon: ICONS.image },
                                { id: 'line',       label: 'Line',    icon: ICONS.line },
                                { id: 'arrow',      label: 'Arrow',   icon: ICONS.arrow },
                                { id: 'eyedropper', label: 'Sample',  icon: ICONS.eyedropper },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onMouseDown={e => { e.stopPropagation(); handleAddFromMenu(t.id); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '6px 8px', borderRadius: 6, border: 'none',
                                        background: 'transparent', cursor: 'pointer',
                                        color: 'var(--text-secondary)', transition: 'all 0.1s',
                                        fontSize: 11, textAlign: 'left',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                    <DuotoneIcon svg={t.icon} size={13} />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
