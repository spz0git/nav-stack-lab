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
   - Risk (lesson 8): the random runs as a sample of the domain's hours of operation. The rate of an event per hour with
     a 95 % interval, exact for plain sampling (Poisson; with no event its top is 3.7 / hours, and the one-sided claim
     "below 3 / hours" is the rule of three); with
     importance sampling (the random half drawn with more people than the sheet's uniform mix, each run weighted by how
     much likelier that mix would have drawn it) the weighted rate and a bootstrap interval over the runs. And the
     leading indicators: which per-hour measure ranks the runs as their contacts per hour do (Spearman).
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
// imp: importance sampling, the people drawn from q(x) = 2x over their range (x from 0 to 1) instead of uniformly, and
// the scenario carries its weight w = p / q = 1 / (2x), the continuous draw's (unbiased for whatever the run's outcome
// depends on, though the generator rounds the count); x is clipped at 0.05 so that no weight exceeds 10, which moves a
// quarter of a percent of the draws. Without imp the draws are the same as they always were
function searchSample(sh, u, imp) {
  const lv = {gen: sh.family, seed: 1 + Math.floor(u() * 9999), like: sh.like, w: sh.w, h: sh.h};
  let w = 1;
  for (const [k, [lo, hi]] of Object.entries(sh.ranges)) {
    if (imp && k === 'people' && hi > lo) {
      const x = Math.max(0.05, Math.sqrt(u()));
      lv[k] = lo + x * (hi - lo);
      w = 1 / (2 * x);
    } else lv[k] = lo + u() * (hi - lo);
  }
  const sc = {level: genSpec(lv), set: {weather: oddPick(sh.weather, u), people: oddPick(sh.people, u)}, seed: 1 + Math.floor(u() * 99)};
  if (imp) sc.w = +w.toFixed(4);
  return sc;
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
function searchBatch(step, results, sh, u, imp) {
  if (step.kind === 'random') return Array.from({length: step.n}, () => searchSample(sh, u, imp));
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
// ---- risk (lesson 8) ----
// What counts: a contact with a person while the robot moves (a person walking into the stopped robot is not its
// impact), a strike among those, or any contact the robot makes (racks included)
const RISK_EV = {
  contact: e => e.kind === 'person' && !e.still,
  strike: e => e.kind === 'person' && !e.still && e.sev === 'strike',
  any: e => e.kind !== 'person' || !e.still
};
// P(X ≤ k) for a Poisson count of mean m
function poissonCdf(k, m) {
  if (m <= 0) return 1;
  let t = Math.exp(-m),
    s = t;
  for (let i = 1; i <= k; i++) {
    t *= m / i;
    s += t;
  }
  return Math.min(1, s);
}
// The exact (Garwood) 95 % interval of a Poisson mean from k events: [m with P(X ≥ k) = 0.025, m with P(X ≤ k) = 0.025]
function poissonCI(k) {
  const solve = (f, lo, hi) => {
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (f(m)) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  };
  const top = k + 10 + 10 * Math.sqrt(k + 1);
  return [k ? solve(m => 1 - poissonCdf(k - 1, m) >= 0.025, 0, top) : 0, solve(m => poissonCdf(k, m) <= 0.025, 0, top)];
}
// The rate of an event per hour over the runs [{s, w}] (s: a run's summary; w: its importance weight, 1 by default):
// {n, k (events counted), hours, rate, lo, hi, weighted}. Hours are the time the mission ran (opS).
function riskRate(runs, ev = 'contact') {
  const f = RISK_EV[ev],
    rows = runs.filter(r => r.s).map(r => ({w: r.w || 1, k: (r.s.events || []).filter(f).length, h: (r.s.opS || 0) / 3600}));
  const n = rows.length,
    k = rows.reduce((a, r) => a + r.k, 0),
    hours = rows.reduce((a, r) => a + r.h, 0),
    weighted = rows.some(r => r.w !== 1),
    out = {n, k, hours: +hours.toFixed(3), weighted};
  if (!n || !hours) return {...out, rate: null, lo: null, hi: null};
  if (!weighted) {
    const [a, b] = poissonCI(k);
    return {...out, rate: k / hours, lo: a / hours, hi: b / hours};
  }
  const ratio = R => {
    const W = R.reduce((a, r) => a + r.w * r.h, 0);
    return W ? R.reduce((a, r) => a + r.w * r.k, 0) / W : 0;
  };
  const rate = ratio(rows);
  if (!k) {
    // no event at all: the rule of three on the weighted sample's effective hours
    const Wh = rows.reduce((a, r) => a + r.w * r.h, 0),
      W2h = rows.reduce((a, r) => a + r.w * r.w * r.h, 0);
    return {...out, rate: 0, lo: 0, hi: poissonCI(0)[1] / ((Wh * Wh) / W2h)};
  }
  const u = mulberry32(12345),
    bs = [];
  for (let b = 0; b < 1000; b++) bs.push(ratio(rows.map(() => rows[Math.floor(u() * n)])));
  bs.sort((a, b) => a - b);
  return {...out, rate, lo: bs[25], hi: bs[974]};
}
// The hours with no event that a target rate needs, claimed at 95 %: −ln 0.05 ≈ 3.0 over the target (the rule of three,
// a one-sided bound; the two-sided interval's top for no event is 3.7 over the hours)
const riskHoursFor = target => -Math.log(0.05) / target;
// Leading indicators: per run, each candidate per hour of operation (the closest approach as it is, lower being worse),
// ranked against the run's contacts per hour; Spearman's ρ, highest first
const SPI_CAND = {
  nearS: ['seconds under 0.3 m of a person, per hour', s => s.nearS],
  ttc1S: ['seconds with a time to contact under 1 s, per hour', s => s.ttc1S],
  near2S: ['seconds with a person within 2 m, per hour', s => s.near2S],
  minPed: ['closest approach to a person (lower is worse)', s => (s.minPed == null ? null : -s.minPed), true],
  guardS: ['seconds the safety stop capped the speed, per hour', s => s.guardS],
  brakes: ['emergency brake stops, per hour', s => s.brakes]
};
function spearman(x, y) {
  const rank = v => {
    const ix = v.map((a, i) => [a, i]).sort((a, b) => a[0] - b[0]),
      r = new Array(v.length);
    for (let i = 0; i < ix.length;) {
      let j = i;
      while (j + 1 < ix.length && ix[j + 1][0] === ix[i][0]) j++;
      for (let q = i; q <= j; q++) r[ix[q][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const a = rank(x),
    b = rank(y),
    n = x.length,
    ma = a.reduce((p, q) => p + q, 0) / n,
    mb = b.reduce((p, q) => p + q, 0) / n;
  let sab = 0,
    saa = 0,
    sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}
function spiTable(runs) {
  const R = runs.filter(r => r.s && r.s.opS > 0),
    y = R.map(r => (r.s.events || []).filter(RISK_EV.contact).length / (r.s.opS / 3600)),
    out = [];
  for (const [id, [label, get, raw]] of Object.entries(SPI_CAND)) {
    const v = R.map(r => {
      const x = get(r.s);
      return x == null ? null : raw ? x : x / (r.s.opS / 3600);
    });
    const ok = v.map((x, i) => (x == null ? -1 : i)).filter(i => i >= 0);
    if (ok.length < 5 || new Set(ok.map(i => v[i])).size < 2) continue;
    const rho = spearman(
      ok.map(i => v[i]),
      ok.map(i => y[i])
    );
    if (rho != null) out.push({id, label, rho: +rho.toFixed(2), n: ok.length});
  }
  return out.sort((a, b) => b.rho - a.rho);
}
