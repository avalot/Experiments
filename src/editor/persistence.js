// persistence.js — JSON save/load, localStorage autosave, standalone export.

import { buildStandaloneHTML } from '../runtime.js';

const LS_KEY = 'roadway.autosave.v1';

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(s) {
  return String(s || 'street').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'street';
}

export function saveJSON(scene) {
  download(slug(scene.meta && scene.meta.name) + '.json',
    JSON.stringify(scene, null, 2), 'application/json');
}

export function exportHTML(scene) {
  download(slug(scene.meta && scene.meta.name) + '.html',
    buildStandaloneHTML(scene), 'text/html');
}

export function loadJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const scene = JSON.parse(reader.result);
        if (!scene || !Array.isArray(scene.nodes)) throw new Error('not a scene file');
        resolve(scene);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function autosave(scene) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(scene)); } catch (e) { /* quota / private mode */ }
}

export function loadAutosave() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const scene = JSON.parse(raw);
    return scene && Array.isArray(scene.nodes) ? scene : null;
  } catch (e) { return null; }
}
