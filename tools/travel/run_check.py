"""
Watch a "Run there" all the way (Game.startRun / autoCommand) in the browser on a ?shot= page, printing every street
change, fight and stall. Street fights are won for you and you can't be hurt, so only the running is tested.
    (build, serve the build on 127.0.0.1:8765) python3 tools/travel/run_check.py high_street 10 nightlife
Checked 26 Nov 2026: High Street to the Neon Mile is ten streets, 35 to 45 half-second steps each, no stalls.
"""
import sys, json
from playwright.sync_api import sync_playwright
DEST = sys.argv[3] if len(sys.argv) > 3 else 'nightlife'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 640, 'height': 360})
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:200]))
    page.goto('http://127.0.0.1:8765/?shot=area&id=' + (sys.argv[1] if len(sys.argv)>1 else 'high_street') + '&x=' + (sys.argv[2] if len(sys.argv)>2 else '10') + '')
    page.wait_for_function("() => window.__shot && window.__shot.ready", timeout=120000)
    page.evaluate("""() => { const g = window.__game; const s = g.progress.save;
      for (const f of ['boss_gaffer','boss_sully','boss_ratcatcher','boss_dunc','has_vip_pass','boss_estate_king']) s.flags[f] = true;
      s.tutorial && (s.tutorial.done = true);
      const L = window.__levels || {}; for (const a of ['high_street','city','precinct','nightlife','market','estate','back_alleys','mall','kingsway']) for (let i=0;i<20;i++) s.flags[`cleared:${a}:${i}`]=true;
      g.startRun('""" + DEST + """'); }""")
    log = []
    last = None
    for step in range(500):
        page.evaluate("""() => { const g = window.__game; const w = g.world; w.player.vitals.health = w.player.vitals.maxHealth;
          if (!g.calm()) for (const f of w.sim.fighters) if (f !== w.player && f.team === 'enemy' && !f.isKO) { f.vitals.health = 0; f.knockOut(); }
          g.advance(30); }""")
        st = page.evaluate("""() => { const g = window.__game; const w = g.world; return { area: w.level.id, x: +w.player.pos.x.toFixed(1), z: +w.player.pos.z.toFixed(2), run: !!g.autoRun, calm: g.calm(), state: g.state, enemies: w.sim.fighters.filter(f=>f.team==='enemy' && !f.isKO).length }; }""")
        if last is None or st['area'] != last['area'] or st['run'] != last['run'] or st['calm'] != last['calm'] or st['state'] != last['state']:
            log.append((step, st))
        last = st
        if st['state'] != 'playing':
            clicked = page.evaluate("() => { const b = [...document.querySelectorAll('button')].find(b => /stay|explore|carry on|continue|ok|close|not now/i.test(b.innerText + (b.getAttribute('aria-label')||'') + (b.querySelector('img')?.alt||''))); if (b) { b.click(); return (b.innerText || b.querySelector('img')?.alt || '').trim(); } return null; }")
            if clicked:
                log.append((step, 'clicked ' + clicked))
                continue
            print('PAUSED BY', page.evaluate("() => [...document.querySelectorAll('.screen, .overlay, [class*=screen]')].filter(e=>e.offsetParent).map(e=>e.className+': '+e.innerText.slice(0,160).replace(/\\n/g,' | ')).slice(0,3)"))
            page.screenshot(path='/tmp/run_paused.png')
            break
        if not st['run']:
            break
    for l in log: print(l)
    print('final', last, 'errors', errs[:3])
    page.screenshot(path='/tmp/run_end.png')
    b.close()
