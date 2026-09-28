# ML Foundations

An interactive study site that explains the math behind ML models in four fixed sections:
**Multivariable calculus**, **Linear algebra**, **Intuition and 3D**, and **Statistics**.
The first concept is linear regression.

It is a static site: plain HTML, CSS and JavaScript, no build step and no backend.
three.js (3D) and MathJax (equations) load from a CDN.

## Project layout

```
index.html                      Page shell; loads everything below in order
css/styles.css                  All styling, colour tokens, light/dark themes
js/sections.js                  The four sections + the list of content files to load
js/helpers.js                   Shared math and UI helpers, and the VIZ registry
js/stage3d.js                   3D stage (rotate, pan, zoom, preset views, full screen, picking), labelled axes, primitives
js/canvas2d.js                  Helpers for 2D canvas plots
js/proj2d.js                    2D top-down views: equal-aspect axes, ticks, click and drag; level slider
js/lab/linalg.js                Small matrix toolkit (multiply, solve, inverse, rank, eigen)
js/lab/store.js                 Shared lab state: dataset, weights, selected row, presets
js/lab/ui.js                    Live matrix display, data table editor, weight sliders
js/viz/lab-feature.js           Lab 1: data, weights and the prediction plane
js/viz/lab-loss.js              Lab 2: loss surface, XᵀX, Hessian, gradient, ridge
js/viz/lab-gd.js                Lab 3: gradient descent step by step
js/viz/contour.js               Contours and gradient direction (rotate the ellipse, drag the point)
js/viz/diagnostics.js           Statistics: residual diagnostics playground
js/app.js                       Router, navigation, rendering; loads content and starts the app
js/mathjax-config.js            MathJax settings
content/<section>/<concept>.html   Page content, one file per section per concept
```

Pages carry a `data-part` attribute (for example Concepts, Derivation, Worked example, Labs);
the navigation groups pages by concept, then by part, in file order.

The three labs share one dataset and one set of weights (`js/lab/store.js`), saved in the
browser's localStorage, so a change in one lab shows up in the others. To add a preset dataset,
add an entry to `LAB_PRESETS` in that file.

## Run it locally

The app loads its content files with `fetch()`, which browsers block on `file://` pages,
so open it through a local server rather than double-clicking `index.html`:

```
cd ml-foundations
python -m http.server 8000
```

Then open http://localhost:8000. (Or `npx serve .` if you prefer Node.)

## Editing

**Change a page:** edit the `<template data-topic>` block in the relevant
`content/<section>/<concept>.html` file. Math uses `\( ... \)` inline and `\[ ... \]` for display.
Inside math, write `\lt` and `\gt` instead of `<` and `>`.

**Add a page:** copy an existing `<template>` block in the same file and give it a new `data-id`
and `data-title`. Order in the file is order in the navigation.

**Add a concept (e.g. logistic regression):**
1. Create `content/<section>/logistic-regression.html` for each section it touches, with
   `data-concept="Logistic regression"` on its templates.
2. Add those paths to `CONTENT_FILES` in `js/sections.js`.
The navigation groups pages by concept automatically.

**Add an interactive figure:**
1. Create `js/viz/<name>.js` with `VIZ.<name> = function(fig){ ...; return cleanupFn; }`.
2. Add a `<script src="js/viz/<name>.js">` line in `index.html` (before `js/app.js`).
3. Place `<figure class="viz" data-viz="<name>"></figure>` in any content template.
   Extra settings can be passed as `data-*` attributes (see `data-mode` in `loss.js`).

**Colours:** keep the colour language consistent. `--floor` (teal) for things on the floor,
`--surface` (violet) for surfaces, `--residual` (amber) for residuals and targets,
`--normal` (rose) for normals and descent paths. Defined at the top of `css/styles.css`.

## Deploy

See the deployment steps in the conversation, or in short: push this folder to a GitHub
repository, then enable **Settings → Pages → Deploy from a branch → main / (root)**.
Every push to `main` redeploys automatically.
