# CLAUDE.md — Roadway

Context for Claude Code working on this repo. Read this first.

## What this project is

**Roadway** is a WYSIWYG editor for building scrollable **3D-CSS** pages. The
signature experience: the reader scrolls **up** to walk forward down a street
that recedes to a single vanishing point on the horizon. Page **sections** stand
up like roadside billboards and rush into view as you advance; **objects**
(boxes, planes, floating text) dress the scene.

The author works in a live canvas, then **exports a single self-contained HTML
file** that runs anywhere (including iOS Safari) by just opening it.

Full design rationale lives in [`SPEC.md`](./SPEC.md). User-facing notes in
[`README.md`](./README.md).

## Architecture (the one thing to internalize)

**One renderer, two consumers.** `src/runtime.js` renders a scene (plain JSON)
to DOM and drives the scroll "walk". The **editor canvas** and the **exported
page** run the *exact same* runtime code, so the preview cannot drift from the
published result. The scene is plain data; rendering is a pure function of it.

```
index.html / editor.css   Editor shell + chrome (chrome styling ONLY)
SPEC.md, README.md        Design spec / usage
src/
  model.js     Scene schema, node types (billboard|box|plane|text), factories,
               FIELD_SCHEMA (drives the inspector UI)
  store.js     Reactive store: mutations, selection, undo/redo, event pub/sub
  runtime.js   SHARED runtime: renderScene, buildNodeEl, applyNodeStyles,
               buildRoad, applyCamera, initWalk, + buildStandaloneHTML exporter
  editor/
    editor.js        Bootstrap; owns id->DOM map + edit/preview lifecycle
    panel.js         Toolbar + Inspector (built from model.FIELD_SCHEMA)
    interactions.js  Canvas select, drag-to-move, keyboard nudges
    persistence.js   JSON save/load, localStorage autosave, HTML export
```

### Critical constraint: runtime.js must stay inline-able

`buildStandaloneHTML` serializes the functions in `RUNTIME_FUNCS` via
`Function.prototype.toString()` and pastes them into the exported HTML. So every
function listed in `RUNTIME_FUNCS` (`applyNodeStyles`, `buildNodeEl`, `buildRoad`,
`applyCamera`, `renderScene`, `initWalk`) **must be self-contained**: no imports,
no module-scope references, no closures over outer state. If you make one of them
depend on a module constant, the export breaks at runtime (the name is undefined
in the exported page). Keep defaults inlined as literals inside those functions.

`RUNTIME_CSS` is a string constant, also inlined into exports — keep scene-visual
CSS there, keep editor-chrome CSS in `editor.css`.

## Coordinate system

World origin = screen center. Children of `.world` placed by their own transform.
Units are CSS px.
- `x` across the road (− left / + right), `y` vertical (− up / + down; road sits
  at positive y), `z` depth (**negative = into the distance**, camera plane z=0).
- `rotX/rotY/rotZ` (deg), `scale`.
- World dollies forward via `translateZ(dolly)`; reader "walks" by ramping dolly
  `0 → camera.depth`. On-screen scale of a node = `P / (P − (z + dolly))`.

## The walk / scroll model

JS-driven on every browser (for consistency + iOS Safari, which lacks CSS
scroll-timelines). Page is `camera.trackVH` tall; **scroll up to advance**
(`p = 1 − scrollY/maxScroll`). Loads anchored at the bottom via
`scrollTo(0, 1e7)` (browser clamps to true bottom — robust to the iOS toolbar
settling), retried on timers until the first user gesture. See `initWalk`.

## Running

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000   # open http://localhost:8000/
```

The **exported** HTML has no such constraint — open it directly.

## Adding a node type (the common extension)

1. `model.js`: add to `NODE_TYPES`, add defaults in `TYPE_DEFAULTS`, add a
   `FIELD_SCHEMA[type]` entry.
2. `runtime.js`: add a branch in `buildNodeEl`. (Transform handling in
   `applyNodeStyles` is generic — no change needed.)
That's it; the inspector, store, persistence, and export all flow from there.

## Conventions

- Vanilla ES modules, **no dependencies, no build step**. Keep it that way.
- Match the existing terse style in `runtime.js` (it's written to read well when
  inlined into an export).
- Mutations go through the store; never mutate `scene` directly in editor code
  (except via the store's methods).
- Transient updates (live drag/typing) skip undo history and are sealed by a
  later `store.commit()`.

## Verifying changes

There's no test suite, but the runtime is headless-testable. The repo has been
smoke-tested with Playwright (global install) by serving on a port and driving
the editor: add node, dolly, preview-walk, then loading `buildStandaloneHTML`
output in a fresh page and asserting it renders with no console errors. Re-run
that pattern after runtime changes. Also: open Preview and confirm scroll-up
advances; export and open the file directly to confirm it's truly standalone.

## Open threads / backlog

- On-canvas gizmo: drag handles for rotate & scale (currently inspector-only).
- Asset uploads: images are URLs only today (`plane.image`, no embedding).
- Multi-select + group move.
- Roadside prop presets (lampposts, trees, signs) for stronger depth cues.

## Handoff note: the `potager` vhost (local only)

The user wants to serve this locally via a `potager` CLI ("we built it") to set
up a local vhost. **`potager` does not exist in this repo or in the cloud
sandbox** — it's a tool on the user's own machine, which is why it's only
reachable from the local Claude Code CLI, not the web environment. When picking
this up locally:
- Confirm what `potager` does (`potager --help`) before assuming flags.
- Roadway is a plain static site (no server-side anything), so any static vhost
  pointing its docroot at this repo will serve `index.html`. If `potager` needs
  an SPA-style fallback, note the editor is a single page at `/` and exports are
  standalone files the user downloads — there are no client-side routes to
  rewrite.
- The exported HTML is fully self-contained (no asset paths), so it works under
  any host/origin without configuration.
