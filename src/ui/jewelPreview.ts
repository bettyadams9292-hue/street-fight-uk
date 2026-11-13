import * as THREE from 'three';
import { previewPiece, previewRadius } from '../render/jewellery';
import type { JewelLook } from '../items/jewellery';

/**
 * The jeweller's turntable: one shared canvas showing the piece you're looking
 * at, turning slowly on velvet under shop lights. Drag it (mouse or finger) to
 * turn it yourself; let go and it carries on turning. The metal reflects a lit
 * room so gold looks like gold, not brown plastic.
 */
class JewelTable {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.005, 5);
  private holder = new THREE.Group();
  private key = '';
  private running = false;
  private spin = 0;
  private tilt = 0.25;
  private dragging: { x: number; y: number; spin: number; tilt: number } | null = null;
  private last = performance.now();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'prop-preview jw-preview';
    this.canvas.width = 480;
    this.canvas.height = 300;
    this.canvas.setAttribute('aria-label', 'Product preview: drag to turn it');
    this.canvas.style.touchAction = 'none';
    this.scene.background = new THREE.Color(0x121218);
    this.scene.add(new THREE.HemisphereLight(0xfff4e8, 0x201820, 1.0));
    const key = new THREE.SpotLight(0xffffff, 6, 3, 0.6, 0.5);
    key.position.set(0.3, 0.5, 0.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8c8ff, 1.2);
    rim.position.set(-0.4, 0.3, -0.5);
    this.scene.add(rim);
    const velvet = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48), new THREE.MeshStandardMaterial({ color: 0x1c1428, roughness: 1 }));
    velvet.rotation.x = -Math.PI / 2;
    velvet.position.y = -0.06;
    this.scene.add(velvet, this.holder);
    const down = (e: PointerEvent) => {
      this.dragging = { x: e.clientX, y: e.clientY, spin: this.spin, tilt: this.tilt };
      this.canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.spin = this.dragging.spin + (e.clientX - this.dragging.x) * 0.012;
      this.tilt = Math.max(-0.9, Math.min(1.2, this.dragging.tilt + (e.clientY - this.dragging.y) * 0.008));
    };
    const up = () => {
      this.dragging = null;
    };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }

  show(look: JewelLook): void {
    const k = `${look.id}|${look.finish}`;
    if (k === this.key) return;
    this.key = k;
    for (const c of this.holder.children) c.traverse((x: THREE.Object3D) => (x as THREE.Mesh).geometry?.dispose());
    this.holder.clear();
    this.holder.add(previewPiece(look));
    const r = previewRadius(look);
    this.camera.position.set(0, r * 0.6, r * 3.4);
    this.camera.lookAt(0, 0, 0);
    this.start();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.canvas.isConnected) {
        this.running = false;
        return;
      }
      try {
        if (!this.renderer) {
          this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
          this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
          this.renderer.setSize(480, 300, false);
          this.renderer.outputColorSpace = THREE.SRGBColorSpace;
          this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
          // A lit room for the metal to reflect.
          const pm = new THREE.PMREMGenerator(this.renderer);
          this.scene.environment = pm.fromScene(showroom(), 0.02).texture;
          pm.dispose();
        }
        const now = performance.now();
        if (!this.dragging) this.spin += ((now - this.last) / 1000) * 0.7;
        this.last = now;
        this.holder.rotation.set(this.tilt, this.spin, 0);
        this.renderer.render(this.scene, this.camera);
      } catch {
        // No WebGL for the preview: the shop still works without it.
        this.running = false;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

/** A dim room with a few bright softbox panels: what a jeweller's lights look like reflected in gold. */
function showroom(): THREE.Scene {
  const room = new THREE.Scene();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x2a2630, side: THREE.BackSide }));
  room.add(walls);
  const panel = (w: number, h: number, x: number, y: number, z: number, ry: number, c: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    room.add(m);
  };
  panel(4, 1.2, 0, 2.6, -4.8, 0, 0xffffff);
  panel(2.5, 3, -4.8, 0.5, 0, Math.PI / 2, 0xfff2e0);
  panel(2.5, 3, 4.8, 0.5, 0, -Math.PI / 2, 0xe0ecff);
  panel(3, 0.6, 0, -2.6, 4.8, Math.PI, 0xffd8a0);
  return room;
}

let shared: JewelTable | null = null;

/** The shared jewellery preview, showing this piece. */
export function jewelCanvas(look: JewelLook): HTMLCanvasElement {
  shared ??= new JewelTable();
  shared.show(look);
  return shared.canvas;
}
