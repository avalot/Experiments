// interactions.js — canvas selection, drag-to-move, keyboard nudges.
// Active only in edit mode.

export function initInteractions({ store, stage }) {
  let drag = null; // { id, startX, startY, baseX, baseY, baseZ, axisZ }

  function perspectiveScale(node) {
    const P = store.getScene().camera.perspective || 700;
    const zEff = (node.z || 0) + store.state.dolly;
    const denom = P - zEff;
    // Guard against the singularity near the camera plane.
    return denom > 1 ? P / denom : 1;
  }

  stage.addEventListener('pointerdown', (e) => {
    if (store.state.mode !== 'edit') return;
    const nodeEl = e.target.closest('.node');
    if (!nodeEl) { store.select(null); return; }

    const id = nodeEl.dataset.nodeId;
    store.select(id);
    const node = store.getNode(id);
    if (!node) return;

    drag = {
      id,
      startX: e.clientX, startY: e.clientY,
      baseX: node.x || 0, baseY: node.y || 0, baseZ: node.z || 0,
      scale: perspectiveScale(node),
      axisZ: e.shiftKey, // Shift = drag depth instead of height
    };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    // Divide screen delta by perspective scale so the node tracks the cursor.
    const wx = dx / drag.scale;
    if (drag.axisZ) {
      store.updateNode(drag.id, { x: drag.baseX + wx, z: drag.baseZ + dy * 6 }, { transient: true });
    } else {
      const wy = dy / drag.scale;
      store.updateNode(drag.id, { x: drag.baseX + wx, y: drag.baseY + wy }, { transient: true });
    }
  });

  function endDrag(e) {
    if (!drag) return;
    if (e && e.pointerId != null) { try { stage.releasePointerCapture(e.pointerId); } catch (_) {} }
    drag = null;
    store.commit(); // seal the transient run into one undo step
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Keyboard nudges + shortcuts.
  window.addEventListener('keydown', (e) => {
    if (store.state.mode !== 'edit') return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    // Undo / redo work everywhere.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo(); else store.undo();
      return;
    }
    if (typing) return;

    const node = store.getSelected();
    if (!node) return;

    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.removeNode(node.id); return; }

    const step = e.altKey ? 1 : 10;
    const patch = {};
    if (e.key === 'ArrowLeft') patch.x = (node.x || 0) - step;
    else if (e.key === 'ArrowRight') patch.x = (node.x || 0) + step;
    else if (e.key === 'ArrowUp') patch[e.shiftKey ? 'y' : 'z'] = (node[e.shiftKey ? 'y' : 'z'] || 0) - step * (e.shiftKey ? 1 : 5);
    else if (e.key === 'ArrowDown') patch[e.shiftKey ? 'y' : 'z'] = (node[e.shiftKey ? 'y' : 'z'] || 0) + step * (e.shiftKey ? 1 : 5);
    else return;

    e.preventDefault();
    store.updateNode(node.id, patch);
  });
}
