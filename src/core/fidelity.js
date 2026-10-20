/* ============================================================
   Fidelity: sensor latency, reactive pedestrians (social force), other vehicles
   ============================================================ */
// ---- sensor latency: measurements are produced now and delivered sensLat/DT ticks later ----
function sensEnqueue(kind, data) {
  const n = Math.round((P.sensLat || 0) / DT);
  if (!S.sensQ) S.sensQ = [];
  S.sensQ.push({due: S.tick + n, kind, data});
}
// @code sens-deliver | sensDeliver: readings delivered late, by latency
function sensDeliver() {
  S.deliv = {scan: null, z: null, gnss: null};
  if (!S.sensQ || !S.sensQ.length) return;
  const keep = [];
  for (const it of S.sensQ) {
    if (it.due > S.tick) {
      keep.push(it);
      continue;
    }
    if (it.kind === 'lidar') {
      lidarApply(it.data);
      S.deliv.scan = it.data;
    } else if (it.kind === 'gnss') {
      gnssApply(it.data);
      S.deliv.gnss = it.data;
    } else {
      beaconsApply(it.data);
      S.deliv.z = it.data;
    }
  }
  S.sensQ = keep;
}
// @end
function lidarApply(ranges) {
  S.scan = ranges;
  const e = S.est,
    pts = [];
  for (let k = 0; k < NBEAM; k++) {
    if (ranges[k] >= LMAX - 1e-3) continue;
    const a = e.th - Math.PI + (k * TAU) / NBEAM;
    pts.push([e.x + ranges[k] * Math.cos(a), e.y + ranges[k] * Math.sin(a), k]); // with the beam index (the learned detector's colouring)
  }
  S.scanPts = pts;
  S.scanTick = S.tick;
  if (P.per === 'mapping') integrateScan(ranges);
  if (P.loc === 'pf' && P.pfLidar && P.per === 'oracle' && S.tick % 4 === 3) pfLidarUpdate(ranges);
  if (P.loc === 'ekf' && P.scanMatch && P.per === 'oracle' && S.tick % 4 === 3) ekfScanUpdate(ranges); // 5 Hz, like the PF's
  if (P.loc === 'pgslam') pgLidar(ranges);
}
function beaconsApply(z) {
  S.lastZ = z;
  if (P.loc === 'ekf') ekfUpdate(z);
  else if (P.loc === 'pf') pfUpdate(z);
  else if (P.loc === 'slam') slamUpdate(z);
}

// ---- people ----
// scripted: back and forth on a segment (the original). reactive: social forces toward the segment's far end,
// away from the robot, other people and walls (Helbing & Molnár 1995, simplified).
const SF = {tau: 0.5, A: 2.0, B: 0.35, Ar: 3.0, Br: 0.5, Aw: 2.5, Bw: 0.25};
function pedGoal(p) {
  return p.dir > 0 ? p.b : p.a;
}
// @code social-force | updatePedsReactive: people as social forces
function updatePedsReactive(dt) {
  const r = S.robot,
    ps = S.peds.filter(p => !p.car);
  for (const p of ps) {
    if (p.wait > 0) {
      p.wait -= dt;
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    const g = pedGoal(p),
      dx = g[0] - p.x,
      dy = g[1] - p.y,
      d = hyp(dx, dy);
    if (d < 0.25) {
      p.dir = -p.dir;
      p.wait = p.dw || 0.5;
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    const ex = dx / d,
      ey = dy / d;
    let fx = (p.v * ex - (p.vx || 0)) / SF.tau,
      fy = (p.v * ey - (p.vy || 0)) / SF.tau;
    // the robot
    {
      const ddx = p.x - r.x,
        ddy = p.y - r.y,
        dd = hyp(ddx, ddy) || 1e-6,
        rr = p.r + (isCar() ? 0.55 : RR),
        f = SF.Ar * Math.exp((rr - dd) / SF.Br);
      fx += (f * ddx) / dd;
      fy += (f * ddy) / dd;
    }
    // other people and vehicles
    for (const q of S.peds) {
      if (q === p) continue;
      const ddx = p.x - q.x,
        ddy = p.y - q.y,
        dd = hyp(ddx, ddy) || 1e-6,
        f = SF.A * Math.exp((p.r + q.r - dd) / SF.B);
      fx += (f * ddx) / dd;
      fy += (f * ddy) / dd;
    }
    // walls: gradient of the distance field
    {
      const k = cellIdx(p.x, p.y);
      if (k >= 0) {
        const D = LV.truthDist,
          i = k % GW,
          j = (k / GW) | 0,
          gx = (D[j * GW + Math.min(GW - 1, i + 1)] - D[j * GW + Math.max(0, i - 1)]) / (2 * RES),
          gy = (D[Math.min(GH - 1, j + 1) * GW + i] - D[Math.max(0, j - 1) * GW + i]) / (2 * RES),
          f = SF.Aw * Math.exp((p.r - D[k]) / SF.Bw);
        fx += f * gx;
        fy += f * gy;
      }
    }
    let vx = (p.vx || 0) + fx * dt,
      vy = (p.vy || 0) + fy * dt;
    const sp = hyp(vx, vy),
      cap = 1.3 * p.v;
    if (sp > cap) {
      vx *= cap / sp;
      vy *= cap / sp;
    }
    const nx = p.x + vx * dt,
      ny = p.y + vy * dt,
      kn = cellIdx(nx, ny);
    if (kn >= 0 && LV.truthDist[kn] > p.r * 0.8) {
      p.x = nx;
      p.y = ny;
      p.vx = vx;
      p.vy = vy;
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    p.s = 1 - hyp(pedGoal(p)[0] - p.x, pedGoal(p)[1] - p.y) / Math.max(1e-6, hyp(p.b[0] - p.a[0], p.b[1] - p.a[1]));
  }
}
// @end
// ---- other vehicles: a car-like body on a closed loop, yielding to the ego when it is close ahead ----
function carsInit() {
  if (!LV.cars) return;
  for (const c of LV.cars) {
    const L = c.loop,
      seg = [];
    let tot = 0;
    for (let i = 0; i < L.length; i++) {
      const a = L[i],
        b = L[(i + 1) % L.length],
        l = hyp(b[0] - a[0], b[1] - a[1]);
      seg.push([tot, l]);
      tot += l;
    }
    const p = {
      car: true,
      loop: L,
      seg,
      tot,
      s: (c.s0 || 0) * tot,
      v: c.v,
      vset: c.v,
      x: 0,
      y: 0,
      th: 0,
      vx: 0,
      vy: 0,
      r: 0.5,
      len: 1.0,
      wid: 0.5,
      a: [0, 0],
      b: [0, 0],
      dir: 1
    };
    carPose(p);
    S.peds.push(p);
  }
}
function carPose(p) {
  const s = ((p.s % p.tot) + p.tot) % p.tot;
  let i = 0;
  while (i < p.seg.length - 1 && p.seg[i + 1][0] <= s) i++;
  const a = p.loop[i],
    b = p.loop[(i + 1) % p.loop.length],
    t = (s - p.seg[i][0]) / p.seg[i][1];
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  p.x = a[0] + (b[0] - a[0]) * t;
  p.y = a[1] + (b[1] - a[1]) * t;
  p.th = th;
  p.vx = p.v * Math.cos(th);
  p.vy = p.v * Math.sin(th);
}
function updateCars(dt) {
  const r = S.robot;
  for (const p of S.peds) {
    if (!p.car) continue;
    // yield: ego within 3 m ahead inside a ±35° cone, or any person within 1.5 m ahead
    const ahead = (x, y) => {
      const dx = x - p.x,
        dy = y - p.y,
        d = hyp(dx, dy),
        ang = Math.abs(wrap(Math.atan2(dy, dx) - p.th));
      return {d, ang};
    };
    let stop = false;
    {
      const q = ahead(r.x, r.y);
      if (q.d < 3.2 && q.ang < 0.6) stop = true;
    }
    for (const o of S.peds) {
      if (o === p || o.car) continue;
      const q = ahead(o.x, o.y);
      if (q.d < 1.8 && q.ang < 0.8) stop = true;
    }
    const vt = stop ? 0 : p.vset;
    p.v += clamp(vt - p.v, -1.2 * dt, 0.8 * dt);
    if (Math.abs(p.v) < 1e-3) p.v = 0;
    p.s += p.v * dt;
    carPose(p);
  }
}
function carCircles(p) {
  const c = Math.cos(p.th),
    s = Math.sin(p.th),
    out = [];
  for (const o of [-0.3, 0, 0.3]) out.push({t: 'c', x: p.x + o * c, y: p.y + o * s, r: 0.3});
  return out;
}

/* ---------- space-time A*: plans (x, y, t) on a coarse grid against the agents' predicted positions ----------
   Cells 0.2 m, time quantized by the move time at the reference speed; moves to 8 neighbours or wait.
   Agents block a cell at a time when the predicted disc (plus the robot radius and a margin) covers it;
   beyond the prediction horizon only the static map counts. The ST speed planner then enforces the timing. */
// Space-time A* for the diff-drive robot: a search over (x, y, t) with waits, against the agents' predicted positions.
// @code stastar | stAstar: A* over (cell, time) with the predicted people as moving obstacles
function stAstar(sx, sy, gx, gy) {
  const CW = 2,
    cw = RES * CW,
    gw = Math.floor(GW / CW),
    gh = Math.floor(GH / CW),
    v = Math.max(0.2, Math.min(P.vcruise, P.vmax)),
    dtc = cw / v,
    T = P.agT,
    nt = Math.ceil(T / dtc) + 1;
  const ci = x => clamp(Math.floor(x / cw), 0, gw - 1),
    cj = y => clamp(Math.floor(y / cw), 0, gh - 1);
  const si = ci(sx),
    sj = cj(sy),
    gi = ci(gx),
    gj = cj(gy);
  // static lethal on the coarse grid: any fine lethal cell inside
  const leth = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      let b = 0;
      for (let a = 0; a < CW && !b; a++) for (let c = 0; c < CW && !b; c++) if (S.cm.lethal[(j * CW + a) * GW + i * CW + c]) b = 1;
      leth[j * gw + i] = b;
    }
  if (leth[gj * gw + gi]) return {ok: false, reason: goalBlocked(gx, gy) || 'goal is inside an inflated obstacle'};
  // agent discs per time slice
  const ags = agListModes(40),
    marg = P.stMarg,
    discs = [];
  for (let k = 0; k < nt; k++) {
    const t = k * dtc;
    discs.push(
      ags.map(a => {
        const q = agPred(a, Math.min(t, T));
        return [q[0], q[1], q[2] + RR + marg];
      })
    );
  }
  const blocked = (i, j, k) => {
    if (k >= nt) return false;
    const x = (i + 0.5) * cw,
      y = (j + 0.5) * cw;
    for (const d of discs[k]) if (hyp(x - d[0], y - d[1]) < d[2]) return true;
    return false;
  };
  // heuristic: 2D grid distance (octile) in time
  const h = (i, j) => {
    const dx = Math.abs(i - gi),
      dy = Math.abs(j - gj);
    return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * dtc;
  };
  const KMAX = nt + 2,
    key = (i, j, k) => (Math.min(k, KMAX) * gh + j) * gw + i; // after the horizon all times share a key (static world)
  const gsc = new Map(),
    par = new Map(),
    heap = new Heap();
  const s0 = key(si, sj, 0);
  gsc.set(s0, 0);
  heap.push(s0, h(si, sj));
  const NB8 = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, SQ2],
    [1, -1, SQ2],
    [-1, 1, SQ2],
    [-1, -1, SQ2],
    [0, 0, 1]
  ];
  let exp = 0,
    found = null;
  const closed = new Set();
  while (heap.size && exp < 60000) {
    const u = heap.pop();
    if (closed.has(u)) continue;
    closed.add(u);
    exp++;
    const i = u % gw,
      j = ((u / gw) | 0) % gh,
      kq = (u / (gw * gh)) | 0,
      g = gsc.get(u),
      k = Math.round(g / dtc);
    if (i === gi && j === gj) {
      found = u;
      break;
    }
    for (const [di, dj, c] of NB8) {
      const vi = i + di,
        vj = j + dj;
      if (vi < 0 || vj < 0 || vi >= gw || vj >= gh) continue;
      const vk = k + Math.round(c);
      if (di && dj && (leth[j * gw + vi] || leth[vj * gw + i])) continue;
      if (leth[vj * gw + vi] || blocked(vi, vj, vk) || (c > 1 && blocked(vi, vj, vk - 1))) continue;
      if (di === 0 && dj === 0 && vk >= nt) continue; // waiting past the horizon is pointless
      const vkey = key(vi, vj, vk),
        ng = g + c * dtc * (1 + (di === 0 && dj === 0 ? 0.2 : 0)) + (S.cm.pen[vj * CW * GW + vi * CW] || 0) * 0.3 * dtc;
      if (ng < (gsc.has(vkey) ? gsc.get(vkey) : Infinity)) {
        gsc.set(vkey, ng);
        par.set(vkey, u);
        heap.push(vkey, ng + h(vi, vj));
      }
    }
  }
  S.search = {type: 'hybrid', pts: [...closed].slice(0, 4000).flatMap(u => [((u % gw) + 0.5) * cw, ((((u / gw) | 0) % gh) + 0.5) * cw])};
  {
    const ord = [...closed],
      ix = new Map();
    ord.forEach((u, i) => ix.set(u, i)); // playback: every expansion, with its parent's index
    S.searchTrace = {
      type: 'pts',
      name: 'Space-time A*',
      n: ord.length,
      pts: ord.flatMap(u => [((u % gw) + 0.5) * cw, ((((u / gw) | 0) % gh) + 0.5) * cw]),
      pix: ord.map(u => (par.has(u) && ix.has(par.get(u)) ? ix.get(par.get(u)) : -1)),
      cell: cw
    };
  }
  if (found == null) return {ok: false, reason: 'no space-time route within the horizon', exp};
  const cells = [];
  for (let u = found; u != null; u = par.get(u)) cells.push(u);
  cells.reverse();
  const pts = [[sx, sy]];
  let prev = null;
  for (const u of cells) {
    const i = u % gw,
      j = ((u / gw) | 0) % gh;
    if (prev && prev[0] === i && prev[1] === j) continue;
    prev = [i, j];
    pts.push([(i + 0.5) * cw, (j + 0.5) * cw]);
  }
  pts.push([gx, gy]);
  const waits = cells.length - 1 - (pts.length - 2);
  return {ok: true, pts, exp, extra: waits > 0 ? `${(waits * dtc).toFixed(1)} s of waiting planned` : ''};
}
// @end
