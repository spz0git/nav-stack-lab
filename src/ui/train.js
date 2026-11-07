/* ============================================================
   Train (Tools → Train): retrain the learned blocks in the page. Pick the block, describe the data as a list of
   sources (a map, its goals, how many runs), collect it headless in workers (core/dataset.js), pick a network and
   train it in workers (core/nn-train.js), compare it with the built-in model on the same held-out run, save it and
   drive with it. Trained models are kept in this browser (IndexedDB, guarded: a browser that blocks storage keeps
   them until the page closes); the data is not kept. Perceive and Plan pick the model (P.detModel, P.predModel, P.polModel).
   ============================================================ */
const TRN_BLOCKS = {
  detector: {name: 'People detector', unit: 'scans', prefix: 'det', use: {agents: 'learned'}, key: 'detModel', tab: 'per'},
  predictor: {name: 'People predictor', unit: 'samples', prefix: 'prd', use: {agPred: 'learned'}, key: 'predModel', tab: 'per'},
  policy: {name: 'End-to-end policy', unit: 'samples', prefix: 'pol', use: {plan: 'policy'}, key: 'polModel', tab: 'plan'}
};
// the learned blocks that need people on the map
const trnPeople = block => block !== 'policy';
const TRN = {
  block: 'detector',
  rows: {detector: null, predictor: null, policy: null}, // the data sources, made on first view
  arch: {detector: 'builtin', predictor: 'builtin', policy: 'builtin'},
  init: {detector: 'random', predictor: 'random', policy: 'random'},
  hp: {
    detector: {epochs: 20, lr: 0.002, batch: 64},
    predictor: {epochs: 30, lr: 0.002, batch: 256},
    policy: {epochs: 40, lr: 0.001, batch: 256}
  },
  job: null, // {kind: 'collect' | 'train', done, total, stop, text}
  curve: [], // per finished epoch: {epoch, loss, ev, ms}
  curveBlock: null, // the block the curve belongs to
  result: null, // the model just trained, not yet saved
  baseEv: null, // the built-in model (and the starting model) on the held-out run of the last training
  compare: null, // every model of the block on the current held-out run
  models: [], // saved models, oldest first
  stored: null, // true: IndexedDB works; false: models last only while the page is open
  mapName: '',
  delArm: null
};
// one data source: a map (a level, the map on screen, a saved setup, a custom level or generated worlds), its goals, the runs
function trnRow(block, level, o) {
  const L = LEVELS[level];
  return {
    level, // a built-in level's index, or -1 for a custom level (lvRef) or generated worlds (gen)
    label: L ? `${L.id} ${L.name}` : '',
    cfg: null, // the map on screen or a saved setup: {map, mapAdd, mapDel, goals}
    lvRef: null, // a custom level: its JSON (core/levels.js) or its generator spec
    gen: null, // generated worlds: a generator spec whose seed is each run's, so that every run has a world of its own
    random: 0, // random obstacles on an empty floor, a new layout every run (0: the map as it is)
    goals: block === 'policy' ? 'random' : 'map',
    nGoals: 6,
    runs: 4,
    seed0: 101, // the built-in models were trained on seeds 1–16 of the levels: a fair test needs others
    secs: block === 'detector' ? 60 : 150,
    people: 'alt',
    noise: 0.4,
    driver: 'expert',
    data: null,
    ...o
  };
}
const trnLevel = id => LEVELS.findIndex(L => L.id === id);
// what a source's map is, for its notes: the level, the custom level, or for generated worlds what every one of them has
function trnLv(r) {
  if (r.gen) return {peds: r.gen.people ? [0] : [], cfg: LEVELS.find(L => L.id === r.gen.like).cfg, wps: new Array(r.gen.goals)};
  return r.lvRef != null ? levelOf(r.lvRef) : LEVELS[r.level];
}
// the generator settings of the level menu's Generate form (ui/levelmenu.js) for one family; the blocks that learn from
// people get some when the form has none
function trnGen(block, fam) {
  const g = genSpec({...CUST.gen, gen: fam});
  if (trnPeople(block) && !g.people) return genSpec({...g, people: 4, like: g.like === 'L2' ? 'L5' : g.like});
  return g;
}
function trnDefaultRows(block) {
  if (trnPeople(block))
    return LEVELS.map((L, i) => i)
      .filter(i => (LEVELS[i].peds || []).length)
      .map(i => trnRow(block, i));
  return LEVELS.map((L, i) => i)
    .filter(i => !(LEVELS[i].peds || []).length && LEVELS[i].cfg.model !== 'car')
    .map(i => trnRow(block, i, {runs: 2}));
}
// the recipe the built-in model was trained with (training/*/README.md), as sources
function trnRecipe(block) {
  if (block === 'detector') return trnDefaultRows(block).map(r => ({...r, runs: 8, secs: 120, seed0: 1}));
  if (block === 'predictor') return trnDefaultRows(block).map(r => ({...r, runs: 22, secs: 150, seed0: 21}));
  return trnDefaultRows(block).map(r => ({...r, runs: 8, secs: 150, noise: 0.4, seed0: 1}));
}
const trnRows = () => TRN.rows[TRN.block] || (TRN.rows[TRN.block] = trnDefaultRows(TRN.block));
const trnModels = block => TRN.models.filter(m => m.block === block);

/* ---------- keeping models in this browser (and the custom levels, ui/levelmenu.js: store 'levels'; the safety lab's
   arguments, sheets and sets, ui/argument.js: store 'safety') ---------- */
let trnDB = null;
function trnOpenDB() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('nav-stack-lab', 3);
      r.onupgradeneeded = () => {
        for (const n of ['models', 'levels', 'safety'])
          if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, {keyPath: 'id'});
      };
      r.onsuccess = () => res(r.result);
      r.onerror = r.onblocked = () => res(null);
    } catch (_) {
      res(null);
    }
  });
}
async function trnDBdo(op, val, store = 'models') {
  if (!trnDB) trnDB = await trnOpenDB();
  if (!trnDB) return null;
  return new Promise(res => {
    try {
      const st = trnDB.transaction(store, op === 'all' ? 'readonly' : 'readwrite').objectStore(store),
        rq = op === 'all' ? st.getAll() : op === 'put' ? st.put(val) : st.delete(val);
      rq.onsuccess = () => res(op === 'all' ? rq.result : true);
      rq.onerror = () => res(null);
    } catch (_) {
      res(null);
    }
  });
}
async function trnLoad() {
  const all = await trnDBdo('all');
  TRN.stored = !!all;
  for (const m of all || []) {
    if (TRN.models.some(x => x.id === m.id)) continue;
    TRN.models.push(m);
    USER_MODELS[m.id] = m;
  }
  TRN.models.sort((a, b) => a.created - b.created);
  if (all && all.length && ['train', 'per', 'plan', 'exp'].includes(activeTab)) renderAllPanes();
}
async function trnSave(m) {
  TRN.models = TRN.models.filter(x => x.id !== m.id).concat([m]);
  USER_MODELS[m.id] = m;
  TRN.stored = !!(await trnDBdo('put', m));
}
async function trnDelete(id) {
  const m = USER_MODELS[id];
  TRN.models = TRN.models.filter(x => x.id !== id);
  delete USER_MODELS[id];
  await trnDBdo('delete', id);
  if (m && P[TRN_BLOCKS[m.block].key] === id) setParam(TRN_BLOCKS[m.block].key, 'builtin', false);
}
function trnNewId(block) {
  const p = TRN_BLOCKS[block].prefix;
  let n = 1;
  while (USER_MODELS[`${p}${n}`]) n++;
  return `${p}${n}`;
}
// The model picker's options in Perceive and Plan (and the values Experiments can vary)
const trnOpts = block => [['builtin', 'Built-in'], ...trnModels(block).map(m => [m.id, esc(m.label)])];

/* ---------- describing a model ---------- */
const pct = v => (100 * v).toFixed(1) + ' %';
function trnArchText(m) {
  if (m.layers[0].type === 'conv1d') return m.layers.map(L => `${L.cout}×k${L.k}`).join(' → ');
  // (the predictor's last layer: K logits and K futures)
  return [m.layers[0].nin, ...m.layers.map(L => L.nout)].join(' → ');
}
function trnEvText(block, ev) {
  if (!ev) return '—';
  if (block === 'predictor')
    return `error at 1 s ${ev.top[0].toFixed(2)} m, at 2 s ${ev.top[1].toFixed(2)} m (constant velocity ${ev.cv[0].toFixed(2)}, ${ev.cv[1].toFixed(2)})`;
  return block === 'detector'
    ? `precision ${pct(ev.precision)}, recall ${pct(ev.recall)}, F1 ${ev.f1.toFixed(3)}`
    : `RMS ${ev.rms.toFixed(2)} m (first waypoint ${ev.perWp[0].toFixed(2)}, last ${ev.perWp[POLICY_N - 1].toFixed(2)})${ev.K > 1 ? `, best of ${ev.K} ${ev.best.toFixed(2)} m` : ''}`;
}
// one number to rank by: F1 for the detector (higher is better), the RMS error for the policy, the error at 2 s for the
// predictor (lower)
const trnScore = (block, ev) => (ev ? (block === 'detector' ? ev.f1 : block === 'predictor' ? ev.top[1] : ev.rms) : null);
const trnScoreName = block => (block === 'detector' ? 'F1' : block === 'predictor' ? 'error at 2 s' : 'RMS error');
function sameShape(a, b) {
  return (
    a.layers.length === b.layers.length &&
    a.layers.every((L, i) => {
      const M = b.layers[i];
      return L.type === M.type && L.cin === M.cin && L.cout === M.cout && L.k === M.k && L.nin === M.nin && L.nout === M.nout;
    })
  );
}
function trnHidden(block, arch) {
  return NN_ARCH[block].find(a => a[0] === arch)[2];
}
function trnShapeModel(block) {
  return nnInit(block, trnHidden(block, TRN.arch[block]), 1);
}

// Did the built-in model train on this run? The detector lists its runs; the policy was trained on L1–L4 (no people, not
// the car) with seeds 1–8 (expert) and 11–16 (DAgger), as training/policy/README.md says. Only an unedited level counts.
function builtinSaw(block, r, seed) {
  if (!r || r.cfg || r.random || r.gen || r.lvRef != null) return false;
  const id = LEVELS[r.level].id,
    M = MODELS[block];
  if (!M) return false;
  if (block !== 'policy')
    return [...(M.trained_on.runs || []), ...(block === 'predictor' ? M.held_out || [] : [])].some(x => x.level === id && x.seed === seed);
  return ['L1', 'L2', 'L3', 'L4'].includes(id) && ((seed >= 1 && seed <= 8) || (seed >= 11 && seed <= 16));
}
/* ---------- the data ---------- */
function trnSpecs(r, block) {
  const out = [];
  for (let k = 0; k < r.runs; k++)
    out.push({
      block,
      level: r.lvRef != null ? r.lvRef : r.level,
      ...(r.gen ? {gen: r.gen} : {}),
      seed: r.seed0 + k,
      secs: r.secs,
      map: r.cfg,
      randomMap: r.random,
      goals: r.goals === 'random' ? {random: r.nGoals} : 'level',
      people: r.people,
      noise: r.noise,
      driver: r.driver,
      polModel: P.polModel
    });
  return out;
}
// every collected run in source order; the held-out run is the last run of the first source that has data
function trnAssemble(block) {
  const rows = (TRN.rows[block] || []).filter(r => r.data),
    NF = block === 'detector' ? NBEAM * DET_CH : block === 'predictor' ? PRED_NF : NBEAM + 19,
    NY = block === 'detector' ? NBEAM : block === 'predictor' ? 2 * PRED_H.length : 2 * POLICY_N;
  if (!rows.length) return null;
  const runs = rows.flatMap((r, ri) => r.data.runs.map(d => ({...d, ri, label: r.label}))),
    holdI = runs.length > 1 ? rows[0].data.runs.length - 1 : -1,
    train = runs.filter((_, i) => i !== holdI),
    hold = holdI >= 0 ? runs[holdI] : runs[0],
    n = train.reduce((a, d) => a + d.n, 0),
    X = new Float32Array(n * NF),
    Y = block === 'detector' ? new Uint8Array(n * NY) : new Float32Array(n * NY);
  let o = 0,
    pos = 0;
  for (const d of train) {
    X.set(d.x, o * NF);
    Y.set(d.y, o * NY);
    o += d.n;
    pos += d.positives;
  }
  hold.builtinSaw = builtinSaw(block, rows[hold.ri], hold.seed);
  return {
    X,
    Y,
    n,
    NF,
    NY,
    pos,
    hold,
    holdSeparate: holdI >= 0,
    runs: train.map(d => ({map: d.label, seed: d.seed, [TRN_BLOCKS[block].unit]: d.n}))
  };
}
function trnDataLine(block) {
  const rows = TRN.rows[block] || [],
    got = rows.filter(r => r.data);
  if (!got.length) return 'No data yet: collect the sources above.';
  const runs = got.reduce((a, r) => a + r.data.runs.length, 0),
    n = got.reduce((a, r) => a + r.data.n, 0),
    pos = got.reduce((a, r) => a + r.data.positives, 0),
    h = got[0].data.runs[got[0].data.runs.length - 1],
    mb =
      (n *
        (block === 'detector' ? NBEAM * 25 : block === 'predictor' ? (PRED_NF + 2 * PRED_H.length) * 4 : (NBEAM + 19 + 2 * POLICY_N) * 4)) /
      1e6;
  return `${runs} run${runs === 1 ? '' : 's'}, ${n} ${TRN_BLOCKS[block].unit}${block === 'detector' ? ` (${pct(pos / Math.max(1, n * NBEAM))} of the beams on a person)` : ''}, ${mb.toFixed(mb < 10 ? 1 : 0)} MB in memory. ${runs > 1 ? `Held out for testing: the last run of the first source (${got[0].label}, seed ${h.seed}, ${h.n} ${TRN_BLOCKS[block].unit}).` : 'One run only: the numbers below are on the training data itself; collect at least two runs to test on one the network has not seen.'}`;
}

/* ---------- workers ---------- */
const trnWorkers = () => Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
function trnCall(w, msg, transfer) {
  return new Promise(res => {
    w.onmessage = e => {
      const d = e.data;
      if (d.progress != null) return;
      if (d.done) res(d);
    };
    w.onerror = e => res({error: e.message || 'worker error'});
    w.postMessage(msg, transfer || []);
  });
}
async function trnCollect() {
  const block = TRN.block,
    rows = trnRows().filter(r => !r.data),
    jobs = rows.flatMap(r => trnSpecs(r, block).map((spec, k) => ({r, k, spec})));
  if (!jobs.length || TRN.job) return;
  if (jobs.some(j => j.spec.driver === 'policy') && P.polModel !== 'builtin' && !USER_MODELS[P.polModel]) return;
  const models = jobs.some(j => j.spec.driver === 'policy') ? USER_MODELS : undefined,
    got = new Map(rows.map(r => [r, []]));
  TRN.job = {kind: 'collect', done: 0, total: jobs.length, stop: false};
  renderAllPanes();
  const queue = jobs.slice(),
    nW = Math.min(trnWorkers(), jobs.length);
  let err = null;
  await Promise.all(
    Array.from({length: nW}, async () => {
      const w = makeCoreWorker();
      try {
        while (queue.length && !TRN.job.stop) {
          const j = queue.shift(),
            d = await trnCall(w, {cmd: 'collect', id: j.k, spec: j.spec, models});
          if (d.error) err = d.error;
          else got.get(j.r).push({...d.data, seed: j.spec.seed, k: j.k});
          TRN.job.done++;
          trnProgress(`Collecting: ${TRN.job.done} of ${jobs.length} runs`);
        }
      } finally {
        w.terminate();
      }
    })
  );
  for (const [r, runs] of got) {
    if (runs.length < r.runs) continue; // stopped or failed part-way: the source stays uncollected
    runs.sort((a, b) => a.k - b.k);
    r.data = {runs, n: runs.reduce((a, d) => a + d.n, 0), positives: runs.reduce((a, d) => a + d.positives, 0)};
  }
  const stopped = TRN.job.stop;
  TRN.job = null;
  TRN.compare = null;
  logE(
    err ? `Train: a collection run failed: ${err.split('\n')[0]}` : `Train: ${stopped ? 'collection stopped' : 'data collected'}`,
    err ? 'warn' : 'ok'
  );
  if (activeTab === 'train') renderAllPanes();
}
// training split over workers: each holds a contiguous shard of the training set and returns the gradient summed
// over the batch's samples in its shard; the page adds them and takes the Adam step (nnTrain)
async function trnTrain() {
  const block = TRN.block,
    ds = trnAssemble(block);
  if (!ds || TRN.job || !ds.n) return;
  const hp = TRN.hp[block],
    hidden = trnHidden(block, TRN.arch[block]),
    fresh = nnInit(block, hidden, 1),
    initId = TRN.init[block],
    from = initId === 'builtin' ? MODELS[block] : initId !== 'random' ? USER_MODELS[initId] : null,
    model =
      from && sameShape(from, fresh)
        ? {...fresh, layers: from.layers.map(L => ({...L, w: Float32Array.from(L.w), b: Float32Array.from(L.b)}))}
        : fresh,
    pos = ds.pos / Math.max(1, ds.n * NBEAM),
    task =
      block === 'detector'
        ? {loss: 'bce', n: NBEAM, posW: pos > 0 ? Math.sqrt((1 - pos) / pos) : 1}
        : block === 'predictor'
          ? {loss: 'mix', n: 1, K: PRED_K, ny: 2 * PRED_H.length, sigma: PRED_SIG}
          : {loss: 'mix', n: 1, K: POLICY_K, ny: 2 * POLICY_N, sigma: POLICY_SIG},
    nW = Math.max(1, Math.min(trnWorkers(), Math.floor(ds.n / 32) || 1)),
    workers = Array.from({length: nW}, makeCoreWorker),
    cut = Array.from({length: nW + 1}, (_, i) => Math.round((i * ds.n) / nW));
  TRN.job = {kind: 'train', done: 0, total: hp.epochs, stop: false, t0: Date.now()};
  TRN.curve = [];
  TRN.curveBlock = block;
  TRN.result = null;
  TRN.baseEv = null;
  renderAllPanes();
  let result = null;
  try {
    await Promise.all(
      workers.map((w, i) =>
        trnCall(w, {
          cmd: 'tdata',
          X: ds.X.slice(cut[i] * ds.NF, cut[i + 1] * ds.NF),
          Y: ds.Y.slice(cut[i] * ds.NY, cut[i + 1] * ds.NY),
          model: fresh,
          task
        })
      )
    );
    const hx = ds.hold.x,
      hy = ds.hold.y,
      evalOn = async m => (await trnCall(workers[0], {cmd: 'teval', model: m, X: hx, Y: hy, block})).ev;
    TRN.baseEv = {
      builtin: MODELS[block] ? await evalOn(MODELS[block]) : null,
      start: from ? await evalOn(model) : null,
      startLabel: from ? (initId === 'builtin' ? 'Built-in' : from.label) : null
    };
    trnProgress('Training: epoch 1 of ' + hp.epochs);
    result = await nnTrain({
      model,
      nTrain: ds.n,
      epochs: hp.epochs,
      batch: hp.batch,
      lr: hp.lr,
      seed: 1,
      grad: async (wv, idx) => {
        const parts = Array.from({length: nW}, () => []);
        for (const s of idx) {
          let i = 0;
          while (s >= cut[i + 1]) i++;
          parts[i].push(s - cut[i]);
        }
        const rs = await Promise.all(
          parts.map((p, i) => (p.length ? trnCall(workers[i], {cmd: 'tgrad', w: wv, idx: Int32Array.from(p)}) : null))
        );
        let g = null,
          loss = 0,
          count = 0;
        for (const r of rs) {
          if (!r) continue;
          if (r.error) throw new Error(r.error);
          if (!g) g = r.g;
          else for (let q = 0; q < g.length; q++) g[q] += r.g[q];
          loss += r.loss;
          count += r.count;
        }
        return {g, loss, count};
      },
      evaluate: evalOn,
      shouldStop: () => TRN.job.stop,
      onStep: f => {
        const J = TRN.job,
          el = $('#trn-bar');
        J.done = f;
        if (el) el.style.width = (100 * f) / J.total + '%';
      },
      onEpoch: info => {
        TRN.curve.push({epoch: info.epoch, loss: info.loss, ev: info.ev, ms: info.ms});
        TRN.result = info.model;
        const left = ((Date.now() - TRN.job.t0) / info.epoch) * (hp.epochs - info.epoch);
        trnProgress(
          `Epoch ${info.epoch} of ${hp.epochs}: loss ${info.loss.toFixed(4)}, held out ${trnEvText(block, info.ev)}${info.epoch < hp.epochs ? ` · about ${Math.ceil(left / 1000)} s left` : ''}`
        );
        trnDrawCurve();
      }
    });
  } catch (e) {
    logE('Train: training failed: ' + (e.message || e), 'warn');
  } finally {
    workers.forEach(w => w.terminate());
  }
  const stopped = TRN.job.stop;
  TRN.job = null;
  if (TRN.curve.length && (result || TRN.result)) {
    const m = TRN.result,
      last = TRN.curve[TRN.curve.length - 1],
      A = NN_ARCH[block].find(a => a[0] === TRN.arch[block]);
    TRN.result = {
      ...m,
      block,
      arch: A[0],
      archLabel: A[1],
      params: nnCount(m.layers),
      output: MODELS[block] ? MODELS[block].output : '',
      trained_on: {[TRN_BLOCKS[block].unit]: ds.n, runs: ds.runs},
      held_out: {
        map: ds.hold.label,
        seed: ds.hold.seed,
        [TRN_BLOCKS[block].unit]: ds.hold.n,
        separate: ds.holdSeparate,
        builtinSaw: ds.hold.builtinSaw
      },
      ev: last.ev,
      baseEv: TRN.baseEv,
      start: initId === 'random' ? 'random weights' : TRN.baseEv.startLabel || 'random weights',
      epochs: last.epoch,
      hp: {...hp},
      label: `${A[1]} · ${ds.n} ${TRN_BLOCKS[block].unit} · ${new Date().toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}`
    };
    if (block === 'detector') Object.assign(TRN.result, {threshold: DET_THR, minBeams: DET_MIN});
    if (block === 'predictor') Object.assign(TRN.result, {K: PRED_K, horizon: PRED_H, sigma: PRED_SIG});
    if (block === 'policy') Object.assign(TRN.result, {K: POLICY_K, sigma: POLICY_SIG});
    // the statistics of its own training inputs, for its out-of-distribution score (core/learnmon.js)
    const descs = [];
    for (let i = 0; i < ds.n; i++) descs.push(oodDesc(block, ds.X.subarray(i * ds.NF, (i + 1) * ds.NF)));
    if (descs.length) TRN.result.ref = {...oodRef(descs), from: 'its training data'};
    logE(
      `Train: ${TRN_BLOCKS[block].name.toLowerCase()} trained for ${last.epoch} epoch${last.epoch === 1 ? '' : 's'}${stopped ? ' (stopped)' : ''}: ${trnEvText(block, last.ev)}`,
      'ok'
    );
  } else TRN.result = null;
  if (activeTab === 'train') renderAllPanes();
}
// every model of the block on the current held-out run, one table
async function trnCompare() {
  const block = TRN.block,
    ds = trnAssemble(block);
  if (!ds || TRN.job) return;
  const w = makeCoreWorker(),
    list = [['builtin', 'Built-in', MODELS[block]], ...trnModels(block).map(m => [m.id, m.label, m])].filter(x => x[2]);
  TRN.job = {kind: 'compare', done: 0, total: list.length, stop: false};
  trnProgress('Testing every model on the held-out run…');
  const out = [];
  try {
    for (const [id, label, m] of list) {
      const r = await trnCall(w, {cmd: 'teval', model: m, X: ds.hold.x, Y: ds.hold.y, block});
      out.push({id, label, ev: r.ev || null});
    }
  } finally {
    w.terminate();
  }
  TRN.job = null;
  TRN.compare = {block, hold: `${ds.hold.label}, seed ${ds.hold.seed}`, saw: ds.hold.builtinSaw, rows: out};
  if (activeTab === 'train') renderAllPanes();
}
function trnProgress(t) {
  const el = $('#trn-prog');
  if (el) el.textContent = t;
  if (TRN.job) TRN.job.text = t;
  const bar = $('#trn-bar');
  if (bar && TRN.job) bar.style.width = (100 * TRN.job.done) / Math.max(1, TRN.job.total) + '%';
}
// a model as the JSON file the build inlines (src/models/<block>.json), with its weights rounded to 5 decimals
function trnJSON(m) {
  const r5 = a => Array.from(a, v => Math.round(v * 1e5) / 1e5);
  return JSON.stringify({
    name: m.block,
    label: m.label,
    input: m.input,
    output: m.output,
    params: m.params,
    ...(m.threshold ? {threshold: m.threshold} : {}),
    ...(m.minBeams ? {minBeams: m.minBeams} : {}),
    ...(m.K ? {K: m.K, horizon: m.horizon, sigma: m.sigma} : {}),
    trained_on: m.trained_on,
    held_out: m.held_out,
    trained_in: 'Nav Stack Lab, Tools → Train',
    layers: m.layers.map(L => ({...L, w: r5(L.w), b: r5(L.b)}))
  });
}
function trnImport(text) {
  const j = JSON.parse(text),
    dense = j.layers && j.layers[0] && j.layers[0].type === 'dense',
    block =
      j.name === 'predictor' || (dense && j.layers[0].nin === PRED_NF) ? 'predictor' : j.name === 'policy' || dense ? 'policy' : 'detector',
    want = nnInit(block, trnHidden(block, 'builtin'), 1).layers;
  if (!Array.isArray(j.layers) || !j.layers.length) throw new Error('no layers');
  const L0 = j.layers[0],
    Ln = j.layers[j.layers.length - 1];
  if (
    block === 'detector'
      ? L0.type !== 'conv1d' || L0.cin !== want[0].cin || Ln.cout !== 1
      : L0.nin !== want[0].nin || (Ln.nout !== want[want.length - 1].nout && !(block === 'policy' && Ln.nout === 2 * POLICY_N)) // a single-path policy still runs
  )
    throw new Error(`the layers do not fit the ${TRN_BLOCKS[block].name.toLowerCase()}'s inputs and outputs`);
  for (const L of j.layers) {
    const nw = L.type === 'conv1d' ? L.cout * L.cin * L.k : L.nout * L.nin;
    if (!Array.isArray(L.w) || L.w.length !== nw || !Array.isArray(L.b) || L.b.length !== (L.cout || L.nout))
      throw new Error('a layer has the wrong number of weights');
  }
  const layers = j.layers.map(L => ({...L, w: Float32Array.from(L.w), b: Float32Array.from(L.b)})),
    id = trnNewId(block);
  return {
    ...j,
    id,
    block,
    name: block,
    layers,
    params: nnCount(layers),
    label: j.label || `Imported ${id}`,
    archLabel: 'imported',
    created: Date.now(),
    input: j.input || NN_IN[block]
  };
}

/* ---------- the pane ---------- */
function trnRowHTML(r, i, block) {
  const n = i,
    opt = (v, l, sel) => `<option value="${v}" ${sel ? 'selected' : ''}>${l}</option>`,
    setups = setupsLoad(),
    mapOpts =
      LEVELS.map((L, li) => opt('L' + li, `${L.id} ${esc(L.name)}`, !r.cfg && !r.gen && r.lvRef == null && r.level === li)).join('') +
      Object.entries(GEN_FAMILIES)
        .map(([k, F]) => opt('G' + k, `Generated: ${F.name.toLowerCase()}, a new world every run`, !!r.gen && r.gen.gen === k))
        .join('') +
      opt(
        'screen',
        `The map on screen now (${LV.id}${idList(P.mapAdd).length || idList(P.mapDel).length || P.map === 'empty' ? ', edited' : ''})`,
        false
      ) +
      setups.map((s, si) => opt('S' + si, 'Saved: ' + esc(s.name), false)).join('') +
      (r.cfg || r.lvRef != null ? opt('keep', esc(r.label), true) : ''),
    num = (f, v, lo, hi, step, w) =>
      `<input type="number" data-trow="${n}" data-f="${f}" value="${v}" min="${lo}" max="${hi}" step="${step || 1}"${w ? ` style="width:${w}px"` : ''}>`,
    st = r.data
      ? `<span class="trn-ok">Collected: ${r.data.runs.length} runs, ${r.data.n} ${TRN_BLOCKS[block].unit}${block === 'detector' ? `, ${pct(r.data.positives / Math.max(1, r.data.n * NBEAM))} person beams` : block === 'predictor' ? ' (tracked people near a person, with where they went)' : ''}${r.data.runs.some(d => d.goals) ? `, goals reached ${r.data.runs.reduce((a, d) => a + d.goalsDone, 0)}/${r.data.runs.reduce((a, d) => a + d.goals, 0)}` : ''}</span>`
      : '<span class="lbl">Not collected</span>',
    warn =
      block === 'detector' && !(trnLv(r).peds || []).length
        ? '<p class="lbl">No people on this map: every beam is labelled static (it teaches the network what is not a person).</p>'
        : block === 'predictor' && !(trnLv(r).peds || []).length
          ? '<p class="lbl">No people on this map: it gives no samples.</p>'
          : r.gen
            ? `<p class="lbl">${r.gen.w} × ${r.gen.h} m, ${r.gen.people} people, the settings of ${r.gen.like}: the level menu's Generate form sets these (pick the source again after changing it). Run k has the world of seed ${r.seed0} + k.</p>`
            : block === 'policy' && trnLv(r).cfg.model === 'car'
              ? '<p class="lbl">A car level: the policy is a robot that turns on the spot; its paths may not suit the car.</p>'
              : '';
  return `<div class="trn-src" data-sys="${block === 'policy' ? 'plan' : 'per'}">
  <div class="trn-srchead"><select class="sel" data-trow="${n}" data-f="map" aria-label="Map of source ${n + 1}">${mapOpts}</select><button type="button" class="ibtn sm" data-trdel="${n}" aria-label="Remove this source" title="Remove this source">×</button></div>
  <div class="exprow"><span>Goals</span><div class="seg" data-trow="${n}" data-f="goals"><button data-v="map" aria-pressed="${r.goals === 'map'}">The map's</button><button data-v="random" aria-pressed="${r.goals === 'random'}">Random</button></div>${r.goals === 'random' ? `<label>${num('nGoals', r.nGoals, 1, 12)} goals a run</label>` : `<span class="lbl">${r.cfg && r.cfg.goals ? `${r.cfg.goals.length} placed` : `${(trnLv(r).wps || []).length} of ${r.gen ? "each world's" : "the level's"}`}</span>`}</div>
  <div class="exprow"><label>${num('runs', r.runs, 1, 40)} runs</label><label>seeds from ${num('seed0', r.seed0, 1, 999)}</label><label>${num('secs', r.secs, 10, 600, 10)} s each</label><label title="Scatter boxes of 0.4–2 m on an empty floor instead of the map's obstacles, a new layout every run (the start and fixed goals are kept clear)">random obstacles ${num('random', r.random, 0, 40)}</label></div>
  ${
    trnPeople(block)
      ? `<div class="exprow"><span>People</span><div class="seg" data-trow="${n}" data-f="people"><button data-v="alt" aria-pressed="${r.people === 'alt'}">Alternate</button><button data-v="scripted" aria-pressed="${r.people === 'scripted'}">Scripted</button><button data-v="reactive" aria-pressed="${r.people === 'reactive'}">Reacting</button></div></div>`
      : `<div class="exprow"><span>Driver</span><div class="seg" data-trow="${n}" data-f="driver"><button data-v="expert" aria-pressed="${r.driver === 'expert'}">The classical stack</button><button data-v="policy" aria-pressed="${r.driver === 'policy'}" title="DAgger: the policy picked in Plan drives, the expert labels where it went">The policy in use (DAgger)</button></div><label>command noise ${num('noise', r.noise, 0, 1, 0.05, 56)}</label></div>`
  }
  ${warn}<div>${st}</div></div>`;
}
function trnModelsHTML(block) {
  const B = TRN_BLOCKS[block],
    cur = P[B.key],
    M0 = MODELS[block],
    mine = trnModels(block),
    row = (id, label, sub, ev, m) =>
      `<li><div class="trn-mname"><b>${esc(label)}</b>${cur === id || (id === 'builtin' && !USER_MODELS[cur]) ? ' <span class="trn-use">in use</span>' : ''}<span class="lbl">${sub}</span>${ev ? `<span class="lbl">Held out at training: ${trnEvText(block, ev)}</span>` : ''}</div>
      <div class="controls">${cur === id ? '' : `<button type="button" class="btn small" data-tuse="${id}">Use</button>`}${m ? `<button type="button" class="btn small" data-tdl="${id}" title="Save as JSON: the format of src/models/${block}.json, so it can become the built-in model">JSON</button><button type="button" class="btn small" data-tdel="${id}">${TRN.delArm === id ? 'Delete?' : 'Delete'}</button>` : ''}</div></li>`;
  return `<ul class="trn-models">${M0 ? row('builtin', 'Built-in', `${trnArchText(M0)} · ${M0.params} parameters · trained offline (training/${block}) on ${M0.trained_on[B.unit] || M0.trained_on.samples || M0.trained_on.scans} ${B.unit}`, null, null) : ''}${mine
    .map(m =>
      row(
        m.id,
        m.label,
        `${m.id} · ${m.archLabel || ''} ${trnArchText(m)} · ${m.params} parameters${m.trained_on ? ` · ${m.trained_on[B.unit]} ${B.unit}, ${m.epochs || '?'} epochs from ${m.start || 'random weights'}` : ''}`,
        m.ev,
        m
      )
    )
    .join('')}</ul>
  ${mine.length ? '' : `<p class="note">No trained ${{detector: 'detectors', predictor: 'predictors', policy: 'policies'}[block]} in this browser yet.</p>`}
  <div class="controls"><label class="btn small trn-file">Import JSON<input type="file" id="trn-import" accept=".json,application/json" hidden></label>${TRN.stored === false ? '<span class="lbl">This browser does not keep data for this page: trained models last until it closes (save them as JSON).</span>' : '<span class="lbl">Kept in this browser only.</span>'}</div>`;
}
function trnResultHTML(block) {
  const R = TRN.result;
  if (!R || R.block !== block) return ''; // still training, or a model of the other block
  const B = TRN.baseEv || {},
    better = (a, b) => (block === 'detector' ? a > b : a < b),
    pred = block === 'predictor',
    s = trnScore(block, R.ev),
    sb = B.builtin ? trnScore(block, B.builtin) : null,
    rows = [
      ['This model', R.ev],
      ...(B.start && B.startLabel !== 'Built-in' ? [[`Where it started (${esc(B.startLabel)})`, B.start]] : []),
      ['Built-in', B.builtin]
    ].filter(r => r[1]);
  const cols = pred
    ? ['1 s', '2 s', 'best of 3 at 2 s', 'constant velocity at 2 s'].map(c => `<th>${c}</th>`).join('')
    : block === 'detector'
      ? ['Precision', 'Recall', 'F1'].map(c => `<th>${c}</th>`).join('')
      : `<th>RMS</th>${[0, 3, 7].map(k => `<th>${((k + 1) * DS_STEP).toFixed(1)} m ahead</th>`).join('')}`;
  const cells = ev =>
    pred
      ? `<td>${ev.top[0].toFixed(2)} m</td><td>${ev.top[1].toFixed(2)} m</td><td>${ev.best[1].toFixed(2)} m</td><td>${ev.cv[1].toFixed(2)} m</td>`
      : block === 'detector'
        ? `<td>${pct(ev.precision)}</td><td>${pct(ev.recall)}</td><td>${ev.f1.toFixed(3)}</td>`
        : `<td>${ev.rms.toFixed(3)} m</td>${[0, 3, 7].map(k => `<td>${ev.perWp[k].toFixed(2)} m</td>`).join('')}`;
  return `<div class="trn-result"><h4>The new model, on the held-out run</h4>
  <div class="exptab"><table><tr><th></th>${cols}</tr>${rows.map(([l, ev]) => `<tr><td>${l}</td>${cells(ev)}</tr>`).join('')}</table></div>
  <p class="note">${sb == null ? '' : better(s, sb) ? `Better than the built-in model on this run (${trnScoreName(block)} ${s.toFixed(3)} against ${sb.toFixed(3)}).` : `Not better than the built-in model on this run (${trnScoreName(block)} ${s.toFixed(3)} against ${sb.toFixed(3)}): more data, more epochs or another network may help.`} ${R.held_out.separate ? `Held out: ${esc(R.held_out.map)}, seed ${R.held_out.seed}, which the network did not see.` : 'Tested on its training data (one run only).'}${R.held_out.builtinSaw ? ' <b>The built-in model was trained on this very run</b>, so it has the advantage here: for a fair test, start the first source at another seed.' : ''} ${block === 'detector' ? `Per beam at the threshold ${DET_THR}.` : pred ? 'The distance between the most probable future and where the person really was, 1 s and 2 s ahead, in metres; best of 3: the nearest of the three futures.' : 'The error of each predicted waypoint against the expert route, in metres.'}</p>
  <form class="chg-save" id="trn-save"><input type="text" id="trn-name" maxlength="60" value="${esc(R.label)}" aria-label="Model name"><button type="submit" class="btn">Save</button><button type="button" class="btn" id="trn-saveuse">Save and use</button></form></div>`;
}
function trainPane() {
  const block = TRN.block,
    B = TRN_BLOCKS[block],
    rows = trnRows(),
    hp = TRN.hp[block],
    J = TRN.job,
    todo = rows.filter(r => !r.data).reduce((a, r) => a + r.runs, 0),
    ds = rows.some(r => r.data),
    shape = trnShapeModel(block),
    A = NN_ARCH[block].find(a => a[0] === TRN.arch[block]),
    starts = [
      ['random', 'Random weights'],
      ...(MODELS[block] && sameShape(MODELS[block], shape) ? [['builtin', 'The built-in weights']] : []),
      ...trnModels(block)
        .filter(m => sameShape(m, shape))
        .map(m => [m.id, esc(m.label)])
    ];
  if (!starts.some(s => s[0] === TRN.init[block])) TRN.init[block] = 'random';
  const daggerNoModel = rows.some(r => r.driver === 'policy' && !r.data) && P.polModel !== 'builtin' && !USER_MODELS[P.polModel],
    num = (k, v, lo, hi, step, w) =>
      `<input type="number" data-thp="${k}" value="${v}" min="${lo}" max="${hi}" step="${step}"${w ? ` style="width:${w}px"` : ''}>`;
  const C = TRN.compare && TRN.compare.block === block ? TRN.compare : null;
  return `<p class="note">Retrain the learned blocks here, in this browser: collect data from headless runs, train a network on it in background workers, compare it with the built-in model on a run it has not seen, and drive with it. The same code as <code>training/</code> in the repository, in plain JavaScript (slower than PyTorch: a few minutes for a few thousand ${B.unit}).</p>
  <div class="field"><span class="lbl">Block</span><div class="seg" id="trn-block">${Object.entries(TRN_BLOCKS)
    .map(([k, b]) => `<button data-v="${k}" aria-pressed="${block === k}">${b.name}</button>`)
    .join('')}</div></div>
  <h3 class="fhead">Models</h3>${trnModelsHTML(block)}
  <h3 class="fhead">1 · Data</h3>
  <p class="note">${block === 'predictor' ? 'At every lidar scan of a run, each confirmed track near a person: its last second, the robot’s place and motion and the free space around it, labelled with where that person really went over the next 3 s. The robot drives the map’s goals in a loop with the lidar tracker, yielding to people (speed planning) and ignoring them in turn so that reacting people also meet it up close.' : block === 'detector' ? 'Every lidar scan of a run, each beam labelled person or static from the true positions. The robot drives the map’s goals with ground-truth tracking; people walk on the levels that have them. The map changes with the seed, in turn: the prior map, the map the robot builds, and the prior map with the pose drifting on dead reckoning, so the network learns how far to trust it.' : 'Every scan of a run where the robot drives to a goal, labelled with the expert’s A* route ahead (eight points 0.4 m apart). The classical stack drives with its commands perturbed (noise) so the data also shows how to come back to the route; DAgger lets the policy drive and labels where it went.'}</p>
  ${rows.map((r, i) => trnRowHTML(r, i, block)).join('')}
  <div class="controls"><button type="button" class="btn small" id="trn-add">Add a source</button><button type="button" class="btn small" id="trn-recipe" title="The sources the built-in model was trained on (training/${block}/README.md)">The built-in recipe</button>${ds ? '<button type="button" class="btn small" id="trn-clear">Clear the data</button>' : ''}</div>
  <div class="controls"><button type="button" class="btn" id="trn-collect" ${J || !todo || daggerNoModel ? 'disabled' : ''}>${todo ? `Collect ${todo} run${todo === 1 ? '' : 's'}` : 'All collected'}</button><span class="lbl">${daggerNoModel ? 'DAgger needs the policy picked in Plan, which is not in this browser.' : ''}</span></div>
  <p class="note" id="trn-data">${trnDataLine(block)}</p>
  <details class="how"><summary>Maps of your own</summary><div class="how-body">
    <p>A source's map is a level, <b>the map on screen now</b> (the level with what you painted and erased, and the goals you placed), or a <b>saved</b> map. To make one: pick a level, set Mission → Map to <i>Empty floor</i> for a blank floor if you like, paint obstacles with the brush (W), erase with the eraser (E), place goals (G), then save it here. Saved maps are kept with your saved setups (Changed → Saved setups) and appear in every source's map list. For many maps at once, give a source <b>random obstacles</b>: each run scatters that many boxes on an empty floor, a new layout every run; or pick <b>Generated</b> rooms, warehouses or halls: each run is on a world of its own, generated with the run's seed at the size and settings of the level menu's Generate form (Custom level).</p>
    <form class="chg-save" id="trn-mapsave"><input type="text" id="trn-mapname" maxlength="60" placeholder="Name this map (${LV.id}${idList(P.mapAdd).length ? `, ${idList(P.mapAdd).length} painted blocks` : ''}, ${WPS.length} goals)" aria-label="Map name"><button type="submit" class="btn">Save the map on screen</button></form>
  </div></details>
  <h3 class="fhead">2 · Network</h3>
  <div class="field"><span class="lbl">Shape</span><div class="seg" id="trn-arch">${NN_ARCH[block].map(a => `<button data-v="${a[0]}" aria-pressed="${TRN.arch[block] === a[0]}">${a[1]}</button>`).join('')}</div><span class="lbl">${A[3]}: ${trnArchText(shape)}, ${shape.params} parameters.</span></div>
  <div class="field"><span class="lbl">Start from</span><div class="seg" id="trn-init">${starts.map(s => `<button data-v="${s[0]}" aria-pressed="${TRN.init[block] === s[0]}">${s[1]}</button>`).join('')}</div>${starts.length === 1 ? '<span class="lbl">Fine-tuning needs a model of the same shape (the built-in shape starts from the built-in weights).</span>' : ''}</div>
  <div class="exprow"><label>${num('epochs', hp.epochs, 1, 200, 1)} epochs</label><label>learning rate ${num('lr', hp.lr, 0.0001, 0.05, 0.0001, 76)}</label><label>batch ${num('batch', hp.batch, 8, 1024, 8)}</label></div>
  <h3 class="fhead">3 · Train</h3>
  <div class="controls"><button type="button" class="btn" id="trn-train" ${J || !ds ? 'disabled' : ''}>Train</button><button type="button" class="btn" id="trn-stop" ${J ? '' : 'hidden'}>Stop</button>${ds && (trnModels(block).length || MODELS[block]) ? `<button type="button" class="btn small" id="trn-cmp" ${J ? 'disabled' : ''}>Test every model on the held-out run</button>` : ''}<span class="lbl" id="trn-prog">${J ? J.text || '' : ''}</span></div>
  <div class="expbar" ${J ? '' : 'hidden'}><i id="trn-bar" style="width:${J ? (100 * J.done) / Math.max(1, J.total) : 0}%"></i></div>
  ${TRN.curveBlock === block && (TRN.curve.length || (J && J.kind === 'train')) ? `<canvas class="expchart" id="cv-trn" aria-label="Training curve"></canvas><p class="lbl trn-key"><span class="trn-k1"></span> training loss (left scale) · <span class="trn-k2"></span> held out ${block === 'detector' ? 'F1' : block === 'predictor' ? 'error at 2 s, m' : 'RMS error, m'} (right) · <span class="trn-k3"></span> built-in on the same run</p>` : ''}
  ${trnResultHTML(block)}
  ${C ? `<div class="trn-result"><h4>Every model on the held-out run (${esc(C.hold)})</h4><div class="exptab"><table><tr><th></th>${(block === 'detector' ? ['Precision', 'Recall', 'F1'] : block === 'predictor' ? ['1 s', '2 s', 'best of 3 at 2 s'] : ['RMS', 'Last waypoint', 'Best of K']).map(c => `<th>${c}</th>`).join('')}</tr>${C.rows.map(r => `<tr><td>${esc(r.label)}</td>${r.ev ? (block === 'detector' ? `<td>${pct(r.ev.precision)}</td><td>${pct(r.ev.recall)}</td><td>${r.ev.f1.toFixed(3)}</td>` : block === 'predictor' ? `<td>${r.ev.top[0].toFixed(2)} m</td><td>${r.ev.top[1].toFixed(2)} m</td><td>${r.ev.best[1].toFixed(2)} m</td>` : `<td>${r.ev.rms.toFixed(3)} m</td><td>${r.ev.perWp[POLICY_N - 1].toFixed(2)} m</td><td>${r.ev.K > 1 ? `${r.ev.best.toFixed(3)} m` : '–'}</td>`) : '<td colspan="3">failed</td>'}</tr>`).join('')}</table></div><p class="note">${C.saw ? 'The built-in model was trained on this run, so it has the advantage. ' : ''}${block === 'predictor' && C.rows[0] && C.rows[0].ev ? `Constant velocity on the same samples: ${C.rows[0].ev.cv[0].toFixed(2)} m at 1 s, ${C.rows[0].ev.cv[1].toFixed(2)} m at 2 s. ` : ''}To compare them driving, vary <i>${{detector: 'Detector model', predictor: 'Predictor model', policy: 'Policy model'}[block]}</i> in Experiments.</p></div>` : ''}
  <details class="how"><summary>How it works</summary><div class="how-body">
    <p>${block === 'predictor' ? 'The predictor is a multilayer perceptron (ReLU) from 24 numbers (the track’s last second in the person’s own frame, the robot’s position and velocity, eight rays of free space) to 39: three logits and three futures of six points each, as corrections to constant velocity. It is trained by the negative log-likelihood of a mixture of three Gaussians of fixed σ (0.3 m): each future is pulled towards the outcomes it explains best and each probability towards how often it does, so the three futures can split between walking on, stopping and turning back.' : block === 'detector' ? 'The detector is a stack of circular 1D convolutions over the 120 beams (ReLU between them, a sigmoid at the end) trained with binary cross-entropy, the person beams weighted by the square root of their rarity so that recall does not drown in false beams.' : 'The policy is a multilayer perceptron (ReLU) from 139 numbers (the scan, its 12 sector minima, the goal in the robot frame, the odometry) to 68: four scores and four candidate paths of eight waypoints, trained by behaviour cloning with the predictor’s mixture loss (σ 0.2 m) against the expert route: each candidate is pulled towards the routes it explains best and each score towards how often it does, so where the expert went either way around a shelf the candidates split between the two sides instead of averaging into a path through it. In Plan the best-scoring candidate that clears the costmap drives.'} Training is Adam on minibatches, an epoch being one pass over the data in a new random order; the gradients are computed by backpropagation in plain loops (<code>nnGrad</code> in core/nn-train.js), split over ${trnWorkers()} worker${trnWorkers() === 1 ? '' : 's'} that each hold part of the data. After every epoch the network is tested on the held-out run. The trained weights are the same JSON as <code>src/models/${block}.json</code>: <i>JSON</i> saves a file that can replace it.</p>
    <p>Whether a model is better is a question of the run it is tested on: one held-out run is a small sample. Drive with it, and compare it in Experiments over several seeds.</p>
    <button class="linkbtn" data-source="core/nn-train.js">View the source</button></div></details>`;
}
function trnDrawCurve() {
  const c = $('#cv-trn');
  if (!c) return;
  readTokens();
  const dpr = sizeCanvas(c),
    g = c.getContext('2d'),
    w = c.width,
    h = c.height,
    C = TRN.curve,
    block = TRN.block,
    hp = TRN.hp[block],
    padL = 44 * dpr,
    padR = 44 * dpr,
    padT = 14 * dpr,
    padB = 26 * dpr;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = TOK['map-bg'];
  g.fillRect(0, 0, w, h);
  g.font = `${Math.round(10 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
  const nE = Math.max(hp.epochs, C.length ? C[C.length - 1].epoch : 1),
    X = e => padL + ((e - 1) / Math.max(1, nE - 1)) * (w - padL - padR),
    lmax = Math.max(1e-6, ...C.map(p => p.loss)) * 1.1,
    base = TRN.baseEv && TRN.baseEv.builtin ? trnScore(block, TRN.baseEv.builtin) : null,
    vals = C.map(p => trnScore(block, p.ev)),
    rmax = block === 'detector' ? 1 : Math.max(0.1, ...vals, base || 0) * 1.1, // the predictor: error at 2 s, m
    YL = v => padT + (1 - v / lmax) * (h - padT - padB),
    YR = v => padT + (1 - v / rmax) * (h - padT - padB);
  g.strokeStyle = TOK.line;
  g.beginPath();
  g.moveTo(padL, h - padB);
  g.lineTo(w - padR, h - padB);
  g.stroke();
  g.fillStyle = TOK.muted;
  g.textBaseline = 'middle';
  g.textAlign = 'right';
  g.fillText(lmax.toFixed(lmax < 0.1 ? 4 : 2), padL - 5 * dpr, YL(lmax));
  g.fillText('0', padL - 5 * dpr, YL(0));
  g.textAlign = 'left';
  g.fillText(rmax.toFixed(2), w - padR + 5 * dpr, YR(rmax));
  g.fillText('0', w - padR + 5 * dpr, YR(0));
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText('epoch', w / 2, h - padB + 8 * dpr);
  g.fillText('1', X(1), h - padB + 8 * dpr);
  g.fillText(String(nE), X(nE), h - padB + 8 * dpr);
  if (base != null) {
    g.strokeStyle = TOK.muted;
    g.setLineDash([4 * dpr, 4 * dpr]);
    g.beginPath();
    g.moveTo(padL, YR(base));
    g.lineTo(w - padR, YR(base));
    g.stroke();
    g.setLineDash([]);
  }
  const line = (col, f) => {
    g.strokeStyle = col;
    g.fillStyle = col;
    g.lineWidth = 2 * dpr;
    g.beginPath();
    C.forEach((p, i) => (i ? g.lineTo(X(p.epoch), f(p)) : g.moveTo(X(p.epoch), f(p))));
    g.stroke();
    for (const p of C) g.fillRect(X(p.epoch) - 2 * dpr, f(p) - 2 * dpr, 4 * dpr, 4 * dpr);
    g.lineWidth = 1;
  };
  if (C.length) {
    line(TOK.accent, p => YL(p.loss));
    line(TOK.amber, p => YR(trnScore(block, p.ev)));
  }
}
// a source's setting changed; its data (if any) is dropped when the change is real. Returns whether it was.
function trnRowSet(r, f, v) {
  const block = TRN.block,
    was = JSON.stringify({...r, data: null});
  if (f === 'map') {
    if (v === 'keep') return;
    if (v === 'screen' || v[0] === 'S') {
      const cfg = v === 'screen' ? currentConfig() : (setupsLoad()[+v.slice(1)] || {}).cfg;
      if (!cfg) return;
      const lv = cfg.gen ? genSpec(cfg.gen) : cfg.levelData || trnLevel(cfg.level),
        p = cfg.params || {};
      if (lv === -1) return;
      r.level = typeof lv === 'number' ? lv : -1;
      r.lvRef = typeof lv === 'number' ? null : lv;
      r.gen = null;
      r.cfg = {map: p.map || 'level', mapAdd: p.mapAdd || '', mapDel: p.mapDel || '', goals: cfg.goals || null};
      r.label =
        v === 'screen'
          ? `${typeof lv === 'number' ? cfg.level : levelOf(lv).name} as on screen (${new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})})`
          : 'Saved: ' + setupsLoad()[+v.slice(1)].name;
      if (cfg.goals && r.goals === 'random' && trnPeople(block)) r.goals = 'map';
    } else if (v[0] === 'G') {
      r.gen = trnGen(block, v.slice(1));
      r.level = -1;
      r.lvRef = null;
      r.cfg = null;
      r.label = `Generated: ${GEN_FAMILIES[r.gen.gen].name.toLowerCase()}`;
    } else {
      r.level = +v.slice(1);
      r.cfg = null;
      r.gen = null;
      r.lvRef = null;
      r.label = `${LEVELS[r.level].id} ${LEVELS[r.level].name}`;
    }
  } else if (f === 'goals' || f === 'people' || f === 'driver') r[f] = v;
  else {
    const lim = {nGoals: [1, 12], runs: [1, 40], seed0: [1, 999], secs: [10, 600], random: [0, 40], noise: [0, 1]}[f];
    if (!lim) return;
    const x = +v;
    if (!isFinite(x)) return;
    r[f] = clamp(f === 'noise' ? x : Math.round(x), lim[0], lim[1]);
  }
  if (JSON.stringify({...r, data: null}) === was) return false;
  r.data = null;
  return true;
}
function wireTrain(pane) {
  const block = TRN.block,
    rows = trnRows(),
    rerender = () => renderAllPanes(),
    later = () => setTimeout(renderAllPanes, 0); // after an input's change: the pane must not be replaced while it blurs
  pane.querySelectorAll('#trn-block button').forEach(
    b =>
      (b.onclick = () => {
        TRN.block = b.dataset.v;
        rerender();
      })
  );
  pane.querySelectorAll('[data-trow]').forEach(el => {
    const r = rows[+el.dataset.trow],
      f = el.dataset.f;
    if (el.classList.contains('seg'))
      el.querySelectorAll('button').forEach(
        b =>
          (b.onclick = () => {
            if (!TRN.job && trnRowSet(r, f, b.dataset.v)) rerender();
          })
      );
    else
      el.onchange = () => {
        if (!TRN.job && trnRowSet(r, f, el.value)) later();
      };
  });
  pane.querySelectorAll('[data-trdel]').forEach(
    b =>
      (b.onclick = () => {
        if (TRN.job) return;
        rows.splice(+b.dataset.trdel, 1);
        rerender();
      })
  );
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
  };
  on('#trn-add', () => {
    const last = rows[rows.length - 1];
    rows.push(
      last
        ? {...last, data: null, seed0: last.seed0 + last.runs}
        : LEVELS.includes(LV)
          ? trnRow(block, LEVELS.indexOf(LV))
          : trnRow(block, -1, {lvRef: levelRef(LV), label: LV.name})
    );
    rerender();
  });
  on('#trn-recipe', () => {
    if (TRN.job) return;
    TRN.rows[block] = trnRecipe(block);
    rerender();
  });
  on('#trn-clear', () => {
    if (TRN.job) return;
    for (const r of rows) r.data = null;
    TRN.compare = null;
    rerender();
  });
  on('#trn-collect', () => trnCollect());
  on('#trn-train', () => trnTrain());
  on('#trn-cmp', () => trnCompare());
  on('#trn-stop', () => {
    if (TRN.job) TRN.job.stop = true;
    trnProgress('Stopping after this step…');
  });
  pane.querySelectorAll('#trn-arch button').forEach(
    b =>
      (b.onclick = () => {
        TRN.arch[block] = b.dataset.v;
        rerender();
      })
  );
  pane.querySelectorAll('#trn-init button').forEach(
    b =>
      (b.onclick = () => {
        TRN.init[block] = b.dataset.v;
        rerender();
      })
  );
  pane.querySelectorAll('[data-thp]').forEach(
    el =>
      (el.onchange = () => {
        const k = el.dataset.thp,
          lim = {epochs: [1, 200], lr: [1e-4, 0.05], batch: [8, 1024]}[k],
          x = +el.value;
        if (isFinite(x)) TRN.hp[block][k] = clamp(k === 'lr' ? x : Math.round(x), lim[0], lim[1]);
        el.value = TRN.hp[block][k];
      })
  );
  const use = id => {
    const B = TRN_BLOCKS[block];
    setParam(B.key, id, false);
    for (const [k, v] of Object.entries(B.use)) if (id !== 'builtin' && P[k] !== v) setParam(k, v, false);
    toast(`${B.name}: ${id === 'builtin' ? 'the built-in model' : USER_MODELS[id].label} drives now`);
    rerender();
  };
  pane.querySelectorAll('[data-tuse]').forEach(b => (b.onclick = () => use(b.dataset.tuse)));
  pane.querySelectorAll('[data-tdl]').forEach(
    b =>
      (b.onclick = () => {
        const m = USER_MODELS[b.dataset.tdl];
        if (m) download(`nav-lab-${m.id}-${block}.json`, trnJSON(m), 'application/json');
      })
  );
  pane.querySelectorAll('[data-tdel]').forEach(
    b =>
      (b.onclick = async () => {
        const id = b.dataset.tdel;
        if (TRN.delArm !== id) {
          TRN.delArm = id;
          b.textContent = 'Delete?';
          return;
        }
        TRN.delArm = null;
        await trnDelete(id);
        rerender();
      })
  );
  const imp = $('#trn-import');
  if (imp)
    imp.onchange = async () => {
      const f = imp.files && imp.files[0];
      if (!f) return;
      try {
        const m = trnImport(await f.text());
        await trnSave(m);
        TRN.block = m.block;
        toast(`Imported “${m.label}” (${m.id})`);
      } catch (e) {
        toast('Could not import that file: ' + e.message, 6000);
      }
      rerender();
    };
  const save = async useIt => {
    const R = TRN.result;
    if (!R) return;
    const nm = ($('#trn-name').value || '').trim() || R.label,
      m = {...R, id: trnNewId(block), label: nm, created: Date.now()};
    await trnSave(m);
    TRN.result = null;
    toast(`Saved “${nm}” as ${m.id}${TRN.stored ? '' : ' (until this page closes)'}`);
    if (useIt) use(m.id);
    else rerender();
  };
  const sf = $('#trn-save');
  if (sf)
    sf.onsubmit = e => {
      e.preventDefault();
      save(false);
    };
  on('#trn-saveuse', () => save(true));
  const ms = $('#trn-mapsave');
  if (ms)
    ms.onsubmit = e => {
      e.preventDefault();
      const a = setupsLoad(),
        nm = $('#trn-mapname').value.trim() || `${LV.id} map · ${new Date().toLocaleString()}`;
      a.unshift({name: nm, cfg: currentConfig(), at: Date.now()});
      if (setupsSave(a.slice(0, 30))) toast(`Saved the map “${nm}”: pick it as a source's map`);
      else toast('This browser does not allow saving here');
      rerender();
    };
  trnDrawCurve();
}
trnLoad();
