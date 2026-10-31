import asyncio, json, sys
from playwright.async_api import async_playwright
from _browser import launch, page_url
# The Sensors switchboard (core/sensors.js SENSORS): on L3 and L5, with every registered sensor on (the level's own setup
# plus the gyro and GNSS), each sensor is turned off alone and then all of them together, and the mission runs 30 s.
# Checked: no page error, the run finishes its 30 s (nothing hangs), the pose and the estimate stay finite, the mission
# is in a known state (and a stopped one says why in the log), the health reasons name the missing sensor, the sensor
# dots show it off, and with every sensor of the world off the health says the robot is blind.
# A second pass repeats the lidar and the all-off cases with the estimators that read the lidar (scan matching, the
# particle filter's lidar weighting, pose-graph SLAM), lidar mapping, the safety stop and the learned policy; and with
# the radar as the tracker's input (RADAR_TRACK), lidar off, the radar alone must still give confirmed people tracks.
# A sensor added to SENSORS is tested without touching this file; KEYWORD says how the health names it.
KEYWORD = {'odom': 'odometry', 'gyro': 'gyro', 'lidar': 'lidar', 'beacons': 'beacon', 'gnss': 'gnss'}
RUN = r'''
async ({lvl, set, off, secs}) => {
  const N = window.__nav;
  N.loadLevel(lvl);
  for (const [k, v] of Object.entries(set)) N.setParam(k, v, false);
  for (const s of N.SENSORS) if (!N.sensorOn(s) && (s.avail ? s.avail() : true) && !off.includes(s.key)) N.setSensor(s.key, true, false);
  for (const k of off) N.setSensor(k, false, false);
  document.querySelector('#run').click(); document.querySelector('#run').click();
  const S = N.S, t0 = performance.now();
  let bad = null, tracks = 0;
  for (let i = 0; i < Math.round(secs / 0.05); i++) {
    await N.advance(1);
    const r = S.robot, e = S.est;
    if (![r.x, r.y, r.th, e.x, e.y, e.th].every(Number.isFinite)) { bad = `not finite at ${S.t.toFixed(2)} s`; break; }
    if (S.agents) tracks = Math.max(tracks, S.agents.tracks.filter(t => t.conf).length);
    if (performance.now() - t0 > 120000) { bad = `too slow: ${S.t.toFixed(1)} s simulated in 120 s`; break; }
  }
  await new Promise(r => setTimeout(r, 50));
  const H = N.health(), on = [];
  for (const k of Object.keys(H.all)) for (const c of H.all[k]) if (c.on) on.push(`${k}/${c.name}: ${c.msg}`);
  const dots = Object.fromEntries([...document.querySelectorAll('#sensdots .sd')].map(d => [d.dataset.k || 'blind', d.className.replace('sd ', '')]));
  return {state: S.fsm.state, t: +S.t.toFixed(1), bad, on, dots, tracks,
    sensors: N.SENSORS.map(s => [s.key, N.sensorOn(s), s.avail ? s.avail() : true]),
    done: N.WPS.filter(w => w.done && !w.skipped).length + '/' + N.WPS.length, skipped: N.WPS.filter(w => w.skipped).length,
    err: +Math.hypot(S.robot.x - S.est.x, S.robot.y - S.est.y).toFixed(2), coll: S.coll,
    log: S.log.slice(0, 6).map(l => l.t.toFixed(1) + ' ' + l.msg).reverse()};
}'''
RADAR_TRACK = {'agents': 'lidar', 'radar': True, 'trkIn': 'radar', 'spd': 'st'}  # the radar as the tracker's only input
LIDAR_USERS = [{'loc': 'ekf', 'scanMatch': True}, {'loc': 'pf', 'pfLidar': True}, {'loc': 'pgslam', 'per': 'mapping'},
               {'per': 'mapping', 'unknownAs': 'lethal'}, {'ctl': 'pp', 'guard': True}, {'ctl': 'dwa'}, {'plan': 'policy'},
               {'agents': 'learned'}, {'loc': 'custom'}, RADAR_TRACK]
async def main():
    quick = '--quick' in sys.argv
    async with async_playwright() as p:
        b = await launch(p)
        pg = await b.new_page(viewport={'width': 1280, 'height': 900})
        errs, fails = [], []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        await pg.goto(page_url())
        await pg.wait_for_timeout(800)
        keys = await pg.evaluate('() => window.__nav.SENSORS.map(s => s.key)')
        print('sensors:', keys)
        cases = []
        for lvl in (2, 4):
            for k in keys: cases.append((lvl, {}, [k]))
            cases.append((lvl, {}, keys))
            if not quick:
                for st in LIDAR_USERS: cases += [(lvl, st, ['lidar']), (lvl, st, keys)]
        for lvl, st, off in cases:
            n0 = len(errs)
            r = await pg.evaluate(RUN, {'lvl': lvl, 'set': st, 'off': off, 'secs': 30})
            name = f"L{lvl + 1} {json.dumps(st) if st else 'level setup'} off={'all' if off == keys else ','.join(off)}"
            why = []
            if len(errs) > n0: why.append('page errors: ' + ' | '.join(errs[n0:n0 + 3]))
            if r['bad']: why.append(r['bad'])
            if r['t'] < 29.9: why.append(f"stopped at {r['t']} s")
            if r['state'] not in ('PLAN', 'DRIVE', 'DONE', 'NO_PATH', 'LOST', 'IDLE'): why.append('state ' + r['state'])
            if r['state'] in ('NO_PATH', 'LOST') and not r['log']: why.append('stopped without a log line')
            text = ' '.join(r['on']).lower()
            for k in off:
                avail = next(a for kk, _, a in [tuple(x) for x in r['sensors']] if kk == k)
                if not avail: continue  # the level has none (no beacons): nothing to switch
                if any(kk == k and o for kk, o, _ in r['sensors']): why.append(f'{k} still on')
                if KEYWORD.get(k, k) not in text: why.append(f'the health does not name the missing {k}')
                if r['dots'].get(k) != 'off': why.append(f"the sensor dot for {k} is not off ({r['dots'].get(k)})")
            if st == RADAR_TRACK and off == ['lidar'] and lvl == 4:
                if not r['tracks']: why.append('radar in the tracker, lidar off: no confirmed people tracks')
                if 'tracked from the radar' not in text: why.append('radar in the tracker, lidar off: the health does not say people are tracked from the radar')
            if off == keys and 'blind' not in text: why.append('all off, and the health does not say blind')
            if off == keys and 'blind' not in r['dots']: why.append('all off, and the sensor dots do not say blind')
            print(('FAIL ' if why else 'ok   ') + name, '·', r['state'], r['done'], 'err', r['err'], 'coll', r['coll'], 'tracks', r['tracks'])
            for o in r['on']:
                if any(w in o.lower() for w in ['blind', 'odometry', 'gyro', 'lidar', 'beacon', 'gnss', 'sensors']): print('       ', o)
            if why:
                print('       WHY', why)
                for l in r['log']: print('       log', l)
                fails.append(name + ': ' + '; '.join(why))
        print('ERRORS', errs[:5])
        print('FAILS', fails)
        await b.close()
        sys.exit(1 if fails or errs else 0)
asyncio.run(main())
