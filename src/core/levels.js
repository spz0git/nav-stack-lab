/* ============================================================
   Levels as data. A level is a plain JSON object: the page imports and exports it, keeps it in the browser, carries
   it in a link, and the world generator (worldgen.js) writes it. The built-in levels (worlds.js) convert to it and
   back without a change in behaviour, and loadLevel runs every level, built-in or not, through the same code.
     {format: 'nav-stack-lab-level', version: 1,
      name, about (a sentence or two, optional),
      size: [w, h] in metres (rounded to the 0.4 m paint grid; from WORLD_MIN to WORLD_MAX, area at most WORLD_AREA),
      walls: true (the 0.2 m outer walls are added and `shapes` lists the rest; false: shapes is the whole map),
      shapes: [{rect: [x, y, w, h]} | {circle: [x, y, r]}, …],
      beacons: [[x, y], …],
      start: [x, y, θ],
      goals: [[x, y] or [x, y, θ], …],
      people: [{from: [x, y], to: [x, y], speed, phase (0–1: where on the route it starts), mode: 'shuttle' (turns back
               at once) | 'pause' (waits `wait` s at each end), trigger (optional): {near: [x, y], r} (the person stands
               still where the route starts until the robot comes within r m of near, then walks)}, …],
      cars: [{loop: [[x, y], …], speed, phase}, …] (optional: the parking lot's moving car),
      settings: {key: value} (the level's own setup: keys of DEFAULTS in core/params.js; a value setParam would refuse,
                a choice it does not have or a number out of range, is left out with a warning in the event log),
      layers: {cost: true} (optional: map layers the level shows),
      gen: the generator spec it was made from (optional; informational)}
   The runtime level (what LV holds) keeps the old field names: shapes as {t, x, y, …}, peds, wps, cfg.
   ============================================================ */
const LEVEL_FORMAT = 'nav-stack-lab-level';
const LEVEL_LIMITS = {shapes: 4000, beacons: 120, goals: 40, people: 32, cars: 4, loop: 32, name: 60, about: 600};
const levelSize = L => L.size || [24, 16];
// the settings a level may set: every parameter but the ones that belong to a run or to the browser
const LEVEL_NOSET = ['seed', 'map', 'mapAdd', 'mapDel', 'bOff', 'detModel', 'polModel', 'predModel'];
const r2 = v => Math.round(v * 100) / 100;
const plainText = (s, n) =>
  String(s == null ? '' : s)
    .replace(/[<>&"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
// The runtime level → the format. edits: the map as it is on screen (painted cells and erased obstacles applied, the
// goals placed, the beacons switched off left out) instead of the level as designed.
function levelToJSON(L, edits) {
  const [w, h] = levelSize(L),
    src = edits ? L.shapes : L.shapes0 || L.shapes,
    off = new Set(edits ? idList(P.bOff) : []),
    walls = src.filter(s => s.border).length === 4;
  // the numbers as they are (a level converted and back is the same level), but the painted cells and the goals
  // placed by hand, whose float noise (1.2000000000000002) would only lengthen the file, to the centimetre
  const shape = s => {
    const f = s.painted ? r2 : v => v;
    return s.t === 'c' ? {circle: [s.x, s.y, s.r].map(f)} : {rect: [s.x, s.y, s.w, s.h].map(f)};
  };
  const placed = edits && WPS.length && !WPS.some(g => g.explore),
    goals = placed ? WPS.map(g => (g.th == null ? [r2(g.x), r2(g.y)] : [r2(g.x), r2(g.y), +g.th.toFixed(4)])) : L.wps.map(g => [...g]);
  const settings = {};
  for (const [k, v] of Object.entries(L.cfg || {})) if (!LEVEL_NOSET.includes(k)) settings[k] = v;
  const out = {
    format: LEVEL_FORMAT,
    version: 1,
    name: L.name,
    about: plainText(L.adds, LEVEL_LIMITS.about),
    size: [w, h],
    walls,
    shapes: src.filter(s => !(walls && s.border)).map(shape),
    beacons: L.beacons.filter((b, i) => !off.has(i)).map(b => [b[0], b[1]]),
    start: [...L.start],
    goals,
    people: L.peds.map(p => ({
      from: [...p.a],
      to: [...p.b],
      speed: p.v,
      phase: p.s0 || 0,
      mode: p.dw ? 'pause' : 'shuttle',
      ...(p.dw ? {wait: p.dw} : {}),
      ...(p.tr ? {trigger: {near: [...p.tr.p], r: p.tr.r}} : {})
    })),
    settings
  };
  if (L.cars && L.cars.length) out.cars = L.cars.map(c => ({loop: c.loop.map(q => [...q]), speed: c.v, phase: c.s0 || 0}));
  if (L.layers && L.layers.cost) out.layers = {cost: true};
  if (L.gen && !edits) out.gen = L.gen;
  return out;
}
// The format → a runtime level, checked: throws an Error that says what is wrong. id: what the header shows.
function levelFromJSON(j, id) {
  const bad = m => {
    throw new Error(m);
  };
  if (!j || typeof j !== 'object') bad('a level is a JSON object');
  if (j.format !== LEVEL_FORMAT) bad(`not a level (format should be "${LEVEL_FORMAT}")`);
  if (j.version !== 1) bad('level format version ' + j.version + ' is not known to this page');
  const num = (v, what) => (typeof v === 'number' && isFinite(v) ? v : bad(what + ' is not a number')),
    arr = (v, what, n) => (Array.isArray(v) && (n == null || v.length >= n) ? v : bad(what + ' is not a list' + (n ? ` of ${n}` : ''))),
    list = (v, what, max) => {
      if (v == null) return [];
      arr(v, what);
      if (v.length > max) bad(`${what}: at most ${max}`);
      return v;
    };
  const sz = arr(j.size, 'size', 2),
    w = Math.round(num(sz[0], 'size[0]') * 2.5) / 2.5,
    h = Math.round(num(sz[1], 'size[1]') * 2.5) / 2.5;
  if (w < WORLD_MIN[0] || h < WORLD_MIN[1] || w > WORLD_MAX[0] || h > WORLD_MAX[1])
    bad(`size ${w} × ${h} m: from ${WORLD_MIN.join(' × ')} to ${WORLD_MAX.join(' × ')} m`);
  if (w * h > WORLD_AREA + 1e-9) bad(`size ${w} × ${h} m: the area is at most ${WORLD_AREA} m²`);
  const inside = (p, what) => {
    const x = num(p[0], what + ' x'),
      y = num(p[1], what + ' y');
    if (x < 0 || y < 0 || x > w || y > h) bad(`${what} (${x}, ${y}) is outside the ${w} × ${h} m floor`);
    return [x, y];
  };
  const shapes = j.walls === false ? [] : border(w, h);
  for (const s of list(j.shapes, 'shapes', LEVEL_LIMITS.shapes)) {
    if (s && s.rect) {
      const [x, y, sw, sh] = arr(s.rect, 'rect', 4).map((v, k) => num(v, 'rect[' + k + ']'));
      if (!(sw > 0 && sh > 0)) bad('a rect needs a positive width and height');
      shapes.push(Rc(x, y, sw, sh));
    } else if (s && s.circle) {
      const [x, y, r] = arr(s.circle, 'circle', 3).map((v, k) => num(v, 'circle[' + k + ']'));
      if (!(r > 0)) bad('a circle needs a positive radius');
      shapes.push(Ci(x, y, r));
    } else bad('a shape is {rect: [x, y, w, h]} or {circle: [x, y, r]}');
  }
  const st = arr(j.start, 'start', 2);
  const start = [...inside(st, 'start'), st.length > 2 ? num(st[2], 'start θ') : 0];
  const goals = list(j.goals, 'goals', LEVEL_LIMITS.goals).map((g, k) => {
    arr(g, 'goal ' + (k + 1), 2);
    const p = inside(g, 'goal ' + (k + 1));
    return g.length > 2 && g[2] != null ? [...p, num(g[2], 'goal θ')] : p;
  });
  const peds = list(j.people, 'people', LEVEL_LIMITS.people).map((p, k) => {
    const what = 'person ' + (k + 1);
    if (!p || typeof p !== 'object') bad(what + ' is not an object');
    const a = inside(arr(p.from, what + ' from', 2), what + ' from'),
      b = inside(arr(p.to, what + ' to', 2), what + ' to');
    if (hyp(b[0] - a[0], b[1] - a[1]) < 0.5) bad(what + ': the route is shorter than 0.5 m');
    const out = {
      a,
      b,
      v: clamp(num(p.speed == null ? 0.7 : p.speed, what + ' speed'), 0.1, 2),
      s0: clamp(num(p.phase || 0, what + ' phase'), 0, 1)
    };
    if (p.mode === 'pause') out.dw = clamp(num(p.wait == null ? 2 : p.wait, what + ' wait'), 0.1, 30);
    else if (p.mode != null && p.mode !== 'shuttle') bad(what + ': mode is "shuttle" or "pause"');
    if (p.trigger != null) {
      if (typeof p.trigger !== 'object') bad(what + ': trigger is {near: [x, y], r}');
      out.tr = {
        p: inside(arr(p.trigger.near, what + ' trigger near', 2), what + ' trigger'),
        r: clamp(num(p.trigger.r == null ? 3 : p.trigger.r, what + ' trigger r'), 0.5, 10)
      };
    }
    return out;
  });
  const cars = list(j.cars, 'cars', LEVEL_LIMITS.cars).map((c, k) => ({
    loop: list(c && c.loop, 'car ' + (k + 1) + ' loop', LEVEL_LIMITS.loop).map(q => inside(arr(q, 'loop point', 2), 'car ' + (k + 1))),
    v: clamp(num(c.speed == null ? 0.6 : c.speed, 'car speed'), 0.1, 2),
    s0: clamp(num(c.phase || 0, 'car phase'), 0, 1)
  }));
  if (cars.some(c => c.loop.length < 2)) bad('a car loop needs two points or more');
  const cfg = {},
    warn = [];
  for (const [k, v] of Object.entries(j.settings || {})) {
    if (!(k in DEFAULTS) || LEVEL_NOSET.includes(k)) continue; // a key this page does not know is left out, not an error
    if (typeof v !== typeof DEFAULTS[k]) bad(`setting ${k}: a ${typeof DEFAULTS[k]}`);
    if (k === 'sched' && schedError(v)) bad(`setting sched: ${schedError(v)}`);
    const why = paramError(k, v); // a value a setup link could not set either: left out, and said so when it loads
    if (why) warn.push(why);
    else cfg[k] = v;
  }
  const L = {
    id: id || 'C',
    name: plainText(j.name, LEVEL_LIMITS.name) || 'Custom level',
    adds: plainText(j.about, LEVEL_LIMITS.about) || 'A level loaded from a file or a link.',
    tries: [],
    custom: true,
    size: [w, h],
    shapes,
    beacons: list(j.beacons, 'beacons', LEVEL_LIMITS.beacons).map((b, k) => inside(arr(b, 'beacon', 2), 'beacon ' + (k + 1))),
    peds,
    start,
    wps: goals,
    cfg,
    layers: {cost: !!(j.layers && j.layers.cost)}
  };
  if (cars.length) L.cars = cars;
  if (warn.length) L.warn = warn;
  if (j.gen && typeof j.gen === 'object') L.gen = {...j.gen};
  return L;
}
// What loadLevel accepts, as a runtime level: an index into LEVELS, a runtime level, a level in the format, or a
// generator spec ({gen: 'rooms', seed: 3, …}, worldgen.js). The last two are made once per distinct object and kept,
// so that a worker running many seeds on one level, or a tryGo on the current one, does not build it again.
const LEVEL_CACHE = new Map();
function levelOf(x) {
  if (typeof x === 'number') {
    if (!LEVELS[x]) throw new Error('no level ' + x);
    return LEVELS[x];
  }
  if (!x || typeof x !== 'object') throw new Error('not a level');
  if (x.shapes && x.wps && x.cfg) return x; // a runtime level
  const key = JSON.stringify(x);
  let L = LEVEL_CACHE.get(key);
  if (!L) {
    if (x.gen && x.format !== LEVEL_FORMAT) {
      L = levelFromJSON(genLevel(x), 'G');
      L.genSpec = {...x};
    } else L = levelFromJSON(x, x.gen ? 'G' : 'C');
    if (LEVEL_CACHE.size >= 8) LEVEL_CACHE.delete(LEVEL_CACHE.keys().next().value);
    LEVEL_CACHE.set(key, L);
  }
  return L;
}
// How a level travels to a worker or into a link: a built-in by its index, a generated one by its spec (unedited: a
// spec is a few bytes), any other by its JSON
const levelRef = L => (LEVELS.includes(L) ? LEVELS.indexOf(L) : L.genSpec || levelToJSON(L));
