import { useRef, useEffect, useLayoutEffect, useState, useMemo } from "react";
import SelectionHandles from "./SelectionHandles.jsx";
import DuotoneIcon from "../DuotoneIcon.jsx";
import ColorPicker from "../ColorPicker.jsx";
import { ICONS } from "../../editor/duotoneIcons.js";
import { polygonPoints, starPoints, arrowheadPoints } from "../../editor/shapeHelpers.js";
import { colorizeInlineSvgHref } from "../../editor/svgIconHref.js";
import { wrapTextContent } from "../../editor/textLayout.js";

// -- Helpers -------------------------------------------------------------------

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

// -- Element renderers ---------------------------------------------------------

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
    const lines = useMemo(
        () =>
            wrapTextContent(el.text || "", {
                width: el.width,
                fontSize,
                letterSpacing: el.letterSpacing,
                textWrap: el.textWrap,
            }),
        [el.letterSpacing, el.text, el.textWrap, el.width, fontSize],
    );
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
        case "ellipse": return <RenderCircle  el={el} />;
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

// -- Floating text editor ------------------------------------------------------

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

// -- Main component ------------------------------------------------------------

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

function SelectionQuickActions({
    anchor,
    locked,
    visible,
    showMenu,
    canEditText,
    canPickColor,
    colorValue,
    colorSwatches,
    onToggleMenu,
    onDuplicate,
    onToggleLock,
    onDelete,
    onBringForward,
    onSendBackward,
    onToggleVisibility,
    onEditText,
    onColorChange,
    selectedIds = [],
    groups = {},
    onMakeGroup,
    onDissolveGroup,
}) {
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    useEffect(() => {
        if (!showMenu && colorPickerOpen) {
            setColorPickerOpen(false);
        }
    }, [colorPickerOpen, showMenu]);

    const groupsArr = Object.values(groups);
    const inGroupIds = selectedIds.filter(id => groupsArr.some(g => g.elementIds.includes(id)));
    const canGroup = selectedIds.length >= 2 && !!onMakeGroup;
    const canUngroup = inGroupIds.length > 0 && !!onDissolveGroup;

    if (!anchor) return null;

    const wrapperStyle = {
        position: "absolute",
        left: anchor.left,
        top: anchor.top,
        transform: anchor.placement === "below"
            ? "translate(-50%, 12px)"
            : "translate(-50%, calc(-100% - 12px))",
        zIndex: 45,
        pointerEvents: "auto",
    };

    const actionButtonStyle = {
        width: 34,
        height: 32,
        border: "none",
        background: "transparent",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.12s ease, color 0.12s ease",
        flexShrink: 0,
    };

    const menuItemStyle = {
        width: "100%",
        border: "none",
        background: "transparent",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        fontSize: 11,
        fontFamily: "Syne, sans-serif",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 8,
        transition: "background 0.12s ease, color 0.12s ease",
    };

    const ActionButton = ({ icon, title, onClick, danger = false, active = false }) => (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            style={{
                ...actionButtonStyle,
                color: danger
                    ? "var(--red)"
                    : active
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                background: active ? "rgba(13,101,217,0.08)" : "transparent",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "rgba(13,101,217,0.08)";
                e.currentTarget.style.color = danger ? "var(--red)" : "var(--accent)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = active ? "rgba(13,101,217,0.08)" : "transparent";
                e.currentTarget.style.color = danger
                    ? "var(--red)"
                    : active
                      ? "var(--accent)"
                      : "var(--text-secondary)";
            }}
        >
            <DuotoneIcon svg={icon} size={15} />
        </button>
    );

    const MenuItem = ({ icon, label, onClick, danger = false, accent = false }) => (
        <button
            type="button"
            onClick={onClick}
            style={{
                ...menuItemStyle,
                color: danger ? "var(--red)" : accent ? "var(--accent)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "rgba(13,101,217,0.08)";
                e.currentTarget.style.color = danger ? "var(--red)" : "var(--accent)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = danger ? "var(--red)" : accent ? "var(--accent)" : "var(--text-secondary)";
            }}
        >
            <DuotoneIcon svg={icon} size={14} />
            {label}
        </button>
    );

    return (
        <div
            style={wrapperStyle}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 12px 30px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)",
                    backdropFilter: "blur(16px)",
                    overflow: "visible",
                }}
            >
                <ActionButton
                    icon={ICONS.copy || ICONS.paste}
                    title="Duplicate"
                    onClick={onDuplicate}
                />
                {(canGroup || canUngroup) && (
                    <>
                        <div style={{ width: 1, alignSelf: "stretch", background: "rgba(148,163,184,0.22)" }} />
                        <ActionButton
                            icon={canUngroup ? ICONS.layers : ICONS.grid}
                            title={canUngroup ? "Ungroup" : "Group"}
                            onClick={() => {
                                if (canUngroup) {
                                    const groupsToDissolve = groupsArr.filter(g =>
                                        g.elementIds.some(id => selectedIds.includes(id))
                                    );
                                    groupsToDissolve.forEach(g => onDissolveGroup(g.id));
                                } else {
                                    onMakeGroup(selectedIds);
                                }
                            }}
                            active={canUngroup}
                        />
                    </>
                )}
                <div style={{ width: 1, alignSelf: "stretch", background: "rgba(148,163,184,0.22)" }} />
                <ActionButton
                    icon={locked ? ICONS.unlock : ICONS.lock}
                    title={locked ? "Unlock" : "Lock"}
                    onClick={onToggleLock}
                    active={locked}
                />
                <div style={{ width: 1, alignSelf: "stretch", background: "rgba(148,163,184,0.22)" }} />
                <ActionButton
                    icon={ICONS.delete}
                    title="Delete"
                    onClick={onDelete}
                    danger
                />
                <div style={{ width: 1, alignSelf: "stretch", background: "rgba(148,163,184,0.22)" }} />
                <button
                    type="button"
                    title="More actions"
                    aria-label="More actions"
                    onClick={onToggleMenu}
                    style={{
                        ...actionButtonStyle,
                        color: showMenu ? "var(--accent)" : "var(--text-secondary)",
                        background: showMenu ? "rgba(13,101,217,0.08)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(13,101,217,0.08)";
                        e.currentTarget.style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = showMenu ? "rgba(13,101,217,0.08)" : "transparent";
                        e.currentTarget.style.color = showMenu ? "var(--accent)" : "var(--text-secondary)";
                    }}
                >
                    <span style={{ display: "flex", gap: 3 }}>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }} />
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }} />
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor" }} />
                    </span>
                </button>

                {showMenu && (
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "calc(100% + 10px)",
                            transform: "translateY(-50%)",
                            minWidth: 168,
                            padding: 6,
                            borderRadius: 12,
                            border: "1px solid rgba(15,23,42,0.08)",
                            background: "rgba(255,255,255,0.98)",
                            boxShadow: "0 16px 36px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)",
                            backdropFilter: "blur(16px)",
                        }}
                    >
                        <MenuItem icon={ICONS.bringForward} label="Bring forward" onClick={onBringForward} />
                        <MenuItem icon={ICONS.sendBackward} label="Send backward" onClick={onSendBackward} />
                        <MenuItem icon={visible ? ICONS.close : ICONS.eye} label={visible ? "Hide layer" : "Show layer"} onClick={onToggleVisibility} />
                        {canEditText && <MenuItem icon={ICONS.pencil} label="Edit text" onClick={onEditText} accent />}
                        {canPickColor && (
                            <>
                                <div style={{ height: 1, background: "rgba(148,163,184,0.16)", margin: "6px 4px" }} />
                                <div
                                    style={{
                                        padding: "8px 10px",
                                        position: "relative",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                Color
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "DM Mono, monospace", marginTop: 4 }}>
                                                {colorValue || "#000000"}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setColorPickerOpen((open) => !open)}
                                            style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 10,
                                                border: `1px solid ${colorPickerOpen ? "rgba(13,101,217,0.35)" : "rgba(148,163,184,0.22)"}`,
                                                background: colorValue || "#000000",
                                                cursor: "pointer",
                                                flexShrink: 0,
                                                boxShadow: colorPickerOpen ? "0 0 0 3px rgba(13,101,217,0.12)" : "none",
                                            }}
                                            aria-label="Choose color"
                                            title="Choose color"
                                        />
                                    </div>
                                    {colorPickerOpen && (
                                        <div style={{ marginTop: 10 }}>
                                            <ColorPicker
                                                value={colorValue || "#000000"}
                                                onChange={onColorChange}
                                                onClose={() => setColorPickerOpen(false)}
                                                swatches={colorSwatches}
                                            />
                                        </div>
                                    )}
                                    {!colorPickerOpen && (
                                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
                                            Click swatch to edit
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        <div style={{ height: 1, background: "rgba(148,163,184,0.16)", margin: "6px 4px" }} />
                        <MenuItem icon={ICONS.delete} label="Delete layer" onClick={onDelete} danger />
                    </div>
                )}
            </div>
        </div>
    );
}

function EditorCanvas({
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
    onDuplicateSelection,
    onDeleteSelection,
    onToggleLockSelection,
    onBringForwardSelection,
    onSendBackwardSelection,
    onToggleVisibilitySelection,
    onEditTextSelection,
    agentHighlightId,
    isWorking = false,
    inspectMode = false,
    animOverrides = {},
    onCanvasResizeLive,
    onCanvasResizeCommit,
    groups = {},
    onMakeGroupSelection,
    onDissolveGroupSelection,
}) {
    const outerRef = useRef();
    const svgRef = useRef();
    const canvasResizeDragRef = useRef(null);

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
    const [showQuickActionMenu, setShowQuickActionMenu] = useState(false);
    const [marquee, setMarquee] = useState(null); // { x, y, w, h }
    const marqueeStartRef = useRef(null); // { x, y }
    const panningRef = useRef(null);
    const quickActionsRef = useRef(null);

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

    // Auto-measure text elements and sync height (and width for unwrapped text) to rendered bbox
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
                const wrapped = el.textWrap !== false;
                const patch = {};
                if (!wrapped && Math.abs(bbox.width - el.width) > 1) patch.width = bbox.width;
                if (Math.abs(bbox.height - el.height) > 1) patch.height = bbox.height;
                if (Object.keys(patch).length) updateElementLive(el.id, patch);
            } catch {}
        }
    }, [elements]);

    const selectedEl = elements.find((e) => e.id === selectedId) || null;
    const selectedEls = elements.filter((e) => selectedIds.includes(e.id));
    const textEditEl = elements.find((e) => e.id === textEditId) || null;
    const canvasRect = svgRef.current?.getBoundingClientRect() || null;
    const hasVisibleSelection = selectedEls.some((el) => el.visible !== false);
    const hasUnlockedSelection = selectedEls.some((el) => !el.locked);

    const selectionColorInfo = useMemo(() => {
        if (!selectedEls.length) return { canPickColor: false, value: "#000000" };

        const primary = selectedEls[0];
        if (!primary || primary.type === "image") {
            return { canPickColor: false, value: "#000000" };
        }

        const key = primary.type === "line" || primary.type === "arrow" ? "stroke" : "fill";
        const rawValue = primary[key];
        const normalized = typeof rawValue === "string" && /^#[0-9a-f]{6}$/i.test(rawValue)
            ? rawValue
            : "#000000";

        return { canPickColor: true, value: normalized, key };
    }, [selectedEls]);

    const quickColorSwatches = useMemo(() => {
        const colors = new Set();
        elements.forEach((element) => {
            if (typeof element.fill === "string" && element.fill.startsWith("#")) {
                colors.add(element.fill.toLowerCase());
            }
            if (typeof element.stroke === "string" && element.stroke.startsWith("#")) {
                colors.add(element.stroke.toLowerCase());
            }
            if (element.iconColors) {
                Object.values(element.iconColors).forEach((color) => {
                    if (typeof color === "string" && color.startsWith("#")) {
                        colors.add(color.toLowerCase());
                    }
                });
            }
        });
        return Array.from(colors).slice(0, 18);
    }, [elements]);

    useEffect(() => {
        setShowQuickActionMenu(false);
    }, [selectedId, selectedIds.length, activeTool, pickerMode, eyedropperActive, inspectMode]);

    useEffect(() => {
        if (!showQuickActionMenu) return;
        function handlePointerDown(event) {
            if (quickActionsRef.current && !quickActionsRef.current.contains(event.target)) {
                setShowQuickActionMenu(false);
            }
        }
        function handleEscape(event) {
            if (event.key === "Escape") setShowQuickActionMenu(false);
        }
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [showQuickActionMenu]);

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

    // ── Canvas resize handles ─────────────────────────────────────────────────
    const showCanvasHandles = activeTool === 'select' && !selectedId && !selectedIds.length && !pickerMode && !eyedropperActive;

    function startCanvasResizeDrag(e, dir) {
        e.stopPropagation();
        canvasResizeDragRef.current = {
            dir,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startW: canvasSize.width,
            startH: canvasSize.height,
        };
        outerRef.current?.setPointerCapture(e.pointerId);
    }

    function computeResizeSize(drag, clientX, clientY) {
        const { dir, startClientX, startClientY, startW, startH } = drag;
        const scale = scaleRef?.current || 1;
        const dx = (clientX - startClientX) / scale;
        const dy = (clientY - startClientY) / scale;
        return {
            width:  dir.includes('e') ? Math.max(100, Math.round(startW + dx)) : startW,
            height: dir.includes('s') ? Math.max(100, Math.round(startH + dy)) : startH,
        };
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
        if (canvasResizeDragRef.current) {
            onCanvasResizeLive?.(computeResizeSize(canvasResizeDragRef.current, e.clientX, e.clientY));
            return;
        }
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
        if (canvasResizeDragRef.current) {
            const size = computeResizeSize(canvasResizeDragRef.current, e.clientX, e.clientY);
            canvasResizeDragRef.current = null;
            onCanvasResizeCommit?.(size);
            return;
        }
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

    const quickActionAnchor = useMemo(() => {
        if (!selectedEl || activeTool !== "select" || isOverlayMode || !fitted) return null;
        const bounds = elBounds(selectedEl);
        const centerX = viewport.tx + (bounds.x + bounds.width / 2) * viewport.scale;
        const aboveY = viewport.ty + bounds.y * viewport.scale;
        const belowY = viewport.ty + (bounds.y + bounds.height) * viewport.scale;
        return {
            left: centerX,
            top: aboveY,
            placement: aboveY < 56 ? "below" : "above",
            fallbackTop: belowY,
        };
    }, [selectedEl, activeTool, isOverlayMode, fitted, viewport]);

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
            {isWorking && (
               <div className="ai-working-border" style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none' }} />
            )}
            {quickActionAnchor && selectedIds.length > 0 && (
                <div ref={quickActionsRef}>
                    <SelectionQuickActions
                        anchor={{
                            left: quickActionAnchor.left,
                            top: quickActionAnchor.placement === "below"
                                ? quickActionAnchor.fallbackTop
                                : quickActionAnchor.top,
                            placement: quickActionAnchor.placement,
                        }}
                        locked={!hasUnlockedSelection}
                        visible={hasVisibleSelection}
                        showMenu={showQuickActionMenu}
                        canEditText={selectedIds.length === 1 && selectedEl?.type === "text"}
                        canPickColor={selectionColorInfo.canPickColor}
                        colorValue={selectionColorInfo.value}
                        colorSwatches={quickColorSwatches}
                        onToggleMenu={() => setShowQuickActionMenu((value) => !value)}
                        onDuplicate={onDuplicateSelection}
                        onToggleLock={() => {
                            onToggleLockSelection?.();
                            setShowQuickActionMenu(false);
                        }}
                        onDelete={() => {
                            onDeleteSelection?.();
                            setShowQuickActionMenu(false);
                        }}
                        onBringForward={() => {
                            onBringForwardSelection?.();
                            setShowQuickActionMenu(false);
                        }}
                        onSendBackward={() => {
                            onSendBackwardSelection?.();
                            setShowQuickActionMenu(false);
                        }}
                        onToggleVisibility={() => {
                            onToggleVisibilitySelection?.();
                            setShowQuickActionMenu(false);
                        }}
                        onEditText={() => {
                            onEditTextSelection?.();
                            setShowQuickActionMenu(false);
                        }}
                        onColorChange={(nextColor) => {
                            selectedEls.forEach((el) => {
                                const colorKey = el.type === "line" || el.type === "arrow" ? "stroke" : "fill";
                                if (el.type !== "image") {
                                    updateElement?.(el.id, { [colorKey]: nextColor });
                                }
                            });
                        }}
                        selectedIds={selectedIds}
                        groups={groups}
                        onMakeGroup={onMakeGroupSelection}
                        onDissolveGroup={onDissolveGroupSelection}
                    />
                </div>
            )}
            {/* Canvas resize handles — shown in screen coords so they stay constant size at any zoom */}
            {showCanvasHandles && (() => {
                const s = viewport.scale;
                const tx = viewport.tx;
                const ty = viewport.ty;
                const W = canvasSize.width * s;
                const H = canvasSize.height * s;
                const dot = (dir, left, top, cursor, w, h) => (
                    <div key={dir} onPointerDown={e => startCanvasResizeDrag(e, dir)} style={{
                        position: 'absolute',
                        left: tx + left - w / 2,
                        top:  ty + top  - h / 2,
                        width: w, height: h,
                        background: 'var(--accent)',
                        border: '1.5px solid #fff',
                        borderRadius: dir === 'se' ? 3 : 3,
                        cursor,
                        pointerEvents: 'all',
                        zIndex: 10,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    }} />
                );
                return (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
                        <div style={{
                            position: 'absolute',
                            left: tx - 1, top: ty - 1,
                            width: W + 2, height: H + 2,
                            border: '1px dashed rgba(13,101,217,0.45)',
                            borderRadius: 1,
                            pointerEvents: 'none',
                        }} />
                        {dot('e',  W,     H / 2, 'ew-resize', 7, 22)}
                        {dot('s',  W / 2, H,     'ns-resize', 22, 7)}
                        {dot('se', W,     H,     'se-resize', 10, 10)}
                    </div>
                );
            })()}

            {/* Viewport-transformed canvas */}
            <div
                className="canvas-artboard"
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `translate(${viewport.tx}px,${viewport.ty}px) scale(${viewport.scale})`,
                    transformOrigin: "0 0",
                    lineHeight: 0,
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                }}
            >

                {/* Content SVG */}
                <svg
                    ref={(el) => {
                        svgRef.current = el;
                        if (canvasRef) canvasRef.current = el;
                    }}
                    viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                    style={{
                        display: "block",
                        width: canvasSize.width,
                        height: canvasSize.height,
                        transition: 'width 0.3s ease-out, height 0.3s ease-out',
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
                    {elements.map((el) => {
                            const anim = animOverrides[el.id];
                            return (
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
                                ...(anim ? {
                                    transform: (anim.dx || anim.dy) ? `translate(${anim.dx || 0}px, ${anim.dy || 0}px)` : undefined,
                                    opacity: anim.opacity != null ? anim.opacity : undefined,
                                    transition: anim.transition || undefined,
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
                    );
                    })}
                </svg>

                {/* Handles overlay */}
                <svg
                    viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: canvasSize.width,
                        height: canvasSize.height,
                        transition: 'width 0.3s ease-out, height 0.3s ease-out',
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
                                {hoveredEl.id} | {hoveredEl.type} | {Math.round(hoveredEl.width)}x{Math.round(hoveredEl.height)}
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

export default EditorCanvas;
