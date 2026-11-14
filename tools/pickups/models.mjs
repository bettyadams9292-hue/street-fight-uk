/**
 * Pickup models for food, groceries, first aid, materials, collectibles and quest items.
 *
 * Runs in a browser page (see build.mjs): every model is built from three.js primitives,
 * or from Kenney Food Kit parts (CC0) whose texture is flattened to plain colours, then
 * exported as a GLB with flat-shaded, untextured materials (one material per colour,
 * one mesh per model). 1 unit = 1 metre, origin at the bottom centre, +Y up, +Z front.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- materials ----------------------------------------------------------------------------
const FIN = {
  gold: { c: '#d8b04a', m: 0.85, r: 0.35 },
  silver: { c: '#cfd2d8', m: 0.85, r: 0.3 },
  steel: { c: '#b9bdc4', m: 0.8, r: 0.38 },
  darksteel: { c: '#6a6e74', m: 0.75, r: 0.45 },
  copper: { c: '#b87333', m: 0.8, r: 0.4 },
  brass: { c: '#c9a13e', m: 0.85, r: 0.35 },
  foil: { c: '#c9ccd2', m: 0.7, r: 0.35 },
  glass: { c: '#2a3a5a', m: 0.1, r: 0.12 },
  screen: { c: '#7a9a6a', m: 0, r: 0.3, e: '#3a5a2a' },
  plastic_clear: { c: '#dfe6ea', m: 0, r: 0.2 },
};
const mats = new Map();
function material(key) {
  let m = mats.get(key);
  if (m) return m;
  const f = FIN[key] ?? { c: key, m: 0, r: 0.75 };
  m = new THREE.MeshStandardMaterial({ color: new THREE.Color(f.c), metalness: f.m, roughness: f.r });
  if (f.e) {
    m.emissive = new THREE.Color(f.e);
    m.emissiveIntensity = 0.6;
  }
  m.name = key;
  mats.set(key, m);
  return m;
}

// ---- parts -------------------------------------------------------------------------------
let parts = [];
const D = Math.PI / 180;
function xf(geo, t = {}) {
  const p = t.p ?? [0, 0, 0];
  const r = t.r ?? [0, 0, 0];
  const s = typeof t.s === 'number' ? [t.s, t.s, t.s] : t.s ?? [1, 1, 1];
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0] * D, r[1] * D, r[2] * D, t.order ?? 'XYZ')), new THREE.Vector3(...s));
  geo.applyMatrix4(m);
  if (t.then) for (const q of [].concat(t.then)) xf(geo, q);
  return geo;
}
function add(geo, col, t) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.clearGroups();
  parts.push({ geo: xf(g, t), col });
  return g;
}
/** Box: p is the centre. */
const box = (w, h, d, col, t) => add(new THREE.BoxGeometry(w, h, d), col, t);
/** Box standing on y = p.y. */
const slab = (w, h, d, col, t = {}) => {
  const p = t.p ?? [0, 0, 0];
  return box(w, h, d, col, { ...t, p: [p[0], p[1] + h / 2, p[2]] });
};
const cyl = (rt, rb, h, col, seg = 12, t, open = false) => add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), col, t);
const sph = (r, col, ws = 8, hs = 6, t, a = {}) => add(new THREE.SphereGeometry(r, ws, hs, a.ps ?? 0, a.pl ?? Math.PI * 2, a.ts ?? 0, a.tl ?? Math.PI), col, t);
const dome = (r, col, ws = 10, hs = 3, t) => {
  sph(r, col, ws, hs, t, { tl: Math.PI / 2 });
  add(new THREE.CircleGeometry(r, ws), col, { r: [90, 0, 0], then: t });
};
const lathe = (pts, col, seg = 12, t) => add(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), col, t);
const torus = (R, r, col, rs = 4, ts = 10, t, arc = Math.PI * 2) => add(new THREE.TorusGeometry(R, r, rs, ts, arc), col, t);
const ico = (r, col, detail = 0, t) => add(new THREE.IcosahedronGeometry(r, detail), col, t);
const dodec = (r, col, t) => add(new THREE.DodecahedronGeometry(r, 0), col, t);
const capsule = (r, len, col, t, cs = 2, rs = 6) => add(new THREE.CapsuleGeometry(r, len, cs, rs), col, t);
const circle = (r, col, seg = 12, t) => add(new THREE.CircleGeometry(r, seg), col, t);
/** Extrude a 2D outline (x, y) along +z by depth, centred on z. */
const extrude = (outline, depth, col, t, curve = 6) => {
  const sh = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return add(g, col, t);
};
const extrudeShape = (shape, depth, col, t, curve = 6) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  return add(g, col, t);
};
/** A box bent along x into an arc: y += k * x^2. */
const bentBox = (w, h, d, k, col, t) => {
  const g = new THREE.BoxGeometry(w, h, d, 6, 1, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + k * p.getX(i) ** 2);
  return add(g, col, t);
};
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---- Kenney parts, texture flattened to plain colours ---------------------------------------
const kenneyCache = new Map();
let colormap = null;
async function kenneySrc(name) {
  if (kenneyCache.has(name)) return kenneyCache.get(name);
  const g = await new GLTFLoader().loadAsync(`/kenney/${name}.glb`);
  const out = [];
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!colormap) {
      const img = o.material.map.image;
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      colormap = { w: img.width, h: img.height, d: cx.getImageData(0, 0, img.width, img.height).data };
    }
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    const groups = new Map();
    for (let f = 0; f < pos.count; f += 3) {
      let u = 0;
      let v = 0;
      for (let k = 0; k < 3; k++) {
        u += uv.getX(f + k) / 3;
        v += uv.getY(f + k) / 3;
      }
      u -= Math.floor(u);
      v -= Math.floor(v);
      const px = Math.min(colormap.w - 1, Math.floor(u * colormap.w));
      const py = Math.min(colormap.h - 1, Math.floor(v * colormap.h));
      const i = (py * colormap.w + px) * 4;
      const hex = '#' + [0, 1, 2].map((c) => colormap.d[i + c].toString(16).padStart(2, '0')).join('');
      if (!groups.has(hex)) groups.set(hex, []);
      for (let k = 0; k < 3; k++) groups.get(hex).push(pos.getX(f + k), pos.getY(f + k), pos.getZ(f + k));
    }
    for (const [hex, arr] of groups) {
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      out.push({ geo: g2, col: hex });
    }
  });
  kenneyCache.set(name, out);
  return out;
}
/** Add a Kenney Food Kit model; `size` scales its largest side to that many metres (bottom centre at origin first). */
async function kenney(name, t = {}, opt = {}) {
  const src = await kenneySrc(name);
  const all = src.map((s) => s.geo.clone());
  const box3 = new THREE.Box3();
  for (const g of all) {
    g.computeBoundingBox();
    box3.union(g.boundingBox);
  }
  const sz = box3.getSize(new THREE.Vector3());
  const k = opt.size ? opt.size / Math.max(sz.x, sz.y, sz.z) : 1;
  const c = box3.getCenter(new THREE.Vector3());
  src.forEach((s, i) => {
    const g = all[i];
    g.translate(-c.x, -box3.min.y, -c.z);
    g.scale(k, k, k);
    const col = opt.recolour ? opt.recolour(s.col) : s.col;
    parts.push({ geo: xf(g, t), col });
  });
}
const hsl = (hex) => {
  const o = {};
  new THREE.Color(hex).getHSL(o);
  return o;
};

// ---- shared bits ---------------------------------------------------------------------------
const WHITE = '#eeece6';
const plate = (r = 0.12, t) => lathe([[0, 0], [r * 0.62, 0], [r * 0.66, 0.006], [r * 0.7, 0.008], [r, 0.02], [r * 0.97, 0.022], [r * 0.68, 0.012], [0, 0.012]], WHITE, 16, t);
const toast = (col, t) =>
  extrude(
    [[-0.05, 0], [0.05, 0], [0.05, 0.075], [0.04, 0.09], [0.02, 0.098], [-0.02, 0.098], [-0.04, 0.09], [-0.05, 0.075]],
    0.012,
    col,
    t,
    2,
  );
/** A crimped packet: a puffy body with flat seals top and bottom. */
const packet = (w, h, d, col, seal, t) => {
  const g = new THREE.BoxGeometry(w, h, d, 2, 1, 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getX(i)) < 1e-6) p.setZ(i, p.getZ(i) * 1.5);
    if (Math.abs(p.getY(i)) > h / 2 - 1e-6) p.setZ(i, p.getZ(i) * 0.25);
  }
  add(g, col, t);
  box(w * 1.02, h * 0.08, d * 0.25, seal, { p: [0, h / 2 + h * 0.04 - 0.001, 0], then: t });
  box(w * 1.02, h * 0.08, d * 0.25, seal, { p: [0, -h / 2 - h * 0.04 + 0.001, 0], then: t });
};
/** A jar: glass shoulders, a coloured fill, a label and a lid. */
const jar = (fill, label, lid, t) => {
  lathe([[0, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.08], [0.03, 0.095], [0.026, 0.1], [0, 0.1]], fill, 12, t);
  cyl(0.0365, 0.0365, 0.05, label, 12, { p: [0, 0.042, 0], then: t }, true);
  cyl(0.0275, 0.0275, 0.016, lid, 12, { p: [0, 0.106, 0], then: t });
};
/** A shallow supermarket tray with a film lid and a label. */
const tray = (w, d, col, t) => {
  lathe([[0, 0], [0.5, 0], [0.56, 0.9], [0.6, 1], [0, 1]].map(([x, y]) => [x, y]), col, 4, { s: [w * 1.414, 0.02, d * 1.414], r: [0, 45, 0], then: t });
};
const sausage = (len, col, t) => capsule(0.012, len, col, t, 2, 6);
const chip = (t, col = '#e8c060') => box(0.011, 0.011, 0.065, col, t);

// ---- the models ----------------------------------------------------------------------------
const M = {
  // Food and first aid --------------------------------------------------------------------------
  async chips() {
    slab(0.2, 0.004, 0.16, '#e8e0cc');
    box(0.2, 0.004, 0.06, '#e8e0cc', { p: [0, 0.025, -0.095], r: [55, 0, 0] });
    box(0.2, 0.004, 0.06, '#dcd4c0', { p: [0, 0.025, 0.095], r: [-55, 0, 0] });
    seed = 3;
    for (let i = 0; i < 18; i++) chip({ p: [(rnd() - 0.5) * 0.15, 0.012 + rnd() * 0.02, (rnd() - 0.5) * 0.1], r: [rnd() * 30, rnd() * 180, rnd() * 30] });
  },
  async kebab() {
    // Pitta pocket standing up, filling showing at the top, paper round the bottom.
    const half = [];
    for (let i = 0; i <= 8; i++) half.push([Math.cos(Math.PI + (i / 8) * Math.PI) * 0.08, 0.09 + Math.sin(Math.PI + (i / 8) * Math.PI) * 0.09]);
    extrude(half, 0.05, '#d8b07a', { p: [0, 0, 0] });
    extrude(half.map(([x, y]) => [x * 1.05, y * 0.75 - 0.002]), 0.056, '#eeece6', {});
    seed = 5;
    for (let i = 0; i < 9; i++) box(0.03, 0.016, 0.04, i % 3 === 0 ? '#5a9a3a' : i % 3 === 1 ? '#8a4a2a' : '#a03a5a', { p: [-0.065 + i * 0.016, 0.092 + rnd() * 0.008, (rnd() - 0.5) * 0.01], r: [0, rnd() * 40, rnd() * 30 - 15] });
  },
  async pasty() {
    dome(0.07, '#d8a050', 10, 3, { s: [1.5, 0.75, 0.85] });
    for (let i = 0; i < 9; i++) box(0.022, 0.016, 0.012, '#c08840', { p: [-0.08 + i * 0.02, 0.05 - Math.abs(i - 4) ** 2 * 0.0012, 0], r: [0, 0, i % 2 ? 25 : -25] });
  },
  async sausage_roll() {
    cyl(0.028, 0.028, 0.13, '#d8a860', 10, { p: [0, 0.028, 0], r: [0, 0, 90], s: [1, 1, 0.75] });
    for (const x of [-0.0655, 0.0655]) circle(0.017, '#b06a5a', 10, { p: [x, 0.028, 0], r: [0, x > 0 ? 90 : -90, 0], s: [1, 1, 1] });
    for (const x of [-0.035, 0, 0.035]) box(0.004, 0.004, 0.03, '#a8783a', { p: [x, 0.0565, 0], r: [0, 30, 0] });
  },
  async meal_deal() {
    // Sandwich wedge in a green card pack, a packet of crisps and a bottle of pop.
    extrude([[0, 0], [0.13, 0], [0, 0.13]], 0.06, '#4a9a5a', { r: [0, 0, 0], p: [-0.12, 0, 0] });
    extrude([[0.012, 0.012], [0.1, 0.012], [0.012, 0.1]], 0.062, '#e8d0a0', { p: [-0.12, 0, 0] });
    packet(0.09, 0.12, 0.025, '#3a6ad8', '#2a4aa8', { p: [0.05, 0.065, 0.02], r: [0, -10, 0] });
    lathe([[0, 0], [0.026, 0], [0.026, 0.12], [0.012, 0.16], [0.012, 0.18], [0, 0.18]], '#e8333a', 10, { p: [0.03, 0, -0.06] });
    cyl(0.0125, 0.0125, 0.02, WHITE, 8, { p: [0.03, 0.19, -0.06] });
  },
  async bacon_butty() {
    cyl(0.06, 0.055, 0.025, '#d89a50', 12, {});
    await kenney('bacon', { p: [-0.005, 0.025, 0], r: [0, 70, 0] }, { size: 0.15 });
    await kenney('bacon', { p: [0.01, 0.03, 0.005], r: [0, 110, 0] }, { size: 0.15 });
    circle(0.03, '#5a2a1a', 8, { p: [0.01, 0.036, 0.01], r: [-90, 0, 0] });
    dome(0.062, '#d89a50', 12, 3, { p: [0, 0.035, 0], s: [1, 0.6, 1] });
  },
  async curry() {
    const foilTray = (w, d, h, fill, x, z) => {
      cyl(w * 0.75, w * 0.62, h, 'foil', 4, { p: [x, h / 2, z], r: [0, 45, 0], s: [1, 1, d / w] });
      box(w * 1.0, 0.004, d * 1.0, fill, { p: [x, h - 0.006, z] });
    };
    foilTray(0.16, 0.12, 0.045, '#d88a2a', 0, 0.02);
    for (let i = 0; i < 5; i++) box(0.022, 0.014, 0.02, '#e8b080', { p: [-0.045 + i * 0.022, 0.042, 0.02 + ((i * 7) % 3 - 1) * 0.02], r: [0, i * 37, 0] });
    foilTray(0.12, 0.09, 0.04, '#f4f0e6', 0.05, -0.1);
  },
  async fry_up() {
    lathe([[0, 0], [0.08, 0], [0.09, 0.008], [0.14, 0.02], [0.135, 0.022], [0.088, 0.012], [0, 0.012]], WHITE, 16, { s: [1.15, 1, 0.85] });
    await kenney('egg-cooked', { p: [-0.06, 0.012, 0.02] }, { size: 0.09 });
    for (const [x, z, r] of [[0.02, 0.05, 10], [0.03, 0.025, -5]]) sausage(0.07, '#8a4a2a', { p: [x, 0.025, z], r: [0, r, 90] });
    sph(0.035, '#e05a2a', 8, 4, { p: [0.06, 0.014, -0.03], s: [1, 0.35, 1] });
    await kenney('bacon', { p: [-0.03, 0.014, -0.045], r: [0, 80, 0] }, { size: 0.13 });
    sph(0.022, '#e04030', 8, 4, { p: [0.09, 0.016, 0.03], s: [1, 0.6, 1] });
    toast('#c88a40', { p: [-0.1, 0.03, -0.02], r: [-60, 0, 0], s: 0.8 });
    // A mug of tea on the side.
    cyl(0.032, 0.03, 0.08, '#e8e0cc', 10, { p: [0.17, 0.04, -0.06] });
    circle(0.029, '#8a5a3a', 10, { p: [0.17, 0.075, -0.06], r: [-90, 0, 0] });
    torus(0.018, 0.005, '#e8e0cc', 4, 8, { p: [0.205, 0.045, -0.06] }, Math.PI);
  },
  async protein_bar() {
    box(0.12, 0.02, 0.035, '#2a2a2e', { p: [0, 0.01, 0] });
    box(0.05, 0.0205, 0.0355, '#6ad04a', { p: [0.015, 0.01, 0] });
    for (const x of [-0.065, 0.065]) box(0.012, 0.006, 0.04, '#2a2a2e', { p: [x, 0.01, 0] });
  },
  async energy_drink() {
    lathe([[0, 0], [0.024, 0], [0.027, 0.006], [0.027, 0.15], [0.022, 0.16], [0.022, 0.163], [0, 0.163]], '#1a1a1c', 14);
    cyl(0.0275, 0.0275, 0.04, '#6ad04a', 14, { p: [0, 0.08, 0] }, true);
    circle(0.021, 'silver', 14, { p: [0, 0.1635, 0], r: [-90, 0, 0] });
  },
  async can_of_pop() {
    await kenney('soda-can', {}, { size: 0.12 });
  },
  async water() {
    lathe([[0, 0], [0.03, 0], [0.032, 0.01], [0.032, 0.14], [0.024, 0.18], [0.013, 0.195], [0.013, 0.205], [0, 0.205]], '#a8d0ea', 12);
    cyl(0.0325, 0.0325, 0.05, '#1f3f8a', 12, { p: [0, 0.075, 0] }, true);
    cyl(0.0145, 0.0145, 0.018, '#2a6ad0', 10, { p: [0, 0.21, 0] });
  },
  async flask_tea() {
    cyl(0.04, 0.04, 0.22, 'steel', 12, { p: [0, 0.11, 0] });
    cyl(0.041, 0.041, 0.06, '#7a2a2a', 12, { p: [0, 0.03, 0] });
    cyl(0.032, 0.04, 0.025, 'steel', 12, { p: [0, 0.232, 0] });
    cyl(0.044, 0.04, 0.06, '#7a2a2a', 12, { p: [0, 0.272, 0] });
  },
  async plasters() {
    slab(0.1, 0.035, 0.065, '#e8c8a0');
    box(0.101, 0.012, 0.066, '#1f3f8a', { p: [0, 0.028, 0] });
    box(0.03, 0.008, 0.002, '#e8333a', { p: [-0.025, 0.014, 0.033] });
    box(0.008, 0.03, 0.002, '#e8333a', { p: [-0.025, 0.014, 0.033] });
    slab(0.075, 0.002, 0.02, '#d8a878', { p: [0.02, 0, 0.055], r: [0, 15, 0] });
    slab(0.024, 0.0025, 0.016, '#f2efe6', { p: [0.02, 0, 0.055], r: [0, 15, 0] });
  },
  async first_aid() {
    slab(0.22, 0.15, 0.08, '#c82a2a');
    box(0.224, 0.012, 0.084, '#9a1e1e', { p: [0, 0.075, 0] });
    box(0.07, 0.022, 0.004, '#f2efe6', { p: [0, 0.075, 0.041] });
    box(0.022, 0.07, 0.004, '#f2efe6', { p: [0, 0.075, 0.041] });
    torus(0.03, 0.006, '#2a2a2e', 4, 8, { p: [0, 0.15, 0] }, Math.PI);
  },

  // Groceries -------------------------------------------------------------------------------------
  async g_bread() {
    await kenney('loaf', {}, { size: 0.24 });
  },
  async g_butter() {
    slab(0.11, 0.035, 0.065, 'gold');
    box(0.06, 0.0355, 0.0655, '#f2efe6', { p: [0, 0.0175, 0] });
    box(0.03, 0.036, 0.02, '#1f3f8a', { p: [0, 0.0175, 0] });
  },
  async g_cheese() {
    slab(0.13, 0.05, 0.075, '#f0c040');
    box(0.06, 0.0505, 0.0755, '#5a3a8a', { p: [0.01, 0.025, 0] });
    box(0.035, 0.051, 0.03, '#f2efe6', { p: [0.01, 0.025, 0] });
  },
  async g_ham() {
    tray(0.14, 0.1, '#f2efe6');
    for (let i = 0; i < 4; i++) slab(0.12, 0.004, 0.085, i % 2 ? '#e89a9a' : '#e0a8a8', { p: [0.003 * i, 0.006 + i * 0.004, 0], r: [0, i * 3, 0] });
    slab(0.05, 0.002, 0.03, '#1f3f8a', { p: [0.02, 0.022, 0.015] });
  },
  async g_eggs() {
    slab(0.16, 0.035, 0.11, '#a8a8a0');
    for (let i = 0; i < 6; i++) sph(0.022, '#f4ecd8', 7, 5, { p: [-0.05 + (i % 3) * 0.05, 0.045, i < 3 ? -0.025 : 0.025], s: [1, 1.25, 1] });
    box(0.16, 0.004, 0.11, '#a8a8a0', { p: [0, 0.075, -0.09], r: [-70, 0, 0] });
    box(0.07, 0.0045, 0.05, '#4a5a3a', { p: [0, 0.077, -0.088], r: [-70, 0, 0] });
  },
  async g_milk() {
    cyl(0.05, 0.052, 0.15, '#f8f8f4', 8, { p: [0, 0.075, 0], r: [0, 22.5, 0] });
    cyl(0.018, 0.05, 0.05, '#f8f8f4', 8, { p: [0, 0.175, 0], r: [0, 22.5, 0] });
    cyl(0.017, 0.017, 0.02, '#4a9a3a', 10, { p: [0, 0.21, 0] });
    cyl(0.0525, 0.0535, 0.05, '#4a9a3a', 8, { p: [0, 0.08, 0], r: [0, 22.5, 0] }, true);
    torus(0.035, 0.008, '#f8f8f4', 4, 8, { p: [-0.045, 0.13, 0], r: [0, 0, 90] }, Math.PI);
  },
  async g_cereal() {
    slab(0.19, 0.27, 0.07, '#d84a2a');
    circle(0.06, '#ffd23d', 14, { p: [0, 0.12, 0.0355] });
    lathe([[0.001, -0.015], [0.03, -0.015], [0.045, 0.01], [0.001, 0.01]], '#f2efe6', 10, { p: [0, 0.11, 0.036], r: [90, 0, 0], s: [1, 0.05, 0.6] });
    box(0.191, 0.04, 0.071, '#f2efe6', { p: [0, 0.235, 0] });
  },
  async g_beans() {
    cyl(0.037, 0.037, 0.11, '#3a7ab8', 14, { p: [0, 0.055, 0] });
    for (const y of [0.002, 0.108]) cyl(0.038, 0.038, 0.006, 'steel', 14, { p: [0, y, 0] });
    cyl(0.0375, 0.0375, 0.03, '#f2efe6', 14, { p: [0, 0.06, 0] }, true);
  },
  async g_bacon() {
    tray(0.18, 0.1, '#f2efe6');
    for (let i = 0; i < 3; i++) await kenney('bacon-raw', { p: [-0.045 + i * 0.045, 0.006 + i * 0.003, 0], r: [0, 90, 0] }, { size: 0.16 });
    slab(0.05, 0.002, 0.03, '#7a2a2a', { p: [0.04, 0.02, 0.025] });
  },
  async g_sausages() {
    tray(0.17, 0.11, '#2a2a2e');
    for (let i = 0; i < 6; i++) sausage(0.06, '#d89a8a', { p: [-0.05 + (i % 3) * 0.05, 0.016, i < 3 ? -0.025 : 0.025], r: [90, 0, 0] });
  },
  async g_potatoes() {
    // Paper sack with the top rolled over and a few spuds in front.
    slab(0.15, 0.2, 0.09, '#c8a070');
    box(0.152, 0.03, 0.092, '#b08a5a', { p: [0, 0.205, 0] });
    slab(0.08, 0.06, 0.002, '#4a9a3a', { p: [0, 0.08, 0.046] });
    seed = 9;
    for (let i = 0; i < 3; i++) sph(0.03, '#b8945a', 6, 4, { p: [-0.05 + i * 0.05, 0.02, 0.08 + rnd() * 0.02], s: [1.3, 0.75, 1], r: [0, rnd() * 90, 0] });
  },
  async g_chicken() {
    tray(0.17, 0.12, '#2a2a2e');
    for (const x of [-0.035, 0.035]) sph(0.04, '#f0d0b8', 8, 4, { p: [x, 0.016, 0], s: [0.8, 0.35, 1.3], r: [0, x * 400, 0] });
    slab(0.05, 0.002, 0.03, '#ffd23d', { p: [0.04, 0.032, 0.03] });
  },
  async g_steak() {
    slab(0.2, 0.003, 0.16, '#e8e0cc');
    await kenney('meat-raw', { p: [0, 0.003, 0] }, { size: 0.16 });
  },
  async g_pasta() {
    packet(0.12, 0.18, 0.04, '#e8d080', '#d8c070', { p: [0, 0.098, 0] });
    slab(0.122, 0.05, 0.002, '#1f3f8a', { p: [0, 0.13, 0.025] });
    for (let i = 0; i < 4; i++) cyl(0.006, 0.006, 0.03, '#e8c060', 6, { p: [-0.03 + i * 0.02, 0.07, 0.035], r: [0, 0, 40] });
  },
  async g_sauce() {
    jar('#c83a2a', '#f2efe6', 'gold');
    box(0.02, 0.012, 0.004, '#4a9a3a', { p: [0, 0.045, 0.036] });
  },
  async g_mince() {
    tray(0.15, 0.11, '#2a2a2e');
    seed = 4;
    for (let i = 0; i < 9; i++) sph(0.024, i % 2 ? '#a8484a' : '#b85a58', 6, 4, { p: [-0.045 + (i % 3) * 0.045, 0.012, -0.03 + Math.floor(i / 3) * 0.03], s: [1, 0.55, 1], r: [0, rnd() * 90, 0] });
    slab(0.05, 0.002, 0.03, '#f2efe6', { p: [0.035, 0.03, 0.03] });
  },
  async g_buns() {
    slab(0.2, 0.004, 0.2, '#f2efe6');
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? 0.048 : -0.048;
      const z = i < 2 ? 0.048 : -0.048;
      cyl(0.045, 0.045, 0.012, '#e8c890', 10, { p: [x, 0.01, z] });
      dome(0.045, '#c88a40', 10, 3, { p: [x, 0.016, z], s: [1, 0.65, 1] });
      for (let k = 0; k < 4; k++) box(0.006, 0.003, 0.004, '#f2efe6', { p: [x + Math.cos(k * 1.6) * 0.018, 0.044, z + Math.sin(k * 1.6) * 0.018], r: [0, k * 40, 0] });
    }
  },
  async g_curry_sauce() {
    jar('#d88a2a', '#7a2a2a', '#e8333a');
    box(0.02, 0.012, 0.004, '#ffd23d', { p: [0, 0.045, 0.036] });
  },
  async g_rice() {
    packet(0.13, 0.19, 0.045, '#f4f0e6', '#d8b04a', { p: [0, 0.103, 0] });
    slab(0.132, 0.06, 0.002, '#5a3a8a', { p: [0, 0.07, 0.028] });
    slab(0.04, 0.012, 0.002, '#d8b04a', { p: [0, 0.095, 0.03] });
  },
  async g_onions() {
    await kenney('onion', { p: [-0.045, 0, 0.01] }, { size: 0.08 });
    await kenney('onion', { p: [0.045, 0, 0.005], r: [0, 60, 0] }, { size: 0.08 });
    await kenney('onion', { p: [0, 0.055, -0.005], r: [0, 140, 0] }, { size: 0.08 });
    box(0.03, 0.04, 0.002, '#e8333a', { p: [0.03, 0.06, 0.04], r: [0, 0, 15] });
  },
  async g_mushrooms() {
    cyl(0.085, 0.07, 0.04, '#1f3f8a', 4, { p: [0, 0.02, 0], r: [0, 45, 0], s: [1, 1, 0.75] });
    seed = 6;
    const spots = [[-0.03, -0.02], [0.03, -0.02], [-0.03, 0.02], [0.03, 0.025], [0, 0]];
    for (const [i, [x, z]] of spots.entries()) await kenney('mushroom', { p: [x, 0.02 + (i === 4 ? 0.01 : 0), z], r: [0, rnd() * 360, 0] }, { size: 0.055 });
  },
  async g_tomatoes() {
    const pts = [[-0.06, 0.02], [-0.02, 0.0], [0.02, 0.02], [0.06, 0.0]];
    for (const [i, [x, z]] of pts.entries()) await kenney('tomato', { p: [x, 0, z], r: [0, i * 50, 0] }, { size: 0.06 });
    cyl(0.003, 0.003, 0.14, '#4a7a2a', 5, { p: [0, 0.06, 0.01], r: [0, 0, 90] });
    for (const [x, z] of pts) cyl(0.0025, 0.0025, 0.025, '#4a7a2a', 4, { p: [x, 0.055, z * 0.5 + 0.005], r: [z ? 25 : -25, 0, 0] });
  },
  async g_peas() {
    packet(0.14, 0.2, 0.04, '#5ab040', '#3a8a2a', { p: [0, 0.108, 0] });
    circle(0.035, '#7ad050', 10, { p: [0, 0.09, 0.031] });
    slab(0.142, 0.03, 0.002, '#f2efe6', { p: [0, 0.16, 0.026] });
  },
  async g_oven_chips() {
    packet(0.17, 0.24, 0.045, '#e8c060', '#c8a040', { p: [0, 0.13, 0] });
    slab(0.172, 0.05, 0.002, '#c83a2a', { p: [0, 0.18, 0.03] });
    for (let i = 0; i < 5; i++) chip({ p: [-0.04 + i * 0.02, 0.1, 0.036], r: [90, 0, (i - 2) * 12] });
  },

  // Snacks ---------------------------------------------------------------------------------------
  async s_crisps() {
    packet(0.13, 0.17, 0.04, '#3a6ad8', '#2a4aa8', { p: [0, 0.093, 0] });
    circle(0.035, '#f2efe6', 12, { p: [0, 0.085, 0.031], s: [1, 0.75, 1] });
    circle(0.022, '#ffd23d', 10, { p: [0, 0.085, 0.032], s: [1, 0.75, 1] });
  },
  async s_chocolate() {
    await kenney('chocolate-wrapper', {}, { size: 0.16 });
  },
  async s_fruit() {
    await kenney('apple', {}, {
      size: 0.08,
      recolour: (hex) => {
        const h = hsl(hex);
        if ((h.h < 0.06 || h.h > 0.92) && h.s > 0.35) return '#6ab040';
        return hex;
      },
    });
  },
  async s_biscuits() {
    cyl(0.035, 0.035, 0.15, '#7a2a2a', 10, { p: [0, 0.035, 0], r: [0, 0, 90] });
    for (const x of [-0.08, 0.08]) cyl(0.02, 0.034, 0.012, '#7a2a2a', 10, { p: [x, 0.035, 0], r: [0, 0, x > 0 ? -90 : 90] });
    cyl(0.0355, 0.0355, 0.03, '#d8b04a', 10, { p: [0, 0.035, 0], r: [0, 0, 90] }, true);
    cyl(0.032, 0.032, 0.008, '#c88a40', 10, { p: [0.03, 0.004, 0.07] });
    cyl(0.03, 0.03, 0.004, '#5a3a20', 10, { p: [0.03, 0.01, 0.07] });
  },

  // Home-cooked meals ----------------------------------------------------------------------------
  async m_sandwich() {
    plate(0.12);
    await kenney('sandwich', { p: [-0.025, 0.012, 0.01], r: [0, 20, 0] }, { size: 0.12 });
    await kenney('sandwich', { p: [0.035, 0.012, -0.01], r: [0, 200, 0] }, { size: 0.12 });
  },
  async m_toast() {
    plate(0.11);
    toast('#c88a40', { p: [-0.025, 0.014, 0.02], r: [-90, 0, 15] });
    toast('#c88a40', { p: [0.025, 0.026, -0.02], r: [-90, 0, -20] });
    slab(0.03, 0.003, 0.03, '#f4dc70', { p: [0.025, 0.032, 0.03], r: [0, 20, 0] });
  },
  async m_cereal() {
    await kenney('bowl-cereal', {}, { size: 0.15 });
    box(0.008, 0.003, 0.1, 'steel', { p: [0.06, 0.06, 0.02], r: [-20, 30, 0] });
  },
  async m_beans_toast() {
    plate(0.12);
    toast('#c88a40', { p: [0, 0.014, 0.045], r: [-90, 0, 0] });
    sph(0.05, '#e05a2a', 10, 4, { p: [0, 0.03, 0], s: [1, 0.3, 0.9] });
    seed = 2;
    for (let i = 0; i < 8; i++) sph(0.008, '#d84a1a', 5, 3, { p: [(rnd() - 0.5) * 0.06, 0.045, (rnd() - 0.5) * 0.06] });
  },
  async m_scrambled() {
    plate(0.12);
    toast('#c88a40', { p: [0, 0.014, 0.045], r: [-90, 0, 0] });
    seed = 8;
    for (let i = 0; i < 7; i++) sph(0.02, i % 2 ? '#f4d050' : '#f8e078', 6, 4, { p: [(rnd() - 0.5) * 0.06, 0.03 + rnd() * 0.008, (rnd() - 0.5) * 0.05], s: [1.2, 0.6, 1] });
  },
  async m_full_english() {
    plate(0.14);
    await kenney('egg-cooked', { p: [-0.05, 0.012, 0.035] }, { size: 0.08 });
    for (const [x, z] of [[0.03, 0.06], [0.045, 0.035]]) sausage(0.07, '#8a4a2a', { p: [x, 0.025, z], r: [0, 15, 90] });
    sph(0.035, '#e05a2a', 8, 4, { p: [0.05, 0.014, -0.035], s: [1, 0.35, 1] });
    await kenney('bacon', { p: [-0.035, 0.014, -0.04], r: [0, 80, 0] }, { size: 0.12 });
    for (const x of [-0.085, -0.07]) sph(0.014, '#8a6a4a', 6, 3, { p: [x, 0.016, -0.005 + x * 0.3], s: [1, 0.5, 1] });
    sph(0.022, '#e04030', 8, 4, { p: [0.095, 0.016, 0.01], s: [1, 0.6, 1] });
    toast('#c88a40', { p: [0.0, 0.015, -0.08], r: [-90, 0, 90], s: 0.7 });
  },
  async m_sausage_mash() {
    plate(0.13);
    circle(0.08, '#6a3a1a', 12, { p: [0, 0.0135, 0], r: [-90, 0, 0] });
    dome(0.045, '#f0e6c0', 10, 3, { p: [-0.03, 0.013, 0], s: [1, 0.8, 1] });
    for (const z of [-0.02, 0.02]) sausage(0.08, '#8a4a2a', { p: [0.035, 0.032, z], r: [0, 0, 70] });
    seed = 12;
    for (let i = 0; i < 9; i++) sph(0.008, '#5ab040', 5, 3, { p: [-0.02 + (rnd() - 0.5) * 0.05, 0.02, 0.065 + (rnd() - 0.5) * 0.02] });
  },
  async m_chicken_chips() {
    plate(0.13);
    sph(0.045, '#c8883a', 8, 4, { p: [-0.035, 0.018, 0], s: [0.8, 0.4, 1.3], r: [0, 20, 0] });
    seed = 7;
    for (let i = 0; i < 11; i++) chip({ p: [0.04 + (rnd() - 0.5) * 0.06, 0.02 + rnd() * 0.012, (rnd() - 0.5) * 0.08], r: [rnd() * 20, rnd() * 180, rnd() * 20] });
  },
  async m_steak() {
    plate(0.14);
    await kenney('meat-cooked', { p: [-0.02, 0.012, 0.01], r: [0, 30, 0] }, { size: 0.12 });
    for (const [x, z] of [[0.07, -0.03], [0.08, 0.02], [0.045, 0.055]]) dodec(0.018, '#d8a050', { p: [x, 0.03, z], r: [x * 900, z * 900, 0] });
    for (const [x, z] of [[-0.06, -0.06], [-0.03, -0.075]]) sph(0.016, '#8a6a4a', 6, 3, { p: [x, 0.014, z], s: [1, 0.55, 1] });
  },
  async m_pasta() {
    cyl(0.14, 0.12, 0.05, '#e8e0cc', 4, { p: [0, 0.025, 0], r: [0, 45, 0], s: [1, 1, 0.7] });
    box(0.18, 0.004, 0.125, '#c83a2a', { p: [0, 0.046, 0] });
    seed = 11;
    for (let i = 0; i < 9; i++) sph(0.02, i % 3 ? '#f0c040' : '#c8883a', 6, 3, { p: [(rnd() - 0.5) * 0.15, 0.048, (rnd() - 0.5) * 0.09], s: [1.3, 0.25, 1] });
    for (let i = 0; i < 4; i++) cyl(0.006, 0.006, 0.025, '#e8a040', 6, { p: [(rnd() - 0.5) * 0.12, 0.052, (rnd() - 0.5) * 0.07], r: [0, rnd() * 180, 90] });
  },
  async m_burger() {
    plate(0.12);
    await kenney('burger-cheese', { p: [0, 0.012, 0] }, { size: 0.13 });
  },
  async m_curry() {
    plate(0.13);
    dome(0.05, '#f4f0e6', 10, 3, { p: [-0.035, 0.012, 0], s: [1, 0.55, 1] });
    sph(0.05, '#d88a2a', 10, 4, { p: [0.035, 0.015, 0], s: [1, 0.25, 1] });
    for (let i = 0; i < 5; i++) box(0.016, 0.012, 0.016, '#e8b080', { p: [0.02 + (i % 3) * 0.015, 0.026, -0.02 + i * 0.01], r: [0, i * 40, 0] });
  },

  // Collectibles ---------------------------------------------------------------------------------
  async signed_shirt() {
    const o = [[-0.12, 0], [0.12, 0], [0.12, 0.2], [0.2, 0.17], [0.23, 0.24], [0.12, 0.31], [0.04, 0.31], [0, 0.28], [-0.04, 0.31], [-0.12, 0.31], [-0.23, 0.24], [-0.2, 0.17], [-0.12, 0.2]];
    extrude(o, 0.012, '#b3121b', { r: [-90, 0, 0], p: [0, 0.006, 0.15] });
    extrude([[-0.04, 0.31], [0, 0.27], [0.04, 0.31], [0.03, 0.312], [0, 0.285], [-0.03, 0.312]], 0.013, '#f2efe6', { r: [-90, 0, 0], p: [0, 0.0065, 0.15] });
    for (const x of [-0.2, 0.2]) box(0.07, 0.013, 0.02, '#f2efe6', { p: [x * 1.06, 0.006, 0.15 - 0.2], r: [0, x > 0 ? -60 : 60, 0] });
    seed = 13;
    for (let i = 0; i < 9; i++) box(0.04 + rnd() * 0.03, 0.0135, 0.003, '#101014', { p: [(rnd() - 0.5) * 0.17, 0.006, 0.12 - 0.04 - rnd() * 0.2], r: [0, (rnd() - 0.5) * 50, 0] });
  },
  async programme_1966() {
    slab(0.15, 0.008, 0.21, '#e8e4d8');
    slab(0.151, 0.0085, 0.03, '#b3121b', { p: [0, 0, -0.07] });
    slab(0.151, 0.0085, 0.012, '#1f3f8a', { p: [0, 0, -0.05] });
    lathe([[0, 0], [0.025, 0], [0.025, 0.001], [0, 0.001]], '#d8b04a', 10, { p: [0, 0.0083, 0.02] });
    slab(0.08, 0.0088, 0.006, '#101014', { p: [0, 0, 0.07] });
  },
  async vintage_football() {
    ico(0.11, '#8a5a32', 1, { p: [0, 0.11, 0] });
    box(0.006, 0.008, 0.06, '#e8d0a0', { p: [0, 0.218, 0] });
    for (let i = 0; i < 4; i++) box(0.022, 0.009, 0.004, '#e8d0a0', { p: [0, 0.219, -0.022 + i * 0.015] });
  },
  async pocket_watch() {
    cyl(0.025, 0.025, 0.012, 'silver', 16, { p: [0, 0.025, 0], r: [90, 0, 0] });
    circle(0.021, '#f2efe6', 16, { p: [0, 0.025, 0.0062] });
    box(0.0015, 0.016, 0.001, '#101014', { p: [0, 0.031, 0.0068] });
    box(0.012, 0.0015, 0.001, '#101014', { p: [0.005, 0.025, 0.0068] });
    cyl(0.004, 0.004, 0.006, 'silver', 8, { p: [0, 0.053, 0] });
    torus(0.008, 0.0018, 'silver', 4, 10, { p: [0, 0.062, 0] });
    for (let i = 0; i < 5; i++) torus(0.005, 0.0012, 'silver', 3, 6, { p: [0.008 + i * 0.008, 0.07 - i * 0.012, 0], r: [0, i % 2 ? 90 : 0, -45] });
  },
  async toby_jug() {
    lathe([[0, 0], [0.045, 0], [0.055, 0.03], [0.055, 0.07], [0.042, 0.1], [0.035, 0.11], [0, 0.11]], '#4a2e1a', 12);
    cyl(0.056, 0.056, 0.02, '#7a2a2a', 12, { p: [0, 0.06, 0] }, true);
    sph(0.034, '#e8c8a0', 8, 6, { p: [0, 0.135, 0] });
    sph(0.008, '#d88a7a', 5, 3, { p: [0, 0.133, 0.034] });
    cyl(0.055, 0.055, 0.012, '#101014', 3, { p: [0, 0.165, 0], r: [0, 180, 0] });
    cyl(0.028, 0.034, 0.02, '#101014', 10, { p: [0, 0.178, 0] });
    torus(0.03, 0.007, '#4a2e1a', 4, 8, { p: [-0.058, 0.07, 0], r: [0, 0, 90] }, Math.PI);
  },
  async candlestick() {
    lathe([[0, 0], [0.05, 0], [0.05, 0.008], [0.04, 0.015], [0.012, 0.025], [0.01, 0.06], [0.018, 0.07], [0.01, 0.08], [0.009, 0.16], [0.016, 0.17], [0.024, 0.19], [0.022, 0.195], [0, 0.195]], 'silver', 12);
    cyl(0.011, 0.011, 0.09, '#f2efe6', 10, { p: [0, 0.24, 0] });
    cyl(0.001, 0.001, 0.012, '#101014', 4, { p: [0, 0.29, 0] });
  },
  async vinyl_rare() {
    box(0.31, 0.31, 0.004, '#1f3f8a', { p: [0, 0.155, 0] });
    box(0.2, 0.06, 0.0045, '#ff4fd8', { p: [0, 0.22, 0] });
    circle(0.06, '#ffd23d', 12, { p: [-0.04, 0.12, 0.0024] });
    cyl(0.15, 0.15, 0.002, '#1b1d22', 24, { p: [0.09, 0.17, -0.004], r: [90, 0, 0] });
    cyl(0.05, 0.05, 0.0025, '#e8333a', 16, { p: [0.09, 0.17, -0.004], r: [90, 0, 0] });
  },
  async match_ticket() {
    slab(0.12, 0.002, 0.06, '#e8c060');
    slab(0.12, 0.0022, 0.012, '#b3121b', { p: [0, 0, -0.018] });
    for (let i = 0; i < 3; i++) slab(0.05 - i * 0.01, 0.0024, 0.004, '#4a2e1a', { p: [-0.02, 0, 0.0 + i * 0.01] });
    for (let i = 0; i < 6; i++) slab(0.002, 0.0024, 0.006, '#8a6a3a', { p: [0.04, 0, -0.025 + i * 0.01] });
  },

  // Quest items ----------------------------------------------------------------------------------
  async gaffer_ledger() {
    slab(0.18, 0.004, 0.24, '#7a2a2a');
    slab(0.17, 0.028, 0.23, '#e8e0cc', { p: [0.002, 0.004, 0] });
    slab(0.18, 0.004, 0.24, '#7a2a2a', { p: [0, 0.032, 0] });
    box(0.012, 0.036, 0.24, '#5a1e1e', { p: [-0.09, 0.018, 0] });
    box(0.006, 0.037, 0.241, '#101014', { p: [0.04, 0.018, 0] });
    slab(0.06, 0.0005, 0.03, '#d8b04a', { p: [0.0, 0.036, -0.06] });
  },
  async lockup_key() {
    torus(0.018, 0.0025, 'steel', 4, 12, { p: [0, 0.0025, 0], r: [90, 0, 0] });
    cyl(0.013, 0.013, 0.004, 'brass', 10, { p: [0.032, 0.002, 0] });
    slab(0.05, 0.004, 0.009, 'brass', { p: [0.065, 0, 0] });
    for (let i = 0; i < 4; i++) slab(0.006, 0.004, 0.005 + (i % 2) * 0.003, 'brass', { p: [0.06 + i * 0.009, 0, -0.006] });
    slab(0.035, 0.002, 0.05, '#e8a040', { p: [-0.03, 0, 0.02], r: [0, 25, 0] });
    slab(0.02, 0.0022, 0.008, '#101014', { p: [-0.03, 0, 0.022], r: [0, 25, 0] });
  },
  async vip_pass() {
    box(0.054, 0.086, 0.002, '#1b1d22', { p: [0, 0.043, 0] });
    box(0.054, 0.016, 0.0025, 'gold', { p: [0, 0.06, 0] });
    box(0.04, 0.012, 0.0026, '#ff4fd8', { p: [0, 0.03, 0] });
    box(0.01, 0.004, 0.003, '#8a8a8a', { p: [0, 0.082, 0] });
    torus(0.05, 0.004, '#e8333a', 3, 14, { p: [0, 0.135, 0], s: [0.6, 1, 0.3] });
  },
  async dunc_phone() {
    slab(0.046, 0.11, 0.017, '#2a2a2e');
    box(0.034, 0.03, 0.002, 'screen', { p: [0, 0.08, 0.0085] });
    for (let i = 0; i < 12; i++) box(0.009, 0.006, 0.003, '#8a8a8a', { p: [-0.012 + (i % 3) * 0.012, 0.05 - Math.floor(i / 3) * 0.01, 0.009] });
    box(0.008, 0.016, 0.006, '#2a2a2e', { p: [0.014, 0.115, 0] });
  },
  async stadium_key() {
    cyl(0.005, 0.005, 0.07, 'darksteel', 6, { p: [0, 0.035, 0] });
    cyl(0.006, 0.006, 0.08, 'darksteel', 6, { p: [0, 0.07, 0], r: [0, 0, 90] });
    box(0.012, 0.012, 0.012, 'darksteel', { p: [0, 0.006, 0] });
    torus(0.012, 0.002, 'steel', 4, 10, { p: [0.04, 0.07, 0], r: [0, 90, 0] });
    box(0.03, 0.045, 0.002, '#b3121b', { p: [0.045, 0.04, 0], r: [0, 0, 8] });
    box(0.03, 0.012, 0.0025, '#f2efe6', { p: [0.045, 0.04, 0], r: [0, 0, 8] });
  },

  // Materials and odds ---------------------------------------------------------------------------
  async scrap_metal() {
    cyl(0.011, 0.011, 0.2, 'copper', 8, { p: [0, 0.011, 0], r: [0, 20, 90] });
    cyl(0.009, 0.009, 0.12, 'copper', 8, { p: [0.02, 0.009, 0.05], r: [0, -30, 90] });
    torus(0.03, 0.01, 'copper', 6, 6, { p: [-0.08, 0.01, 0.05], r: [90, 0, 0] }, Math.PI / 2);
    box(0.08, 0.004, 0.025, 'darksteel', { p: [0.05, 0.03, -0.03], r: [0, 40, 25] });
    box(0.05, 0.004, 0.025, 'darksteel', { p: [-0.04, 0.008, -0.04], r: [0, -20, 0] });
  },
  async duct_tape() {
    lathe([[0.04, 0], [0.06, 0], [0.06, 0.05], [0.04, 0.05], [0.04, 0]], '#8a8e94', 16);
    lathe([[0.035, 0], [0.04, 0], [0.04, 0.05], [0.035, 0.05], [0.035, 0]], '#c8a070', 16);
    box(0.05, 0.05, 0.001, '#8a8e94', { p: [0.06, 0.025, 0.02], r: [0, -70, 0] });
  },
  async bolts() {
    cyl(0.04, 0.038, 0.07, 'plastic_clear', 10, { p: [0, 0.035, 0] });
    cyl(0.042, 0.042, 0.015, '#1f3f8a', 10, { p: [0, 0.077, 0] });
    seed = 21;
    for (let i = 0; i < 4; i++) {
      const x = 0.06 + (i % 2) * 0.03;
      const z = -0.03 + i * 0.022;
      cyl(0.008, 0.008, 0.006, 'steel', 6, { p: [x, 0.003, z] });
      if (i % 2 === 0) cyl(0.003, 0.003, 0.035, 'steel', 6, { p: [x + 0.017, 0.004, z], r: [0, rnd() * 90, 90] });
    }
  },
  async leather_strip() {
    for (const [i, r] of [0.02, 0.026, 0.032, 0.038].entries()) lathe([[r, 0], [r + 0.004, 0], [r + 0.004, 0.025], [r, 0.025], [r, 0]], i % 2 ? '#6a4028' : '#5a3420', 14);
    box(0.08, 0.025, 0.004, '#6a4028', { p: [0.06, 0.0125, 0.035], r: [0, -15, 0] });
  },
  async steel_bar() {
    for (let i = 0; i < 3; i++) box(0.4, 0.022, 0.022, 'darksteel', { p: [0, 0.011 + (i === 2 ? 0.022 : 0), -0.012 + (i === 2 ? 0 : i * 0.024)] });
    for (const x of [-0.12, 0.12]) box(0.02, 0.05, 0.052, '#1f3f8a', { p: [x, 0.022, 0] });
  },
  async spring_steel() {
    for (let i = 0; i < 3; i++) bentBox(0.35 - i * 0.08, 0.008, 0.05, 0.6, '#3a4a5a', { p: [0, 0.004 + i * 0.008, 0] });
    box(0.03, 0.04, 0.06, 'darksteel', { p: [0, 0.015, 0] });
  },
  async carbon_fibre() {
    slab(0.3, 0.004, 0.2, '#1a1a1c');
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) slab(0.05, 0.0045, 0.05, '#2a2a30', { p: [-0.125 + i * 0.05, 0, -0.075 + j * 0.05] });
    slab(0.3, 0.004, 0.2, '#1a1a1c', { p: [0.02, 0.0045, 0.015], r: [0, 6, 0] });
  },
  async lighter() {
    slab(0.038, 0.04, 0.013, 'silver');
    box(0.038, 0.016, 0.013, 'silver', { p: [-0.019, 0.04 + 0.008, 0], r: [0, 0, 100], then: { p: [0, 0, 0] } });
    slab(0.016, 0.014, 0.01, 'steel', { p: [0.006, 0.04, 0] });
    cyl(0.0035, 0.0035, 0.004, 'darksteel', 8, { p: [-0.004, 0.05, 0], r: [90, 0, 0] });
    box(0.03, 0.002, 0.0132, '#8a8a8a', { p: [0, 0.03, 0] });
  },
  async bus_pass() {
    slab(0.086, 0.002, 0.054, '#2f6fa8');
    slab(0.086, 0.0022, 0.012, '#f2efe6', { p: [0, 0, -0.018] });
    slab(0.022, 0.0024, 0.026, '#c8a070', { p: [-0.028, 0, 0.01] });
    slab(0.03, 0.0024, 0.012, '#ffd23d', { p: [0.015, 0, 0.012] });
  },
  async bag_bumbag() {
    capsule(0.05, 0.12, '#1b1d22', { p: [0, 0.05, 0], r: [0, 0, 90], s: [1, 1, 0.55] }, 2, 8);
    box(0.17, 0.003, 0.003, '#8a8a8a', { p: [0, 0.07, 0.027] });
    torus(0.16, 0.008, '#2a2a2e', 3, 14, { p: [0, 0.055, -0.13], r: [90, 0, 0], s: [1.1, 0.8, 1] }, Math.PI);
    box(0.025, 0.02, 0.008, '#e8333a', { p: [0.0, 0.055, 0.03] });
  },
  async bag_rucksack() {
    slab(0.26, 0.3, 0.14, '#2f4a2d');
    cyl(0.07, 0.07, 0.26, '#2f4a2d', 8, { p: [0, 0.3, 0], r: [0, 0, 90] }, false);
    slab(0.18, 0.13, 0.04, '#3a5a38', { p: [0, 0.03, 0.08] });
    box(0.19, 0.012, 0.042, '#1b1d22', { p: [0, 0.165, 0.08] });
    for (const x of [-0.07, 0.07]) bentBox(0.32, 0.04, 0.01, -1.4, '#1b1d22', { r: [0, 0, 90], p: [x, 0.2, -0.08] });
    torus(0.03, 0.007, '#1b1d22', 3, 8, { p: [0, 0.37, 0] }, Math.PI);
  },
  async bag_holdall() {
    cyl(0.12, 0.12, 0.5, '#1f2a44', 10, { p: [0, 0.115, 0], r: [0, 0, 90], s: [1, 1, 0.8] });
    cyl(0.1205, 0.1205, 0.05, '#f2efe6', 10, { p: [0.12, 0.115, 0], r: [0, 0, 90], s: [1, 1, 0.8] }, true);
    cyl(0.1205, 0.1205, 0.05, '#f2efe6', 10, { p: [-0.12, 0.115, 0], r: [0, 0, 90], s: [1, 1, 0.8] }, true);
    for (const z of [-0.05, 0.05]) torus(0.07, 0.008, '#1b1d22', 3, 10, { p: [0, 0.225, z] }, Math.PI);
    box(0.4, 0.004, 0.006, '#8a8a8a', { p: [0, 0.235, 0] });
  },
};

/** Drop zero-area triangles, then share vertices that match exactly (flat normals stay flat). */
function dropDegenerate(geo) {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const keepP = [];
  const keepN = [];
  const groups = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const g of geo.groups) {
    const start = keepP.length / 3;
    for (let f = g.start; f < g.start + g.count; f += 3) {
      a.fromBufferAttribute(pos, f);
      b.fromBufferAttribute(pos, f + 1);
      c.fromBufferAttribute(pos, f + 2);
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-14) continue;
      for (let k = 0; k < 3; k++) {
        keepP.push(pos.getX(f + k), pos.getY(f + k), pos.getZ(f + k));
        keepN.push(nrm.getX(f + k), nrm.getY(f + k), nrm.getZ(f + k));
      }
    }
    groups.push([start, keepP.length / 3 - start, g.materialIndex]);
  }
  let out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
  for (const [s, n, m] of groups) out.addGroup(s, n, m);
  out = mergeVertices(out, 1e-6);
  return out;
}

// ---- assembly and export --------------------------------------------------------------------
function assemble(id) {
  const byCol = new Map();
  for (const p of parts) {
    if (!byCol.has(p.col)) byCol.set(p.col, []);
    byCol.get(p.col).push(p.geo);
  }
  const geos = [];
  const ms = [];
  for (const [col, list] of byCol) {
    const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)), false);
    geos.push(g);
    ms.push(material(col));
  }
  const geo = mergeGeometries(geos, true);
  // Bottom centre at the origin.
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(dropDegenerate(geo), ms);
  mesh.name = id;
  return mesh;
}

export const IDS = Object.keys(M);

/**
 * Flat things (cards, tickets, books, records, the shirt) are stood on edge, face to +Z: the game shows
 * pickups turning in the air from a side-on camera, and a card lying flat reads as a sliver.
 */
const STAND_UP = new Set(['match_ticket', 'bus_pass', 'programme_1966', 'gaffer_ledger', 'signed_shirt', 'carbon_fibre']);

export async function build(id) {
  parts = [];
  seed = 1;
  await M[id]();
  if (STAND_UP.has(id)) for (const p of parts) p.geo.rotateX(Math.PI / 2);
  return assemble(id);
}

export async function exportGlb(id) {
  const mesh = await build(id);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const buf = await new GLTFExporter().parseAsync(scene, { binary: true });
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A contact sheet of every model, for checking by eye. */
export async function sheet(ids = IDS, cell = 160, cols = 10) {
  const rows = Math.ceil(ids.length / cols);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(cell, cell);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const out = document.createElement('canvas');
  out.width = cell * cols;
  out.height = (cell + 14) * rows;
  const cx = out.getContext('2d');
  cx.fillStyle = '#3a3a3e';
  cx.fillRect(0, 0, out.width, out.height);
  for (const [i, id] of ids.entries()) {
    const mesh = await build(id);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#5a5a5e');
    scene.add(new THREE.HemisphereLight('#ffffff', '#404050', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    scene.add(mesh);
    const bb = new THREE.Box3().setFromObject(mesh);
    const c = bb.getCenter(new THREE.Vector3());
    const rad = bb.getSize(new THREE.Vector3()).length() / 2;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.001, 10);
    cam.position.copy(c).add(new THREE.Vector3(0.9, 0.75, 1.2).normalize().multiplyScalar(rad / Math.sin(15 * D) * 1.05));
    cam.lookAt(c);
    r.render(scene, cam);
    cx.drawImage(r.domElement, (i % cols) * cell, Math.floor(i / cols) * (cell + 14));
    cx.fillStyle = '#fff';
    cx.font = '11px sans-serif';
    cx.fillText(id, (i % cols) * cell + 3, Math.floor(i / cols) * (cell + 14) + cell + 11);
  }
  return out.toDataURL('image/png');
}
