// model.js — Scene schema, defaults, and factories.
// The whole page is plain data; this module is the single source of truth for
// its shape. No DOM, no rendering here.

export const NODE_TYPES = ['billboard', 'box', 'plane', 'text'];

let _seq = 0;
export function uid() {
  _seq += 1;
  return 'n' + Date.now().toString(36) + '_' + _seq.toString(36);
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Transform fields shared by every node.
const TRANSFORM_DEFAULTS = {
  x: 0, y: 0, z: -1500,
  rotX: 0, rotY: 0, rotZ: 0,
  scale: 1,
};

// Per-type content defaults.
const TYPE_DEFAULTS = {
  billboard: { num: 'Section', title: 'Heading', body: 'Body copy goes here.',
               w: 560, h: 360, color: '' /* '' = use themed gradient */ },
  box:       { w: 400, h: 600, d: 400, color: '#3a3f6b' },
  plane:     { w: 600, h: 400, color: '#1c2030', image: '' },
  text:      { text: 'Text', size: 90, color: '#ffe9c7' },
};

export function createNode(type, patch = {}) {
  if (!TYPE_DEFAULTS[type]) throw new Error('unknown node type: ' + type);
  return {
    id: uid(),
    type,
    ...clone(TRANSFORM_DEFAULTS),
    ...clone(TYPE_DEFAULTS[type]),
    ...patch,
  };
}

// Inspector field descriptors. panel.js renders inputs straight from these.
// kind: 'number' | 'text' | 'textarea' | 'color'
const TRANSFORM_FIELDS = [
  { key: 'x', label: 'X (across)', kind: 'number', step: 10 },
  { key: 'y', label: 'Y (height)', kind: 'number', step: 10 },
  { key: 'z', label: 'Z (depth)', kind: 'number', step: 50 },
  { key: 'rotY', label: 'Rotate Y°', kind: 'number', step: 1 },
  { key: 'rotX', label: 'Rotate X°', kind: 'number', step: 1 },
  { key: 'rotZ', label: 'Rotate Z°', kind: 'number', step: 1 },
  { key: 'scale', label: 'Scale', kind: 'number', step: 0.05 },
];

export const FIELD_SCHEMA = {
  billboard: [
    { key: 'num', label: 'Eyebrow', kind: 'text' },
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'body', label: 'Body', kind: 'textarea' },
    { key: 'w', label: 'Width', kind: 'number', step: 10 },
    { key: 'h', label: 'Height', kind: 'number', step: 10 },
    { key: 'color', label: 'Panel color', kind: 'color' },
    ...TRANSFORM_FIELDS,
  ],
  box: [
    { key: 'w', label: 'Width', kind: 'number', step: 10 },
    { key: 'h', label: 'Height', kind: 'number', step: 10 },
    { key: 'd', label: 'Depth', kind: 'number', step: 10 },
    { key: 'color', label: 'Color', kind: 'color' },
    ...TRANSFORM_FIELDS,
  ],
  plane: [
    { key: 'w', label: 'Width', kind: 'number', step: 10 },
    { key: 'h', label: 'Height', kind: 'number', step: 10 },
    { key: 'color', label: 'Color', kind: 'color' },
    { key: 'image', label: 'Image URL', kind: 'text' },
    ...TRANSFORM_FIELDS,
  ],
  text: [
    { key: 'text', label: 'Text', kind: 'text' },
    { key: 'size', label: 'Font size', kind: 'number', step: 4 },
    { key: 'color', label: 'Color', kind: 'color' },
    ...TRANSFORM_FIELDS,
  ],
};

// The starter scene: the dusk street from the original demo, as data.
export function createScene() {
  const billboards = [
    ['Mile 01', 'Welcome', 'Scroll up to walk down the road. Each section stands at the roadside.'],
    ['Mile 02', 'Perspective', 'One vanishing point, dead center on the horizon.'],
    ['Mile 03', 'WYSIWYG', 'Add sections and objects, drag them in 3D, then export a standalone page.'],
    ['Mile 04', 'Depth', 'Nodes are parked at increasing depth, so they rush into view as you advance.'],
    ['Mile 05', 'Objects', 'Boxes, planes and floating text dress the scene.'],
    ['Mile 06', 'Export', 'Save the project as JSON or publish a single self-contained HTML file.'],
  ];

  const nodes = [];
  billboards.forEach((b, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    nodes.push(createNode('billboard', {
      num: b[0], title: b[1], body: b[2],
      x: 680 * side, y: -120, z: -1300 * (i + 1),
      rotY: side === -1 ? 32 : -32,
    }));
  });
  // A couple of "buildings" for depth cues.
  nodes.push(createNode('box', { x: -1200, y: 100, z: -5200, w: 500, h: 1000, d: 500, color: '#2a2e52' }));
  nodes.push(createNode('box', { x: 1250, y: 150, z: -6600, w: 600, h: 900, d: 600, color: '#34264f' }));

  return {
    meta: { name: 'Untitled street', version: 1 },
    camera: {
      perspective: 700,
      originX: 50,
      originY: 42,
      depth: 9000,     // total forward travel
      trackVH: 400,    // scroll length of the published page
    },
    environment: {
      // A full CSS background string keeps the sky flexible.
      skyCSS: 'radial-gradient(120% 75% at 50% 42%, #ffd9a0 0%, #ff9d6e 12%, ' +
              '#c5567f 32%, #5b3a8c 55%, #1b1f3b 78%, #0a0b16 100%)',
      sun: true,
      road: { width: 1600, length: 22000, y: 190, color: '#15171d', lane: '#f6d24a' },
    },
    nodes,
  };
}
