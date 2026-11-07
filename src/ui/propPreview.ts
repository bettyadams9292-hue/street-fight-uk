import * as THREE from 'three';
import { buildFurnitureModel, buildVehicleModel } from '../render/propModels';
import { CARS, FURNITURE } from '../property/catalogue';

/**
 * A little turntable for the shop screens: one shared WebGL canvas that shows
 * whichever piece of furniture, car or bike you're looking at, slowly turning.
 */
class Turntable {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.05, 50);
  private holder = new THREE.Group();
  private key = '';
  private running = false;
  private t0 = performance.now();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'prop-preview';
    this.canvas.width = 480;
    this.canvas.height = 300;
    this.scene.background = new THREE.Color(0x15171c);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x302820, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ab0ff, 1.0);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor, this.holder);
  }

  /** Show a catalogue item. */
  show(id: string, colour: string): void {
    const k = `${id}|${colour}`;
    if (k === this.key) return;
    this.key = k;
    this.holder.clear();
    const isFurniture = !!FURNITURE[id];
    const model = isFurniture ? buildFurnitureModel(id, colour) : buildVehicleModel(id, colour);
    // Wall pieces come down to eye level; everything is centred and framed by its size.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    this.holder.add(model);
    const r = Math.max(size.x, size.y * 1.4, size.z, 0.4);
    const dist = r * (CARS[id] ? 1.55 : 1.9);
    this.camera.position.set(0, size.y * 0.55 + r * 0.35, dist);
    this.camera.lookAt(0, size.y * 0.42, 0);
    this.start();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.canvas.isConnected) {
        this.running = false;
        return;
      }
      try {
        if (!this.renderer) {
          this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
          this.renderer.setPixelRatio(1);
          this.renderer.outputColorSpace = THREE.SRGBColorSpace;
          this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        }
        this.holder.rotation.y = ((performance.now() - this.t0) / 1000) * 0.6;
        this.renderer.render(this.scene, this.camera);
      } catch {
        // No WebGL for the preview (very old devices): the screen still works without it.
        this.running = false;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

let shared: Turntable | null = null;

/** The shared preview canvas, showing `id` in `colour`. */
export function previewCanvas(id: string, colour: string): HTMLCanvasElement {
  shared ??= new Turntable();
  shared.show(id, colour);
  return shared.canvas;
}
