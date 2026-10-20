/* ============================================================
   Rendering
   ============================================================ */
const cv = $('#map'),
  ctx = cv.getContext('2d');
const occCv = document.createElement('canvas');
occCv.width = GW;
occCv.height = GH;
const costCv = document.createElement('canvas');
costCv.width = GW;
costCv.height = GH;
const srchCv = document.createElement('canvas');
srchCv.width = GW;
srchCv.height = GH;
let TOK = {},
  tokKey = '';
let paintStroke = null; // a Paint or Erase drag in progress (transport.js): drawn as a preview, applied on release
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const names = [
    'bg',
    'panel',
    'ink',
    'muted',
    'line',
    'accent',
    'amber',
    'beacon',
    'rose',
    'ok',
    'warn',
    'bad',
    'map-bg',
    'obst',
    'obst-edge',
    'occ',
    'unknown',
    'grid'
  ];
  const key = names.map(n => cs.getPropertyValue('--' + n).trim()).join('|');
  if (key !== tokKey) {
    tokKey = key;
    names.forEach(n => (TOK[n] = cs.getPropertyValue('--' + n).trim()));
    dirty.occ = dirty.cost = dirty.search = true;
  }
}
function rgb(hex) {
  const h = hex.replace('#', '');
  const v =
    h.length === 3
      ? h
          .split('')
          .map(c => c + c)
          .join('')
      : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const rgba = (hex, a) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
function paintOcc() {
  const im = occCv.getContext('2d').createImageData(GW, GH),
    d = im.data,
    U = rgb(TOK.unknown),
    F = rgb(TOK['map-bg']),
    O = rgb(TOK.occ || TOK.obst);
  for (let k = 0; k < NC; k++) {
    const l = S.lo[k];
    let c, t;
    if (l < 0) {
      t = Math.min(1, -l / 2);
      c = F;
    } else {
      t = Math.min(1, l / 2);
      c = O;
    }
    d[k * 4] = U[0] + (c[0] - U[0]) * t;
    d[k * 4 + 1] = U[1] + (c[1] - U[1]) * t;
    d[k * 4 + 2] = U[2] + (c[2] - U[2]) * t;
    d[k * 4 + 3] = 255;
  }
  occCv.getContext('2d').putImageData(im, 0, 0);
}
function paintCost() {
  const im = costCv.getContext('2d').createImageData(GW, GH),
    d = im.data,
    R = rgb(TOK.rose);
  for (let k = 0; k < NC; k++) {
    const a = S.cm.lethal[k] ? 0.32 : S.cm.pen[k] * 0.2;
    d[k * 4] = R[0];
    d[k * 4 + 1] = R[1];
    d[k * 4 + 2] = R[2];
    d[k * 4 + 3] = Math.round(a * 255);
  }
  costCv.getContext('2d').putImageData(im, 0, 0);
}
function paintSearch() {
  const g = srchCv.getContext('2d');
  g.clearRect(0, 0, GW, GH);
  if (!S.search || S.search.type !== 'astar') return;
  const im = g.createImageData(GW, GH),
    d = im.data,
    A = rgb(TOK.accent),
    c = S.search.closed;
  for (let k = 0; k < NC; k++)
    if (c[k]) {
      d[k * 4] = A[0];
      d[k * 4 + 1] = A[1];
      d[k * 4 + 2] = A[2];
      d[k * 4 + 3] = 40;
    }
  g.putImageData(im, 0, 0);
}
let lastSearch = null;
const SP = {on: false, tr: null, n: 0, play: false, last: 0, dur: 6, key: '', gen: 0, paintKey: ''}; // search playback (maptools.js)
function sizeCanvas(c) {
  const r = c.getBoundingClientRect(),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * dpr)),
    h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return dpr;
}
const VIEW = {z: 1, cx: W / 2, cy: H / 2, follow: false};
// The canvas takes whatever shape its panel has; zoom 1 fits the whole world in it (letterboxed), centred. On a phone
// the view buttons overlay the right edge, so the world is fitted and centred in the width left of them (viewW) and
// the east wall's beacons stay reachable.
const phoneUI = () => matchMedia('(max-width:760px)').matches;
const viewW = () => cv.width - (phoneUI() ? Math.round(44 * Math.min(window.devicePixelRatio || 1, 2)) : 0);
const viewK0 = () => Math.min(viewW() / W, cv.height / H);
function viewClamp() {
  const kz = viewK0() * VIEW.z,
    hw = viewW() / (2 * kz),
    hh = cv.height / (2 * kz);
  VIEW.cx = hw >= W / 2 ? W / 2 : clamp(VIEW.cx, hw, W - hw);
  VIEW.cy = hh >= H / 2 ? H / 2 : clamp(VIEW.cy, hh, H - hh);
}
function viewXform() {
  const kz = viewK0() * VIEW.z;
  return {kz, tx: viewW() / 2 - VIEW.cx * kz, ty: cv.height / 2 + VIEW.cy * kz};
}
function zoomAt(f, sx, sy) {
  // sx, sy in canvas pixels
  const {kz, tx, ty} = viewXform(),
    wx = (sx - tx) / kz,
    wy = (ty - sy) / kz,
    z2 = clamp(VIEW.z * f, 1, 8);
  if (z2 === VIEW.z) return;
  VIEW.z = z2;
  if (z2 === 1) {
    VIEW.cx = W / 2;
    VIEW.cy = H / 2;
    VIEW.follow = false;
  } else {
    const kn = viewK0() * z2;
    VIEW.cx = wx - (sx - viewW() / 2) / kn;
    VIEW.cy = wy + (sy - cv.height / 2) / kn;
  }
  viewClamp();
  syncViewUI();
  draw();
}
function syncViewUI() {
  const f = $('#mv-follow');
  if (f) f.setAttribute('aria-pressed', String(VIEW.follow));
  const t = $('#mv-fit');
  if (t) t.disabled = VIEW.z === 1;
}
// The grid images (occupancy, costmap, search) are one pixel a cell: a level of another size makes them again, and the
// view, fitted to the old world, fits the new one
let viewWorld = '';
function fitWorld() {
  if (occCv.width !== GW || occCv.height !== GH)
    for (const c of [occCv, costCv, srchCv]) {
      c.width = GW;
      c.height = GH;
    }
  const key = W + 'x' + H;
  if (key === viewWorld) return;
  viewWorld = key;
  VIEW.z = 1;
  VIEW.cx = W / 2;
  VIEW.cy = H / 2;
  VIEW.follow = false;
  dirty.occ = dirty.cost = dirty.search = true;
  lastSearch = null;
  syncViewUI();
}
function draw() {
  readTokens();
  fitWorld();
  if (VIEW.follow && VIEW.z > 1 && S) {
    VIEW.cx = S.robot.x;
    VIEW.cy = S.robot.y;
    viewClamp();
  }
  const dpr = sizeCanvas(cv),
    {kz, tx, ty} = viewXform(),
    k = kz,
    px = n => (n * dpr) / k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = TOK.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, -k, tx, ty);
  ctx.fillStyle = TOK['map-bg'];
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawGrid(dpr, k, px);
  drawMapLayer(dpr, k, px);
  drawSearch(dpr, k, px);
  drawBeacons(dpr, k, px);
  drawPeople(dpr, k, px);
  drawGhostRun(dpr, k, px);
  drawTrails(dpr, k, px);
  drawBeam(dpr, k, px);
  drawLidar(dpr, k, px);
  drawSonar(dpr, k, px);
  drawPath(dpr, k, px);
  drawRollouts(dpr, k, px);
  drawAgents(dpr, k, px);
  drawSlamMap(dpr, k, px);
  drawBelief(dpr, k, px);
  drawWaypoints(dpr, k, px);
  drawRobots(dpr, k, px);
  drawOverlays(dpr, k, px);
  drawScaleBar(dpr, k, px);
}
// Velocity obstacles in world coordinates, scaled by τ: for each person a cone with its apex where the robot would be
// if it moved with the person, tangent to the person's disc at τ; the tracker's command and the chosen velocity as
// arrows of length τ·v from the robot (the command red when it lies in a cone)
function drawVO(px) {
  if (!LAYERS.vo || !S.vo || P.spd !== 'vo') return;
  const V = S.vo,
    e = S.est,
    tau = V.tau;
  ctx.lineWidth = px(1);
  for (const k of V.cones) {
    const Ax = e.x + tau * k.vx,
      Ay = e.y + tau * k.vy,
      Px = Ax + k.ax,
      Py = Ay + k.ay,
      d = hyp(k.ax, k.ay);
    if (d <= k.R) continue;
    const ang = Math.atan2(k.ay, k.ax),
      half = Math.asin(k.R / d),
      L = d + 3;
    ctx.fillStyle = rgba(TOK.rose, 0.12);
    ctx.strokeStyle = rgba(TOK.rose, 0.5);
    ctx.beginPath();
    ctx.moveTo(Ax, Ay);
    ctx.lineTo(Ax + L * Math.cos(ang - half), Ay + L * Math.sin(ang - half));
    ctx.lineTo(Ax + L * Math.cos(ang + half), Ay + L * Math.sin(ang + half));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(Px, Py, k.R, 0, TAU);
    ctx.stroke();
  }
  const arrow = (ux, uy, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = px(2);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + tau * ux, e.y + tau * uy);
    ctx.stroke();
  };
  arrow(V.pref[0], V.pref[1], rgba(isFinite(V.tHit) ? TOK.rose : TOK.ink, 0.8));
  if (V.pick) arrow(V.pick[0], V.pick[1], rgba(TOK.accent, 0.9));
}
// The pose graph: keyframes as dots, odometry edges thin, loop closures in the accent colour
function drawGraph(px) {
  if (!LAYERS.graph || !S.pg) return;
  const G = S.pg;
  ctx.lineWidth = px(1);
  ctx.strokeStyle = rgba(TOK.ink, 0.35);
  ctx.beginPath();
  for (const E of G.edges) {
    if (E.loop) continue;
    ctx.moveTo(G.nodes[E.i].x, G.nodes[E.i].y);
    ctx.lineTo(G.nodes[E.j].x, G.nodes[E.j].y);
  }
  ctx.stroke();
  ctx.lineWidth = px(2);
  ctx.strokeStyle = rgba(TOK.accent, 0.9);
  ctx.beginPath();
  for (const E of G.edges) {
    if (!E.loop) continue;
    ctx.moveTo(G.nodes[E.i].x, G.nodes[E.i].y);
    ctx.lineTo(G.nodes[E.j].x, G.nodes[E.j].y);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(TOK.ink, 0.7);
  for (const K of G.nodes) {
    ctx.beginPath();
    ctx.arc(K.x, K.y, px(2.2), 0, TAU);
    ctx.fill();
  }
}
// The frontiers (known free next to unknown) as amber cells, the chosen one brighter, while exploring
function drawFrontiers(px) {
  if (!LAYERS.frontier || !exploring() || !S.frontiers) return;
  const goal = WPS[0] && WPS[0].explore ? WPS[0].key : -1;
  for (const f of S.frontiers) {
    ctx.fillStyle = rgba(TOK.warn, f.key === goal ? 0.85 : 0.4);
    for (const k of f.cells) {
      const i = k % GW,
        j = (k - i) / GW;
      ctx.fillRect(i * RES, j * RES, RES, RES);
    }
  }
}
// The layers of the map, one function each, in drawing order (called by draw with the scale: dpr, k world→px, px(n) a size in screen px)
function drawGrid(dpr, k, px) {
  // 1 m grid
  ctx.strokeStyle = TOK.grid;
  ctx.lineWidth = px(1);
  ctx.beginPath();
  for (let x = 1; x < W; x++) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 1; y < H; y++) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}
function drawMapLayer(dpr, k, px) {
  // map
  if (P.per === 'mapping') {
    if (dirty.occ) {
      paintOcc();
      dirty.occ = false;
    }
    ctx.drawImage(occCv, 0, 0, W, H);
    if (LAYERS.ghost) {
      ctx.setLineDash([px(4), px(3)]);
      ctx.strokeStyle = rgba(TOK.muted, 0.7);
      ctx.lineWidth = px(1);
      for (const s of S.shapes) (shapePath(s), ctx.stroke());
      ctx.setLineDash([]);
    }
  } else {
    ctx.fillStyle = TOK.obst;
    ctx.strokeStyle = TOK['obst-edge'] || TOK.obst;
    ctx.lineWidth = px(1);
    for (const s of S.shapes) {
      shapePath(s);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (paintStroke) drawStroke(px);
  if (LAYERS.cost) {
    if (dirty.cost) {
      paintCost();
      dirty.cost = false;
    }
    ctx.drawImage(costCv, 0, 0, W, H);
  }
}
function drawSearch(dpr, k, px) {
  // search
  if (SP.on && running) searchPlayEnd(); // Run ends a playback
  if (SP.on) drawSearchPlay(px);
  else if (LAYERS.search && S.search) {
    if (S.search !== lastSearch || dirty.search) {
      paintSearch();
      lastSearch = S.search;
      dirty.search = false;
    }
    if (S.search.type === 'astar') ctx.drawImage(srchCv, 0, 0, W, H);
    else if (S.search.type === 'hybrid') {
      const q = S.search.pts,
        s = px(1.6);
      ctx.fillStyle = rgba(TOK.accent, 0.35);
      for (let i = 0; i < q.length; i += 2) ctx.fillRect(q[i] - s / 2, q[i + 1] - s / 2, s, s);
    } else {
      const {X, Y, Pa} = S.search;
      ctx.strokeStyle = rgba(TOK.accent, 0.28);
      ctx.lineWidth = px(1);
      ctx.beginPath();
      for (let i = 1; i < X.length; i++) {
        ctx.moveTo(X[i], Y[i]);
        ctx.lineTo(X[Pa[i]], Y[Pa[i]]);
      }
      ctx.stroke();
    }
  }
}
function drawBeacons(dpr, k, px) {
  // beacons
  // switched off: hollow and grey; down in a random outage: hollow
  {
    const off = beaconsOff();
    for (const b of S.beacons) {
      const sw = off.has(b.id),
        dn = sw || !!(S.bDown && S.bDown[b.id]);
      ctx.fillStyle = dn ? TOK['map-bg'] : TOK.beacon;
      ctx.strokeStyle = dn ? (sw ? TOK.muted : TOK.beacon) : TOK['map-bg'];
      ctx.lineWidth = px(dn ? 1.5 : 1);
      ctx.beginPath();
      const s = Math.max(0.18, px(6));
      ctx.moveTo(b.x, b.y + s);
      ctx.lineTo(b.x + s, b.y);
      ctx.lineTo(b.x, b.y - s);
      ctx.lineTo(b.x - s, b.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (sw) {
        ctx.beginPath();
        ctx.moveTo(b.x - s * 0.6, b.y - s * 0.6);
        ctx.lineTo(b.x + s * 0.6, b.y + s * 0.6);
        ctx.stroke();
      }
    }
  }
}
function drawPeople(dpr, k, px) {
  // people
  for (const p of S.peds) {
    if (p.car) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.th);
      ctx.fillStyle = rgba(TOK.warn, 0.75);
      ctx.strokeStyle = TOK.warn;
      ctx.lineWidth = px(1.5);
      ctx.beginPath();
      ctx.rect(-p.len / 2, -p.wid / 2, p.len, p.wid);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = TOK['map-bg'];
      ctx.fillRect(p.len / 2 - 0.18, -p.wid / 2 + 0.08, 0.1, p.wid - 0.16);
      ctx.restore();
      continue;
    }
    ctx.fillStyle = rgba(TOK.warn, 0.85);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = TOK.warn;
    ctx.lineWidth = px(1.5);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.vx * 0.8, p.y + p.vy * 0.8);
    ctx.stroke();
  }
}
function drawGhostRun(dpr, k, px) {
  // ghost of the previous run
  if (ghostOn()) {
    ctx.lineWidth = px(2);
    ctx.setLineDash([px(2), px(4)]);
    ctx.strokeStyle = rgba(TOK.rose, 0.55);
    polyline(GHOST.trailT);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawFrontiers(px); // frontier exploration: the frontiers of the last pick (mission.js)
  drawGraph(px); // pose-graph SLAM: keyframes and edges (pgslam.js)
  drawVO(px); // velocity obstacles: the cones and the chosen velocity (agents.js)
  drawCompare(px); // a run picked in Runs → Compare (runs.js)
  if (LAYERS.sweep) drawSweep(px); // the paths of an experiment's runs (experiments.js)
}
function drawTrails(dpr, k, px) {
  // trails
  if (LAYERS.trail) {
    ctx.lineWidth = px(1.3);
    ctx.strokeStyle = rgba(TOK.ink, 0.45);
    polyline(S.trailT);
    ctx.stroke();
    ctx.setLineDash([px(3), px(3)]);
    ctx.strokeStyle = rgba(TOK.accent, 0.7);
    polyline(S.trailE);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
function drawBeam(dpr, k, px) {
  // beacon measurements (drawn from the estimate); dead reckoning never uses them, so they are not drawn for it
  if (LAYERS.beam && P.loc !== 'truth' && P.loc !== 'dr') {
    const e = S.est;
    ctx.lineWidth = px(1);
    for (const m of S.lastZ) {
      const a = e.th + m.b,
        x = e.x + m.r * Math.cos(a),
        y = e.y + m.r * Math.sin(a);
      ctx.strokeStyle = m.fake ? rgba(TOK.bad, 0.6) : rgba(TOK.beacon, 0.6);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = m.fake ? TOK.bad : TOK.beacon;
      ctx.beginPath();
      ctx.arc(x, y, px(2.5), 0, TAU);
      ctx.fill();
    }
  }
}
function drawLidar(dpr, k, px) {
  // lidar (perceived points)
  if (LAYERS.lidar) {
    // with the learned detector the hits are coloured by their probability of lying on a person
    const bp = P.agents === 'learned' && S.agents && S.agents.beamP;
    ctx.fillStyle = TOK.amber;
    S.scanPts.forEach((p, i) => {
      if (bp) ctx.fillStyle = bp[p[2] != null ? p[2] : i] > S.agents.beamThr ? TOK.rose : TOK.amber;
      ctx.fillRect(p[0] - px(1.5), p[1] - px(1.5), px(3), px(3));
    });
  }
}
// The ultrasonic ring: each sonar's cone where it was measured, out to its reading (to the reach when no echo came
// back: dashed, in the warning colour for a specular miss, in the bad colour for a dead-zone miss), and the returned
// arc, rose when it was a neighbour's echo
function drawSonar(dpr, k, px) {
  if (!LAYERS.sonar || !P.sonar || !S.sonArcs) return;
  const old = S.t - 2 * sonCycle() - 1e-6;
  for (const A of S.sonArcs) {
    if (!A || A.t < old) continue;
    const R = A.max ? P.sonMax : A.r,
      a0 = A.th - A.w / 2,
      a1 = A.th + A.w / 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.arc(A.x, A.y, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = rgba(TOK.ok, A.max ? 0.04 : 0.1);
    ctx.fill();
    ctx.lineWidth = px(0.8);
    ctx.strokeStyle = !A.max
      ? rgba(TOK.ok, 0.45)
      : A.why === 'spec'
        ? rgba(TOK.warn, 0.6)
        : A.why === 'dead'
          ? rgba(TOK.bad, 0.7)
          : rgba(TOK.ok, 0.25);
    if (A.max) ctx.setLineDash([px(3), px(3)]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (A.max) continue;
    ctx.beginPath();
    ctx.arc(A.x, A.y, A.r, a0, a1);
    ctx.lineWidth = px(2.6);
    ctx.strokeStyle = A.why === 'xt' ? TOK.rose : TOK.ok;
    ctx.stroke();
  }
}
function drawPath(dpr, k, px) {
  // the learned policy's other candidate paths, faint by their probability: rose where they hit the inflation
  if (P.plan === 'policy' && S.policyCands && !(SP.on && SP.n < SP.tr.n))
    for (const C of S.policyCands) {
      if (C.used || C.pts.length < 2) continue;
      ctx.globalAlpha = 0.25 + 0.5 * C.p;
      ctx.strokeStyle = C.clear === false ? TOK.rose : TOK.accent;
      ctx.lineWidth = px(1.2);
      ctx.setLineDash([px(3), px(3)]);
      polyline(C.pts);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  // global path: forward legs solid, reverse legs dashed, finished legs faded
  if (S.plan && !(SP.on && SP.n < SP.tr.n)) {
    S.plan.segs.forEach((g, i) => {
      ctx.globalAlpha = i < S.segIdx ? 0.3 : 1;
      ctx.strokeStyle = g.dir > 0 ? TOK.accent : TOK.warn;
      ctx.lineWidth = px(i === S.segIdx ? 2.4 : 1.6);
      if (g.dir < 0) ctx.setLineDash([px(5), px(3)]);
      polyline(g.pts);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  }
}
function drawRollouts(dpr, k, px) {
  // DWA rollouts
  if (LAYERS.dwa && S.ctlViz && S.ctlViz.pred) {
    const V = S.ctlViz;
    ctx.fillStyle = TOK.accent;
    for (const p of V.ref) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], px(2.2), 0, TAU);
      ctx.fill();
    }
    if (V.lin) {
      ctx.strokeStyle = TOK.rose;
      ctx.lineWidth = px(2);
      ctx.setLineDash([px(4), px(3)]);
      polyline(V.lin);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = TOK.ok;
    ctx.lineWidth = px(2.5);
    polyline(V.pred);
    ctx.stroke();
    ctx.fillStyle = TOK.ok;
    for (let i = 0; i < V.pred.length; i++) {
      const p = V.pred[i];
      ctx.beginPath();
      ctx.arc(p[0], p[1], px(1.8), 0, TAU);
      ctx.fill();
    }
  }
  if (LAYERS.dwa && S.ctlViz && S.ctlViz.trajs) {
    const T = S.ctlViz.trajs;
    ctx.lineWidth = px(1);
    T.forEach((t, i) => {
      if (i === S.ctlViz.best) return;
      ctx.strokeStyle = t.ok ? rgba(TOK.muted, 0.35) : rgba(TOK.bad, 0.25);
      ctx.beginPath();
      ctx.moveTo(t.pts[0], t.pts[1]);
      for (let j = 2; j < t.pts.length; j += 2) ctx.lineTo(t.pts[j], t.pts[j + 1]);
      ctx.stroke();
    });
    if (S.ctlViz.best >= 0) {
      const t = T[S.ctlViz.best];
      ctx.strokeStyle = TOK.ok;
      ctx.lineWidth = px(2.5);
      ctx.beginPath();
      ctx.moveTo(t.pts[0], t.pts[1]);
      for (let j = 2; j < t.pts.length; j += 2) ctx.lineTo(t.pts[j], t.pts[j + 1]);
      ctx.stroke();
    }
  }
}
function drawAgents(dpr, k, px) {
  // tracked agents (estimate frame) with predicted positions, and the ego's predicted positions at the same times
  const egoM = LAYERS.agents && S.agents && agOn() ? agEgoMarks() : [];
  if (LAYERS.agents && S.agents && agOn()) {
    for (const t of S.agents.tracks) {
      if (!t.conf) {
        ctx.strokeStyle = rgba(TOK.muted, 0.8);
        ctx.lineWidth = px(1);
        ctx.setLineDash([px(2), px(2)]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const f = agPred(t, P.agT);
      ctx.strokeStyle = rgba(TOK.warn, 0.75);
      ctx.lineWidth = px(1.2);
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(f[0], f[1]);
      ctx.stroke();
      ctx.setLineDash([px(3), px(3)]);
      for (let k = 1; k <= P.agT + 1e-6; k++) {
        const q = agPred(t, k);
        ctx.strokeStyle = rgba(TOK.warn, Math.max(0.15, 0.6 - 0.1 * k));
        ctx.beginPath();
        ctx.arc(q[0], q[1], q[2], 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (P.agPred === 'learned' && t.lp) {
        // the learned futures, the more probable the bolder, next to constant velocity (thin, dashed, grey)
        const H = PRED_H[PRED_H.length - 1];
        ctx.strokeStyle = rgba(TOK.muted, 0.9);
        ctx.lineWidth = px(1);
        ctx.setLineDash([px(4), px(3)]);
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + t.vx * H, t.y + t.vy * H);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const m of t.lp.modes) {
          if (m.p < 0.05) continue;
          ctx.strokeStyle = rgba(TOK.warn, 0.25 + 0.7 * m.p);
          ctx.lineWidth = px(1 + 2.5 * m.p);
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          for (const q of m.pts) ctx.lineTo(q[0], q[1]);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = TOK.warn;
      ctx.lineWidth = px(2);
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, TAU);
      ctx.stroke();
    }
    for (const m of egoM) {
      ctx.strokeStyle = TOK.accent;
      ctx.lineWidth = px(1.5);
      ctx.fillStyle = TOK['map-bg'];
      ctx.beginPath();
      ctx.arc(m[0], m[1], px(7), 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (LAYERS.look && S.ctlViz && S.ctlViz.carrot) {
    const c = S.ctlViz.carrot,
      f = S.ctlViz.from || [S.est.x, S.est.y];
    ctx.strokeStyle = TOK.accent;
    ctx.lineWidth = px(1.5);
    ctx.beginPath();
    ctx.moveTo(f[0], f[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
    ctx.fillStyle = TOK.accent;
    ctx.beginPath();
    ctx.arc(c[0], c[1], px(4), 0, TAU);
    ctx.fill();
  }
}
function drawSlamMap(dpr, k, px) {
  // SLAM map: estimated beacon positions with their 95 % ellipses
  if (LAYERS.belief && S.slam) {
    for (const lm of slamLandmarks()) {
      ellipse(lm.x, lm.y, lm.P);
      ctx.strokeStyle = TOK.beacon;
      ctx.lineWidth = px(1.5);
      ctx.beginPath();
      ctx.moveTo(lm.x - 0.2, lm.y - 0.2);
      ctx.lineTo(lm.x + 0.2, lm.y + 0.2);
      ctx.moveTo(lm.x - 0.2, lm.y + 0.2);
      ctx.lineTo(lm.x + 0.2, lm.y - 0.2);
      ctx.stroke();
    }
  }
}
function drawBelief(dpr, k, px) {
  // belief
  if (LAYERS.belief) {
    if (S.pf) {
      const f = S.pf;
      ctx.fillStyle = rgba(TOK.rose, 0.55);
      const s = px(2.2);
      for (let i = 0; i < f.N; i++) ctx.fillRect(f.x[i] - s / 2, f.y[i] - s / 2, s, s);
    } else if (S.Pc) {
      ellipse(S.est.x, S.est.y, S.Pc);
    }
  }
}
function drawWaypoints(dpr, k, px) {
  // waypoints
  const order = S.fsm.queue;
  WPS.forEach((w, i) => {
    const q = order.indexOf(i);
    const active = q === 0 && S.fsm.state !== 'DONE';
    ctx.lineWidth = px(active ? 2.5 : 1.8);
    ctx.strokeStyle = w.done ? rgba(TOK.muted, 0.6) : active ? TOK.ok : TOK.ink;
    ctx.fillStyle = TOK['map-bg'];
    const rw = Math.max(0.32, px(10));
    ctx.beginPath();
    ctx.arc(w.x, w.y, rw, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (w.done && !w.skipped) {
      ctx.beginPath();
      ctx.moveTo(w.x - 0.15, w.y);
      ctx.lineTo(w.x - 0.03, w.y - 0.12);
      ctx.lineTo(w.x + 0.17, w.y + 0.13);
      ctx.stroke();
    }
    if (w.th != null && !w.done) {
      // target pose: heading arrow (and the car's ghost body)
      if (isCar()) {
        ctx.save();
        ctx.setLineDash([px(3), px(3)]);
        ctx.strokeStyle = active ? TOK.ok : rgba(TOK.ink, 0.6);
        ctx.lineWidth = px(1.3);
        carPath(w.x, w.y, w.th);
        ctx.stroke();
        ctx.restore();
      }
      const c = Math.cos(w.th),
        s = Math.sin(w.th),
        tip = rw + Math.max(0.4, px(14)),
        ah = Math.max(0.14, px(5));
      ctx.beginPath();
      ctx.moveTo(w.x + rw * c, w.y + rw * s);
      ctx.lineTo(w.x + tip * c, w.y + tip * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w.x + tip * c, w.y + tip * s);
      ctx.lineTo(w.x + (tip - ah) * c - ah * 0.7 * s, w.y + (tip - ah) * s + ah * 0.7 * c);
      ctx.lineTo(w.x + (tip - ah) * c + ah * 0.7 * s, w.y + (tip - ah) * s - ah * 0.7 * c);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  });
  if (poseDrag) {
    ctx.strokeStyle = TOK.ok;
    ctx.lineWidth = px(2);
    ctx.beginPath();
    ctx.moveTo(poseDrag.x, poseDrag.y);
    ctx.lineTo(poseDrag.x2, poseDrag.y2);
    ctx.stroke();
    if (isCar() && hyp(poseDrag.x2 - poseDrag.x, poseDrag.y2 - poseDrag.y) > 0.3) {
      ctx.setLineDash([px(3), px(3)]);
      carPath(poseDrag.x, poseDrag.y, Math.atan2(poseDrag.y2 - poseDrag.y, poseDrag.x2 - poseDrag.x));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
function drawRobots(dpr, k, px) {
  // robots
  robotShape(S.est.x, S.est.y, S.est.th, false, px);
  robotShape(S.robot.x, S.robot.y, S.robot.th, true, px);
  const sg = LAYERS.slip && isDyn() ? slipGeom(S.robot, px) : null;
  if (sg) slipArrow(sg, px);
  drawHoverGhost(px); // the robot at the time hovered on the timeline or the plot (replay.js)
  drawSelection(px); // the Select tool's pick (maptools.js)
}
function drawOverlays(dpr, k, px) {
  // text overlays in screen space: agent ids and prediction times, the ego's prediction times, the sideslip angle, goal numbers
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const {tx, ty} = viewXform(),
    toS = (x, y) => [x * k + tx, ty - y * k],
    egoM = LAYERS.agents && S.agents && agOn() ? agEgoMarks() : [],
    sg = LAYERS.slip && isDyn() ? slipGeom(S.robot, px) : null,
    order = S.fsm.queue;
  ctx.font = `600 ${Math.round(10 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (LAYERS.agents && S.agents && agOn()) {
    ctx.font = `600 ${Math.round(9 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
    for (const t of S.agents.tracks) {
      if (!t.conf) continue;
      const [sx, sy] = toS(t.x + t.r * 0.75, t.y + t.r * 0.75);
      ctx.fillStyle = TOK.warn;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('#' + t.id, sx + 2 * dpr, sy);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (P.agPred === 'learned' && t.lp)
        for (const m of t.lp.modes) {
          if (m.p < 0.05) continue;
          const e = m.pts[m.pts.length - 1],
            [qx, qy] = toS(e[0], e[1]);
          ctx.fillStyle = rgba(TOK.warn, 0.95);
          ctx.fillText(`${Math.round(100 * m.p)}%`, qx, qy - 8 * dpr);
        }
      for (let k = 1; k <= P.agT + 1e-6; k++) {
        const q = agPred(t, k);
        if (P.agPred !== 'cv' && !(P.agPred === 'learned' && t.lp)) break;
        const [qx, qy] = toS(q[0], q[1]);
        ctx.fillStyle = rgba(TOK.warn, 0.9);
        ctx.fillText(String(k), qx, qy);
      }
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of egoM) {
      const [sx, sy] = toS(m[0], m[1]);
      ctx.fillStyle = TOK.accent;
      ctx.fillText(String(m[2]), sx, sy + 0.5);
    }
    ctx.font = `600 ${Math.round(10 * dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
  }
  if (sg && Math.abs(deg(sg.beta)) >= 0.5) {
    const [sx, sy] = toS(sg.tx + 0.25 * sg.ux, sg.ty + 0.25 * sg.uy);
    ctx.fillStyle = sg.col;
    ctx.fillText(`β ${deg(sg.beta).toFixed(1)}°`, sx, sy);
  }
  WPS.forEach((w, i) => {
    if (w.done) return;
    const q = order.indexOf(i);
    const [sx, sy] = toS(w.x, w.y);
    ctx.fillStyle = q === 0 ? TOK.ok : TOK.ink;
    ctx.fillText(String(q >= 0 ? q + 1 : i + 1), sx, sy + 0.5);
  });
}
function drawScaleBar(dpr, k, px) {
  // scale bar
  const sb = 2 * k;
  if (VIEW.z > 1) {
    ctx.fillStyle = TOK.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`${VIEW.z.toFixed(1)}×`, cv.width - 10 * dpr, cv.height - 12 * dpr);
  }
  ctx.strokeStyle = TOK.muted;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(12 * dpr, cv.height - 12 * dpr);
  ctx.lineTo(12 * dpr + sb, cv.height - 12 * dpr);
  ctx.moveTo(12 * dpr, cv.height - 16 * dpr);
  ctx.lineTo(12 * dpr, cv.height - 8 * dpr);
  ctx.moveTo(12 * dpr + sb, cv.height - 16 * dpr);
  ctx.lineTo(12 * dpr + sb, cv.height - 8 * dpr);
  ctx.stroke();
  ctx.fillStyle = TOK.muted;
  ctx.textAlign = 'left';
  ctx.fillText('2 m', 18 * dpr + sb, cv.height - 12 * dpr);
}
// The car with tyre slip: the velocity at the centre of mass (arrow; amber near the grip limit) against the heading (dashed),
// so the sideslip angle β = atan(v_y / v_x) shows on the map
function slipGeom(rb, px) {
  const v = rb.v || 0;
  if (Math.abs(v) < 0.05) return null;
  const L = P.wheelbase,
    lr = L - clamp(P.lf, 0.05 * L, 0.95 * L),
    c = Math.cos(rb.th),
    s = Math.sin(rb.th),
    cx = rb.x + lr * c,
    cy = rb.y + lr * s,
    vy = rb.vy || 0,
    sp = Math.hypot(v, vy);
  const len = Math.max(px(28), 0.6 * sp),
    ux = (v * c - vy * s) / sp,
    uy = (v * s + vy * c) / sp,
    q = dynSlip(rb),
    hot = Math.abs(q.ay) > 0.8 * P.mu * GRAV;
  return {cx, cy, c, s, len, ux, uy, tx: cx + len * ux, ty: cy + len * uy, hd: v < 0 ? -1 : 1, beta: q.beta, col: hot ? TOK.warn : TOK.ok};
}
function slipArrow(g, px) {
  ctx.save();
  ctx.lineWidth = px(1.5);
  ctx.strokeStyle = rgba(TOK.ink, 0.6);
  ctx.setLineDash([px(3), px(3)]);
  ctx.beginPath();
  ctx.moveTo(g.cx, g.cy);
  ctx.lineTo(g.cx + g.hd * g.len * g.c, g.cy + g.hd * g.len * g.s);
  ctx.stroke();
  ctx.setLineDash([]);
  const ah = px(7),
    {tx, ty, ux, uy} = g;
  ctx.strokeStyle = ctx.fillStyle = g.col;
  ctx.lineWidth = px(2.2);
  ctx.beginPath();
  ctx.moveTo(g.cx, g.cy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - ah * ux - ah * 0.55 * uy, ty - ah * uy + ah * 0.55 * ux);
  ctx.lineTo(tx - ah * ux + ah * 0.55 * uy, ty - ah * uy - ah * 0.55 * ux);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, px(2.5), 0, TAU);
  ctx.fill();
  ctx.restore();
}
// The Paint or Erase drag before it is applied: new blocks half filled, what will be erased outlined in red
function drawStroke(px) {
  const st = paintStroke,
    cellR = c => ctx.rect((c % PGW) * PAINT, Math.floor(c / PGW) * PAINT, PAINT, PAINT);
  ctx.beginPath();
  for (const c of st.add) cellR(c);
  ctx.fillStyle = rgba(TOK.obst, 0.55);
  ctx.fill();
  ctx.beginPath();
  for (const c of st.rem) cellR(c);
  for (const i of st.del) {
    const q = LV.shapes0[i];
    if (q.t === 'r') ctx.rect(q.x, q.y, q.w, q.h);
    else (ctx.moveTo(q.x + q.r, q.y), ctx.arc(q.x, q.y, q.r, 0, TAU));
  }
  ctx.strokeStyle = TOK.bad;
  ctx.lineWidth = px(2);
  ctx.setLineDash([px(4), px(3)]);
  ctx.stroke();
  ctx.setLineDash([]);
}
function shapePath(s) {
  ctx.beginPath();
  if (s.t === 'r') ctx.rect(s.x, s.y, s.w, s.h);
  else ctx.arc(s.x, s.y, s.r, 0, TAU);
}
function polyline(p) {
  ctx.beginPath();
  let up = true;
  for (const q of p) {
    if (!q) {
      up = true;
      continue;
    }
    if (up) {
      ctx.moveTo(q[0], q[1]);
      up = false;
    } else ctx.lineTo(q[0], q[1]);
  }
}
function carPath(x, y, th, g = 1) {
  const c = Math.cos(th),
    s = Math.sin(th),
    a = -CAR.rear * g,
    b = (P.wheelbase + CAR.front) * g,
    h = (CAR.width / 2) * g;
  ctx.beginPath();
  for (const [u, v] of [
    [a, -h],
    [b, -h],
    [b, h],
    [a, h]
  ])
    ctx.lineTo(x + u * c - v * s, y + u * s + v * c);
  ctx.closePath();
}
function carShape(x, y, th, truth, px) {
  // glyph at least 14 px long at any zoom (scaled about the pose when the true body would be smaller)
  const g = Math.max(1, px(14) / (CAR.rear + P.wheelbase + CAR.front)),
    c = Math.cos(th),
    s = Math.sin(th),
    P2 = (u, v) => [x + (u * c - v * s) * g, y + (u * s + v * c) * g],
    h = CAR.width / 2;
  carPath(x, y, th, g);
  if (!truth) {
    ctx.strokeStyle = TOK.accent;
    ctx.lineWidth = px(2);
    ctx.setLineDash([px(4), px(2.5)]);
    ctx.stroke();
    ctx.setLineDash([]);
    const f = P2(P.wheelbase + CAR.front + 0.2, 0);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(f[0], f[1]);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = rgba(TOK.ink, 0.88);
  ctx.fill();
  // wheels: rear fixed, front turned by the actual steering angle
  ctx.strokeStyle = TOK['map-bg'];
  ctx.lineWidth = px(3);
  const wl = 0.09,
    wy = h - 0.07;
  for (const sg of [-1, 1]) {
    const r = P2(0, sg * wy);
    ctx.beginPath();
    ctx.moveTo(r[0] - wl * c, r[1] - wl * s);
    ctx.lineTo(r[0] + wl * c, r[1] + wl * s);
    ctx.stroke();
    const f = P2(P.wheelbase, sg * wy),
      cd = Math.cos(th + S.robot.d),
      sd = Math.sin(th + S.robot.d);
    ctx.beginPath();
    ctx.moveTo(f[0] - wl * cd, f[1] - wl * sd);
    ctx.lineTo(f[0] + wl * cd, f[1] + wl * sd);
    ctx.stroke();
  }
  ctx.fillStyle = TOK['map-bg'];
  ctx.beginPath();
  ctx.arc(x, y, px(2.5), 0, TAU);
  ctx.fill();
  headTick(P2(P.wheelbase + CAR.front, 0), th, px);
}
// heading tick: a short ink line out of the front of the true body
function headTick(f, th, px) {
  ctx.strokeStyle = TOK.ink;
  ctx.lineWidth = px(2);
  ctx.beginPath();
  ctx.moveTo(f[0], f[1]);
  ctx.lineTo(f[0] + px(6) * Math.cos(th), f[1] + px(6) * Math.sin(th));
  ctx.stroke();
}
function robotShape(x, y, th, truth, px) {
  if (isCar()) return carShape(x, y, th, truth, px);
  const R = Math.max(RR, px(7)); // at least 14 px across at any zoom
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  if (truth) {
    ctx.fillStyle = rgba(TOK.ink, 0.88);
    ctx.fill();
    ctx.strokeStyle = TOK['map-bg'];
    ctx.lineWidth = px(2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + R * 0.95 * Math.cos(th), y + R * 0.95 * Math.sin(th));
    ctx.stroke();
    headTick([x + R * Math.cos(th), y + R * Math.sin(th)], th, px);
  } else {
    ctx.strokeStyle = TOK.accent;
    ctx.lineWidth = px(2);
    ctx.setLineDash([px(4), px(2.5)]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + R * 1.5 * Math.cos(th), y + R * 1.5 * Math.sin(th));
    ctx.stroke();
  }
}
function ellipse(x, y, Pc) {
  const a = Pc[0],
    b = Pc[1],
    c = Pc[4];
  const tr = (a + c) / 2,
    dd = Math.sqrt(Math.max(0, ((a - c) / 2) ** 2 + b * b));
  const l1 = tr + dd,
    l2 = Math.max(0, tr - dd);
  const ang = 0.5 * Math.atan2(2 * b, a - c);
  const s = 2.4477; // sqrt(chi2_2(0.95))
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(0.02, s * Math.sqrt(l1)), Math.max(0.02, s * Math.sqrt(l2)), 0, 0, TAU);
  ctx.restore();
  ctx.fillStyle = rgba(TOK.rose, 0.12);
  ctx.fill();
  ctx.strokeStyle = TOK.rose;
  ctx.lineWidth = (1.5 * Math.min(window.devicePixelRatio || 1, 2)) / viewXform().kz;
  ctx.stroke();
}
