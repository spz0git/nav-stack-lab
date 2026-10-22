import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright
from _browser import launch, page_url, ROOT
# The safety lab's tools (docs/safety-lab.md, phase 2), in the page:
#   - the fault schedule: a Try that switches the lidar off at 30 s does so at 30 s, says so in the log, and the
#     Perceive light warns within a second;
#   - people who wait for the robot: a generated world with stepout people keeps them still until the robot comes near;
#   - Tools → Safety: the sheet's check of the level on screen; a short search whose margins equal tools/search.mjs's for
#     the same search seed (the page's workers and Node draw the same scenarios); Open; a kept set rerun; import;
#   - the safety measures in the worker's summary.
# FAILS and ERRORS must be [].
FAILS, ERRORS = [], []
def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what, flush=True)
    if not ok: FAILS.append(what)
SCHED = r'''
async () => {
  const N = window.__nav;
  await N.tryGo({sim: true, level: 4, set: {sched: [{t: 30, set: {lidar: false}}]}, tab: 'per', hold: true});
  await N.advance(Math.round(29.9 / 0.05));
  const before = N.P.lidar;
  await N.advance(Math.round(1.1 / 0.05));
  const H = N.health();
  return {before, after: N.P.lidar, log: N.S.log.filter(l => /schedule|Lidar/.test(l.msg)).map(l => l.t.toFixed(2) + ' ' + l.msg),
    warn: (H.all.per || []).filter(c => c.on && c.lvl === 'warn').map(c => c.name), first: N.S.safe.health['per/Lidar'] || null};
}'''
STEPOUT = r'''
async () => {
  const N = window.__nav;
  await N.tryGo({sim: true, level: {gen: 'warehouse', seed: 3, like: 'L5', people: 0, stepout: 3}, tab: 'mis', hold: true});
  const P0 = N.S.peds.map(p => [p.x, p.y]); let still = true, went = false;
  for (let k = 0; k < 1600; k++) {
    await N.advance(1);
    N.S.peds.forEach((p, i) => { if (!p.go && (p.x !== P0[i][0] || p.y !== P0[i][1])) still = false; if (p.go) went = true; });
  }
  return {n: N.S.peds.length, triggers: N.S.peds.filter(p => p.tr).length, still, went, log: N.S.log.filter(l => /steps out/.test(l.msg)).length};
}'''
SEARCH = r'''
async ({budget, rounds, seed}) => {
  const N = window.__nav, A = N.SAF;
  await N.tryGo({sim: true, level: 4, tab: 'saf', hold: true});
  const rows = [...document.querySelectorAll('#pane .exptab tbody tr')].map(t => t.textContent);
  Object.assign(A, {budget, rounds, seed});
  await N.safSearch();
  return {rows, margins: A.results.map(r => r.margin), n: document.querySelectorAll('#saf-out tbody tr').length, chart: !!document.querySelector('#cv-saf')};
}'''
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        pg.on('pageerror', lambda e: ERRORS.append('PAGEERR ' + str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        r = await pg.evaluate(SCHED)
        print(json.dumps(r))
        check(r['before'] is True and r['after'] is False, 'the fault schedule switches the lidar off at 30 s')
        check(any('Fault schedule at 30 s' in l for l in r['log']), 'the log says when')
        check('Lidar' in r['warn'] and r['first'] is not None and r['first']['t'] <= 31, 'the Perceive light warns within a second, and the core records it')
        r = await pg.evaluate(STEPOUT)
        print(json.dumps(r))
        check(r['n'] == 3 and r['triggers'] == 3, 'three people who wait for the robot')
        check(r['still'], 'they stand still until the robot comes near')
        check(r['went'] and r['log'] >= 1, 'at least one steps out, and the log says so')
        budget, rounds, seed = 6, 1, 1
        r = await pg.evaluate(SEARCH, {'budget': budget, 'rounds': rounds, 'seed': seed})
        print(json.dumps(r))
        check(len(r['rows']) >= 5 and any('inside' in x for x in r['rows']), 'the domain check lists the attributes')
        check(len(r['margins']) == budget and all(m is not None for m in r['margins']), f'the search ran {budget} runs')
        check(r['n'] > 0 and r['chart'], 'the worst runs and the chart are shown')
        out = os.path.join(tempfile.mkdtemp(), 'search.json')
        subprocess.run(['node', os.path.join(ROOT, 'tools', 'search.mjs'), '--budget', str(budget), '--rounds', str(rounds), '--seed', str(seed), '--json', out], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
        node = [x['margin'] for x in json.load(open(out))]
        print('node', node)
        check(node == r['margins'], 'the page and tools/search.mjs give the same runs for the same search seed')
        await pg.click('#saf-keep'); await pg.wait_for_timeout(200)
        n0 = await pg.evaluate('window.__nav.SAF.sets.length')
        await pg.evaluate("window.__nav.setParam('guard', true, false)")
        await pg.click('[data-safrerun="0"]')
        for _ in range(300):
            await pg.wait_for_timeout(500)
            if not await pg.evaluate('window.__nav.SAF.running'): break
        last = await pg.evaluate('window.__nav.SAF.sets[0].last')
        check(n0 == 1 and last and last['n'] == 5 and 'guard' in (last['extra'] or ''), 'a kept set reruns with your changes')
        js = await pg.evaluate("JSON.stringify({format: 'nav-stack-lab-scenarios', version: 1, name: 'imported', scenarios: window.__nav.SAF.sets[0].scenarios})")
        await pg.evaluate("document.querySelector('#saf-sets details').open = true")
        await pg.fill('#saf-json', js); await pg.click('#saf-import'); await pg.wait_for_timeout(200)
        check(await pg.evaluate('window.__nav.SAF.sets.length') == 2, 'a set imports from JSON')
        await pg.click('[data-safopen]'); await pg.wait_for_timeout(400)
        lv = await pg.evaluate('[window.__nav.LV.id, window.__nav.LV.name, window.__nav.S.fsm.state]')
        check(lv[0] == 'G', 'Open loads the scenario: ' + ' '.join(map(str, lv)))
    print('FAILS', FAILS)
    print('ERRORS', ERRORS[:5])
    sys.exit(1 if FAILS or ERRORS else 0)
asyncio.run(main())
