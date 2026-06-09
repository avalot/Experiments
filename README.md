# Roadway

A WYSIWYG editor for building scrollable **3D-CSS** pages where the reader
scrolls *up* to walk down a street that recedes to a single vanishing point.
Page sections stand up like roadside billboards; objects (boxes, planes,
floating text) dress the scene. Author live, then export a single
self-contained HTML file that runs anywhere — including iOS Safari.

See [`SPEC.md`](./SPEC.md) for the full design.

## Run the editor

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## Using it

- **Add** sections/objects from the toolbar. New items appear just ahead of you.
- **Select** by clicking a node; **drag** to move it (Shift-drag = depth `z`).
- **Inspector** (right) edits every property; **arrows** nudge the selection.
- **Walk** slider moves your edit-camera along the road.
- **Preview** runs the real published experience (scroll up to walk).
- **Save JSON** / **Load** the project; **Export HTML** publishes a standalone
  page. The exported file has no dependencies — open it directly on any device.

## Layout

```
index.html / editor.css   Editor shell + chrome
SPEC.md                   Design spec
src/
  model.js                Scene schema, defaults, factories
  store.js                Reactive store: mutations, selection, undo/redo
  runtime.js              Shared renderer + scroll "walk" + standalone exporter
  editor/
    editor.js             Bootstrap (wires everything)
    panel.js              Toolbar + Inspector
    interactions.js       Canvas selection, drag, keyboard
    persistence.js        JSON save/load, autosave, HTML export
```

The renderer in `runtime.js` is the single source of truth: the editor canvas
and the exported page run the exact same code, so the preview can't drift from
the published result.
