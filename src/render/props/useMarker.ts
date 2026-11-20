import * as THREE from 'three';

/**
 * What shows you can use something: drawn round the thing itself, not on the floor where you stand.
 * - a door: light spilling out across its threshold, with corner brackets at the door's edges;
 * - anything else: a soft pool of light under its footprint, with four corner brackets that breathe in.
 * Gold, or red when it's locked or done with. Additive and depth-free, so it lights the floor rather than
 * covering it; textures are drawn once on a canvas.
 */

let poolTex: THREE.Texture | null = null;
let cornerTex: THREE.Texture | null = null;

function pool(): THREE.Texture {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  // A rounded-rectangle glow: full in the middle, fading to nothing at the edges.
  for (let i = 0; i < 24; i++) {
    const k = i / 24;
    const inset = 4 + k * 40;
    g.fillStyle = `rgba(255,255,255,${0.05 + 0.03 * (1 - k)})`;
    g.beginPath();
    g.roundRect(inset, inset, 128 - inset * 2, 128 - inset * 2, 30 * (1 - k) + 6);
    g.fill();
  }
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

function corner(): THREE.Texture {
  if (cornerTex) return cornerTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  // An L, bright with a soft glow, in the top-left of the square (turned for each corner).
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 8;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(10, 46);
  g.lineTo(10, 10);
  g.lineTo(46, 10);
  g.stroke();
  cornerTex = new THREE.CanvasTexture(c);
  cornerTex.colorSpace = THREE.SRGBColorSpace;
  return cornerTex;
}

const add = (map: THREE.Texture, opacity: number) =>
  new THREE.MeshBasicMaterial({ map, color: 0xffd23d, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

export class UseMarker {
  readonly root = new THREE.Group();
  private poolMesh: THREE.Mesh;
  private corners: THREE.Mesh[] = [];
  private half: [number, number] = [0.5, 0.5];

  constructor() {
    this.root.name = 'useMarker';
    this.poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), add(pool(), 0.8));
    this.poolMesh.rotation.x = -Math.PI / 2;
    this.poolMesh.position.y = 0.02;
    this.root.add(this.poolMesh);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), add(corner(), 1));
      m.rotation.x = -Math.PI / 2;
      // Turn each L to face its own corner: top-left, top-right, bottom-right, bottom-left.
      m.rotation.z = (-i * Math.PI) / 2;
      m.position.y = 0.025;
      this.corners.push(m);
      this.root.add(m);
    }
    this.root.visible = false;
  }

  /** Show it round a footprint centred at (x, z), `hx` by `hz` half-size. */
  show(x: number, z: number, hx: number, hz: number, bad: boolean): void {
    this.root.visible = true;
    this.root.position.set(x, 0, z);
    this.half = [Math.max(0.22, hx), Math.max(0.18, hz)];
    const col = bad ? 0xff4a3a : 0xffd23d;
    (this.poolMesh.material as THREE.MeshBasicMaterial).color.setHex(col);
    for (const c of this.corners) (c.material as THREE.MeshBasicMaterial).color.setHex(col);
  }

  hide(): void {
    this.root.visible = false;
  }

  update(time: number): void {
    if (!this.root.visible) return;
    const [hx, hz] = this.half;
    const breathe = 1 + 0.06 * (0.5 + 0.5 * Math.sin(time * 4));
    this.poolMesh.scale.set((hx + 0.22) * 2, (hz + 0.22) * 2, 1);
    (this.poolMesh.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(time * 4));
    const sx = (hx + 0.06) * breathe;
    const sz = (hz + 0.06) * breathe;
    const at: [number, number][] = [[-sx, -sz], [sx, -sz], [sx, sz], [-sx, sz]];
    // The L's corner sits on the footprint's corner (the L is drawn in the top-left of its square).
    this.corners.forEach((c, i) => {
      const [ox, oz] = at[i];
      const dx = ox < 0 ? 0.08 : -0.08;
      const dz = oz < 0 ? 0.08 : -0.08;
      c.position.set(ox + dx, 0.025, oz + dz);
    });
  }
}
