// WebMCP bridge: exposes every editor tool that "Ola" (the in-app AI assistant)
// can call to external AI agents via the W3C Web Model Context API.
//
// It registers each entry of `clientToolHandlers` (the same map passed to
// useEditorAgent) as a WebMCP tool on `document.modelContext`, so browser
// agents / extensions that speak WebMCP can drive the SVG editor with the exact
// same capabilities as the built-in assistant.

import { useCallback, useEffect, useRef } from 'react';
import '@mcp-b/global'; // side-effect: polyfills document.modelContext when absent
import { normalizeToolArgs } from './toolArgs.js';

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
  find_text_elements: 'Find text elements matching a query string. Args: { query, caseSensitive?, regex? }.',
  measure_elements: 'Return the combined bounding box and per-element metrics. Args: { ids }.',
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
  set_text: 'Set the text content (and optional text props) of a text element. Args: { id, text, ... }.',
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
  align_elements: 'Align elements to an edge or centre. Args: { ids, alignment, ... }.',
  distribute_elements: 'Distribute elements evenly. Args: { ids, axis, ... }.',
  constrain_elements: 'Keep elements inside the canvas with padding. Args: { ids?, padding?, ignoreIds? }.',
  arrange_row: 'Lay elements out in a horizontal row. Args: { ids, x?, y?, gap?, alignment? }.',
  arrange_column: 'Lay elements out in a vertical column. Args: { ids, x?, y?, gap?, alignment? }.',
  arrange_grid: 'Lay elements out in a grid. Args: { ids, x?, y?, columns?, colGap?, rowGap? }.',
  align_grid: 'Snap elements onto a grid alignment. Args: { ids, ... }.',
  snap_to_grid: 'Snap element positions (and optionally sizes) to a grid. Args: { ids?, gridSize?, snapSize? }.',
  align_to_element: 'Align elements relative to a reference element. Args: { ids, targetId, edge }.',
  fit_frame_around: 'Resize/position a frame element to wrap the given elements. Args: { frameId, ids, padding? }.',
  center_in_canvas: 'Centre elements within the canvas. Args: { ids, axis? }.',
  place_at: 'Place an element at a canvas anchor. Args: { id, anchor?, margin? }.',
  stack_center: 'Stack elements centred on a point. Args: { ids, cx?, cy?, preserveRelative? }.',
  load_font: 'Load a Google font and optionally apply it. Args: { fontFamily, ids?, applyToAll? }.',
  resize_canvas: 'Resize the canvas. Args: { width, height, constrain? }.',
  insert_svg: 'Parse and insert raw SVG markup. Args: { svg, placement? "original"|"center" (default "original", keeps coordinates) }.',
  replace_defs: 'Replace the canvas <defs> (gradients, variables, fonts). Args: { defs }. Prefer add_gradient for adding one gradient.',
  add_gradient: 'Define a gradient and get the fill string to use. Args: { type?: "linear"|"radial", stops: [{ offset: 0-100, stopColor, stopOpacity? }], id?, x1?,y1?,x2?,y2? | cx?,cy?,r? }. Returns { id, fill: "url(#id)" } — set that as an element fill.',
  list_gradients: 'List gradients currently defined on the canvas, with their url(#id) fill strings.',
  set_template_name: 'Set the template / document name. Args: { name }.',
  get_editor_guide: 'Return a guide explaining how to drive this SVG editor with these tools — call it before making changes. Optional args: { topic }.',
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
  align_elements: { ids: STR_ARRAY, alignment: STR, axis: STR },
  distribute_elements: { ids: STR_ARRAY, axis: STR, spacing: NUM },
  arrange_row: { ids: STR_ARRAY, x: NUM, y: NUM, gap: NUM, alignment: STR },
  arrange_column: { ids: STR_ARRAY, x: NUM, y: NUM, gap: NUM, alignment: STR },
  arrange_grid: { ids: STR_ARRAY, x: NUM, y: NUM, columns: NUM, colGap: NUM, rowGap: NUM },
  align_grid: { ids: STR_ARRAY },
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
    if (!enabled) return;
    const modelContext = typeof document !== 'undefined' ? document.modelContext : null;
    if (!modelContext?.registerTool) {
      console.warn('[WebMCP] document.modelContext unavailable; editor tools not exposed.');
      return;
    }

    const controller = new AbortController();
    const names = Object.keys(clientToolHandlers || {}).filter((n) => !n.startsWith('editor.'));

    for (const name of names) {
      try {
        const maybePromise = modelContext.registerTool(
          {
            name,
            description: describe(name),
            inputSchema: inputSchemaFor(name),
            async execute(args) {
              const handler = handlersRef.current?.[name];
              if (!handler) throw new Error(`No handler for tool "${name}"`);
              const callId = `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
              const cleanArgs = normalizeToolArgs(args) || {};
              emit({ type: 'call', id: callId, name, args: cleanArgs });
              try {
                const result = await handler(cleanArgs);
                emit({ type: 'result', id: callId, name, args: cleanArgs, result });
                return toContent(result);
              } catch (err) {
                const message = err?.message || String(err);
                emit({ type: 'error', id: callId, name, args: cleanArgs, error: message });
                return {
                  content: [{ type: 'text', text: `Error: ${message}` }],
                  isError: true,
                };
              }
            },
          },
          { signal: controller.signal },
        );
        if (maybePromise?.catch) maybePromise.catch((e) => console.warn('[WebMCP] registerTool failed', name, e));
      } catch (e) {
        console.warn('[WebMCP] registerTool threw', name, e);
      }
    }

    console.info(`[WebMCP] exposed ${names.length} editor tools to AI agents.`);
    return () => controller.abort();
  }, [enabled, clientToolHandlers, emit]);
}
