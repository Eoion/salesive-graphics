import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DuotoneIcon from "../DuotoneIcon.jsx";
import { ICONS } from "../../editor/duotoneIcons.js";
import { TOOL_ACTIONS } from "../../editor/keymaps/photoshop.js";
import { useEditorState } from "../../editor/useEditorState.js";
import { useEditorInteractions } from "../../editor/useEditorInteractions.js";
import { useKeymap } from "../../editor/useKeymap.js";
import { useEditorDefs } from "../../editor/useEditorDefs.js";
import { useEditorAgent } from "../../editor/useEditorAgent.js";
import { useWebMCP } from "../../editor/useWebMCP.js";
import { useAiAnimations } from "../../editor/useAiAnimations.js";
import { serializeElements } from "../../editor/serializeElements.js";
import { parseSVGToElements } from "../../editor/parseSVGToElements.js";
import {
    measureWrappedTextHeight,
    normalizeAgentText,
    wrapTextContent,
} from "../../editor/textLayout.js";
import { canvases, collections } from "../../lib/api.js";
import { syncCounter, freshId, claimId } from "../../editor/editorConstants.js";
import EditorToolbar from "./EditorToolbar.jsx";
import EditorCanvas from "./EditorCanvas.jsx";
import EditorAiChat, { uploadImageToStore } from "./EditorAiChat.jsx";
import { getToolLabel } from "../../editor/toolLabels.js";
import { resolveLucideIconHref } from "../../editor/lucideIconSvg.js";
import EditorPropertiesPanel from "./EditorPropertiesPanel.jsx";
import LayersPanel from "./LayersPanel.jsx";
import CommandPalette from "./CommandPalette.jsx";
import KeymapSettings from "./KeymapSettings.jsx";
import CollectionModal from "./CollectionModal.jsx";
import PasteSVGModal from "./PasteSVGModal.jsx";
import VariablesPanel from "./VariablesPanel.jsx";
import CodeEditor from "./CodeEditor.jsx";
import CanvasSizePicker from "./CanvasSizePicker.jsx";
import toast from "react-hot-toast";

// ─── Agent cursor overlay ─────────────────────────────────────────────────────
function AgentCursorOverlay({
    elementId,
    thought,
    phase,
    elements,
    canvasViewport,
}) {
    const el = elements.find((e) => e.id === elementId);
    if (!el) return null;
    const cx = el.x + (el.width || 0) / 2;
    const cy = el.y + (el.height || 0) / 2;
    const sx = canvasViewport.tx + cx * canvasViewport.scale;
    const sy = canvasViewport.ty + cy * canvasViewport.scale;
    const PHASE_COLORS = {
        thinking: "#a78bfa",
        reading: "#60a5fa",
        selecting: "#34d399",
        editing: "#fb923c",
        responding: "#60a5fa",
        working: "#fb923c",
    };
    const c = PHASE_COLORS[phase] || "#0d65d9";
    return (
        <div
            style={{
                position: "absolute",
                left: sx,
                top: sy,
                zIndex: 61,
                pointerEvents: "none",
                transform: "translate(-4px, -4px)",
            }}
        >
            {/* Thought bubble */}
            {thought && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 30,
                        left: 0,
                        minWidth: 90,
                        maxWidth: 220,
                        background: "var(--bg-surface)",
                        border: `1px solid ${c}55`,
                        borderRadius: 10,
                        padding: "6px 10px",
                        fontSize: 11,
                        color: "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        boxShadow: `0 4px 20px ${c}30, 0 1px 4px rgba(0,0,0,0.4)`,
                        animation: "aiFadeUp 0.2s ease-out",
                        lineHeight: 1.45,
                        backdropFilter: "blur(4px)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            marginBottom: 4,
                        }}
                    >
                        <span style={{ display: "flex", gap: 2 }}>
                            {[0, 1, 2].map((i) => (
                                <span
                                    key={i}
                                    style={{
                                        width: 4,
                                        height: 4,
                                        borderRadius: "50%",
                                        background: c,
                                        display: "inline-block",
                                        animation: `aiPulse 1.1s ease-in-out ${i * 0.15}s infinite`,
                                    }}
                                />
                            ))}
                        </span>
                        <span
                            style={{
                                fontSize: 9,
                                color: c,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                            }}
                        >
                            AI
                        </span>
                    </div>
                    {thought}
                    <div
                        style={{
                            position: "absolute",
                            bottom: -6,
                            left: 12,
                            width: 0,
                            height: 0,
                            borderLeft: "6px solid transparent",
                            borderRight: "6px solid transparent",
                            borderTop: `6px solid var(--bg-surface)`,
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: -7,
                            left: 11,
                            width: 0,
                            height: 0,
                            borderLeft: "7px solid transparent",
                            borderRight: "7px solid transparent",
                            borderTop: `7px solid ${c}55`,
                        }}
                    />
                </div>
            )}
            {/* Cursor SVG */}
            <svg
                width="22"
                height="24"
                viewBox="0 0 22 24"
                fill="none"
                style={{
                    filter: `drop-shadow(0 2px 6px ${c}90)`,
                    animation: "agentCursorFloat 2.2s ease-in-out infinite",
                }}
            >
                <path
                    d="M2 2l5.2 13.5 2.4-4.1 4.1-2.4L2 2z"
                    fill={c}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="0.6"
                    strokeLinejoin="round"
                />
                <path
                    d="M9.3 11L13.5 15.2"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.9"
                />
                <path
                    d="M9.3 11L13.5 15.2"
                    stroke={c}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
            {/* Phase indicator dot */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    right: -8,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: c,
                    border: "2px solid var(--bg-base)",
                    animation: "aiPulseRing 1.5s ease-out infinite",
                }}
            />
        </div>
    );
}

const SCREENSHOT_MIME_TYPES = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
};

function clampScreenshotDimension(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 1024;
    return Math.min(Math.max(Math.round(numeric), 128), 2048);
}

function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
            reject(new Error("Unable to render SVG screenshot."));
        image.src = url;
    });
}

async function sampleImagePixel(href, relX, relY) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = href;
    });
    const size = Math.min(img.naturalWidth || 64, 512);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    const px = Math.max(0, Math.min(Math.round(relX * size), size - 1));
    const py = Math.max(0, Math.min(Math.round(relY * size), size - 1));
    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

async function fetchAsDataUrl(url) {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + chunk),
        );
    }
    return btoa(binary);
}

// Fetch a Google font and return a base64 woff2 data URL so it can be embedded
// as an @font-face — external @import doesn't load when the export SVG is
// rasterized through an <img>, so display faces would otherwise fall back.
async function inlineGoogleFont(family, weights = [700, 400]) {
    const q =
        `family=${encodeURIComponent(family)}:wght@${weights.join(";")}` +
        `&display=swap`;
    const css = await fetch(`https://fonts.googleapis.com/css2?${q}`).then((r) => {
        if (!r.ok) throw new Error(`font css ${r.status}`);
        return r.text();
    });
    const urlMatch = css.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!urlMatch) return null;
    const buf = await fetch(urlMatch[1]).then((r) => {
        if (!r.ok) throw new Error(`font file ${r.status}`);
        return r.arrayBuffer();
    });
    return `data:font/woff2;base64,${arrayBufferToBase64(buf)}`;
}

// Replace `@import url(fonts.googleapis…)` with inlined base64 @font-face blocks.
// External stylesheets/fonts don't load when the SVG is rasterized via <img>,
// so display faces would otherwise silently fall back to a system font.
async function inlineFontImports(svgString) {
    const importRe =
        /@import\s+url\((['"]?)(https:\/\/fonts\.googleapis\.com\/[^'")]+)\1\)\s*;?/g;
    const imports = [...svgString.matchAll(importRe)];
    if (!imports.length) return svgString;

    let out = svgString;
    for (const [full, , cssUrl] of imports) {
        try {
            const css = await fetch(cssUrl).then((r) => {
                if (!r.ok) throw new Error(`css ${r.status}`);
                return r.text();
            });
            const fileRe = /url\((https:\/\/[^)]+\.(?:woff2|woff|ttf))\)/g;
            const files = [...new Set([...css.matchAll(fileRe)].map((m) => m[1]))];
            const dataMap = new Map();
            await Promise.all(
                files.map(async (u) => {
                    try {
                        const buf = await fetch(u).then((r) => r.arrayBuffer());
                        dataMap.set(
                            u,
                            `data:font/woff2;base64,${arrayBufferToBase64(buf)}`,
                        );
                    } catch {
                        /* skip this weight */
                    }
                }),
            );
            const inlinedCss = css.replace(fileRe, (m, u) =>
                dataMap.has(u) ? `url(${dataMap.get(u)})` : m,
            );
            out = out.replace(full, inlinedCss);
        } catch {
            /* leave the @import — font falls back */
        }
    }
    return out;
}

async function inlineExternalImages(svgString) {
    // Collect all unique external URLs referenced in href / xlink:href attributes
    const pattern = /(?:xlink:)?href="(https?:\/\/[^"]+)"/g;
    const urls = new Set();
    let m;
    while ((m = pattern.exec(svgString)) !== null) urls.add(m[1]);
    if (!urls.size) return svgString;

    // Fetch all concurrently; failures are silently skipped (image stays broken)
    const dataMap = new Map();
    await Promise.all(
        Array.from(urls).map(async (url) => {
            try {
                dataMap.set(url, await fetchAsDataUrl(url));
            } catch {
                // keep original URL — at worst the image stays blank
            }
        }),
    );

    // Replace URLs in the SVG string
    return svgString.replace(
        /((?:xlink:)?href)="(https?:\/\/[^"]+)"/g,
        (full, attr, url) => {
            const data = dataMap.get(url);
            return data ? `${attr}="${data}"` : full;
        },
    );
}

async function createCanvasScreenshot(svg, canvasSize, options = {}) {
    const format = options.format || "png";
    const mimeType = SCREENSHOT_MIME_TYPES[format] || SCREENSHOT_MIME_TYPES.png;
    const maxDimension = clampScreenshotDimension(options.maxDimension);
    const quality = Number.isFinite(Number(options.quality))
        ? Number(options.quality)
        : 0.92;
    const sourceX = Number.isFinite(Number(options.sourceX))
        ? Math.max(0, Math.min(Number(options.sourceX), canvasSize.width))
        : 0;
    const sourceY = Number.isFinite(Number(options.sourceY))
        ? Math.max(0, Math.min(Number(options.sourceY), canvasSize.height))
        : 0;
    const sourceWidth = Number.isFinite(Number(options.sourceWidth))
        ? Math.max(
              1,
              Math.min(Number(options.sourceWidth), canvasSize.width - sourceX),
          )
        : canvasSize.width;
    const sourceHeight = Number.isFinite(Number(options.sourceHeight))
        ? Math.max(
              1,
              Math.min(
                  Number(options.sourceHeight),
                  canvasSize.height - sourceY,
              ),
          )
        : canvasSize.height;
    const scale = Math.min(
        1,
        maxDimension / Math.max(sourceWidth, sourceHeight),
    );
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const inlinedSvg = await inlineFontImports(await inlineExternalImages(svg));
    const blob = new Blob([inlinedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
        const image = await loadImageFromUrl(url);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Unable to create screenshot canvas.");

        const background =
            options.background ||
            (mimeType === "image/jpeg" ? "#ffffff" : null);
        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            width,
            height,
        );

        return {
            dataUrl: canvas.toDataURL(mimeType, quality),
            mimeType,
            width,
            height,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            scale,
        };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function clampRegionToCanvas(region, canvasSize) {
    const x = Number.isFinite(Number(region?.x))
        ? Number(region.x)
        : Number(region?.sourceX) || 0;
    const y = Number.isFinite(Number(region?.y))
        ? Number(region.y)
        : Number(region?.sourceY) || 0;
    const width = Number.isFinite(Number(region?.width))
        ? Number(region.width)
        : Number(region?.sourceWidth) || canvasSize.width;
    const height = Number.isFinite(Number(region?.height))
        ? Number(region.height)
        : Number(region?.sourceHeight) || canvasSize.height;

    const nx = Math.max(0, Math.min(x, canvasSize.width));
    const ny = Math.max(0, Math.min(y, canvasSize.height));
    const nw = Math.max(1, Math.min(width, canvasSize.width - nx));
    const nh = Math.max(1, Math.min(height, canvasSize.height - ny));

    return {
        x: nx,
        y: ny,
        width: nw,
        height: nh,
        sourceX: nx,
        sourceY: ny,
        sourceWidth: nw,
        sourceHeight: nh,
    };
}

// Coerce a possibly-stringified numeric field ("96") to a real number.
function nn(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getElementBounds(el, padding = 0) {
    return {
        x: nn(el?.x) - padding,
        y: nn(el?.y) - padding,
        width: nn(el?.width) + padding * 2,
        height: nn(el?.height) + padding * 2,
    };
}

function buildRegex(pattern, flags = "i") {
    if (!pattern) throw new Error("pattern is required");
    return new RegExp(pattern, flags);
}

function estimateTextWidth(lines, fontSize, letterSpacing = 0) {
    const longest = Math.max(...lines.map((line) => line.length), 1);
    return Math.max(
        80,
        Math.ceil(longest * (fontSize * 0.56 + (letterSpacing || 0))),
    );
}

const DEFAULT_FONT_FAMILY = "sans-serif";

function resolveFontFamily(fontFamily) {
    return typeof fontFamily === "string" && fontFamily.trim()
        ? fontFamily
        : DEFAULT_FONT_FAMILY;
}

function makeTextPatch(baseElement, {
    text,
    width,
    fontSize,
    lineHeight,
    textWrap,
    autoFitWidth = false,
} = {}) {
    const nextText = normalizeAgentText(text ?? baseElement?.text ?? "");
    const nextFontSize = Number.isFinite(Number(fontSize))
        ? Number(fontSize)
        : baseElement?.fontSize || 24;
    const nextLineHeight = Number.isFinite(Number(lineHeight))
        ? Number(lineHeight)
        : baseElement?.lineHeight || 1.2;
    const nextWrap = textWrap ?? baseElement?.textWrap ?? true;
    const nextWidth = Number.isFinite(Number(width))
        ? Number(width)
        : baseElement?.width;
    const lines = wrapTextContent(nextText, {
        width: nextWidth,
        fontSize: nextFontSize,
        letterSpacing: baseElement?.letterSpacing,
        textWrap: nextWrap,
    });

    return {
        text: nextText,
        textWrap: nextWrap,
        ...(Number.isFinite(Number(nextWidth)) ? { width: Number(nextWidth) } : {}),
        ...(autoFitWidth && !nextWrap
            ? {
                  width: estimateTextWidth(
                      lines,
                      nextFontSize,
                      baseElement?.letterSpacing,
                  ),
              }
            : {}),
        height: measureWrappedTextHeight(nextText, {
            width: nextWidth,
            fontSize: nextFontSize,
            lineHeight: nextLineHeight,
            letterSpacing: baseElement?.letterSpacing,
            textWrap: nextWrap,
        }),
        lineHeight: nextLineHeight,
    };
}

function _finiteNum(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Normalize a loosely-specified agent element into the editor's flat schema:
// a top-left x/y box with width/height. Accepts SVG-style geometry
// (cx/cy/r/rx/ry for discs, x1/y1/x2/y2 for lines) and coerces `ellipse` to
// `circle` (which already renders as an <ellipse> and supports width != height).
function normalizeAgentElement(raw) {
    const e = { ...raw };
    if (e.type === "ellipse") e.type = "circle";

    if (e.type === "circle") {
        const rx =
            _finiteNum(e.rx) ??
            _finiteNum(e.r) ??
            (_finiteNum(e.width) != null ? e.width / 2 : null);
        const ry =
            _finiteNum(e.ry) ??
            _finiteNum(e.r) ??
            (_finiteNum(e.height) != null ? e.height / 2 : null);
        const w = (rx != null ? rx * 2 : null) ?? _finiteNum(e.width) ?? 100;
        const h = (ry != null ? ry * 2 : null) ?? _finiteNum(e.height) ?? 100;
        const x =
            _finiteNum(e.x) ??
            (_finiteNum(e.cx) != null ? e.cx - w / 2 : null);
        const y =
            _finiteNum(e.y) ??
            (_finiteNum(e.cy) != null ? e.cy - h / 2 : null);
        e.width = w;
        e.height = h;
        if (x != null) e.x = x;
        if (y != null) e.y = y;
        delete e.cx;
        delete e.cy;
        delete e.r;
        delete e.rx;
        delete e.ry;
    } else if (e.type === "line" || e.type === "arrow") {
        const x1 = _finiteNum(e.x1) ?? _finiteNum(e.x) ?? 0;
        const y1 = _finiteNum(e.y1) ?? _finiteNum(e.y) ?? 0;
        const x2 =
            _finiteNum(e.x2) ??
            (_finiteNum(e.x) ?? 0) + (_finiteNum(e.width) ?? 0);
        const y2 =
            _finiteNum(e.y2) ??
            (_finiteNum(e.y) ?? 0) + (_finiteNum(e.height) ?? 0);
        e.x = x1;
        e.y = y1;
        e.width = x2 - x1;
        e.height = y2 - y1;
        e.x1 = x1;
        e.y1 = y1;
        e.x2 = x2;
        e.y2 = y2;
    }

    if (e.type === "text") {
        e.fontFamily = resolveFontFamily(e.fontFamily);
        const hasWidth = _finiteNum(e.width) != null;
        // Only hard-wrap into a column when the caller explicitly picked a width;
        // otherwise auto-fit so short agent labels are always visible.
        const wrap = e.textWrap ?? hasWidth;
        Object.assign(
            e,
            makeTextPatch(e, {
                text: e.text ?? "Text",
                width: hasWidth ? e.width : undefined,
                fontSize: e.fontSize,
                lineHeight: e.lineHeight,
                textWrap: wrap,
                autoFitWidth: !hasWidth,
            }),
        );
    }
    return e;
}

// Map a loose gradient spec (numbers or "%" strings, `color`/`stop-color`
// aliases) onto the internal defs.gradients shape.
function normalizeGradientInput(input = {}) {
    const pct = (v, fallback) => {
        if (v == null) return fallback;
        if (typeof v === "number") {
            if (!Number.isFinite(v)) return fallback;
            // Accept 0–1 fractions (0.5 → "50%") as well as 0–100.
            return v > 0 && v <= 1 ? `${v * 100}%` : `${v}%`;
        }
        return String(v);
    };
    const stops = (Array.isArray(input.stops) ? input.stops : [])
        .map((s, i, arr) => ({
            offset: pct(
                s.offset,
                `${Math.round((i / Math.max(arr.length - 1, 1)) * 100)}%`,
            ),
            stopColor:
                s.stopColor || s.color || s["stop-color"] || s.stopcolor || "#000000",
            ...(s.stopOpacity != null || s["stop-opacity"] != null
                ? { stopOpacity: Number(s.stopOpacity ?? s["stop-opacity"]) }
                : {}),
        }));
    const id = String(input.id || "").trim() || `grad_${Date.now()}`;
    if (String(input.type).toLowerCase() === "radial") {
        return {
            id,
            type: "radial",
            cx: pct(input.cx, "50%"),
            cy: pct(input.cy, "50%"),
            r: pct(input.r, "50%"),
            stops,
        };
    }
    return {
        id,
        type: "linear",
        x1: pct(input.x1, "0%"),
        y1: pct(input.y1, "0%"),
        x2: pct(input.x2, "100%"),
        y2: pct(input.y2, "0%"),
        stops,
    };
}

// Returns the actual rendered left-edge x for a text element, adjusting for textAnchor.
// Non-text elements return their raw x.
function effectiveTextBounds(el) {
    const w = nn(el.width);
    const h = nn(el.height);
    let x = nn(el.x);
    if (el.type === 'text' && w > 0) {
        if (el.textAnchor === 'middle') x = x - w / 2;
        else if (el.textAnchor === 'end')  x = x - w;
    }
    return { x, y: nn(el.y), width: w, height: h };
}

function xFromRenderedLeft(el, left) {
    const w = el.width || 0;
    if (el.type === "text" && w > 0) {
        if (el.textAnchor === "middle") return left + w / 2;
        if (el.textAnchor === "end") return left + w;
    }
    return left;
}

// Rendered bounding box in canvas space (accounts for textAnchor) — layout
// tools must read/write through this so text and shapes align consistently.
function renderBox(el) {
    return effectiveTextBounds(el);
}

// Build an {x?, y?} patch that puts the element's *rendered* top-left at (left, top).
function placePatch(el, left, top) {
    const p = {};
    if (left != null && Number.isFinite(Number(left)))
        p.x = xFromRenderedLeft(el, Number(left));
    if (top != null && Number.isFinite(Number(top))) p.y = Number(top);
    return p;
}

// Approximate WCAG relative luminance for a hex color string.
function hexLuminance(hex) {
    const c = hex.replace('#', '');
    if (c.length !== 6) return null;
    const r = parseInt(c.slice(0,2),16)/255;
    const g = parseInt(c.slice(2,4),16)/255;
    const b = parseInt(c.slice(4,6),16)/255;
    const srgb = v => v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    return 0.2126*srgb(r) + 0.7152*srgb(g) + 0.0722*srgb(b);
}
function contrastRatio(hex1, hex2) {
    const l1 = hexLuminance(hex1); const l2 = hexLuminance(hex2);
    if (l1 === null || l2 === null) return null;
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
}

function preferredContrastTextColor(backgroundFill) {
    const dark = "#111111";
    const light = "#ffffff";
    const darkRatio = contrastRatio(dark, backgroundFill) || 0;
    const lightRatio = contrastRatio(light, backgroundFill) || 0;
    return darkRatio >= lightRatio ? dark : light;
}

function buildRegionReview(elements, region, canvasSize, goals = []) {
    const items = elements.filter((el) => {
        const right = (el.x || 0) + (el.width || 0);
        const bottom = (el.y || 0) + (el.height || 0);
        return !(
            right < region.x ||
            (el.x || 0) > region.x + region.width ||
            bottom < region.y ||
            (el.y || 0) > region.y + region.height
        );
    });
    const textItems = items.filter((el) => el.type === "text");
    const hiddenItems = items.filter((el) => el.visible === false);
    const lockedItems = items.filter((el) => el.locked);
    const overflowItems = items.filter((el) => {
        const b = effectiveTextBounds(el);
        return (b.x < 0 || b.y < 0 || b.x + b.width > canvasSize.width || b.y + b.height > canvasSize.height);
    });
    const tinyText = textItems.filter((el) => (el.fontSize || 0) < 9);
    const fontFamilies = [...new Set(textItems.map((el) => el.fontFamily).filter(Boolean))];

    const suggestions = [];

    // 1. Overflow
    if (overflowItems.length) {
        suggestions.push({
            message: `${overflowItems.length} element(s) overflow the canvas bounds.`,
            ids: overflowItems.map((e) => ({ id: e.id, type: e.type, currentValue: `x:${e.x},y:${e.y},w:${e.width},h:${e.height}` })),
            action: "Call constrain_elements with these ids to auto-fix.",
            fix: {
                tool: "constrain_elements",
                args: { ids: overflowItems.map((e) => e.id) },
            },
        });
    }

    // 2. Tiny text
    if (tinyText.length) {
        suggestions.push({
            message: `${tinyText.length} text element(s) are below 9px - likely unreadable.`,
            ids: tinyText.map((e) => ({ id: e.id, type: e.type, currentValue: `fontSize:${e.fontSize}` })),
            action: "Increase fontSize via update_elements.",
            fix: {
                tool: "update_elements",
                args: {
                    ids: tinyText.map((e) => e.id),
                    patch: { fontSize: 9 },
                },
            },
        });
    }

    // 3. Inconsistent widths among same-type elements at similar y positions (within 80px of each other)
    const rects = items.filter((e) => e.type === "rect" && (e.width || 0) > 20);
    if (rects.length >= 2) {
        const widths = rects.map((e) => e.width || 0);
        const maxW = Math.max(...widths); const minW = Math.min(...widths);
        if (maxW - minW > 4 && maxW - minW <= maxW * 0.3) {
            const outliers = rects.filter((e) => Math.abs((e.width || 0) - widths[0]) > 4);
            if (outliers.length && outliers.length < rects.length) {
                suggestions.push({
                    message: `Inconsistent rect widths in this region: values range from ${minW}px to ${maxW}px. For a uniform layout, pick one width.`,
                    ids: rects.map((e) => ({ id: e.id, type: e.type, currentValue: `width:${e.width}` })),
                    action: `Set all to width:${maxW} or width:${minW} via update_elements.`,
                    fix: {
                        tool: "update_elements",
                        args: {
                            ids: rects.map((e) => e.id),
                            patch: { width: maxW },
                        },
                    },
                });
            }
        }
    }

    // 4. Text contrast warnings - z-order aware (hex fill on hex background only)
    // For each text element, prefer the nearest containing rect below it.
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    for (const t of textItems) {
        const textFill = (t.fill || '').trim();
        if (!hexRe.test(textFill)) continue;
        const elIdx = elements.indexOf(t);
        const textBounds = effectiveTextBounds(t);
        const tx = textBounds.x, ty = textBounds.y, tr = tx + textBounds.width, tb = ty + textBounds.height;
        let under = null;
        let underArea = Infinity;
        for (let i = elIdx - 1; i >= 0; i--) {
            const r = elements[i];
            if (r.type !== 'rect') continue;
            if (!hexRe.test((r.fill || '').trim())) continue;
            const rx = r.x || 0, ry = r.y || 0, rr = rx + (r.width || 0), rb = ry + (r.height || 0);
            if (rx <= tx && ry <= ty && rr >= tr && rb >= tb) {
                const area = (r.width || 0) * (r.height || 0);
                if (area < underArea) {
                    under = r;
                    underArea = area;
                }
            }
        }
        if (under) {
            const ratio = contrastRatio(textFill, under.fill.trim());
            if (ratio !== null && ratio < 4.5) {
                const suggestedFill = preferredContrastTextColor(under.fill.trim());
                suggestions.push({
                    message: `Low contrast: "${(t.text||'').slice(0,30)}" (${textFill}) on background ${under.fill} has a contrast ratio of ~${ratio.toFixed(1)}:1 (WCAG AA requires 4.5:1 for normal text).`,
                    ids: [{ id: t.id, type: "text", currentValue: `fill:${textFill}` }, { id: under.id, type: "rect", currentValue: `fill:${under.fill}` }],
                    action: "Increase text fill brightness or darken the background to reach 4.5:1+.",
                    backgroundId: under.id,
                    fix: {
                        tool: "update_element",
                        args: { id: t.id, fill: suggestedFill },
                    },
                });
            }
        }
    }

    // 5. Too many font families
    if (fontFamilies.length > 3) {
        suggestions.push({
            message: `${fontFamilies.length} distinct font families in this region: ${fontFamilies.join(', ')}. More than 2-3 makes the design feel chaotic.`,
            ids: textItems.map((e) => ({ id: e.id, type: e.type, currentValue: `fontFamily:${e.fontFamily}` })),
            action: "Use update_elements to consolidate to 2 font families.",
            fix: {
                tool: "update_elements",
                args: {
                    ids: textItems.map((e) => e.id),
                    patch: { fontFamily: fontFamilies[0] || DEFAULT_FONT_FAMILY },
                },
            },
        });
    }

    // 6. Uneven horizontal gaps between same-row elements
    const rowEls = items.filter((e) => (e.width || 0) > 0 && (e.height || 0) > 0 && e.type !== "text");
    if (rowEls.length >= 3) {
        const sorted = [...rowEls].sort((a, b) => (a.x || 0) - (b.x || 0));
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
            const gap = (sorted[i].x || 0) - ((sorted[i-1].x || 0) + (sorted[i-1].width || 0));
            if (gap >= 0) gaps.push({ gap: Math.round(gap), between: [sorted[i-1].id, sorted[i].id] });
        }
        if (gaps.length >= 2) {
            const gapValues = gaps.map(g => g.gap);
            const maxGap = Math.max(...gapValues); const minGap = Math.min(...gapValues);
            if (maxGap - minGap > 8) {
                suggestions.push({
                    message: `Uneven horizontal gaps detected: ranging from ${minGap}px to ${maxGap}px between elements. For consistent spacing, use distribute_elements.`,
                    ids: rowEls.map((e) => ({ id: e.id, type: e.type, currentValue: `x:${e.x}` })),
                    action: "Call distribute_elements({ ids: [...], axis:'horizontal', spacing: <desired gap> }) to equalize.",
                    fix: {
                        tool: "distribute_elements",
                        args: {
                            ids: rowEls.map((e) => e.id),
                            axis: "horizontal",
                            spacing: minGap,
                        },
                    },
                });
            }
        }
    }

    // 7. Hidden elements
    if (hiddenItems.length) {
        suggestions.push({
            message: `${hiddenItems.length} hidden element(s) remain in this area.`,
            ids: hiddenItems.map((e) => ({ id: e.id, type: e.type, currentValue: "visible:false" })),
            action: "Delete with delete_elements or reveal with update_elements {visible:true}.",
            fix: {
                tool: "update_elements",
                args: {
                    ids: hiddenItems.map((e) => e.id),
                    patch: { visible: true },
                },
            },
        });
    }

    if (!suggestions.length) {
        suggestions.push({
            message: "No structural issues detected in this region.",
            ids: [],
            action: null,
            fix: null,
        });
    }

    return {
        region,
        goals,
        elementCount: items.length,
        textCount: textItems.length,
        hiddenCount: hiddenItems.length,
        lockedCount: lockedItems.length,
        overflowCount: overflowItems.length,
        suggestions,
    };
}

const GUEST_GROUPS_KEY = "salesive_editor_groups";
const LOCAL_COLLECTION_KEY = "salesive_local_collection";

function loadLocalCollection() {
    try {
        const raw = localStorage.getItem(LOCAL_COLLECTION_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function saveLocalCollectionItem(item) {
    const items = loadLocalCollection();
    const entry = {
        _id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        local: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...item,
    };
    items.push(entry);
    try {
        localStorage.setItem(LOCAL_COLLECTION_KEY, JSON.stringify(items));
    } catch {
        /* quota — nothing we can do */
    }
    return entry;
}

// Self-describing guide returned by the `get_editor_guide` tool so an agent can
// learn how to drive this editor before it starts making changes.
const EDITOR_GUIDE = `# Salesive SVG Editor — agent guide

You are editing a fixed-size SVG canvas made of flat elements: rect, text,
image/icon, line, path, circle (also "ellipse" — same type, width != height),
polygon, star, arrow. Every element has an \`id\`, a top-left position
(\`x\`, \`y\` — numbers, not strings), a size (\`width\`, \`height\`), plus style props
(\`fill\`, \`stroke\`, \`strokeWidth\`, \`opacity\`, \`rx\`). Text elements also have
\`text\`, \`fontSize\`, \`fontFamily\`, \`fontWeight\`, \`textAnchor\`, \`lineHeight\`,
\`textWrap\`. All coordinates are top-left based and unrotated; pass numbers.

## Recommended workflow
1. Call \`lock_canvas\` with a short \`reason\` so the user does not fight you for
   control while you work. Always call \`unlock_canvas\` when you finish (or fail).
2. Call \`get_canvas_state\` (or \`get_snapshot\`) to read size, defs and elements.
   Use \`get_canvas_screenshot\` / \`review_canvas_region\` to actually see it.
3. Plan the layout in canvas coordinates. Keep everything inside the canvas
   bounds; use \`check_layout\` to detect overflow/overlap.
4. Make changes with the mutation tools:
   - create: \`add_element\`, \`add_elements\`, \`add_icon\`, and the \`create_*\`
     component helpers (create_button, create_card, create_navbar, …).
   - edit: \`update_element(s)\`, \`set_fill\`, \`set_stroke\`, \`set_opacity\`,
     \`set_text\`, \`move_element\`, \`resize_element\`.
   - arrange: \`align_elements\`, \`distribute_elements\`, \`arrange_row/column/grid\`,
     \`center_in_canvas\`, \`place_at\`, \`constrain_elements\`, \`snap_to_grid\`.
   - order: \`bring_forward\`, \`send_backward\`, \`bring_to_front\`, \`send_to_back\`.
   - group: \`create_group\`, \`add_to_group\`, \`dissolve_group\`.
5. Prefer batch tools (\`update_elements\`, \`add_elements\`, \`batch_update_texts\`)
   over many single calls.
6. If a decision is genuinely the user's to make (wording, brand colour, which
   of two directions), call \`ask_canvas_question\` with a few \`options\` instead
   of guessing.
7. Every action is undoable — \`undo_last_action\` / \`redo_last_action\`.
8. When done: verify with a screenshot, then \`unlock_canvas\`.

## Tips
- Coordinates are unscaled SVG units, origin top-left. add_element / add_elements
  place things reliably; insert_svg keeps coordinates ("original") by default.
- Discs: add_element({ type:"circle", x, y, width, height }), or pass cx/cy/r and
  they are converted. "ellipse" is treated as a circle with width != height.
- Gradients: call add_gradient to get a url(#id) string, then set it as an
  element fill. A url(#...) that was never defined renders as nothing.
- Text: add_element({ type:"text", x, y, text }) renders reliably; with no width
  it auto-fits to one line, pass width only to wrap into a column. insert_svg
  also works for text and keeps coordinates. textAnchor "middle" needs x at the
  centre of the text box.
- Rounded corners: set rx on a rect (ry follows automatically).
- align_elements: { ids, align: "left"|"right"|"top"|"bottom"|"center-h"|
  "center-v"|"center" }. With 2+ ids it aligns them to a shared edge; pass
  relativeTo:"canvas" to align to the canvas instead. align_to_element takes
  { ids, refId, align }.
- arrange_row / arrange_column / arrange_grid take an { x, y } origin.
- Layout tools measure text by its visible box even when textAnchor is
  "middle"/"end", so text and shapes line up.
- load_font embeds the font so it survives screenshot/export; call it before
  applying a non-system font.
- Use fix_elements to repair NaN / zero-size elements.
- Guest canvases live in this browser only and can be lost — tell the user to
  save to their account for anything they want to keep.
`;

function makeQuestionId() {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadGuestGroups() {
    try {
        const raw = localStorage.getItem(GUEST_GROUPS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        }
    } catch {
        /* ignore malformed persisted groups */
    }
    return {};
}

function storeGuestGroups(groups) {
    try {
        localStorage.setItem(GUEST_GROUPS_KEY, JSON.stringify(groups || {}));
    } catch {
        /* storage may be full or unavailable */
    }
}

export default function EditorScreen({
    isGuest = false,
    canvasSize,
    onCanvasResize,
    onFinish,
    initialElements,
    initialDefs,
    canvasRecord = null,
    templateName = "Untitled Template",
    onNameChange,
    onCanvasRecordChange,
    onCanvasesRefresh,
}) {
    const [activeTool, setActiveTool] = useState("select");
    const [activeDock, setActiveDock] = useState(isGuest ? "activity" : "ai");
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [showKeymap, setShowKeymap] = useState(false);
    const [showCollection, setShowCollection] = useState(false);
    const [showPasteSVG, setShowPasteSVG] = useState(false);
    const [showVariables, setShowVariables] = useState(false);
    const [showResizePicker, setShowResizePicker] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);
    const [liveCanvasSize, setLiveCanvasSize] = useState(null);
    const effectiveCanvasSize = liveCanvasSize ?? canvasSize;
    const [codeEditElement, setCodeEditElement] = useState(null);
    const [snapEnabled, setSnapEnabled] = useState(false);
    const [zoomDisplay, setZoomDisplay] = useState(100);
    const [pickerMode, setPickerMode] = useState(false);
    const [inspectMode, setInspectMode] = useState(false);
    const [canvasViewport, setCanvasViewport] = useState({
        tx: 0,
        ty: 0,
        scale: 1,
    });
    const [panelWidth, setPanelWidth] = useState(300);
    const [saveState, setSaveState] = useState({
        status: "idle",
        updatedAt: canvasRecord?.updatedAt || null,
    });
    const [isPublic, setIsPublic] = useState(canvasRecord?.public ?? true);

    // Agent-controlled canvas lock + question prompt (driven by editor tools)
    const [agentLock, setAgentLock] = useState({ locked: false, reason: null });

    // Identity + live tool-call feed for external (WebMCP) agents
    const [agentIdentity, setAgentIdentity] = useState({ name: null, avatar: null });
    const [mcpEvents, setMcpEvents] = useState([]);
    const handleMcpEvent = useCallback((evt) => {
        setMcpEvents((prev) => {
            if (evt.type === "result" || evt.type === "error") {
                const idx = prev.findIndex((e) => e.id === evt.id);
                if (idx !== -1) {
                    const next = prev.slice();
                    next[idx] = {
                        ...next[idx],
                        status: evt.type === "error" ? "error" : "done",
                        result: evt.result,
                        error: evt.error,
                        endedAt: evt.at,
                    };
                    return next;
                }
            }
            const row = {
                id: evt.id,
                name: evt.name,
                args: evt.args,
                status: evt.type === "call" ? "running" : evt.type === "error" ? "error" : "done",
                result: evt.result,
                error: evt.error,
                at: evt.at,
            };
            return [...prev, row].slice(-100);
        });
    }, []);
    const [pendingQuestion, setPendingQuestion] = useState(null);
    const questionResolverRef = useRef(null);
    const answerPendingQuestion = useCallback((answer, custom = false) => {
        if (questionResolverRef.current) {
            questionResolverRef.current({ answer, custom, cancelled: answer == null });
            questionResolverRef.current = null;
        }
        setPendingQuestion(null);
    }, []);
    useEffect(() => () => {
        // Don't leave an awaiting tool call hanging if the editor unmounts.
        questionResolverRef.current?.({ answer: null, custom: false, cancelled: true });
        questionResolverRef.current = null;
    }, []);

    const [collectionItems, setCollectionItems] = useState([]);
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [groups, setGroups] = useState(
        () => canvasRecord?.groups || (isGuest ? loadGuestGroups() : {}),
    );

    // Guests have no backend record — persist groups alongside the elements/defs
    // that useEditorState / useEditorDefs already back up to localStorage.
    useEffect(() => {
        if (isGuest) storeGuestGroups(groups);
    }, [isGuest, groups]);

    // Warn loudly if local persistence starts failing (quota) — otherwise a
    // reload silently loses the whole canvas.
    const persistWarnedRef = useRef(false);
    useEffect(() => {
        if (persistStatus === "ok") {
            persistWarnedRef.current = false;
            return;
        }
        if (persistWarnedRef.current) return;
        persistWarnedRef.current = true;
        toast.error(
            persistStatus === "partial"
                ? "This device's storage is full — the canvas is being saved without embedded images. Save to your account to keep everything."
                : "Could not save the canvas locally (storage full). Your work will be lost on reload — save to your account now.",
            { duration: 8000 },
        );
    }, [persistStatus]);
    const groupCounterRef = useRef(0);

    // Component-level group helpers (stable callbacks usable outside clientToolHandlers)
    const makeGroupUI = useCallback((elementIds, name) => {
        groupCounterRef.current += 1;
        const gid = `grp_${Date.now()}_${groupCounterRef.current}`;
        const deduped = [...new Set(elementIds)];
        setGroups(prev => ({ ...prev, [gid]: { id: gid, name: name || 'Group', elementIds: deduped } }));
        return gid;
    }, []);

    const dissolveGroupUI = useCallback((groupId) => {
        setGroups(prev => { const next = { ...prev }; delete next[groupId]; return next; });
    }, []);

    const renameGroupUI = useCallback((groupId, name) => {
        setGroups(prev => prev[groupId] ? { ...prev, [groupId]: { ...prev[groupId], name } } : prev);
    }, []);

    const scaleRef = useRef(1);
    const canvasRef = useRef();
    const canvasCtrl = useRef({});
    const eyedropperPrevIdRef = useRef(null);
    const panelDragRef = useRef(null);
    const autoSaveTimerRef = useRef(null);

    // ── Panel drag-resize ─────────────────────────────────────────────────────
    useEffect(() => {
        function onMove(e) {
            if (!panelDragRef.current) return;
            const dx = panelDragRef.current.startX - e.clientX;
            const next = Math.min(
                Math.max(panelDragRef.current.startW + dx, 240),
                560,
            );
            setPanelWidth(next);
        }
        function onUp() {
            panelDragRef.current = null;
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, []);

    const {
        elements,
        elementsRef,
        persistStatus,
        selectedId,
        selectedIds,
        setSelectedId,
        setPrimarySelectedId,
        setSelectedIds,
        toggleSelectedId,
        canUndo,
        canRedo,
        undo,
        redo,
        addElement,
        addElements,
        updateElementLive,
        updateElementsLive,
        updateElement,
        updateElements,
        snapshotBeforeLive,
        commitCurrent,
        deleteElement,
        deleteElements,
        bringForward,
        sendBackward,
        alignElement,
        reorderElement,
    } = useEditorState(initialElements);

    const {
        defs,
        addGradient,
        addVariable,
        updateVariable,
        removeVariable,
        addKeyframe,
        addFont,
        removeFont,
        setDefsFromImport,
    } = useEditorDefs(initialDefs);

    const { animOverrides, scheduleFlip, scheduleFadeIn, scheduleFlipBatch } =
        useAiAnimations();

    useEffect(() => {
        setIsPublic(canvasRecord?.public ?? true);
    }, [canvasRecord?.public]);

    const handlePaletteInsertIcon = useCallback((dataUrl, _name) => {
        const w = canvasSize.width, h = canvasSize.height;
        const id = freshId('image');
        addElement({
            id, type: 'image',
            x: Math.round(w / 2 - 40), y: Math.round(h / 2 - 40),
            width: 80, height: 80,
            href: dataUrl,
            fill: '#0d65d9', iconColors: {},
            stroke: 'none', strokeWidth: 0,
            strokeDash: 'solid', strokeLinecap: 'butt',
            opacity: 1, visible: true, locked: false, description: '',
        });
    }, [canvasSize, addElement]);

    const handlePaletteSelectElement = useCallback((id) => {
        setSelectedIds([id]);
        setSelectedId(id);
    }, [setSelectedIds, setSelectedId]);

    const refreshCollectionItems = useCallback(async () => {
        setCollectionsLoading(true);
        const local = loadLocalCollection();
        try {
            const response = await collections.listMine();
            setCollectionItems([...(response.data.data.items || []), ...local]);
        } catch (error) {
            // Guests / offline — fall back to the local collection only.
            console.error("Failed to load collection items:", error);
            setCollectionItems(local);
        } finally {
            setCollectionsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshCollectionItems();
    }, [refreshCollectionItems]);

    const buildCanvasPayload = useCallback(async () => {
        const svg = serializeElements(elements, canvasSize, defs);
        const previewSvg = await inlineExternalImages(svg);
        return {
            id: canvasRecord?._id,
            name: templateName?.trim() || "Untitled Template",
            public: isPublic,
            canvasSize,
            elements,
            defs,
            groups,
            svg,
            previewSvg,
        };
    }, [canvasRecord?._id, canvasSize, defs, elements, groups, isPublic, templateName]);

    const refreshCanvasRecord = useCallback(
        (canvas) => {
            setSaveState({
                status: "saved",
                updatedAt: canvas?.updatedAt || new Date().toISOString(),
            });
            onCanvasRecordChange?.(canvas);
        },
        [onCanvasRecordChange],
    );

    const handleManualSave = useCallback(async () => {
        if (isGuest) {
            // No cloud account — work is already mirrored to localStorage.
            storeGuestGroups(groups);
            setSaveState({ status: "saved", updatedAt: new Date().toISOString() });
            toast.success("Saved locally on this device");
            return;
        }
        try {
            setSaveState((prev) => ({ ...prev, status: "saving" }));
            const response = await canvases.saveCanvas(await buildCanvasPayload());
            const canvas = response.data.data.canvas;
            refreshCanvasRecord(canvas);
            onCanvasesRefresh?.();
            toast.success(`Saved "${canvas.name}"`);
        } catch (error) {
            console.error("Failed to save canvas:", error);
            setSaveState((prev) => ({ ...prev, status: "error" }));
            toast.error("Could not save canvas");
        }
    }, [buildCanvasPayload, groups, isGuest, onCanvasesRefresh, refreshCanvasRecord]);

    useEffect(() => {
        if (isGuest) {
            // Guest auto-save: elements/defs/groups persist to localStorage on
            // change; just reflect that in the save indicator.
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
                storeGuestGroups(groups);
                setSaveState({ status: "saved", updatedAt: new Date().toISOString() });
            }, 1800);
            return () => {
                if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            };
        }
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                setSaveState((prev) => ({ ...prev, status: "saving" }));
                const response = await canvases.saveDraft(await buildCanvasPayload());
                refreshCanvasRecord(response.data.data.canvas);
            } catch (error) {
                console.error("Auto-save failed:", error);
                setSaveState((prev) => ({ ...prev, status: "error" }));
            }
        }, 1800);

        return () => {
            if (autoSaveTimerRef.current)
                clearTimeout(autoSaveTimerRef.current);
        };
    }, [buildCanvasPayload, groups, isGuest, refreshCanvasRecord]);

    useEffect(() => {
        if (!showExportMenu) return;
        function handleOutside(e) {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setShowExportMenu(false);
            }
        }
        document.addEventListener("pointerdown", handleOutside);
        return () => document.removeEventListener("pointerdown", handleOutside);
    }, [showExportMenu]);

    // Inject / remove loaded fonts in the document head whenever the font list changes
    useEffect(() => {
        const fonts = (defs.fonts || []).filter(
            (font) => typeof font?.name === "string" && font.name.trim(),
        );
        const fontDomId = (name) =>
            `font-inject-${name.trim().replace(/\s+/g, "-")}`;
        const activeIds = new Set(fonts.map((f) => fontDomId(f.name)));

        // Remove DOM elements for fonts that were deleted
        document.head.querySelectorAll('[id^="font-inject-"]').forEach((el) => {
            if (!activeIds.has(el.id)) el.remove();
        });

        // Add DOM elements for newly added fonts
        for (const font of fonts) {
            const domId = fontDomId(font.name);
            if (document.getElementById(domId)) continue;
            if (font.type === "google") {
                const link = document.createElement("link");
                link.id = domId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.name)}:wght@400;700&display=swap`;
                document.head.appendChild(link);
            } else if (font.type === "custom" && font.dataUrl) {
                const style = document.createElement("style");
                style.id = domId;
                style.textContent = `@font-face { font-family: '${font.name}'; src: url('${font.dataUrl}') format('${font.format || "truetype"}'); }`;
                document.head.appendChild(style);
            }
        }
    }, [defs.fonts]);

    // Auto-switch to properties tab when user manually selects an element
    const userSelectingRef = useRef(false);
    useEffect(() => {
        if (userSelectingRef.current && selectedId && activeDock === "ai") {
            setActiveDock("properties");
        }
        userSelectingRef.current = false;
    }, [selectedId]);

    const { bindings, keymapName, matchAction, importKeymap, resetToDefault } =
        useKeymap();

    const markUserSelect = useCallback(
        (fn) =>
            (...args) => {
                userSelectingRef.current = true;
                return fn(...args);
            },
        [],
    );

    const {
        onElementPointerDown,
        onPointerMove,
        onPointerUp,
        onCanvasPointerDown,
    } = useEditorInteractions({
        elements,
        selectedId,
        selectedIds,
        setSelectedId: markUserSelect(setSelectedId),
        setPrimarySelectedId: markUserSelect(setPrimarySelectedId),
        setSelectedIds: markUserSelect(setSelectedIds),
        toggleSelectedId: markUserSelect(toggleSelectedId),
        updateElementLive,
        updateElementsLive,
        commitCurrent,
        snapshotBeforeLive,
        deleteElement,
        deleteElements,
        activeTool,
        addElement,
        onAfterAddElement: () => setActiveTool("select"),
        canvasRef,
        scaleRef,
        canvasSize,
        snapEnabled,
        gridSize: 8,
        groups,
    });

    const handleSetActiveTool = useCallback(
        (tool) => {
            if (tool === "eyedropper") eyedropperPrevIdRef.current = selectedId;
            setActiveTool(tool);
        },
        [selectedId],
    );

    const duplicateElements = useCallback(() => {
        if (!selectedIds.length) return;
        syncCounter(elements);
        const dupes = selectedIds
            .map((id) => elements.find((e) => e.id === id))
            .filter(Boolean)
            .map((el) => ({
                ...structuredClone(el),
                id: freshId(el.type),
                x: el.x + 10,
                y: el.y + 10,
            }));
        if (dupes.length) addElements(dupes);
    }, [addElements, elements, selectedIds]);

    const toggleSelectionLock = useCallback(() => {
        if (!selectedIds.length) return;
        const hasUnlocked = selectedIds.some(
            (id) => !elements.find((el) => el.id === id)?.locked,
        );
        updateElements(selectedIds, { locked: hasUnlocked });
    }, [elements, selectedIds, updateElements]);

    const toggleSelectionVisibility = useCallback(() => {
        if (!selectedIds.length) return;
        const hasVisible = selectedIds.some(
            (id) => elements.find((el) => el.id === id)?.visible !== false,
        );
        updateElements(selectedIds, { visible: !hasVisible });
    }, [elements, selectedIds, updateElements]);

    const bringSelectionForward = useCallback(() => {
        if (!selectedIds.length) return;
        selectedIds.forEach((id) => bringForward(id));
    }, [bringForward, selectedIds]);

    const sendSelectionBackward = useCallback(() => {
        if (!selectedIds.length) return;
        selectedIds.forEach((id) => sendBackward(id));
    }, [selectedIds, sendBackward]);

    const editSelectedText = useCallback(() => {
        if (!selectedId) return;
        const el = elements.find((item) => item.id === selectedId);
        if (el?.type === "text") {
            canvasCtrl.current.textEdit?.(selectedId);
        }
    }, [elements, selectedId]);

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        function onKey(e) {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
                return;

            if (e.ctrlKey && e.shiftKey && e.key === "C") {
                e.preventDefault();
                setPickerMode((m) => !m);
                return;
            }
            if (e.ctrlKey && e.key === "d") {
                e.preventDefault();
                duplicateElements();
                return;
            }
            // Lock/unlock selected (Ctrl+L)
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "l") {
                if (selectedIds.length) {
                    e.preventDefault();
                    const hasUnlocked = selectedIds.some(
                        (id) => !elements.find((el) => el.id === id)?.locked,
                    );
                    updateElements(selectedIds, { locked: hasUnlocked });
                }
                return;
            }
            // Save to collection (Ctrl+Shift+B)
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "b") {
                if (selectedIds.length) {
                    e.preventDefault();
                    handleSaveToCollection(
                        elements.filter((el) => selectedIds.includes(el.id)),
                    );
                }
                return;
            }
            // Edit text (F2 or Enter on text element)
            if (
                (e.key === "F2" || e.key === "Enter") &&
                selectedIds.length === 1
            ) {
                const el = elements.find((el) => el.id === selectedId);
                if (el?.type === "text") {
                    e.preventDefault();
                    canvasCtrl.current.textEdit?.(selectedId);
                    return;
                }
            }
            if (e.key === "Escape" && activeTool === "eyedropper") {
                if (eyedropperPrevIdRef.current)
                    setSelectedId(eyedropperPrevIdRef.current);
                setActiveTool("select");
                eyedropperPrevIdRef.current = null;
                return;
            }
            if (e.key === "Escape" && pickerMode) {
                setPickerMode(false);
                return;
            }
            if (e.key === "0" || (e.ctrlKey && e.key === "0")) {
                e.preventDefault();
                canvasCtrl.current.fitViewport?.();
                return;
            }
            if (e.key === "=" || e.key === "+") {
                e.preventDefault();
                canvasCtrl.current.zoomIn?.();
                return;
            }
            if (e.key === "-") {
                e.preventDefault();
                canvasCtrl.current.zoomOut?.();
                return;
            }

            // Backspace / Delete — delete (hardcoded alias so it works regardless of keymap)
            if (
                (e.key === "Backspace" || e.key === "Delete") &&
                selectedIds.length > 0
            ) {
                e.preventDefault();
                deleteElements(selectedIds);
                return;
            }

            // Arrow key nudge
            if (
                selectedIds.length === 1 &&
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                )
            ) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const dx =
                    e.key === "ArrowLeft"
                        ? -step
                        : e.key === "ArrowRight"
                          ? step
                          : 0;
                const dy =
                    e.key === "ArrowUp"
                        ? -step
                        : e.key === "ArrowDown"
                          ? step
                          : 0;
                const el = elements.find((el) => el.id === selectedId);
                if (el && !el.locked)
                    updateElement(selectedId, { x: el.x + dx, y: el.y + dy });
                return;
            }

            // Ctrl/Cmd+K — command palette
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowCommandPalette((v) => !v);
                return;
            }

            // Ctrl/Cmd+G — group selected; Ctrl/Cmd+Shift+G — ungroup
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Ungroup: dissolve any group that contains a selected element
                    const groupsToDissolve = Object.values(groups).filter(
                        (g) => g.elementIds.some((id) => selectedIds.includes(id))
                    );
                    groupsToDissolve.forEach((g) => dissolveGroupUI(g.id));
                } else if (selectedIds.length >= 2) {
                    makeGroupUI(selectedIds);
                }
                return;
            }

            const action = matchAction(e);
            if (!action) return;

            if (TOOL_ACTIONS.includes(action)) {
                e.preventDefault();
                handleSetActiveTool(action);
                return;
            }

            switch (action) {
                case "undo":
                    e.preventDefault();
                    undo();
                    break;
                case "redo":
                    e.preventDefault();
                    redo();
                    break;
                case "delete":
                    if (selectedIds.length) {
                        e.preventDefault();
                        deleteElements(selectedIds);
                    }
                    break;
                case "selectAll":
                    e.preventDefault();
                    if (elements.length)
                        setSelectedId(elements[elements.length - 1].id);
                    break;
                case "deselect":
                    setSelectedIds([]);
                    break;
                case "bringForward":
                    if (selectedIds.length) bringForward(selectedId);
                    break;
                case "sendBackward":
                    if (selectedIds.length) sendBackward(selectedId);
                    break;
                case "matchImageSize": {
                    const imgEl = elements.find((el) => el.id === selectedId);
                    if (imgEl?.type === "image" && imgEl.href) {
                        e.preventDefault();
                        const img = new Image();
                        img.onload = () => {
                            const nw = img.naturalWidth,
                                nh = img.naturalHeight;
                            const currentScale = Math.sqrt(
                                (imgEl.width / nw) * (imgEl.height / nh),
                            );
                            const scales = [
                                0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 0.75, 1,
                                1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10,
                            ];
                            const snapped = scales.reduce((a, b) =>
                                Math.abs(b - currentScale) <
                                Math.abs(a - currentScale)
                                    ? b
                                    : a,
                            );
                            updateElement(selectedId, {
                                width: Math.round(nw * snapped),
                                height: Math.round(nh * snapped),
                            });
                        };
                        img.src = imgEl.href;
                    }
                    break;
                }
                case "inspect":
                    e.preventDefault();
                    setInspectMode((v) => !v);
                    break;
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [
        activeTool,
        bringForward,
        deleteElements,
        duplicateElements,
        elements,
        handleSetActiveTool,
        matchAction,
        pickerMode,
        redo,
        selectedId,
        selectedIds,
        sendBackward,
        setSelectedId,
        setSelectedIds,
        undo,
        updateElement,
        updateElements,
    ]);

    async function handleEyedrop(targetId, isShift, clientX, clientY) {
        const sampled = elements.find((e) => e.id === targetId);
        const prevId = eyedropperPrevIdRef.current;
        const prevEl = elements.find((e) => e.id === prevId);

        if (sampled && prevEl) {
            let color = isShift ? sampled.stroke : sampled.fill;

            // For image elements, sample the actual pixel color
            if (
                sampled.type === "image" &&
                sampled.href &&
                clientX != null &&
                clientY != null
            ) {
                try {
                    const scale = scaleRef.current || 1;
                    const svgRect = canvasRef.current?.getBoundingClientRect();
                    if (svgRect) {
                        const canvasX = (clientX - svgRect.left) / scale;
                        const canvasY = (clientY - svgRect.top) / scale;
                        const relX = (canvasX - sampled.x) / sampled.width;
                        const relY = (canvasY - sampled.y) / sampled.height;
                        const pixelColor = await sampleImagePixel(
                            sampled.href,
                            relX,
                            relY,
                        );
                        if (pixelColor) color = pixelColor;
                    }
                } catch {}
            }

            if (color && color !== "none") {
                updateElement(
                    prevId,
                    isShift ? { stroke: color } : { fill: color },
                );
            }
        }

        setSelectedId(prevId || targetId);
        setActiveTool("select");
        eyedropperPrevIdRef.current = null;
    }

    const safeFilename = (ext) => {
        const base = (templateName || "canvas").trim().replace(/[\\/:*?"<>|]/g, "_") || "canvas";
        return `${base}.${ext}`;
    };

    async function handleDownloadSVG() {
        setShowExportMenu(false);
        const svg = serializeElements(elements, canvasSize, defs);
        const inlined = await inlineExternalImages(svg);
        const blob = new Blob([inlined], { type: "image/svg+xml" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = safeFilename("svg");
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function handleDownloadPNG() {
        setShowExportMenu(false);
        const svg = serializeElements(elements, canvasSize, defs);
        const { dataUrl } = await createCanvasScreenshot(svg, canvasSize, { format: "png", maxDimension: 4096 });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = safeFilename("png");
        a.click();
    }

    function handleFinish() {
        const svg = serializeElements(elements, canvasSize, defs);
        onFinish(svg);
    }

    function handleZoomCommit(val) {
        const pct = Math.min(Math.max(parseInt(val) || 1, 1), 3000);
        setZoomDisplay(pct);
        canvasCtrl.current.setZoomPct?.(pct);
    }

    const buildEditorContext = useCallback(() => {
        const W = canvasSize.width;
        const H = canvasSize.height;
        const elementsWithBounds = elements.map((el) => {
            const b = effectiveTextBounds(el);
            const oL = b.x < 0 ? -b.x : 0;
            const oT = b.y < 0 ? -b.y : 0;
            const oR = b.x + b.width > W ? b.x + b.width - W : 0;
            const oB = b.y + b.height > H ? b.y + b.height - H : 0;
            const hasOverflow = oL > 0 || oT > 0 || oR > 0 || oB > 0;
            const w = el.width || 0;
            const h = el.height || 0;
            return {
                id: el.id,
                type: el.type,
                x: el.x,
                y: el.y,
                width: w,
                height: h,
                right: el.x + w,
                bottom: el.y + h,
                fill: el.fill,
                fontSize: el.fontSize,
                text: el.type === "text" ? el.text?.slice(0, 80) : undefined,
                locked: el.locked,
                visible: el.visible !== false,
                ...(hasOverflow
                    ? { OVERFLOW: { left: oL, top: oT, right: oR, bottom: oB } }
                    : {}),
            };
        });
        const overflowCount = elementsWithBounds.filter(
            (e) => e.OVERFLOW,
        ).length;
        return {
            canvas: {
                width: W,
                height: H,
                origin: "top-left (0,0). x increases →, y increases ↓.",
                rule: `x >= 0, y >= 0, x+width <= ${W}, y+height <= ${H}`,
                centerX: W / 2,
                centerY: H / 2,
            },
            selectedId,
            selectedIds,
            elements: elementsWithBounds,
            elementCount: elements.length,
            collections: {
                count: collectionItems.length,
                items: collectionItems.slice(0, 20).map((item) => ({
                    id: item._id,
                    name: item.name,
                    elementCount: item.elements?.length || 0,
                })),
            },
            groups: Object.values(groups).map(g => ({ groupId: g.id, name: g.name, elementIds: g.elementIds })),
            ...(overflowCount > 0
                ? {
                      WARNING: `${overflowCount} element(s) overflow canvas bounds — call check_layout for details.`,
                  }
                : {}),
            defsSummary: {
                gradientCount: defs.gradients?.length || 0,
                variableNames: (defs.variables || []).map((v) => v.name),
                fontNames: (defs.fonts || [])
                    .map((f) => f?.name)
                    .filter(Boolean),
            },
            svg: serializeElements(elements, canvasSize, defs),
        };
    }, [canvasSize, collectionItems, defs, elements, groups, selectedId, selectedIds]);

    const captureCanvasScreenshot = useCallback(
        async (options = {}) => {
            // Read the live ref so a screenshot taken right after an edit
            // reflects that edit, not a stale render closure.
            const svg = serializeElements(
                elementsRef.current || elements,
                canvasSize,
                defs,
            );
            return createCanvasScreenshot(svg, canvasSize, options);
        },
        [canvasSize, defs, elements, elementsRef],
    );

    const uploadScreenshotResult = useCallback(async (result, filename) => {
        const blob = await (await fetch(result.dataUrl)).blob();
        const url = await uploadImageToStore(blob, filename);
        return {
            url,
            width: result.width,
            height: result.height,
            sourceX: result.sourceX,
            sourceY: result.sourceY,
            sourceWidth: result.sourceWidth,
            sourceHeight: result.sourceHeight,
        };
    }, []);

    const captureRegionScreenshot = useCallback(
        async (region, options = {}, filename = "region.png") => {
            const nextRegion = clampRegionToCanvas(region, canvasSize);
            const result = await captureCanvasScreenshot({
                ...options,
                ...nextRegion,
            });
            return uploadScreenshotResult(result, filename);
        },
        [canvasSize, captureCanvasScreenshot, uploadScreenshotResult],
    );

    const captureElementScreenshot = useCallback(
        async (id, options = {}) => {
            const el = elements.find((entry) => entry.id === id);
            if (!el) throw new Error(`Element "${id}" not found`);
            const padding = Number.isFinite(Number(options.padding))
                ? Number(options.padding)
                : 24;
            return captureRegionScreenshot(
                getElementBounds(el, padding),
                options,
                `${id}.${options.format || "png"}`,
            );
        },
        [captureRegionScreenshot, elements],
    );

    const prepareImportedElements = useCallback(
        (sourceElements, placement = "original") => {
            if (!Array.isArray(sourceElements) || !sourceElements.length)
                return [];

            syncCounter(elements);
            const cloned = structuredClone(sourceElements);

            let offsetX = 0;
            let offsetY = 0;

            if (placement === "center") {
                let minX = Infinity;
                let minY = Infinity;
                for (const element of cloned) {
                    minX = Math.min(minX, element.x ?? 0);
                    minY = Math.min(minY, element.y ?? 0);
                }
                offsetX = canvasSize.width / 2 - minX;
                offsetY = canvasSize.height / 2 - minY;
            }

            // Track IDs claimed in this batch so duplicates within the batch
            // also get fresh IDs.
            const takenIds = new Set(elements.map((e) => e.id));
            return cloned.map((element) => {
                let id;
                if (element.id && !takenIds.has(element.id)) {
                    id = element.id;
                    claimId(id);
                } else {
                    id = freshId(element.type || "element");
                }
                takenIds.add(id);
                return {
                    ...element,
                    id,
                    x: (element.x ?? 0) + offsetX,
                    y: (element.y ?? 0) + offsetY,
                };
            });
        },
        [canvasSize, elements],
    );

    const addPreparedElements = useCallback(
        (preparedElements, { selectNew = true } = {}) => {
            if (!preparedElements.length) return [];
            const previousSelection = [...selectedIds];
            addElements(preparedElements);
            if (!selectNew) setSelectedIds(previousSelection);
            return preparedElements.map((element) => element.id);
        },
        [addElements, selectedIds, setSelectedIds],
    );

    const insertElementsAtCenter = useCallback(
        (newEls) => {
            addPreparedElements(prepareImportedElements(newEls, "center"));
        },
        [addPreparedElements, prepareImportedElements],
    );

    async function handleSaveToCollection(selectedEls, overrideName) {
        const name = overrideName || (
            selectedEls.length === 1
                ? selectedEls[0].text || selectedEls[0].id
                : `${selectedEls.length} elements`
        );

        let minX = Infinity;
        let minY = Infinity;
        for (const element of selectedEls) {
            minX = Math.min(minX, element.x ?? 0);
            minY = Math.min(minY, element.y ?? 0);
        }

        const normalizedElements = selectedEls.map((element) => ({
            ...structuredClone(element),
            x: (element.x ?? 0) - minX,
            y: (element.y ?? 0) - minY,
        }));

        let maxX = 0;
        let maxY = 0;
        for (const element of normalizedElements) {
            maxX = Math.max(maxX, (element.x ?? 0) + (element.width || 0));
            maxY = Math.max(maxY, (element.y ?? 0) + (element.height || 0));
        }

        const payload = {
            name,
            elements: normalizedElements,
            thumbnail: serializeElements(normalizedElements, {
                width: Math.max(maxX + 10, 20),
                height: Math.max(maxY + 10, 20),
            }),
        };

        if (isGuest) {
            const entry = saveLocalCollectionItem(payload);
            await refreshCollectionItems();
            toast.success("Saved to collection (this device)");
            return { ok: true, id: entry._id, local: true };
        }
        try {
            const resp = await collections.saveItem(payload);
            await refreshCollectionItems();
            toast.success("Saved to collection");
            return { ok: true, id: resp?.data?.data?.item?._id, local: false };
        } catch (error) {
            console.error("Failed to save collection item:", error);
            // Don't lose the save — keep it locally and tell the caller.
            const entry = saveLocalCollectionItem(payload);
            await refreshCollectionItems();
            toast("Saved to collection locally (server unavailable)");
            return { ok: true, id: entry._id, local: true, serverError: true };
        }
    }

    function handleInsertFromCollection(item) {
        insertElementsAtCenter(item.elements);
        setShowCollection(false);
    }

    const handleDeleteCollectionItem = useCallback(
        async (item) => {
            try {
                await collections.deleteItem(item._id);
                setCollectionItems((current) =>
                    current.filter((entry) => entry._id !== item._id),
                );
            } catch (error) {
                console.error("Failed to delete collection item:", error);
                toast.error("Could not delete collection item");
            }
        },
        [],
    );

    const handlePasteSVG = useCallback(
        (svgText) => {
            const { elements: parsed } = parseSVGToElements(svgText);
            if (parsed.length) insertElementsAtCenter(parsed);
        },
        [insertElementsAtCenter],
    );

    const clientToolHandlers = useMemo(() => {
        function addElementsAnimated(els) {
            shiftElemsUp(els);
            addElements(els);
            for (const el of els) scheduleFadeIn(el.id);
        }

        const shiftElemsUp = (elems) => {
            const maxB = Math.max(...elems.filter(e => e.type !== "line" && e.y !== undefined && e.height !== undefined).map(e => e.y + e.height));
            if (maxB > canvasSize.height) {
                const shift = Math.max(0, Math.min(maxB - canvasSize.height, Math.min(...elems.filter(e => e.y !== undefined).map(e => e.y))));
                if (shift > 0) elems.forEach(e => { if (e.y !== undefined) e.y -= shift; });
            }
        };

        // ── Group helpers ─────────────────────────────────────────────────────
        function freshGroupId() {
            groupCounterRef.current += 1;
            return `grp_${Date.now()}_${groupCounterRef.current}`;
        }

        // Expand a mixed array of element IDs and group IDs into element IDs only.
        function resolveToElementIds(inputIds) {
            const out = [];
            const seen = new Set();
            for (const id of (inputIds || [])) {
                if (groups[id]) {
                    for (const eid of groups[id].elementIds) {
                        if (!seen.has(eid)) { seen.add(eid); out.push(eid); }
                    }
                } else {
                    if (!seen.has(id)) { seen.add(id); out.push(id); }
                }
            }
            return out;
        }

        function makeGroup(elementIds, name) {
            const gid = freshGroupId();
            const deduped = [...new Set(elementIds)];
            setGroups(prev => ({ ...prev, [gid]: { id: gid, name: name || gid, elementIds: deduped } }));
            return gid;
        }

        function makeRectElement({
            id = freshId("rect"),
            x = 0,
            y = 0,
            width = 100,
            height = 40,
            fill = "#ffffff",
            stroke = "none",
            strokeWidth = 0,
            rx = 0,
            opacity = 1,
        } = {}) {
            return {
                type: "rect", id, x, y, width, height, fill, stroke, strokeWidth,
                rx, ry: rx, opacity, visible: true, locked: false, description: "",
                strokeDash: "solid", strokeLinecap: "butt",
            };
        }

        function makeTextElement({
            id = freshId("text"),
            x = 0,
            y = 0,
            width = 100,
            height,
            text = "",
            fontSize = 14,
            fontWeight = "normal",
            fontFamily = "sans-serif",
            fill = "#111111",
            textAnchor = "start",
            lineHeight = 1.2,
            textWrap = true,
        } = {}) {
            const normalizedText = normalizeAgentText(text);
            return {
                type: "text", id, x, y, width,
                height: height ?? measureWrappedTextHeight(normalizedText, { width, fontSize, lineHeight, textWrap }),
                text: normalizedText, fontSize, fontWeight, fontFamily, textAnchor,
                lineHeight, textWrap, fill, stroke: "none", strokeWidth: 0,
                opacity: 1, visible: true, locked: false, description: "",
                strokeDash: "solid", strokeLinecap: "butt",
            };
        }

        function makeImageElement({
            id = freshId("image"),
            x = 0,
            y = 0,
            width = 100,
            height = 100,
            href = "",
            fill = "#e2e8f0",
            iconColors = {},
            rx = 0,
        } = {}) {
            return {
                type: "image", id, x, y, width, height, href, fill, iconColors,
                stroke: "none", strokeWidth: 0, rx, ry: rx, opacity: 1,
                visible: true, locked: false, description: "",
                strokeDash: "solid", strokeLinecap: "butt",
            };
        }

        function pruneGroupsAfterDelete(deletedIds) {
            const del = new Set(deletedIds);
            setGroups(prev => {
                const next = {};
                for (const [gid, g] of Object.entries(prev)) {
                    const remaining = g.elementIds.filter(id => !del.has(id));
                    if (remaining.length > 0) next[gid] = { ...g, elementIds: remaining };
                }
                return next;
            });
        }

        // Render canvas to PNG, upload, and return URL
        async function screenshotAndUpload() {
            const result = await captureCanvasScreenshot({
                format: "png",
                maxDimension: 1024,
            });
            const blob = await (await fetch(result.dataUrl)).blob();
            return uploadImageToStore(blob, "canvas.png");
        }

        // Live element list — read at call time so results reflect edits made
        // moments earlier by the same agent (avoids stale-closure snapshots).
        const live = () => elementsRef.current || elements;

        const h = {
            // ── Read ──────────────────────────────────────────────────────────────
            get_canvas_state: async () => ({
                canvasSize,
                elementCount: live().length,
                elements: live().map((el) => ({
                    id: el.id,
                    zIndex: live().findIndex((entry) => entry.id === el.id),
                    type: el.type,
                    x: el.x,
                    y: el.y,
                    width: el.width,
                    height: el.height,
                    fill: el.fill,
                    stroke: el.stroke,
                    opacity: el.opacity,
                    text: el.text,
                    locked: el.locked,
                    visible: el.visible,
                    fontSize: el.fontSize,
                    fontFamily: el.fontFamily,
                })),
                selectedId,
                selectedIds,
                collectionCount: collectionItems.length,
                groups: Object.values(groups).map(g => ({ groupId: g.id, name: g.name, elementIds: g.elementIds })),
            }),
            list_elements: async () =>
                live().map((el, index) => ({
                    id: el.id,
                    zIndex: index,
                    type: el.type,
                    x: el.x,
                    y: el.y,
                    width: el.width,
                    height: el.height,
                    fill: el.fill,
                    stroke: el.stroke,
                    text: el.text,
                    locked: el.locked,
                    visible: el.visible,
                })),
            get_element: async ({ id } = {}) => {
                const el = live().find((e) => e.id === id);
                if (!el) throw new Error(`Element "${id}" not found`);
                return {
                    ...el,
                    zIndex: live().findIndex((entry) => entry.id === id),
                };
            },
            get_snapshot: async () => ({
                canvasSize,
                elements: live(),
                defs,
                selectedId,
                selectedIds,
                svg: serializeElements(live(), canvasSize, defs),
            }),
            get_selected_elements: async () => {
                const selectedSet = new Set(selectedIds);
                if (selectedId) selectedSet.add(selectedId);
                const selected = elements.filter((el) => selectedSet.has(el.id));
                return {
                    selectedIds: selected.map((el) => el.id),
                    count: selected.length,
                    elements: selected,
                };
            },

            // ── Screenshot ────────────────────────────────────────────────────────
            take_screenshot: async () => {
                const url = await screenshotAndUpload();
                return url || "Screenshot failed: could not upload";
            },
            get_canvas_screenshot: async (opts = {}) => {
                const result = await captureCanvasScreenshot(opts);
                return uploadScreenshotResult(
                    result,
                    `screenshot.${opts.format || "png"}`,
                );
            },
            get_element_screenshot: async ({ id, ...opts } = {}) =>
                captureElementScreenshot(id, opts),
            get_region_screenshot: async ({
                x,
                y,
                width,
                height,
                ...opts
            } = {}) =>
                captureRegionScreenshot(
                    { x, y, width, height },
                    opts,
                    `region.${opts.format || "png"}`,
                ),
            review_canvas_region: async ({
                id,
                x,
                y,
                width,
                height,
                goals = [],
                padding = 24,
                ...opts
            } = {}) => {
                const screenshot = id
                    ? await captureElementScreenshot(id, { ...opts, padding })
                    : await captureRegionScreenshot(
                          { x, y, width, height },
                          opts,
                          `review.${opts.format || "png"}`,
                      );
                const region = clampRegionToCanvas(
                    id
                        ? getElementBounds(
                              elements.find((entry) => entry.id === id),
                              Number.isFinite(Number(padding))
                                  ? Number(padding)
                                  : 24,
                          )
                        : { x, y, width, height },
                    canvasSize,
                );
                return {
                    screenshot,
                    review: buildRegionReview(
                        elements,
                        region,
                        canvasSize,
                        goals,
                    ),
                    note: "Use the screenshot URL for visual review and combine it with the structured suggestions.",
                };
            },
            find_text_elements: async ({
                pattern,
                query,
                text,
                flags = "i",
                ids = [],
                select = false,
                regex: asRegex = true,
            } = {}) => {
                const raw = pattern ?? query ?? text;
                if (raw == null || String(raw) === "")
                    throw new Error("Provide a search string as `query` (or `pattern`).");
                // Treat a plain string literally unless it looks like a regex or
                // regex:false was passed.
                const needle = asRegex === false
                    ? String(raw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                    : String(raw);
                const regex = buildRegex(needle, flags);
                const pool = ids.length
                    ? live().filter((el) => ids.includes(el.id))
                    : live();
                const matches = pool
                    .filter((el) => {
                        if (el.type !== "text") return false;
                        regex.lastIndex = 0;
                        return regex.test(el.text || "");
                    })
                    .map((el) => ({
                        id: el.id,
                        text: el.text,
                        x: el.x,
                        y: el.y,
                        width: el.width,
                        height: el.height,
                    }));
                if (select && matches.length) {
                    const matchIds = matches.map((item) => item.id);
                    setSelectedIds(matchIds);
                    setPrimarySelectedId(matchIds[0]);
                }
                return { count: matches.length, matches };
            },
            list_collection_items: async () =>
                collectionItems.map((item) => ({
                    id: item._id,
                    name: item.name,
                    elementCount: item.elements?.length || 0,
                    updatedAt: item.updatedAt,
                    createdAt: item.createdAt,
                })),
            get_collection_item: async ({ id } = {}) => {
                const item = collectionItems.find((entry) => entry._id === id);
                if (!item) throw new Error(`Collection item "${id}" not found`);
                return {
                    id: item._id,
                    name: item.name,
                    elementCount: item.elements?.length || 0,
                    elements: item.elements || [],
                    updatedAt: item.updatedAt,
                    createdAt: item.createdAt,
                };
            },
            insert_collection_item: async ({
                id,
                placement = "center",
                selectNew = true,
            } = {}) => {
                const item = collectionItems.find((entry) => entry._id === id);
                if (!item) throw new Error(`Collection item "${id}" not found`);
                const prepared = prepareImportedElements(
                    item.elements || [],
                    placement === "original" ? "original" : "center",
                );
                const ids = addPreparedElements(prepared, { selectNew });
                for (const addedId of ids) scheduleFadeIn(addedId);
                return { insertedIds: ids, count: ids.length, sourceId: id };
            },
            save_to_collection: async ({ ids, name } = {}) => {
                const targetEls = ids && ids.length
                    ? ids.map((id) => elements.find((e) => e.id === id)).filter(Boolean)
                    : elements.filter((e) => selectedIds.includes(e.id));
                if (!targetEls.length) throw new Error("No elements to save. Provide ids or select elements first.");
                const collName = name || (targetEls.length === 1
                    ? (targetEls[0].text || targetEls[0].id)
                    : `${targetEls.length} elements`);
                const res = await handleSaveToCollection(targetEls, collName);
                return {
                    saved: !!res?.ok,
                    id: res?.id,
                    local: !!res?.local,
                    name: collName,
                    count: targetEls.length,
                };
            },

            // ── Groups ────────────────────────────────────────────────────────────
            create_group: async ({ ids = [], name } = {}) => {
                const elementIds = resolveToElementIds(ids).filter(id => elements.some(e => e.id === id));
                if (!elementIds.length) throw new Error("No valid element IDs to group.");
                const groupId = makeGroup(elementIds, name);
                return { groupId, name: name || groupId, count: elementIds.length, elementIds };
            },
            add_to_group: async ({ groupId, ids = [] } = {}) => {
                if (!groups[groupId]) throw new Error(`Group "${groupId}" not found.`);
                const newIds = ids.filter(id => elements.some(e => e.id === id));
                setGroups(prev => {
                    const g = prev[groupId];
                    const merged = [...new Set([...g.elementIds, ...newIds])];
                    return { ...prev, [groupId]: { ...g, elementIds: merged } };
                });
                return { groupId, count: (groups[groupId]?.elementIds.length || 0) + newIds.length };
            },
            remove_from_group: async ({ groupId, ids = [] } = {}) => {
                if (!groups[groupId]) throw new Error(`Group "${groupId}" not found.`);
                const remove = new Set(ids);
                setGroups(prev => {
                    const g = prev[groupId];
                    const remaining = g.elementIds.filter(id => !remove.has(id));
                    if (!remaining.length) {
                        const next = { ...prev };
                        delete next[groupId];
                        return next;
                    }
                    return { ...prev, [groupId]: { ...g, elementIds: remaining } };
                });
                return { groupId, removed: ids.length };
            },
            dissolve_group: async ({ groupId } = {}) => {
                if (!groups[groupId]) throw new Error(`Group "${groupId}" not found.`);
                const elementIds = groups[groupId].elementIds;
                setGroups(prev => { const next = { ...prev }; delete next[groupId]; return next; });
                return { dissolved: groupId, elementIds };
            },
            rename_group: async ({ groupId, name } = {}) => {
                if (!groups[groupId]) throw new Error(`Group "${groupId}" not found.`);
                setGroups(prev => ({ ...prev, [groupId]: { ...prev[groupId], name } }));
                return { groupId, name };
            },
            list_groups: async () =>
                Object.values(groups).map(g => ({
                    groupId: g.id,
                    name: g.name,
                    elementCount: g.elementIds.length,
                    elementIds: g.elementIds,
                })),
            get_group: async ({ groupId } = {}) => {
                const g = groups[groupId];
                if (!g) throw new Error(`Group "${groupId}" not found.`);
                const members = g.elementIds.map(id => {
                    const el = elements.find(e => e.id === id);
                    return el ? { id: el.id, type: el.type, x: el.x, y: el.y, width: el.width, height: el.height } : { id, missing: true };
                });
                return { groupId: g.id, name: g.name, elementCount: g.elementIds.length, members };
            },

            // ── History ───────────────────────────────────────────────────────────
            undo_last_action: async () => {
                if (!canUndo) return { undone: false, message: "Nothing to undo." };
                undo();
                return { undone: true };
            },
            redo_last_action: async () => {
                if (!canRedo) return { redone: false, message: "Nothing to redo." };
                redo();
                return { redone: true };
            },

            // ── Select ────────────────────────────────────────────────────────────
            select_element: async ({ id } = {}) => {
                if (!elements.some((e) => e.id === id))
                    throw new Error(`Element "${id}" not found`);
                setSelectedIds([id]);
                setPrimarySelectedId(id);
                return { selectedId: id };
            },
            select_elements: async ({ ids = [] } = {}) => {
                const valid = ids.filter((id) =>
                    elements.some((e) => e.id === id),
                );
                setSelectedIds(valid);
                if (valid.length) setPrimarySelectedId(valid[0]);
                return { selectedIds: valid, count: valid.length };
            },

            // ── Update ────────────────────────────────────────────────────────────
            update_element: async ({ id, ...patch } = {}) => {
                const oldEl = elements.find((e) => e.id === id);
                if (!oldEl) throw new Error(`Element "${id}" not found`);
                const hasGeom = ["x", "y", "width", "height"].some(
                    (k) => k in patch,
                );
                updateElement(id, patch);
                if (hasGeom) scheduleFlip(id, oldEl, { ...oldEl, ...patch });
                return { id, updated: Object.keys(patch) };
            },
            update_elements: async ({ ids = [], patch = {} } = {}) => {
                const valid = ids.filter((id) =>
                    elements.some((e) => e.id === id),
                );
                if (!valid.length) return { updatedIds: [], count: 0 };
                const hasGeom = ["x", "y", "width", "height"].some(
                    (k) => k in patch,
                );
                const flipEntries = [];
                for (const id of valid) {
                    const oldEl = elements.find((e) => e.id === id);
                    updateElement(id, patch);
                    if (hasGeom && oldEl)
                        flipEntries.push({
                            id,
                            oldEl,
                            newEl: { ...oldEl, ...patch },
                        });
                }
                if (flipEntries.length) scheduleFlipBatch(flipEntries);
                return { updatedIds: valid, count: valid.length };
            },
            set_fill: async ({ id, fill } = {}) => {
                updateElement(id, { fill });
                return { id, fill };
            },
            set_stroke: async ({ id, stroke, strokeWidth } = {}) => {
                updateElement(id, {
                    stroke,
                    ...(strokeWidth != null ? { strokeWidth } : {}),
                });
                return { id, stroke };
            },
            set_opacity: async ({ id, opacity } = {}) => {
                updateElement(id, { opacity });
                return { id, opacity };
            },
            set_text: async ({
                id,
                text,
                width,
                fontSize,
                lineHeight,
                textWrap,
                autoFitWidth = false,
            } = {}) => {
                const current = elements.find((e) => e.id === id);
                if (!current) throw new Error(`Element "${id}" not found`);
                const patch = makeTextPatch(current, {
                    text,
                    width,
                    fontSize,
                    lineHeight,
                    textWrap,
                    autoFitWidth,
                });
                updateElement(id, patch);
                return { id, ...patch };
            },
            batch_update_texts: async ({ updates = [] } = {}) => {
                const results = [];
                for (const entry of updates) {
                    const current = elements.find((e) => e.id === entry.id);
                    if (!current || current.type !== "text") {
                        results.push({ id: entry.id, skipped: true });
                        continue;
                    }
                    const patch = makeTextPatch(current, {
                        text: entry.text,
                        width: entry.width,
                        fontSize: entry.fontSize,
                        lineHeight: entry.lineHeight,
                        textWrap: entry.textWrap,
                        autoFitWidth: entry.autoFitWidth,
                    });
                    updateElement(entry.id, patch);
                    results.push({ id: entry.id, updated: Object.keys(patch) });
                }
                return { updated: results.filter((r) => !r.skipped).length, results };
            },
            move_element: async ({ id, x, y, dx, dy } = {}) => {
                const oldEl = live().find((e) => e.id === id);
                if (!oldEl) throw new Error(`Element "${id}" not found`);
                // Absolute x/y when given; otherwise treat dx/dy as a delta.
                const nextX = x != null ? nn(x) : nn(oldEl.x) + nn(dx);
                const nextY = y != null ? nn(y) : nn(oldEl.y) + nn(dy);
                const patch = { x: nextX, y: nextY };
                updateElement(id, patch);
                scheduleFlip(id, oldEl, { ...oldEl, ...patch });
                return { id, ...patch };
            },
            resize_element: async ({ id, width, height } = {}) => {
                const oldEl = elements.find((e) => e.id === id);
                if (!oldEl) throw new Error(`Element "${id}" not found`);
                updateElement(id, { width, height });
                scheduleFlip(id, oldEl, { ...oldEl, width, height });
                return { id, width, height };
            },
            lock_element: async ({ id, locked = true } = {}) => {
                updateElement(id, { locked });
                return { id, locked };
            },
            unlock_element: async ({ id } = {}) => {
                updateElement(id, { locked: false });
                return { id, locked: false };
            },
            hide_element: async ({ id } = {}) => {
                updateElement(id, { visible: false });
                return { id, visible: false };
            },
            show_element: async ({ id } = {}) => {
                updateElement(id, { visible: true });
                return { id, visible: true };
            },

            // ── Delete ────────────────────────────────────────────────────────────
            delete_element: async ({ id } = {}) => {
                if (!elements.some((e) => e.id === id))
                    throw new Error(`Element "${id}" not found`);
                deleteElements([id]);
                return { deleted: id };
            },
            delete_elements: async ({ ids = [] } = {}) => {
                const resolved = resolveToElementIds(ids);
                const valid = resolved.filter((id) =>
                    elements.some((e) => e.id === id),
                );
                if (valid.length) { deleteElements(valid); pruneGroupsAfterDelete(valid); }
                return { deletedIds: valid, count: valid.length };
            },

            // ── Add ───────────────────────────────────────────────────────────────
            add_element: async ({ type, ...props } = {}) => {
                // Sanitize: drop NaN numbers, then normalize loose geometry.
                const safe = {};
                for (const [k, v] of Object.entries(props)) {
                    if (typeof v === "number" && isNaN(v)) continue;
                    safe[k] = v;
                }
                syncCounter(elements);
                const raw = normalizeAgentElement({ type: type || "rect", ...safe });
                const elementType = raw.type;
                const id = freshId(elementType);
                const el = {
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    ...raw,
                    id,
                    x: raw.x ?? canvasSize.width / 2 - 50,
                    y: raw.y ?? canvasSize.height / 2 - 50,
                    width: raw.width ?? 100,
                    height: raw.height ?? 100,
                    fill:
                        raw.fill ||
                        (elementType === "text" ? "#111827" : "#0d65d9"),
                };
                addElement(el);
                scheduleFadeIn(id);
                return { id };
            },
            add_elements: async ({
                elements: els = [],
                selectNew = true,
            } = {}) => {
                // Strip elements with NaN coordinates before adding
                const clean = (els || []).filter((el) => {
                    return ["x", "y", "width", "height"].every(
                        (k) =>
                            el[k] === undefined ||
                            el[k] === null ||
                            (typeof el[k] === "number" && !isNaN(el[k])),
                    );
                });
                // Normalize loose geometry (cx/cy/r discs, x1/y1/x2/y2 lines,
                // ellipse->circle) and text wrapping.
                const normalized = clean.map(normalizeAgentElement);
                const skipped = els.length - clean.length;
                const prepared = prepareImportedElements(
                    normalized,
                    "original",
                );
                const ids = addPreparedElements(prepared, { selectNew });
                for (const id of ids) scheduleFadeIn(id);
                return {
                    addedIds: ids,
                    count: ids.length,
                    ...(skipped > 0 ? { skippedNaN: skipped } : {}),
                };
            },
            duplicate_element: async ({ id } = {}) => {
                const src = elements.find((e) => e.id === id);
                if (!src) throw new Error(`Element "${id}" not found`);
                syncCounter(elements);
                const newId = freshId(src.type);
                addElement({
                    ...structuredClone(src),
                    id: newId,
                    x: src.x + 10,
                    y: src.y + 10,
                });
                scheduleFadeIn(newId);
                return { originalId: id, newId };
            },
            duplicate_elements: async ({ ids = [], offset = 40, dx, dy } = {}) => {
                // Expand group IDs so all paired members are included automatically.
                const resolvedIds = resolveToElementIds(ids);
                const valid = resolvedIds
                    .map((id) => elements.find((entry) => entry.id === id))
                    .filter(Boolean);
                if (!valid.length) return { duplicatedIds: [], count: 0 };
                syncCounter(elements);
                const ox = dx !== undefined ? dx : offset;
                const oy = dy !== undefined ? dy : (dx !== undefined ? 0 : offset);
                // Map old ID → new ID so we can re-create group relationships.
                const idMap = {};
                const nextElements = valid.map((src) => {
                    const newId = freshId(src.type);
                    idMap[src.id] = newId;
                    return {
                        ...structuredClone(src),
                        id: newId,
                        x: (src.x || 0) + ox,
                        y: (src.y || 0) + oy,
                    };
                });
                addElements(nextElements);
                nextElements.forEach((entry) => scheduleFadeIn(entry.id));
                // Re-create any groups that were fully included in this duplication.
                const newGroupIds = [];
                for (const g of Object.values(groups)) {
                    const mappedIds = g.elementIds.map(id => idMap[id]).filter(Boolean);
                    if (mappedIds.length === g.elementIds.length) {
                        const newGid = makeGroup(mappedIds, g.name ? `${g.name} copy` : undefined);
                        newGroupIds.push(newGid);
                    }
                }
                // Detect which newly-placed elements overlap existing ones.
                const allExisting = elements; // snapshot before addElements resolved
                const overlaps = nextElements
                    .filter((ne) => {
                        const nl = ne.x || 0, nt = ne.y || 0, nr = nl + (ne.width || 0), nb = nt + (ne.height || 0);
                        return allExisting.some((ex) => {
                            if (ex.id === ne.id) return false;
                            const el = ex.x || 0, et = ex.y || 0, er = el + (ex.width || 0), eb = et + (ex.height || 0);
                            return nl < er && nr > el && nt < eb && nb > et;
                        });
                    })
                    .map((ne) => ne.id);
                return {
                    duplicatedIds: nextElements.map((entry) => entry.id),
                    count: nextElements.length,
                    ...(newGroupIds.length ? { duplicatedGroupIds: newGroupIds } : {}),
                    ...(overlaps.length ? { overlaps, overlapWarning: `${overlaps.length} duplicated element(s) overlap existing elements. Consider adjusting dx/dy offset.` } : {}),
                };
            },
            add_icon: async ({
                href,
                name,
                icon,
                x,
                y,
                size,
                width,
                height,
                color,
                fill = "#0d65d9",
                iconColors = {},
                opacity = 1,
                visible = true,
                locked = false,
                description = "",
            } = {}) => {
                let resolvedHref = href;
                if (!resolvedHref) {
                    const iconName = name || icon;
                    if (!iconName) {
                        throw new Error(
                            "Provide an icon `name` (e.g. \"music\", \"arrow-right\" — Lucide names) or a `href`.",
                        );
                    }
                    resolvedHref = resolveLucideIconHref(iconName, {
                        color: color || fill || "currentColor",
                    });
                    if (!resolvedHref) {
                        throw new Error(
                            `Unknown icon "${iconName}". Use a Lucide icon name (kebab or PascalCase).`,
                        );
                    }
                }
                const w = Number(size ?? width ?? 80) || 80;
                const h = Number(size ?? height ?? 80) || 80;
                syncCounter(elements);
                const id = freshId("image");
                addElement({
                    id,
                    type: "image",
                    x: x ?? canvasSize.width / 2 - w / 2,
                    y: y ?? canvasSize.height / 2 - h / 2,
                    width: w,
                    height: h,
                    href: resolvedHref,
                    fill,
                    iconColors,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity,
                    visible,
                    locked,
                    description,
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });
                scheduleFadeIn(id);
                return { id };
            },

            // ── Layer ─────────────────────────────────────────────────────────────
            bring_forward: async ({ id, steps = 1 } = {}) => {
                const n = Math.max(1, Math.round(steps));
                for (let i = 0; i < n; i++) bringForward(id);
                return { id, steps: n };
            },
            send_backward: async ({ id, steps = 1 } = {}) => {
                const n = Math.max(1, Math.round(steps));
                for (let i = 0; i < n; i++) sendBackward(id);
                return { id, steps: n };
            },
            bring_to_front: async ({ id } = {}) => {
                const currentIndex = elements.findIndex((el) => el.id === id);
                if (currentIndex === -1)
                    throw new Error(`Element "${id}" not found`);
                for (let i = currentIndex; i < elements.length - 1; i += 1) {
                    bringForward(id);
                }
                return { id };
            },
            send_to_back: async ({ id } = {}) => {
                const currentIndex = elements.findIndex((el) => el.id === id);
                if (currentIndex === -1)
                    throw new Error(`Element "${id}" not found`);
                for (let i = currentIndex; i > 0; i -= 1) {
                    sendBackward(id);
                }
                return { id };
            },

            // ── Alignment & distribution helpers ──────────────────────────────────
            fix_elements: async ({ ids = null } = {}) => {
                const targets = ids
                    ? elements.filter((e) => ids.includes(e.id))
                    : elements;
                const fixed = [],
                    removed = [];
                for (const el of targets) {
                    const coords = {
                        x: el.x,
                        y: el.y,
                        width: el.width,
                        height: el.height,
                    };
                    const hasNaN = Object.values(coords).some(
                        (v) =>
                            v !== undefined &&
                            (typeof v !== "number" || isNaN(v)),
                    );
                    if (!hasNaN) continue;
                    // Lines / shapes with NaN coords can't be saved — delete them
                    const unfixable =
                        (el.type === "line" ||
                            el.type === "circle" ||
                            el.type === "ellipse") &&
                        (isNaN(el.x1) ||
                            isNaN(el.y1) ||
                            isNaN(el.x2) ||
                            isNaN(el.y2) ||
                            isNaN(el.cx) ||
                            isNaN(el.cy) ||
                            isNaN(el.rx) ||
                            isNaN(el.ry));
                    if (unfixable) {
                        deleteElements([el.id]);
                        removed.push(el.id);
                    } else {
                        const patch = {};
                        if (typeof el.x !== "number" || isNaN(el.x))
                            patch.x = 0;
                        if (typeof el.y !== "number" || isNaN(el.y))
                            patch.y = 0;
                        if (typeof el.width !== "number" || isNaN(el.width))
                            patch.width = 100;
                        if (typeof el.height !== "number" || isNaN(el.height))
                            patch.height = 40;
                        updateElement(el.id, patch);
                        fixed.push({ id: el.id, patch });
                    }
                }
                return {
                    fixed: fixed.length,
                    removed: removed.length,
                    fixedElements: fixed,
                    removedElements: removed,
                };
            },

            align_elements: async ({
                ids = [],
                align,
                alignment,
                edge,
                margin = 0,
                relativeTo,
            } = {}) => {
                const W = canvasSize.width;
                const H = canvasSize.height;
                const targets = live().filter((e) => ids.includes(e.id));
                if (!targets.length)
                    return { aligned: 0, message: "No matching element IDs" };

                // Accept `alignment` / `edge` as aliases for `align`, plus common
                // synonyms. Default: align on the horizontal axis.
                const ALIGN_ALIASES = {
                    left: "left", right: "right", top: "top", bottom: "bottom",
                    center: "center", middle: "center",
                    "center-h": "center-h", "center-v": "center-v",
                    hcenter: "center-h", "h-center": "center-h", horizontal: "center-h",
                    "center-x": "center-h", centerx: "center-h",
                    vcenter: "center-v", "v-center": "center-v", vertical: "center-v",
                    "center-y": "center-v", centery: "center-v",
                };
                align =
                    ALIGN_ALIASES[String(align || alignment || edge || "center-h").toLowerCase()] ||
                    "center-h";

                // With 2+ elements and no explicit target, align them to a shared
                // edge (their common bounding box), not the canvas — that's what
                // "align these left" almost always means.
                if (!relativeTo) relativeTo = targets.length > 1 ? "group" : "canvas";
                const updates = [];
                const flipEntries = [];

                // Group-centering modes: shift all elements by the same delta so
                // their collective bounding box is centered on the canvas.
                // Use these when elements should stay together (e.g. a label + its rect).
                // Use center-h / center-v when each element should be centered individually.
                if (align === "group-center-h" || align === "group-center-v" || align === "group-center") {
                    const minX = Math.min(...targets.map((e) => e.x || 0));
                    const maxX = Math.max(...targets.map((e) => (e.x || 0) + (e.width || 0)));
                    const minY = Math.min(...targets.map((e) => e.y || 0));
                    const maxY = Math.max(...targets.map((e) => (e.y || 0) + (e.height || 0)));
                    const dx = align !== "group-center-v" ? Math.round((W - (maxX - minX)) / 2) - minX : 0;
                    const dy = align !== "group-center-h" ? Math.round((H - (maxY - minY)) / 2) - minY : 0;
                    for (const el of targets) {
                        const patch = {
                            ...(dx !== 0 ? { x: (el.x || 0) + dx } : {}),
                            ...(dy !== 0 ? { y: (el.y || 0) + dy } : {}),
                        };
                        if (!Object.keys(patch).length) continue;
                        updateElement(el.id, patch);
                        flipEntries.push({ id: el.id, oldEl: el, newEl: { ...el, ...patch } });
                        updates.push({ id: el.id, ...patch });
                    }
                } else if (relativeTo === "group") {
                    // Align elements to their shared bounding box (rendered space).
                    const boxes = targets.map(renderBox);
                    const minX = Math.min(...boxes.map((b) => b.x));
                    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
                    const minY = Math.min(...boxes.map((b) => b.y));
                    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
                    const groupCX = (minX + maxX) / 2;
                    const groupCY = (minY + maxY) / 2;
                    targets.forEach((el, i) => {
                        const b = boxes[i];
                        let left, top;
                        if (align === "left") left = minX;
                        else if (align === "right") left = maxX - b.width;
                        else if (align === "center-h") left = Math.round(groupCX - b.width / 2);
                        else if (align === "top") top = minY;
                        else if (align === "bottom") top = maxY - b.height;
                        else if (align === "center-v") top = Math.round(groupCY - b.height / 2);
                        else if (align === "center") {
                            left = Math.round(groupCX - b.width / 2);
                            top = Math.round(groupCY - b.height / 2);
                        }
                        const patch = placePatch(el, left, top);
                        if (!Object.keys(patch).length) return;
                        updateElement(el.id, patch);
                        flipEntries.push({ id: el.id, oldEl: el, newEl: { ...el, ...patch } });
                        updates.push({ id: el.id, ...patch });
                    });
                } else {
                    for (const el of targets) {
                        const b = renderBox(el);
                        let left, top;
                        if (align === "left") left = margin;
                        else if (align === "right") left = W - b.width - margin;
                        else if (align === "center-h") left = Math.round((W - b.width) / 2);
                        else if (align === "top") top = margin;
                        else if (align === "bottom") top = H - b.height - margin;
                        else if (align === "center-v") top = Math.round((H - b.height) / 2);
                        else if (align === "center") {
                            left = Math.round((W - b.width) / 2);
                            top = Math.round((H - b.height) / 2);
                        }
                        const patch = placePatch(el, left, top);
                        if (!Object.keys(patch).length) continue;
                        updateElement(el.id, patch);
                        flipEntries.push({ id: el.id, oldEl: el, newEl: { ...el, ...patch } });
                        updates.push({ id: el.id, ...patch });
                    }
                }

                scheduleFlipBatch(flipEntries);
                return { aligned: updates.length, align, updates };
            },

            distribute_elements: async ({
                ids = [],
                axis = "vertical",
                spacing = null,
                margin = 0,
                bounds = null,
                keepBounds = false,
            } = {}) => {
                // bounds: { x, y, width, height } — distribute within this rect
                //         instead of the full canvas. Useful for distributing
                //         inside a frame or card area.
                // keepBounds: true — keep the first and last elements fixed;
                //         only redistribute the middle ones evenly between them.
                const W = bounds ? bounds.x + bounds.width  : canvasSize.width;
                const H = bounds ? bounds.y + bounds.height : canvasSize.height;
                const startX = bounds ? bounds.x + margin : margin;
                const startY = bounds ? bounds.y + margin : margin;
                const targets = elements
                    .filter((e) => (ids.length ? ids.includes(e.id) : true))
                    .sort((a, b) =>
                        axis === "vertical"
                            ? (a.y || 0) - (b.y || 0)
                            : effectiveTextBounds(a).x - effectiveTextBounds(b).x,
                    );
                if (targets.length < 2)
                    return { distributed: 0, message: "Need at least 2 elements" };
                const updates = [];
                const flipEntries = [];
                if (axis === "vertical") {
                    const totalH = targets.reduce((s, e) => s + (e.height || 0), 0);
                    // When spacing is explicit and keepBounds is off, anchor at the group's
                    // current topmost position so elements don't teleport to y=0.
                    const groupTop = Math.min(...targets.map((e) => e.y || 0));
                    const rangeStart = keepBounds ? (targets[0].y || 0) : (spacing !== null ? groupTop : startY);
                    const rangeEnd   = keepBounds ? (targets[targets.length - 1].y || 0) + (targets[targets.length - 1].height || 0) : H - margin;
                    const gap =
                        spacing !== null
                            ? spacing
                            : Math.max(0, (rangeEnd - rangeStart - totalH) / (targets.length - 1));
                    let y = rangeStart;
                    for (const [i, el] of targets.entries()) {
                        if (keepBounds && (i === 0 || i === targets.length - 1)) {
                            y = i === 0 ? rangeStart : rangeEnd - (el.height || 0);
                        }
                        const ny = Math.max(0, Math.min(Math.round(y), H - (el.height || 0)));
                        const patch = { y: ny };
                        updateElement(el.id, patch);
                        flipEntries.push({ id: el.id, oldEl: el, newEl: { ...el, ...patch } });
                        updates.push({ id: el.id, ...patch });
                        y += (el.height || 0) + gap;
                    }
                    scheduleFlipBatch(flipEntries);
                    return { distributed: targets.length, axis, gap: Math.round(gap), updates };
                } else {
                    const totalW = targets.reduce((s, e) => s + (e.width || 0), 0);
                    // When spacing is explicit and keepBounds is off, anchor at the group's
                    // current leftmost position so elements don't teleport to x=0.
                    const targetBounds = targets.map(effectiveTextBounds);
                    const groupLeft = Math.min(...targetBounds.map((b) => b.x));
                    const lastBounds = targetBounds[targetBounds.length - 1];
                    const rangeStart = keepBounds ? targetBounds[0].x : (spacing !== null ? groupLeft : startX);
                    const rangeEnd = keepBounds ? lastBounds.x + lastBounds.width : W - margin;
                    // Pre-compute the effective gap: when spacing is explicit, cap it so
                    // rangeStart + totalW + gap*(n-1) <= W - margin. This prevents the
                    // accumulation bug where per-element clamping left x advancing past bounds.
                    const maxFittingGap = targets.length > 1
                        ? Math.max(0, (W - margin - rangeStart - totalW) / (targets.length - 1))
                        : 0;
                    const gap =
                        spacing !== null
                            ? Math.min(spacing, maxFittingGap)
                            : Math.max(0, (rangeEnd - rangeStart - totalW) / (targets.length - 1));
                    let x = rangeStart;
                    for (const [i, el] of targets.entries()) {
                        if (keepBounds && (i === 0 || i === targets.length - 1)) {
                            x = i === 0 ? rangeStart : rangeEnd - (el.width || 0);
                        }
                        const desiredLeft = Math.round(x);
                        // Safety clamp: ensure no individual element overflows regardless of gap rounding.
                        const clampedLeft = Math.max(0, Math.min(desiredLeft, W - (el.width || 0)));
                        const nx = xFromRenderedLeft(el, clampedLeft);
                        const patch = { x: nx };
                        updateElement(el.id, patch);
                        flipEntries.push({ id: el.id, oldEl: el, newEl: { ...el, ...patch } });
                        updates.push({ id: el.id, ...patch });
                        x += (el.width || 0) + gap;
                    }
                    scheduleFlipBatch(flipEntries);
                    const overflowIds = targets
                        .map((el) => {
                            const after = effectiveTextBounds({ ...el, x: updates.find((u) => u.id === el.id)?.x ?? el.x });
                            return after.x < 0 || after.x + after.width > W ? el.id : null;
                        })
                        .filter(Boolean);
                    return {
                        distributed: targets.length,
                        axis,
                        gap: Math.round(gap),
                        updates,
                        ...(spacing !== null && gap < spacing
                            ? { note: `Spacing reduced from ${spacing} to ${Math.round(gap)} to fit all elements within canvas bounds.` }
                            : {}),
                        ...(overflowIds.length
                            ? { overflowIds, overflowWarning: `${overflowIds.length} element(s) overflow after preserving requested spacing.` }
                            : {}),
                    };
                }
            },

            estimate_text: async ({
                text = "",
                fontSize = 16,
                maxWidth = null,
            } = {}) => {
                const W = canvasSize.width;
                const charW = fontSize * 0.56;
                const lineH = Math.ceil(fontSize * 1.45);
                const singleLineW = Math.round(text.length * charW);
                const effectiveMax = maxWidth || W - 120;
                const lines = Math.max(1, Math.ceil(singleLineW / effectiveMax));
                const estH = lines * lineH;
                const overflows = singleLineW > effectiveMax;
                const suggestedFontSize = overflows && text.length > 0
                    ? Math.floor(effectiveMax / (text.length * 0.56))
                    : undefined;
                return {
                    singleLineWidth: singleLineW,
                    fitsOnOneLine: !overflows,
                    recommendedWidth: Math.min(singleLineW, effectiveMax),
                    estimatedLines: lines,
                    estimatedHeight: estH,
                    suggestedX: 60,
                    suggestedWidth: effectiveMax,
                    ...(overflows && suggestedFontSize !== undefined ? { suggestedFontSize } : {}),
                    note: overflows
                        ? `Text overflows at fontSize ${fontSize} (needs ${singleLineW}px, max ${effectiveMax}px). Try fontSize ${suggestedFontSize} to fit on one line, or set width=${effectiveMax} and allow wrapping.`
                        : `Text fits in ${singleLineW}px. Safe to use.`,
                };
            },

            // ── Layout helpers ────────────────────────────────────────────────────
            check_layout: async () => {
                const W = canvasSize.width;
                const H = canvasSize.height;
                const els = live();
                const overflow = els
                    .map((el) => {
                        // Use effectiveTextBounds so textAnchor="middle" headlines
                        // aren't false-positives (their x is the center, not the left edge).
                        const b = effectiveTextBounds(el);
                        const oL = b.x < 0 ? -b.x : 0;
                        const oT = b.y < 0 ? -b.y : 0;
                        const oR = b.x + b.width > W ? b.x + b.width - W : 0;
                        const oB = b.y + b.height > H ? b.y + b.height - H : 0;
                        if (!oL && !oT && !oR && !oB) return null;
                        return {
                            id: el.id,
                            type: el.type,
                            text:
                                el.type === "text"
                                    ? el.text?.slice(0, 40)
                                    : undefined,
                            x: el.x,
                            y: el.y,
                            renderX: b.x,
                            width: b.width,
                            height: b.height,
                            right: b.x + b.width,
                            bottom: b.y + b.height,
                            textAnchor: el.textAnchor,
                            overflow: {
                                left: oL,
                                top: oT,
                                right: oR,
                                bottom: oB,
                            },
                            fix: {
                                x: oL > 0 ? (el.textAnchor === 'middle' ? b.width / 2 : 0) : oR > 0 ? (el.textAnchor === 'middle' ? W - b.width / 2 : W - b.width) : el.x,
                                y: oT > 0 ? 0 : oB > 0 ? H - b.height : el.y,
                            },
                        };
                    })
                    .filter(Boolean);
                return {
                    canvasSize: { width: W, height: H },
                    totalElements: els.length,
                    overflowCount: overflow.length,
                    overflowingElements: overflow,
                    allGood: overflow.length === 0,
                    hint:
                        overflow.length > 0
                            ? "Call constrain_elements to auto-fix, or update_elements with the suggested fix.x / fix.y values."
                            : "No overflow detected.",
                };
            },

            constrain_elements: async ({ ids = null, padding = 0, ignoreIds = [] } = {}) => {
                const W = canvasSize.width;
                const H = canvasSize.height;
                const updates = [];
                const ignored = new Set(ignoreIds);
                // Fuzzy thresholds: skip rects that cover essentially the whole canvas
                // even if they're offset by 1px or slightly oversized / undersized.
                const isFullCanvasBackground = (el) =>
                    el?.type === "rect" &&
                    (el.x || 0) <= 1 &&
                    (el.y || 0) <= 1 &&
                    (el.width || 0) >= W - 1 &&
                    (el.height || 0) >= H - 20;
                const shouldIgnore = (el) => ignored.has(el.id) || isFullCanvasBackground(el);

                // Compute rendered bounding box for an element, accounting for
                // textAnchor='middle'/'end' so overflow detection is accurate (Bug C fix).
                const renderedBounds = (e) => effectiveTextBounds(e);

                // Compute the minimal dx to bring a rendered bounding box within
                // padded canvas bounds on a single axis. Returns 0 if already inside.
                // Handles both-sides-overflow gracefully: if the span is wider than the
                // padded area, falls back to raw canvas bounds so we don't make it worse.
                const axisDelta = (rMin, rMax, limit, pad) => {
                    const overLeft  = rMin < pad;
                    const overRight = rMax > limit - pad;
                    if (overLeft && !overRight)  return pad - rMin;          // push right
                    if (overRight && !overLeft)  return (limit - pad) - rMax; // push left (negative)
                    if (overLeft && overRight) {
                        // Span wider than padded area — use raw bounds only
                        if (rMin < 0)      return -rMin;
                        if (rMax > limit)  return limit - rMax;
                    }
                    return 0;
                };

                if (ids && ids.length) {
                    // Explicit-IDs mode: check each element independently.
                    // Each element is only moved if its own rendered bounds overflow
                    // or fall within 'padding' px of a canvas edge. Safe elements
                    // that are already within bounds are never touched.
                    const targets = elements.filter((e) => ids.includes(e.id) && !shouldIgnore(e));
                    const ignoredIds = ids.filter((id) => {
                        const el = elements.find((entry) => entry.id === id);
                        return el && shouldIgnore(el);
                    });
                    for (const el of targets) {
                        const b = renderedBounds(el);
                        const renderOffsetX = (el.x || 0) - b.x;
                        const renderOffsetY = (el.y || 0) - b.y;
                        const dx = axisDelta(b.x, b.x + b.width, W, padding);
                        const dy = axisDelta(b.y, b.y + b.height, H, padding);
                        if (dx !== 0 || dy !== 0) {
                            const nx = b.x + dx + renderOffsetX;
                            const ny = b.y + dy + renderOffsetY;
                            updateElement(el.id, { x: nx, y: ny });
                            updates.push({ id: el.id, type: el.type, from: { x: el.x, y: el.y }, to: { x: nx, y: ny } });
                        }
                    }
                    if (!targets.length) return {
                        constrained: 0,
                        updates,
                        ignoredIds,
                        canvasSize: { width: W, height: H },
                    };
                } else {
                    const targets = elements.filter((e) => !shouldIgnore(e));
                    for (const el of targets) {
                        const b = renderedBounds(el);
                        const renderOffsetX = (el.x || 0) - b.x;
                        const renderOffsetY = (el.y || 0) - b.y;
                        const dx = axisDelta(b.x, b.x + b.width, W, padding);
                        const dy = axisDelta(b.y, b.y + b.height, H, padding);
                        if (dx !== 0 || dy !== 0) {
                            const nx = b.x + dx + renderOffsetX;
                            const ny = b.y + dy + renderOffsetY;
                            updateElement(el.id, { x: nx, y: ny });
                            updates.push({ id: el.id, type: el.type, from: { x: el.x, y: el.y }, to: { x: nx, y: ny } });
                        }
                    }
                }

                return {
                    constrained: updates.length,
                    updates,
                    ignoredIds: elements.filter((el) => shouldIgnore(el)).map((el) => el.id),
                    canvasSize: { width: W, height: H },
                    message: updates.length === 0 ? "All movable elements are within canvas bounds - nothing moved." : undefined,
                };
            },

            // ── Layout helpers ────────────────────────────────────────────────────
            create_labeled_rect: async ({
                x = 0,
                y = 0,
                width = 200,
                height = 60,
                label = "",
                fontSize = 16,
                fontWeight = "normal",
                fontFamily = "sans-serif",
                fontColor = "#000000",
                fill = "#ffffff",
                stroke = "none",
                strokeWidth = 0,
                rx = 0,
                opacity = 1,
            } = {}) => {
                syncCounter(elements);
                const rectId = freshId("rect");
                const textId = freshId("text");
                const padding = 16;
                const maxTextW = Math.max(width - padding * 2, 40);
                const textH = measureWrappedTextHeight(label, { width: maxTextW, fontSize, textWrap: true, lineHeight: 1.4 });
                // For textAnchor='middle', el.x is the center anchor x
                const textAnchorX = x + width / 2;
                // Vertical centering
                const textY = y + height / 2 - textH / 2;
                addElementsAnimated([
                    {
                        type: "rect",
                        id: rectId,
                        x,
                        y,
                        width,
                        height,
                        fill,
                        stroke,
                        strokeWidth: strokeWidth || 0,
                        rx: rx || 0,
                        ry: rx || 0,
                        opacity,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "text",
                        id: textId,
                        x: textAnchorX,
                        y: textY,
                        width: maxTextW,
                        height: textH,
                        text: label,
                        fontSize,
                        fontWeight,
                        fontFamily,
                        textAnchor: "middle",
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ]);
                const groupId = makeGroup([rectId, textId], label || "labeled_rect");
                return { rectId, textId, groupId };
            },

            create_button: async ({
                x = 0,
                y = 0,
                label = "Button",
                width: wOpt,
                height: hOpt,
                fontSize = 14,
                fontWeight = "600",
                fontFamily = "sans-serif",
                fontColor = "#ffffff",
                fill = "#0d65d9",
                stroke = "none",
                strokeWidth = 0,
                rx = 8,
                paddingX = 24,
                paddingY = 10,
            } = {}) => {
                syncCounter(elements);
                const rectId = freshId("rect");
                const textId = freshId("text");
                const autoW = Math.round(Math.max(
                    label.length * fontSize * 0.6 + paddingX * 2,
                    80,
                ));
                const autoH = Math.round(fontSize + paddingY * 2);
                const width = wOpt ?? autoW;
                const height = hOpt ?? autoH;
                const textAnchorX = x + width / 2;
                const textY = y + height / 2 - fontSize / 2;
                addElementsAnimated([
                    {
                        type: "rect",
                        id: rectId,
                        x,
                        y,
                        width,
                        height,
                        fill,
                        stroke,
                        strokeWidth: strokeWidth || 0,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "text",
                        id: textId,
                        x: textAnchorX,
                        y: textY,
                        width: Math.max(label.length * fontSize * 0.6, 80),
                        height: fontSize * 1.4,
                        text: label,
                        fontSize,
                        fontWeight,
                        fontFamily,
                        textAnchor: "middle",
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ]);
                const groupId = makeGroup([rectId, textId], label || "button");
                return { rectId, textId, groupId, width, height };
            },

            arrange_row: async ({
                ids = [],
                childGroups = null,
                startX, x,
                startY, y,
                gap = 10,
                alignment = "top",
            } = {}) => {
                const originX = nn(startX ?? x, 0);
                const originY = nn(startY ?? y, 0);
                const toArrangeGroups = (inputIds) =>
                    inputIds.map((id) => (groups[id] ? groups[id].elementIds : [id]));
                const arrangeGroups = childGroups ?? toArrangeGroups(ids);
                const anchors = arrangeGroups
                    .map((g) => live().find((e) => e.id === g[0]))
                    .filter(Boolean);
                if (!anchors.length) return { arranged: 0 };
                const maxH = Math.max(...anchors.map((e) => renderBox(e).height));
                let curX = originX;
                const updates = [];
                for (const [i, el] of anchors.entries()) {
                    const b = renderBox(el);
                    const elY =
                        alignment === "center" || alignment === "middle"
                            ? originY + (maxH - b.height) / 2
                            : alignment === "bottom"
                              ? originY + maxH - b.height
                              : originY;
                    const patch = placePatch(el, curX, elY);
                    const dx = (patch.x ?? el.x ?? 0) - (el.x ?? 0);
                    const dy = (patch.y ?? el.y ?? 0) - (el.y ?? 0);
                    updateElement(el.id, patch);
                    updates.push({ id: el.id, ...patch });
                    for (const childId of (arrangeGroups[i] ?? []).slice(1)) {
                        const child = live().find((e) => e.id === childId);
                        if (child) {
                            const cp = { x: nn(child.x) + dx, y: nn(child.y) + dy };
                            updateElement(childId, cp);
                            updates.push({ id: childId, ...cp });
                        }
                    }
                    curX += b.width + gap;
                }
                return {
                    arranged: updates.length,
                    totalWidth: curX - gap - originX,
                    rowHeight: maxH,
                    updates,
                };
            },

            arrange_column: async ({
                ids = [],
                childGroups = null,
                x, startX,
                startY, y,
                gap = 10,
                alignment = "left",
            } = {}) => {
                const originX = nn(x ?? startX, 0);
                const originY = nn(startY ?? y, 0);
                const toArrangeGroups = (inputIds) =>
                    inputIds.map((id) => (groups[id] ? groups[id].elementIds : [id]));
                const arrangeGroups = childGroups ?? toArrangeGroups(ids);
                const anchors = arrangeGroups
                    .map((g) => live().find((e) => e.id === g[0]))
                    .filter(Boolean);
                if (!anchors.length) return { arranged: 0 };
                const maxW = Math.max(...anchors.map((e) => renderBox(e).width));
                let curY = originY;
                const updates = [];
                for (const [i, el] of anchors.entries()) {
                    const b = renderBox(el);
                    const elLeft =
                        alignment === "center" || alignment === "middle"
                            ? originX + (maxW - b.width) / 2
                            : alignment === "right"
                              ? originX + maxW - b.width
                              : originX;
                    const patch = placePatch(el, elLeft, curY);
                    const dx = (patch.x ?? el.x ?? 0) - (el.x ?? 0);
                    const dy = (patch.y ?? el.y ?? 0) - (el.y ?? 0);
                    updateElement(el.id, patch);
                    updates.push({ id: el.id, ...patch });
                    for (const childId of (arrangeGroups[i] ?? []).slice(1)) {
                        const child = live().find((e) => e.id === childId);
                        if (child) {
                            const cp = { x: nn(child.x) + dx, y: nn(child.y) + dy };
                            updateElement(childId, cp);
                            updates.push({ id: childId, ...cp });
                        }
                    }
                    curY += b.height + gap;
                }
                return {
                    arranged: updates.length,
                    columnWidth: maxW,
                    totalHeight: curY - gap - originY,
                    updates,
                };
            },

            arrange_grid: async ({
                ids = [],
                childGroups = null,
                x, startX,
                y, startY,
                columns = 3,
                colGap = 12,
                rowGap = 12,
                cellWidth,
                cellHeight,
            } = {}) => {
                const originX = nn(x ?? startX, 0);
                const originY = nn(y ?? startY, 0);
                const toArrangeGroups = (inputIds) =>
                    inputIds.map((id) => (groups[id] ? groups[id].elementIds : [id]));
                const arrangeGroups = childGroups ?? toArrangeGroups(ids);
                const anchors = arrangeGroups
                    .map((g) => live().find((e) => e.id === g[0]))
                    .filter(Boolean);
                if (!anchors.length) return { arranged: 0 };
                const cw =
                    cellWidth ?? Math.max(...anchors.map((e) => renderBox(e).width));
                const ch =
                    cellHeight ??
                    Math.max(...anchors.map((e) => renderBox(e).height));
                const updates = [];
                anchors.forEach((el, i) => {
                    const col = i % columns;
                    const row = Math.floor(i / columns);
                    const cellLeft = originX + col * (cw + colGap);
                    const cellTop = originY + row * (ch + rowGap);
                    const patch = placePatch(el, cellLeft, cellTop);
                    const dx = (patch.x ?? el.x ?? 0) - (el.x ?? 0);
                    const dy = (patch.y ?? el.y ?? 0) - (el.y ?? 0);
                    updateElement(el.id, patch);
                    updates.push({ id: el.id, ...patch });
                    for (const childId of (arrangeGroups[i] ?? []).slice(1)) {
                        const child = live().find((e) => e.id === childId);
                        if (child) {
                            const cp = { x: nn(child.x) + dx, y: nn(child.y) + dy };
                            updateElement(childId, cp);
                            updates.push({ id: childId, ...cp });
                        }
                    }
                });
                const rows = Math.ceil(anchors.length / columns);
                return {
                    arranged: updates.length,
                    columns,
                    rows,
                    cellWidth: cw,
                    cellHeight: ch,
                    updates,
                };
            },

            align_grid: async ({
                ids = [],
                x = null,
                y = null,
                columns = 3,
                hSpacing = 12,
                vSpacing = 12,
                padding = 0,
                cellWidth,
                cellHeight,
                align = "center",
                valign = "middle",
            } = {}) => {
                const resolvedIds = resolveToElementIds(ids);
                const targets = resolvedIds
                    .map((id) => live().find((e) => e.id === id))
                    .filter(Boolean);
                if (!targets.length) return { aligned: 0, updates: [] };
                const boxes = targets.map(renderBox);
                const minX = Math.min(...boxes.map((b) => b.x));
                const minY = Math.min(...boxes.map((b) => b.y));
                const startX = x != null ? nn(x) : minX;
                const startY = y != null ? nn(y) : minY;
                const cw = cellWidth ?? Math.max(...boxes.map((b) => b.width));
                const ch = cellHeight ?? Math.max(...boxes.map((b) => b.height));
                const updates = [];
                targets.forEach((el, i) => {
                    const b = boxes[i];
                    const col = i % columns;
                    const row = Math.floor(i / columns);
                    const cellX = startX + col * (cw + hSpacing);
                    const cellY = startY + row * (ch + vSpacing);
                    const left = align === "left"
                        ? cellX + padding
                        : align === "right"
                          ? cellX + cw - b.width - padding
                          : cellX + (cw - b.width) / 2;
                    const top = valign === "top"
                        ? cellY + padding
                        : valign === "bottom"
                          ? cellY + ch - b.height - padding
                          : cellY + (ch - b.height) / 2;
                    const patch = placePatch(el, Math.round(left), Math.round(top));
                    updateElement(el.id, patch);
                    updates.push({ id: el.id, ...patch });
                });
                return {
                    aligned: updates.length,
                    columns,
                    rows: Math.ceil(targets.length / columns),
                    cellWidth: cw,
                    cellHeight: ch,
                    updates,
                };
            },

            snap_to_grid: async ({ ids = null, gridSize = 8, snapSize = false } = {}) => {
                const targets = ids
                    ? elements.filter((e) => ids.includes(e.id))
                    : elements;
                const updates = [];
                for (const el of targets) {
                    const nx = Math.round((el.x || 0) / gridSize) * gridSize;
                    const ny = Math.round((el.y || 0) / gridSize) * gridSize;
                    const shouldSnapSize = snapSize === true;
                    const nw = shouldSnapSize && el.width != null ? Math.round((el.width || 0) / gridSize) * gridSize : undefined;
                    const nh = shouldSnapSize && el.height != null ? Math.round((el.height || 0) / gridSize) * gridSize : undefined;
                    const changed = nx !== (el.x || 0) || ny !== (el.y || 0) ||
                        (nw !== undefined && nw !== el.width) ||
                        (nh !== undefined && nh !== el.height);
                    if (changed) {
                        const patch = { x: nx, y: ny };
                        if (nw !== undefined) patch.width = nw;
                        if (nh !== undefined) patch.height = nh;
                        updateElement(el.id, patch);
                        updates.push({ id: el.id, from: { x: el.x, y: el.y, width: el.width, height: el.height }, to: patch });
                    }
                }
                return { snapped: updates.length, gridSize, updates };
            },

            align_to_element: async ({
                ids = [],
                refId, targetId, referenceId, reference, target, anchorId, to,
                align = "center",
            } = {}) => {
                const rId = refId ?? targetId ?? referenceId ?? reference ?? target ?? anchorId ?? to;
                const ref = live().find((e) => e.id === rId);
                if (!ref)
                    throw new Error(
                        `Reference element "${rId}" not found — pass it as refId (or targetId).`,
                    );
                const rb = renderBox(ref);
                const targets = ids
                    .map((id) => live().find((e) => e.id === id))
                    .filter((e) => e && e.id !== rId);
                const updates = [];
                for (const el of targets) {
                    const b = renderBox(el);
                    let left, top;
                    if (align === "left") left = rb.x;
                    else if (align === "right") left = rb.x + rb.width - b.width;
                    else if (align === "center-h") left = rb.x + rb.width / 2 - b.width / 2;
                    else if (align === "top") top = rb.y;
                    else if (align === "bottom") top = rb.y + rb.height - b.height;
                    else if (align === "center-v") top = rb.y + rb.height / 2 - b.height / 2;
                    else if (align === "center") {
                        left = rb.x + rb.width / 2 - b.width / 2;
                        top = rb.y + rb.height / 2 - b.height / 2;
                    }
                    const patch = placePatch(el, left, top);
                    if (!Object.keys(patch).length) continue;
                    updateElement(el.id, patch);
                    updates.push({ id: el.id, ...patch });
                }
                return { aligned: updates.length, align, refId: rId, updates };
            },

            fit_frame_around: async ({
                ids = [],
                frameId,
                padding = 16,
                fill = "#ffffff",
                stroke = "none",
                strokeWidth = 0,
                rx = 8,
                opacity = 1,
            } = {}) => {
                const targets = ids
                    .map((id) => live().find((e) => e.id === id))
                    .filter(Boolean);
                if (!targets.length)
                    throw new Error("No valid element IDs provided");
                const boxes = targets.map(renderBox);
                const minX = Math.min(...boxes.map((b) => b.x));
                const minY = Math.min(...boxes.map((b) => b.y));
                const maxX = Math.max(...boxes.map((b) => b.x + b.width));
                const maxY = Math.max(...boxes.map((b) => b.y + b.height));
                const geom = {
                    x: minX - padding,
                    y: minY - padding,
                    width: maxX - minX + padding * 2,
                    height: maxY - minY + padding * 2,
                };
                const existing = frameId && live().find((e) => e.id === frameId);
                if (existing) {
                    updateElement(frameId, geom);
                    return { frameId, reused: true, ...geom };
                }
                syncCounter(elements);
                const newId = freshId("rect");
                addElement({
                    type: "rect",
                    id: newId,
                    ...geom,
                    fill,
                    stroke,
                    strokeWidth: strokeWidth || 0,
                    rx,
                    ry: rx,
                    opacity,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });
                for (let i = 0; i < targets.length; i++) sendBackward(newId);
                return { frameId: newId, reused: false, ...geom };
            },

            center_in_canvas: async ({ ids = [], axis = "both" } = {}) => {
                const W = canvasSize.width,
                    H = canvasSize.height;
                const targets = ids
                    .map((id) => elements.find((e) => e.id === id))
                    .filter(Boolean);
                if (!targets.length) return { centered: 0 };
                const minX = Math.min(...targets.map((e) => e.x));
                const minY = Math.min(...targets.map((e) => e.y));
                const maxX = Math.max(
                    ...targets.map((e) => e.x + (e.width || 0)),
                );
                const maxY = Math.max(
                    ...targets.map((e) => e.y + (e.height || 0)),
                );
                const groupW = maxX - minX,
                    groupH = maxY - minY;
                const offsetX =
                    axis !== "vertical"
                        ? Math.round((W - groupW) / 2) - minX
                        : 0;
                const offsetY =
                    axis !== "horizontal"
                        ? Math.round((H - groupH) / 2) - minY
                        : 0;
                const updates = [];
                for (const el of targets) {
                    const nx = el.x + offsetX,
                        ny = el.y + offsetY;
                    updateElement(el.id, { x: nx, y: ny });
                    updates.push({ id: el.id, x: nx, y: ny });
                }
                return { centered: updates.length, offsetX, offsetY, updates };
            },

            place_at: async ({ id, anchor = "center", margin = 0 } = {}) => {
                const W = canvasSize.width,
                    H = canvasSize.height;
                const el = elements.find((e) => e.id === id);
                if (!el) throw new Error(`Element "${id}" not found`);
                const w = el.width || 0,
                    h = el.height || 0;
                const col = anchor.includes("right")
                    ? W - w - margin
                    : anchor.includes("center") &&
                        !anchor.includes("left") &&
                        !anchor.includes("right")
                      ? Math.round((W - w) / 2)
                      : margin;
                const row = anchor.includes("bottom")
                    ? H - h - margin
                    : anchor.includes("center") &&
                        !anchor.includes("top") &&
                        !anchor.includes("bottom")
                      ? Math.round((H - h) / 2)
                      : margin;
                updateElement(id, { x: col, y: row });
                return { id, x: col, y: row, anchor };
            },

            stack_center: async ({ ids = [], cx: cxOpt, cy: cyOpt, preserveRelative = false } = {}) => {
                const resolvedIds = resolveToElementIds(ids);
                const targets = resolvedIds
                    .map((id) => elements.find((e) => e.id === id))
                    .filter(Boolean);
                if (!targets.length) return { stacked: 0 };
                const avgCx =
                    cxOpt ??
                    targets.reduce((s, e) => s + e.x + (e.width || 0) / 2, 0) /
                        targets.length;
                const avgCy =
                    cyOpt ??
                    targets.reduce((s, e) => s + e.y + (e.height || 0) / 2, 0) /
                        targets.length;
                const updates = [];
                if (preserveRelative) {
                    // Shift all elements by the same delta (group center → target center)
                    // so their relative positions are preserved.
                    const groupMinX = Math.min(...targets.map(e => e.x || 0));
                    const groupMinY = Math.min(...targets.map(e => e.y || 0));
                    const groupMaxX = Math.max(...targets.map(e => (e.x || 0) + (e.width || 0)));
                    const groupMaxY = Math.max(...targets.map(e => (e.y || 0) + (e.height || 0)));
                    const groupCX = (groupMinX + groupMaxX) / 2;
                    const groupCY = (groupMinY + groupMaxY) / 2;
                    const dx = Math.round(avgCx - groupCX);
                    const dy = Math.round(avgCy - groupCY);
                    for (const el of targets) {
                        const nx = (el.x || 0) + dx;
                        const ny = (el.y || 0) + dy;
                        updateElement(el.id, { x: nx, y: ny });
                        updates.push({ id: el.id, x: nx, y: ny });
                    }
                } else {
                    for (const el of targets) {
                        const nx = Math.round(avgCx - (el.width || 0) / 2);
                        const ny = Math.round(avgCy - (el.height || 0) / 2);
                        updateElement(el.id, { x: nx, y: ny });
                        updates.push({ id: el.id, x: nx, y: ny });
                    }
                }
                return {
                    stacked: updates.length,
                    cx: avgCx,
                    cy: avgCy,
                    updates,
                };
            },

            measure_elements: async ({ ids = [] } = {}) => {
                const targets = ids
                    .map((id) => live().find((e) => e.id === id))
                    .filter(Boolean);
                if (!targets.length) return { elements: [], group: null };
                const measured = targets.map((el) => {
                    const b = renderBox(el); // rendered box (handles textAnchor)
                    return {
                        id: el.id,
                        type: el.type,
                        x: b.x,
                        y: b.y,
                        width: b.width,
                        height: b.height,
                        right: b.x + b.width,
                        bottom: b.y + b.height,
                        centerX: b.x + b.width / 2,
                        centerY: b.y + b.height / 2,
                        ...(el.type === "text" && el.textAnchor && el.textAnchor !== "start"
                            ? { anchorX: nn(el.x), textAnchor: el.textAnchor }
                            : {}),
                    };
                });
                const minX = Math.min(...measured.map((e) => e.x));
                const minY = Math.min(...measured.map((e) => e.y));
                const maxX = Math.max(...measured.map((e) => e.right));
                const maxY = Math.max(...measured.map((e) => e.bottom));
                return {
                    elements: measured,
                    group: {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY,
                        right: maxX,
                        bottom: maxY,
                        centerX: (minX + maxX) / 2,
                        centerY: (minY + maxY) / 2,
                    },
                };
            },

            // ── Component helpers ─────────────────────────────────────────────────
            create_badge: async ({
                x = 0,
                y = 0,
                label = "",
                fontSize = 11,
                fontWeight = "600",
                fontFamily = "sans-serif",
                fontColor = "#ffffff",
                fill = "#0d65d9",
                stroke = "none",
                strokeWidth = 0,
                paddingX = 10,
                paddingY = 4,
                rx: rxOpt,
                width: wOpt,
            } = {}) => {
                syncCounter(elements);
                const rectId = freshId("rect");
                const textId = freshId("text");
                const autoW = label.length * fontSize * 0.6 + paddingX * 2;
                const width = wOpt ?? Math.max(autoW, 30);
                const height = fontSize + paddingY * 2;
                const rx = rxOpt ?? height / 2;
                const textY = y + height / 2 - fontSize / 2;
                addElementsAnimated([
                    {
                        type: "rect",
                        id: rectId,
                        x,
                        y,
                        width,
                        height,
                        fill,
                        stroke,
                        strokeWidth: strokeWidth || 0,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "text",
                        id: textId,
                        x: x + width / 2,
                        y: textY,
                        width: Math.max(label.length * fontSize * 0.6, 30),
                        height: fontSize * 1.4,
                        text: label,
                        fontSize,
                        fontWeight,
                        fontFamily,
                        textAnchor: "middle",
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ]);
                const groupId = makeGroup([rectId, textId], label || "badge");
                return { rectId, textId, groupId, width, height };
            },

            create_card: async ({
                x = 0,
                y = 0,
                width = 280,
                title = "",
                body,
                titleFontSize = 16,
                titleFontWeight = "700",
                bodyFontSize = 13,
                titleColor = "#111111",
                bodyColor = "#555555",
                fontFamily = "sans-serif",
                fill = "#ffffff",
                stroke = "#e2e8f0",
                strokeWidth = 1,
                rx = 10,
                padding = 20,
                gap = 8,
                height: hOpt,
            } = {}) => {
                syncCounter(elements);
                const resolvedFontFamily = resolveFontFamily(fontFamily);
                const cardId = freshId("rect");
                const titleId = freshId("text");
                const ids = [cardId, titleId];
                const titleH = measureWrappedTextHeight(title, { width: width - padding * 2, fontSize: titleFontSize, textWrap: true, lineHeight: 1.4 });
                const bodyH = body ? measureWrappedTextHeight(body, { width: width - padding * 2, fontSize: bodyFontSize, textWrap: true, lineHeight: 1.4 }) : 0;
                const autoH =
                    padding + titleH + (body ? gap + bodyH : 0) + padding;
                const height = hOpt ?? autoH;
                const titleY = y + padding;
                const elems = [
                    {
                        type: "rect",
                        id: cardId,
                        x,
                        y,
                        width,
                        height,
                        fill,
                        stroke,
                        strokeWidth,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "text",
                        id: titleId,
                        x: x + padding,
                        y: titleY,
                        width: width - padding * 2,
                        height: titleH,
                        text: title,
                        fontSize: titleFontSize,
                        fontWeight: titleFontWeight,
                        fontFamily: resolvedFontFamily,
                        textAnchor: "start",
                        fill: titleColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ];
                let bodyId;
                if (body) {
                    bodyId = freshId("text");
                    ids.push(bodyId);
                    elems.push({
                        type: "text",
                        id: bodyId,
                        x: x + padding,
                        y: titleY + titleH + gap,
                        width: width - padding * 2,
                        height: bodyH,
                        text: body,
                        fontSize: bodyFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedFontFamily,
                        textAnchor: "start",
                        fill: bodyColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return {
                    cardId,
                    titleId,
                    ...(bodyId ? { bodyId } : {}),
                    width,
                    height,
                };
            },

            create_stat_block: async ({
                x = 0,
                y = 0,
                value = "0",
                label = "",
                width = 160,
                valueFontSize = 40,
                labelFontSize = 13,
                valueFontWeight = "700",
                valueColor = "#111111",
                labelColor = "#888888",
                gap = 6,
                align = "center",
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedStatFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const valueId = freshId("text");
                const labelId = freshId("text");
                const anchor =
                    align === "center"
                        ? "middle"
                        : align === "right"
                          ? "end"
                          : "start";
                const anchorX =
                    align === "center"
                        ? x + width / 2
                        : align === "right"
                          ? x + width
                          : x;
                const valueH = valueFontSize * 1.2;
                addElementsAnimated([
                    {
                        type: "text",
                        id: valueId,
                        x: anchorX,
                        y,
                        width,
                        height: valueH,
                        text: value,
                        fontSize: valueFontSize,
                        fontWeight: valueFontWeight,
                        fontFamily: resolvedStatFont,
                        textAnchor: anchor,
                        fill: valueColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "text",
                        id: labelId,
                        x: anchorX,
                        y: y + valueH + gap,
                        width,
                        height: labelFontSize * 1.4,
                        text: label,
                        fontSize: labelFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedStatFont,
                        textAnchor: anchor,
                        fill: labelColor,

                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ]);
                return {
                    valueId,
                    labelId,
                    totalHeight: valueH + gap + labelFontSize * 1.4,
                };
            },

            create_progress_bar: async ({
                x = 0,
                y = 0,
                width = 200,
                height: barH = 10,
                percent = 50,
                trackFill = "#e2e8f0",
                fillColor = "#0d65d9",
                rx: rxOpt,
                showLabel = false,
                labelFontSize = 11,
                labelColor = "#555555",
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedBarFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const trackId = freshId("rect");
                const fillId = freshId("rect");
                const rx = rxOpt ?? barH / 2;
                const fillW = Math.max(0, Math.round((percent / 100) * width));
                const elems = [
                    {
                        type: "rect",
                        id: trackId,
                        x,
                        y,
                        width,
                        height: barH,
                        fill: trackFill,
                        stroke: "none",
                        strokeWidth: 0,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "rect",
                        id: fillId,
                        x,
                        y,
                        width: Math.max(fillW, rx * 2),
                        height: barH,
                        fill: fillColor,
                        stroke: "none",
                        strokeWidth: 0,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ];
                let labelId;
                if (showLabel) {
                    labelId = freshId("text");
                    const lbl = `${Math.round(percent)}%`;
                    elems.push({
                        type: "text",
                        id: labelId,
                        x: x + width + 8,
                        y: y - labelFontSize / 2 + barH / 2,
                        width: 36,
                        height: labelFontSize * 1.4,
                        text: lbl,
                        fontSize: labelFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedBarFont,
                        textAnchor: "start",
                        fill: labelColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return {
                    trackId,
                    fillId,
                    ...(labelId ? { labelId } : {}),
                    width,
                    height: barH,
                    percent,
                };
            },

            create_avatar: async ({
                x = 0,
                y = 0,
                size = 48,
                imageSrc,
                initials,
                fill = "#94a3b8",
                name,
                nameFontSize = 12,
                nameColor = "#333333",
                gap = 6,
                fontFamily = "sans-serif",
            } = {}) => {
                syncCounter(elements);
                const circleId = freshId("circle");
                const ids = [circleId];
                const elems = [
                    imageSrc
                        ? {
                              type: "image",
                              id: circleId,
                              x,
                              y,
                              width: size,
                              height: size,
                              href: imageSrc,
                              fill,
                              stroke: "none",
                              strokeWidth: 0,
                              rx: size / 2,
                              ry: size / 2,
                              opacity: 1,
                              visible: true,
                              locked: false,
                              description: "",
                              strokeDash: "solid",
                              strokeLinecap: "butt",
                          }
                        : {
                              type: "circle",
                              id: circleId,
                              x,
                              y,
                              width: size,
                              height: size,
                              fill,
                              stroke: "none",
                              strokeWidth: 0,
                              opacity: 1,
                              visible: true,
                              locked: false,
                              description: "",
                              strokeDash: "solid",
                              strokeLinecap: "butt",
                          },
                ];
                if (!imageSrc && initials) {
                    const initId = freshId("text");
                    ids.push(initId);
                    const fs = Math.round(size * 0.38);
                    elems.push({
                        type: "text",
                        id: initId,
                        x: x + size / 2,
                        y: y + size / 2 - fs / 2,
                        width: size,
                        height: fs * 1.4,
                        text: initials,
                        fontSize: fs,
                        fontWeight: "600",
                        fontFamily,
                        textAnchor: "middle",
                        fill: "#ffffff",
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                let labelId;
                if (name) {
                    labelId = freshId("text");
                    ids.push(labelId);
                    const labelW = Math.max(size, name.length * nameFontSize * 0.62);
                    elems.push({
                        type: "text",
                        id: labelId,
                        x: x + size / 2,
                        y: y + size + gap,
                        width: labelW,
                        height: nameFontSize * 1.4,
                        text: name,
                        fontSize: nameFontSize,
                        fontWeight: "normal",
                        fontFamily,
                        textAnchor: "middle",
                        fill: nameColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return { circleId, ...(labelId ? { labelId } : {}), size };
            },

            create_section_header: async ({
                x = 0,
                y = 0,
                title = "",
                subtitle,
                width = 500,
                titleFontSize = 28,
                titleFontWeight = "700",
                subtitleFontSize = 14,
                titleColor = "#111111",
                subtitleColor = "#666666",
                fontFamily = "sans-serif",
                gap = 8,
                align = "left",
            } = {}) => {
                syncCounter(elements);
                const resolvedFontFamily = resolveFontFamily(fontFamily);
                const titleId = freshId("text");
                const anchor =
                    align === "center"
                        ? "middle"
                        : align === "right"
                          ? "end"
                          : "start";
                const anchorX =
                    align === "center"
                        ? x + width / 2
                        : align === "right"
                          ? x + width
                          : x;
                const titleH = measureWrappedTextHeight(title, { width, fontSize: titleFontSize, textWrap: true, lineHeight: 1.3 });
                const elems = [
                    {
                        type: "text",
                        id: titleId,
                        x: anchorX,
                        y,
                        width,
                        height: titleH,
                        text: title,
                        fontSize: titleFontSize,
                        fontWeight: titleFontWeight,
                        fontFamily: resolvedFontFamily,
                        textAnchor: anchor,
                        fill: titleColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ];
                let subtitleId;
                if (subtitle) {
                    subtitleId = freshId("text");
                    elems.push({
                        type: "text",
                        id: subtitleId,
                        x: anchorX,
                        y: y + titleH + gap,
                        width,
                        height: measureWrappedTextHeight(subtitle, { width, fontSize: subtitleFontSize, textWrap: true, lineHeight: 1.4 }),
                        text: subtitle,
                        fontSize: subtitleFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedFontFamily,
                        textAnchor: anchor,
                        fill: subtitleColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return {
                    titleId,
                    ...(subtitleId ? { subtitleId } : {}),
                    totalHeight:
                        titleH + (subtitle ? gap + subtitleFontSize * 1.4 : 0),
                };
            },

            create_image_card: async ({
                x = 0,
                y = 0,
                width = 240,
                imageHeight: imgH,
                title = "",
                subtitle,
                imageSrc,
                imageFill = "#e2e8f0",
                titleFontSize = 15,
                subtitleFontSize = 12,
                titleColor = "#111111",
                subtitleColor = "#888888",
                cardFill,
                stroke = "#e2e8f0",
                rx = 10,
                padding = 14,
                gap = 6,
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedImageCardFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const imageHeight = imgH ?? Math.round(width * 0.6);
                const contentW = width - padding * 2;
                const titleH = measureWrappedTextHeight(title, { width: contentW, fontSize: titleFontSize, textWrap: true, lineHeight: 1.4 });
                const subH = subtitle ? measureWrappedTextHeight(subtitle, { width: contentW, fontSize: subtitleFontSize, textWrap: true, lineHeight: 1.4 }) : 0;
                const textAreaH =
                    padding + titleH + (subtitle ? gap + subH : 0) + padding;
                const totalH = imageHeight + textAreaH;
                const elems = [];
                let bgId;
                if (cardFill) {
                    bgId = freshId("rect");
                    elems.push({
                        type: "rect",
                        id: bgId,
                        x,
                        y,
                        width,
                        height: totalH,
                        fill: cardFill,
                        stroke,
                        strokeWidth: 1,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                const imageId = freshId("image");
                elems.push({
                    type: "image",
                    id: imageId,
                    x,
                    y,
                    width,
                    height: imageHeight,
                    href: imageSrc || "",
                    fill: imageFill,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });
                const titleId = freshId("text");
                elems.push({
                    type: "text",
                    id: titleId,
                    x: x + padding,
                    y: y + imageHeight + padding,
                    width: width - padding * 2,
                    height: titleH,
                    text: title,
                    fontSize: titleFontSize,
                    fontWeight: "600",
                    fontFamily: resolvedImageCardFont,
                    textAnchor: "start",
                    fill: titleColor,
                    strokeWidth: 0,
                    textWrap: true,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });
                let subtitleId;
                if (subtitle) {
                    subtitleId = freshId("text");
                    elems.push({
                        type: "text",
                        id: subtitleId,
                        x: x + padding,
                        y: y + imageHeight + padding + titleH + gap,
                        width: width - padding * 2,
                        height: subH,
                        text: subtitle,
                        fontSize: subtitleFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedImageCardFont,
                        textAnchor: "start",
                        fill: subtitleColor,
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return {
                    ...(bgId ? { bgId } : {}),
                    imageId,
                    titleId,
                    ...(subtitleId ? { subtitleId } : {}),
                    width,
                    height: totalH,
                };
            },

            create_callout: async ({
                x = 0,
                y = 0,
                width = 400,
                text = "",
                accentColor = "#0d65d9",
                barWidth = 4,
                fontSize = 13,
                fontColor = "#1e293b",
                padding = 14,
                rx = 6,
                height: hOpt,
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedCalloutFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const barId = freshId("rect");
                const bgId = freshId("rect");
                const textId = freshId("text");
                const contentW = width - barWidth - padding * 2;
                const textH = measureWrappedTextHeight(text, { width: contentW, fontSize, textWrap: true, lineHeight: 1.4 });
                const autoH = textH + padding * 2;
                const height = hOpt ?? autoH;
                const bgFill = accentColor + "18";
                addElementsAnimated([
                    {
                        type: "rect",
                        id: bgId,
                        x,
                        y,
                        width,
                        height,
                        fill: bgFill,
                        stroke: accentColor,
                        strokeWidth: 1,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "rect",
                        id: barId,
                        x,
                        y,
                        width: barWidth,
                        height,
                        fill: accentColor,
                        stroke: "none",
                        strokeWidth: 0,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "text",
                        id: textId,
                        x: x + barWidth + padding,
                        y: y + height / 2 - textH / 2,
                        width: contentW,
                        height: textH,
                        text,
                        fontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedCalloutFont,
                        textAnchor: "start",
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ]);
                const groupId = makeGroup([bgId, barId, textId].filter(Boolean), "stat_block");
                return { barId, bgId, textId, groupId, width, height };
            },

            create_input_field: async ({
                x = 0,
                y = 0,
                width = 240,
                label = "",
                placeholder = "",
                labelFontSize = 12,
                placeholderFontSize = 13,
                inputHeight = 38,
                labelColor = "#374151",
                placeholderColor = "#9ca3af",
                fill = "#ffffff",
                stroke = "#d1d5db",
                strokeWidth = 1,
                rx = 6,
                gap = 6,
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedInputFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const labelId = freshId("text");
                const inputId = freshId("rect");
                const labelH = labelFontSize * 1.4;
                const inputY = y + labelH + gap;
                const elems = [
                    {
                        type: "text",
                        id: labelId,
                        x,
                        y,
                        width,
                        height: labelH,
                        text: label,
                        fontSize: labelFontSize,
                        fontWeight: "500",
                        fontFamily: resolvedInputFont,
                        textAnchor: "start",
                        fill: labelColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                    {
                        type: "rect",
                        id: inputId,
                        x,
                        y: inputY,
                        width,
                        height: inputHeight,
                        fill,
                        stroke,
                        strokeWidth,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ];
                let placeholderId;
                if (placeholder) {
                    placeholderId = freshId("text");
                    const pl = placeholderFontSize;
                    elems.push({
                        type: "text",
                        id: placeholderId,
                        x: x + 10,
                        y: inputY + inputHeight / 2 - pl / 2,
                        width: width - 20,
                        height: pl * 1.4,
                        text: placeholder,
                        fontSize: pl,
                        fontWeight: "normal",
                        fontFamily: resolvedInputFont,
                        textAnchor: "start",
                        fill: placeholderColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return {
                    labelId,
                    inputId,
                    ...(placeholderId ? { placeholderId } : {}),
                    totalHeight: labelH + gap + inputHeight,
                };
            },

            create_icon_text: async ({
                x = 0,
                y = 0,
                text = "",
                iconSrc,
                iconSize = 24,
                iconFill = "#0d65d9",
                iconColors = {},
                iconRx = 4,
                fontSize = 13,
                fontColor = "#333333",
                fontWeight = "normal",
                layout = "horizontal",
                gap = 8,
                textWrap = true,
                textWidth,
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedIconTextFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const iconId = freshId(iconSrc ? "image" : "rect");
                const textId = freshId("text");
                const normalizedText = normalizeAgentText(text);
                const targetTextWidth = textWidth ?? Math.max(iconSize * 2, 120);
                const textW = textWrap
                    ? Math.max(targetTextWidth, iconSize)
                    : Math.max(normalizedText.length * fontSize * 0.6, 80);
                const textH = measureWrappedTextHeight(normalizedText, {
                    width: targetTextWidth,
                    fontSize,
                    lineHeight: 1.2,
                    textWrap,
                });
                let iconEl, textEl;
                if (layout === "horizontal") {
                    const centerY = y + iconSize / 2;
                    // Center the whole text block (not just the first line) against the icon midpoint.
                    const textBlockStartY = Math.round(centerY - textH / 2);
                    iconEl = iconSrc
                        ? {
                              type: "image",
                              id: iconId,
                              x,
                              y,
                              width: iconSize,
                              height: iconSize,
                              href: iconSrc,
                              fill: iconFill,
                              iconColors,
                              stroke: "none",
                              strokeWidth: 0,
                              rx: iconRx,
                              ry: iconRx,
                              opacity: 1,
                              visible: true,
                              locked: false,
                              description: "",
                              strokeDash: "solid",
                              strokeLinecap: "butt",
                          }
                        : {
                              type: "rect",
                              id: iconId,
                              x,
                              y,
                              width: iconSize,
                              height: iconSize,
                              fill: iconFill,
                              stroke: "none",
                              strokeWidth: 0,
                              rx: iconRx,
                              ry: iconRx,
                              opacity: 1,
                              visible: true,
                              locked: false,
                              description: "",
                              strokeDash: "solid",
                              strokeLinecap: "butt",
                          };
                    textEl = {
                        type: "text",
                        id: textId,
                        x: x + iconSize + gap,
                        y: textBlockStartY,
                        width: textW,
                        height: textH,
                        text: normalizedText,
                        fontSize,
                        lineHeight: 1.2,
                        fontWeight,
                        fontFamily: resolvedIconTextFont,
                        textAnchor: "start",
                        textWrap,
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    };
                } else {
                    const centerX = x + iconSize / 2;
                    iconEl = iconSrc
                        ? {
                              type: "image",
                              id: iconId,
                              x,
                              y,
                              width: iconSize,
                              height: iconSize,
                              href: iconSrc,
                              fill: iconFill,
                              iconColors,
                              stroke: "none",
                              strokeWidth: 0,
                              rx: iconRx,
                              ry: iconRx,
                              opacity: 1,
                              visible: true,
                              locked: false,
                              description: "",
                              strokeDash: "solid",
                              strokeLinecap: "butt",
                          }
                        : {
                              type: "rect",
                              id: iconId,
                              x,
                              y,
                              width: iconSize,
                              height: iconSize,
                              fill: iconFill,
                              stroke: "none",
                              strokeWidth: 0,
                              rx: iconRx,
                              ry: iconRx,
                              opacity: 1,
                              visible: true,
                              locked: false,
                              description: "",
                              strokeDash: "solid",
                              strokeLinecap: "butt",
                          };
                    textEl = {
                        type: "text",
                        id: textId,
                        x: centerX,
                        y: y + iconSize + gap,
                        width: Math.max(textW, iconSize),
                        height: textH,
                        text: normalizedText,
                        fontSize,
                        lineHeight: 1.2,
                        fontWeight,
                        fontFamily: "sans-serif",
                        textAnchor: "middle",
                        textWrap,
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    };
                }
                addElementsAnimated([iconEl, textEl]);
                const groupId = makeGroup([iconId, textId], "icon_text");
                return { iconId, textId, groupId };
            },

            create_divider: async ({
                x = 0,
                y = 0,
                length = 200,
                orientation = "horizontal",
                color = "#e2e8f0",
                thickness = 1,
                label,
                labelFontSize = 11,
                labelColor = "#94a3b8",
                labelBg = "#ffffff",
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedDividerFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const lineId = freshId("line");
                const x2 = orientation === "horizontal" ? x + length : x;
                const y2 = orientation === "horizontal" ? y : y + length;
                const elems = [
                    {
                        type: "line",
                        id: lineId,
                        x,
                        y,
                        width: x2 - x,
                        height: y2 - y,
                        fill: "none",
                        stroke: color,
                        strokeWidth: thickness,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ];
                let labelBgId, labelId;
                if (label) {
                    const lw = label.length * labelFontSize * 0.65 + 12;
                    const lh = labelFontSize * 1.4;
                    const lx =
                        orientation === "horizontal"
                            ? x + length / 2 - lw / 2
                            : x - lw / 2;
                    const ly =
                        orientation === "horizontal"
                            ? y - lh / 2
                            : y + length / 2 - lh / 2;
                    labelBgId = freshId("rect");
                    labelId = freshId("text");
                    elems.push(
                        {
                            type: "rect",
                            id: labelBgId,
                            x: lx,
                            y: ly,
                            width: lw,
                            height: lh,
                            fill: labelBg,
                            stroke: "none",
                            strokeWidth: 0,
                            rx: 3,
                            ry: 3,
                            opacity: 1,
                            visible: true,
                            locked: false,
                            description: "",
                            strokeDash: "solid",
                            strokeLinecap: "butt",
                        },
                        {
                            type: "text",
                            id: labelId,
                            x: lx + lw / 2,
                            y: ly,
                            width: lw,
                            height: lh,
                            text: label,
                            fontSize: labelFontSize,
                            fontWeight: "normal",
                            fontFamily: resolvedDividerFont,
                            textAnchor: "middle",
                            fill: labelColor,
                            stroke: "none",
                            strokeWidth: 0,
                            opacity: 1,
                            visible: true,
                            locked: false,
                            description: "",
                            strokeDash: "solid",
                            strokeLinecap: "butt",
                        },
                    );
                }
                addElementsAnimated(elems);
                return { lineId, ...(labelId ? { labelBgId, labelId } : {}) };
            },

            create_table_row: async ({
                x = 0,
                y = 0,
                width = 400,
                height: rowH = 40,
                cells = [],
                fill = "#ffffff",
                stroke = "#e2e8f0",
                strokeWidth = 1,
                fontSize = 13,
                fontWeight = "normal",
                fontColor = "#1e293b",
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedTableRowFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                if (!cells.length)
                    throw new Error(
                        "create_table_row needs `cells` — an array of cell strings, e.g. cells:[\"Name\",\"Qty\",\"Price\"].",
                    );
                const cellW = width / cells.length;
                const rowId = freshId("rect");
                const cellIds = [];
                const elems = [
                    {
                        type: "rect",
                        id: rowId,
                        x,
                        y,
                        width,
                        height: rowH,
                        fill,
                        stroke,
                        strokeWidth,
                        rx: 0,
                        ry: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    },
                ];
                cells.forEach((cell, i) => {
                    const cellX = x + i * cellW;
                    const textId = freshId("text");
                    cellIds.push(textId);
                    const padding = 16;
                    const maxTextW = cellW - padding;
                    const estW = cell.length * fontSize * 0.6;
                    const finalFontSize = estW > maxTextW ? Math.max(Math.floor(fontSize * (maxTextW / estW)), 8) : fontSize;
                    const textW = Math.max(cell.length * finalFontSize * 0.6, 40);
                    elems.push({
                        type: "text",
                        id: textId,
                        x: cellX + cellW / 2,
                        y: y + rowH / 2 - finalFontSize / 2,
                        width: Math.min(textW, maxTextW),
                        height: finalFontSize * 1.4,
                        text: cell,
                        fontSize: finalFontSize,
                        fontWeight,
                        fontFamily: resolvedTableRowFont,
                        textAnchor: "middle",
                        fill: fontColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    if (i > 0) {
                        const sepId = freshId("line");
                        elems.push({
                            type: "line",
                            id: sepId,
                            x: cellX,
                            y,
                            width: 0,
                            height: rowH,
                            fill: "none",
                            stroke,
                            strokeWidth,
                            opacity: 1,
                            visible: true,
                            locked: false,
                            description: "",
                            strokeDash: "solid",
                            strokeLinecap: "butt",
                        });
                    }
                });
                addElementsAnimated(elems);
                return { rowId, cellIds, cellWidth: cellW, height: rowH };
            },

            create_table: async ({
                x = 0,
                y = 0,
                width = 600,
                headers = [],
                rows = [],
                rowHeight = 40,
                headerFill = "#1e293b",
                headerColor = "#ffffff",
                rowFill = "#ffffff",
                altRowFill = "#f8fafc",
                rowColor = "#1e293b",
                borderColor = "#e2e8f0",
                fontSize = 13,
                headerFontSize,
                fontFamily = "sans-serif",
                rx = 0,
            } = {}) => {
                syncCounter(elements);
                if (!headers.length) throw new Error("headers array is required");
                const allIds = [];
                const headerRowId = freshId("rect");
                const cellW = width / headers.length;

                // Helper to build one row's elements
                function buildRow(cells, rowY, fill, fontColor, fSize, fontWeight = "normal", isHeader = false) {
                    const bgId = isHeader ? headerRowId : freshId("rect");
                    const rowEls = [
                        {
                            type: "rect", id: bgId, x, y: rowY, width, height: rowHeight,
                            fill, stroke: borderColor, strokeWidth: 1,
                            rx: isHeader ? rx : 0, ry: isHeader ? rx : 0,
                            opacity: 1, visible: true, locked: false, description: "",
                            strokeDash: "solid", strokeLinecap: "butt",
                        },
                    ];
                    cells.forEach((cell, i) => {
                        const cellX = x + i * cellW;
                        const textId = freshId("text");
                        allIds.push(textId);
                        rowEls.push({
                            type: "text", id: textId,
                            x: cellX + cellW / 2,
                            y: rowY + rowHeight / 2 - fSize / 2,
                            width: Math.max(String(cell).length * fSize * 0.6, 40),
                            height: fSize * 1.4,
                            text: String(cell), fontSize: fSize, fontWeight, fontFamily,
                            textAnchor: "middle", fill: fontColor,
                            stroke: "none", strokeWidth: 0, opacity: 1,
                            visible: true, locked: false, description: "",
                            strokeDash: "solid", strokeLinecap: "butt",
                        });
                        if (i > 0) {
                            const sepId = freshId("line");
                            rowEls.push({
                                type: "line", id: sepId,
                                x: cellX, y: rowY, width: 0, height: rowHeight,
                                fill: "none", stroke: borderColor, strokeWidth: 1,
                                opacity: 1, visible: true, locked: false, description: "",
                                strokeDash: "solid", strokeLinecap: "butt",
                            });
                        }
                    });
                    return { bgId, rowEls };
                }

                const hFS = headerFontSize || fontSize;
                const { bgId: hBgId, rowEls: headerEls } = buildRow(headers, y, headerFill, headerColor, hFS, "700", true);
                allIds.push(hBgId);

                const dataRowIds = [];
                const dataEls = [];
                rows.forEach((row, ri) => {
                    const rowY = y + rowHeight * (ri + 1);
                    const fill = ri % 2 === 0 ? rowFill : (altRowFill || rowFill);
                    const { bgId: rBgId, rowEls } = buildRow(row, rowY, fill, rowColor, fontSize);
                    dataRowIds.push(rBgId);
                    allIds.push(rBgId);
                    dataEls.push(...rowEls);
                });

                const allElems = [...headerEls, ...dataEls];
                addElementsAnimated(allElems);
                const groupId = makeGroup(allIds, "table");
                return {
                    groupId,
                    headerRowId: hBgId,
                    dataRowIds,
                    totalHeight: rowHeight * (rows.length + 1),
                    rows: rows.length,
                    columns: headers.length,
                };
            },

            create_navbar: async ({
                x = 0,
                y = 0,
                width = canvasSize.width,
                height = 64,
                logo = "Brand",
                links = [],
                cta,
                ctaLabel,
                bg = "#ffffff",
                textColor = "#111827",
                mutedColor = "#475569",
                accentColor = "#0d65d9",
                fontFamily = "sans-serif",
                paddingX = 32,
            } = {}) => {
                syncCounter(elements);
                const bgId = freshId("rect");
                const logoId = freshId("text");
                const elems = [
                    makeRectElement({ id: bgId, x, y, width, height, fill: bg, stroke: "#e2e8f0", strokeWidth: 1 }),
                    makeTextElement({
                        id: logoId, x: x + paddingX, y: y + height / 2 - 10,
                        width: Math.max(logo.length * 12, 80), height: 24,
                        text: logo, fontSize: 18, fontWeight: "700",
                        fontFamily, fill: textColor,
                    }),
                ];
                const linkIds = [];
                const ctaText = ctaLabel || cta;
                const ctaW = ctaText ? Math.max(ctaText.length * 8 + 32, 104) : 0;
                let cursorX = x + width - paddingX - ctaW;
                let ctaId, ctaTextId;
                if (ctaText) {
                    cursorX -= 20;
                    ctaId = freshId("rect");
                    ctaTextId = freshId("text");
                    elems.push(
                        makeRectElement({ id: ctaId, x: x + width - paddingX - ctaW, y: y + (height - 36) / 2, width: ctaW, height: 36, fill: accentColor, rx: 8 }),
                        makeTextElement({
                            id: ctaTextId, x: x + width - paddingX - ctaW / 2, y: y + height / 2 - 8,
                            width: ctaW, height: 20, text: ctaText, fontSize: 13,
                            fontWeight: "700", fontFamily, fill: "#ffffff", textAnchor: "middle",
                        }),
                    );
                }
                const logoW = Math.max(logo.length * 12, 80);
                const minXForLinks = x + paddingX + logoW + 32;
                let activeLinks = [...links];
                let spacing = 28;
                let totalLinksW = activeLinks.reduce((acc, l) => acc + Math.max(String(l).length * 8, 44), 0);
                
                while (activeLinks.length > 0 && cursorX - totalLinksW - (activeLinks.length * 8) < minXForLinks) {
                    activeLinks.pop();
                    totalLinksW = activeLinks.reduce((acc, l) => acc + Math.max(String(l).length * 8, 44), 0);
                }
                
                if (activeLinks.length > 0) {
                    spacing = Math.min(28, Math.max(8, (cursorX - minXForLinks - totalLinksW) / activeLinks.length));
                }

                [...activeLinks].reverse().forEach((link) => {
                    const label = String(link);
                    const w = Math.max(label.length * 8, 44);
                    cursorX -= w + spacing;
                    const id = freshId("text");
                    linkIds.unshift(id);
                    elems.push(makeTextElement({
                        id, x: cursorX, y: y + height / 2 - 7,
                        width: w, height: 18, text: label, fontSize: 13,
                        fontWeight: "600", fontFamily, fill: mutedColor,
                    }));
                });
                addElementsAnimated(elems);
                const groupId = makeGroup(elems.map((e) => e.id), "navbar");
                return { bgId, logoId, linkIds, ...(ctaId ? { ctaId, ctaTextId } : {}), groupId, height };
            },

            create_hero: async ({
                x = 0,
                y = 0,
                width = canvasSize.width,
                height = 420,
                headline = "",
                subtitle,
                body,
                cta,
                bg = "#f8fafc",
                imageSrc,
                imageWidth,
                accentColor = "#0d65d9",
                textColor = "#0f172a",
                bodyColor = "#475569",
                fontFamily = "sans-serif",
                padding = 56,
            } = {}) => {
                syncCounter(elements);
                const bgId = freshId("rect");
                const elems = [makeRectElement({ id: bgId, x, y, width, height, fill: bg })];
                const contentW = imageSrc ? Math.round(width * 0.52) : width - padding * 2;
                let cursorY = y + padding;
                let subtitleId, headlineId, bodyId, ctaId, ctaTextId, imageId;
                if (subtitle) {
                    subtitleId = freshId("text");
                    elems.push(makeTextElement({
                        id: subtitleId, x: x + padding, y: cursorY,
                        width: contentW, height: 20, text: subtitle,
                        fontSize: 13, fontWeight: "700", fontFamily, fill: accentColor,
                    }));
                    cursorY += 30;
                }
                headlineId = freshId("text");
                elems.push(makeTextElement({
                    id: headlineId, x: x + padding, y: cursorY,
                    width: contentW, text: headline, fontSize: 48,
                    fontWeight: "800", fontFamily, fill: textColor,
                    lineHeight: 1.05, textWrap: true,
                }));
                cursorY += Math.max(64, measureWrappedTextHeight(headline, { width: contentW, fontSize: 48, lineHeight: 1.05, textWrap: true })) + 18;
                if (body) {
                    bodyId = freshId("text");
                    elems.push(makeTextElement({
                        id: bodyId, x: x + padding, y: cursorY,
                        width: Math.min(contentW, 560), text: body,
                        fontSize: 17, fontWeight: "normal", fontFamily,
                        fill: bodyColor, lineHeight: 1.45, textWrap: true,
                    }));
                    cursorY += measureWrappedTextHeight(body, { width: Math.min(contentW, 560), fontSize: 17, lineHeight: 1.45, textWrap: true }) + 28;
                }
                if (cta) {
                    const ctaW = Math.max(String(cta).length * 8 + 38, 128);
                    ctaId = freshId("rect");
                    ctaTextId = freshId("text");
                    elems.push(
                        makeRectElement({ id: ctaId, x: x + padding, y: cursorY, width: ctaW, height: 44, fill: accentColor, rx: 8 }),
                        makeTextElement({
                            id: ctaTextId, x: x + padding + ctaW / 2, y: cursorY + 12,
                            width: ctaW, height: 20, text: cta, fontSize: 14,
                            fontWeight: "700", fontFamily, fill: "#ffffff", textAnchor: "middle",
                        }),
                    );
                }
                if (imageSrc) {
                    const iw = imageWidth ?? Math.round(width * 0.34);
                    imageId = freshId("image");
                    elems.push(makeImageElement({
                        id: imageId, x: x + width - padding - iw,
                        y: y + Math.round((height - iw * 0.72) / 2),
                        width: iw, height: Math.round(iw * 0.72),
                        href: imageSrc, fill: "#e2e8f0", rx: 14,
                    }));
                }
                addElementsAnimated(elems);
                const groupId = makeGroup(elems.map((e) => e.id), "hero");
                return { bgId, headlineId, ...(subtitleId ? { subtitleId } : {}), ...(bodyId ? { bodyId } : {}), ...(ctaId ? { ctaId, ctaTextId } : {}), ...(imageId ? { imageId } : {}), groupId };
            },

            create_footer: async ({
                x = 0,
                y = 0,
                width = canvasSize.width,
                columns = [],
                copyright,
                bg = "#0f172a",
                dividerColor = "#334155",
                textColor = "#e2e8f0",
                mutedColor = "#94a3b8",
                fontFamily = "sans-serif",
                padding = 40,
                columnGap = 48,
            } = {}) => {
                syncCounter(elements);
                const maxLinks = Math.max(1, ...columns.map((c) => c.links?.length || 0));
                const height = padding * 2 + 24 + maxLinks * 24 + (copyright ? 46 : 0);
                const bgId = freshId("rect");
                const dividerId = freshId("line");
                const elems = [makeRectElement({ id: bgId, x, y, width, height, fill: bg })];
                const columnTitleIds = [];
                const columnLinkIds = [];
                const colW = (width - padding * 2 - columnGap * Math.max(columns.length - 1, 0)) / Math.max(columns.length, 1);
                columns.forEach((col, i) => {
                    const colX = x + padding + i * (colW + columnGap);
                    const titleId = freshId("text");
                    columnTitleIds.push(titleId);
                    elems.push(makeTextElement({ id: titleId, x: colX, y: y + padding, width: colW, height: 20, text: col.title || "", fontSize: 14, fontWeight: "700", fontFamily, fill: textColor }));
                    (col.links || []).forEach((link, li) => {
                        const id = freshId("text");
                        columnLinkIds.push(id);
                        elems.push(makeTextElement({ id, x: colX, y: y + padding + 32 + li * 24, width: colW, height: 18, text: String(link), fontSize: 13, fontFamily, fill: mutedColor }));
                    });
                });
                const dividerY = y + height - (copyright ? 44 : 1);
                elems.push({ type: "line", id: dividerId, x, y: dividerY, width, height: 0, fill: "none", stroke: dividerColor, strokeWidth: 1, opacity: 1, visible: true, locked: false, description: "", strokeDash: "solid", strokeLinecap: "butt" });
                let copyrightId;
                if (copyright) {
                    copyrightId = freshId("text");
                    elems.push(makeTextElement({ id: copyrightId, x: x + padding, y: dividerY + 16, width: width - padding * 2, height: 18, text: copyright, fontSize: 12, fontFamily, fill: mutedColor }));
                }
                addElementsAnimated(elems);
                const groupId = makeGroup(elems.map((e) => e.id), "footer");
                return { bgId, dividerId, columnTitleIds, columnLinkIds, ...(copyrightId ? { copyrightId } : {}), groupId, height };
            },

            create_pricing_card: async ({
                x = 0,
                y = 0,
                width = 300,
                plan = "Plan",
                price = "$0",
                period = "",
                features = [],
                cta = "Get started",
                popular = false,
                accentColor = "#0d65d9",
                fill = "#ffffff",
                stroke = "#e2e8f0",
                textColor = "#0f172a",
                mutedColor = "#64748b",
                fontFamily = "sans-serif",
            } = {}) => {
                syncCounter(elements);
                const height = 210 + features.length * 28 + (popular ? 28 : 0);
                const cardId = freshId("rect");
                const planId = freshId("text");
                const priceId = freshId("text");
                const ctaId = freshId("rect");
                const ctaTextId = freshId("text");
                const elems = [makeRectElement({ id: cardId, x, y, width, height, fill, stroke, strokeWidth: 1, rx: 10 })];
                let popularId;
                let topY = y + 24;
                if (popular) {
                    popularId = freshId("text");
                    elems.push(makeRectElement({ id: freshId("rect"), x: x + width - 106, y: y + 16, width: 82, height: 24, fill: accentColor, rx: 12 }));
                    elems.push(makeTextElement({ id: popularId, x: x + width - 65, y: y + 21, width: 80, height: 14, text: "Popular", fontSize: 10, fontWeight: "700", fontFamily, fill: "#ffffff", textAnchor: "middle" }));
                    topY += 8;
                }
                elems.push(
                    makeTextElement({ id: planId, x: x + 24, y: topY, width: width - 48, height: 22, text: plan, fontSize: 16, fontWeight: "700", fontFamily, fill: textColor }),
                    makeTextElement({ id: priceId, x: x + 24, y: topY + 34, width: width - 48, height: 46, text: `${price}${period}`, fontSize: 34, fontWeight: "800", fontFamily, fill: textColor }),
                );
                const featureIds = [];
                features.forEach((feature, i) => {
                    const id = freshId("text");
                    featureIds.push(id);
                    elems.push(makeTextElement({ id, x: x + 28, y: topY + 96 + i * 28, width: width - 56, height: 18, text: `✓ ${feature}`, fontSize: 13, fontFamily, fill: mutedColor }));
                });
                const ctaY = y + height - 62;
                elems.push(
                    makeRectElement({ id: ctaId, x: x + 24, y: ctaY, width: width - 48, height: 42, fill: accentColor, rx: 8 }),
                    makeTextElement({ id: ctaTextId, x: x + width / 2, y: ctaY + 12, width: width - 48, height: 18, text: cta, fontSize: 14, fontWeight: "700", fontFamily, fill: "#ffffff", textAnchor: "middle" }),
                );
                addElementsAnimated(elems);
                const groupId = makeGroup(elems.map((e) => e.id), "pricing_card");
                return { cardId, planId, priceId, featureIds, ctaId, ctaTextId, ...(popularId ? { popularId } : {}), groupId, height };
            },

            create_icon_grid: async ({
                x = 0,
                y = 0,
                columns = 3,
                items = [],
                iconFill = "#0d65d9",
                spacing = 24,
                rowSpacing = 36,
                cellWidth = 220,
                iconSize = 40,
                titleColor = "#0f172a",
                descColor = "#64748b",
                fontFamily = "sans-serif",
            } = {}) => {
                if (!Array.isArray(items) || !items.length)
                    throw new Error(
                        'create_icon_grid needs `items` — e.g. items:[{ title:"Fast", desc:"…", icon:"zap" }].',
                    );
                syncCounter(elements);
                const elems = [];
                const itemGroups = [];
                items.forEach((item, i) => {
                    const col = i % columns;
                    const row = Math.floor(i / columns);
                    const cellX = x + col * (cellWidth + spacing);
                    const cellY = y + row * (iconSize + 82 + rowSpacing);
                    const iconId = freshId(item.icon ? "image" : "rect");
                    const titleId = freshId("text");
                    const descId = item.desc ? freshId("text") : null;
                    elems.push(item.icon
                        ? makeImageElement({ id: iconId, x: cellX, y: cellY, width: iconSize, height: iconSize, href: item.icon, fill: iconFill, rx: 8 })
                        : makeRectElement({ id: iconId, x: cellX, y: cellY, width: iconSize, height: iconSize, fill: iconFill, rx: 8 }));
                    elems.push(makeTextElement({ id: titleId, x: cellX, y: cellY + iconSize + 14, width: cellWidth, height: 20, text: item.title || "", fontSize: 15, fontWeight: "700", fontFamily, fill: titleColor }));
                    if (descId) elems.push(makeTextElement({ id: descId, x: cellX, y: cellY + iconSize + 40, width: cellWidth, text: item.desc, fontSize: 12, fontFamily, fill: descColor, lineHeight: 1.35 }));
                    itemGroups.push({ iconId, titleId, ...(descId ? { descId } : {}) });
                });
                addElementsAnimated(elems);
                const groupId = makeGroup(elems.map((e) => e.id), "icon_grid");
                return { items: itemGroups, groupId, count: itemGroups.length };
            },

            create_list: async ({
                x = 0,
                y = 0,
                width = 300,
                items = [],
                bulletType = "bullet",
                fontSize = 13,
                lineHeight: lhOpt,
                bulletColor,
                textColor = "#1e293b",
                fontWeight = "normal",
                fontFamily = "sans-serif",
                fill,
                stroke = "none",
                rx = 0,
                padding = 12,
                indentX = 20,
            } = {}) => {
                syncCounter(elements);
                const lh = lhOpt ?? Math.round(fontSize * 1.8);
                const bullets = {
                    bullet: "• ",
                    number: null,
                    check: "✓ ",
                    none: "",
                };
                const prefix = bullets[bulletType] ?? "• ";
                const elems = [];
                let bgId;
                const totalH = padding * 2 + items.reduce((acc, item, i) => {
                    const prefix = bulletType === "number" ? `${i + 1}. ` : bullets[bulletType] ?? "• ";
                    const itemW = width - (fill ? padding * 2 : 0) - indentX;
                    const textH = measureWrappedTextHeight(`${prefix}${item}`, { width: itemW, fontSize, textWrap: true, lineHeight: 1.4 });
                    return acc + Math.max(lhOpt ?? Math.round(fontSize * 1.8), textH);
                }, 0);
                if (fill) {
                    bgId = freshId("rect");
                    elems.push({
                        type: "rect",
                        id: bgId,
                        x,
                        y,
                        width,
                        height: totalH,
                        fill,
                        stroke,
                        strokeWidth: 1,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                let currentY = y + (fill ? padding : 0);
                const itemIds = items.map((item, i) => {
                    const id = freshId("text");
                    const itemPrefix =
                        bulletType === "number" ? `${i + 1}. ` : prefix;
                    const bColor = bulletColor || textColor;
                    const splitBullet = bulletType !== "none" && bulletColor && bulletColor !== textColor;
                    const textX = x + (fill ? padding : 0) + indentX;
                    const itemW = width - (fill ? padding * 2 : 0) - indentX;
                    const textH = measureWrappedTextHeight(`${itemPrefix}${item}`, { width: itemW, fontSize, textWrap: true, lineHeight: 1.4 });
                    const stepH = Math.max(lh, textH);
                    const itemY = currentY;
                    currentY += stepH;

                    const baseText = {
                        fontSize, fontWeight, fontFamily,
                        textAnchor: "start",
                        stroke: "none", strokeWidth: 0,
                        textWrap: true,
                        opacity: 1, visible: true, locked: false, description: "",
                        strokeDash: "solid", strokeLinecap: "butt",
                    };
                    if (splitBullet) {
                        const bulletId = freshId("text");
                        const bulletW = Math.ceil(itemPrefix.length * fontSize * 0.56);
                        elems.push({
                            ...baseText,
                            type: "text", id: bulletId,
                            x: textX, y: itemY,
                            width: bulletW, height: textH,
                            text: itemPrefix.trimEnd(),
                            fill: bColor,
                        });
                        elems.push({
                            ...baseText,
                            type: "text", id,
                            x: textX + bulletW, y: itemY,
                            width: Math.max(itemW - bulletW, 40), height: textH,
                            text: item,
                            fill: textColor,
                        });
                    } else {
                        elems.push({
                            ...baseText,
                            type: "text", id,
                            x: textX, y: itemY,
                            width: itemW, height: textH,
                            text: `${itemPrefix}${item}`,
                            fill: textColor,
                        });
                    }
                    return id;
                });
                addElementsAnimated(elems);
                return {
                    ...(bgId ? { bgId } : {}),
                    itemIds,
                    totalHeight: totalH,
                };
            },

            create_tag_group: async ({
                x = 0,
                y = 0,
                tags = [],
                spacing = 6,
                fill = "#e2e8f0",
                textColor = "#334155",
                fontSize = 11,
                fontWeight = "600",
                fontFamily = "sans-serif",
                rx: rxOpt,
                paddingX = 10,
                paddingY = 4,
                maxWidth,
            } = {}) => {
                syncCounter(elements);
                const resolvedFontFamily = resolveFontFamily(fontFamily);
                const height = fontSize + paddingY * 2;
                const rxVal = rxOpt ?? height / 2;
                const elems = [];
                const ids = [];
                const mxWidth = maxWidth ?? (canvasSize.width - x - 20);
                let curX = x;
                let curY = y;
                let maxW = 0;
                tags.forEach((tag) => {
                    const w = Math.max(
                        tag.length * fontSize * 0.62 + paddingX * 2,
                        30,
                    );
                    if (curX + w > x + mxWidth && curX !== x) {
                        curX = x;
                        curY += height + spacing;
                    }
                    const rectId = freshId("rect");
                    const textId = freshId("text");
                    const textY = curY + height / 2 - fontSize / 2;
                    elems.push({
                        type: "rect",
                        id: rectId,
                        x: curX,
                        y: curY,
                        width: w,
                        height,
                        fill,
                        stroke: "none",
                        strokeWidth: 0,
                        rx: rxVal,
                        ry: rxVal,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    elems.push({
                        type: "text",
                        id: textId,
                        x: curX + w / 2,
                        y: textY,
                        width: Math.max(tag.length * fontSize * 0.62, 20),
                        height: fontSize * 1.4,
                        text: tag,
                        fontSize,
                        fontWeight,
                        fontFamily: resolvedFontFamily,
                        textAnchor: "middle",
                        fill: textColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    ids.push({ rectId, textId });
                    curX += w + spacing;
                    maxW = Math.max(maxW, curX - x - spacing);
                });
                addElementsAnimated(elems);
                return { ids, totalWidth: maxW, height: curY - y + height };
            },

            create_timeline: async ({
                x = 0,
                y = 0,
                items = [],
                dotColor = "#0d65d9",
                lineColor = "#cbd5e1",
                dotSize = 12,
                titleFontSize = 14,
                subtitleFontSize = 12,
                dateFontSize = 11,
                titleColor = "#111111",
                subtitleColor = "#555555",
                dateColor = "#94a3b8",
                itemSpacing = 60,
                textOffsetX = 24,
                fontFamily = "sans-serif",
                width: textWidth = 220,
            } = {}) => {
                syncCounter(elements);
                const resolvedFontFamily = resolveFontFamily(fontFamily);
                if (!Array.isArray(items) || !items.length)
                    throw new Error(
                        'create_timeline needs `items` — e.g. items:[{ title:"Founded", subtitle:"…", date:"2021" }].',
                    );
                const lineId = freshId("line");
                const elems = [
                    {
                        type: "line",
                        id: lineId,
                        x1: x,
                        y1: y + dotSize / 2,
                        x2: x,
                        y2: y + totalH - dotSize / 2,
                        x: x,
                        y: y + dotSize / 2,
                        width: 0,
                        height: totalH - dotSize,
                        fill: "none",
                        stroke: lineColor,
                        strokeWidth: 2,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "round",
                    },
                ];
                const resultItems = items.map((item, i) => {
                    const cy = y + i * itemSpacing;
                    const dotId = freshId("circle");
                    const titleId = freshId("text");
                    const textX = x + textOffsetX;
                    const titleY = cy - titleFontSize / 2;
                    elems.push({
                        type: "circle",
                        id: dotId,
                        cx: x,
                        cy,
                        r: dotSize / 2,
                        x: x - dotSize / 2,
                        y: cy - dotSize / 2,
                        width: dotSize,
                        height: dotSize,
                        fill: dotColor,
                        stroke: "#ffffff",
                        strokeWidth: 2,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    elems.push({
                        type: "text",
                        id: titleId,
                        x: textX,
                        y: titleY,
                        width: textWidth,
                        height: titleFontSize * 1.4,
                        text: item.title,
                        fontSize: titleFontSize,
                        fontWeight: "600",
                        fontFamily: resolvedFontFamily,
                        textAnchor: "start",
                        fill: titleColor,
                        stroke: "none",
                        strokeWidth: 0,
                        textWrap: true,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    let subtitleId, dateId;
                    if (item.subtitle) {
                        subtitleId = freshId("text");
                        elems.push({
                            type: "text",
                            id: subtitleId,
                            x: textX,
                            y: titleY + titleFontSize * 1.4,
                            width: textWidth,
                            height: subtitleFontSize * 1.4,
                            text: item.subtitle,
                            fontSize: subtitleFontSize,
                            fontWeight: "normal",
                            fontFamily: resolvedFontFamily,
                            textAnchor: "start",
                            fill: subtitleColor,
                            stroke: "none",
                            strokeWidth: 0,
                            textWrap: true,
                            opacity: 1,
                            visible: true,
                            locked: false,
                            description: "",
                            strokeDash: "solid",
                            strokeLinecap: "butt",
                        });
                    }
                    if (item.date) {
                        dateId = freshId("text");
                        elems.push({
                            type: "text",
                            id: dateId,
                            x: textX,
                            y: titleY - dateFontSize * 1.4,
                            width: textWidth,
                            height: dateFontSize * 1.4,
                            text: item.date,
                            fontSize: dateFontSize,
                            fontWeight: "normal",
                            fontFamily: resolvedFontFamily,
                            textAnchor: "start",
                            fill: dateColor,
                            stroke: "none",
                            strokeWidth: 0,
                            opacity: 1,
                            visible: true,
                            locked: false,
                            description: "",
                            strokeDash: "solid",
                            strokeLinecap: "butt",
                        });
                    }
                    return {
                        dotId,
                        titleId,
                        ...(subtitleId ? { subtitleId } : {}),
                        ...(dateId ? { dateId } : {}),
                    };
                });
                addElementsAnimated(elems);
                return { lineId, items: resultItems };
            },

            create_rating: async ({
                x = 0,
                y = 0,
                value = 4,
                maxStars = 5,
                starSize = 20,
                filledColor = "#f59e0b",
                emptyColor = "#d1d5db",
                spacing = 2,
                showLabel = false,
                labelColor = "#64748b",
                labelFontSize = 12,
                labelGap = 8,
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedRatingFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const elems = [];
                const starIds = [];
                const floorVal = Math.floor(value);
                for (let i = 0; i < maxStars; i++) {
                    const id = freshId("text");
                    starIds.push(id);
                    const isFilled = i < floorVal;
                    const isHalf = !isFilled && i === floorVal && (value % 1) >= 0.5;
                    elems.push({
                        type: "text",
                        id,
                        x: x + i * (starSize + spacing),
                        y,
                        width: starSize,
                        height: starSize * 1.2,
                        text: isFilled ? "★" : (isHalf ? "⯨" : "☆"),
                        fontSize: starSize,
                        fontWeight: "normal",
                        fontFamily: resolvedRatingFont,
                        textAnchor: "start",
                        fill: (isFilled || isHalf) ? filledColor : emptyColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                let labelId;
                if (showLabel) {
                    labelId = freshId("text");
                    const labelX =
                        x + maxStars * (starSize + spacing) + labelGap;
                    elems.push({
                        type: "text",
                        id: labelId,
                        x: labelX,
                        y: y + (starSize - labelFontSize) / 2,
                        width: 60,
                        height: labelFontSize * 1.4,
                        text: `${value} / ${maxStars}`,
                        fontSize: labelFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedRatingFont,
                        textAnchor: "start",
                        fill: labelColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }
                addElementsAnimated(elems);
                return {
                    starIds,
                    ...(labelId ? { labelId } : {}),
                    width: maxStars * (starSize + spacing) - spacing,
                };
            },

            create_price_tag: async ({
                x = 0,
                y = 0,
                price = "0",
                currency,
                originalPrice,
                label,
                priceFontSize = 36,
                currencyFontSize = 18,
                originalFontSize = 14,
                priceColor = "#111111",
                currencyColor,
                originalColor = "#94a3b8",
                labelFill = "#ef4444",
                labelTextColor = "#ffffff",
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedPriceFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const elems = [];
                let curX = x;
                let labelId, labelTextId, currencyId, originalId, strikeId;
                const cColor = currencyColor || priceColor;

                if (label) {
                    const lW = Math.max(label.length * 10 * 0.6 + 16, 40);
                    const lH = 10 + 8;
                    const lRx = lH / 2;
                    labelId = freshId("rect");
                    labelTextId = freshId("text");
                    elems.push({
                        type: "rect",
                        id: labelId,
                        x: curX,
                        y,
                        width: lW,
                        height: lH,
                        fill: labelFill,
                        stroke: "none",
                        strokeWidth: 0,
                        rx: lRx,
                        ry: lRx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    elems.push({
                        type: "text",
                        id: labelTextId,
                        x: curX + lW / 2,
                        y: y + lH / 2 - 5,
                        width: lW,
                        height: 14,
                        text: label,
                        fontSize: 10,
                        fontWeight: "700",
                        fontFamily: resolvedPriceFont,
                        textAnchor: "middle",
                        fill: labelTextColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    curX = x;
                    y += lH + 6;
                }

                if (currency) {
                    currencyId = freshId("text");
                    elems.push({
                        type: "text",
                        id: currencyId,
                        x: curX,
                        y: y + (priceFontSize - currencyFontSize) * 0.6,
                        width: currencyFontSize * 0.8,
                        height: currencyFontSize * 1.4,
                        text: currency,
                        fontSize: currencyFontSize,
                        fontWeight: "700",
                        fontFamily: resolvedPriceFont,
                        textAnchor: "start",
                        fill: cColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    curX += currencyFontSize * 0.8 + 2;
                }

                const priceId = freshId("text");
                const priceW = price.length * priceFontSize * 0.6;
                elems.push({
                    type: "text",
                    id: priceId,
                    x: curX,
                    y,
                    width: priceW + 10,
                    height: priceFontSize * 1.2,
                    text: price,
                    fontSize: priceFontSize,
                    fontWeight: "700",
                    fontFamily: resolvedPriceFont,
                    textAnchor: "start",
                    fill: priceColor,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });

                if (originalPrice) {
                    const origX = curX + priceW + 14;
                    originalId = freshId("text");
                    strikeId = freshId("line");
                    const origW =
                        originalPrice.length * originalFontSize * 0.6 + 4;
                    const origY = y + (priceFontSize - originalFontSize) * 0.7;
                    const strikeY = origY + originalFontSize * 0.55;
                    elems.push({
                        type: "text",
                        id: originalId,
                        x: origX,
                        y: origY,
                        width: origW,
                        height: originalFontSize * 1.4,
                        text: originalPrice,
                        fontSize: originalFontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedPriceFont,
                        textAnchor: "start",
                        fill: originalColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    elems.push({
                        type: "line",
                        id: strikeId,
                        x: origX,
                        y: strikeY,
                        width: origW,
                        height: 0,
                        fill: "none",
                        stroke: originalColor,
                        strokeWidth: 1.5,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "round",
                    });
                }

                addElementsAnimated(elems);
                return {
                    priceId,
                    ...(currencyId ? { currencyId } : {}),
                    ...(originalId ? { originalId, strikeId } : {}),
                    ...(labelId ? { labelId, labelTextId } : {}),
                };
            },

            create_testimonial: async ({
                x = 0,
                y = 0,
                width = 320,
                quote = "",
                author = "",
                role,
                initials,
                avatarFill = "#0d65d9",
                quoteColor = "#0d65d9",
                textColor = "#334155",
                authorColor = "#111111",
                roleColor = "#94a3b8",
                fill,
                stroke = "#e2e8f0",
                rx = 12,
                padding = 24,
                quoteFontSize = 14,
                avatarSize = 36,
                fontFamily = "sans-serif",
            } = {}) => {
                syncCounter(elements);
                const elems = [];
                let bgId;
                const quoteMark = '"';
                const quoteMarkSize = 48;
                const quoteMarkH = quoteMarkSize * 1.1;
                const textW = width - padding * 2;
                const quoteLines = Math.ceil(
                    quote.length / (textW / (quoteFontSize * 0.6)),
                );
                const textH = quoteLines * quoteFontSize * 1.6;
                const divY = y + padding + quoteMarkH + textH + 12;
                const avatarY = divY + 12;
                const totalH = avatarY + avatarSize + padding - y;

                // Bounds check: warn if the component overflows the canvas.
                if (y + totalH > canvasSize.height) {
                    const overflow = Math.round(y + totalH - canvasSize.height);
                    throw new Error(
                        `create_testimonial would overflow the canvas by ${overflow}px (y:${y} + totalHeight:${Math.round(totalH)} = ${Math.round(y + totalH)}, canvas height: ${canvasSize.height}). ` +
                        `Move it up by at least ${overflow}px or reduce the quote text length.`
                    );
                }

                if (fill) {
                    bgId = freshId("rect");
                    elems.push({
                        type: "rect",
                        id: bgId,
                        x,
                        y,
                        width,
                        height: totalH,
                        fill,
                        stroke,
                        strokeWidth: 1,
                        rx,
                        ry: rx,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }

                const quoteMarkId = freshId("text");
                elems.push({
                    type: "text",
                    id: quoteMarkId,
                    x: x + padding,
                    y: y + padding,
                    width: quoteMarkSize,
                    height: quoteMarkH,
                    text: quoteMark,
                    fontSize: quoteMarkSize,
                    fontWeight: "700",
                    fontFamily: "Georgia, serif",
                    textAnchor: "start",
                    fill: quoteColor,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });

                const textId = freshId("text");
                elems.push({
                    type: "text",
                    id: textId,
                    x: x + padding,
                    y: y + padding + quoteMarkH,
                    width: textW,
                    height: textH,
                    text: quote,
                    fontSize: quoteFontSize,
                    fontWeight: "normal",
                    fontFamily,
                    textAnchor: "start",
                    fill: textColor,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });

                const divId = freshId("line");
                elems.push({
                    type: "line",
                    id: divId,
                    x1: x + padding,
                    y1: divY,
                    x2: x + width - padding,
                    y2: divY,
                    x: x + padding,
                    y: divY,
                    width: width - padding * 2,
                    height: 0,
                    fill: "none",
                    stroke: "#e2e8f0",
                    strokeWidth: 1,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });

                const avatarId = freshId("circle");
                const avatarCx = x + padding + avatarSize / 2;
                const avatarCy = avatarY + avatarSize / 2;
                elems.push({
                    type: "circle",
                    id: avatarId,
                    cx: avatarCx,
                    cy: avatarCy,
                    r: avatarSize / 2,
                    x: avatarCx - avatarSize / 2,
                    y: avatarCy - avatarSize / 2,
                    width: avatarSize,
                    height: avatarSize,
                    fill: avatarFill,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });
                if (initials) {
                    const initId = freshId("text");
                    elems.push({
                        type: "text",
                        id: initId,
                        x: avatarCx,
                        y: avatarCy - 7,
                        width: avatarSize,
                        height: 14,
                        text: initials,
                        fontSize: 13,
                        fontWeight: "700",
                        fontFamily,
                        textAnchor: "middle",
                        fill: "#ffffff",
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }

                const authorId = freshId("text");
                const textLeftX = x + padding + avatarSize + 10;
                elems.push({
                    type: "text",
                    id: authorId,
                    x: textLeftX,
                    y: avatarY + (role ? 2 : avatarSize / 2 - 7),
                    width: textW - avatarSize - 10,
                    height: 18,
                    text: author,
                    fontSize: 13,
                    fontWeight: "700",
                    fontFamily,
                    textAnchor: "start",
                    fill: authorColor,
                    stroke: "none",
                    strokeWidth: 0,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });

                let roleId;
                if (role) {
                    roleId = freshId("text");
                    elems.push({
                        type: "text",
                        id: roleId,
                        x: textLeftX,
                        y: avatarY + 20,
                        width: textW - avatarSize - 10,
                        height: 16,
                        text: role,
                        fontSize: 11,
                        fontWeight: "normal",
                        fontFamily: "sans-serif",
                        textAnchor: "start",
                        fill: roleColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }

                addElementsAnimated(elems);
                const groupId = makeGroup(elems.map(e => e.id), "testimonial");
                return {
                    ...(bgId ? { bgId } : {}),
                    quoteMarkId,
                    textId,
                    divId,
                    avatarId,
                    authorId,
                    ...(roleId ? { roleId } : {}),
                    groupId,
                    totalHeight: totalH,
                };
            },

            create_qr_placeholder: async ({
                x = 0,
                y = 0,
                size = 120,
                url,
                label,
                fgColor = "#000000",
                bgColor = "#ffffff",
                fontSize = 11,
                labelColor = "#64748b",
                fontFamily = "sans-serif",
            } = {}) => {
                const resolvedQrFont = resolveFontFamily(fontFamily);
                syncCounter(elements);
                const elems = [];
                const cornerIds = [];
                const pad = Math.round(size * 0.08);
                const finderSize = Math.round(size * 0.28);
                const innerSize = Math.round(finderSize * 0.55);
                const coreSize = Math.round(innerSize * 0.55);

                // Background
                const frameId = freshId("rect");
                elems.push({
                    type: "rect",
                    id: frameId,
                    x,
                    y,
                    width: size,
                    height: size,
                    fill: bgColor,
                    stroke: fgColor,
                    strokeWidth: 2,
                    rx: 4,
                    ry: 4,
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                });

                // 3 corner finder patterns: TL, TR, BL
                const corners = [
                    { cx: x + pad, cy: y + pad },
                    { cx: x + size - pad - finderSize, cy: y + pad },
                    { cx: x + pad, cy: y + size - pad - finderSize },
                ];
                corners.forEach(({ cx, cy }) => {
                    const outerId = freshId("rect");
                    const innerId = freshId("rect");
                    const coreId = freshId("rect");
                    cornerIds.push(outerId);
                    const innerOff = Math.round((finderSize - innerSize) / 2);
                    const coreOff = Math.round((finderSize - coreSize) / 2);
                    elems.push({
                        type: "rect",
                        id: outerId,
                        x: cx,
                        y: cy,
                        width: finderSize,
                        height: finderSize,
                        fill: fgColor,
                        stroke: "none",
                        strokeWidth: 0,
                        rx: 2,
                        ry: 2,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    elems.push({
                        type: "rect",
                        id: innerId,
                        x: cx + innerOff,
                        y: cy + innerOff,
                        width: innerSize,
                        height: innerSize,
                        fill: bgColor,
                        stroke: "none",
                        strokeWidth: 0,
                        rx: 1,
                        ry: 1,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                    elems.push({
                        type: "rect",
                        id: coreId,
                        x: cx + coreOff,
                        y: cy + coreOff,
                        width: coreSize,
                        height: coreSize,
                        fill: fgColor,
                        stroke: "none",
                        strokeWidth: 0,
                        rx: 1,
                        ry: 1,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                });

                let labelId;
                const displayLabel = label || url;
                if (displayLabel) {
                    labelId = freshId("text");
                    const maxLabelW = Math.max(
                        size,
                        displayLabel.length * fontSize * 0.6,
                    );
                    elems.push({
                        type: "text",
                        id: labelId,
                        x: x + size / 2,
                        y: y + size + 8,
                        width: maxLabelW,
                        height: fontSize * 1.4,
                        text: displayLabel,
                        fontSize,
                        fontWeight: "normal",
                        fontFamily: resolvedQrFont,
                        textAnchor: "middle",
                        fill: labelColor,
                        stroke: "none",
                        strokeWidth: 0,
                        opacity: 1,
                        visible: true,
                        locked: false,
                        description: "",
                        strokeDash: "solid",
                        strokeLinecap: "butt",
                    });
                }

                addElementsAnimated(elems);
                return {
                    frameId,
                    cornerIds,
                    ...(labelId ? { labelId } : {}),
                    size,
                };
            },

            // ── Font loading ──────────────────────────────────────────────────────
            load_font: async ({ fontFamily, ids = [], applyToAll = false } = {}) => {
                if (!fontFamily) throw new Error("fontFamily is required");
                // Embed the actual font bytes so it survives screenshot/export;
                // fall back to a plain Google <import> if inlining fails.
                let embedded = false;
                try {
                    const dataUrl = await inlineGoogleFont(fontFamily);
                    if (dataUrl) {
                        addFont({
                            type: "custom",
                            name: fontFamily,
                            dataUrl,
                            format: "woff2",
                        });
                        embedded = true;
                    }
                } catch {
                    /* network / CORS — fall through to @import */
                }
                if (!embedded) addFont({ type: "google", name: fontFamily });
                const applyIds = applyToAll
                    ? live().filter((e) => e.type === "text").map((e) => e.id)
                    : ids;
                if (applyIds.length) updateElements(applyIds, { fontFamily });
                try {
                    await document.fonts.load(`20px "${fontFamily}"`);
                } catch {
                    /* font may still be loading; not fatal */
                }
                toast(
                    <span
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <DuotoneIcon svg={ICONS.text} size={18} />
                        <span
                            style={{
                                fontFamily: `"${fontFamily}", sans-serif`,
                                fontSize: 15,
                                fontWeight: 600,
                            }}
                        >
                            {fontFamily}
                        </span>
                    </span>,
                    { duration: 3000, position: "bottom-center" },
                );
                return { loaded: fontFamily, embedded, applied_to: applyIds };
            },

            // ── Canvas resize ─────────────────────────────────────────────────────
            resize_canvas: async ({ width, height, constrain = false } = {}) => {
                if (!width || !height)
                    throw new Error("width and height are required");
                onCanvasResize?.({ width, height });
                if (constrain) {
                    const overflowing = elements.filter((e) => {
                        const w = e.width || 0; const h = e.height || 0;
                        return (e.x || 0) + w > width || (e.y || 0) + h > height || (e.x || 0) < 0 || (e.y || 0) < 0;
                    });
                    for (const el of overflowing) {
                        const nx = Math.min(Math.max(el.x || 0, 0), Math.max(0, width - (el.width || 0)));
                        const ny = Math.min(Math.max(el.y || 0, 0), Math.max(0, height - (el.height || 0)));
                        updateElement(el.id, { x: nx, y: ny });
                    }
                    return { width, height, constrained: overflowing.length };
                }
                return { width, height };
            },

            // ── SVG import ────────────────────────────────────────────────────────
            insert_svg: async ({ svg, placement = "original" } = {}) => {
                if (!svg) throw new Error("SVG markup required");
                const { elements: parsed } = parseSVGToElements(svg);
                if (!parsed || parsed.length === 0) {
                    const hasRoot = /<svg[\s>]/i.test(svg);
                    throw new Error(
                        !hasRoot
                            ? 'SVG parsing produced no elements. The input has no <svg> root element. ' +
                              'Wrap your markup in: <svg xmlns="http://www.w3.org/2000/svg" width="W" height="H">...</svg>'
                            : "SVG parsing produced no elements. Ensure the <svg> contains supported shapes: " +
                              "rect, circle, ellipse, line, polyline, polygon, path, text, image. " +
                              "Check that fill/stroke attributes are set — shapes with no visible attributes may be silently skipped.",
                    );
                }
                const prepared = prepareImportedElements(
                    parsed,
                    placement === "center" ? "center" : "original",
                );
                const ids = addPreparedElements(prepared, { selectNew: true });
                return { addedIds: ids, count: ids.length };
            },
            // MERGES into the existing defs by default (adding/replacing gradients
            // by id). Pass `{ replace: true }` to wipe and replace everything.
            // Does NOT parse raw SVG markup — use add_gradient / insert_svg for that.
            replace_defs: async ({ defs: d = {}, replace = false } = {}) => {
                if (typeof d === "string") {
                    throw new Error(
                        "replace_defs expects a defs object like " +
                            '{ gradients: [{ id, type, stops }] }, not SVG markup. ' +
                            "Use add_gradient for gradients or insert_svg for markup.",
                    );
                }
                const incomingGradients = Array.isArray(d.gradients)
                    ? d.gradients.map(normalizeGradientInput)
                    : [];
                if (replace) {
                    setDefsFromImport({ ...d, gradients: incomingGradients });
                    return { ok: true, replaced: true, gradients: incomingGradients.map((g) => g.id) };
                }
                const byId = new Map((defs.gradients || []).map((g) => [g.id, g]));
                for (const g of incomingGradients) byId.set(g.id, g);
                setDefsFromImport({
                    ...defs,
                    gradients: [...byId.values()],
                    variables: [
                        ...(defs.variables || []),
                        ...(Array.isArray(d.variables) ? d.variables : []),
                    ],
                });
                return { ok: true, merged: true, gradients: incomingGradients.map((g) => g.id) };
            },

            // ── Gradients ─────────────────────────────────────────────────────────
            add_gradient: async (spec = {}) => {
                const grad = normalizeGradientInput(spec);
                if (grad.stops.length < 2) {
                    throw new Error(
                        "add_gradient needs at least 2 stops, e.g. " +
                            '{ type:"linear", stops:[{offset:0,stopColor:"#000"},{offset:100,stopColor:"#fff"}] }',
                    );
                }
                addGradient(grad);
                return { id: grad.id, fill: `url(#${grad.id})` };
            },
            list_gradients: async () => ({
                gradients: (defs.gradients || []).map((g) => ({
                    id: g.id,
                    type: g.type,
                    fill: `url(#${g.id})`,
                    stops: g.stops,
                })),
            }),

            // ── Agent guidance / coordination ────────────────────────────────────
            get_editor_guide: async ({ topic } = {}) => ({
                topic: topic || "overview",
                guide: EDITOR_GUIDE,
            }),

            lock_canvas: async ({ reason } = {}) => {
                const r = String(reason || "").trim() || null;
                setAgentLock({ locked: true, reason: r });
                return { locked: true, reason: r };
            },

            unlock_canvas: async () => {
                setAgentLock({ locked: false, reason: null });
                return { locked: false };
            },

            ask_canvas_question: async ({
                question,
                options = [],
                allowCustom = true,
            } = {}) => {
                const q = String(question || "").trim();
                if (!q) throw new Error("question is required");
                // Supersede any question still waiting for an answer.
                if (questionResolverRef.current) {
                    questionResolverRef.current({
                        answer: null,
                        custom: false,
                        cancelled: true,
                    });
                    questionResolverRef.current = null;
                }
                const normOptions = (Array.isArray(options) ? options : [])
                    .map((o) => String(o).trim())
                    .filter(Boolean);
                const { answer, custom, cancelled } = await new Promise(
                    (resolve) => {
                        questionResolverRef.current = resolve;
                        setPendingQuestion({
                            id: makeQuestionId(),
                            question: q,
                            options: normOptions,
                            allowCustom: allowCustom !== false,
                        });
                    },
                );
                if (cancelled || answer == null) {
                    return { answered: false, cancelled: true };
                }
                return { answered: true, answer, custom: Boolean(custom) };
            },

            set_agent_identity: async ({ name, avatar } = {}) => {
                const nm = String(name || "").trim().slice(0, 40) || null;
                const av = String(avatar || "").trim() || null;
                if (av && !/^(https?:\/\/|data:image\/)/i.test(av)) {
                    throw new Error(
                        "avatar must be an https URL or a data:image/... base64 URI",
                    );
                }
                setAgentIdentity({ name: nm, avatar: av });
                return { name: nm, avatar: av ? "set" : null };
            },

            // ── Template metadata ─────────────────────────────────────────────────
            set_template_name: async ({ name } = {}) => {
                if (!name?.trim()) throw new Error("name is required");
                onNameChange?.(name.trim());
                return { name: name.trim() };
            },
        };

        // Alias with "editor." prefix too
        const aliased = {};
        for (const [k, v] of Object.entries(h)) aliased[`editor.${k}`] = v;
        return { ...h, ...aliased };
    }, [
        addElement,
        addFont,
        addGradient,
        addPreparedElements,
        bringForward,
        canUndo,
        canRedo,
        canvasSize,
        captureCanvasScreenshot,
        captureElementScreenshot,
        captureRegionScreenshot,
        collectionItems,
        defs,
        deleteElements,
        elements,
        elementsRef,
        groups,
        onCanvasResize,
        onNameChange,
        prepareImportedElements,
        redo,
        selectedId,
        selectedIds,
        sendBackward,
        setDefsFromImport,
        setPrimarySelectedId,
        setSelectedIds,
        undo,
        uploadScreenshotResult,
        updateElement,
        updateElements,
        scheduleFlip,
        scheduleFadeIn,
        scheduleFlipBatch,
    ]);

    const agentRef = useEditorAgent({
        getEditorContext: buildEditorContext,
        clientToolHandlers,
        enabled: !isGuest,
    });

    // Expose every tool Ola uses to external AI agents via the WebMCP API.
    useWebMCP(clientToolHandlers, { onEvent: handleMcpEvent });
    const { agentCursor } = agentRef;

    // ── Typewriter status for Ola overlay ─────────────────────────────────────
    const BASE_STATUS = "Ola is working…";
    const [thinkDisplayText, setThinkDisplayText] = useState(BASE_STATUS);
    const [isTypingThought, setIsTypingThought] = useState(false);
    const thinkTimerRef = useRef(null);
    const thinkPhaseRef = useRef("base"); // "base" | "typing-thought" | "typing-back"

    useEffect(() => {
        function clearThinkTimer() {
            if (thinkTimerRef.current) {
                clearTimeout(thinkTimerRef.current);
                thinkTimerRef.current = null;
            }
        }

        function typeString(str, onDone, speed = 28, showCursor = false) {
            let i = 0;
            setThinkDisplayText("");
            setIsTypingThought(showCursor);
            function step() {
                i++;
                setThinkDisplayText(str.slice(0, i));
                if (i < str.length) {
                    thinkTimerRef.current = setTimeout(step, speed);
                } else {
                    thinkTimerRef.current = null;
                    setIsTypingThought(false);
                    onDone?.();
                }
            }
            thinkTimerRef.current = setTimeout(step, 50);
        }

        if (!agentCursor.thought) {
            // Thought was cleared — only reset if we're already back at base
            // (i.e. no cycle is running). If we're holding or typing back, let
            // it finish naturally — DO NOT cancel the hold timer here.
            if (thinkPhaseRef.current === "base") {
                setThinkDisplayText(BASE_STATUS);
                setIsTypingThought(false);
            }
            return;
        }

        // New thought arrived — cancel whatever was running and start fresh
        clearThinkTimer();
        thinkPhaseRef.current = "typing-thought";
        typeString(agentCursor.thought, () => {
            // Thought fully typed — hold for 5s then type back base text
            thinkTimerRef.current = setTimeout(() => {
                thinkPhaseRef.current = "typing-back";
                typeString(BASE_STATUS, () => {
                    thinkPhaseRef.current = "base";
                }, 35, false);
            }, 5000);
        }, 28, true);
        // No cleanup returned intentionally: we must NOT cancel the 5s hold
        // when agentCursor.thought goes null after this. The cycle runs to
        // completion on its own. clearThinkTimer is only called above when a
        // *new* thought interrupts an in-progress one.
    }, [agentCursor.thought]);

    const lastToastRef = useRef(0);
    const handleOverlayClick = useCallback(() => {
        const now = Date.now();
        if (now - lastToastRef.current < 10000) return;
        lastToastRef.current = now;
        toast("Ola is working — please wait for it to finish.", {
            id: "ai-working-toast",
            duration: 10000,
            position: "bottom-center",
        });
    }, []);

    // ── Paste from clipboard ────────────────────────────────────────────────────
    useEffect(() => {
        async function onPaste(e) {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
                return;

            // Image file paste
            const items = Array.from(e.clipboardData?.items || []);
            const imageItem = items.find((it) => it.type.startsWith("image/"));
            if (imageItem) {
                e.preventDefault();
                const blob = imageItem.getAsFile();
                if (blob) {
                    try {
                        const url = await uploadImageToStore(
                            blob,
                            `paste.${blob.type.split("/")[1] || "png"}`,
                        );
                        if (url) {
                            syncCounter(elements);
                            const id = freshId("image");
                            const w = 300,
                                h = 200;
                            addElement({
                                type: "image",
                                id,
                                x: Math.round(canvasSize.width / 2 - w / 2),
                                y: Math.round(canvasSize.height / 2 - h / 2),
                                width: w,
                                height: h,
                                href: url,
                                fill: "#cbd5e1",
                                stroke: "none",
                                strokeWidth: 0,
                                strokeDash: "solid",
                                strokeLinecap: "butt",
                                opacity: 1,
                                visible: true,
                                locked: false,
                                description: "",
                            });
                        }
                    } catch {}
                }
                return;
            }

            const text = e.clipboardData?.getData("text");
            if (!text) return;

            // SVG paste
            if (
                text.trim().startsWith("<svg") ||
                text.trim().startsWith("<?xml")
            ) {
                e.preventDefault();
                handlePasteSVG(text);
                return;
            }

            // Plain text → create text element
            if (text.trim()) {
                e.preventDefault();
                syncCounter(elements);
                const id = freshId("text");
                const fontSize = 24;
                addElement({
                    type: "text",
                    id,
                    x: Math.round(canvasSize.width / 2 - 100),
                    y: Math.round(canvasSize.height / 2 - fontSize),
                    width: Math.max(text.length * fontSize * 0.6, 80),
                    height: fontSize * 1.4,
                    text,
                    fontSize,
                    fontWeight: "normal",
                    fontFamily: "sans-serif",
                    textAnchor: "start",
                    fill: "#000000",
                    stroke: "none",
                    strokeWidth: 0,
                    strokeDash: "solid",
                    strokeLinecap: "butt",
                    opacity: 1,
                    visible: true,
                    locked: false,
                    description: "",
                });
            }
        }
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, [handlePasteSVG, addElement, canvasSize, elements]);

    // Disable browser right-click
    useEffect(() => {
        const handleCtx = (e) => e.preventDefault();
        document.addEventListener("contextmenu", handleCtx);
        return () => document.removeEventListener("contextmenu", handleCtx);
    }, []);

    // ── Sub-bar button style ──────────────────────────────────────────────────
    const subBtn = (active = false) => ({
        padding: "4px 8px",
        borderRadius: 6,
        background: active ? "var(--accent-dim)" : "var(--bg-raised)",
        border: `1px solid ${active ? "rgba(13,101,217,0.4)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--text-muted)",
        fontSize: 11,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "Syne, sans-serif",
        flexShrink: 0,
        whiteSpace: "nowrap",
    });

    const toolbarGroupStyle = {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 0,
        height: 32,
        flexShrink: 0,
    };

    const toolbarDividerStyle = {
        width: 1,
        height: 18,
        background: "var(--border)",
        flexShrink: 0,
    };

    const circleSubBtn = (active = false) => ({
        ...subBtn(active),
        width: 24,
        height: 24,
        padding: 0,
        borderRadius: "50%",
        justifyContent: "center",
        fontSize: 13,
        lineHeight: 1,
    });

    const saveStateLabel =
        saveState.status === "saving"
            ? "Saving draft…"
            : saveState.status === "error"
              ? "Save failed"
              : saveState.updatedAt
                ? `Saved ${new Date(saveState.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Not saved yet";

    return (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <EditorToolbar
                activeTool={activeTool}
                setActiveTool={handleSetActiveTool}
                elements={elements}
                selectedId={selectedId}
                selectedIds={selectedIds}
                setSelectedId={setSelectedId}
                setSelectedIds={setSelectedIds}
                toggleSelectedId={toggleSelectedId}
                updateElement={updateElement}
                updateElements={updateElements}
                deleteElements={deleteElements}
                bringForward={bringForward}
                sendBackward={sendBackward}
                alignElement={alignElement}
                reorderElement={reorderElement}
                canvasSize={canvasSize}
                canUndo={canUndo}
                canRedo={canRedo}
                undo={undo}
                redo={redo}
                bindings={bindings}
                onOpenKeymap={() => setShowKeymap(true)}
                onDuplicate={duplicateElements}
                onSaveToCollection={handleSaveToCollection}
                onOpenCollection={() => setShowCollection(true)}
                onTextEdit={(id) => canvasCtrl.current.textEdit?.(id)}
                addElement={addElement}
                collectionItems={collectionItems}
                groups={groups}
                makeGroup={makeGroupUI}
                dissolveGroup={dissolveGroupUI}
                renameGroup={renameGroupUI}
            />

            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                {/* Sub-toolbar */}
                <div
                    style={{
                        height: 40,
                        padding: "0 10px",
                        background: "var(--bg-surface)",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                        overflowX: "auto",
                        overflowY: "hidden",
                        scrollbarWidth: "thin",
                    }}
                >
                    {/* Canvas size — click to resize */}
                    <button
                        onClick={() => setShowResizePicker(true)}
                        title="Resize canvas"
                        style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            fontFamily: "DM Mono, monospace",
                            flexShrink: 0,
                            marginRight: 4,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px 4px",
                            borderRadius: 4,
                            transition: "color 0.1s, background 0.1s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none"; }}
                    >
                        {effectiveCanvasSize.width}×{effectiveCanvasSize.height}
                    </button>
                    <div
                        style={{
                            width: 1,
                            height: 14,
                            background: "var(--border)",
                            flexShrink: 0,
                        }}
                    />

                    {/* Hint text */}
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            minWidth: 0,
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flexShrink: 1,
                        }}
                    >
                        {activeTool === "eyedropper"
                            ? "Click element to copy fill · Shift+click for stroke · Esc to cancel"
                            : activeTool === "select"
                              ? selectedIds.length > 1
                                  ? `${selectedIds.length} elements selected · Drag to move · Click element to select · Shift+click to add/remove`
                                  : selectedId
                                    ? `${selectedId}`
                                    : "Select · Drag to select · Shift+click to add/remove"
                              : `Click canvas to place ${activeTool}`}
                    </span>
                    <div style={{ flex: 1 }} />

                    <div style={toolbarGroupStyle}>
                        <button
                            onClick={() => setSnapEnabled((s) => !s)}
                            style={subBtn(snapEnabled)}
                            title="Snap to 8px grid"
                        >
                            <DuotoneIcon svg={ICONS.grid} size={12} />
                            Snap
                        </button>

                        <button
                            onClick={() => setShowPasteSVG(true)}
                            style={subBtn()}
                            title="Paste SVG code (Ctrl+V on canvas)"
                        >
                            <DuotoneIcon svg={ICONS.paste} size={12} />
                            Paste
                        </button>

                        <button
                            onClick={() => setShowVariables(true)}
                            style={subBtn()}
                            title="Manage color variables"
                        >
                            <DuotoneIcon svg={ICONS.pencil} size={12} />
                            Vars
                        </button>

                        <button
                            onClick={() => setInspectMode((m) => !m)}
                            style={{
                                ...subBtn(inspectMode),
                                ...(inspectMode
                                    ? {
                                          background: "rgba(59,130,246,0.15)",
                                          border: "1px solid rgba(59,130,246,0.5)",
                                          color: "#60a5fa",
                                      }
                                    : {}),
                            }}
                            title="Inspect Canvas — hover to see element info (Ctrl+I)"
                        >
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                                style={{ flexShrink: 0 }}
                            >
                                <path
                                    d="M1 1l5.5 13 2-5 5-2L1 1z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                                <path
                                    d="M8.5 8.5l4 4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                            Inspect
                        </button>
                    </div>

                    <div style={toolbarDividerStyle} />

                    <div style={toolbarGroupStyle}>
                        <button
                            onClick={() => canvasCtrl.current.zoomOut?.()}
                            style={circleSubBtn()}
                            title="Zoom out (−)"
                        >
                            −
                        </button>

                        <input
                            type="number"
                            min={1}
                            max={3000}
                            step={5}
                            value={zoomDisplay}
                            onChange={(e) =>
                                setZoomDisplay(parseInt(e.target.value) || 1)
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.target.blur();
                                }
                            }}
                            title="Zoom % — press Enter or blur to apply"
                            style={{
                                width: 48,
                                textAlign: "center",
                                background: "var(--bg-raised)",
                                border: "1px solid var(--border)",
                                color: "var(--text-secondary)",
                                borderRadius: 6,
                                padding: "3px 4px",
                                fontSize: 11,
                                fontFamily: "DM Mono, monospace",
                                outline: "none",
                                flexShrink: 0,
                            }}
                            onFocus={(e) =>
                                (e.target.style.borderColor = "var(--accent)")
                            }
                            onBlur={(e) => {
                                e.target.style.borderColor = "var(--border)";
                                handleZoomCommit(e.target.value);
                            }}
                        />
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                marginLeft: -2,
                                flexShrink: 0,
                            }}
                        >
                            %
                        </span>

                        <button
                            onClick={() => canvasCtrl.current.zoomIn?.()}
                            style={circleSubBtn()}
                            title="Zoom in (+)"
                        >
                            +
                        </button>

                        <button
                            onClick={() => canvasCtrl.current.fitViewport?.()}
                            style={subBtn()}
                            title="Fit to screen (0)"
                        >
                            <DuotoneIcon svg={ICONS.fitScreen} size={12} />
                            Fit
                        </button>
                    </div>

                    <div style={toolbarDividerStyle} />

                    <div style={toolbarGroupStyle}>
                        <button
                            onClick={() => setShowKeymap(true)}
                            style={subBtn()}
                            title={`Keyboard shortcuts (${keymapName})`}
                        >
                            <DuotoneIcon svg={ICONS.layers} size={12} />
                            Keys
                        </button>

                        <span
                            style={{
                                fontSize: 10,
                                color:
                                    saveState.status === "error"
                                        ? "var(--red)"
                                        : "var(--text-muted)",
                                minWidth: 84,
                                textAlign: "right",
                                flexShrink: 0,
                            }}
                        >
                            {saveStateLabel}
                        </span>
                    </div>

                    <div style={toolbarDividerStyle} />

                    <div style={toolbarGroupStyle}>
                        <button
                            onClick={() => setIsPublic((value) => !value)}
                            style={subBtn(isPublic)}
                            title="Toggle public visibility for gallery"
                        >
                            <DuotoneIcon svg={ICONS.eye} size={12} />
                            {isPublic ? "Public" : "Private"}
                        </button>

                        <button
                            onClick={handleManualSave}
                            style={subBtn(true)}
                            title="Save named canvas"
                        >
                            <DuotoneIcon svg={ICONS.download} size={12} />
                            Save
                        </button>

                        <div ref={exportMenuRef} style={{ position: "relative" }}>
                            <button
                                onClick={() => setShowExportMenu((v) => !v)}
                                style={subBtn(showExportMenu)}
                                title="Export canvas"
                            >
                                <DuotoneIcon svg={ICONS.download} size={12} />
                                Export
                                <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>▾</span>
                            </button>
                            {showExportMenu && (
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: "calc(100% + 6px)",
                                        right: 0,
                                        minWidth: 140,
                                        padding: 6,
                                        borderRadius: 10,
                                        border: "1px solid rgba(15,23,42,0.1)",
                                        background: "var(--surface)",
                                        boxShadow: "0 8px 24px rgba(15,23,42,0.16)",
                                        zIndex: 200,
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    {[
                                        { label: "Export as SVG", onClick: handleDownloadSVG },
                                        { label: "Export as PNG", onClick: handleDownloadPNG },
                                    ].map(({ label, onClick }) => (
                                        <button
                                            key={label}
                                            onClick={onClick}
                                            style={{
                                                width: "100%",
                                                border: "none",
                                                background: "transparent",
                                                color: "var(--text-secondary)",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                padding: "7px 10px",
                                                fontSize: 12,
                                                fontFamily: "Syne, sans-serif",
                                                textAlign: "left",
                                                cursor: "pointer",
                                                borderRadius: 7,
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "rgba(13,101,217,0.08)";
                                                e.currentTarget.style.color = "var(--accent)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = "transparent";
                                                e.currentTarget.style.color = "var(--text-secondary)";
                                            }}
                                        >
                                            <DuotoneIcon svg={ICONS.download} size={12} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleFinish}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 14px",
                            borderRadius: 7,
                            background: "var(--accent)",
                            border: "none",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "Syne, sans-serif",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                        }}
                    >
                        Map
                        <DuotoneIcon
                            svg={ICONS.check}
                            size={13}
                            style={{ color: "#fff" }}
                        />
                    </button>
                </div>

                {/* Canvas wrapper — position:relative so overlays work */}
                <div
                    style={{
                        flex: 1,
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                    }}
                >
                    <EditorCanvas
                        isWorking={
                            !agentRef.isAgentDone ||
                            agentRef.isThinking ||
                            agentRef.isStreaming
                        }
                        elements={elements}
                        defs={defs}
                        selectedId={selectedId}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                        toggleSelectedId={toggleSelectedId}
                        canvasSize={effectiveCanvasSize}
                        activeTool={activeTool}
                        scaleRef={scaleRef}
                        canvasRef={canvasRef}
                        canvasCtrl={canvasCtrl}
                        onViewportChange={(v) => {
                            setZoomDisplay(Math.round(v.scale * 100));
                            setCanvasViewport({
                                tx: v.tx,
                                ty: v.ty,
                                scale: v.scale,
                            });
                        }}
                        agentHighlightId={
                            agentCursor.visible ? agentCursor.elementId : null
                        }
                        updateElement={updateElement}
                        updateElementLive={updateElementLive}
                        updateElementsLive={updateElementsLive}
                        onElementPointerDown={onElementPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onCanvasPointerDown={onCanvasPointerDown}
                        onMarqueeEnd={(ids) => {
                            setSelectedIds(ids);
                            if (ids.length === 1) setPrimarySelectedId(ids[0]);
                        }}
                        eyedropperActive={activeTool === "eyedropper"}
                        onEyedrop={handleEyedrop}
                        pickerMode={pickerMode}
                        onPick={(id) => {
                            setSelectedId(id);
                            setPickerMode(false);
                            setActiveTool("select");
                        }}
                        onDuplicateSelection={duplicateElements}
                        onDeleteSelection={() => deleteElements(selectedIds)}
                        onToggleLockSelection={toggleSelectionLock}
                        onBringForwardSelection={bringSelectionForward}
                        onSendBackwardSelection={sendSelectionBackward}
                        onToggleVisibilitySelection={toggleSelectionVisibility}
                        onEditTextSelection={editSelectedText}
                        groups={groups}
                        onMakeGroupSelection={makeGroupUI}
                        onDissolveGroupSelection={dissolveGroupUI}
                        inspectMode={inspectMode}
                        animOverrides={animOverrides}
                        onCanvasResizeLive={size => setLiveCanvasSize(size)}
                        onCanvasResizeCommit={size => {
                            onCanvasResize?.(size);
                            setLiveCanvasSize(null);
                        }}
                    />

                    {/* Agent lock overlay — blocks user interaction while AI is working or has locked the canvas */}
                    {(!agentRef.isAgentDone || agentLock.locked) && (
                        <div
                            onClick={handleOverlayClick}
                            style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 60,
                                cursor: "not-allowed",
                                pointerEvents: "all",
                                background: "rgba(0,0,0,0.02)",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 16,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "10px 16px",
                                    borderRadius: 12,
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border)",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                                    color: "var(--text-primary)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: "Syne, sans-serif",
                                    backdropFilter: "blur(10px)",
                                }}
                            >
                                <span
                                    className="ai-spin"
                                    style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: "50%",
                                        border: "2px solid var(--accent-dim)",
                                        borderTopColor: "var(--accent)",
                                    }}
                                />
                                <span
                                    style={{
                                        maxWidth: 360,
                                        whiteSpace: "normal",
                                    }}
                                >
                                    {agentRef.isAgentDone && agentLock.locked
                                        ? agentLock.reason || "Ola locked the canvas while it works…"
                                        : thinkDisplayText}
                                    {isTypingThought && (
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: 2,
                                                height: "0.9em",
                                                background: "var(--accent)",
                                                marginLeft: 2,
                                                verticalAlign: "middle",
                                                animation: "aiCursorBlink 0.8s step-end infinite",
                                            }}
                                        />
                                    )}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Agent cursor overlay */}
                    {agentCursor.visible && agentCursor.elementId && (
                        <AgentCursorOverlay
                            elementId={agentCursor.elementId}
                            thought={agentCursor.thought}
                            phase={agentCursor.phase}
                            elements={elements}
                            canvasViewport={canvasViewport}
                        />
                    )}
                </div>
            </div>

            {/* ── Right panel (Properties / AI) with drag-resize ─────────────────── */}
            <div
                style={{
                    width: panelWidth,
                    display: "flex",
                    flexDirection: "row",
                    flexShrink: 0,
                    position: "relative",
                }}
            >
                {/* Drag handle */}
                <div
                    onPointerDown={(e) => {
                        e.preventDefault();
                        panelDragRef.current = {
                            startX: e.clientX,
                            startW: panelWidth,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    style={{
                        width: 5,
                        cursor: "col-resize",
                        background: "transparent",
                        flexShrink: 0,
                        borderLeft: "1px solid var(--border)",
                        transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                            "rgba(13,101,217,0.3)")
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                    }
                />
                {/* Panel content */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        background: "var(--bg-surface)",
                    }}
                >
                    {/* Tab bar */}
                    <div
                        style={{
                            display: "flex",
                            gap: 2,
                            padding: "5px 8px",
                            borderBottom: "1px solid var(--border)",
                            flexShrink: 0,
                            background: "var(--bg-surface)",
                        }}
                    >
                        {[
                            {
                                key: "properties",
                                icon: ICONS.layers,
                                label: "Properties",
                            },
                            ...(isGuest
                                ? []
                                : [
                                      {
                                          key: "ai",
                                          icon: ICONS.ai,
                                          label: "Ola",
                                          indicator: agentCursor.visible,
                                      },
                                  ]),
                            {
                                key: "activity",
                                icon: ICONS.ai,
                                label: agentIdentity.name || "Activity",
                                indicator:
                                    activeDock !== "activity" &&
                                    mcpEvents.some((e) => e.status === "running"),
                            },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveDock(tab.key)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    border: "none",
                                    background:
                                        activeDock === tab.key
                                            ? "var(--accent-dim)"
                                            : "transparent",
                                    color:
                                        activeDock === tab.key
                                            ? "var(--accent)"
                                            : "var(--text-muted)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "Syne, sans-serif",
                                    position: "relative",
                                    transition: "background 0.1s, color 0.1s",
                                }}
                                onMouseEnter={(e) => {
                                    if (activeDock !== tab.key)
                                        e.currentTarget.style.color =
                                            "var(--text-secondary)";
                                }}
                                onMouseLeave={(e) => {
                                    if (activeDock !== tab.key)
                                        e.currentTarget.style.color =
                                            "var(--text-muted)";
                                }}
                            >
                                <DuotoneIcon svg={tab.icon} size={12} />
                                {tab.label}
                                {tab.indicator && (
                                    <span
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: "50%",
                                            background: "#fb923c",
                                            position: "absolute",
                                            top: 2,
                                            right: 2,
                                            animation: "aiPulse 1.2s infinite",
                                        }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                    {/* Panel body */}
                    <div
                        style={{
                            flex: 1,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {activeDock === "activity" ? (
                            <WebMcpActivityPanel
                                identity={agentIdentity}
                                events={mcpEvents}
                                onClear={() => setMcpEvents([])}
                            />
                        ) : !isGuest && activeDock === "ai" ? (
                            <EditorAiChat agent={agentRef} />
                        ) : (
                            <EditorPropertiesPanel
                                elements={elements}
                                selectedId={selectedId}
                                selectedIds={selectedIds}
                                updateElement={updateElement}
                                updateElements={updateElements}
                                deleteElements={deleteElements}
                                defs={defs}
                                onAddGradient={addGradient}
                                onAddKeyframe={addKeyframe}
                                onAddFont={addFont}
                                onRemoveFont={removeFont}
                                onOpenCodeEditor={(el) =>
                                    setCodeEditElement(el)
                                }
                                onMakeGroup={makeGroupUI}
                            />
                        )}
                    </div>
                </div>
            </div>

            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                elements={elements}
                onSelectElement={handlePaletteSelectElement}
                onActivateTool={handleSetActiveTool}
                onInsertIcon={handlePaletteInsertIcon}
                canvasSize={canvasSize}
            />

            {showKeymap && (
                <KeymapSettings
                    bindings={bindings}
                    keymapName={keymapName}
                    onImport={importKeymap}
                    onReset={resetToDefault}
                    onClose={() => setShowKeymap(false)}
                />
            )}

            {showCollection && (
                <CollectionModal
                    items={collectionItems}
                    loading={collectionsLoading}
                    onInsert={handleInsertFromCollection}
                    onDelete={handleDeleteCollectionItem}
                    onClose={() => setShowCollection(false)}
                />
            )}

            {showPasteSVG && (
                <PasteSVGModal
                    onAdd={handlePasteSVG}
                    onClose={() => setShowPasteSVG(false)}
                />
            )}

            {showVariables && (
                <VariablesPanel
                    variables={defs.variables}
                    onAdd={addVariable}
                    onUpdate={updateVariable}
                    onRemove={removeVariable}
                    onClose={() => setShowVariables(false)}
                />
            )}

            {showResizePicker && (
                <CanvasSizePicker
                    resizeMode
                    currentSize={canvasSize}
                    onPreview={size => setLiveCanvasSize(size)}
                    onClose={() => {
                        setLiveCanvasSize(null);
                        setShowResizePicker(false);
                    }}
                    onCreate={size => {
                        onCanvasResize?.(size);
                        setLiveCanvasSize(null);
                        setShowResizePicker(false);
                    }}
                />
            )}

            {codeEditElement && (
                <CodeEditor
                    element={codeEditElement}
                    onSave={({ rawStyle, rawAttrs, props }) => {
                        updateElement(codeEditElement.id, {
                            rawStyle,
                            rawAttrs,
                            ...(props || {}),
                        });
                        setCodeEditElement(null);
                    }}
                    onClose={() => setCodeEditElement(null)}
                />
            )}

            {pendingQuestion && (
                <AgentQuestionModal
                    key={pendingQuestion.id}
                    question={pendingQuestion.question}
                    options={pendingQuestion.options}
                    allowCustom={pendingQuestion.allowCustom}
                    onAnswer={(answer, custom) => answerPendingQuestion(answer, custom)}
                    onDismiss={() => answerPendingQuestion(null)}
                />
            )}
        </div>
    );
}

function AgentQuestionModal({ question, options, allowCustom, onAnswer, onDismiss }) {
    const [custom, setCustom] = useState("");
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 300,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(2px)",
            }}
            onClick={onDismiss}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 420,
                    maxWidth: "90vw",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                    padding: 20,
                    fontFamily: "Syne, sans-serif",
                }}
            >
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                        marginBottom: 8,
                    }}
                >
                    Ola has a question
                </div>
                <div
                    style={{
                        fontSize: 14,
                        color: "var(--text-primary)",
                        lineHeight: 1.5,
                        marginBottom: 16,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {question}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {options.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => onAnswer(opt, false)}
                            style={{
                                textAlign: "left",
                                padding: "9px 12px",
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                background: "var(--bg-raised)",
                                color: "var(--text-primary)",
                                fontSize: 13,
                                cursor: "pointer",
                                fontFamily: "Syne, sans-serif",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--accent)";
                                e.currentTarget.style.color = "var(--accent)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--border)";
                                e.currentTarget.style.color = "var(--text-primary)";
                            }}
                        >
                            {opt}
                        </button>
                    ))}
                </div>

                {allowCustom && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const v = custom.trim();
                            if (v) onAnswer(v, true);
                        }}
                        style={{ display: "flex", gap: 6, marginTop: options.length ? 12 : 0 }}
                    >
                        <input
                            autoFocus
                            value={custom}
                            onChange={(e) => setCustom(e.target.value)}
                            placeholder={options.length ? "Or type your own answer…" : "Type your answer…"}
                            style={{
                                flex: 1,
                                background: "var(--bg-raised)",
                                border: "1px solid var(--border)",
                                color: "var(--text-primary)",
                                borderRadius: 8,
                                padding: "9px 12px",
                                fontSize: 13,
                                fontFamily: "Syne, sans-serif",
                                outline: "none",
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!custom.trim()}
                            style={{
                                padding: "9px 14px",
                                borderRadius: 8,
                                border: "none",
                                background: custom.trim() ? "var(--accent)" : "var(--bg-raised)",
                                color: custom.trim() ? "#fff" : "var(--text-muted)",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: custom.trim() ? "pointer" : "not-allowed",
                                fontFamily: "Syne, sans-serif",
                            }}
                        >
                            Send
                        </button>
                    </form>
                )}

                <button
                    onClick={onDismiss}
                    style={{
                        marginTop: 14,
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "Syne, sans-serif",
                    }}
                >
                    Dismiss (skip this question)
                </button>
            </div>
        </div>
    );
}

function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "AI";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function summarizeArgs(args) {
    if (!args || typeof args !== "object") return "";
    const pick = ["id", "ids", "name", "type", "text", "reason", "question", "fill", "fontFamily"];
    for (const k of pick) {
        if (args[k] != null) {
            const v = Array.isArray(args[k]) ? `${args[k].length} item(s)` : String(args[k]);
            return `${k}: ${v.length > 40 ? v.slice(0, 39) + "…" : v}`;
        }
    }
    const keys = Object.keys(args);
    return keys.length ? `${keys.length} arg(s)` : "";
}

function WebMcpActivityPanel({ identity, events, onClear }) {
    const scrollRef = useRef(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [events.length]);

    const name = identity?.name || "Connected agent";

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-surface)" }}>
            {/* Identity header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderBottom: "1px solid var(--border)",
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "Syne, sans-serif",
                    }}
                >
                    {identity?.avatar ? (
                        <img
                            src={identity.avatar}
                            alt={name}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                    ) : (
                        initialsOf(identity?.name)
                    )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            fontFamily: "Syne, sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "DM Mono, monospace" }}>
                        {events.length ? `${events.length} tool call${events.length === 1 ? "" : "s"}` : "waiting for tool calls…"}
                    </div>
                </div>
                {events.length > 0 && (
                    <button
                        onClick={onClear}
                        style={{
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            color: "var(--text-muted)",
                            fontSize: 10,
                            padding: "3px 8px",
                            cursor: "pointer",
                            fontFamily: "Syne, sans-serif",
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Event feed */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                {events.length === 0 ? (
                    <div
                        style={{
                            marginTop: 40,
                            textAlign: "center",
                            color: "var(--text-muted)",
                            fontSize: 12,
                            fontFamily: "Syne, sans-serif",
                            padding: "0 20px",
                            lineHeight: 1.6,
                        }}
                    >
                        Tool calls from AI agents connected to this page (via WebMCP)
                        appear here as they happen.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {events.map((e) => {
                            const dotColor =
                                e.status === "error"
                                    ? "var(--red)"
                                    : e.status === "running"
                                      ? "var(--accent)"
                                      : "var(--green)";
                            const argSummary = summarizeArgs(e.args);
                            return (
                                <div
                                    key={e.id}
                                    className="ai-tool-enter"
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 8,
                                        padding: "6px 8px",
                                        borderRadius: 7,
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-raised)",
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: "50%",
                                            marginTop: 4,
                                            flexShrink: 0,
                                            background: dotColor,
                                            animation:
                                                e.status === "running"
                                                    ? "aiPulse 1.2s infinite"
                                                    : "none",
                                        }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--text-primary)",
                                                fontFamily: "Syne, sans-serif",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {getToolLabel(e.name)}
                                            {e.status === "running" ? "…" : ""}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: "var(--text-muted)",
                                                fontFamily: "DM Mono, monospace",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {e.name}
                                            {argSummary ? ` · ${argSummary}` : ""}
                                        </div>
                                        {e.status === "error" && e.error && (
                                            <div style={{ fontSize: 10, color: "var(--red)", marginTop: 2 }}>
                                                {String(e.error).slice(0, 120)}
                                            </div>
                                        )}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: "var(--text-muted)",
                                            fontFamily: "DM Mono, monospace",
                                            flexShrink: 0,
                                            marginTop: 3,
                                        }}
                                    >
                                        {new Date(e.at).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
