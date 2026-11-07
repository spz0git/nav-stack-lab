import asyncio, json, os, subprocess, sys, tempfile
from playwright.async_api import async_playwright
from _browser import launch, page_url, ROOT
# The safety lab's tools (docs/safety-lab.md, phase 2), in the page:
#   - the fault schedule: a Try that switches the lidar off at 30 s does so at 30 s, says so in the log, and the
#     Perceive light warns within a second;
#   - people who wait for the robot: a generated world with stepout people keeps them still until the robot comes near;
#   - Tools → Safety: the sheet's check of the level on screen; a short search whose margins equal tools/search.mjs's for
#     the same search seed (the page's workers and Node draw the same scenarios); Open; a kept set rerun; import;
#   - the safety measures in the worker's summary;
#   - phase 3: in fog the learned detector's input is outside its data and the Perceive light says so within a second,
#     with the Metrics lines for the detector; the radar emergency brake stops in fog, says so in the log, counts its
#     stops in the Metrics list, and its settings are in the Control tab;
#   - phase 4a: after a search, the Risk table rates the random runs per hour with their 95 % intervals;
#   - phase 4b: the ODD monitor sees fog and crawls, with its light and log line; a small argument checked in the page
#     gives the verdicts core/argument.js gives; arguments stay in this browser across a reload; an argument travels in
#     a link.
#   - the results in the lesson: a search's worst runs under its Try in the Learn column, and a checked argument's graph
#     with the runs behind a red claim; Open plays such a run from 3 s before its contact and pauses at that contact,
#     the same contact the background run recorded.
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
LEARN = r'''
async () => {
  const N = window.__nav;
  await N.tryGo({sim: true, level: 4, set: {agents: 'learned', weather: 'fog'}, tab: 'per', hold: true});
  await N.advance(Math.round(2 / 0.05));
  const H = N.health();
  return {warn: (H.all.per || []).filter(c => c.on && c.lvl === 'warn').map(c => c.name), out: N.S.learn.ood.detector.out / Math.max(1, N.S.learn.ood.detector.n),
    met: [...document.querySelectorAll('.console *, .metrics *')].filter(e => !e.children.length).map(e => e.textContent).join(' | ')};
}'''
BRAKE = r'''
async () => {
  const N = window.__nav;
  await N.tryGo({sim: true, level: 4, set: {weather: 'fog', radar: true, radBrake: true}, tab: 'ctl', hold: true});
  await N.advance(Math.round(70 / 0.05));
  return {brakes: N.S.safe.brakes.length, log: N.S.log.filter(l => /Emergency brake/.test(l.msg)).length,
    pane: document.querySelector('#pane').innerText,
    met: [...document.querySelectorAll('.console *, .metrics *, #metrics *')].filter(e => !e.children.length).map(e => e.textContent).join(' | ')};
}'''
ODDMON = r'''
async () => {
  const N = window.__nav;
  await N.tryGo({sim: true, level: 4, set: {weather: 'fog', oddMon: true}, tab: 'mis', hold: true});
  await N.advance(Math.round(6 / 0.05));
  const H = N.health();
  return {warn: (H.all.plan || []).filter(c => c.on && c.lvl === 'warn').map(c => c.name), log: N.S.log.filter(l => /Outside the operating domain/.test(l.msg)).length,
    v: Math.abs(N.S.robot.v), out: !!(N.S.odd && N.S.odd.out)};
}'''
SMALLARG = {'format': 'nav-stack-lab-argument', 'version': 1, 'name': 'Test argument: fog noticed', 'nodes': [
  {'id': 'G1', 'type': 'goal', 'text': 'The robot notices fog within 2 s'},
  {'id': 'A1', 'type': 'assumption', 'parent': 'G1', 'rel': 'context', 'text': 'Only fog matters here'},
  {'id': 'E1', 'type': 'solution', 'parent': 'G1', 'rel': 'support', 'text': 'Fog with the monitor',
   'evidence': {'kind': 'runs', 'level': 4, 'set': {'weather': 'fog', 'oddMon': True}, 'seeds': [7], 'secs': 20, 'metric': 'oddFirst', 'op': '<=', 'value': 2}}]}
# One solution that fails: scripted people, the busy floor at seed 7, a contact at about 52 s
FAILARG = {'format': 'nav-stack-lab-argument', 'version': 1, 'name': 'Test argument: a contact', 'nodes': [
  {'id': 'G1', 'type': 'goal', 'text': 'No contact with a person'},
  {'id': 'E1', 'type': 'solution', 'parent': 'G1', 'rel': 'support', 'text': 'Scripted people, seed 7',
   'evidence': {'kind': 'runs', 'level': 4, 'set': {'people': 'scripted'}, 'seeds': [7], 'secs': 60, 'metric': 'contacts', 'op': '<=', 'value': 0}}]}
async def wait_still(pg):
    await pg.wait_for_timeout(300)
    for _ in range(80):
        if not await pg.evaluate('window.__nav.running'): break
        await pg.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        b = await launch(p)
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        pg.on('pageerror', lambda e: ERRORS.append('PAGEERR ' + str(e)))
        await pg.goto(page_url()); await pg.wait_for_timeout(800)
        await pg.evaluate("window.__nav.setLevel('advanced')")  # Tools → Safety is an Advanced tab
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
        risk = await pg.evaluate("() => (document.querySelector('#saf-out') || {}).innerText || ''")
        check('Risk' in risk and '95 % interval' in risk and 'rule of three' in risk, 'the Risk table rates the random runs per hour with their intervals')
        rr = await pg.evaluate("() => { const R = window.__nav.SAF.results.filter(r => r.kind === 'random'); return [R.length, R.every(r => r.w === 1)]; }")
        check(rr[0] >= 2 and rr[1], 'plain sampling weighs every random run 1')
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
        # Open plays the run up to the contact that set its margin, and stops there
        w = await pg.evaluate("() => { const r = window.__nav.SAF.results.slice().sort((a, b) => a.margin - b.margin || a.i - b.i)[0]; return r.s.events.length ? r.s.events.reduce((a, e) => (e.v > a.v ? e : a)) : null; }")
        if w:
            await wait_still(pg)
            got = await pg.evaluate("() => ({t: window.__nav.S.t, ev: window.__nav.S.safe.events.slice(-1)[0] || null, pc: document.querySelector('#pausec').checked})")
            check(got['pc'] and got['ev'] and abs(got['ev']['t'] - w['t']) < 0.06 and got['ev']['v'] == w['v'], f"Open pauses at the worst run's contact ({w['t']} s, {w['v']} m/s): {got['ev'] and [got['ev']['t'], got['ev']['v']]}")
        # the same search under a search Try of lesson 5, in the Learn column
        await pg.evaluate("() => { const N = window.__nav, A = window.__an; N.SAF.tryRef = A.LESSON_GROUPS().find(g => g.id === 'saf').items[4].tries[0][1].saf; N.SAF.tryText = 'Done.'; A.setUIMode('learn'); A.openLesson('saf:4'); }")
        await pg.wait_for_timeout(400)
        n = await pg.evaluate("() => document.querySelectorAll('.saf-embed[data-safk=\"saf:4:0\"] [data-safopen]').length")
        check(n == 5, f'the search Try lists its five worst runs, each with Open ({n})')
        await pg.evaluate("() => document.querySelector('.saf-embed[data-safk=\"saf:4:0\"] [data-safshow]').click()")
        await pg.wait_for_timeout(300)
        r2 = await pg.evaluate("() => [document.querySelector('.layout').dataset.mode, !!document.querySelector('#saf-out canvas')]")
        check(r2[0] != 'learn' and r2[1], f'its button opens the Safety tab in Simulate ({r2})')
        r = await pg.evaluate(LEARN)
        check('Out of distribution (detector)' in r['warn'], 'in fog the Perceive light says the detector is out of distribution: ' + ', '.join(r['warn']))
        check(r['out'] > 0.5, f"most of the scans are outside ({r['out']:.0%})")
        await pg.wait_for_timeout(300)
        r2 = await pg.evaluate("() => [...document.querySelectorAll('*')].filter(e => !e.children.length && /^(People found|Detector input)$/.test(e.textContent)).length")
        check(r2 >= 2, 'the Metrics list has the People found and Detector input lines')
        r = await pg.evaluate(BRAKE)
        check(r['brakes'] > 0 and r['log'] > 0, f"the radar brake stops in fog and the log says so ({r['brakes']} stops)")
        check('Radar emergency brake' in r['pane'] and 'time to contact' in r['pane'], 'its settings are in the Control tab')
        await pg.wait_for_timeout(300)
        r2 = await pg.evaluate("() => [...document.querySelectorAll('*')].filter(e => !e.children.length && e.textContent === 'Emergency brake').length")
        check(r2 >= 1, 'the Metrics list counts its stops')
        r = await pg.evaluate(ODDMON)
        check('Operating domain' in r['warn'] and r['log'] >= 1 and r['out'], 'in fog the ODD monitor warns, logs and holds the robot outside: ' + ', '.join(r['warn']))
        check(r['v'] <= 0.31, f"it crawls ({r['v']:.2f} m/s)")
        await pg.evaluate("a => window.__nav.tryGo({sim: true, level: 4, tab: 'saf', hold: true, saf: {arg: a, argSet: {}, check: true}})", SMALLARG)
        for _ in range(120):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("() => !window.__nav.ARG.running && Object.keys(window.__nav.ARG.verdicts).length > 0"): break
        v = await pg.evaluate("() => window.__nav.ARG.verdicts.E1")
        check(v and v['pass'] and v['value'] <= 2, f"a small argument checked in the page passes as in Node: {v}")
        svg = await pg.evaluate("() => document.querySelectorAll('.arg-svg [data-argnode]').length")
        check(svg >= 3, 'the graph draws every node')
        # a red claim leads to its run: checked from lesson 9's first Try, the Learn column shows the graph and the run
        await pg.evaluate("() => { window.__an.setUIMode('learn'); window.__an.openLesson('saf:8'); }")
        await pg.evaluate("a => { window.__nav.tryGo({sim: true, level: 4, tab: 'saf', hold: true, saf: {arg: a, argSet: {}, check: true}}); window.__nav.ARG.tryRef = window.__an.LESSON_GROUPS().find(g => g.id === 'saf').items[8].tries[0][1].saf; }", FAILARG)
        for _ in range(120):
            await pg.wait_for_timeout(500)
            if await pg.evaluate("() => !window.__nav.ARG.running && Object.keys(window.__nav.ARG.verdicts).length > 0"): break
        v = await pg.evaluate("() => window.__nav.ARG.verdicts.E1")
        bad = [r for r in (v or {}).get('runs', []) if r['bad']]
        check(v and not v['pass'] and len(bad) == 1 and bad[0]['t'] is not None, f"the failed solution names its run and when: {bad}")
        emb = await pg.evaluate("() => { const e = document.querySelector('.saf-embed[data-safk=\"saf:8:0\"]'); return e ? [!!e.querySelector('.arg-svg'), e.querySelectorAll('[data-argrun]').length, e.innerText.includes('E1 fails')] : null; }")
        check(emb and emb[0] and emb[1] == 1 and emb[2], f'under the Try: the graph, and the run behind the red claim with Open ({emb})')
        check(await pg.evaluate("() => window.__nav.ARG.done") == 1, 'opening the lesson set its first Try up without checking ARG-1 (only the one run of this check ran)')
        await pg.evaluate("() => document.querySelector('.saf-embed[data-safk=\"saf:8:0\"] [data-argrun]').click()")
        await wait_still(pg)
        got = await pg.evaluate("() => ({seed: window.__nav.P.seed, ev: window.__nav.S.safe.events.slice(-1)[0] || null})")
        check(got['seed'] == 7 and got['ev'] and abs(got['ev']['t'] - bad[0]['t']) < 0.06 and got['ev']['kind'] == 'person', f"its Open pauses at that contact ({bad[0]['t']} s): {got['ev'] and got['ev']['t']}")
        await pg.evaluate("() => window.__an.setUIMode('sim')")
        await pg.reload(); await pg.wait_for_timeout(1500)
        kept = await pg.evaluate("() => window.__nav.ARG.list.map(a => a.name)")
        check('Test argument: fog noticed' in kept, 'the argument is still there after a reload (IndexedDB)')
        b64 = await pg.evaluate("a => { const s = JSON.stringify({...a, name: 'Linked argument'}); return btoa(unescape(encodeURIComponent(s))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); }", SMALLARG)
        await pg.evaluate("h => { location.hash = h; }", '#argj=' + b64); await pg.wait_for_timeout(800)
        kept = await pg.evaluate("() => window.__nav.ARG.list.map(a => a.name)")
        check('Linked argument' in kept, 'an argument opens from a link')
    print('FAILS', FAILS)
    print('ERRORS', ERRORS[:5])
    sys.exit(1 if FAILS or ERRORS else 0)
asyncio.run(main())
