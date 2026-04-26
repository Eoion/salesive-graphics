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
| Select | `V` | Select, move, resize, rotate elements. After placing any shape with a draw tool, the tool automatically returns to Select. |
| Rectangle | `U` | Draw rectangles / rounded rectangles |
| Circle | `E` | Draw ellipses and circles |
| Polygon | `P` | Draw regular N-sided polygons (triangle, hexagon, etc.) |
| Star | `S` | Draw star shapes with configurable arms and inner radius |
| Text | `T` | Place text labels (bounding box auto-sizes to rendered text) |
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
| **Duplicate selected** | **`Ctrl+D`** |
| **Command palette** | **`Ctrl+K`** |
| Group selected | `Ctrl+G` |
| Ungroup | `Ctrl+Shift+G` |
| **Toggle lock/unlock selected** | **`Ctrl+L`** |
| Snap to image scale | `Ctrl+Shift+M` |
| Multi-select toggle | `Shift` + click element |
| Marquee select | Drag on empty canvas space |
| Nudge element | Arrow keys (1 px) · `Shift` + Arrow (10 px) |

#### Command palette (`Ctrl+K`)

A spotlight-style search bar that opens as a floating overlay. Type anything to search across four categories simultaneously:

| Category | What it finds | Action |
|----------|---------------|--------|
| **Tool** | Drawing tools by name | Switches the active tool |
| **Element** | Canvas elements by id, type, text content, or description | Selects the element on the canvas |
| **Icon** | All Lucide icons by name | Inserts the icon at canvas center |
| **Docs** | Sections of this documentation by heading and content | Shows the matching section title and a snippet |

**Keyboard navigation inside the palette:**

| Key | Action |
|-----|--------|
| Type | Filter all categories at once |
| `↑` / `↓` | Move through results |
| `Enter` | Execute the highlighted result |
| `Escape` or `Ctrl+K` | Close the palette |

#### Snap to grid

Toggle the **Snap** button in the sub-bar to snap element positions to an 8 px grid while dragging.

#### Right panel tabs

The right panel has three tabs:

| Tab | Contents |
|-----|----------|
| **Properties** | Element properties, batch actions, and AI assistant configuration |
| **Layers** | Full layer list with group support — see [Layers panel](#layers-panel) below |
| **Ola** | AI assistant chat |

#### Element properties (Properties tab)

When an element is selected the Properties tab shows:

- **Description** — free-text notes about the element
- **Position & Size** — X, Y, W, H (numeric inputs); lock icon between W and H locks the aspect ratio so changing one dimension updates the other proportionally
- **Rotation** — degrees (0–359); also draggable via the circular handle above the selection box
- **Corner Radius** — rect elements only
- **Fill & Stroke** — color pickers + hex/rgb input; stroke width; **Stroke Dash** (solid / dashed / dotted); **Linecap** (Butt / Round / Square)
- **Opacity** — 0–100% slider
- **Text** — content, font size, weight, family, alignment, color (text elements only); bounding box auto-adjusts to actual rendered text
- **Image** — upload from device (converted to base64) or paste a URL; **Snap to Scale** button / `Ctrl+Shift+M` snaps the element to the nearest clean scale of the image's natural size (e.g. 0.5×, 1×, 2×)
- **Polygon** — number of sides (3–12, polygon elements only)
- **Star** — number of arms (3–12) and inner radius percentage slider (star elements only)
- **Arrow** — toggle arrowheads at start (←) and end (→) of the line (arrow elements only)

#### Element actions (left toolbar, when selected)

| Button | Effect |
|--------|--------|
| Forward | Bring element(s) one layer up |
| Backward | Send element(s) one layer down |
| **Duplicate** | Clone selected element(s) offset by 10 px (also `Ctrl+D`) |
| Show / Hide all | Toggle element(s) visibility |
| Lock all / Unlock all | Lock/unlock all selected elements |
| Delete elements | Remove all selected elements from canvas |
| Align to canvas | 6 alignment buttons (left, center-H, right, top, center-V, bottom) + "Center on canvas" |

**Multi-select tips:**
- Click to select a single element (clears multi-selection)
- `Shift`+click to add/remove element from multi-selection
- Drag on empty canvas to create a marquee and select all elements **fully or partially inside** the drawn rectangle
- Drag any selected element to move all of them together
- When multiple elements are selected, the Properties panel shows batch actions at the top (lock/unlock all, show/hide all, **group**, delete all)

#### Layers panel

Located in the **Layers** tab of the right dock. Shows all elements in reverse z-order (top of list = front of canvas). Groups appear as collapsible rows; their children are indented below.

| Interaction | Effect |
|-------------|--------|
| Click a row | Select that element (replaces selection) |
| `Shift`/`Ctrl`+click a row | Add/remove element from multi-selection |
| Click a group row | Select all members of that group |
| Click `▶` / `▼` chevron | Expand / collapse a group |
| Double-click a group name | Rename the group inline |
| Eye icon (hover) | Toggle element or group visibility |
| `×` button on a group row | Dissolve (ungroup) that group |
| **Group N** button (header) | Group all currently selected elements |

Dimmed rows are hidden elements; lock icon marks locked elements.

#### Groups

Elements can be grouped so that layout tools, the AI agent, and keyboard shortcuts treat them as a unit.

**Creating a group:**
- Select ≥ 2 elements → click **Group N elements** in the Properties panel Batch Actions section
- Select ≥ 2 elements → switch to the Layers tab → click **Group N** in the panel header
- `Ctrl+G` / `Cmd+G` keyboard shortcut (works with any current multi-selection)
- Select ≥ 2 elements → click the **Group** button in the floating quick-action bar above the selection

**Ungrouping:**
- Click the `×` button on a group row in the Layers panel
- `Ctrl+Shift+G` / `Cmd+Shift+G` keyboard shortcut (dissolves all groups that contain a selected element)
- Click the **Ungroup** button in the floating quick-action bar (shown when a selected element belongs to a group)

**Group behaviour:**
- Groups created by the AI agent (e.g. buttons, badges, stat blocks) appear automatically in the Layers panel
- Any tool that accepts element IDs also accepts a group ID — the group expands to all its members
- Deleting or duplicating a selection that covers a whole group preserves the group relationship on the copies
- Double-click a group name in the Layers panel to rename it

#### Rotation

- Drag the **circular handle** that appears above the top-center of the selection box
- Hold `Shift` while rotating to snap to 15° increments
- Type an exact angle in the **Rotation** field in the Properties panel

#### Keymap settings

Click the keymap name button in the sub-bar (shows "Photoshop") to open the keymap editor where you can re-bind any action or import a custom keymap JSON.

#### Sub-bar buttons

| Button | Action |
|--------|--------|
| **Snap** | Toggle 8 px grid snapping |
| **Paste SVG** | Open modal to paste SVG markup and import it onto the canvas |
| **Variables** | Manage reusable CSS color / value variables |
| **Inspect** | Hover to inspect elements (shows id, type, size); click to select. Also `Ctrl+I` |
| **−** / **+** | Zoom out / in |
| Zoom % input | Type a zoom percentage and press Enter |
| **Fit** | Fit canvas to viewport (`0`) |
| Keymap name | Open keymap / shortcut editor |
| **Save SVG** | Download canvas as `.svg` |
| **Map Fields** | Advance to the mapping step |

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
| **Theme toggle** | Top-right | Switch between light and dark mode; also `Ctrl+Shift+L` / `Cmd+Shift+L` |
| **Template name** | Centre (mapping / preview modes) | Click to rename the template |
| **Step indicator** | Centre | Shows current step (Edit · Map · Preview); click a past step to go back |
| **New Project** | Top-left | Clears everything and returns to the start screen |
| **Export Schema** | Top-right (preview only) | Downloads the schema JSON |

---

## Session Persistence

The app auto-saves your work to `localStorage`. If you close and reopen the browser tab, your canvas, mappings, template name, current step, and selected light/dark theme are restored automatically.

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

## Complete Keyboard & Command Reference

### Global

| Key | Action |
|-----|--------|
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Toggle light / dark mode |

### Tools

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

### Canvas Navigation

| Key / Input | Action |
|-------------|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` / `Ctrl+0` | Fit canvas to screen |
| Scroll wheel | Zoom toward cursor |
| `Space` + drag | Pan canvas |
| `Ctrl` + drag | Pan canvas |
| Middle-mouse drag | Pan canvas |

### Selection

| Key / Action | Result |
|--------------|--------|
| Click element | Select only that element |
| `Shift` + click | Add/remove element from multi-selection |
| Click empty canvas + drag | Marquee select all intersecting elements |
| `Ctrl+A` | Select last element in stack |
| `Escape` | Deselect all |
| Click layer row | Select that element |
| `Shift` + click layer row | Toggle in multi-selection |

### Editing

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Ctrl+D` | Duplicate selected element(s) (offset +10 px) |
| `Ctrl+K` | Open command palette (search elements, tools, icons, docs) |
| `Ctrl+]` | Bring element forward one layer |
| `Ctrl+[` | Send element backward one layer |
| `Ctrl+G` | Group selected elements (≥ 2 selected) |
| `Ctrl+Shift+G` | Ungroup — dissolves all groups containing a selected element |
| `Ctrl+L` | Toggle lock / unlock on all selected elements |
| `↑` `↓` `←` `→` | Nudge selected element 1 px |
| `Shift` + Arrow | Nudge 10 px |
| Double-click text | Open inline text editor |

### Rotation & Resize

| Key / Action | Result |
|--------------|--------|
| Drag rotate handle | Free rotate around center |
| `Shift` + drag rotate | Snap to 15° increments |
| Drag resize handle | Resize (free) |
| `Shift` + drag corner handle | Resize keeping aspect ratio (per element lock setting) |

### Tools & Modes

| Key | Action |
|-----|--------|
| `K` | Eyedropper — click element to copy fill; `Shift`+click to copy stroke |
| `Escape` | Cancel eyedropper / deselect |
| `Ctrl+I` | Toggle Inspect mode (hover to inspect, click to select) |
| `Ctrl+Shift+M` | Snap image to nearest clean natural scale (0.5×, 1×, 2×…) |

### Sub-bar Controls (Editor)

| Control | Action |
|---------|--------|
| **Snap** button | Toggle 8 px grid snap |
| **Paste SVG** button | Import SVG markup via modal |
| **Variables** button | Open CSS variable manager |
| **Inspect** button | Toggle element inspector overlay |
| Zoom % input | Type value + Enter to jump to that zoom level |
| **Fit** button | Fit canvas to viewport |
| Keymap name button | Open keymap / shortcut editor |
| **Save SVG** button | Download canvas as `.svg` |
| **Map Fields** button | Advance to mapping step |

---

## Output Files

| File | Format | How to get it |
|------|--------|--------------|
| `canvas.svg` | SVG | Click **Save SVG** in the editor sub-bar |
| `<id>.schema.json` | JSON | Click **Export Schema** in the top bar or preview screen |
