const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
export default async (page) => {
  await page.evaluate((n) => { window.__extra = n; }, +(process.env.EXTRA || 40));
  await page.addStyleTag({ content: '#ui, .rotate-hint { display: none !important; }' });
  const props = JSON.parse(process.env.PROPS);
  for (const p of props) {
    if (only && !only.includes(p.id)) continue;
    const out = await page.evaluate((p) => {
      const g = window.sfuk; g.manualClock = true; g.enterArea(p.area, `prop_${p.id}`); g.advance(20);
      const r = g.renderer; const rig = r.cameraRig;
      // Dusk: a deep blue sky behind and the ambient light lifted a little.
      const sc = r.scene;
      if (sc.background && sc.background.set) sc.background.set('#27304c');
      if (sc.fog) { sc.fog.color.set('#27304c'); sc.fog.density *= 0.5; }
      sc.traverse((o) => { if ((o.isHemisphereLight || o.isAmbientLight) && !o.userData.photo) { o.userData.photo = true; o.intensity *= 1.7; } });
      // Nothing parked in the foreground of the shot (a bus outside the house, say).
      for (const q of g.world.level.props) if (['bus', 'van', 'car'].includes(q.kind) && Math.abs(q.x - p.x) < 5 && q.z > 0.5) r.hideLevelProp(q);
      if (p.hideBig) {
        g.advance(2);
        const Box = r.cameraRig.camera.position.constructor;
        r.scene.traverse((o) => {
          if (!o.isMesh || !o.geometry) return;
          o.geometry.computeBoundingBox?.();
          const b = o.geometry.boundingBox; if (!b) return;
          const e = o.matrixWorld.elements; const mx = (b.min.x + b.max.x) / 2, my = (b.min.y + b.max.y) / 2, mz = (b.min.z + b.max.z) / 2; const cx = e[0] * mx + e[4] * my + e[8] * mz + e[12], cz = e[2] * mx + e[6] * my + e[10] * mz + e[14];
          const sx = (b.max.x - b.min.x) * Math.hypot(e[0], e[1], e[2]);
          if (Math.abs(cx - p.x) < 8 && cz > 1.0 && cz < 6 && sx > 0.05) o.visible = false;
        });
      }
      rig.updateWorld = function () {
        const w = g.world; w.player.pos.x = w.level.bounds.minX + 0.5; w.player.pos.z = 1.9;
        for (const e of w.enemies) e.pos.x = w.level.bounds.minX - 30;
        const c = this.camera; c.fov = p.fov; c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); c.position.set(p.cx, p.cy, p.cz); c.lookAt(p.tx, p.ty, p.tz);
      };
      g.advance(+(window.__extra || 40));
      return g.world.level.id;
    }, p);
    await page.screenshot({ path: `/tmp/property/photos/${p.id}.png`, timeout: 90000 });
    console.log(p.id, out);
  }
};
