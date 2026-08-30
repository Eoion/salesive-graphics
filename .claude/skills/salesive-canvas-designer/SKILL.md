---
name: salesive-canvas-designer
description: >-
  Design finished graphics — social posts, flyers, promos, one-pagers — on the
  Salesive SVG canvas editor through its WebMCP tools (mcp__webmcp__*). Use
  whenever the connected WebMCP page exposes canvas tools such as add_element,
  insert_svg, add_gradient, take_screenshot, or the create_* component helpers,
  and the user wants something built, restyled, or laid out on that canvas.
  Covers the reliable build loop, the coordinate/anchor model, gradients,
  type via insert_svg, icons, the layout helpers, and the known broken tools to
  route around.
---

# Designing on the Salesive SVG canvas (WebMCP)

The connected page is a **fixed-size flat SVG canvas**. Elements are `rect`,
`text`, `image`, `line`, `path`, `circle` (`ellipse` = circle with `width != height`),
`polygon`, `star`, `arrow`. Every element has `id`, top-left `x`/`y` (numbers),
`width`/`height`, and style props `fill`, `stroke`, `strokeWidth`, `opacity`,
`rx`. You drive it entirely through `mcp__webmcp__*` tools — there is no file to
edit and no server.

Before touching anything: `get_editor_guide`, then `get_canvas_state` (or
`get_snapshot`). If the tools are deferred, load them with **one** `ToolSearch`
`select:` call listing every tool you expect to need.

**Only a core set (~46) is exposed as discrete WebMCP tools.** Reach anything
else — every `create_*` component builder, `stack_center`, `rename_group`,
`estimate_text`, `get_selected_elements`, screenshots of a single element/region,
etc. — with `call_editor_tool({ tool: "<name>", args: {…} })`.
`list_editor_tools` enumerates all ~100 with one-line descriptions.

## The build loop

1. `lock_canvas({reason})` — pair with `unlock_canvas` at the very end (and on abort).
2. `set_agent_identity({name})`, `set_template_name({name})`.
3. `resize_canvas` to the target (1080×1080 IG post, 1080×1350 IG portrait / flyer, 1080×1920 story).
4. Define gradients with `add_gradient` (see below). Build **back to front**:
   background rect → shapes/glows → images/icons → text last.
5. Shapes with `add_element` / `add_elements`. **Text with `insert_svg`** (see below).
6. Verify visually every few steps: `take_screenshot` returns a URL — download it
   (`curl`) and `Read` the PNG. `check_layout` catches overflow.
7. `unlock_canvas`.

Keep a scratch area or delete test elements when probing tools. Everything is
undoable (`undo_last_action` / `redo_last_action`).

## Coordinate & anchor model — the thing that bites

- `x`/`y` are the **top-left** of the element's box, in unscaled SVG units, origin top-left.
- **For `text` created via `insert_svg`, `x` is whatever the SVG says** — so with
  `text-anchor="middle"` you pass `x` = the horizontal center (e.g. `540` on a
  1080 canvas). The stored `x` stays the anchor point; `get_element` reports the
  anchor, `measure_elements` reports the *visible* box plus a separate `anchorX`.
- After creating text you may **only need to nudge `x`/`y` with `update_element`** —
  that works, including changing `y`.
- Layout tools (`align_*`, `arrange_*`, `distribute_elements`, `measure_elements`,
  …) operate on the **visible box**, so anchored text lines up with shapes.
- `set_text` accepts `text`, `fontSize`, `fontWeight`, `fontFamily`, `textAnchor`,
  `fill`, `fontStyle`, `letterSpacing`, `width`, `lineHeight`, `textWrap` — so
  restyling text (including resizing via `fontSize`) does not need a separate
  `update_element`.

## Text — always via `insert_svg`

`add_element({type:"text"})` works (auto-fits to one line when you omit `width`)
but `insert_svg` gives full control and keeps coordinates. Put **all copy for the
piece in one `insert_svg` call** so relative positions are preserved:

```
insert_svg({ svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">
  <text x="540" y="250" font-family="Arial, sans-serif" font-size="24"
        font-weight="700" letter-spacing="8" fill="#7b6cff"
        text-anchor="middle">VIRTUAL SUMMIT · FREE</text>
  <text x="540" y="430" font-family="Georgia, serif" font-size="150"
        font-weight="700" fill="#ffffff" text-anchor="middle">BUILD WEEK</text>
  ...
</svg>` })
```

- The `<svg>` `width`/`height` **must match the canvas size**.
- `text-anchor="middle"`/`"end"` are honored. `letter-spacing` works.
- **Custom fonts:** `load_font` fetches the font and embeds it as base64
  `@font-face`, so a font loaded that way *does* survive `take_screenshot`/export.
  It only reaches `insert_svg` text if you `load_font` **before** the insert and
  the family name matches exactly. When in doubt, stick to `Arial, sans-serif`,
  `Georgia, serif`, `Impact`, `Times New Roman`, generic families and get
  contrast from size/weight/case.
- You can include **icon `<path>`s and decorative shapes in the same `insert_svg`** —
  they render as real path elements at the coordinates given.
- One `insert_svg` = one undo step; each element gets its own id (`text_1`, `path_2`, …).
- Default placement is `"original"` (coordinates kept). Pass `placement:"center"`
  only if you want the group re-centered on the canvas.

## Gradients — `add_gradient`, not `replace_defs` markup

```
add_gradient({ id:"bg", type:"linear", x1:0,y1:0,x2:0,y2:1,
  stops:[{offset:0,stopColor:"#141235"},{offset:100,stopColor:"#241d5c"}] })
// → { fill:"url(#bg)" }  — use that string as any element's fill
```

- `offset` is **0–100 or 0–1** (a value in `(0,1]` is treated as a fraction ×100).
  `x1/y1/x2/y2` and radial `cx/cy/r` accept 0–1 fractions **or** 0–100 the same way.
- Radial: `type:"radial", cx:0.5, cy:0.5, r:0.5`. Great for soft glows —
  `stops:[{offset:0,stopColor:"#6d5cff",stopOpacity:0.55},{offset:100,stopColor:"#6d5cff",stopOpacity:0}]`
  on an oversized off-canvas circle.
- Gradient **text fill** (`fill:"url(#accent)"` on a `<text>`) is unreliable — use a solid color for type.
- `list_gradients` shows what's defined. A `url(#id)` that was never defined renders as nothing.
- `replace_defs({defs:{gradients:[...]}})` **merges** by id (keeps the rest);
  pass `{replace:true}` to wipe first. Do **not** pass raw SVG markup to it.

## Icons & images

- **`add_icon({ name })` resolves a Lucide icon name** (`"music"`, `"arrow-right"`,
  `"ArrowRight"`) to an inline SVG `image` element — this renders. Optional
  `size`, `color`, `x`, `y`. An **unknown name throws**; a remote `href` (CDN /
  http image URL) is still blocked and will not render.
- For full control, **draw icons yourself as `<path>` glyphs inside `insert_svg`**
  (Lucide-style 24×24 stroke paths, `stroke="#..." stroke-width="2" fill="none"
  stroke-linecap="round"`), or compose from `line`/`circle`/`rect`/`polygon`.
- For "photos" (speaker avatars, thumbnails): use a **`circle`/`rect` filled with
  a gradient or tint + initials text**, or `create_avatar` / `create_image_card`
  via `call_editor_tool` (they render as gray placeholders). Never rely on a real
  remote image loading.
- `rx` on `rect` renders (rounded corners / pills) — set `rx` alone, `ry` follows.
  Use it for buttons, chips, cards.

## Layout helpers — what works

| Tool | Status |
|---|---|
| `align_elements({ids, align:"left"\|"top"\|"center-h"\|…})` | ✅ honors `align`/`alignment`; `relativeTo:"group"` default for 2+ |
| `align_to_element({ids, targetId\|refId, align})` | ✅ |
| `arrange_row` / `arrange_column({ids, x, y, gap, alignment})` | ✅ honors the `x`/`y` origin |
| `arrange_grid({ids, x, y, columns, colGap, rowGap})` | ✅ |
| `align_grid({ids, x, y, columns})` | ✅ plain top-left grid by default; `align`/`valign` for in-cell placement |
| `distribute_elements({ids, axis, spacing})` | ✅ |
| `constrain_elements` / `snap_to_grid` / `center_in_canvas` / `place_at` / `stack_center` | ✅ |
| `fit_frame_around({ids, frameId, padding})` | ✅ resizes `frameId` in place |
| `measure_elements` / `estimate_text` / `check_layout` | ✅ (bounds are the visible box, even for anchored text) |
| `create_group` / `add_to_group` / `dissolve_group` / `rename_group` | ✅ |
| `save_to_collection` → `list_collection_items` → `get_collection_item` → `insert_collection_item` | ✅ full roundtrip (guests save to a local collection) |

Component helpers (`create_button`, `create_card`, `create_badge`, `create_navbar`,
`create_pricing_card`, `create_testimonial`, `create_rating`, `create_table`,
`create_list`, `create_tag_group`, `create_qr_placeholder`, …) — call via
`call_editor_tool` — work but need their content args: `create_table` wants
`headers`/`rows`, `create_list` wants `items`, `create_tag_group` wants `tags`;
`create_icon_grid`/`create_timeline`/`create_table_row` **throw with an example**
if you omit them. Component sub-text is blank unless you pass `text`/`title`. For
a bespoke design it is usually cleaner to hand-build with `add_element` +
`insert_svg` than to wrangle the helpers.

## Known-broken / avoid

- **Remote images** (`add_icon` with an `href`, any http image URL) — never render.
- **`replace_defs`** with raw SVG string — rejected; use the `{gradients:[...]}` shape.
- **`navigate_to_page`** — sandbox-restricted, returns a domain error.
- **`get_canvas_screenshot` / `take_screenshot`** — very occasionally returns a
  stale cached URL; re-call or mutate again.
- **WebMCP disabled** ("configuration exceeds supported limits"): the page trims
  its tool list, but if the agent runtime still refuses, it exposes fewer tools
  after a redeploy — reset the agent runtime and refresh the tab.
- **Bridge wedge:** if a mutation ever returns
  `Failed to execute 'structuredClone'… Promise could not be cloned`, the page is
  stuck — **every** write will fail until the user reloads the tab. Reads still
  work. Stop, tell the user to reload, resume from `get_canvas_state`.
- The canvas resets on page reload (fresh document); the element-id counter may or
  may not reset. Guest canvases persist to this browser only (and are dropped if
  storage fills — you'll see a warning toast). Finish in one session or
  `save_to_collection` the pieces.

## Design defaults for a professional result

- One background (solid or a low-contrast gradient), 1 accent hue, 1 neutral text color.
- Big type hierarchy: an all-caps kicker (~22–26px, wide letter-spacing), a
  display headline (110–160px), supporting lines (24–46px). Serif + sans pairing
  reads as "designed".
- Generous margins (≥80px), one clear focal element, a single CTA.
- Soft radial-gradient glows on a dark background; a gradient-filled `rx` pill for
  the CTA; a hairline `rect` (2–3px) as a divider.
- Verify the final frame with a screenshot from an actual `Read` of the PNG before
  declaring done.
