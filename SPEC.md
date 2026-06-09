# Roadway — a WYSIWYG editor for 3D-CSS "walk the street" pages

## 1. Goal

A browser tool for authoring scrollable 3D pages rendered entirely with CSS 3D
transforms. The signature experience: the reader scrolls **up** to walk forward
down a street that recedes to a single vanishing point on the horizon. Page
**sections** stand up like roadside billboards and rush into view as you advance;
decorative **objects** (boxes, planes, floating text) dress the scene.

The author works in a live WYSIWYG canvas — the same renderer the published page
uses — adding sections and objects, moving them in 3D, editing content, then
**exporting a standalone, dependency-free HTML file** that runs anywhere
(including iOS Safari) by just opening it.

## 2. Design principles

1. **One renderer, two consumers.** The runtime that paints a scene is shared
   verbatim by the editor canvas and the exported page. No "preview vs. real"
   drift is possible because they are the same code.
2. **Scene is plain data.** The whole page is a JSON document. Everything the
   editor does is a mutation of that document; rendering is a pure function of it.
3. **Export is self-contained.** The exporter inlines the runtime functions
   (via `Function.prototype.toString`) and the scene JSON into a single `.html`.
   No modules, no network, no build step for the output.
4. **Modular, framework-free.** Vanilla ES modules, one responsibility each.
   Swapping the renderer, the persistence layer, or adding a node type touches
   one module.

## 3. Architecture

```
index.html            Editor shell: <div id="stage"> + chrome containers
editor.css            Editor chrome styling only (toolbar/inspector/etc.)
src/
  model.js            Scene schema, defaults, factories, ids, cloning
  store.js            Reactive scene store: mutations, selection, undo/redo, events
  runtime.js          SHARED RUNTIME — renders a scene to DOM + the scroll "walk".
                      Also owns the standalone-HTML exporter. The only module
                      whose functions are inlined into exports.
  editor/
    persistence.js    Save/Load JSON, localStorage autosave, Export HTML
    panel.js          Toolbar + Inspector UI, bound to the store
    interactions.js   Canvas selection, drag-to-move, keyboard nudges
    editor.js         Bootstraps: wires store + runtime + panel + interactions
```

### Module contracts

**model.js**
- `createScene()` → default scene (the dusk street with starter billboards).
- `createNode(type, patch)` → node with type defaults merged with `patch`.
- `NODE_TYPES` → `['billboard','box','plane','text']`.
- `FIELD_SCHEMA[type]` → ordered inspector field descriptors (drives panel.js).
- `uid()`, `clone(obj)`.

**store.js** — `createStore(scene)` returns:
- reads: `getScene()`, `getNode(id)`, `getSelected()`, `state` (`selectedId`,
  `dolly`, `mode`).
- mutations (each emits an event, most push undo history):
  `loadScene`, `addNode`, `updateNode(id, patch, {transient})`, `removeNode`,
  `duplicateNode`, `select`, `setCamera`, `setEnvironment`, `setDolly`, `commit`,
  `undo`, `redo`.
- `subscribe(fn)` → `fn({type, id})`. Event types: `scene` (rebuild all),
  `add`, `update`, `remove`, `select`, `camera`, `dolly`.
- History: snapshots of the scene JSON; `transient` updates (live drag/slider)
  skip history and are sealed by a later `commit()`.

**runtime.js** (the shared, inline-able core)
- `RUNTIME_CSS` — string. Stage/world/road/node visual rules.
- `applyCamera(stage, scene)` — perspective, vanishing point, sky, sun.
- `buildRoad(road)` → road plane element.
- `buildNodeEl(node)` → DOM element for a node (per-type structure + content).
- `applyNodeStyles(el, node)` — writes only the 3D `transform` (fast path for drag).
- `renderScene(stage, scene)` → clears + builds stage; returns `{ world }`.
- `initWalk(stage, scene)` → wires scroll→`translateZ`; returns `teardown()`.
- `RUNTIME_FUNCS` — the array of the above functions, in dependency order, used
  by the exporter for inlining.
- `buildStandaloneHTML(scene)` → complete self-contained `.html` string.

**editor/** modules depend on store + runtime; runtime depends on nothing.

## 4. Coordinate system

World origin is screen-center; children of `.world` are placed by their own
`transform`. Units are CSS px.

- `x` — across the road (− left, + right).
- `y` — vertical (− up, + down; the road sits at a positive `y`).
- `z` — depth (**negative = into the distance**). The camera plane is `z = 0`.
- `rotX/rotY/rotZ` (deg), `scale`.

The world is dollied forward by `translateZ(dolly)`. A node's distance from the
camera is `zEff = z + dolly`; its on-screen scale is `P / (P − zEff)` for
perspective `P`. The reader "walks" by ramping `dolly` from `0` to `camera.depth`.

## 5. The "walk" (scroll model)

- Page is `camera.trackVH` tall (default 400vh). Reader **scrolls up** to advance:
  progress `p = 1 − scrollY/maxScroll`, `dolly = p · depth`.
- Loads anchored at the bottom: `scrollTo(0, 1e7)` (browser clamps to true
  bottom, robust to the iOS toolbar settling), retried on a few timers until the
  first user gesture. `history.scrollRestoration = 'manual'`.
- JS-driven on every browser for consistent feel and iOS Safari support.

In the editor, **Edit mode** disables the walk and exposes a *dolly* slider to
move along the road; **Preview mode** hides the chrome and runs `initWalk`
exactly as the export does.

## 6. Node types

| type        | role            | key fields                              |
|-------------|-----------------|-----------------------------------------|
| `billboard` | a page section  | `num`, `title`, `body`, `w`, `h`, `color` |
| `box`       | 3D cuboid prop  | `w`, `h`, `d`, `color`                  |
| `plane`     | flat quad/image | `w`, `h`, `color`, `image`              |
| `text`      | floating 3D text| `text`, `size`, `color`                 |

All share the transform fields (`x,y,z,rotX,rotY,rotZ,scale`). Adding a type =
extend `NODE_TYPES`, `FIELD_SCHEMA`, and `buildNodeEl`'s switch. Nothing else.

## 7. Authoring interactions

- **Add**: toolbar buttons (Add Section, Add Box/Plane/Text). New nodes spawn a
  short distance ahead of the current dolly so they're immediately visible.
- **Select**: click a node on the canvas (its DOM element); click empty space to
  deselect. Selected node shows an outline; the Inspector binds to it.
- **Move (WYSIWYG drag)**: drag a selected node to move it in the screen plane;
  the screen delta is divided by the node's perspective scale so it tracks the
  cursor at any depth. Hold **Shift** to drag depth (`z`) instead of `y`.
- **Inspector**: numeric/text/color fields for every property; `input` =
  transient (live), `change`/blur = committed (undoable).
- **Keyboard**: arrows nudge `x`/`z`, Shift+arrows nudge `y`; Delete removes;
  Ctrl/Cmd+Z / +Shift+Z undo/redo; Ctrl/Cmd+S saves JSON.

## 8. Persistence & output

- **Autosave** to `localStorage` on every commit; restored on load.
- **Save/Load `.json`** — the portable project document (the Scene).
- **Export `.html`** — `buildStandaloneHTML(scene)`: `RUNTIME_CSS` + inlined
  `RUNTIME_FUNCS` + `const SCENE = …` + bootstrap. Opens and runs anywhere.

## 9. Non-goals (v1)

Multi-select, snapping/grid, asset uploads (images are URLs), curved roads,
collaborative editing. The data model and module seams leave room for these.

## 10. Running

The editor uses ES modules, so serve the folder (modules don't load from
`file://`): `python3 -m http.server` → open `http://localhost:8000/`. The
**exported** page has no such constraint — open it directly.
