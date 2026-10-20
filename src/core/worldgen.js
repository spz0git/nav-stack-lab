/* ============================================================
   World generator: a seeded level in the level format (levels.js), of one of three families. The same spec gives the
   same level on every machine (mulberry32, never Math.random). Core only, no DOM; it works on grids of its own and
   leaves the world's (W, H, GW, GH) alone, so it can run while another level is on screen.
     spec: {gen: family, seed, w, h, goals, people, beacons (0: about one per 32 m²), like: the built-in level whose
           settings the level takes ('L1' … 'L5'; by default L5 with people, L2 without), and the family's own
           parameters (GEN_FAMILIES)}
   Every family places, on the free floor the robot can reach from its start (a grid search on the costmap's lethal
   cells, LETHAL from the obstacles, which is where the grid planners can go): the start in the lower left corner, the
   goals spread over that floor, the beacons on walls next to it, and the people's routes along straight runs of free
   floor 0.6 m clear on both sides.
   ============================================================ */
// [default, min, max, step, label]
const GEN_COMMON = {
  w: [24, WORLD_MIN[0], WORLD_MAX[0], 0.4, 'width (m)'],
  h: [16, WORLD_MIN[1], WORLD_MAX[1], 0.4, 'depth (m)'],
  goals: [5, 1, 12, 1, 'goals'],
  people: [0, 0, 12, 1, 'people'],
  beacons: [0, 0, 60, 1, 'beacons (0: one per 32 m²)']
};
const GEN_FAMILIES = {
  rooms: {
    name: 'Rooms and corridors',
    about: 'rooms split off one another by walls with doors, some of them along corridors, with furniture against the walls',
    params: {
      room: [4, 3, 10, 0.5, 'smallest room side (m)'],
      door: [1.2, 1, 2, 0.1, 'door width (m)'],
      corridor: [0.4, 0, 1, 0.1, 'how often a split leaves a corridor'],
      clutter: [1, 0, 3, 1, 'furniture per room']
    }
  },
  warehouse: {
    name: 'Warehouse',
    about: 'rows of racks with aisles between them, cross aisles and a few gaps through the racks',
    params: {
      aisle: [2, 1.2, 3.2, 0.1, 'aisle width (m)'],
      depth: [0.8, 0.4, 1.6, 0.1, 'rack depth (m)'],
      cross: [1, 0, 4, 1, 'cross aisles'],
      gaps: [0.2, 0, 1, 0.05, 'chance of a gap in a rack']
    }
  },
  hall: {
    name: 'Open hall',
    about: 'an open floor with pillars and boxes scattered over it',
    params: {
      density: [6, 0, 25, 1, 'obstacles per 100 m²'],
      gap: [1.2, 0.9, 3, 0.1, 'least gap between obstacles (m)'],
      round: [0.5, 0, 1, 0.1, 'share of round pillars']
    }
  }
};
const GEN_LIKE = ['L1', 'L2', 'L3', 'L4', 'L5'];
const snap1 = v => Math.round(v * 10) / 10;
// A spec with every field present and within its range (snapped to its step); throws on an unknown family
function genSpec(sp) {
  const F = GEN_FAMILIES[sp && sp.gen];
  if (!F) throw new Error(`unknown generator "${sp && sp.gen}" (${Object.keys(GEN_FAMILIES).join(', ')})`);
  const out = {gen: sp.gen, seed: clamp(Math.round(+sp.seed || 1), 1, 99999)};
  for (const [k, [d, lo, hi, st]] of Object.entries({...GEN_COMMON, ...F.params})) {
    const v = sp[k] == null || !isFinite(+sp[k]) ? d : clamp(+sp[k], lo, hi);
    out[k] = +(lo + Math.round((v - lo) / st) * st).toFixed(2);
  }
  out.like = GEN_LIKE.includes(sp.like) ? sp.like : out.people > 0 ? 'L5' : 'L2';
  return out;
}
// The gap between two shapes ({t: 'r' | 'c'}), 0 when they touch or overlap
function shapeGap(a, b) {
  if (a.t === 'c' && b.t === 'c') return Math.max(0, hyp(a.x - b.x, a.y - b.y) - a.r - b.r);
  if (a.t === 'c' || b.t === 'c') {
    const c = a.t === 'c' ? a : b,
      r = a.t === 'c' ? b : a;
    return Math.max(0, hyp(c.x - clamp(c.x, r.x, r.x + r.w), c.y - clamp(c.y, r.y, r.y + r.h)) - c.r);
  }
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
    dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return hyp(dx, dy);
}

/* ---------- the families: interior obstacles of a w × h floor (the outer walls are added by the format) ---------- */
// Rooms: binary space partition of the floor. Each split is a 0.2 m wall with one door, so every room is reachable;
// a split may leave a corridor (two walls, a door in each, and a door from every room along it). A new wall never
// meets a wall where that wall has a door.
function genRooms(w, h, p, u) {
  const dw = p.door,
    minS = p.room,
    cw = Math.max(1.6, dw + 0.4),
    walls = [],
    shapes = [],
    rnd = (a, b) => a + u() * (b - a);
  const door = (wall, lo, hi) => {
    const a = lo + 0.5,
      b = hi - 0.5 - dw;
    if (!wall || b < a) return null;
    const d0 = snap1(rnd(a, b)),
      g = [d0, d0 + dw];
    wall.gaps.push(g);
    return g;
  };
  const near = (ints, s) => ints.some(g => s > g[0] - 0.5 && s < g[1] + 0.5),
    within = (ints, lo, hi) => ints.filter(g => g[1] > lo && g[0] < hi);
  const leaf = R => {
    if (R.corr) return;
    // a door into every corridor the room lies along
    const span = {L: [R.y0, R.y1], R: [R.y0, R.y1], B: [R.x0, R.x1], T: [R.x0, R.x1]};
    for (const k of ['L', 'R', 'B', 'T'])
      if (R.cside[k] && !within(R.doors[k], ...span[k]).length) {
        const g = door(R.walls[k], ...span[k]);
        if (g) R.doors[k] = R.doors[k].concat([g]);
      }
    // furniture against the walls, clear of the doors and of one another, leaving 1.6 m of the room free
    const doorPts = [];
    for (const k of ['L', 'R', 'B', 'T'])
      for (const g of within(R.doors[k], ...span[k])) {
        const m = (g[0] + g[1]) / 2;
        doorPts.push(k === 'L' ? [R.x0, m] : k === 'R' ? [R.x1, m] : k === 'B' ? [m, R.y0] : [m, R.y1]);
      }
    const mine = [];
    for (let n = 0, t = 0; n < p.clutter && t < 30; t++) {
      const side = ['L', 'R', 'B', 'T'][Math.floor(u() * 4)],
        horiz = side === 'B' || side === 'T',
        along = snap1(rnd(0.6, 1.6)),
        deep = snap1(rnd(0.4, 1.0)),
        roomAlong = horiz ? R.x1 - R.x0 : R.y1 - R.y0,
        roomDeep = horiz ? R.y1 - R.y0 : R.x1 - R.x0;
      if (roomDeep - 0.2 - deep < 1.6 || roomAlong - 0.8 < along) continue;
      const a = snap1(rnd((horiz ? R.x0 : R.y0) + 0.4, (horiz ? R.x1 : R.y1) - 0.4 - along)),
        s =
          side === 'B'
            ? Rc(a, R.y0 + 0.1, along, deep)
            : side === 'T'
              ? Rc(a, R.y1 - 0.1 - deep, along, deep)
              : side === 'L'
                ? Rc(R.x0 + 0.1, a, deep, along)
                : Rc(R.x1 - 0.1 - deep, a, deep, along);
      if (doorPts.some(q => shapeGap(s, Ci(q[0], q[1], 0.01)) < dw + 0.4)) continue;
      if (mine.some(o => shapeGap(s, o) < 1.0)) continue;
      mine.push(s);
      n++;
    }
    shapes.push(...mine);
  };
  const split = (R, depth) => {
    const rw = R.x1 - R.x0,
      rh = R.y1 - R.y0,
      canV = rw >= 2 * minS,
      canH = rh >= 2 * minS;
    // a room of up to twice the smallest side's area is sometimes kept whole
    if ((!canV && !canH) || depth > 14 || (rw * rh < 3 * minS * minS && u() < 0.3)) return leaf(R);
    const vert = canV && (!canH || rw > rh * 1.2 || (rh <= rw * 1.2 && u() < 0.5)),
      len = vert ? rw : rh,
      lo = vert ? R.x0 : R.y0,
      corr = !R.corr && u() < p.corridor && len >= 2 * minS + cw,
      room = len - 2 * minS - (corr ? cw : 0),
      ends = vert ? [...R.doors.B, ...R.doors.T] : [...R.doors.L, ...R.doors.R];
    for (let t = 0; t < 12; t++) {
      const s = snap1(lo + minS + u() * room),
        s2 = corr ? snap1(s + cw) : s;
      if (near(ends, s) || (corr && near(ends, s2))) continue;
      const mk = c => {
        const wl = {v: vert, c, a: vert ? R.y0 : R.x0, b: vert ? R.y1 : R.x1, gaps: []};
        walls.push(wl);
        return wl;
      };
      const w1 = mk(s),
        g1 = door(w1, w1.a, w1.b),
        w2 = corr ? mk(s2) : w1,
        g2 = corr ? door(w2, w2.a, w2.b) : g1,
        sub = (a, b, lw, lg, hw, hg, corrL, corrH, isCorr) => {
          // the part between a and b along the split; lw/hw: the walls at its low and high end, lg/hg their doors
          const box = vert ? {x0: a, x1: b, y0: R.y0, y1: R.y1} : {x0: R.x0, x1: R.x1, y0: a, y1: b},
            lk = vert ? 'L' : 'B',
            hk = vert ? 'R' : 'T',
            ok = vert ? ['B', 'T'] : ['L', 'R'];
          const N = {...box, corr: isCorr, doors: {}, walls: {}, cside: {}};
          for (const k of ok) {
            N.doors[k] = within(R.doors[k], a, b);
            N.walls[k] = R.walls[k];
            N.cside[k] = R.cside[k];
          }
          N.doors[lk] = lw === R.walls[lk] ? R.doors[lk] : lg ? [lg] : [];
          N.walls[lk] = lw;
          N.cside[lk] = lw === R.walls[lk] ? R.cside[lk] : corrL;
          N.doors[hk] = hw === R.walls[hk] ? R.doors[hk] : hg ? [hg] : [];
          N.walls[hk] = hw;
          N.cside[hk] = hw === R.walls[hk] ? R.cside[hk] : corrH;
          return N;
        };
      const lk = vert ? 'L' : 'B',
        hk = vert ? 'R' : 'T',
        hi = vert ? R.x1 : R.y1;
      split(sub(lo, s, R.walls[lk], null, w1, g1, false, corr, false), depth + 1);
      if (corr) leaf(sub(s, s2, w1, g1, w2, g2, false, false, true));
      split(sub(s2, hi, w2, g2, R.walls[hk], null, corr, false, false), depth + 1);
      return;
    }
    leaf(R);
  };
  const none = {L: [], R: [], B: [], T: []};
  split({x0: 0.1, y0: 0.1, x1: w - 0.1, y1: h - 0.1, doors: none, walls: {L: null, R: null, B: null, T: null}, cside: {}}, 0);
  // the walls, less their doors, as 0.2 m rectangles reaching the centre lines of the walls they meet
  for (const wl of walls) {
    const gaps = wl.gaps.slice().sort((a, b) => a[0] - b[0]);
    let a = wl.a;
    for (const g of gaps.concat([[wl.b, wl.b]])) {
      if (g[0] - a > 0.05)
        shapes.push(wl.v ? Rc(snap1(wl.c - 0.1), snap1(a), 0.2, snap1(g[0] - a)) : Rc(snap1(a), snap1(wl.c - 0.1), snap1(g[0] - a), 0.2));
      a = Math.max(a, g[1]);
    }
  }
  return {shapes, startAt: [1.2, 1.2]};
}
// Warehouse: rows of racks across the floor, a perimeter aisle round them, cross aisles at random places, and, with
// some chance per rack, a gap through it as wide as an aisle
function genWarehouse(w, h, p, u) {
  const a = p.aisle,
    d = p.depth,
    m = Math.max(a, 1.6) + 0.2,
    shapes = [];
  let n = Math.floor((h - 2 * m + a) / (d + a));
  if (n < 1) n = 1;
  const used = n * d + (n - 1) * a,
    y0 = Math.max(0.2 + 1.2, m + (h - 2 * m - used) / 2),
    x0 = m,
    x1 = w - m;
  // the cross aisles: k cuts of width a at random places, every rack piece at least 1.6 m long
  let cuts = [];
  for (let k = p.cross; k > 0 && !cuts.length; k--) {
    for (let t = 0; t < 40 && cuts.length < k; t++) {
      const c = x0 + 1.6 + u() * (x1 - x0 - 3.2 - a);
      if (cuts.every(q => Math.abs(q - c) >= a + 1.6)) cuts.push(c);
    }
    if (cuts.length < k) cuts = [];
  }
  cuts.sort((q, r) => q - r);
  const pieces = [];
  let s = x0;
  for (const c of cuts) {
    pieces.push([s, c]);
    s = c + a;
  }
  pieces.push([s, x1]);
  for (let r = 0; r < n; r++) {
    const y = snap1(y0 + r * (d + a));
    if (y + d > h - 1.4) break;
    for (const [pa, pb] of pieces) {
      if (pb - pa < 1.2) continue;
      if (u() < p.gaps && pb - pa >= 2 * 1.2 + a) {
        const g = pa + 1.2 + u() * (pb - pa - 2.4 - a);
        shapes.push(Rc(snap1(pa), y, snap1(g - pa), d), Rc(snap1(g + a), y, snap1(pb - g - a), d));
      } else shapes.push(Rc(snap1(pa), y, snap1(pb - pa), d));
    }
  }
  return {shapes, startAt: [1.0, 1.0]};
}
// Open hall: pillars (circles) and boxes at random places, each at least `gap` from the others and from the walls
function genHall(w, h, p, u) {
  const shapes = [],
    count = Math.round((p.density * w * h) / 100),
    wallsIn = [Rc(0, 0, w, 0.2), Rc(0, h - 0.2, w, 0.2), Rc(0, 0, 0.2, h), Rc(w - 0.2, 0, 0.2, h)],
    keep = Ci(1.5, 1.5, 1.2);
  for (let t = 0; t < count * 40 && shapes.length < count; t++) {
    let s;
    if (u() < p.round) {
      const r = snap1(0.25 + u() * 0.55);
      s = Ci(snap1(r + u() * (w - 2 * r)), snap1(r + u() * (h - 2 * r)), r);
    } else {
      const bw = snap1(0.4 + u() * 2),
        bh = snap1(0.4 + u() * 2);
      s = Rc(snap1(u() * (w - bw)), snap1(u() * (h - bh)), bw, bh);
    }
    if (wallsIn.some(q => shapeGap(s, q) < p.gap) || shapeGap(s, keep) < 0.3) continue;
    if (shapes.some(q => shapeGap(s, q) < p.gap)) continue;
    shapes.push(s);
  }
  return {shapes, startAt: [1.5, 1.5]};
}
const GEN_BUILD = {rooms: genRooms, warehouse: genWarehouse, hall: genHall};

/* ---------- placing the start, the goals, the beacons and the people ---------- */
// The level of a spec, in the level format
function genLevel(spec) {
  const sp = genSpec(spec),
    F = GEN_FAMILIES[sp.gen],
    {w, h} = sp,
    u = mulberry32((Math.imul(sp.seed, 2654435761) ^ [...sp.gen].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) >>> 0),
    built = GEN_BUILD[sp.gen](w, h, sp, u),
    shapes = built.shapes,
    gw = Math.round(w / RES),
    gh = Math.round(h / RES),
    occ = rasterize(border(w, h).concat(shapes), gw, gh),
    dist = distanceTransform(occ, gw, gh),
    at = (x, y) => {
      const i = Math.floor(x / RES),
        j = Math.floor(y / RES);
      return i < 0 || j < 0 || i >= gw || j >= gh ? -1 : j * gw + i;
    },
    cx = k => ((k % gw) + 0.5) * RES,
    cy = k => (((k / gw) | 0) + 0.5) * RES;
  // the free cells connected to k through cells at least thr from an obstacle, 8-connected without cutting corners
  const flood = (k, thr) => {
    const m = new Uint8Array(gw * gh),
      q = [k];
    if (k < 0 || dist[k] < thr) return m;
    m[k] = 1;
    while (q.length) {
      const c = q.pop(),
        i = c % gw,
        j = (c / gw) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di,
            jj = j + dj;
          if ((!di && !dj) || ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
          const v = jj * gw + ii;
          if (m[v] || dist[v] < thr) continue;
          if (di && dj && (dist[j * gw + ii] < thr || dist[jj * gw + i] < thr)) continue;
          m[v] = 1;
          q.push(v);
        }
    }
    return m;
  };
  // the start: the free cell 0.7 m clear nearest the family's corner, facing the longest free run of the eight directions
  let s0 = -1,
    best = Infinity;
  for (let k = 0; k < gw * gh; k++) {
    if (dist[k] < 0.7) continue;
    const d = hyp(cx(k) - built.startAt[0], cy(k) - built.startAt[1]);
    if (d < best) {
      best = d;
      s0 = k;
    }
  }
  if (s0 < 0) throw new Error('the generated floor has no free space for the start');
  const sx = snap1(cx(s0)),
    sy = snap1(cy(s0));
  let th = 0,
    run = -1;
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4;
    let r = 0;
    while (r < 8) {
      const k = at(sx + (r + 0.1) * Math.cos(t), sy + (r + 0.1) * Math.sin(t));
      if (k < 0 || dist[k] < LETHAL) break;
      r += 0.1;
    }
    if (r > run + 1e-9) {
      run = r;
      th = t;
    }
  }
  const reach = flood(at(sx, sy), LETHAL + 0.05),
    cells = [];
  for (let k = 0; k < gw * gh; k++) if (reach[k] && dist[k] >= 0.6) cells.push(k);
  if (cells.length < 50) throw new Error('the generated floor leaves the robot almost no room');
  // the goals: spread out over the reachable floor, each at least dmin from the start and the goals before it
  const goals = [],
    away = (x, y, pts, dm) => pts.every(q => hyp(q[0] - x, q[1] - y) >= dm);
  let dmin = clamp(Math.sqrt((w * h) / (sp.goals + 1)) * 0.8, 2, 8);
  while (goals.length < sp.goals && dmin > 0.5) {
    let got = false;
    for (let t = 0; t < 300 && !got; t++) {
      const k = cells[Math.floor(u() * cells.length)],
        x = snap1(cx(k)),
        y = snap1(cy(k)),
        kk = at(x, y);
      if (!reach[kk] || dist[kk] < 0.6 || !away(x, y, [[sx, sy], ...goals], dmin)) continue;
      goals.push([x, y]);
      got = true;
    }
    if (!got) dmin *= 0.8;
  }
  // the beacons: farthest-point sampling over the cells 0.2–0.32 m from a wall that open onto the robot's floor
  const loose = flood(at(sx, sy), 0.15),
    cand = [];
  for (let k = 0; k < gw * gh; k++) if (loose[k] && dist[k] >= 0.2 && dist[k] <= 0.32) cand.push(k);
  const nb = Math.min(cand.length, sp.beacons || Math.max(4, Math.round((w * h) / 32))),
    beacons = [];
  if (nb) {
    const md = new Float64Array(cand.length).fill(Infinity);
    let pick = Math.floor(u() * cand.length);
    for (let b = 0; b < nb; b++) {
      const bx = cx(cand[pick]),
        by = cy(cand[pick]);
      beacons.push([Math.round(bx * 100) / 100, Math.round(by * 100) / 100]);
      let far = -1;
      for (let c = 0; c < cand.length; c++) {
        const d = hyp(cx(cand[c]) - bx, cy(cand[c]) - by);
        if (d < md[c]) md[c] = d;
        if (md[c] > far) {
          far = md[c];
          pick = c;
        }
      }
      if (far < 1) break;
    }
  }
  // the people: straight runs of floor 0.6 m clear, 4–16 m long, along x or y, not over the start
  const people = [];
  for (let t = 0; t < 400 && people.length < sp.people; t++) {
    const k = cells[Math.floor(u() * cells.length)],
      along = sp.gen === 'warehouse' ? u() < 0.7 : u() < 0.5,
      ox = cx(k),
      oy = cy(k);
    if (dist[k] < 0.7) continue;
    const ext = dir => {
      let r = 0;
      while (r < 8) {
        const kk = along ? at(ox + dir * (r + 0.1), oy) : at(ox, oy + dir * (r + 0.1));
        if (kk < 0 || dist[kk] < 0.6) break;
        r += 0.1;
      }
      return r;
    };
    const r0 = ext(-1),
      r1 = ext(1);
    if (r0 + r1 < 4) continue;
    const a = along ? [snap1(ox - r0 + 0.2), snap1(oy)] : [snap1(ox), snap1(oy - r0 + 0.2)],
      b = along ? [snap1(ox + r1 - 0.2), snap1(oy)] : [snap1(ox), snap1(oy + r1 - 0.2)];
    // clear of the start, and not on top of another route
    const segD = (q, A, B) => {
      const L2 = (B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2,
        f = clamp(((q[0] - A[0]) * (B[0] - A[0]) + (q[1] - A[1]) * (B[1] - A[1])) / L2, 0, 1);
      return hyp(q[0] - A[0] - f * (B[0] - A[0]), q[1] - A[1] - f * (B[1] - A[1]));
    };
    if (segD([sx, sy], a, b) < 1.5) continue;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (people.some(q => segD(mid, q.from, q.to) < 1.5)) continue;
    const pause = u() < 0.3;
    people.push({
      from: a,
      to: b,
      speed: snap1(0.5 + u() * 0.4),
      phase: Math.round(u() * 20) / 20,
      mode: pause ? 'pause' : 'shuttle',
      ...(pause ? {wait: snap1(1 + u() * 2)} : {})
    });
  }
  const like = LEVELS.find(L => L.id === sp.like),
    settings = {};
  for (const [k, v] of Object.entries(like.cfg)) if (!LEVEL_NOSET.includes(k)) settings[k] = v;
  const fmt = s => (s.t === 'c' ? {circle: [s.x, s.y, s.r]} : {rect: [s.x, s.y, s.w, s.h]});
  return {
    format: LEVEL_FORMAT,
    version: 1,
    name: `${F.name} ${w} × ${h} · seed ${sp.seed}`,
    about: `Generated: ${F.about}. ${goals.length} goals, ${people.length ? people.length + (people.length > 1 ? ' people' : ' person') : 'nobody'} walking, the settings of ${like.id} ${like.name}.`,
    size: [w, h],
    walls: true,
    shapes: shapes.map(fmt),
    beacons,
    start: [sx, sy, th],
    goals,
    people,
    settings,
    ...(like.layers && like.layers.cost ? {layers: {cost: true}} : {}),
    gen: sp
  };
}
