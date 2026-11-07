import * as THREE from 'three';

/**
 * Procedural canvas textures for the Stage 1 alley (TEMPORARY: replaced by
 * Blender-baked textures in Stage 5). Generated at load, so no image files.
 */

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function toTexture(c: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function jitter(base: [number, number, number], amount: number): string {
  const j = () => (Math.random() - 0.5) * amount;
  return `rgb(${Math.round(base[0] + j())},${Math.round(base[1] + j())},${Math.round(base[2] + j())})`;
}

/** Victorian red brick, stretcher bond, sooty. */
export function brickTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#3a3330';
  g.fillRect(0, 0, 512, 512);
  const bw = 64;
  const bh = 24;
  for (let row = 0; row < 512 / bh; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let col = -1; col < 512 / bw + 1; col++) {
      const x = col * bw + offset;
      const y = row * bh;
      g.fillStyle = jitter([118, 52, 40], 40);
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      // Weathering speckle.
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(20,15,12,${Math.random() * 0.25})`;
        g.fillRect(x + 2 + Math.random() * (bw - 8), y + 2 + Math.random() * (bh - 8), 4, 3);
      }
    }
  }
  // Soot streaks running down from the top.
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, 'rgba(10,8,8,0.35)');
  grad.addColorStop(0.5, 'rgba(10,8,8,0.05)');
  grad.addColorStop(1, 'rgba(10,8,8,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  return toTexture(c, repeatX, repeatY);
}

/** Concrete paving slabs, the standard 600 mm UK pavement grid. */
export function pavingTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const n = 4;
  const s = 512 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      g.fillStyle = jitter([92, 92, 96], 14);
      g.fillRect(x * s, y * s, s, s);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
        g.fillRect(x * s + Math.random() * s, y * s + Math.random() * s, 2 + Math.random() * 4, 2 + Math.random() * 4);
      }
      // Chewing gum spots, an unavoidable British detail.
      if (Math.random() < 0.6) {
        g.fillStyle = 'rgba(40,40,44,0.6)';
        g.beginPath();
        g.arc(x * s + Math.random() * s, y * s + Math.random() * s, 3 + Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.strokeStyle = 'rgba(25,25,28,0.9)';
  g.lineWidth = 4;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * s);
    g.lineTo(512, i * s);
    g.stroke();
  }
  return toTexture(c, repeatX, repeatY);
}

/** Tarmac with double yellow lines along one edge (no parking at any time). */
export function roadTexture(repeatX: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#26272b';
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2);
  }
  g.fillStyle = '#c9a227';
  g.fillRect(0, 14, 512, 7);
  g.fillRect(0, 28, 512, 7);
  return toTexture(c, repeatX, 1);
}

/** A row of flat windows above the shops; some lit. Used as an emissive map. */
export function windowsTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 125;
    const lit = Math.random() < 0.45;
    g.fillStyle = lit ? (Math.random() < 0.5 ? '#f3b45c' : '#d9e2f0') : '#0d1118';
    g.fillRect(x, 60, 70, 110);
    if (lit) {
      // Curtains.
      g.fillStyle = 'rgba(60,20,20,0.6)';
      g.fillRect(x, 60, 18, 110);
      g.fillRect(x + 52, 60, 18, 110);
    }
    g.fillStyle = '#1a1a1a';
    g.fillRect(x + 33, 60, 4, 110);
    g.fillRect(x, 112, 70, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Shop-shutter graffiti-free roller door. */
export function shutterTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  for (let y = 0; y < 256; y += 8) {
    g.fillStyle = y % 16 === 0 ? '#5d6066' : '#4c4f55';
    g.fillRect(0, y, 256, 8);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 200, 256, 56);
  return toTexture(c);
}
