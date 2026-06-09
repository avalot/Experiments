// editor.js — bootstrap. Wires the store, the shared runtime, the panel, and
// canvas interactions together. Owns the edit/preview lifecycle and the
// id->element map for incremental DOM updates.

import { createScene, createNode } from '../model.js';
import { createStore } from '../store.js';
import { RUNTIME_CSS, buildNodeEl, applyNodeStyles, initWalk, renderScene } from '../runtime.js';
import { mountPanel } from './panel.js';
import { initInteractions } from './interactions.js';
import * as persistence from './persistence.js';

const TRANSFORM_KEYS = new Set(['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'scale']);

function boot() {
  // Inject the shared runtime CSS so the editor canvas matches the export 1:1.
  const style = document.createElement('style');
  style.textContent = RUNTIME_CSS;
  document.head.appendChild(style);

  const stage = document.getElementById('stage');
  const els = {
    toolbar: document.getElementById('toolbar'),
    inspector: document.getElementById('inspector'),
    hint: document.getElementById('hint'),
    fileInput: document.getElementById('fileInput'),
  };

  const store = createStore(persistence.loadAutosave() || createScene());

  // --- DOM rendering layer -------------------------------------------------
  let world;
  const nodeEls = new Map();
  let previewTeardown = null;

  function rebuildAll() {
    // renderScene paints the stage from data; we then take ownership of the
    // world transform so the dolly stays under editor control.
    renderScene(stage, store.getScene());
    world = stage.querySelector('.world');
    nodeEls.clear();
    for (const el of world.querySelectorAll('.node')) nodeEls.set(el.dataset.nodeId, el);
    applyDolly();
    applySelection();
  }

  function applyDolly() {
    if (store.state.mode === 'edit' && world) {
      world.style.transform = 'translateZ(' + store.state.dolly + 'px)';
    }
  }

  function applySelection() {
    nodeEls.forEach((el, id) => el.classList.toggle('is-selected', id === store.state.selectedId));
  }

  store.subscribe((evt) => {
    switch (evt.type) {
      case 'scene':
        rebuildAll();
        break;
      case 'camera':
        rebuildAll();   // perspective/sky changes re-apply cleanly via a rebuild
        break;
      case 'add': {
        const node = store.getNode(evt.id);
        if (node && world) { const el = buildNodeEl(node); world.appendChild(el); nodeEls.set(node.id, el); }
        applySelection();
        break;
      }
      case 'remove': {
        const el = nodeEls.get(evt.id);
        if (el) { el.remove(); nodeEls.delete(evt.id); }
        break;
      }
      case 'update': {
        const node = store.getNode(evt.id);
        const el = nodeEls.get(evt.id);
        if (!node || !el) break;
        const transformOnly = (evt.keys || []).every((k) => TRANSFORM_KEYS.has(k));
        if (transformOnly) {
          applyNodeStyles(el, node);                 // fast path (drag/nudge)
        } else {
          const fresh = buildNodeEl(node);           // content/size changed → rebuild node
          el.replaceWith(fresh);
          nodeEls.set(evt.id, fresh);
          fresh.classList.toggle('is-selected', evt.id === store.state.selectedId);
        }
        break;
      }
      case 'select':
        applySelection();
        break;
      case 'dolly':
        applyDolly();
        break;
    }
  });

  // --- Actions exposed to the panel ---------------------------------------
  const actions = {
    addNode(type) {
      const ahead = -store.state.dolly - 1500;       // spawn just in front of the camera
      const node = createNode(type, { z: ahead });
      store.addNode(node);
    },
    duplicateSelected() { const s = store.getSelected(); if (s) store.duplicateNode(s.id); },
    deleteSelected() { const s = store.getSelected(); if (s) store.removeNode(s.id); },
    saveJSON() { persistence.saveJSON(store.getScene()); },
    exportHTML() { persistence.exportHTML(store.getScene()); },
    loadJSON() { els.fileInput.value = ''; els.fileInput.click(); },
    togglePreview() { return togglePreview(); },
  };

  els.fileInput.addEventListener('change', async () => {
    const file = els.fileInput.files && els.fileInput.files[0];
    if (!file) return;
    try {
      const scene = await persistence.loadJSONFile(file);
      store.setDolly(0);
      store.loadScene(scene);
    } catch (e) {
      alert('Could not load file: ' + e.message);
    }
  });

  // --- Preview lifecycle ---------------------------------------------------
  function togglePreview() {
    if (store.state.mode === 'edit') {
      store.state.mode = 'preview';
      store.select(null);
      document.body.classList.add('previewing');
      world.style.transform = 'translateZ(0)';
      previewTeardown = initWalk(stage, store.getScene());
      return true;
    }
    if (previewTeardown) { previewTeardown(); previewTeardown = null; }
    store.state.mode = 'edit';
    document.body.classList.remove('previewing');
    window.scrollTo(0, 0);
    applyDolly();
    return false;
  }

  // --- Autosave ------------------------------------------------------------
  store.subscribe((evt) => {
    if (['add', 'remove', 'camera', 'scene'].includes(evt.type) ||
        (evt.type === 'update' && !evt.transient)) {
      persistence.autosave(store.getScene());
    }
  });

  // --- Go ------------------------------------------------------------------
  initInteractions({ store, stage });
  mountPanel({ store, actions, els });
  rebuildAll();
}

boot();
