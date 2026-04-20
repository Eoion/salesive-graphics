# SVG Template Builder — Documentation

A three-step tool for creating dynamic SVG templates: **Edit → Map → Preview**.

---

## The Three-Step Flow

### Step 1 — Upload or Draw

On launch you land on the start screen. Two entry points:

| Option | How |
|--------|-----|
| **Upload SVG** | Drag & drop an `.svg` file onto the zone, or click to browse |
| **New Canvas** | Click "New Canvas" → choose a preset or enter a custom size |

**Canvas presets:**

| Name | Size |
|------|------|
| Instagram Post | 1080 × 1080 |
| Story / Reel | 1080 × 1920 |
| Flyer Portrait | 794 × 1123 |
| Banner 16:9 | 1920 × 1080 |
| Custom | any width × height in px (100–8000) |

A **Load demo SVG** shortcut is available at the bottom of the start screen to explore the tool instantly.

---

### Step 2 — Editor

A vector drawing canvas where you design or edit your template before mapping fields.

#### Tools (left toolbar)

| Tool | Key | Description |
|------|-----|-------------|
| Select | `V` | Select, move, resize, rotate elements |
| Rectangle | `U` | Draw rectangles / rounded rectangles |
| Circle | `E` | Draw ellipses and circles |
| Polygon | `P` | Draw regular N-sided polygons (triangle, hexagon, etc.) |
| Star | `S` | Draw star shapes with configurable arms and inner radius |
| Text | `T` | Place text labels |
| Image | `I` | Place image placeholder boxes |
| Line | `L` | Draw straight lines |
| Arrow | `A` | Draw lines with arrowheads |
| Eyedropper | `K` | Sample fill/stroke color from another element |

#### Canvas navigation

| Action | Input |
|--------|-------|
| Zoom in | Scroll wheel up · `+` / `=` key |
| Zoom out | Scroll wheel down · `-` key |
| Pan | Hold `Space` + drag · Middle-mouse drag · Hold `Ctrl` + drag |
| Fit canvas to screen | `0` or `Ctrl+0` · click **Fit** button |
| Set zoom level | Type a percentage in the zoom input (press Enter or click away to apply) |

#### Editing shortcuts

| Action | Key |
|--------|-----|
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Delete selected | `Delete` or `Backspace` |
| Deselect | `Escape` |
| Bring forward | `Ctrl+]` |
| Send backward | `Ctrl+[` |
| Snap to image scale | `Ctrl+Shift+M` |
| Multi-select toggle | `Shift` + click element |
| Marquee select | Drag on empty canvas space |

#### Snap to grid

Toggle the **Snap** button in the sub-bar to snap element positions to an 8 px grid while dragging.

#### Element properties (right panel)

When an element is selected the right panel shows:

- **Description** — free-text notes about the element
- **Position & Size** — X, Y, W, H (numeric inputs); lock icon between W and H locks the aspect ratio so changing one dimension updates the other proportionally
- **Rotation** — degrees (0–359); also draggable via the circular handle above the selection box
- **Corner Radius** — rect elements only
- **Fill & Stroke** — color pickers + hex/rgb input; stroke width; **Stroke Dash** (solid / dashed / dotted); **Linecap** (Butt / Round / Square)
- **Opacity** — 0–100% slider
- **Text** — content, font size, weight, family, alignment, color (text elements only)
- **Image** — upload from device (converted to base64) or paste a URL; **Snap to Scale** button / `Ctrl+Shift+M` snaps the element to the nearest clean scale of the image's natural size (e.g. 0.5×, 1×, 2×)
- **Polygon** — number of sides (3–12, polygon elements only)
- **Star** — number of arms (3–12) and inner radius percentage slider (star elements only)
- **Arrow** — toggle arrowheads at start (←) and end (→) of the line (arrow elements only)

#### Element actions (left toolbar, when selected)

| Button | Effect |
|--------|--------|
| Forward | Bring element(s) one layer up |
| Backward | Send element(s) one layer down |
| Show / Hide all | Toggle element(s) visibility |
| Lock all / Unlock all | Lock/unlock all selected elements |
| Delete elements | Remove all selected elements from canvas |
| Align to canvas | 6 alignment buttons (left, center-H, right, top, center-V, bottom) + "Center on canvas" |

**Multi-select tips:**
- Click to select a single element (clears multi-selection)
- `Shift`+click to add/remove element from multi-selection
- Drag on empty canvas to create a marquee and select all intersecting elements
- Drag any selected element to move all of them together
- When multiple elements are selected, properties panel shows batch actions at the top (lock/unlock all, show/hide all, delete all) |

#### Layers panel

Located at the bottom of the left toolbar. Shows all elements in stacking order (top = front).

- **Click** a layer row to select that element (clears multi-selection)
- **Shift+click** a layer row to add/remove that element from multi-selection without clearing it
- **Drag** a row to reorder it (grab the `⠿` handle on the left)
- Multi-selected rows show highlighted background; dimmed rows are hidden elements; lock icon marks locked elements

#### Rotation

- Drag the **circular handle** that appears above the top-center of the selection box
- Hold `Shift` while rotating to snap to 15° increments
- Type an exact angle in the **Rotation** field in the Properties panel

#### Keymap settings

Click the keymap name button in the sub-bar (shows "Photoshop") to open the keymap editor where you can re-bind any action or import a custom keymap JSON.

#### Exiting the editor

- **Save SVG** — downloads the canvas as a standalone `.svg` file
- **Map Fields →** — advances to Step 2 (Mapping)

---

### Step 3 — Mapping

Assign dynamic data fields to SVG elements so the template can be populated programmatically.

#### Layout

| Panel | Purpose |
|-------|---------|
| **Left** — Layer inspector | Lists all SVG nodes; click to select |
| **Centre** — Canvas | Live SVG view; click any element to select it |
| **Right** — Field mapper | Configure the selected element's data field |

#### Mapping a field

1. Click any element in the canvas or layer list
2. In the right panel, choose a **Field Type**:

| Type | Use for |
|------|---------|
| **Text** | Swappable text content |
| **Image** | Swappable image (URL / base64) |
| **Color** | Fill or stroke color |
| **Icon** | Icon slot |
| **Toggle** | Show / hide element |
| **Variant** | Enum — choose from a fixed list of options |

3. Fill in:
   - **Field key** — the JSON key used in the schema (e.g. `headline_text`)
   - **Label** — human-readable label shown in forms
   - **Default value** — fallback when no value is provided
   - **Required** — mark the field as required in the schema
4. Type-specific options:
   - Text: Max length, Auto-shrink font, Min font size
   - Image: Fit mode (cover / contain / stretch)
   - Variant: Comma-separated options list
5. Click **Save mapping**

To remove a mapping, open the mapped element and click **Remove mapping**.

#### Sub-bar

| Button | Action |
|--------|--------|
| Back to Editor | Return to the drawing canvas (keeps all elements) |
| Preview → | Advance to the schema preview |

---

### Step 4 — Preview

Two tabs:

#### Schema JSON tab

Displays the generated JSON schema for the template. Click **Download JSON** to save it as a `.schema.json` file.

#### Preview & Form tab

- Renders the SVG live with test values you enter
- Fill in each mapped field in the form on the right; the canvas updates in real time
- Use this to verify the template looks correct before exporting

#### Sub-bar

| Button | Action |
|--------|--------|
| Back to Mapping | Return to the field mapper |
| Export Schema | Download the `.schema.json` file |

---

## Top Bar

| Control | Location | Purpose |
|---------|----------|---------|
| **Template name** | Centre (mapping / preview modes) | Click to rename the template |
| **Step indicator** | Centre | Shows current step (Edit · Map · Preview); click a past step to go back |
| **New Project** | Top-left | Clears everything and returns to the start screen |
| **Export Schema** | Top-right (preview only) | Downloads the schema JSON |

---

## Session Persistence

The app auto-saves your work to `localStorage`. If you close and reopen the browser tab, your canvas, mappings, template name, and current step are restored automatically.

To start fresh: click **New Project** in the top bar.

---

## SVG Upload Notes

- Supported: any `.svg` file
- Elements parsed: `rect`, `circle`, `ellipse`, `text`, `image`, `line`, `polygon` (with `data-type`), `g` (arrow groups)
- Colors defined in inline `style="fill:..."` attributes are fully supported
- SVGs using `width="100%"` or other relative sizes are sized from their `viewBox`
- Full-canvas white/transparent background rectangles are automatically removed on import
- Groups (`<g>`) and other containers are traversed; their children are flattened into the layer list

---

## Keyboard Shortcut Reference

### Editor — Tools

| Key | Tool |
|-----|------|
| `V` | Select |
| `U` | Rectangle |
| `E` | Circle / Ellipse |
| `P` | Polygon |
| `S` | Star |
| `T` | Text |
| `I` | Image |
| `L` | Line |
| `A` | Arrow |
| `K` | Eyedropper |

### Editor — Canvas

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` / `Ctrl+0` | Fit canvas to screen |
| `Space` + drag | Pan canvas |
| `Ctrl` + drag | Pan canvas |
| Middle-mouse drag | Pan canvas |
| Scroll wheel | Zoom toward cursor |

### Editor — Editing

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected element |
| `Escape` | Deselect |
| `Ctrl+A` | Select last element |
| `Ctrl+]` | Bring forward |
| `Ctrl+[` | Send backward |
| `Ctrl+Shift+M` | Snap image element to nearest clean scale (0.5×, 1×, 2×…) |
| `Shift` + rotate handle | Snap rotation to 15° |
| `Ctrl+Shift+C` | Toggle element inspector (hover to inspect, click to select) |

#### Eyedropper (`K`)

1. Select the element you want to recolor
2. Press `K` (or click Eyedropper in the toolbar)
3. Click any element to copy its **fill** color onto your selection
4. `Shift`+click to copy the **stroke** color instead
5. Press `Escape` to cancel without making any change

---

## Output Files

| File | Format | How to get it |
|------|--------|--------------|
| `canvas.svg` | SVG | Click **Save SVG** in the editor sub-bar |
| `<id>.schema.json` | JSON | Click **Export Schema** in the top bar or preview screen |
