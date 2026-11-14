// Browser half of tools/icons/render_items.mjs: renders one GLB to a 128 px WebP icon.
// Same camera, lights, framing and outline for every item; long weapons lie on a diagonal.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OUT = 128; // final icon size
const SS = 4; // supersampling
const MARGIN = 0.1; // empty border on each side, as a fraction of the icon
const OUTLINE = 2; // outline radius at 128 px
const INK = '#08090c';
const INK_ALPHA = 0.9;
const HALO = '#ece8dc'; // a faint light edge outside the ink, so dark items read on dark cards
const HALO_ALPHA = 0.3;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(OUT * SS, OUT * SS);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

// Three-quarter view: 35 degrees round from the front (+Z) towards +X, 28 degrees above.
const AZ = THREE.MathUtils.degToRad(35);
const EL = THREE.MathUtils.degToRad(28);
const VIEW = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)); // towards the camera

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a3440, 0.9));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.9); // warm key, upper left front
  key.position.set(-1.2, 2.0, 1.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8c8ff, 0.8); // cool fill from the right
  fill.position.set(2.0, 0.4, 0.8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); // rim from behind and above
  rim.position.set(0.6, 1.4, -2.0);
  scene.add(rim);
}

const loader = new GLTFLoader();

/** Orient a weapon (grip at origin, length along +Y) so it lies across the icon on a diagonal. */
function diagonal(obj, cam) {
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const toCam = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2);
  // Length runs from lower left (grip) to upper right (head).
  const y = right.clone().add(up).normalize();
  // The weapon's front (+Z) turned 35 degrees away from the camera round the length axis, for depth.
  const z = toCam.clone().applyAxisAngle(y, THREE.MathUtils.degToRad(-35)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

window.renderIcon = async function renderIcon(url, mode) {
  const gltf = await loader.loadAsync(url);
  const scene = new THREE.Scene();
  lights(scene);
  const model = gltf.scene;
  const holder = new THREE.Group();
  holder.add(model);
  scene.add(holder);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  cam.position.copy(VIEW).multiplyScalar(10);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);

  // Weapons are long if their length (+Y) is well over their width and depth.
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const long = (mode === 'weapon') && size.y > 2.5 * Math.max(size.x, size.z);
  if (long) diagonal(holder, cam);
  // Weapons held upside down (a chair by its back, a cone by its tip) are shown the right way up.
  else if (mode === 'flip') holder.rotation.z = Math.PI;
  holder.updateMatrixWorld(true);

  // Fit to the projected vertices (tighter and steadier than a projected bounding box).
  const inv = cam.matrixWorldInverse;
  const v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
  });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const half = Math.max(x1 - x0, y1 - y0) / 2 / (1 - 2 * MARGIN);
  cam.left = cx - half; cam.right = cx + half; cam.bottom = cy - half; cam.top = cy + half;
  cam.near = -z1 - 1; cam.far = -z0 + 1;
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);

  // Downsample, then a soft dark outline behind the object so it reads on dark cards.
  const big = renderer.domElement;
  const shape = document.createElement('canvas');
  shape.width = shape.height = OUT;
  const sg = shape.getContext('2d');
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(big, 0, 0, OUT, OUT);
  const tinted = (colour) => {
    const c = document.createElement('canvas');
    c.width = c.height = OUT;
    const g = c.getContext('2d');
    g.drawImage(shape, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = colour;
    g.fillRect(0, 0, OUT, OUT);
    return c;
  };
  const ring = (src, r) => {
    const c = document.createElement('canvas');
    c.width = c.height = OUT;
    const g = c.getContext('2d');
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      g.drawImage(src, Math.cos(t) * r, Math.sin(t) * r);
    }
    return c;
  };
  const out = document.createElement('canvas');
  out.width = out.height = OUT;
  const og = out.getContext('2d');
  og.globalAlpha = HALO_ALPHA;
  og.drawImage(ring(tinted(HALO), OUTLINE + 1), 0, 0);
  og.globalAlpha = INK_ALPHA;
  og.drawImage(ring(tinted(INK), OUTLINE), 0, 0);
  og.globalAlpha = 1;
  og.drawImage(shape, 0, 0);

  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      for (const m of [].concat(o.material)) m.dispose();
    }
  });
  return out.toDataURL('image/webp', 0.86);
};
window.iconReady = true;
