/* ---------- path tracking helpers ---------- */
function setPlan(segs) {
  S.plan = {segs};
  S.segIdx = 0;
  loadSeg(0);
}
function loadSeg(i) {
  const g = S.plan.segs[i];
  setTrack(g.pts);
  S.track.dir = g.dir;
  S.ctlState = {I: 0, prev: null};
}
function setTrack(pts) {
  pts = pts.filter((p, i) => i === 0 || hyp(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4);
  if (pts.length < 2) pts = [pts[0], [pts[0][0] + 1e-3, pts[0][1]]];
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  S.track = {pts, s, total: s[s.length - 1], idx: 0, dir: 1};
  S.pathId++;
  const n = pts.length,
    hd = [],
    kv = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) hd.push(Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]));
  for (let i = 1; i < n - 1; i++) {
    const l = (s[i + 1] - s[i - 1]) / 2;
    kv[i] = l > 1e-6 ? wrap(hd[i] - hd[i - 1]) / l : 0;
  }
  if (n > 2) {
    kv[0] = kv[1];
    kv[n - 1] = kv[n - 2];
  }
  S.track.hd = hd;
  S.track.kv = kv;
  // dense copy for the custom controller
  const dense = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = hyp(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.ceil(L / 0.1));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  S.track.dense = dense;
}
function project(x, y, windowed) {
  const T = S.track,
    p = T.pts;
  let best = Infinity,
    bi = 0,
    bt = 0;
  const i0 = windowed ? T.idx : 0,
    i1 = windowed ? Math.min(p.length - 2, T.idx + 40) : p.length - 2;
  for (let i = i0; i <= i1; i++) {
    const a = p[i],
      b = p[i + 1],
      vx = b[0] - a[0],
      vy = b[1] - a[1],
      L2 = vx * vx + vy * vy;
    let t = L2 > 0 ? ((x - a[0]) * vx + (y - a[1]) * vy) / L2 : 0;
    t = clamp(t, 0, 1);
    const px = a[0] + vx * t,
      py = a[1] + vy * t,
      d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) {
      best = d;
      bi = i;
      bt = t;
    }
  }
  return {i: bi, s: T.s[bi] + bt * (T.s[bi + 1] - T.s[bi]), d: Math.sqrt(best)};
}
function pointAt(sArc, ext) {
  const T = S.track,
    p = T.pts;
  if (sArc >= T.total) {
    const b = p[p.length - 1];
    if (!ext) return b;
    const a = p[p.length - 2],
      l = hyp(b[0] - a[0], b[1] - a[1]) || 1,
      x = sArc - T.total;
    return [b[0] + ((b[0] - a[0]) / l) * x, b[1] + ((b[1] - a[1]) / l) * x];
  }
  if (sArc <= 0) return p[0];
  let i = 0;
  while (i < p.length - 2 && T.s[i + 1] < sArc) i++;
  const t = (sArc - T.s[i]) / (T.s[i + 1] - T.s[i] || 1);
  return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t];
}
