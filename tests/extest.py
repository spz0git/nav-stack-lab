import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# The slot examples (src/examples/<slot>/*.js, the Code tab's menu and the lessons' "Edit and run") against the built-in
# they stand in for: each example is loaded into its slot, the matching parameter set to "Your code", and the regression
# level run at seed 7; the built-in runs the same case. An example passes when it finishes the mission about as well:
# goals reached within one of the built-in, collisions at most one more, and (loc) the pose RMS within 1.5× + 5 cm,
# (ctl, plan) the distance within 30 %. Prints a line per pair; FAILS must be [].
CASES = [
  # slot, example id, built-in value, level index, seconds
  ('loc', 'dr', 'dr', 2, 120), ('loc', 'ekf', 'ekf', 2, 120), ('loc', 'pf', 'pf', 2, 120),
  ('plan', 'astar', 'astar', 1, 120), ('plan', 'dijkstra', 'astar', 1, 120), ('plan', 'rrtstar', 'rrtstar', 1, 120),
  ('ctl', 'pp', 'pp', 0, 90), ('ctl', 'pid', 'pid', 0, 90), ('ctl', 'stanley', 'pp', 0, 90), ('ctl', 'rwf', 'rwf', 0, 90),
  # the controller examples are written for the unicycle; on the car (L6) they drive, with simpler speed logic than the
  # built-ins' reverse-leg and leg-end care, and brush the shelves: not part of the gate
  ('pred', 'cv', 'cv', 4, 200), ('pred', 'static', 'static', 4, 200),
]
RUN = r'''
async ({slot, ex, builtin, lvl, secs}) => {
  const N = window.__nav, param = {loc: 'loc', plan: 'plan', ctl: 'ctl', pred: 'agPred'}[slot];
  const one = async (useEx) => {
    N.setParam('seed', 7, false); N.loadLevel(lvl);
    if (slot === 'pred') N.setParam('agents', 'lidar', false);
    if (useEx) {
      const e = N.SLOT_LIBRARY[slot].find(x => x.id === ex);
      if (!N.slotLoad(slot, e.code)) return {error: 'load failed: ' + N.SLOTS[slot].status.msg};   // sets the parameter to Your code
    } else N.setParam(param, builtin, false);
    document.querySelector('#run').click(); document.querySelector('#run').click();
    const S = N.S; let n = 0, se = 0, k = 0;
    while (n < secs * 20 && S.fsm.state !== 'DONE') {
      await N.advance(10); n += 10;
      se += (S.est.x - S.robot.x) ** 2 + (S.est.y - S.robot.y) ** 2; k++;
      if (N.SLOTS[slot].status.cls === 'err') return {error: N.SLOTS[slot].status.msg};
    }
    return {t: +S.t.toFixed(1), state: S.fsm.state, done: N.WPS.filter(w => w.done && !w.skipped).length, goals: N.WPS.length,
      coll: S.coll + S.collPed, dist: +S.dist.toFixed(1), rms: +Math.sqrt(se / Math.max(1, k)).toFixed(3), err: N.SLOTS[slot].lastErr || ''};
  };
  const b = await one(false), e = await one(true);
  return {b, e};
}'''
async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    async with async_playwright() as p:
        br = await launch(p); pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        fails = []
        for slot, ex, builtin, lvl, secs in CASES:
            if only and only not in (slot, ex): continue
            r = await pg.evaluate(RUN, {'slot': slot, 'ex': ex, 'builtin': builtin, 'lvl': lvl, 'secs': secs})
            b, e = r['b'], r['e']
            tag = f'{slot}/{ex} vs {builtin} L{lvl+1}'
            if 'error' in e: fails.append(tag + ': ' + e['error']); print('==', tag, 'ERROR', e['error']); continue
            bad = []
            if e['done'] < b['done'] - 1: bad.append(f"goals {e['done']} < {b['done']}-1")
            if e['coll'] > b['coll'] + 1: bad.append(f"collisions {e['coll']} > {b['coll']}+1")
            if slot == 'loc' and e['rms'] > 1.5 * b['rms'] + 0.05: bad.append(f"pose RMS {e['rms']} > 1.5×{b['rms']}+0.05")
            if slot in ('ctl', 'plan') and e['dist'] > 1.3 * b['dist'] + 1: bad.append(f"distance {e['dist']} > 1.3×{b['dist']}")
            print('==', tag, 'FAIL' if bad else 'ok', '| built-in', b, '| example', e, ('| ' + '; '.join(bad)) if bad else '')
            if bad: fails.append(tag + ': ' + '; '.join(bad))
        print('ERRORS:', errs[:5]); print('FAILS:', fails)
        await br.close()
asyncio.run(main())
