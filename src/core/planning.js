/* ============================================================
   Motion planning: straight line / A* / RRT*
   ============================================================ */
const NB = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQ2],
  [1, -1, SQ2],
  [-1, 1, SQ2],
  [-1, -1, SQ2]
];
// @code astar | gridSearch: A* on the costmap, with ε and the trace
function gridSearch(s, g, eps, tr) {
  // tr: an object to receive the expansion order (closedAt, openAt: 1-based step)
  const cm = S.cm,
    gs = new Float32Array(NC).fill(Infinity),
    par = new Int32Array(NC).fill(-1),
    closed = new Uint8Array(NC),
    heap = new Heap();
  const gi = g >= 0 ? g % GW : 0,
    gj = g >= 0 ? (g / GW) | 0 : 0;
  const h = (i, j) => {
    if (g < 0) return 0;
    const dx = Math.abs(i - gi),
      dy = Math.abs(j - gj);
    return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * RES * eps;
  };
  gs[s] = 0;
  heap.push(s, h(s % GW, (s / GW) | 0));
  let exp = 0,
    found = false;
  if (tr) {
    tr.order = new Int32Array(NC);
    tr.closedAt = new Int32Array(NC);
    tr.openAt = new Int32Array(NC).fill(-1);
    tr.openAt[s] = 0;
  }
  while (heap.size) {
    const u = heap.pop();
    if (closed[u]) continue;
    closed[u] = 1;
    exp++;
    if (tr) {
      tr.order[exp - 1] = u;
      tr.closedAt[u] = exp;
    }
    if (u === g) {
      found = true;
      break;
    }
    const ui = u % GW,
      uj = (u / GW) | 0;
    for (const [di, dj, c] of NB) {
      const vi = ui + di,
        vj = uj + dj;
      if (vi < 0 || vj < 0 || vi >= GW || vj >= GH) continue;
      const v = vj * GW + vi;
      if (cm.lethal[v] || closed[v]) continue;
      if (di && dj && (cm.lethal[uj * GW + vi] || cm.lethal[vj * GW + ui])) continue;
      const ng = gs[u] + c * RES * (1 + PENW * cm.pen[v]);
      if (ng < gs[v]) {
        gs[v] = ng;
        par[v] = u;
        heap.push(v, ng + h(vi, vj));
        if (tr && tr.openAt[v] < 0) tr.openAt[v] = exp;
      }
    }
  }
  return {gs, par, closed, exp, found};
}
// @end
const center = k => [((k % GW) + 0.5) * RES, (((k / GW) | 0) + 0.5) * RES];
function smoothPath(pts) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segClear(pts[i][0], pts[i][1], pts[j][0], pts[j][1], LETHAL + 0.1, i === 0)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
function pathLen(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += hyp(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
function astar(sx, sy, gx, gy) {
  let s = cellIdx(sx, sy),
    g = cellIdx(gx, gy);
  if (s < 0 || g < 0) return {ok: false, reason: 'outside the map'};
  if (S.cm.lethal[g]) return {ok: false, reason: goalBlocked(gx, gy) || 'goal is inside an inflated obstacle'};
  if (S.cm.lethal[s]) {
    s = nearestFree(s);
    if (s < 0) return {ok: false, reason: 'start is enclosed'};
  }
  const tr = {},
    R = gridSearch(s, g, P.eps, tr);
  S.search = {type: 'astar', closed: R.closed};
  S.searchTrace = {type: 'grid', name: 'A*', n: R.exp, order: tr.order, closedAt: tr.closedAt, openAt: tr.openAt, par: R.par}; // for step-by-step playback
  if (!R.found) return {ok: false, reason: 'no route in the current costmap', exp: R.exp};
  const cells = [];
  for (let k = g; k >= 0; k = R.par[k]) cells.push(k);
  cells.reverse();
  // keep only turning points
  let pts = [[sx, sy]];
  for (let k = 1; k < cells.length - 1; k++) {
    const a = cells[k - 1],
      b = cells[k],
      c = cells[k + 1];
    if (b - a !== c - b) pts.push(center(b));
  }
  pts.push([gx, gy]);
  if (P.smooth) pts = smoothPath(pts);
  return {ok: true, pts, exp: R.exp, cost: R.gs[g]};
}
// RRT*: sample, steer from the nearest node, connect to the cheapest parent within the radius, rewire; the radius shrinks with n.
// @code rrtstar | rrtstar: sampling, the nearest node, choosing a parent and rewiring
function rrtstar(sx, sy, gx, gy) {
  const g = S.rngA,
    cm = S.cm;
  const gk = cellIdx(gx, gy);
  if (gk < 0 || cm.lethal[gk]) return {ok: false, reason: (gk >= 0 && goalBlocked(gx, gy)) || 'goal is inside an inflated obstacle'};
  const X = [sx],
    Y = [sy],
    Pa = [-1],
    Co = [0],
    step = 0.6,
    gam = 8,
    Pa0 = [-1],
    QX = [sx],
    QY = [sy],
    rew = []; // Pa0, QX/QY, rew: for playback
  for (let it = 0; it < P.rrtIt; it++) {
    let qx, qy;
    if (g.u() < 0.1) {
      qx = gx;
      qy = gy;
    } else {
      qx = g.u() * W;
      qy = g.u() * H;
    }
    let ni = 0,
      nd = Infinity;
    for (let i = 0; i < X.length; i++) {
      const d = (X[i] - qx) ** 2 + (Y[i] - qy) ** 2;
      if (d < nd) {
        nd = d;
        ni = i;
      }
    }
    const d = Math.sqrt(nd);
    if (d < 1e-6) continue;
    const sc = Math.min(step, d) / d,
      nx = X[ni] + (qx - X[ni]) * sc,
      ny = Y[ni] + (qy - Y[ni]) * sc;
    const nk = cellIdx(nx, ny);
    if (nk < 0 || cm.lethal[nk]) continue;
    const n = X.length,
      rad = Math.min(gam * Math.sqrt(Math.log(n + 1) / (n + 1)), 1.5),
      r2 = rad * rad;
    const near = [];
    for (let i = 0; i < n; i++) if ((X[i] - nx) ** 2 + (Y[i] - ny) ** 2 <= r2) near.push(i);
    let bp = -1,
      bc = Infinity;
    if (segClear(X[ni], Y[ni], nx, ny, LETHAL + 0.05, ni === 0)) {
      bp = ni;
      bc = Co[ni] + hyp(nx - X[ni], ny - Y[ni]);
    }
    for (const i of near) {
      const c = Co[i] + hyp(nx - X[i], ny - Y[i]);
      if (c < bc && segClear(X[i], Y[i], nx, ny, LETHAL + 0.05, i === 0)) {
        bc = c;
        bp = i;
      }
    }
    if (bp < 0) continue;
    X.push(nx);
    Y.push(ny);
    Pa.push(bp);
    Co.push(bc);
    Pa0.push(bp);
    QX.push(qx);
    QY.push(qy);
    for (const i of near) {
      if (i === bp || i === 0) continue;
      const c = bc + hyp(nx - X[i], ny - Y[i]);
      if (c < Co[i] && segClear(nx, ny, X[i], Y[i], LETHAL + 0.05, false)) {
        Pa[i] = n;
        Co[i] = c;
        rew.push(n, i);
      }
    }
  }
  // connect best node to goal (walk parents for true cost)
  let best = -1,
    bc = Infinity;
  for (let i = 0; i < X.length; i++) {
    const dg = hyp(X[i] - gx, Y[i] - gy);
    if (dg > 1.0) continue;
    if (!segClear(X[i], Y[i], gx, gy, LETHAL + 0.05, i === 0)) continue;
    let c = dg,
      k = i;
    while (Pa[k] >= 0) {
      c += hyp(X[k] - X[Pa[k]], Y[k] - Y[Pa[k]]);
      k = Pa[k];
    }
    if (c < bc) {
      bc = c;
      best = i;
    }
  }
  S.search = {type: 'rrt', X, Y, Pa};
  S.searchTrace = {type: 'rrt', name: 'RRT*', n: X.length, X, Y, Pa0, QX, QY, rew};
  if (best < 0) return {ok: false, reason: `no connection to the goal after ${P.rrtIt} samples`, exp: X.length};
  let pts = [[gx, gy]];
  for (let k = best; k >= 0; k = Pa[k]) pts.push([X[k], Y[k]]);
  pts.reverse();
  if (P.smooth) pts = smoothPath(pts);
  return {ok: true, pts, exp: X.length, cost: pathLen(pts)};
}
// @end

/* RS_BEGIN */
const RS = (() => {
  const PI = Math.PI,
    HP = PI / 2,
    sin = Math.sin,
    cos = Math.cos;
  const M = x => {
    let v = x % (2 * PI);
    if (v < -PI) v += 2 * PI;
    else if (v > PI) v -= 2 * PI;
    return v;
  };
  const pol = (x, y) => [Math.hypot(x, y), Math.atan2(y, x)];
  // Path families in normalized units (turning radius 1). Signed lengths: negative = reverse.
  function LSL(x, y, p) {
    const [u, t] = pol(x - sin(p), y - 1 + cos(p));
    if (t >= 0 && t <= PI) {
      const v = M(p - t);
      if (v >= 0 && v <= PI) return [[t, u, v], 'LSL'];
    }
    return null;
  }
  function LSR(x, y, p) {
    let [u1, t1] = pol(x + sin(p), y - 1 - cos(p));
    u1 *= u1;
    if (u1 >= 4) {
      const u = Math.sqrt(u1 - 4),
        th = Math.atan2(2, u),
        t = M(t1 + th),
        v = M(t - p);
      if (t >= 0 && v >= 0) return [[t, u, v], 'LSR'];
    }
    return null;
  }
  function LxRxL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 <= 4) {
      const A = Math.acos(0.25 * u1),
        t = M(A + th + HP),
        u = M(PI - 2 * A),
        v = M(p - t - u);
      return [[t, -u, v], 'LRL'];
    }
    return null;
  }
  function LxRL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 <= 4) {
      const A = Math.acos(0.25 * u1),
        t = M(A + th + HP),
        u = M(PI - 2 * A),
        v = M(-p + t + u);
      return [[t, -u, -v], 'LRL'];
    }
    return null;
  }
  function LRxL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 <= 4 && u1 > 1e-9) {
      const u = Math.acos(1 - u1 * u1 * 0.125),
        A = Math.asin(Math.max(-1, Math.min(1, (2 * sin(u)) / u1))),
        t = M(-A + th + HP),
        v = M(t - u - p);
      return [[t, u, -v], 'LRL'];
    }
    return null;
  }
  function LRxLR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 <= 2) {
      const A = Math.acos((u1 + 2) * 0.25),
        t = M(th + A + HP),
        u = M(A),
        v = M(p - t + 2 * u);
      if (t >= 0 && u >= 0 && v >= 0) return [[t, u, -u, -v], 'LRLR'];
    }
    return null;
  }
  function LxRLxR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    const u2 = (20 - u1 * u1) / 16;
    if (u2 >= 0 && u2 <= 1 && u1 > 1e-9) {
      const u = Math.acos(u2),
        A = Math.asin(Math.max(-1, Math.min(1, (2 * sin(u)) / u1))),
        t = M(th + A + HP),
        v = M(t - p);
      if (t >= 0 && v >= 0) return [[t, -u, -u, v], 'LRLR'];
    }
    return null;
  }
  function LxR90SL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 >= 2) {
      const q = Math.sqrt(u1 * u1 - 4),
        u = q - 2,
        A = Math.atan2(2, q),
        t = M(th + A + HP),
        v = M(t - p + HP);
      if (t >= 0 && v >= 0) return [[t, -HP, -u, -v], 'LRSL'];
    }
    return null;
  }
  function LSR90xL(x, y, p) {
    const [u1, th] = pol(x - sin(p), y - 1 + cos(p));
    if (u1 >= 2) {
      const q = Math.sqrt(u1 * u1 - 4),
        u = q - 2,
        A = Math.atan2(q, 2),
        t = M(th - A + HP),
        v = M(t - p - HP);
      if (t >= 0 && v >= 0) return [[t, u, HP, -v], 'LSRL'];
    }
    return null;
  }
  function LxR90SR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 >= 2) {
      const t = M(th + HP),
        u = u1 - 2,
        v = M(p - t - HP);
      if (t >= 0 && v >= 0) return [[t, -HP, -u, -v], 'LRSR'];
    }
    return null;
  }
  function LSL90xR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 >= 2) {
      const t = M(th),
        u = u1 - 2,
        v = M(p - t - HP);
      if (t >= 0 && v >= 0) return [[t, u, HP, -v], 'LSLR'];
    }
    return null;
  }
  function LxR90SL90xR(x, y, p) {
    const [u1, th] = pol(x + sin(p), y - 1 - cos(p));
    if (u1 >= 4) {
      const q = Math.sqrt(u1 * u1 - 4),
        u = q - 4,
        A = Math.atan2(2, q),
        t = M(th + A + HP),
        v = M(t - p);
      if (t >= 0 && v >= 0) return [[t, -HP, -u, -HP, v], 'LRSLR'];
    }
    return null;
  }
  const FAMS = [LSL, LSR, LxRxL, LxRL, LRxL, LRxLR, LxRLxR, LxR90SL, LSR90xL, LxR90SR, LSL90xR, LxR90SL90xR];
  const flip = s => s.replace(/[LR]/g, c => (c === 'L' ? 'R' : 'L'));
  function cands(x, y, p) {
    const out = [];
    for (let f = 0; f < FAMS.length; f++) {
      const F = FAMS[f];
      let r;
      if ((r = F(x, y, p))) out.push({L: r[0], T: r[1], f});
      if ((r = F(-x, y, -p))) out.push({L: r[0].map(d => -d), T: r[1], f});
      if ((r = F(x, -y, -p))) out.push({L: r[0], T: flip(r[1]), f});
      if ((r = F(-x, -y, p))) out.push({L: r[0].map(d => -d), T: flip(r[1]), f});
    }
    for (const c of out) {
      let s = 0;
      for (const d of c.L) s += Math.abs(d);
      c.len = s;
    }
    return out.filter(c => isFinite(c.len)).sort((a, b) => a.len - b.len);
  }
  function norm(q0, q1, R) {
    const dx = q1[0] - q0[0],
      dy = q1[1] - q0[1],
      c = cos(q0[2]),
      s = sin(q0[2]);
    return [(c * dx + s * dy) / R, (-s * dx + c * dy) / R, wrap(q1[2] - q0[2])];
  }
  function endpoint(q0, c, R) {
    let x = q0[0],
      y = q0[1],
      th = q0[2];
    for (let i = 0; i < c.L.length; i++) {
      const d = c.L[i],
        t = c.T[i];
      if (t === 'S') {
        x += R * d * cos(th);
        y += R * d * sin(th);
      } else if (t === 'L') {
        const t2 = th + d;
        x += R * (sin(t2) - sin(th));
        y += R * (-cos(t2) + cos(th));
        th = t2;
      } else {
        const t2 = th - d;
        x += R * (-sin(t2) + sin(th));
        y += R * (cos(t2) - cos(th));
        th = t2;
      }
    }
    return [x, y, wrap(th)];
  }
  function valid(q0, q1, c, R) {
    const e = endpoint(q0, c, R);
    return hyp(e[0] - q1[0], e[1] - q1[1]) < 1e-3 * Math.max(1, R) && Math.abs(wrap(e[2] - q1[2])) < 1e-3;
  }
  // All endpoint-verified candidates, shortest first
  function solve(q0, q1, R) {
    const [x, y, p] = norm(q0, q1, R);
    return cands(x, y, p).filter(c => valid(q0, q1, c, R));
  }
  // Length only (for the heuristic): shortest verified length in metres
  function length(q0, q1, R) {
    const [x, y, p] = norm(q0, q1, R);
    for (const c of cands(x, y, p)) if (valid(q0, q1, c, R)) return c.len * R;
    return Infinity;
  }
  // Sample poses every ds metres, split into legs by gear
  function sample(q0, c, R, ds) {
    const segs = [];
    let x = q0[0],
      y = q0[1],
      th = q0[2],
      cur = null;
    for (let i = 0; i < c.L.length; i++) {
      const d = c.L[i],
        t = c.T[i],
        dir = d >= 0 ? 1 : -1,
        len = Math.abs(d) * R;
      if (len < 1e-6) continue;
      if (!cur || cur.dir !== dir) {
        cur = {dir, pts: [[x, y, th]]};
        segs.push(cur);
      }
      const n = Math.max(1, Math.ceil(len / ds)),
        x0 = x,
        y0 = y,
        t0 = th;
      for (let k = 1; k <= n; k++) {
        const dk = (d * k) / n;
        let xx, yy, tt;
        if (t === 'S') {
          xx = x0 + R * dk * cos(t0);
          yy = y0 + R * dk * sin(t0);
          tt = t0;
        } else if (t === 'L') {
          tt = t0 + dk;
          xx = x0 + R * (sin(tt) - sin(t0));
          yy = y0 + R * (-cos(tt) + cos(t0));
        } else {
          tt = t0 - dk;
          xx = x0 + R * (-sin(tt) + sin(t0));
          yy = y0 + R * (cos(tt) - cos(t0));
        }
        cur.pts.push([xx, yy, wrap(tt)]);
      }
      const l = cur.pts[cur.pts.length - 1];
      x = l[0];
      y = l[1];
      th = l[2];
    }
    return segs;
  }
  return {solve, length, sample, endpoint, cands, norm, valid, NF: FAMS.length};
})();
