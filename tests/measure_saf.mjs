// Measures what the safety lessons' Try buttons show, headless in Node (the same core as the page): for each case
// and seed, the run up to Mission complete (or secs), then the contacts with their relative speed and the lab's
// severity class, the closest approach, the wall clearance, and the leading indicators and exposure of core/safety.js;
// with them the relocalizations, the speed planner's yields, the skipped goals, and when each health check first
// turned amber or red (core/health.js, as the page's lights).
//   node tests/measure_saf.mjs '[{"name": "…", "cfg": {"level": 4, "set": {"spd": "none"}}, "seeds": [7, 1, 2], "secs": 300}]'
// cfg is a Try's cfg as the lesson writes it: level (a built-in's index or a generator spec), set and goals; a cfg seed is
// the default for seeds. With "every": n, a row every n seconds as well.
import {loadCore} from './node/core.mjs';
loadCore();
const C = globalThis.self.__core;
const cases = JSON.parse(process.argv[2] || '[]');
const f = (x, n = 2) => (x == null || !isFinite(x) ? null : +x.toFixed(n));
for (const c of cases) {
  for (const seed of c.seeds || [c.cfg.seed ?? 7]) {
    C.P.seed = seed;
    C.loadLevel(C.levelOf(c.cfg.level ?? 4));
    for (const [k, v] of Object.entries(c.cfg.set || {})) C.setParam(k, v, false);
    if (c.cfg.goals) C.setGoals(c.cfg.goals); // a Try with its own goals, as tryGo sets them
    let S = C.S;
    if ((S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') && C.WPS.length) C.startMission();
    const N = Math.round((c.secs || 300) / 0.05),
      every = c.every ? Math.round(c.every / 0.05) : 0,
      rows = [];
    for (let k = 0; k < N; k++) {
      await C.advance(1);
      S = C.S;
      if (every && k % every === every - 1) rows.push({t: f(S.t, 0), st: S.fsm.state, ped: S.collPed, gap: f(S.safe.gap), near2S: f(S.safe.near2S, 1)});
      if (S.fsm.state === 'DONE') break;
    }
    const Z = S.safe,
      ev = Z.events.map(e => `${e.t.toFixed(1)}s ${e.kind}${e.still ? '(still)' : ''} ${e.v} ${e.sev}`),
      log = re => S.log.filter(l => re.test(l.msg)).length;
    console.log(
      JSON.stringify({
        name: c.name,
        seed,
        t: f(S.t, 1),
        state: S.fsm.state,
        goals: `${C.WPS.filter(w => w.done && !w.skipped).length}/${C.WPS.length}`,
        skip: C.WPS.filter(w => w.skipped).length,
        coll: S.coll,
        ped: S.collPed,
        minPed: f(S.minPed),
        minObs: f(Z.minObs),
        nearS: f(Z.nearS, 1),
        ttcMin: f(Z.ttcMin),
        ttc1S: f(Z.ttc1S, 1),
        near2S: f(Z.near2S, 1),
        opS: f(Z.opS, 1),
        revS: f(Z.revS, 1),
        guardS: f(Z.guardS, 1),
        reloc: log(/^Relocalized/),
        yields: log(/yield/i),
        dist: f(S.dist, 1),
        ev,
        health: Object.entries(Z.health).map(([k, h]) => `${h.t}s ${k} ${h.lvl}`)
      })
    );
    for (const r of rows) console.log('   ', JSON.stringify(r));
  }
}
