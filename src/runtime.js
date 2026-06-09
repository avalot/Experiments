// runtime.js — the SHARED runtime. These functions render a scene to DOM and
// drive the scroll "walk". The editor imports them directly; the exporter
// inlines them (via .toString) into a standalone HTML file. Therefore every
// function below must be self-contained: no imports, no module-scope refs,
// no closures over anything outside its own body.

export const RUNTIME_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#0a0b10;color:#f4f6fb;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;overflow-x:hidden}
.stage{position:fixed;inset:0;overflow:hidden;perspective:700px;perspective-origin:50% 42%;background:#0a0b16}
.stage.has-sun::before{content:"";position:absolute;left:50%;top:42%;width:280px;height:280px;
  transform:translate(-50%,-50%);border-radius:50%;z-index:0;filter:blur(2px);
  background:radial-gradient(circle,#fff7e6 0%,#ffd27a 30%,rgba(255,160,90,.35) 55%,transparent 72%)}
.world{position:absolute;left:50%;top:50%;transform-style:preserve-3d;transform:translateZ(0)}
.road{position:absolute;left:0;top:0;background-repeat:no-repeat}
.node{position:absolute;left:0;top:0;transform-style:preserve-3d;will-change:transform}
.node--billboard{display:grid;place-content:center;text-align:center;padding:32px;border-radius:14px;
  backface-visibility:hidden;border:2px solid rgba(255,255,255,.18);
  background:linear-gradient(160deg,rgba(20,24,40,.92),rgba(40,28,60,.88));
  box-shadow:0 0 0 6px rgba(0,0,0,.25),0 30px 60px rgba(0,0,0,.55),0 0 80px rgba(120,90,200,.35)}
.node--billboard::after{content:"";position:absolute;left:50%;top:100%;width:18px;height:280px;
  transform:translateX(-50%);background:linear-gradient(#3a3f4b,#15171d);border-radius:4px}
.node--billboard .num{font-size:13px;letter-spacing:4px;text-transform:uppercase;opacity:.55;margin-bottom:16px}
.node--billboard h2{font-size:44px;letter-spacing:1px;margin:0 0 14px;text-shadow:0 2px 18px rgba(0,0,0,.6)}
.node--billboard p{font-size:19px;line-height:1.5;margin:0;opacity:.85}
.node--text{font-weight:800;letter-spacing:1px;white-space:nowrap;backface-visibility:hidden;
  text-shadow:0 2px 20px rgba(0,0,0,.5)}
.node--plane{background-size:cover;background-position:center;border-radius:4px;
  box-shadow:0 20px 50px rgba(0,0,0,.45)}
.node--box{transform-style:preserve-3d}
.node--box .face{position:absolute;left:50%;top:50%}
.hint{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:5;font-size:13px;
  letter-spacing:3px;text-transform:uppercase;opacity:.7}
@media (prefers-reduced-motion:reduce){.stage.has-sun::before{animation:none}}
`;

// Write ONLY the 3D transform — the hot path used during drag.
export function applyNodeStyles(el, node) {
  el.style.transform =
    'translate3d(' + (node.x || 0) + 'px,' + (node.y || 0) + 'px,' + (node.z || 0) + 'px) ' +
    'rotateX(' + (node.rotX || 0) + 'deg) rotateY(' + (node.rotY || 0) + 'deg) ' +
    'rotateZ(' + (node.rotZ || 0) + 'deg) scale(' + (node.scale == null ? 1 : node.scale) + ') ' +
    'translate(-50%,-50%)';
}

// Build the DOM element for a node (structure + content). Re-run on edits.
export function buildNodeEl(node) {
  var el = document.createElement('div');
  el.className = 'node node--' + node.type;
  el.dataset.nodeId = node.id;

  if (node.type === 'billboard') {
    el.style.width = (node.w || 560) + 'px';
    el.style.height = (node.h || 360) + 'px';
    if (node.color) el.style.background = node.color;
    var num = document.createElement('div'); num.className = 'num'; num.textContent = node.num || '';
    var h = document.createElement('h2'); h.textContent = node.title || '';
    var p = document.createElement('p'); p.textContent = node.body || '';
    el.appendChild(num); el.appendChild(h); el.appendChild(p);

  } else if (node.type === 'text') {
    el.style.fontSize = (node.size || 90) + 'px';
    el.style.color = node.color || '#fff';
    el.textContent = node.text || '';

  } else if (node.type === 'plane') {
    el.style.width = (node.w || 600) + 'px';
    el.style.height = (node.h || 400) + 'px';
    el.style.background = node.color || '#1c2030';
    if (node.image) el.style.backgroundImage = 'url("' + node.image + '")';

  } else if (node.type === 'box') {
    var w = node.w || 400, hh = node.h || 400, d = node.d || 400;
    el.style.width = w + 'px';
    el.style.height = hh + 'px';
    // 6 faces, each centered in the container then pushed out by a half-extent.
    var faces = [
      ['translateZ(' + (d / 2) + 'px)', w, hh, 1],
      ['rotateY(180deg) translateZ(' + (d / 2) + 'px)', w, hh, 0.6],
      ['rotateY(90deg) translateZ(' + (w / 2) + 'px)', d, hh, 0.8],
      ['rotateY(-90deg) translateZ(' + (w / 2) + 'px)', d, hh, 0.8],
      ['rotateX(90deg) translateZ(' + (hh / 2) + 'px)', w, d, 1.15],
      ['rotateX(-90deg) translateZ(' + (hh / 2) + 'px)', w, d, 0.45],
    ];
    for (var i = 0; i < faces.length; i++) {
      var f = document.createElement('div');
      f.className = 'face';
      f.style.width = faces[i][1] + 'px';
      f.style.height = faces[i][2] + 'px';
      f.style.background = node.color || '#3a3f6b';
      f.style.filter = 'brightness(' + faces[i][3] + ')';
      f.style.transform = 'translate(-50%,-50%) ' + faces[i][0];
      el.appendChild(f);
    }
  }

  applyNodeStyles(el, node);
  return el;
}

// The road plane.
export function buildRoad(road) {
  var r = road || {};
  var width = r.width || 1600, length = r.length || 22000;
  var el = document.createElement('div');
  el.className = 'road';
  el.style.width = width + 'px';
  el.style.height = length + 'px';
  el.style.backgroundColor = r.color || '#15171d';
  // Dashed center line (runs along the road's length) + edge lines.
  el.style.backgroundImage =
    'repeating-linear-gradient(0deg,' + (r.lane || '#f6d24a') + ' 0 90px,transparent 90px 230px),' +
    'linear-gradient(90deg,transparent 0 4%,#c9ccd1 4% 4.5%,transparent 4.5% 95.5%,#c9ccd1 95.5% 96%,transparent 96%)';
  el.style.backgroundSize = '20px 100%,100% 100%';
  el.style.backgroundPosition = 'center top,center';
  el.style.boxShadow = '0 0 220px 120px rgba(0,0,0,.6) inset';
  el.style.transform = 'translateY(' + (r.y || 190) + 'px) translateZ(' + (-length / 2) + 'px) ' +
    'rotateX(90deg) translate(-50%,-50%)';
  return el;
}

// Apply camera + sky to the stage.
export function applyCamera(stage, scene) {
  var cam = scene.camera || {};
  var env = scene.environment || {};
  stage.classList.add('stage');
  stage.style.perspective = (cam.perspective || 700) + 'px';
  stage.style.perspectiveOrigin = (cam.originX == null ? 50 : cam.originX) + '% ' +
    (cam.originY == null ? 42 : cam.originY) + '%';
  stage.style.background = env.skyCSS ||
    'radial-gradient(120% 75% at 50% 42%,#ffd9a0 0%,#ff9d6e 12%,#c5567f 32%,#5b3a8c 55%,#1b1f3b 78%,#0a0b16 100%)';
  if (env.sun === false) stage.classList.remove('has-sun');
  else stage.classList.add('has-sun');
}

// Build the whole stage from a scene. Returns { world }.
export function renderScene(stage, scene) {
  stage.textContent = '';
  applyCamera(stage, scene);
  var world = document.createElement('div');
  world.className = 'world';
  if (scene.environment && scene.environment.road) world.appendChild(buildRoad(scene.environment.road));
  for (var i = 0; i < scene.nodes.length; i++) world.appendChild(buildNodeEl(scene.nodes[i]));
  stage.appendChild(world);
  return { world: world };
}

// Wire scroll -> translateZ. Scroll UP to advance; anchored at the bottom.
// Returns a teardown() that removes listeners and resets the page.
export function initWalk(stage, scene) {
  var world = stage.querySelector('.world');
  var cam = scene.camera || {};
  var depth = cam.depth || 9000;
  var prevBodyHeight = document.body.style.height;
  document.body.style.height = (cam.trackVH || 400) + 'vh';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  var userMoved = false;
  function onUser() { userMoved = true; }
  var gestures = ['touchstart', 'wheel', 'keydown'];
  for (var g = 0; g < gestures.length; g++) addEventListener(gestures[g], onUser, { passive: true, once: true });

  function maxScroll() {
    var doc = document.documentElement;
    return Math.max(0, (doc.scrollHeight || document.body.scrollHeight) - window.innerHeight);
  }
  function walk() {
    var max = maxScroll();
    var p = max > 0 ? 1 - window.scrollY / max : 0;   // scroll up => advance
    world.style.transform = 'translateZ(' + (p * depth) + 'px)';
  }
  function toBottom() { if (!userMoved) { window.scrollTo(0, 1e7); walk(); } }

  addEventListener('scroll', walk, { passive: true });
  addEventListener('resize', walk);
  addEventListener('load', toBottom);
  var timers = [0, 50, 150, 300, 500, 800, 1200].map(function (t) { return setTimeout(toBottom, t); });
  toBottom();

  return function teardown() {
    removeEventListener('scroll', walk);
    removeEventListener('resize', walk);
    removeEventListener('load', toBottom);
    for (var i = 0; i < gestures.length; i++) removeEventListener(gestures[i], onUser);
    timers.forEach(clearTimeout);
    document.body.style.height = prevBodyHeight;
    world.style.transform = 'translateZ(0)';
  };
}

// Functions inlined into exports, in dependency order (declarations hoist, but
// keep order readable).
export const RUNTIME_FUNCS = [applyNodeStyles, buildNodeEl, buildRoad, applyCamera, renderScene, initWalk];

// Produce a single self-contained, dependency-free HTML page for a scene.
export function buildStandaloneHTML(scene) {
  var funcs = RUNTIME_FUNCS.map(function (f) { return f.toString(); }).join('\n\n');
  var name = (scene.meta && scene.meta.name) || 'Roadway page';
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8"/>\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
    '<title>' + escapeHTML(name) + '</title>\n<style>' + RUNTIME_CSS + '</style>\n</head>\n<body>\n' +
    '<div id="stage" class="stage"></div>\n<div class="hint">Scroll up to walk ↑</div>\n' +
    '<script>\n' + funcs + '\n\n' +
    'var SCENE = ' + JSON.stringify(scene) + ';\n' +
    'var stage = document.getElementById("stage");\n' +
    'renderScene(stage, SCENE);\ninitWalk(stage, SCENE);\n' +
    '<\/script>\n</body>\n</html>\n';
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, function (c) {
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
  });
}
