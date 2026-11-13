/**
 * Jewellery on the MakeHuman characters: rings on the ring finger, a watch on
 * the wrist, a chain round the neck and a grill on the top teeth.
 *
 * Each piece is measured off the character it goes on, in the rest pose,
 * before anything moves: the finger, wrist and neck are sampled from the
 * skinned vertices (skin and clothes both) that belong to that bone, so a
 * ring fits a thick finger or a gloved one, a watch sits on top of a sleeve,
 * and a chain lies over a hoodie, without cutting into any of them. Then the
 * piece is parented to the bone it rides on, so it follows every animation.
 *
 * Real jewellery is a few millimetres thick, which is invisible from the
 * game's camera, so thicknesses are drawn larger than life (LIFE) while the
 * fit itself stays true.
 */
import * as THREE from 'three';
import type { CharacterAppearance } from '../character/Appearance';
import {
  FINISHES,
  JEWELS,
  STONES,
  type ChainLink,
  type JewelCat,
  type JewelDef,
  type JewelLook,
  type Pendant,
} from '../items/jewellery';

/** How much thicker than life the metal is drawn. */
const LIFE = 1.7;
/** Air between a piece and whatever it sits on. */
const CLEAR = 0.0025;

const UP = new THREE.Vector3(0, 1, 0);

interface Cloud {
  /** Rest-pose positions, xyz. */
  pos: Float32Array;
  /** Strongest bone per vertex (skeleton index) and its weight. */
  bone: Int16Array;
  weight: Float32Array;
  /** Which mesh each vertex came from (0 = the body's skin, anything else is clothing). */
  part: Uint8Array;
  partNames: string[];
}

/** Everything that's skin or clothing, in rest pose. Hair, eyes and brows are left out: a chain lies under long hair. */
function cloudOf(root: THREE.Object3D): Cloud {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((o: THREE.Object3D) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    if (/^(hair_|beard_|moustache_|eyes|brow)/.test(m.name)) return;
    meshes.push(m);
  });
  let n = 0;
  for (const m of meshes) n += (m.geometry.getAttribute('position') as THREE.BufferAttribute).count;
  const pos = new Float32Array(n * 3);
  const bone = new Int16Array(n);
  const weight = new Float32Array(n);
  const part = new Uint8Array(n);
  const partNames: string[] = [];
  const v = new THREE.Vector3();
  let k = 0;
  meshes.forEach((m, mi) => {
    partNames.push(m.name);
    const p = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    const si = m.geometry.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
    const sw = m.geometry.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
    m.updateMatrixWorld(true);
    for (let i = 0; i < p.count; i++, k++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      pos[k * 3] = v.x;
      pos[k * 3 + 1] = v.y;
      pos[k * 3 + 2] = v.z;
      let best = -1;
      let bw = 0;
      if (si && sw)
        for (let c = 0; c < 4; c++) {
          const w = sw.getComponent(i, c);
          if (w > bw) {
            bw = w;
            best = si.getComponent(i, c);
          }
        }
      bone[k] = best;
      weight[k] = bw;
      part[k] = m.name === 'body' ? 0 : Math.min(255, mi + 1);
    }
  });
  return { pos, bone, weight, part, partNames };
}

/** A frame at `origin` with `y` along a limb and `z` towards a chosen side (the back of the hand, the front). */
function frame(origin: THREE.Vector3, y: THREE.Vector3, zHint: THREE.Vector3): THREE.Matrix4 {
  const Y = y.clone().normalize();
  const Z = zHint.clone().sub(Y.clone().multiplyScalar(zHint.dot(Y))).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(origin);
}

/**
 * The outline of a limb round its axis at one point, as a rigid band would sit on it: the convex hull of every
 * vertex of these bones within `half` metres along the axis, sampled in `bins` directions (0 = towards `ref`).
 * A hull never dips into the gaps between fingers or the creases of a sleeve, so the band is smooth and clear.
 */
function limbProfile(c: Cloud, bones: Set<number>, centre: THREE.Vector3, axis: THREE.Vector3, ref: THREE.Vector3, half: number, bins: number, cap: number, loose = Infinity): number[] | null {
  const Y = axis.clone().normalize();
  const Z = ref.clone().sub(Y.clone().multiplyScalar(ref.dot(Y))).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  const pts: [number, number][] = [];
  const garment: [number, number][] = [];
  const d = new THREE.Vector3();
  let skinMax = 0;
  for (let i = 0; i < c.bone.length; i++) {
    if (!bones.has(c.bone[i]) || c.weight[i] < 0.35) continue;
    d.set(c.pos[i * 3] - centre.x, c.pos[i * 3 + 1] - centre.y, c.pos[i * 3 + 2] - centre.z);
    if (Math.abs(d.dot(Y)) > half) continue;
    const x = d.dot(X);
    const z = d.dot(Z);
    const r = Math.hypot(x, z);
    if (r > cap) continue;
    // Skin and anything worn on the hand (wraps, gloves) always count; other clothes only if they fit close.
    const name = c.partNames[c.part[i] - 1] ?? '';
    if (c.part[i] === 0 || /glove/.test(name)) {
      pts.push([x, z]);
      skinMax = Math.max(skinMax, r);
    } else garment.push([x, z]);
  }
  // A close cuff is under the band; a baggy sleeve is over it (the band goes on the wrist underneath).
  for (const g of garment) if (Math.hypot(g[0], g[1]) <= skinMax * loose) pts.push(g);
  if (pts.length < 6) return null;
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  const out: number[] = [];
  for (let b = 0; b < bins; b++) {
    const a = (b / bins) * Math.PI * 2;
    out.push(rayToHull(hull, Math.sin(a), Math.cos(a)));
  }
  return out;
}

/** Convex hull of 2D points (monotone chain), anticlockwise. */
function convexHull(points: [number, number][]): [number, number][] {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** How far from the origin a ray in direction (dx, dz) leaves a convex polygon that contains the origin. */
function rayToHull(hull: [number, number][], dx: number, dz: number): number {
  let best = 0;
  for (let i = 0; i < hull.length; i++) {
    const [ax, az] = hull[i];
    const [bx, bz] = hull[(i + 1) % hull.length];
    const ex = bx - ax;
    const ez = bz - az;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ez - az * ex) / den;
    const u = (ax * dz - az * dx) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.max(best, t);
  }
  // If the centre wasn't inside (an odd limb), fall back to the furthest point.
  return best > 0 ? best : Math.max(...hull.map(([x, z]) => Math.hypot(x, z)));
}

// ---- materials ---------------------------------------------------------------------------------

const matCache = new Map<string, THREE.Material>();
function metal(hex: string, roughness: number, map?: THREE.Texture): THREE.MeshStandardMaterial {
  const key = `m:${hex}:${roughness}:${map?.uuid ?? ''}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    const col = new THREE.Color(hex);
    // A little glow of its own so it never reads black where there's no reflection map (low quality, some interiors).
    m = new THREE.MeshStandardMaterial({ color: col, metalness: 0.9, roughness, emissive: col.clone().multiplyScalar(0.18), map: map ?? null, side: THREE.DoubleSide });
    matCache.set(key, m);
  }
  return m;
}
function stoneMat(hex: string): THREE.MeshStandardMaterial {
  const key = `s:${hex}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    const col = new THREE.Color(hex);
    m = new THREE.MeshStandardMaterial({ color: col, metalness: 0.1, roughness: 0.05, emissive: col.clone().multiplyScalar(hex === STONES.diamond.colour ? 0.55 : 0.3) });
    matCache.set(key, m);
  }
  return m;
}
function plainMat(hex: string, rough = 0.6): THREE.MeshStandardMaterial {
  const key = `p:${hex}:${rough}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: 0 });
    matCache.set(key, m);
  }
  return m;
}

/** Link patterns painted along a chain (the chain's own geometry is a smooth tube). */
const linkTex = new Map<string, THREE.CanvasTexture>();
function linkTexture(link: ChainLink, iced: boolean): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = `${link}:${iced}`;
  const hit = linkTex.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 16;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 16);
  if (link === 'rope') {
    g.strokeStyle = '#8a8a8a';
    g.lineWidth = 3;
    for (let x = -16; x < 80; x += 8) {
      g.beginPath();
      g.moveTo(x, 16);
      g.lineTo(x + 12, 0);
      g.stroke();
    }
  } else if (link === 'cuban' || link === 'curb' || link === 'figaro') {
    g.fillStyle = '#7a7a7a';
    const step = link === 'cuban' ? 8 : 10;
    for (let x = 0; x < 64; x += step) {
      g.fillRect(x, 0, 1.5, 16);
      g.fillStyle = '#b8b8b8';
      g.fillRect(x + 2, 3, step - 4, 4);
      g.fillStyle = '#7a7a7a';
    }
    if (link === 'figaro')
      for (let x = 0; x < 64; x += 32) {
        g.fillStyle = '#ffffff';
        g.fillRect(x + 21, 0, 9, 16);
      }
  } else if (link === 'box') {
    g.fillStyle = '#8a8a8a';
    for (let x = 0; x < 64; x += 6) g.fillRect(x, 0, 1.5, 16);
  } else if (link === 'snake') {
    g.fillStyle = '#c8c8c8';
    for (let x = 0; x < 64; x += 3) g.fillRect(x, 0, 1, 16);
  }
  if (iced || link === 'tennis') {
    for (let x = 2; x < 64; x += 6)
      for (let y = 3; y < 16; y += 6) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(x, y, 2.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#9fb4c8';
        g.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  linkTex.set(key, t);
  return t;
}

// ---- the pieces --------------------------------------------------------------------------------

/** A closed band following a measured outline: `prof` radii round +y, `width` along y, `thick` outward. */
function bandGeometry(prof: number[], width: number, thick: number): THREE.BufferGeometry {
  const n = prof.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const ring = (r: number, y: number) => {
    for (let b = 0; b <= n; b++) {
      const a = ((b % n) / n) * Math.PI * 2;
      const rr = (prof[b % n] ?? r) + r;
      pos.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
    }
  };
  // Inner low, outer low, outer high, inner high: a rectangular section.
  ring(0, -width / 2);
  ring(thick, -width / 2);
  ring(thick, width / 2);
  ring(0, width / 2);
  const row = n + 1;
  for (let s = 0; s < 4; s++) {
    const a = s * row;
    const b = ((s + 1) % 4) * row;
    for (let i = 0; i < n; i++) idx.push(a + i, b + i, a + i + 1, b + i, b + i + 1, a + i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function ringPiece(d: JewelDef, look: JewelLook, radius: number): THREE.Group {
  const f = FINISHES[look.finish];
  const shape = d.shape.cat === 'ring' ? d.shape : null;
  const g = new THREE.Group();
  if (!shape) return g;
  const m = metal(f.metal, f.roughness);
  const width = Math.max(0.0035, (shape.width / 1000) * 0.9);
  const thick = 0.0016 * LIFE;
  const r = radius + CLEAR * 0.4;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + thick, r + thick, width, 28, 1, true), m);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 28, 1, true), m);
  g.add(band, inner);
  const edge = (y: number) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r + thick / 2, thick / 2, 6, 28), m);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    return t;
  };
  g.add(edge(width / 2), edge(-width / 2));
  const top = r + thick;
  const stone = d.stone ? stoneMat(STONES[d.stone].colour) : null;
  switch (shape.style) {
    case 'signet':
    case 'sovereign': {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.62, width * 0.7, 0.003 * LIFE, 20), m);
      face.rotation.x = Math.PI / 2;
      face.scale.set(1, 1, shape.style === 'signet' ? 0.8 : 1);
      face.position.z = top + 0.0012 * LIFE;
      g.add(face);
      if (stone) {
        const inlay = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.45, width * 0.45, 0.0008, 18), stone);
        inlay.rotation.x = Math.PI / 2;
        inlay.position.z = top + 0.0028 * LIFE;
        g.add(inlay);
      }
      if (shape.style === 'sovereign') {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(width * 0.66, 0.0007 * LIFE, 5, 20), m);
        rim.position.z = top + 0.0026 * LIFE;
        g.add(rim);
      }
      break;
    }
    case 'solitaire':
    case 'halo':
    case 'cluster': {
      const size = shape.style === 'halo' ? 0.0042 : shape.style === 'cluster' ? 0.0036 : 0.0034;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), stone ?? stoneMat(STONES.diamond.colour));
      gem.scale.set(1, 1, 0.75);
      gem.position.z = top + size * 0.9;
      g.add(gem);
      for (let i = 0; i < 4; i++) {
        const claw = new THREE.Mesh(new THREE.CylinderGeometry(0.0004 * LIFE, 0.0005 * LIFE, size * 1.4, 4), m);
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        claw.position.set(Math.cos(a) * size * 0.7, Math.sin(a) * size * 0.7, top + size * 0.5);
        claw.rotation.x = Math.PI / 2;
        g.add(claw);
      }
      if (shape.style !== 'solitaire') {
        const halo = stoneMat(STONES.diamond.colour);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.0012, 0), shape.style === 'cluster' ? halo : stone ?? halo);
          s.position.set(Math.cos(a) * size * 1.35, Math.sin(a) * size * 1.35, top + 0.001);
          g.add(s);
        }
      }
      break;
    }
    case 'eternity': {
      const s = stone ?? stoneMat(STONES.diamond.colour);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.0013 * LIFE * 0.8, 0), s);
        gem.position.set(Math.sin(a) * (top + 0.0006), 0, Math.cos(a) * (top + 0.0006));
        g.add(gem);
      }
      break;
    }
    case 'statement': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(width * 0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), stone ?? m);
      dome.rotation.x = Math.PI / 2;
      dome.scale.set(1.15, 1, 0.55);
      dome.position.z = top;
      g.add(dome);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(width * 0.62, 0.0009 * LIFE, 6, 24), m);
      bezel.scale.set(1.15, 1, 1);
      bezel.position.z = top + 0.0004;
      g.add(bezel);
      break;
    }
    case 'designer': {
      const twist = new THREE.Mesh(new THREE.TorusKnotGeometry(r + thick * 1.4, 0.0007 * LIFE, 64, 6, 2, 9), m);
      twist.rotation.x = Math.PI / 2;
      twist.scale.set(1, 1, 0.35);
      g.add(twist);
      break;
    }
    default:
      break;
  }
  return g;
}

function watchPiece(d: JewelDef, look: JewelLook, prof: number[]): THREE.Group {
  const g = new THREE.Group();
  if (d.shape.cat !== 'watch') return g;
  const s = d.shape;
  const f = FINISHES[look.finish];
  const m = metal(f.metal, f.roughness);
  const m2 = f.metal2 ? metal(f.metal2, f.roughness) : m;
  const strapMat =
    s.strap === 'leather' ? plainMat('#3a2416', 0.7) : s.strap === 'rubber' ? plainMat(look.finish === 'black' ? '#141416' : '#1d2026', 0.8) : s.strap === 'nato' ? plainMat('#3d4a2e', 0.9) : m;
  const top = Math.max(...prof.slice(-2), ...prof.slice(0, 3));
  const strapW = 0.016 + (s.size - 38) * 0.0004;
  const band = new THREE.Mesh(bandGeometry(prof.map((r) => r + CLEAR), strapW, s.strap === 'bracelet' || s.strap === 'iced' ? 0.0024 : 0.002), strapMat);
  g.add(band);
  if (s.strap === 'bracelet' || s.strap === 'iced') {
    // Centre links in the second metal (two-tone) or set with stones.
    const mid = new THREE.Mesh(bandGeometry(prof.map((r) => r + CLEAR + 0.0006), strapW * 0.34, 0.0024), s.strap === 'iced' ? stoneMat(STONES.diamond.colour) : m2);
    g.add(mid);
  }
  // The case on the back of the wrist (+z).
  const caseR = (s.size / 1000 / 2) * 1.12;
  const caseH = 0.006 * (s.face === 'digital' ? 1.1 : 1) + 0.002;
  const z0 = top + CLEAR + caseH / 2;
  let body: THREE.Mesh;
  if (s.face === 'round') body = new THREE.Mesh(new THREE.CylinderGeometry(caseR, caseR * 0.96, caseH, 28), m);
  else {
    const w = s.face === 'tonneau' ? caseR * 1.7 : caseR * 1.6;
    const h = s.face === 'square' ? caseR * 2.1 : caseR * 1.9;
    body = new THREE.Mesh(new THREE.BoxGeometry(w, caseH, h), s.face === 'digital' ? plainMat(look.finish === 'black' ? '#1a1a1c' : f.metal, 0.5) : m);
  }
  body.rotation.x = Math.PI / 2;
  body.position.z = z0;
  g.add(body);
  const dialMat = s.face === 'digital' ? new THREE.MeshStandardMaterial({ color: s.dial, emissive: new THREE.Color(s.dial).multiplyScalar(0.35), roughness: 0.3 }) : plainMat(s.dial, 0.35);
  const dial = s.face === 'round' ? new THREE.Mesh(new THREE.CircleGeometry(caseR * 0.8, 28), dialMat) : new THREE.Mesh(new THREE.PlaneGeometry(caseR * 1.25, caseR * (s.face === 'square' ? 1.6 : 1.3)), dialMat);
  dial.position.z = z0 + caseH / 2 + 0.0003;
  dial.rotation.z = Math.PI / 2;
  g.add(dial);
  if (s.face !== 'digital') {
    // Hands.
    const hm = plainMat(s.dial === '#f4f4f4' || s.dial.startsWith('#e') || s.dial.startsWith('#f') ? '#1a1a1a' : '#f0f0f0', 0.4);
    const hour = new THREE.Mesh(new THREE.PlaneGeometry(caseR * 0.08, caseR * 0.45), hm);
    hour.position.set(0, caseR * 0.18, z0 + caseH / 2 + 0.0006);
    hour.rotation.z = 0.9;
    const minute = new THREE.Mesh(new THREE.PlaneGeometry(caseR * 0.06, caseR * 0.68), hm);
    minute.position.set(caseR * 0.15, 0, z0 + caseH / 2 + 0.0007);
    minute.rotation.z = -1.6;
    g.add(hour, minute);
  }
  if (s.bezel !== 'plain' && s.face === 'round') {
    const bm = s.bezel === 'diamond' ? stoneMat(STONES.diamond.colour) : s.bezel === 'coloured' ? plainMat(s.bezelColour ?? '#1f3f8a', 0.3) : plainMat('#151518', 0.4);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(caseR * 0.92, caseR * 0.12, 6, 28), bm);
    bez.position.z = z0 + caseH / 2;
    g.add(bez);
  }
  return g;
}

/** A pendant hanging at the front of a chain, facing out. */
function pendantPiece(kind: Pendant, m: THREE.Material, stone: THREE.Material | null): THREE.Group {
  const g = new THREE.Group();
  const k = LIFE * 0.9;
  const box = (w: number, h: number, d: number, y = 0, x = 0, mat: THREE.Material = m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w * k, h * k, d * k), mat);
    b.position.set(x * k, y * k, 0);
    g.add(b);
    return b;
  };
  switch (kind) {
    case 'cross':
      box(0.004, 0.026, 0.003, -0.013);
      box(0.016, 0.004, 0.003, -0.008);
      break;
    case 'crucifix':
      box(0.006, 0.042, 0.004, -0.021);
      box(0.026, 0.006, 0.004, -0.013);
      box(0.004, 0.012, 0.004, -0.02, 0, metal('#c9ccd2', 0.3));
      break;
    case 'medallion':
    case 'initial': {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * k, 0.011 * k, 0.003 * k, 24), m);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = -0.012 * k;
      g.add(disc);
      if (kind === 'initial') box(0.003, 0.011, 0.004, -0.012, 0);
      else {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.011 * k, 0.0012 * k, 5, 24), m);
        rim.position.y = -0.012 * k;
        g.add(rim);
      }
      break;
    }
    case 'heart': {
      const h = new THREE.Shape();
      h.moveTo(0, -0.01);
      h.bezierCurveTo(0.012, 0, 0.008, 0.009, 0, 0.004);
      h.bezierCurveTo(-0.008, 0.009, -0.012, 0, 0, -0.01);
      const geo = new THREE.ExtrudeGeometry(h, { depth: 0.003, bevelEnabled: false });
      geo.translate(0, -0.006, -0.0015);
      geo.scale(k, k, k);
      g.add(new THREE.Mesh(geo, m));
      break;
    }
    case 'diamond': {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.0055 * k, 0), stone ?? stoneMat(STONES.diamond.colour));
      gem.position.y = -0.007 * k;
      g.add(gem);
      break;
    }
    case 'dogtag':
      box(0.014, 0.024, 0.0015, -0.013);
      break;
    case 'boxing_glove': {
      for (const x of [-0.006, 0.006]) {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.0062 * k, 12, 8), m);
        glove.scale.set(1, 1.2, 0.8);
        glove.position.set(x * k, -0.014 * k, 0);
        g.add(glove);
      }
      break;
    }
  }
  // The bail it hangs from.
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.002 * k, 0.0007 * k, 5, 12), m);
  bail.rotation.y = Math.PI / 2;
  g.add(bail);
  return g;
}

/** One row of a grill: the top teeth hang from y 0 down; the bottom row (`lower`) stands up from y 0. */
function grillPiece(d: JewelDef, look: JewelLook, archHalf: number, archDepth: number, toothH: number, lower = false): THREE.Group {
  const g = new THREE.Group();
  if (d.shape.cat !== 'grill') return g;
  const shape = d.shape;
  const f = FINISHES[look.finish];
  const m = metal(f.metal, f.roughness);
  const m2 = f.metal2 ? metal(f.metal2, f.roughness) : metal(look.finish === 'white' ? '#e2b33c' : '#e4e6ea', f.roughness);
  const stone = shape.style === 'diamond' ? stoneMat(STONES.diamond.colour) : null;
  const teeth = shape.cover === 'single' ? [3] : shape.cover === 'fangs' ? [-3, 3] : shape.cover === 'top6' ? [-3, -2, -1, 1, 2, 3] : [-4, -3, -2, -1, 1, 2, 3, 4];
  if (lower && shape.cover !== 'full') return g;
  const row = lower ? -1 : 1;
  {
    teeth.forEach((t, i) => {
      // Teeth round a parabolic arch: incisors at the front, canines (±3) round the corner.
      const u = (Math.sign(t) * (Math.abs(t) - 0.5)) / 4;
      const x = u * archHalf;
      const z = -archDepth * u * u;
      const w = Math.abs(t) <= 1 ? 0.0085 : Math.abs(t) === 2 ? 0.0068 : 0.0072;
      const mat = shape.style === 'twotone' && i % 2 ? m2 : m;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(w, toothH, 0.0035), mat);
      tooth.position.set(x, (-row * toothH) / 2, z * (lower ? 0.85 : 1));
      tooth.rotation.y = -Math.atan2(2 * archDepth * u, archHalf) * 0.9;
      g.add(tooth);
      if (shape.style === 'outline') {
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, toothH * 0.6), plainMat('#f2efe6', 0.4));
        hole.position.set(x, (-row * toothH) / 2, z + 0.0019);
        hole.rotation.y = tooth.rotation.y;
        g.add(hole);
      } else if (shape.style === 'cutout') {
        const star = new THREE.Mesh(new THREE.CircleGeometry(w * 0.22, 5), plainMat('#101010', 0.9));
        star.position.set(x, (-row * toothH) / 2, z + 0.0019);
        star.rotation.y = tooth.rotation.y;
        g.add(star);
      } else if (stone) {
        for (const [dx, dy] of [[-0.25, 0.22], [0.25, 0.22], [0, 0], [-0.25, -0.22], [0.25, -0.22]]) {
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.0011, 0), stone);
          s.position.set(x + dx * w, (-row * toothH) / 2 + dy * toothH, z + 0.0019);
          g.add(s);
        }
      }
    });
  }
  return g;
}

// ---- fitting them on ---------------------------------------------------------------------------

/** What to draw: the jewellery box first; characters without one (bosses, NPCs) get plain pieces for their accessories. */
export function looksFor(a: CharacterAppearance): Partial<Record<JewelCat, JewelLook>> {
  if (a.jewellery) return a.jewellery;
  const out: Partial<Record<JewelCat, JewelLook>> = {};
  if (a.accessories.includes('chain')) out.necklace = a.chainColour === 'gold' ? { id: 'n_rope_3', finish: 'gold9' } : { id: 'n_curb_silver', finish: 'silver' };
  if (a.accessories.includes('watch')) out.watch = { id: 'w_silver_bracelet', finish: 'steel' };
  if (a.accessories.includes('ring')) out.ring = { id: 'r_signet_oval', finish: 'gold9' };
  return out;
}

export interface FittedJewellery {
  /** Bones that have to be held still (the jaw, opened a touch for a grill), with their rotation. */
  hold: Map<string, THREE.Quaternion>;
  dispose(): void;
}

/**
 * Fit everything this character is wearing onto its skeleton. Call with the rig in its rest pose
 * (world matrices up to date) before any bone is turned.
 */
export function fitJewellery(a: CharacterAppearance, root: THREE.Object3D, skeleton: THREE.Skeleton, bones: Map<string, THREE.Bone>, lead: 'L' | 'R'): FittedJewellery {
  const looks = looksFor(a);
  const hold = new Map<string, THREE.Quaternion>();
  const made: THREE.Object3D[] = [];
  const out: FittedJewellery = {
    hold,
    dispose: () => {
      for (const o of made) {
        o.removeFromParent();
        o.traverse((x: THREE.Object3D) => (x as THREE.Mesh).geometry?.dispose());
      }
    },
  };
  if (!looks.ring && !looks.watch && !looks.necklace && !looks.grill) return out;
  const cloud = cloudOf(root);
  const index = new Map<string, number>(skeleton.bones.map((b: THREE.Bone, i: number): [string, number] => [b.name, i]));
  const ids = (...names: string[]) => new Set(names.map((n) => index.get(n)).filter((i): i is number => i !== undefined));
  const at = (n: string) => new THREE.Vector3().setFromMatrixPosition(bones.get(n)!.matrixWorld);
  const has = (...names: string[]) => names.every((n) => bones.has(n));
  const place = (obj: THREE.Object3D, m: THREE.Matrix4, bone: string) => {
    obj.applyMatrix4(m);
    obj.updateMatrixWorld(true);
    bones.get(bone)!.attach(obj);
    obj.traverse((x: THREE.Object3D) => {
      const mesh = x as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.frustumCulled = false;
      }
    });
    made.push(obj);
  };

  // Which way the character faces in its rest pose: from the head to the eyes.
  let front = new THREE.Vector3(0, 0, 1);
  root.traverse((o: THREE.Object3D) => {
    if (o.name !== 'eyes' || !(o as THREE.Mesh).isMesh || !has('head')) return;
    const g = (o as THREE.Mesh).geometry;
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(o.matrixWorld);
    const f = c.sub(at('head'));
    f.y = 0;
    if (f.lengthSq() > 1e-6) front = f.normalize();
  });

  // ---- ring: the lead hand's ring finger, between the knuckle and the middle joint.
  const S = lead;
  if (looks.ring && has(`finger4-1.${S}`, `finger4-2.${S}`)) {
    const d = JEWELS[looks.ring.id];
    const a0 = at(`finger4-1.${S}`);
    const a1 = at(`finger4-2.${S}`);
    const axis = a1.clone().sub(a0);
    const centre = a0.clone().addScaledVector(axis, 0.55);
    // Back of the hand: up in the rest pose (palms down).
    const across = has(`finger2-1.${S}`, `finger5-1.${S}`) ? at(`finger5-1.${S}`).sub(at(`finger2-1.${S}`)) : new THREE.Vector3(0, 0, 1);
    const back = new THREE.Vector3().crossVectors(axis, across).normalize();
    if (back.y < 0) back.negate();
    const prof = limbProfile(cloud, ids(`finger4-1.${S}`), centre, axis, back, axis.length() * 0.22, 16, 0.02);
    const radius = prof ? prof.reduce((m, r) => Math.max(m, r), 0) * 0.96 : 0.0085;
    place(ringPiece(d, looks.ring, radius), frame(centre, axis, back), `finger4-1.${S}`);
  }

  // ---- watch: just above the wrist bone on the lead arm, on top of any sleeve or wrap.
  const fore = bones.has(`lowerarm02.${S}`) ? `lowerarm02.${S}` : `lowerarm01.${S}`;
  if (looks.watch && has(`lowerarm01.${S}`, `wrist.${S}`)) {
    const d = JEWELS[looks.watch.id];
    const e = at(`lowerarm01.${S}`);
    const w = at(`wrist.${S}`);
    const axis = w.clone().sub(e);
    const centre = e.clone().addScaledVector(axis, 0.86);
    const across = has(`finger2-1.${S}`, `finger5-1.${S}`) ? at(`finger5-1.${S}`).sub(at(`finger2-1.${S}`)) : new THREE.Vector3(0, 0, 1);
    const back = new THREE.Vector3().crossVectors(axis, across).normalize();
    if (back.y < 0) back.negate();
    const prof = limbProfile(cloud, ids(`lowerarm01.${S}`, `lowerarm02.${S}`, `wrist.${S}`), centre, axis, back, 0.012, 24, 0.07, 1.3);
    if (prof) place(watchPiece(d, looks.watch, prof), frame(centre, axis, back), fore);
  }

  // ---- necklace: round the base of the neck, over the collarbones, dipping down the chest.
  if (looks.necklace && has('neck01', 'spine01', 'head')) {
    const d = JEWELS[looks.necklace.id];
    const neck = at('neck01');
    // Everything on the torso and neck counts (skin and clothes, whichever bones they're weighted to); arms and the head don't.
    const torso = new Set<number>(skeleton.bones.map((b: THREE.Bone, i: number) => (/^(lowerarm|wrist|finger|head|jaw|upperleg|lowerleg|foot)/.test(b.name) ? -1 : i)).filter((i: number) => i >= 0));
    const chainPiece = necklacePiece(d, looks.necklace, cloud, torso, neck, front, at('head').distanceTo(neck));
    if (chainPiece) place(chainPiece, new THREE.Matrix4(), 'spine01');
  }

  // ---- grill: on the top teeth, with the jaw dropped a touch so it shows.
  if (looks.grill && has('jaw', 'head')) {
    const d = JEWELS[looks.grill.id];
    const fit = mouthFit(cloud, index.get('jaw') ?? -1, index.get('head') ?? -1, at('head'), front);
    if (fit) {
      const side = new THREE.Vector3().crossVectors(UP, front).normalize();
      const m = new THREE.Matrix4().makeBasis(side, UP, front).setPosition(fit.centre);
      place(grillPiece(d, looks.grill, fit.halfWidth, fit.depth, fit.toothH), m, 'head');
      // A full set's bottom row rides on the jaw, just under the top row when the mouth's shut.
      const low = grillPiece(d, looks.grill, fit.halfWidth * 0.92, fit.depth, fit.toothH, true);
      if (low.children.length) place(low, new THREE.Matrix4().makeBasis(side, UP, front).setPosition(fit.centre.clone().addScaledVector(UP, -fit.toothH * 1.12).addScaledVector(front, -0.002)), 'jaw');
      // Part the lips: the jaw bone turns about the character's side axis.
      const jaw = bones.get('jaw')!;
      const worldAxis = new THREE.Vector3().crossVectors(UP, front).normalize();
      const jawWorld = new THREE.Quaternion();
      jaw.getWorldQuaternion(jawWorld);
      const localAxis = worldAxis.applyQuaternion(jawWorld.clone().invert());
      hold.set('jaw', new THREE.Quaternion().setFromAxisAngle(localAxis, 0.11));
    }
  }
  return out;
}

/** Where the top teeth are: just behind the upper lip, at the line where the jaw's skin starts. */
function mouthFit(c: Cloud, jaw: number, head: number, headAt: THREE.Vector3, front: THREE.Vector3): { centre: THREE.Vector3; halfWidth: number; depth: number; toothH: number } | null {
  if (jaw < 0) return null;
  const side = new THREE.Vector3().crossVectors(UP, front).normalize();
  let lipY = -Infinity;
  let lipF = -Infinity;
  let chinY = Infinity;
  const p = new THREE.Vector3();
  // The front-most skin at the midline belonging to the jaw: the lower lip and chin.
  for (let i = 0; i < c.bone.length; i++) {
    if (c.part[i] !== 0) continue;
    p.set(c.pos[i * 3] - headAt.x, c.pos[i * 3 + 1] - headAt.y, c.pos[i * 3 + 2] - headAt.z);
    if (Math.abs(p.dot(side)) > 0.012) continue;
    const f = p.dot(front);
    if (f < 0.05) continue;
    if (c.bone[i] === jaw && c.weight[i] > 0.5) {
      if (p.y > lipY) lipY = p.y;
      if (p.y < chinY) chinY = p.y;
    }
  }
  if (!Number.isFinite(lipY)) return null;
  // The upper lip's front, just above the jaw line.
  for (let i = 0; i < c.bone.length; i++) {
    if (c.part[i] !== 0 || c.bone[i] !== head) continue;
    p.set(c.pos[i * 3] - headAt.x, c.pos[i * 3 + 1] - headAt.y, c.pos[i * 3 + 2] - headAt.z);
    if (Math.abs(p.dot(side)) > 0.01) continue;
    if (p.y < lipY - 0.002 || p.y > lipY + 0.014) continue;
    const f = p.dot(front);
    if (f > lipF) lipF = f;
  }
  if (!Number.isFinite(lipF)) return null;
  const centre = headAt.clone().addScaledVector(UP, lipY + 0.003).addScaledVector(front, lipF - 0.0065);
  return { centre, halfWidth: 0.026, depth: 0.017, toothH: 0.0085 };
}

/** The chain as a curve that lies on the body (and over clothes): round the back of the neck, down onto the chest at the front. */
function necklacePiece(d: JewelDef, look: JewelLook, c: Cloud, bones: Set<number>, neck: THREE.Vector3, front: THREE.Vector3, neckLen: number): THREE.Group | null {
  if (d.shape.cat !== 'necklace') return null;
  const s = d.shape;
  const f = FINISHES[look.finish];
  const tube = Math.max(0.0014, (s.gauge / 1000 / 2) * LIFE);
  const side = new THREE.Vector3().crossVectors(UP, front).normalize();
  // How far the front of the chain hangs below the base of the neck.
  const drop = { choker: 0.03, collar: 0.07, chest: 0.11, long: 0.16 }[s.length] * (neckLen / 0.12);
  const baseY = neck.y - 0.01;
  // Gather the neck, shoulders and upper chest (skin and clothes) around the neck's vertical axis.
  const pts: { a: number; r: number; y: number; body: boolean }[] = [];
  for (let i = 0; i < c.bone.length; i++) {
    if (!bones.has(c.bone[i])) continue;
    const x = c.pos[i * 3] - neck.x;
    const y = c.pos[i * 3 + 1];
    const z = c.pos[i * 3 + 2] - neck.z;
    if (y > baseY + 0.04 || y < baseY - drop - 0.06) continue;
    const fx = x * side.x + z * side.z;
    const fz = x * front.x + z * front.z;
    const r = Math.hypot(fx, fz);
    if (r > 0.2) continue;
    pts.push({ a: Math.atan2(fx, fz), r, y, body: c.part[i] === 0 });
  }
  if (pts.length < 40) return null;
  const N = 48;
  const path: THREE.Vector3[] = [];
  let neckR = 0;
  // The neck itself: how wide it is just above where the chain sits.
  // The neck itself (skin only, so a hood doesn't count): its width just above where the chain sits.
  const widths = pts.filter((q) => q.body && q.y > baseY + 0.005 && q.y < baseY + 0.03).map((q) => q.r).sort((x, y) => x - y);
  neckR = widths.length ? widths[Math.floor(widths.length * 0.9)] : 0.06;
  const radii: number[] = [];
  const heights: number[] = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 - Math.PI;
    // 1 at the front, 0 at the back: how far down the chest this point hangs.
    const fr = Math.pow((1 + Math.cos(a)) / 2, 2.2);
    const y = baseY - drop * fr;
    // Out past nearly everything at this angle and height (the odd stray vertex of a collar doesn't count),
    // never inside the body or the clothes. Shoulders out at the side are under the chain, not round it.
    const near: number[] = [];
    for (const q of pts) {
      let da = Math.abs(q.a - a);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > 0.22 || Math.abs(q.y - y) > 0.012) continue;
      // (A bulky hood or puffer collar is out past this too, so a chain tucks under it at the sides and shows on the chest.)
      if (q.r > neckR * (1.3 + 1.6 * fr)) continue;
      near.push(q.r);
    }
    near.sort((x, y) => x - y);
    const r = Math.max(neckR * (0.95 + 0.25 * fr), near.length ? near[near.length - 1] : 0);
    radii.push(r);
    heights.push(y);
  }
  // A chain can't follow sharp dents: take the larger of each point and the median round it, then ease it out.
  const med = radii.map((_, k) => {
    const w = [-2, -1, 0, 1, 2].map((o) => radii[(k + o + N) % N]).sort((x, y) => x - y);
    return Math.max(w[2], radii[k] * 0.97);
  });
  let sm = med;
  for (let pass = 0; pass < 4; pass++) sm = sm.map((r, k) => Math.max(r, (sm[(k + N - 1) % N] + r * 2 + sm[(k + 1) % N]) / 4));
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 - Math.PI;
    const r = sm[k] + tube + CLEAR;
    path.push(new THREE.Vector3(neck.x, heights[k], neck.z).addScaledVector(side, Math.sin(a) * r).addScaledVector(front, Math.cos(a) * r));
  }
  // Smooth out bumps without pulling it in.
  for (let pass = 0; pass < 3; pass++) {
    const prev = path.map((p) => p.clone());
    for (let k = 0; k < N; k++) {
      const avg = prev[(k + N - 1) % N].clone().add(prev[(k + 1) % N]).multiplyScalar(0.5);
      const p = path[k];
      const out = (v: THREE.Vector3) => Math.hypot(v.x - neck.x, v.z - neck.z);
      const blended = p.clone().lerp(avg, 0.5);
      if (out(blended) >= out(p) - 0.0005) path[k] = blended;
      else path[k].y = blended.y;
    }
  }
  const curve = new THREE.CatmullRomCurve3(path, true, 'centripetal');
  const tex = linkTexture(s.link, d.stone === 'diamond');
  if (tex) {
    tex.repeat.set(Math.round(curve.getLength() / (tube * 5)), 1);
  }
  const iced = d.stone === 'diamond' && s.link !== 'snake';
  const m = iced ? (stoneMat(STONES.diamond.colour).clone() as THREE.MeshStandardMaterial) : metal(f.metal, f.roughness, tex);
  if (iced) {
    m.map = tex ?? null;
    m.color = new THREE.Color(f.metal).lerp(new THREE.Color('#ffffff'), 0.6);
  }
  const g = new THREE.Group();
  if (s.link === 'ball') {
    const bead = new THREE.SphereGeometry(tube * 1.1, 8, 6);
    const n = Math.round(curve.getLength() / (tube * 2.6));
    const mesh = new THREE.InstancedMesh(bead, m, n);
    const mx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, mx.makeTranslation(curve.getPointAt(i / n)));
    g.add(mesh);
  } else {
    const radial = s.link === 'cuban' || s.link === 'curb' ? 6 : 8;
    const geo = new THREE.TubeGeometry(curve, 160, tube, radial, true);
    g.add(new THREE.Mesh(geo, m));
  }
  if (s.pendant) {
    // Hang it at the lowest point at the front, facing out.
    let low = path[0];
    for (const p of path) if (p.y < low.y && p.clone().sub(neck).dot(front) > 0) low = p;
    const pend = pendantPiece(s.pendant, metal(f.metal, f.roughness), d.stone ? stoneMat(STONES[d.stone].colour) : null);
    const m4 = new THREE.Matrix4().makeBasis(side, UP, front).setPosition(low.clone().addScaledVector(front, tube * 1.6));
    pend.applyMatrix4(m4);
    g.add(pend);
  }
  return g;
}

// ---- shop and inventory previews ---------------------------------------------------------------

/** A piece on its own, for the shop's turntable: sized for a hand of about 0.009 m fingers. */
export function previewPiece(look: JewelLook): THREE.Group {
  const d = JEWELS[look.id];
  const g = new THREE.Group();
  if (!d) return g;
  if (d.cat === 'ring') {
    const r = ringPiece(d, look, 0.0095);
    r.rotation.x = Math.PI / 2 - 0.5;
    g.add(r);
  } else if (d.cat === 'watch') {
    // An oval wrist.
    const prof = Array.from({ length: 24 }, (_, b) => {
      const a = (b / 24) * Math.PI * 2;
      return 1 / Math.sqrt((Math.sin(a) / 0.03) ** 2 + (Math.cos(a) / 0.021) ** 2);
    });
    const w = watchPiece(d, look, prof);
    w.rotation.x = Math.PI / 2 - 0.45;
    g.add(w);
  } else if (d.cat === 'necklace') {
    // Laid out as a teardrop on the display bust.
    const s = d.shape.cat === 'necklace' ? d.shape : null;
    if (s) {
      const drop = { choker: 0.03, collar: 0.06, chest: 0.09, long: 0.13 }[s.length];
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2 - Math.PI;
        const fr = Math.pow((1 + Math.cos(a)) / 2, 2.2);
        pts.push(new THREE.Vector3(Math.sin(a) * 0.065, -drop * fr, Math.cos(a) * 0.05));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const f = FINISHES[look.finish];
      const tube = Math.max(0.0014, (s.gauge / 1000 / 2) * LIFE);
      const tex = linkTexture(s.link, d.stone === 'diamond');
      if (tex) tex.repeat.set(Math.round(curve.getLength() / (tube * 5)), 1);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, tube, 8, true), d.stone === 'diamond' ? stoneMat(STONES.diamond.colour) : metal(f.metal, f.roughness, tex)));
      if (s.pendant) {
        const pend = pendantPiece(s.pendant, metal(f.metal, f.roughness), d.stone ? stoneMat(STONES[d.stone].colour) : null);
        pend.position.set(0, -drop, 0.05 + tube * 1.6);
        g.add(pend);
      }
      g.rotation.x = 0.35;
    }
  } else if (d.cat === 'grill') {
    g.add(grillPiece(d, look, 0.026, 0.017, 0.0085));
    const low = grillPiece(d, look, 0.024, 0.017, 0.0085, true);
    low.position.y = -0.0095;
    g.add(low);
  }
  // Centre it.
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((ch: THREE.Object3D) => ch.position.sub(c));
  return g;
}

/** Rough size of a preview piece, for framing the camera. */
export function previewRadius(look: JewelLook): number {
  const d = JEWELS[look.id];
  if (!d) return 0.05;
  return d.cat === 'necklace' ? 0.09 : d.cat === 'watch' ? 0.045 : d.cat === 'grill' ? 0.035 : 0.02;
}
