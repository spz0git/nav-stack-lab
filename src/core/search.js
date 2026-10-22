/* ============================================================
   Scenario search (the safety lessons, docs/safety-lab.md §3.4): sample worlds from an operating domain, run them,
   and look harder near the worst. Shared by the page (Tools → Safety, ui/safety.js) and tools/search.mjs, so the same
   search seed gives the same scenarios in both.
   - An ODD sheet: a generator family and the ranges of its parameters, with the weather and the kind of people allowed.
   - A scenario: {level: a generator spec, set: run settings, seed: the run's seed}; the worker runs it as it is.
   - The margin of a run (lower is worse): minus the fastest contact's relative speed if there was a contact, else
     the smaller of the closest approach to a person and the wall clearance (core/safety.js).
   - A search: half the budget sampled at random from the sheet, the other half in refinement rounds, each perturbing
     the worst runs so far within the sheet by a shrinking step. Each batch is drawn only from the finished runs of
     the batches before it, ordered by their index, so the order the workers finish in does not matter.
   ============================================================ */
// The ranges a sheet may set: the generator's (core/worldgen.js) that change the floor and its people
const ODD_KEYS = ['aisle', 'cross', 'gaps', 'people', 'stepout'];
const ODD_SHEETS = {
  'ODD-1': {
    name: 'ODD-1, the busy floor',
    family: 'warehouse',
    like: 'L5',
    w: 24,
    h: 16,
    ranges: {aisle: [2, 3.2], people: [0, 4], stepout: [0, 0]},
    weather: ['clear'],
    people: ['scripted']
  }
};
const oddCopy = sh => JSON.parse(JSON.stringify(sh));
// A sheet as the page or a file gives it, checked: ranges inside the generator's own, at least one value of each set
function oddSheetError(sh) {
  if (!sh || typeof sh !== 'object' || !GEN_FAMILIES[sh.family]) return 'a family the generator knows';
  const lim = {...GEN_COMMON, ...GEN_FAMILIES[sh.family].params};
  for (const [k, r] of Object.entries(sh.ranges || {})) {
    if (!ODD_KEYS.includes(k) || !lim[k]) return `ranges of ${ODD_KEYS.filter(q => lim[q]).join(', ')}`;
    if (!Array.isArray(r) || r.length !== 2 || !(r[0] <= r[1]) || r[0] < lim[k][1] || r[1] > lim[k][2])
      return `${k} from ${lim[k][1]} to ${lim[k][2]}`;
  }
  if (!sh.weather || !sh.weather.length || sh.weather.some(w => !PARAM_OPTS.weather.includes(w))) return 'a weather';
  if (!sh.people || !sh.people.length || sh.people.some(w => !PARAM_OPTS.people.includes(w))) return 'a kind of people';
  return null;
}
const oddPick = (list, u) => list[Math.min(list.length - 1, Math.floor(u() * list.length))];
function searchSample(sh, u) {
  const lv = {gen: sh.family, seed: 1 + Math.floor(u() * 9999), like: sh.like, w: sh.w, h: sh.h};
  for (const [k, [lo, hi]] of Object.entries(sh.ranges)) lv[k] = lo + u() * (hi - lo);
  return {level: genSpec(lv), set: {weather: oddPick(sh.weather, u), people: oddPick(sh.people, u)}, seed: 1 + Math.floor(u() * 99)};
}
// A neighbour of a scenario: the same world seed, each range moved by up to f of its width, a new run seed half the time
function searchPerturb(sc, sh, u, f) {
  const lv = {...sc.level};
  for (const [k, [lo, hi]] of Object.entries(sh.ranges)) if (hi > lo) lv[k] = clamp(lv[k] + (2 * u() - 1) * f * (hi - lo), lo, hi);
  return {level: genSpec(lv), set: {...sc.set}, seed: u() < 0.5 ? sc.seed : 1 + Math.floor(u() * 99)};
}
function searchMargin(s) {
  if (!s) return null;
  const ev = s.events || [];
  if (ev.length) return -Math.max(...ev.map(e => e.v));
  return Math.min(s.minPed == null ? 9 : s.minPed, s.minObs == null ? 9 : s.minObs);
}
// The batches of a search with this budget: [{kind: 'random' | 'refine', n, f}]
function searchPlan(budget, rounds) {
  const B = Math.max(2, Math.round(budget)),
    R = Math.max(0, Math.round(rounds)),
    n0 = R ? Math.ceil(B / 2) : B,
    out = [{kind: 'random', n: n0, f: 0}];
  for (let i = 0; i < R; i++) {
    const n = Math.round(((B - n0) * (i + 1)) / R) - Math.round(((B - n0) * i) / R);
    if (n > 0) out.push({kind: 'refine', n, f: 0.25 / (i + 1)});
  }
  return out;
}
// The next batch's scenarios: random from the sheet, or neighbours of the worst runs so far (results: [{sc, margin}])
function searchBatch(step, results, sh, u) {
  if (step.kind === 'random') return Array.from({length: step.n}, () => searchSample(sh, u));
  const ranked = results.filter(r => r.margin != null).sort((a, b) => a.margin - b.margin || a.i - b.i),
    worst = ranked.slice(0, Math.max(3, Math.ceil(results.length / 10)));
  if (!worst.length) return Array.from({length: step.n}, () => searchSample(sh, u));
  // a neighbour that is already a run, or already in this batch, is drawn again (up to five times)
  const key = sc => JSON.stringify([sc.level, sc.set, sc.seed]),
    seen = new Set(results.map(r => key(r.sc))),
    out = [];
  for (let k = 0; k < step.n; k++) {
    let sc;
    for (let tries = 0; tries < 5; tries++) {
      sc = searchPerturb(worst[k % worst.length].sc, sh, u, step.f);
      if (!seen.has(key(sc))) break;
    }
    seen.add(key(sc));
    out.push(sc);
  }
  return out;
}
// Is the level on screen inside a sheet? One row per attribute: inside (true), outside (false), or not derivable (null)
function oddCheck(sh) {
  const g = LV.genSpec,
    walkers = LV.peds.filter(p => !p.car),
    rows = [['family', g ? g.gen : null, sh.family, g ? g.gen === sh.family : null]];
  for (const [k, [lo, hi]] of Object.entries(sh.ranges)) {
    const v = k === 'people' ? walkers.filter(p => !p.tr).length : k === 'stepout' ? walkers.filter(p => p.tr).length : g ? g[k] : null;
    rows.push([k, v, lo === hi ? `${lo}` : `${lo}–${hi}`, v == null ? null : v >= lo - 1e-9 && v <= hi + 1e-9]);
  }
  rows.push(['weather', P.weather, sh.weather.join(', '), sh.weather.includes(P.weather)]);
  rows.push(['people react', P.people, sh.people.join(', '), sh.people.includes(P.people)]);
  return rows;
}
