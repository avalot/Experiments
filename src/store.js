// store.js — reactive scene store: mutations, selection, undo/redo, events.
// Editor modules talk to the scene only through here.

import { clone, createNode } from './model.js';

export function createStore(scene) {
  const subs = new Set();
  const history = [JSON.stringify(scene)];
  let hIndex = 0;

  const state = {
    scene,
    selectedId: null,
    dolly: 0,        // edit-mode camera position along the road
    mode: 'edit',    // 'edit' | 'preview'
  };

  function emit(evt) {
    subs.forEach((fn) => fn(evt));
  }

  function pushHistory() {
    history.splice(hIndex + 1);          // drop any redo branch
    history.push(JSON.stringify(state.scene));
    if (history.length > 200) history.shift();
    hIndex = history.length - 1;
  }

  function restore(snapshot) {
    state.scene = JSON.parse(snapshot);
    if (state.selectedId && !getNode(state.selectedId)) state.selectedId = null;
    emit({ type: 'scene' });
  }

  function getScene() { return state.scene; }
  function getNode(id) { return state.scene.nodes.find((n) => n.id === id) || null; }
  function getSelected() { return state.selectedId ? getNode(state.selectedId) : null; }

  return {
    state, subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    getScene, getNode, getSelected,

    loadScene(next, { resetHistory = true } = {}) {
      state.scene = next;
      state.selectedId = null;
      if (resetHistory) { history.length = 0; history.push(JSON.stringify(next)); hIndex = 0; }
      emit({ type: 'scene' });
    },

    addNode(node) {
      state.scene.nodes.push(node);
      state.selectedId = node.id;
      pushHistory();
      emit({ type: 'add', id: node.id });
      emit({ type: 'select', id: node.id });
      return node.id;
    },

    updateNode(id, patch, { transient = false } = {}) {
      const node = getNode(id);
      if (!node) return;
      Object.assign(node, patch);
      if (!transient) pushHistory();
      emit({ type: 'update', id, transient, keys: Object.keys(patch) });
    },

    removeNode(id) {
      const i = state.scene.nodes.findIndex((n) => n.id === id);
      if (i < 0) return;
      state.scene.nodes.splice(i, 1);
      if (state.selectedId === id) state.selectedId = null;
      pushHistory();
      emit({ type: 'remove', id });
    },

    duplicateNode(id) {
      const node = getNode(id);
      if (!node) return;
      const copy = clone(node);
      copy.id = createNode(node.type).id;   // fresh id
      copy.x += 80; copy.z += 80;
      return this.addNode(copy);
    },

    select(id) {
      if (state.selectedId === id) return;
      state.selectedId = id;
      emit({ type: 'select', id });
    },

    setCamera(patch) { Object.assign(state.scene.camera, patch); pushHistory(); emit({ type: 'camera' }); },
    setEnvironment(patch) { Object.assign(state.scene.environment, patch); pushHistory(); emit({ type: 'camera' }); },

    setDolly(v) { state.dolly = v; emit({ type: 'dolly' }); },

    commit() { pushHistory(); },   // seal a run of transient updates

    undo() { if (hIndex > 0) { hIndex -= 1; restore(history[hIndex]); } },
    redo() { if (hIndex < history.length - 1) { hIndex += 1; restore(history[hIndex]); } },
  };
}
