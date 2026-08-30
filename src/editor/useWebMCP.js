// WebMCP bridge: exposes every editor tool that "Ola" (the in-app AI assistant)
// can call to external AI agents via the W3C Web Model Context API.
//
// It registers each entry of `clientToolHandlers` (the same map passed to
// useEditorAgent) as a WebMCP tool on `document.modelContext`, so browser
// agents / extensions that speak WebMCP can drive the SVG editor with the exact
// same capabilities as the built-in assistant.

import { useCallback, useEffect, useRef } from 'react';
import { normalizeToolArgs } from './toolArgs.js';

// The WebMCP polyfill is loaded lazily (after first paint) rather than as a
// top-level side-effect import, so its init can't interleave with the app's
// module evaluation / first React render.
let _polyfillPromise = null;
function ensureWebMcpPolyfill() {
  if (typeof document === 'undefined') return Promise.resolve(null);
  if (document.modelContext?.registerTool) return Promise.resolve(document.modelContext);
  if (!_polyfillPromise) {
    _polyfillPromise = import('@mcp-b/global')
      .then(() => document.modelContext || null)
      .catch((e) => {
        console.warn('[WebMCP] failed to load polyfill', e);
        return null;
      });
  }
  return _polyfillPromise;
}

// Human-readable descriptions for the tools whose purpose isn't obvious from the
// name. Anything not listed here falls back to a generated description.
const TOOL_DESCRIPTIONS = {
  get_canvas_state: 'Get the full canvas state: size, defs, all elements and groups.',
  list_elements: 'List every element on the canvas with its id, type and bounds.',
  get_element: 'Get a single element by id, including all of its properties. Args: { id }.',
  get_snapshot: 'Get a compact snapshot of the canvas (size + elements) for quick reasoning.',
  get_selected_elements: 'Get the currently selected element(s).',
  take_screenshot: 'Capture a PNG screenshot of the whole canvas.',
  get_canvas_screenshot: 'Capture a PNG screenshot of the canvas. Optional args control scale/format.',
  get_element_screenshot: 'Capture a PNG screenshot cropped to one element. Args: { id }.',
  get_region_screenshot: 'Capture a PNG screenshot of a rectangular region. Args: { x, y, width, height }.',
  review_canvas_region: 'Render a region and return it for visual review. Args: { x, y, width, height }.',
  find_text_elements: 'Find text elements. Args: { query (plain substring, case-insensitive), regex?: true to treat query as a RegExp, flags?, select? }.',
  measure_elements: 'Bounding box + per-element metrics in rendered space (textAnchor-aware). Args: { ids }.',
  align_to_element: 'Align elements to a reference element. Args: { ids, refId (aka targetId), align: "left"|"right"|"top"|"bottom"|"center-h"|"center-v"|"center" }.',
  fit_frame_around: 'Size a rect to wrap elements. Args: { ids, frameId? (resize this rect instead of creating one), padding?, fill?, rx? }.',
  arrange_row: 'Lay elements out in a row starting at { x, y } (or startX/startY). Args: { ids, x?, y?, gap?, alignment?: "top"|"center"|"bottom" }.',
  arrange_column: 'Lay elements out in a column starting at { x, y } (or startX/startY). Args: { ids, x?, y?, gap?, alignment?: "left"|"center"|"right" }.',
  check_layout: 'Analyse the layout for overflow, overlaps and out-of-bounds elements.',
  estimate_text: 'Estimate the rendered width/height of a text string. Args: { text, fontSize, fontFamily?, width? }.',
  list_collection_items: 'List saved collection items available to insert.',
  get_collection_item: 'Get one collection item by id. Args: { id }.',
  insert_collection_item: 'Insert a saved collection item onto the canvas. Args: { id, x?, y? }.',
  save_to_collection: 'Save the given elements as a reusable collection item. Args: { ids, name? }.',
  create_group: 'Group elements together. Args: { ids, name? }.',
  add_to_group: 'Add elements to an existing group. Args: { groupId, ids }.',
  remove_from_group: 'Remove elements from a group. Args: { groupId, ids }.',
  dissolve_group: 'Ungroup a group, keeping its elements. Args: { groupId }.',
  rename_group: 'Rename a group. Args: { groupId, name }.',
  list_groups: 'List all groups and their member element ids.',
  get_group: 'Get one group with its members. Args: { groupId }.',
  undo_last_action: 'Undo the last editor action.',
  redo_last_action: 'Redo the last undone editor action.',
  select_element: 'Select a single element. Args: { id }.',
  select_elements: 'Select multiple elements. Args: { ids }.',
  update_element: 'Patch properties of one element. Args: { id, ...properties }.',
  update_elements: 'Patch the same properties across many elements. Args: { ids, patch }.',
  set_fill: 'Set an element fill colour. Args: { id, fill }.',
  set_stroke: 'Set an element stroke colour/width. Args: { id, stroke, strokeWidth? }.',
  set_opacity: 'Set an element opacity (0-1). Args: { id, opacity }.',
  set_text: 'Set a text element\'s content and/or type properties. Args: { id, text?, fontSize?, fontWeight?, fontFamily?, textAnchor?, fill?, width?, lineHeight?, textWrap? }.',
  batch_update_texts: 'Update the text of many text elements at once. Args: { updates: [{ id, text }] }.',
  move_element: 'Move an element. Args: { id, x, y } for an absolute position, or { id, dx, dy } for a relative nudge. Works for every element type.',
  resize_element: 'Resize an element. Args: { id, width, height }.',
  lock_element: 'Lock an element against editing. Args: { id, locked? }.',
  unlock_element: 'Unlock an element. Args: { id }.',
  hide_element: 'Hide an element. Args: { id }.',
  show_element: 'Show a hidden element. Args: { id }.',
  delete_element: 'Delete one element. Args: { id }.',
  delete_elements: 'Delete multiple elements. Args: { ids }.',
  add_element: 'Add a single new element. Args: { type, ...properties }.',
  add_elements: 'Add multiple new elements at once. Args: { elements }.',
  duplicate_element: 'Duplicate one element. Args: { id }.',
  duplicate_elements: 'Duplicate multiple elements with an offset. Args: { ids, offset?, dx?, dy? }.',
  add_icon: 'Add an icon (Lucide set). Args: { name: "music" | "arrow-right" | …, x?, y?, size?, color? } or { href } for a custom image.',
  bring_forward: 'Move an element up one step in the z-order. Args: { id, steps? }.',
  send_backward: 'Move an element down one step in the z-order. Args: { id, steps? }.',
  bring_to_front: 'Move an element to the top of the z-order. Args: { id }.',
  send_to_back: 'Move an element to the bottom of the z-order. Args: { id }.',
  fix_elements: 'Auto-fix common issues (NaN coords, zero sizes, etc). Args: { ids? }.',
  align_elements: 'Align elements. Args: { ids, align: "left"|"right"|"top"|"bottom"|"center-h"|"center-v"|"center", relativeTo?: "group" (shared edge, default for 2+) | "canvas", margin? }.',
  distribute_elements: 'Distribute elements evenly. Args: { ids, axis, ... }.',
  constrain_elements: 'Keep elements inside the canvas with padding. Args: { ids?, padding?, ignoreIds? }.',
  arrange_grid: 'Lay elements out in a grid from an { x, y } origin. Args: { ids, x?, y?, columns?, colGap?, rowGap? }.',
  align_grid: 'Place elements on a grid from { x, y } (top-left by default — uniform rows). Args: { ids, x?, y?, columns?, hSpacing?, vSpacing?, align?: "left"|"center"|"right", valign?: "top"|"middle"|"bottom" }.',
  snap_to_grid: 'Snap element positions (and optionally sizes) to a grid. Args: { ids?, gridSize?, snapSize? }.',
  center_in_canvas: 'Centre elements within the canvas. Args: { ids, axis? }.',
  place_at: 'Place an element at a canvas anchor. Args: { id, anchor?, margin? }.',
  stack_center: 'Stack elements centred on a point. Args: { ids, cx?, cy?, preserveRelative? }.',
  load_font: 'Load a Google font and optionally apply it. Args: { fontFamily, ids?, applyToAll? }.',
  resize_canvas: 'Resize the canvas. Args: { width, height, constrain? }.',
  insert_svg: 'Parse and insert raw SVG markup. Args: { svg, placement? "original"|"center" (default "original", keeps coordinates) }.',
  replace_defs: 'Merge into the canvas <defs> — adds/replaces gradients by id, keeps the rest. Args: { defs: { gradients: [...] }, replace?: true to wipe first }. Not for raw SVG markup; use add_gradient.',
  add_gradient: 'Define a gradient and get the fill string to use. Args: { type?: "linear"|"radial", stops: [{ offset (0-100 or 0-1), stopColor, stopOpacity? }], id?, x1?,y1?,x2?,y2? | cx?,cy?,r? — coords accept 0-100 or 0-1 fractions }. Returns { id, fill: "url(#id)" }.',
  list_gradients: 'List gradients currently defined on the canvas, with their url(#id) fill strings.',
  set_template_name: 'Set the template / document name. Args: { name }.',
  get_editor_guide: 'Return the full canvas-designer guide: build loop, coordinate/anchor model, gradients, type via insert_svg, icons, layout helpers, and known-broken tools. Call it before making changes.',
  lock_canvas: 'Lock the canvas so the user cannot edit while you work. Always pair with unlock_canvas. Args: { reason? }.',
  unlock_canvas: 'Release the canvas lock taken with lock_canvas. Call this when you finish or abort.',
  ask_canvas_question: 'Ask the user a question about the canvas and wait for their reply. Args: { question, options?: string[], allowCustom? }. Returns { answered, answer, custom }.',
  set_agent_identity: 'Set the name and avatar shown for you in the editor activity panel. Args: { name?, avatar? } where avatar is an https URL or a data:image/... base64 URI.',
};

function humanize(name) {
  const base = name.replace(/^editor\./, '').replace(/_/g, ' ');
  if (name.startsWith('create_')) {
    return `Create a ${base.replace(/^create /, '')} component on the canvas.`;
  }
  return base.charAt(0).toUpperCase() + base.slice(1) + '.';
}

function describe(name) {
  return TOOL_DESCRIPTIONS[name] || humanize(name);
}

const STR_ARRAY = { type: 'array', items: { type: 'string' } };
const OBJ_ARRAY = { type: 'array', items: { type: 'object', additionalProperties: true } };
const NUM = { type: 'number' };
const STR = { type: 'string' };

// Explicit schemas for tools taking arrays/objects — a bare permissive schema
// makes models pass JSON-encoded strings, which then break `.map` / `.filter`.
const TOOL_SCHEMAS = {
  select_elements: { ids: STR_ARRAY },
  update_elements: { ids: STR_ARRAY, patch: { type: 'object', additionalProperties: true } },
  delete_elements: { ids: STR_ARRAY },
  duplicate_elements: { ids: STR_ARRAY, offset: NUM, dx: NUM, dy: NUM },
  add_elements: { elements: OBJ_ARRAY, selectNew: { type: 'boolean' } },
  batch_update_texts: { updates: OBJ_ARRAY },
  align_elements: { ids: STR_ARRAY, align: STR, alignment: STR, relativeTo: STR, margin: NUM },
  distribute_elements: { ids: STR_ARRAY, axis: STR, spacing: NUM },
  arrange_row: { ids: STR_ARRAY, x: NUM, y: NUM, startX: NUM, startY: NUM, gap: NUM, alignment: STR },
  arrange_column: { ids: STR_ARRAY, x: NUM, y: NUM, startX: NUM, startY: NUM, gap: NUM, alignment: STR },
  arrange_grid: { ids: STR_ARRAY, x: NUM, y: NUM, startX: NUM, startY: NUM, columns: NUM, colGap: NUM, rowGap: NUM },
  align_grid: { ids: STR_ARRAY, x: NUM, y: NUM, columns: NUM, hSpacing: NUM, vSpacing: NUM, align: STR, valign: STR },
  set_text: { id: STR, text: STR, fontSize: NUM, fontWeight: STR, fontFamily: STR, textAnchor: STR, fill: STR, width: NUM, lineHeight: NUM },
  align_to_element: { ids: STR_ARRAY, refId: STR, targetId: STR, align: STR },
  fit_frame_around: { ids: STR_ARRAY, frameId: STR, padding: NUM, fill: STR, rx: NUM },
  find_text_elements: { query: STR, pattern: STR, regex: { type: 'boolean' }, flags: STR, select: { type: 'boolean' } },
  replace_defs: { defs: { type: 'object', additionalProperties: true }, replace: { type: 'boolean' } },
  snap_to_grid: { ids: STR_ARRAY, gridSize: NUM, snapSize: { type: 'boolean' } },
  constrain_elements: { ids: STR_ARRAY, padding: NUM, ignoreIds: STR_ARRAY },
  center_in_canvas: { ids: STR_ARRAY, axis: STR },
  stack_center: { ids: STR_ARRAY, cx: NUM, cy: NUM, preserveRelative: { type: 'boolean' } },
  measure_elements: { ids: STR_ARRAY },
  fix_elements: { ids: STR_ARRAY },
  create_group: { ids: STR_ARRAY, name: STR },
  add_to_group: { groupId: STR, ids: STR_ARRAY },
  remove_from_group: { groupId: STR, ids: STR_ARRAY },
  save_to_collection: { ids: STR_ARRAY, name: STR },
  add_gradient: {
    type: STR, id: STR,
    stops: { type: 'array', items: { type: 'object', properties: { offset: NUM, stopColor: STR, stopOpacity: NUM } } },
    x1: NUM, y1: NUM, x2: NUM, y2: NUM, cx: NUM, cy: NUM, r: NUM,
  },
  add_element: { type: STR, x: NUM, y: NUM, width: NUM, height: NUM, text: STR, fill: STR },
  add_icon: { name: STR, icon: STR, x: NUM, y: NUM, size: NUM, width: NUM, height: NUM, color: STR },
  update_element: { id: STR, x: NUM, y: NUM, width: NUM, height: NUM },
  move_element: { id: STR, x: NUM, y: NUM, dx: NUM, dy: NUM },
  resize_element: { id: STR, width: NUM, height: NUM },
  ask_canvas_question: { question: STR, options: STR_ARRAY, allowCustom: { type: 'boolean' } },
};

function inputSchemaFor(name) {
  const key = name.replace(/^editor\./, '');
  const props = TOOL_SCHEMAS[key];
  return props
    ? { type: 'object', properties: props, additionalProperties: true }
    : { type: 'object', properties: {}, additionalProperties: true };
}

// Some agent runtimes cap how many tools a page may expose over WebMCP (and how
// large the combined tool schema payload may be). We register this curated core
// set individually; everything else (the create_* component builders, niche
// layout helpers) stays reachable through the `call_editor_tool` dispatcher and
// is documented by `get_editor_guide`.
// Ordered by priority — when the cap forces a trim, the tail is dropped first
// (still reachable via call_editor_tool).
const WEBMCP_CORE = [
  // agent coordination + must-have reads
  'get_editor_guide', 'get_canvas_state', 'get_snapshot', 'get_canvas_screenshot',
  'list_elements', 'get_element', 'check_layout', 'lock_canvas', 'unlock_canvas',
  'ask_canvas_question', 'set_agent_identity',
  // core create / edit / delete
  'add_element', 'add_elements', 'add_icon', 'add_gradient', 'insert_svg',
  'update_element', 'update_elements', 'set_text', 'set_fill', 'set_stroke',
  'set_opacity', 'move_element', 'resize_element', 'delete_element',
  'delete_elements', 'duplicate_element', 'duplicate_elements',
  'select_element', 'select_elements',
  // layout
  'align_elements', 'distribute_elements', 'arrange_row', 'arrange_column',
  'arrange_grid', 'center_in_canvas', 'place_at', 'constrain_elements',
  'align_to_element', 'fit_frame_around', 'fix_elements', 'snap_to_grid',
  // order + visibility
  'bring_to_front', 'send_to_back', 'bring_forward', 'send_backward',
  'lock_element', 'unlock_element', 'hide_element', 'show_element',
  // groups + canvas + history + misc reads
  'create_group', 'add_to_group', 'remove_from_group', 'dissolve_group',
  'resize_canvas', 'load_font', 'set_template_name', 'replace_defs',
  'undo_last_action', 'redo_last_action', 'batch_update_texts',
  'get_selected_elements', 'find_text_elements', 'measure_elements',
  'review_canvas_region', 'get_element_screenshot', 'get_region_screenshot',
  'list_groups', 'list_gradients', 'save_to_collection', 'insert_collection_item',
  'list_collection_items',
];

const DEFAULT_MAX_WEBMCP_TOOLS = 48;

function toContent(result) {
  const text = typeof result === 'string' ? result : JSON.stringify(result ?? null);
  const out = { content: [{ type: 'text', text }] };
  if (result && typeof result === 'object') out.structuredContent = result;
  return out;
}

/**
 * Registers every editor tool with the WebMCP runtime for the lifetime of the
 * component. `clientToolHandlers` is the map returned by EditorScreen (the same
 * object handed to useEditorAgent). Aliased `editor.*` duplicates are skipped.
 */
export function useWebMCP(clientToolHandlers, { enabled = true, onEvent } = {}) {
  // Keep the latest handler map in a ref so registered tools always call the
  // current closure without needing to re-register on every render.
  const handlersRef = useRef(clientToolHandlers);
  useEffect(() => { handlersRef.current = clientToolHandlers; }, [clientToolHandlers]);
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  const emit = useCallback((evt) => {
    try { onEventRef.current?.({ at: Date.now(), ...evt }); } catch { /* listener errors are not our problem */ }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let cancelled = false;

    ensureWebMcpPolyfill().then((modelContext) => {
      if (cancelled || controller.signal.aborted) return;
      if (!modelContext?.registerTool) {
        console.warn('[WebMCP] document.modelContext unavailable; editor tools not exposed.');
        return;
      }
      registerAll(modelContext);
    });

    return () => { cancelled = true; controller.abort(); };

    // Run a handler by name with arg normalization + activity events. Shared by
    // the discrete tools and the `call_editor_tool` dispatcher.
    async function runTool(name, rawArgs) {
      const key = String(name || '').replace(/^editor\./, '');
      const handler = handlersRef.current?.[key] || handlersRef.current?.[name];
      if (!handler) throw new Error(`No handler for tool "${name}"`);
      const callId = `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const cleanArgs = normalizeToolArgs(rawArgs) || {};
      // Tag the invocation so handlers that surface UI (lock overlay, question
      // modal) can attribute it to the external agent rather than "Ola".
      cleanArgs.__webmcp = true;
      emit({ type: 'call', id: callId, name: key, args: cleanArgs });
      try {
        const result = await handler(cleanArgs);
        emit({ type: 'result', id: callId, name: key, args: cleanArgs, result });
        return { ok: true, result };
      } catch (err) {
        const message = err?.message || String(err);
        emit({ type: 'error', id: callId, name: key, args: cleanArgs, error: message });
        return { ok: false, error: message };
      }
    }

    function registerAll(modelContext) {
      const register = (def) => {
        try {
          const p = modelContext.registerTool(def, { signal: controller.signal });
          if (p?.catch) p.catch((e) => console.warn('[WebMCP] registerTool failed', def.name, e));
        } catch (e) {
          console.warn('[WebMCP] registerTool threw', def.name, e);
        }
      };

      const allNames = Object.keys(clientToolHandlers || {}).filter((n) => !n.startsWith('editor.'));
      const envMax = Number(import.meta.env?.VITE_WEBMCP_MAX_TOOLS);
      const max = Number.isFinite(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_WEBMCP_TOOLS;

      // Meta tools first so they always fit.
      register({
        name: 'list_editor_tools',
        description: 'List every editor tool available through call_editor_tool (name + one-line description).',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        async execute() {
          return toContent(allNames.map((n) => ({ name: n, description: describe(n) })));
        },
      });
      register({
        name: 'call_editor_tool',
        description: 'Invoke any editor tool by name. Args: { tool: string, args?: object }. Use list_editor_tools / get_editor_guide to discover tools (e.g. the create_* component builders).',
        inputSchema: {
          type: 'object',
          properties: { tool: STR, args: { type: 'object', additionalProperties: true } },
          required: ['tool'],
          additionalProperties: true,
        },
        async execute(a) {
          const c = normalizeToolArgs(a) || {};
          const r = await runTool(c.tool, c.args || {});
          return r.ok
            ? toContent(r.result)
            : { content: [{ type: 'text', text: `Error: ${r.error}` }], isError: true };
        },
      });

      const budget = Math.max(0, max - 2);
      const handlerSet = new Set(allNames);
      const exposed = WEBMCP_CORE.filter((n) => handlerSet.has(n)).slice(0, budget);
      for (const name of exposed) {
        register({
          name,
          description: describe(name),
          inputSchema: inputSchemaFor(name),
          async execute(args) {
            const r = await runTool(name, args);
            return r.ok
              ? toContent(r.result)
              : { content: [{ type: 'text', text: `Error: ${r.error}` }], isError: true };
          },
        });
      }

      console.info(
        `[WebMCP] exposed ${exposed.length + 2} tools (${exposed.length} core + list_editor_tools + call_editor_tool); ` +
          `${allNames.length} total reachable via call_editor_tool.`,
      );
    }
  }, [enabled, clientToolHandlers, emit]);
}
