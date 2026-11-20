import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fitUVs, surface } from '../materials/library';

/**
 * The four bags you can wear, built to match their Hard Graft icons: black diamond-quilted leather with a red
 * stripe, black webbing, silver buckles. Worn ones come with their straps fitted round the torso; on the ground
 * (`worn: false`) they're just the bag.
 *
 * Worn bags are built in the body's own rest-pose space, moved so the origin is 1.07 m up the middle (`BAG_ORIGIN`):
 * +y up, +z the way the chest faces, x across. Measured on the MakeHuman body in a hoodie: the back is about
 * 0.10 behind, the front 0.165 ahead (the hoodie's pocket), the waist 0.175 to each side at y -0.03 and the tops
 * of the shoulders about 0.47 up at x ±0.1. What rides on the chest and shoulders goes on the upper spine bone,
 * what sits at the waist on the pelvis (`FighterView.setBag`), so both follow every pose.
 */

export type WornBagId = 'bag_bumbag' | 'bag_rucksack' | 'bag_holdall' | 'bag_hiking';
export const WORN_BAGS: readonly WornBagId[] = ['bag_bumbag', 'bag_rucksack', 'bag_holdall', 'bag_hiking'];
/** Where a worn bag's origin is in the body's rest pose (mesh space, metres). */
export const BAG_ORIGIN = new THREE.Vector3(0, 1.07, 0);
/** A worn bag in two parts: what moves with the chest and shoulders, and what moves with the hips. */
export type WornBag = { upper: THREE.Group; lower: THREE.Group };

const mats = () => ({
  quilt: surface('Leather034D', { tint: '#2b2c31', plain: true, rough: 0.75, w: 1.5, h: 1.5, normal: 1.8 }),
  red: surface('Fabric082A', { tint: '#a50e17', plain: true }),
  web: surface('Fabric082A', { tint: '#131316', plain: true }),
  panel: surface('Leather009', { tint: '#1c1c20', plain: true }),
  metal: new THREE.MeshStandardMaterial({ color: '#b9bdc4', metalness: 0.35, roughness: 0.38 }),
});
type Mats = ReturnType<typeof mats>;
let shared: Mats | null = null;

function box(w: number, h: number, d: number, r: number, m: THREE.Material): THREE.Mesh {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999) : new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(g, m);
}
const at = (o: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => {
  o.position.set(x, y, z);
  return o;
};

/**
 * A flat strap (webbing) along a path. `centre` is the point the strap wraps round: its flat face turns to face
 * away from it, so straps lie flat on the body.
 */
function strap(points: [number, number, number][], centre: THREE.Vector3, width: number, m: THREE.Material, closed = false, thick = 0.009): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  const n = Math.max(12, points.length * 8);
  const pos: number[] = [];
  const idx: number[] = [];
  const t = new THREE.Vector3();
  const out = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const rings = closed ? n : n + 1;
  for (let i = 0; i < rings; i++) {
    const u = i / n;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, t);
    out.copy(p).sub(centre).normalize();
    side.crossVectors(t, out).normalize();
    up.crossVectors(side, t).normalize();
    for (const [a, b] of [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const) {
      pos.push(p.x + side.x * a * width * 0.5 + up.x * b * thick * 0.5, p.y + side.y * a * width * 0.5 + up.y * b * thick * 0.5, p.z + side.z * a * width * 0.5 + up.z * b * thick * 0.5);
    }
  }
  const segs = closed ? n : n;
  for (let i = 0; i < segs; i++) {
    const a = i * 4;
    const b = ((i + 1) % rings) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Webbing's weave along the strap: u runs along it.
  const uv: number[] = [];
  for (let i = 0; i < rings; i++) for (let k = 0; k < 4; k++) uv.push((i / n) * curve.getLength() * 6, k < 2 ? 0 : 0.2);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

/** A side-release buckle: a silver plate with a dark slot. */
function buckle(m: Mats, w = 0.05): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w, w * 0.62, 0.012, 0.004, m.metal));
  g.add(at(box(w * 0.6, w * 0.22, 0.014, 0, m.web), 0, 0, 0.001));
  return g;
}

/**
 * A daypack, as in the rucksack icon: quilted body, a flap with the red stripe, a front pocket, two buckled
 * straps down the flap and a grab handle. Its back is at z = 0; it faces -z (away from you when worn).
 */
function pack(m: Mats, w: number, h: number, d: number, big: boolean): THREE.Group {
  const g = new THREE.Group();
  const body = box(w, h, d, 0.05, m.quilt);
  body.position.set(0, h / 2, -d / 2);
  g.add(body);
  // Padded back panel against you.
  g.add(at(box(w * 0.86, h * 0.86, 0.02, 0.008, m.panel), 0, h * 0.5, 0.004));
  // Flap over the top third, a touch bigger than the body, with the red stripe down its middle.
  const flapH = h * 0.36;
  const flap = box(w * 1.02, flapH, d * 0.55, 0.03, m.quilt);
  flap.position.set(0, h - flapH / 2 + 0.01, -d * 0.74);
  g.add(flap);
  g.add(at(box(w * 0.17, flapH + 0.004, d * 0.56, 0.01, m.red), 0, h - flapH / 2 + 0.012, -d * 0.745));
  // Front pocket, low on the face.
  const pw = w * (big ? 0.62 : 0.66);
  const ph = h * 0.32;
  g.add(at(box(pw, ph, 0.07, 0.022, m.quilt), 0, h * 0.24, -d - 0.025));
  g.add(at(box(pw * 0.92, 0.008, 0.075, 0, m.metal), 0, h * 0.24 + ph * 0.38, -d - 0.026));
  // Two straps down the flap to buckles on the pocket.
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.24;
    g.add(at(box(0.03, h * 0.5, 0.008, 0, m.web), x, h * 0.62, -d - 0.004));
    const b = buckle(m, 0.04);
    b.position.set(x, h * 0.42, -d - 0.064);
    g.add(b);
    if (big) {
      // Side pockets and compression straps.
      g.add(at(box(0.05, h * 0.34, d * 0.7, 0.02, m.quilt), sx * (w / 2 + 0.02), h * 0.22, -d * 0.5));
      g.add(at(box(0.008, 0.03, d * 0.9, 0, m.web), sx * (w / 2 + 0.003), h * 0.62, -d * 0.5));
    }
  }
  // Grab handle on top.
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), m.web);
  handle.position.set(0, h - 0.004, -0.03);
  g.add(handle);
  if (big) {
    // A rolled red mat strapped under the lid, as on a hiking pack.
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, w * 1.08, 14), m.red);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, h + 0.055, -d * 0.5);
    g.add(roll);
    for (const sx of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.006, 4, 16), m.web);
      band.rotation.y = Math.PI / 2;
      band.position.set(sx * w * 0.3, h + 0.055, -d * 0.5);
      g.add(band);
    }
  }
  return g;
}

/**
 * The gym holdall, as in its icon: a soft quilted barrel, a red panel down each side, red piping round the ends,
 * webbing bands carrying the two handles, a zip along the top. Its axis is z.
 */
function holdall(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const L = 0.48;
  const r = 0.12;
  // A barrel that's a little soft: rounded ends, slightly squashed.
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const z = -L / 2 + t * L;
    const end = Math.min(t, 1 - t) * L;
    const rr = r * (end < 0.03 ? 0.82 + 0.18 * Math.sin((end / 0.03) * Math.PI * 0.5) : 1) * (1 + 0.03 * Math.sin(t * Math.PI));
    prof.push(new THREE.Vector2(rr, z));
  }
  prof.unshift(new THREE.Vector2(0, -L / 2));
  prof.push(new THREE.Vector2(0, L / 2));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), m.quilt);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1, 1, 0.9);
  g.add(body);
  for (const sz of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, 0.008, 6, 26), m.red);
    pipe.position.z = sz * (L / 2 - 0.006);
    pipe.scale.y = 0.9;
    g.add(pipe);
    // Webbing bands round the barrel, carrying the handles.
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.045, 0.006, 4, 26), m.web);
    band.position.z = sz * 0.1;
    band.scale.y = 0.9;
    g.add(band);
    // A red panel down each side.
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.042, r * 1.042, L * 0.46, 16, 1, true, (sz > 0 ? Math.PI / 2 : Math.PI * 1.5) - 0.6, 1.2), m.red);
    panel.rotation.x = Math.PI / 2;
    panel.scale.set(1, 1, 0.9);
    g.add(panel);
  }
  // Zip along the top.
  g.add(at(box(0.012, 0.006, L * 0.78, 0, m.metal), 0, r * 0.9 + 0.002, 0));
  for (const sz of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 14, Math.PI), m.web);
    h.rotation.y = Math.PI / 2;
    h.position.set(0, r * 0.9 - 0.01, sz * 0.0);
    h.rotation.x = sz * 0.5;
    g.add(h);
  }
  return g;
}

/** The bum bag, as in its icon: a quilted crescent pouch, red stripe, front pocket, zips. Faces +z. */
function pouch(m: Mats): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  // Flat top, round belly, drawn in x (across) and y.
  shape.moveTo(-0.13, 0.03);
  shape.quadraticCurveTo(-0.135, 0.06, -0.1, 0.062);
  shape.lineTo(0.1, 0.062);
  shape.quadraticCurveTo(0.135, 0.06, 0.13, 0.03);
  shape.quadraticCurveTo(0.12, -0.065, 0, -0.07);
  shape.quadraticCurveTo(-0.12, -0.065, -0.13, 0.03);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.016, bevelSegments: 3, curveSegments: 10 });
  const body = new THREE.Mesh(geo, m.quilt);
  g.add(body);
  // Front pocket (a smaller crescent) with its zip.
  const ps = new THREE.Shape();
  ps.moveTo(-0.085, 0);
  ps.lineTo(0.085, 0);
  ps.quadraticCurveTo(0.075, -0.05, 0, -0.055);
  ps.quadraticCurveTo(-0.075, -0.05, -0.085, 0);
  const pocket = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 }), m.quilt);
  pocket.position.set(0, 0.0, 0.07);
  g.add(pocket);
  g.add(at(box(0.16, 0.006, 0.006, 0, m.metal), 0, -0.002, 0.092));
  // Red stripe up the middle, above the pocket.
  g.add(at(box(0.04, 0.06, 0.088, 0.008, m.red), 0, 0.034, 0.037));
  // Main zip across the top of the face, and its pull.
  g.add(at(box(0.22, 0.006, 0.006, 0, m.metal), 0, 0.072, 0.06));
  g.add(at(box(0.012, 0.03, 0.006, 0.003, m.metal), 0.07, 0.058, 0.066));
  return g;
}

const C = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function finish(root: THREE.Object3D): void {
  fitUVs(root);
  root.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** A bag on the ground (or in a shop): just the bag, standing on y = 0. */
export function bagModel(id: WornBagId): THREE.Group {
  const m = (shared ??= mats());
  const root = new THREE.Group();
  root.name = `bag:${id}`;
  if (id === 'bag_rucksack' || id === 'bag_hiking') {
    const big = id === 'bag_hiking';
    const p = pack(m, big ? 0.36 : 0.3, big ? 0.56 : 0.4, big ? 0.2 : 0.14, big);
    p.position.z = (big ? 0.2 : 0.14) / 2;
    root.add(p);
  } else if (id === 'bag_holdall') {
    const b = holdall(m);
    b.position.y = 0.12;
    root.add(b);
  } else {
    const p = pouch(m);
    p.position.y = 0.07;
    root.add(p);
  }
  finish(root);
  return root;
}

/** A bag as worn, straps and all, in the body's rest-pose space about `BAG_ORIGIN`. */
export function wornBag(id: WornBagId): WornBag {
  const m = (shared ??= mats());
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  upper.name = lower.name = `bag:${id}`;
  if (id === 'bag_rucksack' || id === 'bag_hiking') {
    const big = id === 'bag_hiking';
    const [w, h, d] = big ? [0.36, 0.56, 0.2] : [0.3, 0.4, 0.14];
    const p = pack(m, w, h, d, big);
    const back = -0.118;
    const y0 = big ? -0.14 : -0.03;
    p.position.set(0, y0, back);
    p.rotation.x = 0.05;
    upper.add(p);
    // Shoulder straps: from the top of the bag over each shoulder, down the chest, under the arm to its foot.
    const c = C(0, 0.22, 0.03);
    for (const sx of [-1, 1]) {
      upper.add(
        strap(
          [
            [sx * 0.07, y0 + h - 0.05, back - 0.012],
            [sx * 0.09, 0.42, -0.085],
            [sx * 0.1, 0.475, 0.0],
            [sx * 0.1, 0.43, 0.1],
            [sx * 0.11, 0.33, 0.162],
            [sx * 0.12, 0.21, 0.186],
            [sx * 0.15, 0.11, 0.165],
            [sx * 0.185, 0.06, 0.05],
            [sx * 0.15, y0 + 0.06, back - 0.025],
          ],
          c,
          0.05,
          m.web,
          false,
          0.012,
        ),
      );
    }
    // Chest strap with its buckle.
    upper.add(strap([[-0.115, 0.29, 0.168], [0, 0.29, 0.172], [0.115, 0.29, 0.168]], C(0, 0.29, 0), 0.022, m.web));
    const cb = buckle(m, 0.034);
    cb.position.set(0, 0.29, 0.179);
    upper.add(cb);
    if (big) {
      // Hip belt: padded wings at the sides, webbing round the front, buckle at the middle.
      const y = -0.08;
      lower.add(strap([[0, y, -0.105], [0.13, y, -0.09], [0.185, y, 0.02], [0.14, y, 0.15], [0, y, 0.172], [-0.14, y, 0.15], [-0.185, y, 0.02], [-0.13, y, -0.09]], C(0, y, 0.03), 0.035, m.web, true));
      for (const sx of [-1, 1]) lower.add(strap([[sx * 0.09, y, -0.11], [sx * 0.165, y, -0.06], [sx * 0.19, y, 0.04]], C(0, y, 0.03), 0.075, m.quilt, false, 0.025));
      const hb = buckle(m, 0.05);
      hb.position.set(0, y, 0.18);
      lower.add(hb);
    }
  } else if (id === 'bag_holdall') {
    // At your left hip on a strap over the right shoulder, the barrel running front to back.
    const b = holdall(m);
    b.position.set(-0.315, -0.16, 0.03);
    b.rotation.z = 0.06;
    lower.add(b);
    const c = C(0, 0.18, 0.03);
    upper.add(
      strap(
        [
          [-0.3, -0.05, 0.14],
          [-0.22, 0.06, 0.18],
          [-0.09, 0.2, 0.19],
          [0.04, 0.33, 0.16],
          [0.1, 0.43, 0.09],
          [0.105, 0.48, 0.0],
          [0.08, 0.42, -0.09],
          [-0.03, 0.3, -0.112],
          [-0.15, 0.15, -0.11],
          [-0.26, 0.02, -0.09],
          [-0.3, -0.05, -0.08],
        ],
        c,
        0.04,
        m.web,
      ),
    );
    upper.add(strap([[0.095, 0.44, 0.07], [0.105, 0.482, 0.0], [0.09, 0.44, -0.07]], c, 0.065, m.quilt, false, 0.02));
  } else {
    // Round the front of the waist, belt all the way round, buckle at the left hip.
    const y = -0.03;
    const p = pouch(m);
    p.position.set(0, y - 0.01, 0.168);
    p.rotation.x = -0.08;
    lower.add(p);
    lower.add(strap([[0, y, 0.18], [0.12, y, 0.163], [0.182, y, 0.06], [0.18, y, -0.04], [0.12, y, -0.105], [0, y, -0.115], [-0.12, y, -0.105], [-0.18, y, -0.04], [-0.182, y, 0.06], [-0.12, y, 0.163]], C(0, y, 0.03), 0.032, m.web, true));
    const b = buckle(m, 0.042);
    b.position.set(-0.188, y, 0.01);
    b.rotation.y = -Math.PI / 2;
    lower.add(b);
  }
  finish(upper);
  finish(lower);
  return { upper, lower };
}
