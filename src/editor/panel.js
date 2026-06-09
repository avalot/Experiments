// panel.js — Toolbar + Inspector. Pure UI bound to the store via `actions`.

import { FIELD_SCHEMA, NODE_TYPES } from '../model.js';

export function mountPanel({ store, actions, els }) {
  buildToolbar(els.toolbar, actions, store);
  const renderInspector = makeInspector(els.inspector, store, actions);

  // Keep the inspector + dolly readout in sync with the store.
  store.subscribe((evt) => {
    if (evt.type === 'select' || evt.type === 'scene' || evt.type === 'remove' || evt.type === 'add') {
      renderInspector();
    } else if (evt.type === 'update' && evt.id === store.state.selectedId) {
      renderInspector();
    }
  });
  renderInspector();
}

function btn(label, onClick, opts = {}) {
  const b = document.createElement('button');
  b.textContent = label;
  if (opts.title) b.title = opts.title;
  if (opts.className) b.className = opts.className;
  b.addEventListener('click', onClick);
  return b;
}

function buildToolbar(toolbar, actions, store) {
  toolbar.textContent = '';

  const group = (children) => {
    const g = document.createElement('div');
    g.className = 'tb-group';
    children.forEach((c) => g.appendChild(c));
    toolbar.appendChild(g);
  };

  const brand = document.createElement('div');
  brand.className = 'tb-brand';
  brand.textContent = '▸ Roadway';
  toolbar.appendChild(brand);

  group([
    btn('+ Section', () => actions.addNode('billboard'), { title: 'Add a billboard section' }),
    btn('+ Box', () => actions.addNode('box')),
    btn('+ Plane', () => actions.addNode('plane')),
    btn('+ Text', () => actions.addNode('text')),
  ]);

  group([
    btn('Duplicate', () => actions.duplicateSelected()),
    btn('Delete', () => actions.deleteSelected()),
    btn('Undo', () => store.undo()),
    btn('Redo', () => store.redo()),
  ]);

  // Dolly (edit-camera position along the road).
  const dollyWrap = document.createElement('label');
  dollyWrap.className = 'tb-dolly';
  dollyWrap.append('Walk');
  const dolly = document.createElement('input');
  dolly.type = 'range';
  dolly.min = '0';
  dolly.max = String(store.getScene().camera.depth);
  dolly.value = String(store.state.dolly);
  dolly.addEventListener('input', () => store.setDolly(Number(dolly.value)));
  store.subscribe((evt) => {
    if (evt.type === 'scene' || evt.type === 'camera') dolly.max = String(store.getScene().camera.depth);
    if (evt.type === 'dolly') dolly.value = String(store.state.dolly);
  });
  dollyWrap.appendChild(dolly);
  group([dollyWrap]);

  const previewBtn = btn('Preview ▶', () => {
    const previewing = actions.togglePreview();
    previewBtn.textContent = previewing ? '◼ Exit preview' : 'Preview ▶';
    previewBtn.classList.toggle('is-active', previewing);
  }, { className: 'tb-preview' });

  group([
    previewBtn,
    btn('Save JSON', () => actions.saveJSON()),
    btn('Load', () => actions.loadJSON()),
    btn('Export HTML', () => actions.exportHTML(), { className: 'tb-export' }),
  ]);
}

function makeInspector(inspector, store, actions) {
  return function render() {
    inspector.textContent = '';
    const node = store.getSelected();

    // Scene settings (always available, at the top).
    inspector.appendChild(sceneSettings(store, actions));

    if (!node) {
      const hint = document.createElement('p');
      hint.className = 'insp-empty';
      hint.textContent = 'Select an object on the canvas, or add one from the toolbar.';
      inspector.appendChild(hint);
      return;
    }

    const head = document.createElement('div');
    head.className = 'insp-head';
    head.textContent = node.type.toUpperCase();
    inspector.appendChild(head);

    const schema = FIELD_SCHEMA[node.type] || [];
    schema.forEach((field) => inspector.appendChild(fieldRow(node, field, store)));
  };
}

function fieldRow(node, field, store) {
  const row = document.createElement('label');
  row.className = 'insp-row insp-' + field.kind;
  const name = document.createElement('span');
  name.className = 'insp-label';
  name.textContent = field.label;
  row.appendChild(name);

  let input;
  if (field.kind === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 3;
  } else {
    input = document.createElement('input');
    input.type = field.kind === 'number' ? 'number' : field.kind === 'color' ? 'color' : 'text';
    if (field.kind === 'number' && field.step != null) input.step = String(field.step);
  }

  const current = node[field.key];
  if (field.kind === 'color') input.value = toHex(current) || '#888888';
  else input.value = current == null ? '' : current;

  const read = () => {
    if (field.kind === 'number') return Number(input.value);
    return input.value;
  };
  // Live (transient) while typing/dragging, committed on change/blur.
  input.addEventListener('input', () => store.updateNode(node.id, { [field.key]: read() }, { transient: true }));
  input.addEventListener('change', () => { store.updateNode(node.id, { [field.key]: read() }); store.commit(); });

  row.appendChild(input);
  return row;
}

function sceneSettings(store, actions) {
  const wrap = document.createElement('details');
  wrap.className = 'insp-scene';
  const sum = document.createElement('summary');
  sum.textContent = 'Scene settings';
  wrap.appendChild(sum);

  const scene = store.getScene();
  const cam = scene.camera;
  const env = scene.environment;

  const num = (label, value, step, onCommit) => {
    const row = document.createElement('label');
    row.className = 'insp-row insp-number';
    const s = document.createElement('span'); s.className = 'insp-label'; s.textContent = label;
    const inp = document.createElement('input'); inp.type = 'number'; inp.step = String(step); inp.value = String(value);
    inp.addEventListener('change', () => onCommit(Number(inp.value)));
    row.append(s, inp);
    return row;
  };

  wrap.appendChild(num('Perspective', cam.perspective, 20, (v) => store.setCamera({ perspective: v })));
  wrap.appendChild(num('Horizon Y %', cam.originY, 1, (v) => store.setCamera({ originY: v })));
  wrap.appendChild(num('Walk depth', cam.depth, 500, (v) => store.setCamera({ depth: v })));
  wrap.appendChild(num('Track vh', cam.trackVH, 25, (v) => store.setCamera({ trackVH: v })));

  // Sun toggle.
  const sunRow = document.createElement('label');
  sunRow.className = 'insp-row insp-check';
  const sunSpan = document.createElement('span'); sunSpan.className = 'insp-label'; sunSpan.textContent = 'Sun glow';
  const sun = document.createElement('input'); sun.type = 'checkbox'; sun.checked = env.sun !== false;
  sun.addEventListener('change', () => store.setEnvironment({ sun: sun.checked }));
  sunRow.append(sunSpan, sun);
  wrap.appendChild(sunRow);

  // Sky presets.
  const presets = {
    Dusk: 'radial-gradient(120% 75% at 50% 42%,#ffd9a0 0%,#ff9d6e 12%,#c5567f 32%,#5b3a8c 55%,#1b1f3b 78%,#0a0b16 100%)',
    Night: 'radial-gradient(120% 75% at 50% 42%,#9fc6ff 0%,#3b5e9e 14%,#21306a 38%,#121636 64%,#070912 100%)',
    Noon: 'radial-gradient(120% 80% at 50% 44%,#ffffff 0%,#cfe9ff 16%,#8fc0ef 40%,#5b86b8 66%,#2e3f57 100%)',
  };
  const skyRow = document.createElement('div');
  skyRow.className = 'insp-row insp-presets';
  Object.keys(presets).forEach((k) => {
    const b = document.createElement('button');
    b.textContent = k;
    b.addEventListener('click', () => store.setEnvironment({ skyCSS: presets[k] }));
    skyRow.appendChild(b);
  });
  wrap.appendChild(skyRow);

  // Project name.
  const nameRow = document.createElement('label');
  nameRow.className = 'insp-row insp-text';
  const ns = document.createElement('span'); ns.className = 'insp-label'; ns.textContent = 'Project name';
  const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = scene.meta.name;
  nameInput.addEventListener('change', () => { scene.meta.name = nameInput.value; store.commit(); });
  nameRow.append(ns, nameInput);
  wrap.appendChild(nameRow);

  return wrap;
}

// Accept hex passthrough; ignore non-hex (gradients/rgba) for the color input.
function toHex(v) {
  if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return v;
  return null;
}

export { NODE_TYPES };
