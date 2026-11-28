import * as THREE from 'three';

/**
 * What shows you can use something. The old marker (a yellow pool of light with glowing corner brackets round the
 * footprint) read as a debug box. Now it's a single interaction pip, as in current third-person games: a crisp white
 * dot inside a thin ring, floating just above the thing (on its top, a door's handle height), facing the camera,
 * with one soft ripple going out from it now and then. It pops in when something comes into reach and fades when
 * it goes. People (someone to mug, a job) get a thin ring at their feet instead, since they already carry a badge
 * over their head. Red-tinted when it's locked, used up or a crime. The USE prompt says what it does.
 *
 * Drawn over everything (no depth test) at a fixed size on screen, so a pip is never lost behind a counter or a car; textures are drawn once.
 */

let pipTex: THREE.Texture | null = null;
let ringTex: THREE.Texture | null = null;
let floorTex: THREE.Texture | null = null;

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // Drawn once and kept for every level (disposeGroup leaves shared textures alone).
  t.userData.shared = true;
  return t;
}

/** Dot and ring, with a soft dark halo so it reads on a bright wall as well as a dark street. */
function pip(): THREE.Texture {
  return (pipTex ??= canvasTex(128, (g) => {
    // A faint dark disc inside the ring, so it reads on a white wall too.
    g.fillStyle = 'rgba(10,12,16,0.32)';
    g.beginPath();
    g.arc(64, 64, 38, 0, Math.PI * 2);
    g.fill();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 10;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(64, 64, 38, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 64, 15, 0, Math.PI * 2);
    g.fill();
  }));
}

function ring(): THREE.Texture {
  return (ringTex ??= canvasTex(128, (g) => {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.stroke();
  }));
}

/** A thin ellipse for the floor round someone's feet: a fine line with a soft inner fade. */
function floor(): THREE.Texture {
  return (floorTex ??= canvasTex(256, (g) => {
    const grad = g.createRadialGradient(128, 128, 80, 128, 128, 120);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.stroke();
  }));
}

const OK = 0xffffff;
const BAD = 0xff5a4e;
/** The pip's size on screen (a share of the view's height), the same near or far: about 30 px on a phone. */
const PIP = 0.05;

export type MarkerKind = 'thing' | 'door' | 'person';

export class UseMarker {
  readonly root = new THREE.Group();
  private pip: THREE.Sprite;
  private ripple: THREE.Sprite;
  private ground: THREE.Mesh;
  private key = '';
  private since = 0;
  private last = 0;
  private kind: MarkerKind = 'thing';
  /** Top of whatever is under a point, found once per new target (LevelView passes a measuring function). */
  measure: ((x: number, z: number) => number | null) | null = null;

  constructor() {
    this.root.name = 'useMarker';
    // Built once a level; its textures are the module's own, kept between levels.
    const sprite = (map: THREE.Texture) =>
      new THREE.Sprite(new THREE.SpriteMaterial({ map, color: OK, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, sizeAttenuation: false }));
    this.pip = sprite(pip());
    this.ripple = sprite(ring());
    this.pip.renderOrder = this.ripple.renderOrder = 999;
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: floor(), color: OK, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.02;
    this.root.add(this.pip, this.ripple, this.ground);
    this.root.visible = false;
  }

  /**
   * Show it on a footprint centred at (x, z), `hx` by `hz` half-size. `top`: how high the thing stands (measured
   * when not given); `kind` picks the pip (things, doors) or the ring at the feet (people).
   */
  show(x: number, z: number, hx: number, hz: number, bad: boolean, kind: MarkerKind = 'thing', top?: number): void {
    const key = `${kind}:${x.toFixed(2)}:${z.toFixed(2)}`;
    if (key !== this.key) {
      this.key = key;
      this.since = this.last;
      this.kind = kind;
      let y: number;
      if (kind === 'door') y = 1.4;
      else if (kind === 'person') y = 0;
      else {
        const t = top ?? this.measure?.(x, z) ?? null;
        y = Math.min(2.3, Math.max(0.55, (t ?? 0.9) + 0.32));
      }
      this.pip.position.set(0, y, kind === 'door' ? 0.35 : Math.min(hz, 0.4));
      this.pip.userData.bob = 0;
      this.ripple.position.copy(this.pip.position);
      this.ground.scale.set((Math.max(0.3, hx) + 0.2) * 2, (Math.max(0.26, hz) + 0.2) * 2, 1);
    }
    this.root.visible = true;
    this.root.position.set(x, 0, z);
    const col = bad ? BAD : OK;
    (this.pip.material as THREE.SpriteMaterial).color.setHex(col);
    (this.ripple.material as THREE.SpriteMaterial).color.setHex(col);
    (this.ground.material as THREE.MeshBasicMaterial).color.setHex(col);
    this.pip.visible = this.ripple.visible = kind !== 'person';
    this.ground.visible = kind === 'person';
  }

  hide(): void {
    this.root.visible = false;
    this.key = '';
  }

  update(time: number): void {
    this.last = time;
    if (!this.root.visible) return;
    // Pop in: a quick overshoot to full size and opacity.
    const t = Math.min(1, (time - this.since) / 0.22);
    const pop = t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    const bob = Math.sin(time * 2.2) * 0.025;
    const s = PIP * Math.max(0.2, pop);
    this.pip.scale.set(s, s, 1);
    this.pip.position.y += bob - ((this.pip.userData.bob as number) ?? 0);
    this.pip.userData.bob = bob;
    (this.pip.material as THREE.SpriteMaterial).opacity = Math.min(1, t * 1.4);
    // A ripple every 1.6 s, growing out from the ring and fading.
    const r = ((time - this.since) % 1.6) / 1.6;
    const rs = PIP * (0.85 + 0.9 * r);
    this.ripple.scale.set(rs, rs, 1);
    this.ripple.position.y = this.pip.position.y;
    (this.ripple.material as THREE.SpriteMaterial).opacity = t < 1 ? 0 : 0.55 * (1 - r) * (1 - r);
    if (this.kind === 'person') (this.ground.material as THREE.MeshBasicMaterial).opacity = Math.min(1, t * 1.4) * (0.75 + 0.25 * Math.sin(time * 3));
  }
}
