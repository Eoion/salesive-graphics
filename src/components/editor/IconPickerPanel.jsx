import { createElement, useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { icons as lucideIcons } from "lucide-react";
import DuotoneIcon from "../DuotoneIcon.jsx";
import { ICONS } from "../../editor/duotoneIcons.js";

const LS_KEY = "salesive_recent_icons";
const MAX_RECENT = 12;
const ICONIFY = "https://api.iconify.design";
const DEFAULT_QUERY = "interface";
const SEARCH_LIMIT = 999;
const LOCAL_PAGE_SIZE = 56;
const ONLINE_PAGE_SIZE = 70;
const LOCAL_PREFIX = "npm-lucide:";

const ICONIFY_COLLECTIONS = [
    {
        value: "all",
        label: "All curated",
        description: "Several large free sets",
    },
    {
        value: "material-symbols",
        label: "Material Symbols",
        description: "Google Material icons",
    },
    {
        value: "mdi",
        label: "Material Design",
        description: "Community MDI set",
    },
    { value: "tabler", label: "Tabler", description: "Clean interface icons" },
    {
        value: "ph",
        label: "Phosphor",
        description: "Flexible line/duotone set",
    },
    { value: "ri", label: "Remix", description: "Remix Icon library" },
    { value: "lucide", label: "Lucide", description: "Open-source line icons" },
    { value: "carbon", label: "Carbon", description: "IBM Carbon icons" },
    { value: "solar", label: "Solar", description: "Large decorative set" },
    { value: "mingcute", label: "MingCute", description: "Rounded UI icons" },
    {
        value: "heroicons",
        label: "Heroicons",
        description: "Tailwind Labs icons",
    },
    { value: "fluent", label: "Fluent", description: "Microsoft Fluent icons" },
    {
        value: "icon-park-outline",
        label: "IconPark",
        description: "Outline IconPark set",
    },
    { value: "bi", label: "Bootstrap", description: "Bootstrap Icons" },
    { value: "octicon", label: "Octicons", description: "GitHub Octicons" },
    {
        value: "ant-design",
        label: "Ant Design",
        description: "Ant Design icons",
    },
    {
        value: "hugeicons",
        label: "HugeIcons",
        description: "HugeIcons free set",
    },
];

const SOURCE_OPTIONS = [
    { value: "local", label: "Lucide SVG package", description: "Local icons" },
    {
        value: "online",
        label: "Iconify online",
        description: "Remote SVG search",
    },
];

const FEATURED_LOCAL_ICONS = [
    "Sparkles",
    "WandSparkles",
    "MousePointer2",
    "PenTool",
    "Palette",
    "Layers",
    "Crop",
    "Scan",
    "VectorSquare",
    "ImagePlus",
    "Shapes",
    "LayoutDashboard",
    "MousePointerClick",
    "Paintbrush",
    "PaintBucket",
    "Pipette",
    "Boxes",
    "Component",
    "ChartNoAxesCombined",
    "BadgeDollarSign",
    "Smartphone",
    "Monitor",
    "CloudSun",
    "Share2",
];

const LOCAL_ICON_NAMES = Object.keys(lucideIcons).sort((a, b) =>
    humanizeIconName(a).localeCompare(humanizeIconName(b)),
);

function getRecent() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveRecent(icon) {
    try {
        const next = [icon, ...getRecent().filter((i) => i !== icon)].slice(
            0,
            MAX_RECENT,
        );
        localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
        // Recent icons are a convenience; ignore storage failures in restricted browsers.
    }
}

function iconUrl(name) {
    const [prefix, icon] = name.split(":");
    return `${ICONIFY}/${prefix}/${icon}.svg`;
}

function localIconId(name) {
    return `${LOCAL_PREFIX}${name}`;
}

function isLocalIcon(name) {
    return name.startsWith(LOCAL_PREFIX);
}

function localIconName(name) {
    return name.slice(LOCAL_PREFIX.length);
}

function humanizeIconName(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/[-_]/g, " ")
        .trim();
}

function uniqueIcons(icons) {
    return [...new Set(icons.filter(Boolean))];
}

function searchUrl(query, prefix = "all") {
    const params = new URLSearchParams({
        query,
        limit: String(SEARCH_LIMIT),
    });
    if (prefix !== "all") params.set("prefixes", prefix);
    return `${ICONIFY}/search?${params.toString()}`;
}

function collectionUrl(prefix) {
    const params = new URLSearchParams({ prefix });
    return `${ICONIFY}/collection?${params.toString()}`;
}

function iconsFromCollection(collection) {
    const names = new Set(collection.uncategorized || []);
    for (const list of Object.values(collection.categories || {})) {
        for (const name of list) names.add(name);
    }
    return [...names].map((name) => `${collection.prefix}:${name}`);
}

function encodeSvg(svgText) {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
}

// ── SVG cache for online icons (avoids re-fetching on click) ────────────────
const _svgCache = new Map();

function prefetchSvg(name) {
    if (isLocalIcon(name) || _svgCache.has(name)) return;
    const url = iconUrl(name);
    fetch(url)
        .then((r) => r.text())
        .then((text) => { if (text) _svgCache.set(name, text); })
        .catch(() => {});
}

async function getCachedSvg(name) {
    if (_svgCache.has(name)) return _svgCache.get(name);
    const url = iconUrl(name);
    const text = await fetch(url).then((r) => r.text());
    _svgCache.set(name, text);
    return text;
}

function buildLocalSvg(name) {
    const Icon = lucideIcons[name];
    if (!Icon) throw new Error(`Unknown icon: ${name}`);
    return renderToStaticMarkup(
        createElement(Icon, {
            xmlns: "http://www.w3.org/2000/svg",
            width: 24,
            height: 24,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            color: "currentColor",
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round",
        }),
    );
}

export default function IconPickerPanel({ onAddIcon, canvasSize }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [source, setSource] = useState("local");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState(getRecent);
    const [total, setTotal] = useState(0);
    const [localVisibleCount, setLocalVisibleCount] = useState(LOCAL_PAGE_SIZE);
    const [onlineVisibleCount, setOnlineVisibleCount] =
        useState(ONLINE_PAGE_SIZE);
    const [iconifyCollection, setIconifyCollection] = useState("all");
    const debounce = useRef(null);
    const inputRef = useRef();
    const scrollRef = useRef(null);
    const prefetchedCollection = useRef(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 60);
    }, [open]);

    const localMatches = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const featured = FEATURED_LOCAL_ICONS.filter(
            (name) => lucideIcons[name],
        );
        const ordered = normalizedQuery
            ? LOCAL_ICON_NAMES.filter((name) => {
                  const label = humanizeIconName(name).toLowerCase();
                  return (
                      label.includes(normalizedQuery) ||
                      name.toLowerCase().includes(normalizedQuery)
                  );
              })
            : uniqueIcons([...featured, ...LOCAL_ICON_NAMES]);
        return ordered;
    }, [query]);

    function selectedIconifyPrefixes(collection = iconifyCollection) {
        if (collection === "all")
            return ICONIFY_COLLECTIONS.filter(
                (item) => item.value !== "all",
            ).map((item) => item.value);
        return [collection];
    }

    function doSearch(q = DEFAULT_QUERY, collection = iconifyCollection) {
        setLoading(true);
        setOnlineVisibleCount(ONLINE_PAGE_SIZE);
        fetch(searchUrl(q, collection))
            .then((r) => r.json())
            .then((d) => {
                setResults(uniqueIcons(d.icons || []));
                setTotal(Number(d.total) || 0);
                setLoading(false);
            })
            .catch(() => {
                setResults([]);
                setTotal(0);
                setLoading(false);
            });
    }

    async function browseIconifyCollections(collection = iconifyCollection) {
        setLoading(true);
        setOnlineVisibleCount(ONLINE_PAGE_SIZE);
        try {
            const collections = await Promise.all(
                selectedIconifyPrefixes(collection).map((prefix) =>
                    fetch(collectionUrl(prefix)).then((r) =>
                        r.ok ? r.json() : null,
                    ),
                ),
            );
            const icons = uniqueIcons(
                collections.flatMap((collection) =>
                    collection ? iconsFromCollection(collection) : [],
                ),
            );
            setResults(icons);
            setTotal(icons.length);
        } catch {
            setResults([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (prefetchedCollection.current === iconifyCollection || query.trim())
            return;
        prefetchedCollection.current = iconifyCollection;
        browseIconifyCollections(iconifyCollection);
    }, [iconifyCollection]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleToggle() {
        const nextOpen = !open;
        setOpen(nextOpen);
    }

    function handleSearch(e) {
        const q = e.target.value;
        setQuery(q);
        setLocalVisibleCount(LOCAL_PAGE_SIZE);
        clearTimeout(debounce.current);
        if (source !== "online") return;
        if (!q.trim()) {
            browseIconifyCollections(iconifyCollection);
            return;
        }
        debounce.current = setTimeout(
            () => doSearch(q, iconifyCollection),
            320,
        );
    }

    function handleSource(nextSource) {
        setSource(nextSource);
        setLoading(false);
        setLocalVisibleCount(LOCAL_PAGE_SIZE);
        clearTimeout(debounce.current);
        if (nextSource === "online") {
            if (query.trim()) doSearch(query.trim(), iconifyCollection);
            else browseIconifyCollections(iconifyCollection);
        }
    }

    function handleIconifyCollection(nextCollection) {
        setIconifyCollection(nextCollection);
        clearTimeout(debounce.current);
        if (source !== "online") return;
        if (query.trim()) doSearch(query.trim(), nextCollection);
        else browseIconifyCollections(nextCollection);
    }

    const display =
        source === "local"
            ? localMatches.slice(0, localVisibleCount).map(localIconId)
            : results.slice(0, onlineVisibleCount);
    const totalCount = source === "local" ? localMatches.length : total;
    const isOnlineLoading = source === "online" && loading;
    const canLoadMoreLocal =
        source === "local" &&
        display.length < Math.min(localMatches.length, SEARCH_LIMIT);
    const canLoadMoreOnline =
        source === "online" && !loading && display.length < results.length;
    const showRecent = recent.length > 0;
    const selectedSource =
        SOURCE_OPTIONS.find((option) => option.value === source) ||
        SOURCE_OPTIONS[0];
    const selectedCollection =
        ICONIFY_COLLECTIONS.find(
            (option) => option.value === iconifyCollection,
        ) || ICONIFY_COLLECTIONS[0];

    function maybeLoadMoreIcons(target) {
        const remaining =
            target.scrollHeight - target.scrollTop - target.clientHeight;
        if (remaining >= 80) return;
        if (source === "local") {
            setLocalVisibleCount((count) =>
                Math.min(
                    count + LOCAL_PAGE_SIZE,
                    SEARCH_LIMIT,
                    localMatches.length,
                ),
            );
            return;
        }
        if (
            source === "online" &&
            !loading &&
            onlineVisibleCount < results.length
        ) {
            setOnlineVisibleCount((count) =>
                Math.min(count + ONLINE_PAGE_SIZE, results.length),
            );
        }
    }

    useEffect(() => {
        if (!scrollRef.current) return;
        maybeLoadMoreIcons(scrollRef.current);
    }, [display.length, results.length, source]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePick = useCallback(async (name) => {
        if (isLocalIcon(name)) {
            const iconName = localIconName(name);
            const svgText = buildLocalSvg(iconName);
            onAddIcon(
                encodeSvg(svgText),
                `lucide:${humanizeIconName(iconName)}`,
                canvasSize,
                { fill: null, iconColors: {} },
            );
            saveRecent(name);
            setRecent(getRecent());
            return;
        }

        try {
            const svgText = await getCachedSvg(name);
            onAddIcon(encodeSvg(svgText), name, canvasSize, {
                fill: null,
                iconColors: {},
            });
            saveRecent(name);
            setRecent(getRecent());
        } catch {
            // Keep the picker responsive if the icon CDN is unavailable.
        }
    }, [onAddIcon, canvasSize]);

    return (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)" }}>
            <button
                onClick={handleToggle}
                style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 8px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                }}
                onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                }
            >
                <DuotoneIcon svg={ICONS.star} size={11} />
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        flex: 1,
                        textAlign: "left",
                    }}
                >
                    Icons
                </span>
                <span style={{ fontSize: 9, opacity: 0.5 }}>
                    {open ? "▲" : "▼"}
                </span>
            </button>

            {open && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        maxHeight: 420,
                        borderTop: "1px solid var(--border)",
                    }}
                >
                    <div
                        style={{
                            padding: "6px 8px",
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                        }}
                    >
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={handleSearch}
                            placeholder={
                                source === "local"
                                    ? "Search 1,900+ local SVG icons..."
                                    : "Browse Iconify or search online..."
                            }
                            style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "4px 8px",
                                borderRadius: 5,
                                border: "1px solid var(--border)",
                                background: "var(--bg-base)",
                                color: "var(--text-primary)",
                                fontSize: 11,
                                outline: "none",
                                fontFamily: "inherit",
                            }}
                            onFocus={(e) =>
                                (e.target.style.borderColor = "var(--accent)")
                            }
                            onBlur={(e) =>
                                (e.target.style.borderColor = "var(--border)")
                            }
                        />

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: 5,
                                alignItems: "center",
                            }}
                        >
                            <CustomSelect
                                value={source}
                                options={SOURCE_OPTIONS}
                                onChange={handleSource}
                            />
                            <span
                                title={selectedSource.description}
                                style={{
                                    color: "var(--text-muted)",
                                    fontSize: 9,
                                    fontFamily: "DM Mono, monospace",
                                }}
                            >
                                {isOnlineLoading
                                    ? "..."
                                    : `${display.length}/${Math.max(totalCount, display.length)}`}
                            </span>
                        </div>
                        {source === "online" && (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto",
                                    gap: 5,
                                    alignItems: "center",
                                }}
                            >
                                <CustomSelect
                                    value={iconifyCollection}
                                    options={ICONIFY_COLLECTIONS}
                                    onChange={handleIconifyCollection}
                                />
                                <span
                                    title={selectedCollection.description}
                                    style={{
                                        color: "var(--text-muted)",
                                        fontSize: 9,
                                        fontFamily: "DM Mono, monospace",
                                    }}
                                >
                                    Set
                                </span>
                            </div>
                        )}
                    </div>

                    <div
                        ref={scrollRef}
                        onScroll={(e) => maybeLoadMoreIcons(e.currentTarget)}
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            minHeight: 0,
                            padding: "0 6px 6px",
                        }}
                    >
                        {showRecent && (
                            <>
                                <div
                                    style={{
                                        fontSize: 9,
                                        fontWeight: 600,
                                        color: "var(--text-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.07em",
                                        padding: "4px 2px 3px",
                                    }}
                                >
                                    Recent
                                </div>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(7, 1fr)",
                                        gap: 2,
                                        marginBottom: 6,
                                    }}
                                >
                                    {recent.map((name) => (
                                        <IconThumb
                                            key={name}
                                            name={name}
                                            onPick={handlePick}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {!isOnlineLoading && display.length > 0 && (
                            <>
                                {showRecent && (
                                    <div
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 600,
                                            color: "var(--text-muted)",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.07em",
                                            padding: "2px 2px 3px",
                                        }}
                                    >
                                        {query.trim()
                                            ? `Results · ${selectedCollection.label}`
                                            : `Browse · ${source === "online" ? selectedCollection.label : selectedSource.label}`}
                                    </div>
                                )}
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(7, 1fr)",
                                        gap: 2,
                                    }}
                                >
                                    {display.map((name) => (
                                        <IconThumb
                                            key={name}
                                            name={name}
                                            onPick={handlePick}
                                        />
                                    ))}
                                </div>
                                {(canLoadMoreLocal || canLoadMoreOnline) && (
                                    <button
                                        onClick={() => {
                                            if (source === "local") {
                                                setLocalVisibleCount((count) =>
                                                    Math.min(
                                                        count + LOCAL_PAGE_SIZE,
                                                        SEARCH_LIMIT,
                                                        localMatches.length,
                                                    ),
                                                );
                                            } else {
                                                setOnlineVisibleCount((count) =>
                                                    Math.min(
                                                        count +
                                                            ONLINE_PAGE_SIZE,
                                                        results.length,
                                                    ),
                                                );
                                            }
                                        }}
                                        style={{
                                            width: "100%",
                                            marginTop: 7,
                                            padding: "6px 8px",
                                            borderRadius: 6,
                                            border: "1px solid var(--border)",
                                            background: "var(--bg-raised)",
                                            color: "var(--text-secondary)",
                                            cursor: "pointer",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                        }}
                                    >
                                        Load more icons
                                    </button>
                                )}
                            </>
                        )}

                        {isOnlineLoading && (
                            <div
                                style={{
                                    textAlign: "center",
                                    padding: "16px 0",
                                }}
                            >
                                <div
                                    style={{
                                        display: "inline-block",
                                        width: 16,
                                        height: 16,
                                        border: "2px solid var(--border-strong)",
                                        borderTopColor: "var(--accent)",
                                        borderRadius: "50%",
                                        animation:
                                            "aiSpin 0.7s linear infinite",
                                    }}
                                />
                            </div>
                        )}

                        {!isOnlineLoading &&
                            display.length === 0 &&
                            query.trim() && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-muted)",
                                        textAlign: "center",
                                        padding: "12px 0",
                                    }}
                                >
                                    No icons found
                                </div>
                            )}
                    </div>
                </div>
            )}
        </div>
    );
}

const IconThumb = memo(function IconThumb({ name, onPick }) {
    const [hovered, setHovered] = useState(false);
    const isLocal = isLocalIcon(name);
    const iconName = isLocal ? localIconName(name) : name;
    const shortName = isLocal
        ? humanizeIconName(iconName)
        : name.includes(":")
          ? name.split(":")[1]
          : name;
    const LocalIcon = isLocal ? lucideIcons[iconName] : null;

    const handleMouseEnter = useCallback(() => {
        setHovered(true);
        // Pre-fetch SVG on hover for instant click
        if (!isLocal) prefetchSvg(name);
    }, [name, isLocal]);

    return (
        <button
            title={shortName}
            onClick={() => onPick(name)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                aspectRatio: "1",
                padding: 3,
                borderRadius: 4,
                border: `1px solid ${hovered ? "var(--accent)" : "transparent"}`,
                background: hovered ? "var(--accent-dim)" : "transparent",
                color: hovered ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer",
                overflow: "hidden",
            }}
        >
            {LocalIcon ? (
                <LocalIcon size={18} strokeWidth={2} />
            ) : (
                <img
                    src={iconUrl(name)}
                    alt={shortName}
                    width={18}
                    height={18}
                    style={{
                        display: "block",
                        filter: "var(--icon-filter, none)",
                    }}
                    onLoad={() => prefetchSvg(name)}
                    loading="lazy"
                />
            )}
        </button>
    );
});

function CustomSelect({ value, options, onChange }) {
    const [open, setOpen] = useState(false);
    const selected =
        options.find((option) => option.value === value) || options[0];
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!open || !dropdownRef.current) return;
        const rect = dropdownRef.current.getBoundingClientRect();
        const gutter = 8;
        const below = window.innerHeight - rect.top - gutter;
        const above = rect.top - gutter;
        const maxHeight = Math.max(120, Math.min(260, Math.max(below, above)));
        dropdownRef.current.style.maxHeight = `${maxHeight}px`;
        dropdownRef.current.style.overflowY = "auto";
        dropdownRef.current.style.top =
            below < 140 && above > below ? "auto" : "calc(100% + 3px)";
        dropdownRef.current.style.bottom =
            below < 140 && above > below ? "calc(100% + 3px)" : "auto";
    }, [open]);

    return (
        <div style={{ position: "relative", minWidth: 0 }}>
            <button
                type="button"
                onClick={() => setOpen((isOpen) => !isOpen)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                style={{
                    width: "100%",
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 7px",
                    borderRadius: 5,
                    border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
                    background: "var(--bg-raised)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 10,
                    textAlign: "left",
                }}
            >
                <span
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {selected.label}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 8 }}>
                    {open ? "▲" : "▼"}
                </span>
            </button>

            {open && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "calc(100% + 3px)",
                        zIndex: 300,
                        padding: 3,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
                    }}
                >
                    {options.map((option) => {
                        const active = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                    padding: "5px 6px",
                                    borderRadius: 4,
                                    border: "none",
                                    background: active
                                        ? "var(--accent-dim)"
                                        : "transparent",
                                    color: active
                                        ? "var(--accent)"
                                        : "var(--text-secondary)",
                                    cursor: "pointer",
                                    textAlign: "left",
                                }}
                            >
                                <span style={{ fontSize: 10, fontWeight: 700 }}>
                                    {option.label}
                                </span>
                                <span
                                    style={{
                                        fontSize: 9,
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    {option.description}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
