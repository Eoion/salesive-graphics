import { useRef, useEffect, useLayoutEffect, useState } from "react";
import SelectionHandles from "./SelectionHandles.jsx";
import { polygonPoints, starPoints, arrowheadPoints } from "../../editor/shapeHelpers.js";

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
    return (
        <ellipse
            id={el.id}
            cx={el.x + el.width / 2}
            cy={el.y + el.height / 2}
            rx={Math.max(el.width / 2, 1)}
            ry={Math.max(el.height / 2, 1)}
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
    return (
        <text
            id={el.id}
            x={el.x}
            y={el.y + (el.fontSize || 24)}
            fontSize={el.fontSize || 24}
            fontWeight={el.fontWeight || "normal"}
            fontFamily={el.fontFamily || "sans-serif"}
            textAnchor={el.textAnchor || "start"}
            fill={el.fill || "#000"}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        >
            {el.text || ""}
        </text>
    );
}

function RenderImage({ el }) {
    const hasHref = el.href && el.href.trim();
    return (
        <g
            id={el.id}
            opacity={el.opacity}
            transform={rotTransform(el)}
            display={el.visible === false ? "none" : undefined}
        >
            <rect
                x={el.x}
                y={el.y}
                width={Math.max(el.width, 1)}
                height={Math.max(el.height, 1)}
                fill={hasHref ? "none" : "#cbd5e1"}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray={hasHref ? "none" : "6 3"}
            />
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
                    href={el.href}
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    preserveAspectRatio="xMidYMid slice"
                />
            )}
        </g>
    );
}

function RenderLine({ el }) {
    return (
        <line
            id={el.id}
            x1={el.x}
            y1={el.y}
            x2={el.x + el.width}
            y2={el.y + el.height}
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
    rect: "#0D65D9", circle: "#0D65D9", text: "#3b82f6",
    image: "#c084fc", line: "#0D65D9",
    polygon: "#10b981", star: "#f59e0b", arrow: "#0D65D9",
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
}) {
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
        }
    }

    function handleOuterPointerMove(e) {
        if (panningRef.current) {
            const dx = e.clientX - panningRef.current.clientX;
            const dy = e.clientY - panningRef.current.clientY;
            setViewport((v) => ({
                ...v,
                tx: panningRef.current.tx + dx,
                ty: panningRef.current.ty + dy,
            }));
        } else {
            onPointerMove(e);
        }
    }

    function handleOuterPointerUp(e) {
        if (panningRef.current) {
            panningRef.current = null;
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
    const isOverlayMode = pickerMode || eyedropperActive;
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
        if (isPanMode || isOverlayMode) return;

        // Non-select tool: place a new element at click position
        if (activeTool !== 'select') {
            onCanvasPointerDown?.(e);
            return;
        }

        // Select mode: start marquee on empty canvas.
        // Element clicks stop propagation before reaching here.
        e.preventDefault();
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        const scale = scaleRef.current || 1;
        const startX = (e.clientX - svgRect.left) / scale;
        const startY = (e.clientY - svgRect.top) / scale;
        marqueeStartRef.current = { x: startX, y: startY };
        setMarquee({ x: startX, y: startY, width: 0, height: 0 });
        setSelectedIds([]);
    }

    function handleSvgPointerMove(e) {
        if (!marqueeStartRef.current || isPanMode) return;
        e.preventDefault();
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        const scale = scaleRef.current || 1;
        const curX = (e.clientX - svgRect.left) / scale;
        const curY = (e.clientY - svgRect.top) / scale;
        const start = marqueeStartRef.current;
        const x = Math.min(start.x, curX);
        const y = Math.min(start.y, curY);
        const w = Math.abs(curX - start.x);
        const h = Math.abs(curY - start.y);
        setMarquee({ x, y, width: w, height: h });
    }

    function handleSvgPointerUp() {
        if (!marquee) return;
        marqueeStartRef.current = null;

        // Find all elements intersecting the marquee rectangle
        const marqueeRect = marquee;
        const intersecting = elements.filter(el =>
            el.visible !== false &&
            !el.locked &&
            rectsIntersect(marqueeRect, elBounds(el))
        );

        setSelectedIds(intersecting.map(el => el.id));
        setMarquee(null);
        onMarqueeEnd?.(intersecting.map(el => el.id));
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
        >
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
                                      ? (e) => { e.stopPropagation(); onEyedrop?.(el.id, e.shiftKey); }
                                      : isPanMode
                                        ? undefined
                                        : (e) => onElementPointerDown(e, el.id)
                            }
                            onDoubleClick={
                                isOverlayMode ? undefined : () => handleDoubleClick(el.id)
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
                                    background: "rgba(0,0,0,0.6)", padding: "1px 5px", borderRadius: 3,
                                }}>
                                    {hoveredEl.id}
                                </span>
                            </div>
                        ) : (
                            <div style={{
                                position: "absolute", top: -22, left: 0,
                                background: pickColor, color: "#fff",
                                fontSize: 10, fontFamily: "DM Mono, monospace", fontWeight: 600,
                                padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap",
                                pointerEvents: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
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

            </div>
        </div>
    );
}
