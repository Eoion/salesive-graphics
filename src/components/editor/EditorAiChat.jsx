import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import DuotoneIcon from "../DuotoneIcon.jsx";
import { ICONS } from "../../editor/duotoneIcons.js";
import { getToolLabel } from "../../editor/toolLabels.js";

// ─── Image upload ────────────────────────────────────────────────────────────
export async function uploadImageToStore(fileOrBlob, filename = "image.png") {
    const formData = new FormData();
    formData.append("image", fileOrBlob, filename);
    const res = await fetch(
        "https://store.salesive.com/api/v1/image/upload?public=true",
        {
            method: "POST",
            body: formData,
        },
    );
    if (!res.ok) throw new Error(`Upload failed ${res.status}`);
    const data = await res.json();
    return data.url || data.data?.url || null;
}

const OLA_AVATAR_URL =
    "https://res.cloudinary.com/computer-geek/image/upload/q_auto/f_auto/v1775964817/Salesive/ola_xikqga.jpg";

// ─── Image bubble in messages ─────────────────────────────────────────────────
function ImageBubble({ url }) {
    const [lightbox, setLightbox] = useState(false);
    return (
        <>
            <div
                style={{
                    marginTop: 4,
                    borderRadius: 8,
                    overflow: "hidden",
                    maxWidth: 200,
                    cursor: "zoom-in",
                }}
                onClick={() => setLightbox(true)}
            >
                <img
                    src={url}
                    alt="attachment"
                    style={{ width: "100%", display: "block", borderRadius: 8 }}
                />
            </div>
            {lightbox && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(0,0,0,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => setLightbox(false)}
                >
                    <img
                        src={url}
                        alt="attachment"
                        style={{
                            maxWidth: "90vw",
                            maxHeight: "90vh",
                            borderRadius: 8,
                        }}
                    />
                    <button
                        onClick={() => setLightbox(false)}
                        style={{
                            position: "absolute",
                            top: 20,
                            right: 20,
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            fontSize: 18,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
}

// ─── Markdown table renderer ──────────────────────────────────────────────
function AiTable({ lines }) {
    if (!lines || lines.length < 2) return null;

    const parseRow = (line) => {
        return line
            .split("|")
            .filter((_, i, a) => i > 0 && i < a.length - 1)
            .map((cell) => cell.trim());
    };

    const header = parseRow(lines[0]);
    const body = lines.slice(2).map(parseRow);

    return (
        <div
            style={{
                overflowX: "auto",
                margin: "8px 0",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--bg-surface)",
            }}
        >
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                }}
            >
                <thead>
                    <tr
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            borderBottom: "1px solid var(--border)",
                        }}
                    >
                        {header.map((col, i) => (
                            <th
                                key={i}
                                style={{
                                    padding: "8px 10px",
                                    textAlign: "left",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    borderRight:
                                        i === header.length - 1
                                            ? "none"
                                            : "1px solid var(--border-dim)",
                                }}
                            >
                                {processInline(col)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            style={{
                                borderBottom:
                                    rowIndex === body.length - 1
                                        ? "none"
                                        : "1px solid var(--border-dim)",
                                background:
                                    rowIndex % 2 === 0
                                        ? "transparent"
                                        : "rgba(255,255,255,0.01)",
                            }}
                        >
                            {row.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    style={{
                                        padding: "8px 10px",
                                        borderRight:
                                            cellIndex === row.length - 1
                                                ? "none"
                                                : "1px solid var(--border-dim)",
                                    }}
                                >
                                    {processInline(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Simple markdown renderer ────────────────────────────────────────────────
function processInline(text) {
    if (typeof text !== "string") return text;
    const parts = [];
    const re =
        /(!\[(.*?)\]\((.*?)\))|(\[(.*?)\]\((.*?)\))|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)/g;
    let last = 0,
        m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));

        if (m[1]) {
            // Image ![alt](url)
            parts.push(<ImageBubble key={m.index} url={m[3]} />);
        } else if (m[4]) {
            // Link [text](url)
            parts.push(
                <a
                    key={m.index}
                    href={m[6]}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        color: "var(--accent)",
                        textDecoration: "none",
                        fontWeight: 600,
                        borderBottom: "1px solid rgba(13,101,217,0.3)",
                        transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.borderBottomColor =
                            "var(--accent)")
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.borderBottomColor =
                            "rgba(13,101,217,0.3)")
                    }
                >
                    {m[5]}
                </a>,
            );
        } else if (m[7]) {
            // Bold **text**
            parts.push(
                <strong
                    key={m.index}
                    style={{ fontWeight: 600, color: "var(--text-primary)" }}
                >
                    {m[8]}
                </strong>,
            );
        } else if (m[9]) {
            // Italic *text*
            parts.push(
                <em
                    key={m.index}
                    style={{ fontStyle: "italic", color: "var(--text-muted)" }}
                >
                    {m[10]}
                </em>,
            );
        } else if (m[11]) {
            // Inline code `text`
            parts.push(
                <code
                    key={m.index}
                    style={{
                        background: "rgba(0,0,0,0.4)",
                        borderRadius: 3,
                        padding: "1px 5px",
                        fontSize: "0.9em",
                        fontFamily: "DM Mono, monospace",
                        color: "#7dd3fc",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                    }}
                >
                    {m[12]}
                </code>,
            );
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 0 ? [] : parts;
}

function AiMarkdown({ content, isStreaming }) {
    if (!content)
        return isStreaming ? <span className="ai-streaming-cursor" /> : null;
    const lines = content.split("\n");
    const result = [];
    let codeLines = [],
        inCode = false,
        tableLines = [],
        inTable = false,
        key = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("```")) {
            if (inCode) {
                result.push(
                    <pre
                        key={key++}
                        style={{
                            background: "rgba(0,0,0,0.45)",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 11,
                            fontFamily: "DM Mono, monospace",
                            overflowX: "auto",
                            margin: "4px 0",
                            border: "1px solid var(--border)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            lineHeight: 1.5,
                        }}
                    >
                        <code style={{ color: "#7dd3fc" }}>
                            {codeLines.join("\n")}
                        </code>
                    </pre>,
                );
                codeLines = [];
                inCode = false;
            } else {
                inCode = true;
            }
            continue;
        }

        if (inCode) {
            codeLines.push(line);
            continue;
        }

        // Table detection
        const isTableLine =
            line.trim().startsWith("|") && line.trim().endsWith("|");
        if (isTableLine) {
            inTable = true;
            tableLines.push(line);
            continue;
        } else if (inTable) {
            if (tableLines.length >= 2) {
                result.push(<AiTable key={key++} lines={tableLines} />);
            } else if (tableLines.length === 1) {
                result.push(
                    <div key={key++} style={{ lineHeight: 1.55 }}>
                        {processInline(tableLines[0])}
                    </div>,
                );
            }
            tableLines = [];
            inTable = false;
        }

        if (line.match(/^#{1,3}\s/)) {
            const t = line.replace(/^#{1,3}\s/, "");
            result.push(
                <div
                    key={key++}
                    style={{
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        margin: "6px 0 2px",
                        fontSize: 12,
                    }}
                >
                    {processInline(t)}
                </div>,
            );
        } else if (line.match(/^[-*]\s/)) {
            result.push(
                <div
                    key={key++}
                    style={{ display: "flex", gap: 6, marginTop: 2 }}
                >
                    <span
                        style={{
                            color: "var(--accent)",
                            flexShrink: 0,
                            marginTop: 1,
                        }}
                    >
                        •
                    </span>
                    <span>{processInline(line.slice(2))}</span>
                </div>,
            );
        } else if (line.match(/^\d+\.\s/)) {
            const [, n, rest] = line.match(/^(\d+)\.\s(.*)/) || [];
            result.push(
                <div
                    key={key++}
                    style={{ display: "flex", gap: 6, marginTop: 2 }}
                >
                    <span
                        style={{
                            color: "var(--accent)",
                            flexShrink: 0,
                            minWidth: 16,
                        }}
                    >
                        {n}.
                    </span>
                    <span>{processInline(rest || "")}</span>
                </div>,
            );
        } else if (line.trim() === "") {
            result.push(<div key={key++} style={{ height: 5 }} />);
        } else {
            result.push(
                <div
                    key={key++}
                    style={{
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                    }}
                >
                    {processInline(line)}
                </div>,
            );
        }
    }

    if (inTable && tableLines.length >= 2) {
        result.push(<AiTable key={key++} lines={tableLines} />);
    }

    return (
        <div
            style={{
                fontSize: 12.5,
                color: "var(--text-secondary)",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
            }}
        >
            {result}
            {isStreaming && <span className="ai-streaming-cursor" />}
        </div>
    );
}

// ─── Thinking indicator ───────────────────────────────────────────────────────
function ThinkingDots({ label = "Thinking" }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 0",
            }}
        >
            <div style={{ display: "flex", gap: 3 }}>
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            display: "inline-block",
                            animation: `aiPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
                        }}
                    />
                ))}
            </div>
            <span
                style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                }}
            >
                {label}
            </span>
        </div>
    );
}

// ─── Tool call card ───────────────────────────────────────────────────────────
function ToolCallCard({ tool, args, status, result, isClientTool }) {
    const [expanded, setExpanded] = useState(false);
    const label = getToolLabel(tool);
    const screenshotUrl =
        status === "done" &&
        (tool === "take_screenshot" || tool === "get_canvas_screenshot")
            ? typeof result === "string"
                ? result
                : result?.url
            : null;
    const isImg = Boolean(
        screenshotUrl &&
        (screenshotUrl.startsWith("http") || screenshotUrl.startsWith("/")),
    );
    const resultStr = result
        ? typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2)
        : null;

    const bgColor =
        status === "error"
            ? "rgba(220,38,38,0.08)"
            : status === "done"
              ? "rgba(255,255,255,0.03)"
              : "rgba(13,101,217,0.06)";
    const borderColor =
        status === "error"
            ? "rgba(220,38,38,0.25)"
            : status === "done"
              ? "var(--border)"
              : "rgba(13,101,217,0.2)";

    return (
        <div className="ai-tool-enter" style={{ marginBottom: 3 }}>
            <button
                onClick={() =>
                    status === "done" && resultStr && setExpanded((v) => !v)
                }
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    width: "100%",
                    textAlign: "left",
                    padding: "5px 9px",
                    borderRadius: 8,
                    border: `1px solid ${borderColor}`,
                    background: bgColor,
                    cursor:
                        status === "done" && resultStr ? "pointer" : "default",
                    transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                    if (status === "done" && resultStr)
                        e.currentTarget.style.background =
                            "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = bgColor;
                }}
            >
                {/* Status icon */}
                <span
                    style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    {status === "running" ? (
                        <span
                            style={{
                                width: 13,
                                height: 13,
                                borderRadius: "50%",
                                border: "1.5px solid var(--border-strong)",
                                borderTopColor: "var(--accent)",
                                display: "inline-block",
                            }}
                            className="ai-spin"
                        />
                    ) : status === "done" ? (
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 14 14"
                            fill="none"
                        >
                            <circle
                                cx="7"
                                cy="7"
                                r="6"
                                stroke="#34d399"
                                strokeWidth="1.5"
                            />
                            <path
                                d="M4.5 7l2 2 3-3"
                                stroke="#34d399"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ) : (
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 14 14"
                            fill="none"
                        >
                            <circle
                                cx="7"
                                cy="7"
                                r="6"
                                stroke="#f87171"
                                strokeWidth="1.5"
                            />
                            <path
                                d="M5 5l4 4M9 5l-4 4"
                                stroke="#f87171"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    )}
                </span>
                <span
                    style={{
                        fontSize: 11,
                        color:
                            status === "error"
                                ? "#f87171"
                                : "var(--text-secondary)",
                        fontFamily: "Syne, sans-serif",
                        fontWeight: 500,
                        flex: 1,
                    }}
                >
                    {status === "running" ? `${label}…` : label}
                    {tool === "agent_thought" && args?.message && (
                        <span
                            style={{
                                display: "block",
                                fontSize: 10.5,
                                color: "var(--text-secondary)",
                                fontStyle: "italic",
                                fontWeight: 400,
                                marginTop: 1,
                                opacity: 0.85,
                            }}
                        >
                            {args.message}
                        </span>
                    )}
                    {isClientTool && status === "running" && (
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                marginLeft: 4,
                            }}
                        >
                            client
                        </span>
                    )}
                </span>
                {status === "done" && resultStr && (
                    <svg
                        width="11"
                        height="11"
                        viewBox="0 0 11 11"
                        fill="none"
                        style={{
                            transition: "transform 0.18s",
                            transform: expanded ? "rotate(180deg)" : "none",
                            color: "var(--text-muted)",
                        }}
                    >
                        <path
                            d="M2 4l3 3 3-3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>
            {/* Expanded result */}
            {expanded && status === "done" && (
                <div
                    style={{
                        overflow: "hidden",
                        transition: "max-height 0.2s ease",
                    }}
                >
                    {isImg ? (
                        <ScreenshotPreview url={screenshotUrl} />
                    ) : (
                        <pre
                            style={{
                                margin: "2px 0 0",
                                padding: "7px 10px",
                                borderRadius: "0 0 8px 8px",
                                background: "rgba(0,0,0,0.3)",
                                border: `1px solid ${borderColor}`,
                                borderTop: "none",
                                fontSize: 10.5,
                                fontFamily: "DM Mono, monospace",
                                color: "var(--text-muted)",
                                maxHeight: 120,
                                overflow: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                            }}
                        >
                            {resultStr.slice(0, 600)}
                            {resultStr.length > 600 ? "…" : ""}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Screenshot preview (expandable) ─────────────────────────────────────────
function ScreenshotPreview({ url }) {
    const [lightbox, setLightbox] = useState(false);
    return (
        <>
            <div
                style={{
                    marginTop: 4,
                    borderRadius: "0 0 8px 8px",
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    borderTop: "none",
                    background: "var(--bg-base)",
                }}
            >
                <img
                    src={url}
                    alt="Screenshot"
                    style={{
                        width: "100%",
                        maxHeight: 160,
                        objectFit: "contain",
                        display: "block",
                        cursor: "zoom-in",
                        background: "rgba(0,0,0,0.3)",
                    }}
                    onClick={() => setLightbox(true)}
                />
            </div>
            {lightbox && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(0,0,0,0.85)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => setLightbox(false)}
                >
                    <img
                        src={url}
                        alt="Screenshot"
                        style={{
                            maxWidth: "90vw",
                            maxHeight: "90vh",
                            borderRadius: 8,
                            boxShadow: "0 0 60px rgba(0,0,0,0.8)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        onClick={() => setLightbox(false)}
                        style={{
                            position: "absolute",
                            top: 20,
                            right: 20,
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            fontSize: 18,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </>
    );
}

// ─── Conversation list panel ──────────────────────────────────────────────────
function ConversationList({
    conversations,
    activeId,
    onSelect,
    onNew,
    onBack,
}) {
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                background: "var(--bg-surface)",
                display: "flex",
                flexDirection: "column",
                animation: "aiSlideIn 0.2s ease-out",
            }}
        >
            <div
                style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={onBack}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-raised)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                    }}
                >
                    ‹
                </button>
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        flex: 1,
                    }}
                >
                    Conversations
                </span>
                <button
                    onClick={onNew}
                    style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        background: "var(--accent)",
                        border: "none",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "Syne, sans-serif",
                    }}
                >
                    + New
                </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
                {conversations.length === 0 ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 120,
                            color: "var(--text-muted)",
                            fontSize: 12,
                        }}
                    >
                        No conversations yet
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const id =
                            typeof conv === "string"
                                ? conv
                                : conv.conversationId || conv.id;
                        const title =
                            typeof conv === "object"
                                ? conv.title || `Chat ${id.slice(0, 8)}`
                                : id.slice(0, 16);
                        const isActive = id === activeId;
                        return (
                            <button
                                key={id}
                                onClick={() => onSelect(id)}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "7px 10px",
                                    borderRadius: 8,
                                    background: isActive
                                        ? "var(--accent-dim)"
                                        : "transparent",
                                    border: `1px solid ${isActive ? "rgba(13,101,217,0.3)" : "transparent"}`,
                                    color: isActive
                                        ? "var(--accent)"
                                        : "var(--text-secondary)",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    fontSize: 12,
                                    fontFamily: "Syne, sans-serif",
                                    marginBottom: 2,
                                    transition: "background 0.1s",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background =
                                            "var(--bg-raised)";
                                        e.currentTarget.style.color =
                                            "var(--text-primary)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background =
                                            "transparent";
                                        e.currentTarget.style.color =
                                            "var(--text-secondary)";
                                    }
                                }}
                            >
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        background: isActive
                                            ? "var(--accent)"
                                            : "var(--bg-raised)",
                                        color: isActive
                                            ? "#fff"
                                            : "var(--text-muted)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    {(title[0] || "C").toUpperCase()}
                                </div>
                                <span
                                    style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {title}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ─── Capabilities carousel ────────────────────────────────────────────────────
const CAPABILITIES = [
    { label: "Edit elements", desc: "Change colors, size, position" },
    { label: "Add shapes", desc: "Create rects, circles, text, images" },
    { label: "Typography", desc: "Set fonts, size, alignment" },
    { label: "Layout", desc: "Align, reorder, duplicate layers" },
    { label: "Screenshot", desc: "Capture the current canvas" },
    { label: "Animations", desc: "Add keyframe animations" },
    { label: "Colors", desc: "Apply gradients, fills, strokes" },
    { label: "Bulk edits", desc: "Modify multiple elements at once" },
];

function CapabilitiesCarousel() {
    return (
        <div
            style={{
                width: "100%",
                overflow: "hidden",
                position: "relative",
                padding: "2px 0",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 20,
                    background:
                        "linear-gradient(to right, var(--bg-surface), transparent)",
                    zIndex: 1,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 20,
                    background:
                        "linear-gradient(to left, var(--bg-surface), transparent)",
                    zIndex: 1,
                }}
            />
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    animation: "marqueeScroll 22s linear infinite",
                    width: "max-content",
                    paddingLeft: 16,
                }}
            >
                {[...CAPABILITIES, ...CAPABILITIES].map((c, i) => (
                    <div
                        key={i}
                        style={{
                            flexShrink: 0,
                            padding: "7px 11px",
                            borderRadius: 9,
                            background: "var(--bg-raised)",
                            border: "1px solid var(--border)",
                            minWidth: 130,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: "var(--text-primary)",
                                letterSpacing: "0.02em",
                                marginBottom: 2,
                            }}
                        >
                            {c.label}
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                lineHeight: 1.4,
                            }}
                        >
                            {c.desc}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Pending image preview strip ─────────────────────────────────────────────
function PendingImages({ images, onRemove }) {
    if (!images.length) return null;
    return (
        <div
            style={{
                display: "flex",
                gap: 6,
                padding: "6px 10px 0",
                flexWrap: "wrap",
            }}
        >
            {images.map((img, i) => (
                <div
                    key={i}
                    style={{ position: "relative", width: 52, height: 52 }}
                >
                    <img
                        src={img.preview}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                        }}
                    />
                    <button
                        onClick={() => onRemove(i)}
                        style={{
                            position: "absolute",
                            top: -5,
                            right: -5,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "var(--bg-raised)",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            fontSize: 10,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                    {img.uploading && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: 6,
                                background: "rgba(0,0,0,0.5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span
                                className="ai-spin"
                                style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    border: "2px solid rgba(255,255,255,0.3)",
                                    borderTopColor: "#fff",
                                    display: "inline-block",
                                }}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Main EditorAiChat component ──────────────────────────────────────────────
export default function EditorAiChat({ agent }) {
    const {
        messages,
        conversations,
        error,
        isConfigured,
        isConnecting,
        isStreaming,
        isAgentDone,
        isThinking,
        sendMessage,
        stop,
        clearConversation,
        loadHistory,
        fetchConversations,
        selectConversation,
        conversationId,
    } = agent;

    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showConversations, setShowConversations] = useState(false);
    const [pendingImages, setPendingImages] = useState([]);
    const inputRef = useRef(null);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const historyLoadedRef = useRef(false);

    // Auto-load history on mount
    useEffect(() => {
        if (
            !isConnecting &&
            conversationId &&
            messages.length === 0 &&
            !historyLoadedRef.current
        ) {
            historyLoadedRef.current = true;
            loadHistory(conversationId);
        }
    }, [isConnecting, conversationId, messages.length, loadHistory]);

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Reset history flag when conversation changes
    useEffect(() => {
        historyLoadedRef.current = false;
    }, [conversationId]);

    // Auto-scroll
    const scrollToBottom = useCallback((force = false) => {
        const c = scrollRef.current;
        if (!c) return;
        if (force || c.scrollHeight - c.scrollTop - c.clientHeight < 180) {
            c.scrollTop = c.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom(true);
    }, [messages.length]);
    useEffect(() => {
        if (!isStreaming && !isSending) return;
        const id = setInterval(() => scrollToBottom(), 100);
        return () => clearInterval(id);
    }, [isStreaming, isSending, scrollToBottom]);

    // Fetch conversations when history panel shown
    useEffect(() => {
        if (showConversations) fetchConversations();
    }, [showConversations, fetchConversations]);

    // Reset isSending when agent responds
    useEffect(() => {
        if (isSending && (isAgentDone || isStreaming || error || isThinking))
            setIsSending(false);
    }, [isSending, isAgentDone, isStreaming, error, isThinking]);

    const canSend =
        (input.trim() || pendingImages.some((i) => i.url)) &&
        !isSending &&
        !isConnecting;
    const agentBusy = !isAgentDone || isSending;

    async function handleAttach(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        for (const file of files) {
            const preview = URL.createObjectURL(file);
            const item = { file, preview, url: null, uploading: true };
            setPendingImages((prev) => [...prev, item]);
            try {
                const url = await uploadImageToStore(file, file.name);
                setPendingImages((prev) =>
                    prev.map((p) =>
                        p.preview === preview
                            ? { ...p, url, uploading: false }
                            : p,
                    ),
                );
            } catch {
                setPendingImages((prev) =>
                    prev.map((p) =>
                        p.preview === preview
                            ? { ...p, uploading: false, error: true }
                            : p,
                    ),
                );
            }
        }
        e.target.value = "";
    }

    async function handleSend() {
        if (!canSend) return;
        const text = input.trim();
        const imageUrls = pendingImages.filter((i) => i.url).map((i) => i.url);
        setInput("");
        setPendingImages([]);
        if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.style.height = "auto";
        }
        setIsSending(true);
        await sendMessage(text, imageUrls);
        setTimeout(() => scrollToBottom(true), 50);
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    // Show thinking dots whenever agent is busy and not actively streaming text
    const showThinking = !isAgentDone && !isStreaming && messages.length > 0;

    const formatTime = (ts) =>
        ts
            ? new Date(ts).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
              })
            : "";

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
                background: "var(--bg-surface)",
            }}
        >
            {/* Conversation list overlay */}
            {showConversations && (
                <ConversationList
                    conversations={conversations}
                    activeId={conversationId}
                    onSelect={(id) => {
                        selectConversation(id);
                        setShowConversations(false);
                    }}
                    onNew={() => {
                        clearConversation();
                        setShowConversations(false);
                    }}
                    onBack={() => setShowConversations(false)}
                />
            )}

            {/* Header */}
            <div
                style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    background: "var(--bg-surface)",
                }}
            >
                {/* Avatar */}
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "var(--accent-dim)",
                        border: "1px solid rgba(13,101,217,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        position: "relative",
                    }}
                >
                    <img
                        src={OLA_AVATAR_URL}
                        alt="Ola"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                    />
                    <span
                        style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: isConnecting ? "#facc15" : "#34d399",
                            border: "1.5px solid var(--bg-surface)",
                            boxShadow: isConnecting
                                ? "none"
                                : "0 0 5px #34d399",
                        }}
                    />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            fontFamily: "Syne, sans-serif",
                        }}
                    >
                        Ola
                    </div>
                    <div
                        style={{
                            fontSize: 10,
                            color: isConnecting ? "#facc15" : "#34d399",
                            lineHeight: 1,
                        }}
                    >
                        {isConnecting
                            ? "Connecting…"
                            : agentBusy
                              ? "Working…"
                              : "Always Online"}
                    </div>
                </div>
                {/* Actions */}
                <button
                    onClick={() => setShowConversations(true)}
                    title="Conversation history"
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-raised)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--text-primary)";
                        e.currentTarget.style.borderColor =
                            "var(--border-strong)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.borderColor = "var(--border)";
                    }}
                >
                    <DuotoneIcon svg={ICONS.history} size={12} />
                </button>
                <button
                    onClick={() => clearConversation()}
                    title="New conversation"
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-raised)",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--accent)";
                        e.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.borderColor = "var(--border)";
                    }}
                >
                    <DuotoneIcon svg={ICONS.plus} size={12} />
                </button>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "10px 10px 4px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}
            >
                {/* Empty state */}
                {messages.length === 0 && !agentBusy && !error && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                            paddingTop: 8,
                        }}
                    >
                        <div
                            style={{
                                textAlign: "center",
                                padding: "10px 16px 4px",
                            }}
                        >
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: "50%",
                                    background: "var(--accent-dim)",
                                    border: "1px solid rgba(13,101,217,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 10px",
                                    overflow: "hidden",
                                }}
                            >
                                <img
                                    src={OLA_AVATAR_URL}
                                    alt="Ola"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    marginBottom: 4,
                                    fontFamily: "Syne, sans-serif",
                                }}
                            >
                                Ola
                            </div>
                            <div
                                style={{
                                    fontSize: 11.5,
                                    color: "var(--text-muted)",
                                    lineHeight: 1.5,
                                    maxWidth: 220,
                                    margin: "0 auto",
                                }}
                            >
                                Ask Ola to modify your canvas, change colors,
                                add elements, and more.
                            </div>
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 9.5,
                                    color: "var(--text-muted)",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    marginBottom: 6,
                                    paddingLeft: 2,
                                }}
                            >
                                I can help with
                            </div>
                            <CapabilitiesCarousel />
                        </div>
                        {/* Quick starters */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                            }}
                        >
                            {[
                                "Describe this canvas",
                                "Make the background dark blue",
                                "Add a title text element",
                                "Take a screenshot",
                                "Surprise me!!!",
                            ].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => {
                                        setInput(q);
                                        inputRef.current?.focus();
                                    }}
                                    style={{
                                        textAlign: "left",
                                        padding: "7px 10px",
                                        borderRadius: 8,
                                        border: "1px solid var(--border)",
                                        background: "var(--bg-raised)",
                                        color: "var(--text-secondary)",
                                        fontSize: 11.5,
                                        cursor: "pointer",
                                        transition: "all 0.1s",
                                        fontFamily: "Syne, sans-serif",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor =
                                            "var(--accent)";
                                        e.currentTarget.style.color =
                                            "var(--accent)";
                                        e.currentTarget.style.background =
                                            "var(--accent-dim)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor =
                                            "var(--border)";
                                        e.currentTarget.style.color =
                                            "var(--text-secondary)";
                                        e.currentTarget.style.background =
                                            "var(--bg-raised)";
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Render messages */}
                {messages.map((msg, idx) => {
                    const key = msg.id || msg.toolCallId || `msg-${idx}`;
                    const isAi = msg.role === "ai" || msg.role === "assistant";
                    const isUser = msg.role === "user" || msg.role === "human";
                    const isTool = msg.role === "tool_call";

                    if (isTool) {
                        return (
                            <ToolCallCard
                                key={key}
                                tool={msg.tool}
                                args={msg.args}
                                status={msg.status}
                                result={msg.result}
                                error={msg.error}
                                isClientTool={msg.isClientTool}
                            />
                        );
                    }

                    if (isAi) {
                        return (
                            <div
                                key={key}
                                className="ai-msg-enter"
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-start",
                                    position: "relative",
                                }}
                            >
                                {/* AI bubble */}
                                <div
                                    style={{
                                        maxWidth: "88%",
                                        padding: "8px 11px",
                                        borderRadius: "2px 12px 12px 12px",
                                        background: "var(--bg-raised)",
                                        border: "1px solid var(--border)",
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                                    }}
                                >
                                    {/* Tail */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: -7,
                                            width: 0,
                                            height: 0,
                                            borderRight:
                                                "7px solid var(--bg-raised)",
                                            borderBottom:
                                                "8px solid transparent",
                                        }}
                                    />
                                    <AiMarkdown
                                        content={msg.content}
                                        isStreaming={msg.isStreaming}
                                    />
                                    {msg.createdAt && (
                                        <div
                                            style={{
                                                fontSize: 9.5,
                                                color: "var(--text-muted)",
                                                marginTop: 4,
                                                textAlign: "right",
                                            }}
                                        >
                                            {formatTime(msg.createdAt)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }

                    if (isUser) {
                        const hasImages = msg.images && msg.images.length > 0;
                        return (
                            <div
                                key={key}
                                className="ai-msg-enter"
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    position: "relative",
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: "88%",
                                        padding: "8px 11px",
                                        borderRadius: "12px 2px 12px 12px",
                                        background: "var(--accent)",
                                        boxShadow:
                                            "0 1px 6px rgba(13,101,217,0.3)",
                                    }}
                                >
                                    {/* Tail */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            right: -7,
                                            width: 0,
                                            height: 0,
                                            borderLeft:
                                                "7px solid var(--accent)",
                                            borderBottom:
                                                "8px solid transparent",
                                        }}
                                    />
                                    {hasImages && (
                                        <div
                                            style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: 4,
                                                marginBottom: msg.content
                                                    ? 6
                                                    : 0,
                                            }}
                                        >
                                            {msg.images.map((url, i) => (
                                                <ImageBubble
                                                    key={i}
                                                    url={url}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {msg.content && (
                                        <div
                                            style={{
                                                fontSize: 12.5,
                                                color: "#fff",
                                                lineHeight: 1.5,
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {msg.content}
                                        </div>
                                    )}
                                    {msg.createdAt && (
                                        <div
                                            style={{
                                                fontSize: 9.5,
                                                color: "rgba(255,255,255,0.6)",
                                                marginTop: 4,
                                                textAlign: "right",
                                            }}
                                        >
                                            {formatTime(msg.createdAt)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}

                {/* Thinking indicator — shown whenever agent is busy and not streaming */}
                {showThinking && (
                    <div
                        className="ai-msg-enter"
                        style={{
                            display: "flex",
                            justifyContent: "flex-start",
                            paddingLeft: 2,
                            marginTop: 2,
                        }}
                    >
                        <ThinkingDots
                            label={isThinking ? "Thinking" : "Working"}
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div
                        style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(220,38,38,0.08)",
                            border: "1px solid rgba(220,38,38,0.2)",
                            fontSize: 12,
                            color: "#f87171",
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                        }}
                    >
                        <span style={{ flexShrink: 0 }}>⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Not configured */}
                {!isConfigured && (
                    <div
                        style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "rgba(250,204,21,0.08)",
                            border: "1px solid rgba(250,204,21,0.25)",
                            fontSize: 11.5,
                            color: "#facc15",
                            textAlign: "center",
                            lineHeight: 1.55,
                        }}
                    >
                        Set{" "}
                        <code
                            style={{
                                fontFamily: "DM Mono, monospace",
                                fontSize: 11,
                            }}
                        >
                            VITE_EDITOR_AI_URL
                        </code>{" "}
                        in{" "}
                        <code
                            style={{
                                fontFamily: "DM Mono, monospace",
                                fontSize: 11,
                            }}
                        >
                            .env
                        </code>{" "}
                        to connect the AI backend.
                    </div>
                )}

                <div ref={bottomRef} style={{ height: 2 }} />
            </div>

            {/* Pending images */}
            <PendingImages
                images={pendingImages}
                onRemove={(i) =>
                    setPendingImages((prev) => prev.filter((_, j) => j !== i))
                }
            />

            {/* Input area */}
            <div
                style={{
                    padding: "8px 10px",
                    borderTop: "1px solid var(--border)",
                    flexShrink: 0,
                    background: "var(--bg-surface)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "flex-end",
                        background: "var(--bg-raised)",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        padding: "6px 6px 6px 10px",
                        transition: "border-color 0.15s",
                    }}
                    onFocusCapture={(e) =>
                        (e.currentTarget.style.borderColor =
                            "var(--border-strong)")
                    }
                    onBlurCapture={(e) =>
                        (e.currentTarget.style.borderColor = "var(--border)")
                    }
                >
                    {/* Attach button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image"
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "none",
                            background: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "color 0.1s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.color =
                                "var(--text-secondary)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "var(--text-muted)")
                        }
                    >
                        <DuotoneIcon svg={ICONS.attach} size={14} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleAttach}
                    />

                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            // Ensure height is adjusted on change as well
                            e.target.style.height = "auto";
                            e.target.style.height =
                                Math.min(e.target.scrollHeight, 100) + "px";
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            isConfigured ? "Ask Ola…" : "Ola is not configured"
                        }
                        disabled={!isConfigured || isConnecting}
                        autoFocus
                        rows={1}
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            resize: "none",
                            color: "var(--text-primary)",
                            fontSize: 12.5,
                            fontFamily: "inherit",
                            lineHeight: 1.5,
                            maxHeight: 100,
                            overflowY: "auto",
                            padding: "4px 0",
                        }}
                        onInput={(e) => {
                            e.target.style.height = "auto";
                            e.target.style.height =
                                Math.min(e.target.scrollHeight, 100) + "px";
                        }}
                    />

                    {/* Stop / Send */}
                    {agentBusy ? (
                        <button
                            onClick={stop}
                            title="Stop"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                border: "1px solid rgba(220,38,38,0.3)",
                                background: "rgba(220,38,38,0.1)",
                                color: "#f87171",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <DuotoneIcon svg={ICONS.stop} size={13} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!canSend}
                            title="Send (Enter)"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                border: "none",
                                background: canSend
                                    ? "var(--accent)"
                                    : "var(--bg-base)",
                                color: canSend ? "#fff" : "var(--text-muted)",
                                cursor: canSend ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                transition: "all 0.15s",
                            }}
                        >
                            <DuotoneIcon svg={ICONS.send} size={13} />
                        </button>
                    )}
                </div>
                <div
                    style={{
                        fontSize: 9.5,
                        color: "var(--text-muted)",
                        marginTop: 4,
                        textAlign: "center",
                    }}
                >
                    Enter to send · Shift+Enter for new line
                </div>
            </div>
        </div>
    );
}
