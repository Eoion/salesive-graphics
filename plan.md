Create a **template-ingestion step** after SVG export. The goal is not just “upload SVG,” but “turn SVG into a configurable template with named fields.”

## The model

Treat every uploaded SVG as two things:

1. **Raw artwork**
2. **Template schema** describing which parts are editable

Your system should let the template maker upload an SVG, preview it, click elements, and assign each one a role such as:

- text field
- image slot
- color field
- icon slot
- hidden/optional block

That schema is what your app uses later when an end user customizes the flyer.

---

## Recommended workflow

### 1. Designer creates the artwork

Have template makers build in Illustrator/Figma/Inkscape, then export as **SVG**.

### 2. Template maker uploads the SVG into your admin tool

Your app parses the SVG XML and extracts elements such as:

- `<text>` for text layers
- `<image>` for inserted images
- shape elements like `<rect>`, `<circle>`, `<path>`, etc.
- styling attributes like `fill`, `stroke`, and related presentation attributes. SVG uses `<text>` for rendered text, `<image>` for embedded images, and `fill`/`stroke` for painting shapes and text. Modern SVG uses `href` on image-like elements, while `xlink:href` is deprecated and mainly kept as fallback for older support. ([MDN Web Docs][1])

### 3. Show a visual mapper UI

In the admin tool:

- render the SVG
- let the template maker click an element
- show its current properties
- let them assign a field type and field name

Example:

- click headline text → map as `text.headline`
- click logo image → map as `image.logo`
- click blue background shape → map as `color.primary`
- click social icon group → map as `icon.instagram`

### 4. Save a template schema

Store:

- original SVG
- a normalized copy
- a JSON config describing editable mappings

### 5. Use that schema in the end-user editor

When the end user enters values, your renderer:

- loads the SVG
- finds the mapped elements
- replaces text/image/colors/icons
- exports PNG/JPG/SVG/PDF

---

## The key design decision

Do **not** rely on auto-detection alone.

Auto-detection can help, but the reliable system is:

- parse SVG
- expose selectable elements
- let a human confirm what each editable element is

That makes the template maker’s job predictable.

---

## Best practice for template makers

Ask template makers to follow a naming convention before export. In SVG, element IDs and attributes are easy to preserve and are the cleanest way to target elements later. SVG is XML-based and supports element-level attributes and IDs that can be modified through the DOM. ([MDN Web Docs][2])

Good examples:

- `headline_text`
- `subheadline_text`
- `cta_text`
- `hero_image`
- `logo_image`
- `primary_color`
- `secondary_color`
- `icon_facebook`

Then your mapper can pre-suggest editable fields from IDs.

---

## What your templater should do

Build an **admin-only template builder** with these screens:

### A. Upload screen

- upload SVG
- validate file
- parse XML
- store original dimensions from the root `<svg>` element / viewBox if present. The root `<svg>` element defines the viewport and coordinate system for the document. ([MDN Web Docs][3])

### B. Layer inspector

Show a list of detected elements:

- id
- tag type
- current text or href
- current fill/stroke
- visibility

Example row:

- `headline_text` — `<text>` — “Summer Sale”
- `hero_image` — `<image>` — current URL
- `bg_rect` — `<rect>` — `fill=#0044ff`

### C. Visual mapping canvas

Click any element in the preview and assign:

#### Editable type

- text
- multiline text
- image
- color
- icon
- boolean toggle
- enum/variant

#### Field key

- `headline`
- `subtitle`
- `productImage`
- `brandColor`

#### Constraints

- max characters
- font size min/max
- allowed colors or full picker
- allowed icon set
- image fit mode: contain/cover
- required or optional

### D. Output schema preview

Show the generated JSON schema and example form.

---

## Suggested schema format

Use something like this:

```json
{
    "templateId": "flyer-summer-01",
    "name": "Summer Flyer",
    "canvas": {
        "width": 1080,
        "height": 1350,
        "viewBox": "0 0 1080 1350"
    },
    "fields": [
        {
            "key": "headline",
            "type": "text",
            "target": {
                "selector": "#headline_text"
            },
            "default": "Summer Sale",
            "maxLength": 40
        },
        {
            "key": "subheadline",
            "type": "text",
            "target": {
                "selector": "#subheadline_text"
            },
            "default": "Up to 50% off"
        },
        {
            "key": "heroImage",
            "type": "image",
            "target": {
                "selector": "#hero_image"
            },
            "fit": "cover"
        },
        {
            "key": "primaryColor",
            "type": "color",
            "targets": [
                { "selector": "#bg_rect", "attr": "fill" },
                { "selector": "#cta_button", "attr": "fill" }
            ],
            "default": "#0044ff"
        },
        {
            "key": "instagramIcon",
            "type": "icon",
            "target": {
                "selector": "#social_icon"
            },
            "iconSet": "social"
        }
    ]
}
```

This is the core of the templater.

---

## How to identify editable elements

Use a mix of:

### 1. IDs

Best option.

Example SVG:

```xml
<text id="headline_text" x="80" y="220">Summer Sale</text>
<image id="hero_image" href="/placeholder.jpg" x="80" y="300" width="920" height="500"/>
<rect id="cta_button" x="80" y="900" width="260" height="90" fill="#0044ff"/>
```

### 2. Data attributes

Even better if you can inject them during prep.

Example:

```xml
<text id="headline_text" data-template-type="text" data-template-key="headline">Summer Sale</text>
```

### 3. Manual click mapping

Fallback when exported SVGs are messy.

---

## How each field type should work

### Text mapping

For `<text>`:

- replace text content
- optionally update `fill`, font size, weight, family
- enforce character limits

Important caveat: SVG text is not HTML text layout. Font-related properties and text positioning are SVG/CSS-driven, and text wrapping is not automatic in plain `<text>` the way HTML blocks behave. SVG text uses positioning attributes like `x`, and font properties can be applied via attributes or CSS. ([MDN Web Docs][4])

So for long text you should choose one of these:

- hard limit characters
- shrink font size automatically
- split across multiple `<tspan>` lines
- use `<foreignObject>` only if you accept more rendering complexity

For version 1, character limits plus optional auto-shrink is the safest choice.

### Image mapping

For `<image>`:

- replace `href`
- optionally also set `xlink:href` as fallback for older behavior
- preserve width/height/x/y from template
- support fit modes:
    - contain
    - cover
    - stretch

SVG `<image>` uses `href` to reference the image resource, and older `xlink:href` is deprecated. Data URLs are also valid if you want to inline small assets. ([MDN Web Docs][5])

### Color mapping

For shapes or text:

- edit `fill`
- maybe edit `stroke`
- maybe edit opacity

SVG coloring is commonly controlled by `fill` and `stroke`, and CSS properties can override presentation attributes when both are present. ([MDN Web Docs][6])

That means your mapper should inspect both:

- element attributes
- inline style values

### Icon mapping

There are two good ways:

#### Option A: icon as image

Map an `<image>` and swap `href`.

#### Option B: icon as vector group

Map a `<g>` or `<path>` cluster and replace it with a predefined SVG snippet from your icon library.

For consistency, keep icons in your own icon registry:

```json
{
    "social.instagram": "<svg>...</svg>",
    "social.facebook": "<svg>...</svg>"
}
```

Then replace the target group during render.

---

## What the admin UI should save

For every mapped field, save:

- field key
- field type
- selector or element id
- editable attributes
- default value
- validation rules
- transform rules

Example:

```json
{
    "key": "headline",
    "type": "text",
    "selector": "#headline_text",
    "editable": ["textContent", "fill", "font-size"],
    "rules": {
        "maxLength": 42,
        "autoShrink": true,
        "minFontSize": 28
    }
}
```

---

## Parsing strategy

On upload:

1. Parse SVG as XML
2. Normalize it
    - ensure IDs where possible
    - flatten weird wrappers if needed
    - collect text/image/shape candidates

3. Build an internal element index

Example internal model:

```ts
type SvgNodeInfo = {
    id: string | null;
    tag: string;
    textContent?: string;
    href?: string;
    fill?: string;
    stroke?: string;
    bbox?: { x: number; y: number; width: number; height: number };
};
```

Then the mapping UI works from this index.

---

## Important normalization rules

Real exported SVGs can be messy. Your ingestion step should handle:

- missing IDs
- grouped elements in `<g>`
- styles in `style=""` instead of attributes
- image references using either `href` or older `xlink:href`
- text split into multiple `<tspan>` nodes
- transforms on groups/elements

A practical rule:

- preserve the source SVG
- also create a normalized SVG for rendering in your system

---

## Recommended mapping UX

Give template makers two modes:

### Smart suggestions

Pre-suggest fields based on:

- IDs containing `text`, `title`, `headline`, `image`, `logo`, `icon`, `bg`, `color`
- elements of type `<text>` or `<image>`
- large filled shapes that are likely backgrounds/buttons

### Manual assignment

Click element → assign:

- type
- key
- options

This hybrid approach is much better than forcing perfect SVG exports.

---

## End-user rendering flow

Once a template is configured:

1. Load SVG
2. Load template schema
3. Apply values

Example:

- `headline = "Grand Opening"`
- `heroImage = uploaded file URL`
- `primaryColor = "#FF5500"`

4. Serialize updated SVG
5. Output:

- SVG directly
- PNG/JPG by rasterizing in browser or server

---

## Example render logic

Pseudo-code:

```js
function applyTemplate(svgDoc, schema, values) {
    for (const field of schema.fields) {
        const value = values[field.key];
        if (value == null) continue;

        if (field.type === "text") {
            const el = svgDoc.querySelector(field.target.selector);
            if (el) el.textContent = value;
        }

        if (field.type === "image") {
            const el = svgDoc.querySelector(field.target.selector);
            if (el) {
                el.setAttribute("href", value);
                el.setAttributeNS(
                    "http://www.w3.org/1999/xlink",
                    "xlink:href",
                    value,
                );
            }
        }

        if (field.type === "color") {
            for (const t of field.targets) {
                const el = svgDoc.querySelector(t.selector);
                if (el) el.setAttribute(t.attr, value);
            }
        }
    }

    return new XMLSerializer().serializeToString(svgDoc);
}
```

---

## One very useful enhancement

Add a **“Bind multiple elements to one field”** feature.

Example:
`primaryColor` updates:

- background rectangle
- CTA button
- accent underline
- icon fill

That makes branding changes easy.

---

## Another useful enhancement

Add **variants**.

Example:

- `layout = square | portrait | story`
- `theme = light | dark`

A single template can then expose multiple preset states instead of requiring separate SVGs.

---

## Practical constraints to enforce

Your templater should guard against:

- text overflow
- unsupported fonts
- remote images failing to load
- complex filters causing export issues
- external asset links inside SVG

For reliability, prefer:

- controlled fonts
- uploaded images you host yourself
- simple, flat SVG effects in version 1

---

## Recommended first version

Build these features first:

1. Upload SVG
2. Preview SVG
3. Click an element
4. Assign field type and field key
5. Save JSON schema
6. Fill sample values
7. Export rendered PNG/SVG

That is enough to prove the whole system.

---

## Best stack for this part

### Frontend

- React / Next.js
- render SVG inline in the DOM
- element click selection overlay

### Backend

- store uploaded SVG + template JSON
- optional rendering service for PNG/JPG export

### Storage

- template SVG
- normalized SVG
- template schema JSON
- uploaded user assets

---

## Best rule for template creators

Tell them:

- name important layers before export
- convert only decorative text to outlines if needed
- keep editable text as real `<text>`
- keep swappable images as real `<image>`
- avoid flattening everything into paths

That one rule will make your mapper much easier.

---

## Recommended overall structure

Use three artifacts per template:

- `template.original.svg`
- `template.normalized.svg`
- `template.schema.json`

That gives you a safe authoring workflow and a stable runtime format.

If you want, the next step is a concrete example of either the **template schema**, the **mapping UI**, or the **SVG parsing code** in React/Node.

[1]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/text?utm_source=chatgpt.com "<text> - SVG - MDN Web Docs - Mozilla"
[2]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute?utm_source=chatgpt.com "SVG Attribute reference - MDN Web Docs"
[3]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/svg?utm_source=chatgpt.com "<svg> - SVG - MDN Web Docs"
[4]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Texts?utm_source=chatgpt.com "Texts - SVG - MDN Web Docs"
[5]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image?utm_source=chatgpt.com "<image> - SVG - MDN Web Docs - Mozilla"
[6]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/fill?utm_source=chatgpt.com "fill - SVG - MDN Web Docs - Mozilla"
