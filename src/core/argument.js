/* ============================================================
   The safety argument (design §3.5; safety lesson 9): claims, the strategies that break them down, and the evidence that
   supports them, in Goal Structuring Notation, with the evidence live: each solution says what to run and what must
   hold, and the page (ui/argument.js) or Node (tools/argument.mjs) reruns it and colours the graph. Shared, so both
   judge an argument the same way.
   An argument: {format: 'nav-stack-lab-argument', version: 1, name, nodes: [{id, type, text, parent, rel, evidence}]}
   - type: goal (a claim), strategy (how a goal is broken down), solution (evidence), context, assumption, justification;
   - parent: the node it hangs from (none for the top goal); rel: 'support' (goal ← strategy ← goal ← solution) or
     'context' (context, assumption and justification, drawn beside);
   - evidence (solutions only): {kind: 'runs', level, set, seeds, secs, metric, op, value} runs a configuration at each
     seed; {kind: 'search', sheet, budget, rounds, seed, imp, metric, op, value} runs a search and reads its random half.
   A solution passes when its metric meets the bound; a goal or strategy is supported when every supporting child is,
   and fails as soon as one fails, so a red leaf shows red all the way up. Context, assumptions and justifications are
   not judged: they are what the claim leans on, made visible.
   ============================================================ */
const ARG_TYPES = ['goal', 'strategy', 'solution', 'context', 'assumption', 'justification'],
  ARG_SIDE = ['context', 'assumption', 'justification'],
  ARG_OPS = {'<=': (a, b) => a <= b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '>': (a, b) => a > b, '==': (a, b) => a === b};
// What a solution can measure: from runs (one summary per seed) or from a search's random runs
const ARG_METRICS = {
  contacts: [
    'contacts with a person, the robot moving (all seeds)',
    R => R.reduce((a, s) => a + s.events.filter(RISK_EV.contact).length, 0)
  ],
  strikes: ['strikes (all seeds)', R => R.reduce((a, s) => a + s.events.filter(RISK_EV.strike).length, 0)],
  rackSpeed: [
    'the fastest contact with a rack or wall, m/s',
    R => Math.max(0, ...R.flatMap(s => s.events.filter(e => e.kind === 'static').map(e => e.v)))
  ],
  impact: ['the fastest contact with a person, m/s', R => Math.max(0, ...R.map(s => s.impact || 0))],
  oddFirst: [
    'when the ODD monitor first saw the robot outside, s (the latest seed)',
    R => Math.max(...R.map(s => (s.oddFirst == null ? Infinity : s.oddFirst)))
  ],
  goals: ['the share of goals reached (the worst seed)', R => Math.min(...R.map(s => (s.goals ? s.goalsDone / s.goals : 1)))],
  strikeRateHi: [
    'the top of the 95 % interval of strikes per hour',
    (R, W) =>
      riskRate(
        R.map((s, i) => ({s, w: W ? W[i] : 1})),
        'strike'
      ).hi
  ],
  contactRateHi: [
    'the top of the 95 % interval of contacts per hour',
    (R, W) =>
      riskRate(
        R.map((s, i) => ({s, w: W ? W[i] : 1})),
        'contact'
      ).hi
  ]
};
// Each run's share of a solution's verdict, so a red claim leads to the runs behind it: per run, its value (v), the
// moment that matters (t, s; null when there is none) and whether it counts against the bound (bad). A count (contacts,
// strikes, and the rates built on them) is held against the bound only in total, so a run counts against it when it
// adds to the count; the other metrics are judged run by run.
const ARG_RUN = (() => {
  const count = f => s => {
      const E = s.events.filter(f);
      return {v: E.length, t: E.length ? E[0].t : null, count: true};
    },
    fastest = f => s => {
      const e = s.events.filter(f).reduce((a, x) => (!a || x.v > a.v ? x : a), null);
      return {v: e ? e.v : 0, t: e ? e.t : null};
    };
  return {
    contacts: count(RISK_EV.contact),
    strikes: count(RISK_EV.strike),
    rackSpeed: fastest(e => e.kind === 'static'),
    impact: fastest(e => e.kind === 'person'),
    oddFirst: s => ({v: s.oddFirst == null ? Infinity : s.oddFirst, t: null}),
    goals: s => ({v: s.goals ? s.goalsDone / s.goals : 1, t: null}),
    strikeRateHi: count(RISK_EV.strike),
    contactRateHi: count(RISK_EV.contact)
  };
})();
function argRuns(E, sums) {
  return sums.map((s, k) => {
    if (!s) return {k, v: null, t: null, bad: true};
    const r = ARG_RUN[E.metric](s);
    return {k, v: r.v, t: r.t, bad: r.count ? r.v > 0 : !ARG_OPS[E.op](r.v, E.value)};
  });
}
// A malformed argument says why; null when it is fine
function argError(A) {
  if (!A || A.format !== 'nav-stack-lab-argument' || !Array.isArray(A.nodes) || !A.nodes.length) return 'not an argument';
  const ids = new Set();
  for (const n of A.nodes) {
    if (!n.id || ids.has(n.id)) return `a node without an id, or a repeated one (${n.id})`;
    ids.add(n.id);
    if (!ARG_TYPES.includes(n.type)) return `node ${n.id}: a type of ${ARG_TYPES.join(', ')}`;
  }
  const tops = A.nodes.filter(n => !n.parent);
  if (tops.length !== 1 || tops[0].type !== 'goal') return 'exactly one top node, a goal';
  for (const n of A.nodes) {
    if (n.parent && !ids.has(n.parent)) return `node ${n.id}: its parent ${n.parent} is missing`;
    if (n.evidence) {
      const E = n.evidence;
      if (n.type !== 'solution') return `node ${n.id}: only a solution carries evidence`;
      if (!['runs', 'search'].includes(E.kind) || !ARG_METRICS[E.metric] || !ARG_OPS[E.op] || typeof E.value !== 'number')
        return `node ${n.id}: evidence needs kind runs or search, a metric of ${Object.keys(ARG_METRICS).join(', ')}, an op and a number`;
    }
  }
  const byId = Object.fromEntries(A.nodes.map(n => [n.id, n]));
  for (const n of A.nodes) {
    let p = n;
    for (let d = 0; p.parent; d++) {
      if (d > A.nodes.length) return `node ${n.id} is its own ancestor`;
      p = byId[p.parent];
    }
  }
  return null;
}
// The jobs a solution's evidence needs: [{level, set, seed, secs, w}] with the extra settings (your changes) on top
function argJobs(E, extra = {}) {
  if (E.kind === 'runs') {
    const lv = typeof E.level === 'object' ? genSpec(E.level) : E.level;
    return (E.seeds || [7]).map(seed => ({level: lv, set: {...(E.set || {}), ...extra}, seed, secs: E.secs || 300}));
  }
  const sh = typeof E.sheet === 'string' ? ODD_SHEETS[E.sheet] : E.sheet,
    u = makeRng((E.seed || 1) * 7919 + 17).u,
    out = [];
  for (const step of searchPlan(E.budget || 40, 0)) {
    for (const sc of searchBatch(step, [], sh, u, !!E.imp))
      out.push({level: sc.level, set: {...sc.set, ...(E.set || {}), ...extra}, seed: sc.seed, secs: E.secs || 300, w: sc.w || 1});
  }
  return out;
}
// A solution's verdict from its jobs' summaries: {value, pass, runs} (runs: argRuns, in the jobs' order)
function argVerdict(E, sums, jobs) {
  const runs = argRuns(E, sums);
  if (sums.some(s => !s)) return {value: null, pass: false, error: true, runs};
  const v = ARG_METRICS[E.metric][1](
    sums,
    jobs.map(j => j.w || 1)
  );
  return {value: v, pass: v != null && ARG_OPS[E.op](v, E.value), runs};
}
// Every node's status from the solutions' verdicts: 'pass', 'fail' or null (not run, or not judged)
function argStatus(A, verdicts) {
  const kids = id => A.nodes.filter(n => n.parent === id && !ARG_SIDE.includes(n.type)),
    memo = {};
  const st = n => {
    if (n.id in memo) return memo[n.id];
    let s = null;
    if (ARG_SIDE.includes(n.type)) s = null;
    else if (n.type === 'solution') s = verdicts[n.id] ? (verdicts[n.id].pass ? 'pass' : 'fail') : null;
    else {
      const K = kids(n.id).map(st);
      s = K.includes('fail') ? 'fail' : K.length && K.every(x => x === 'pass') ? 'pass' : null;
    }
    return (memo[n.id] = s);
  };
  for (const n of A.nodes) st(n);
  return memo;
}
// The lesson's argument: the busy floor, inside ODD-1 with people who give way
const ARG_BUILTIN = {
  format: 'nav-stack-lab-argument',
  version: 1,
  name: 'ARG-1, the busy floor with people who give way',
  nodes: [
    {id: 'G1', type: 'goal', text: 'The robot is acceptably safe on the busy floor, within ODD-1 with people who give way'},
    {
      id: 'C1',
      type: 'context',
      parent: 'G1',
      rel: 'context',
      text: 'ODD-1: generated warehouses, aisles of 2 to 3.2 m, up to four people, clear air'
    },
    {id: 'C2', type: 'context', parent: 'G1', rel: 'context', text: 'Hazards (lesson 2): striking or bumping a person, hitting a rack'},
    {id: 'A1', type: 'assumption', parent: 'G1', rel: 'context', text: 'People give way to the robot'},
    {id: 'S1', type: 'strategy', parent: 'G1', rel: 'support', text: 'Argue over each hazard, then over leaving the domain'},
    {id: 'G2', type: 'goal', parent: 'S1', rel: 'support', text: 'No contact with a person in the known scenarios'},
    {
      id: 'E1',
      type: 'solution',
      parent: 'G2',
      rel: 'support',
      text: 'The busy floor, people giving way, seeds 7 and 1 to 5: no contact with the robot moving',
      evidence: {kind: 'runs', level: 4, set: {people: 'reactive'}, seeds: [7, 1, 2, 3, 4, 5], metric: 'contacts', op: '<=', value: 0}
    },
    {id: 'G3', type: 'goal', parent: 'S1', rel: 'support', text: 'A search of the domain finds no strike'},
    {
      id: 'E2',
      type: 'solution',
      parent: 'G3',
      rel: 'support',
      text: '40 random worlds of ODD-1 with people giving way, search seed 1: no strike',
      evidence: {kind: 'search', sheet: 'ODD-1', set: {people: 'reactive'}, budget: 40, seed: 1, metric: 'strikes', op: '<=', value: 0}
    },
    {
      id: 'J1',
      type: 'justification',
      parent: 'G3',
      rel: 'context',
      text: 'About 1.3 h without a strike bounds the rate below 3 per hour (the rule of three); it does not show it is zero'
    },
    {id: 'G4', type: 'goal', parent: 'S1', rel: 'support', text: 'No contact with a rack above 0.3 m/s'},
    {
      id: 'E3',
      type: 'solution',
      parent: 'G4',
      rel: 'support',
      text: 'The same six runs: the fastest contact with a rack at most 0.3 m/s',
      evidence: {kind: 'runs', level: 4, set: {people: 'reactive'}, seeds: [7, 1, 2, 3, 4, 5], metric: 'rackSpeed', op: '<=', value: 0.3}
    },
    {id: 'G5', type: 'goal', parent: 'S1', rel: 'support', text: 'The robot notices fog, outside its domain, within 2 s'},
    {
      id: 'E4',
      type: 'solution',
      parent: 'G5',
      rel: 'support',
      text: 'The busy floor in fog with the ODD monitor: outside within 2 s',
      evidence: {
        kind: 'runs',
        level: 4,
        set: {people: 'reactive', weather: 'fog', oddMon: true},
        seeds: [7],
        secs: 30,
        metric: 'oddFirst',
        op: '<=',
        value: 2
      }
    },
    {
      id: 'A2',
      type: 'assumption',
      parent: 'G5',
      rel: 'context',
      text: 'Rain and floor grip, which the robot cannot observe, are excluded by operating rules'
    }
  ]
};
