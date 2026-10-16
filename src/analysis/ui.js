/* ---------- analysis view: rendering ---------- */
function anCanvas(id) {
  const cv = document.getElementById(id);
  if (!cv) return null;
  const dpr = sizeCanvas(cv);
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = TOK['map-bg'];
  c.fillRect(0, 0, cv.width, cv.height);
  return {cv, c, dpr, w: cv.width, h: cv.height};
}
const fmt = (v, d = 2) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d));
function anFont(G, sz) {
  G.c.font = `${Math.round(sz * G.dpr)}px ${getComputedStyle(document.body).getPropertyValue('--f-mono') || 'monospace'}`;
}
function anFrame(G, box, xr, yr, opt) {
  // returns mappers; xr may be log
  const {c, dpr} = G,
    [x0, y0, x1, y1] = box,
    lx = opt && opt.logx;
  const X = v =>
    x0 +
    (((lx ? Math.log10(v) : v) - (lx ? Math.log10(xr[0]) : xr[0])) /
      ((lx ? Math.log10(xr[1]) : xr[1]) - (lx ? Math.log10(xr[0]) : xr[0]))) *
      (x1 - x0);
  const Y = v => y1 - ((v - yr[0]) / (yr[1] - yr[0])) * (y1 - y0);
  c.strokeStyle = TOK.line;
  c.lineWidth = 1;
  c.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
  anFont(G, 10);
  c.fillStyle = TOK.muted;
  c.textBaseline = 'top';
  c.textAlign = 'center';
  if (lx) {
    for (let e = Math.floor(Math.log10(xr[0])); e <= Math.ceil(Math.log10(xr[1])); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v < xr[0] || v > xr[1]) continue;
        const x = X(v);
        c.strokeStyle = m === 1 ? TOK.line : TOK.grid;
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x, y1);
        c.stroke();
        if (m === 1 && !(opt && opt.noxlab)) c.fillText(v >= 1 ? String(v) : v.toString(), x, y1 + 3 * dpr);
      }
    }
  } else if (!(opt && opt.noxgrid)) {
    const st = niceStep(xr[1] - xr[0]);
    for (let v = Math.ceil(xr[0] / st) * st; v <= xr[1] + 1e-9; v += st) {
      const x = X(v);
      c.strokeStyle = TOK.grid;
      c.beginPath();
      c.moveTo(x, y0);
      c.lineTo(x, y1);
      c.stroke();
      if (!(opt && opt.noxlab)) c.fillText(fmtTick(v, st), x, y1 + 3 * dpr);
    }
  }
  const ys = (opt && opt.ystep) || niceStep(yr[1] - yr[0]);
  c.textAlign = 'right';
  c.textBaseline = 'middle';
  for (let v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + 1e-9; v += ys) {
    const y = Y(v);
    c.strokeStyle = TOK.grid;
    c.beginPath();
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    c.stroke();
    c.fillStyle = TOK.muted;
    c.fillText(fmtTick(v, ys), x0 - 4 * dpr, y);
  }
  return {X, Y};
}
function niceStep(r) {
  const raw = r / 5,
    p = Math.pow(10, Math.floor(Math.log10(raw))),
    m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
function fmtTick(v, st) {
  const d = st >= 1 ? 0 : st >= 0.1 ? 1 : 2;
  return (Math.abs(v) < 1e-9 ? 0 : v).toFixed(d);
}
function polyline2(c, pts, X, Y, clip) {
  c.beginPath();
  let up = true;
  for (const p of pts) {
    if (p == null || !isFinite(p[1])) {
      up = true;
      continue;
    }
    const x = X(p[0]),
      y = Y(p[1]);
    if (clip && (y < clip[0] - 50 || y > clip[1] + 50)) {
      up = true;
      continue;
    }
    if (up) {
      c.moveTo(x, y);
      up = false;
    } else c.lineTo(x, y);
  }
  c.stroke();
}
// items: [colour, dash, text, kind] with kind 'line' (default), 'dot', 'band' or 'x'; corner 'tr', 'tl', 'mr', 'br' or 'bl' of box [x0,y0,x1,y1]
function anLegend(G, items, box, corner = 'tr') {
  const {c, dpr} = G,
    [x0, y0, x1, y1] = box;
  anFont(G, 10);
  const lh = 13 * dpr,
    sw = 16 * dpr,
    pad = 5 * dpr,
    tw = Math.max(...items.map(i => c.measureText(i[2]).width));
  const bw = sw + 6 * dpr + tw + 2 * pad,
    bh = items.length * lh + 2 * pad - 3 * dpr,
    bx = corner[1] === 'r' ? x1 - bw - 4 * dpr : x0 + 4 * dpr,
    by = corner[0] === 't' ? y0 + 4 * dpr : corner[0] === 'm' ? (y0 + y1 - bh) / 2 : y1 - bh - 4 * dpr;
  c.fillStyle = rgba(TOK['map-bg'], 0.86);
  c.strokeStyle = TOK.line;
  c.lineWidth = 1;
  c.fillRect(bx, by, bw, bh);
  c.strokeRect(bx + 0.5, by + 0.5, bw, bh);
  items.forEach(([col, dash, t, kind], i) => {
    const y = by + pad + i * lh + 5 * dpr,
      x = bx + pad;
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = 2 * dpr;
    c.setLineDash(dash || []);
    if (kind === 'dot') {
      c.beginPath();
      c.arc(x + sw / 2, y, 3.2 * dpr, 0, TAU);
      c.fill();
    } else if (kind === 'band') {
      c.fillStyle = rgba(col, 0.18);
      c.fillRect(x, y - 4 * dpr, sw, 8 * dpr);
    } else if (kind === 'x') {
      const s = 3.5 * dpr;
      c.beginPath();
      c.moveTo(x + sw / 2 - s, y - s);
      c.lineTo(x + sw / 2 + s, y + s);
      c.moveTo(x + sw / 2 - s, y + s);
      c.lineTo(x + sw / 2 + s, y - s);
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + sw, y);
      c.stroke();
    }
    c.setLineDash([]);
    c.fillStyle = TOK.ink;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(t, x + sw + 6 * dpr, y);
  });
}
// the same key as HTML under a plot: items [colour, '' | 'dash' | 'dot2' | 'dot' | 'x', text]
function anKeyHTML(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items
    .map(([col, k, t]) => `<span class="lg-i"><i class="lg-s ${k || 'line'}" style="--c:${col}"></i>${t}</span>`)
    .join('');
}
function label(G, t, x, y, col, al = 'left', bl = 'bottom') {
  anFont(G, 10);
  G.c.fillStyle = col;
  G.c.textAlign = al;
  G.c.textBaseline = bl;
  G.c.fillText(t, x, y);
}

// Bode plot of L(jω) with the margins marked, and optionally |S| and |T|.
function drawBode(R) {
  const G = anCanvas('cv-bode');
  if (!G) return;
  const {c, dpr, w, h} = G,
    F = R.F,
    M = R.M;
  const wmin = Math.max(0.01, (F.wc || 1) / 80),
    wmax = F.wN,
    pts = F.pts.filter(p => p.w >= wmin);
  const L = 40 * dpr,
    Rm = 10 * dpr,
    top = 8 * dpr,
    mid = Math.round(h * 0.56),
    bot = h - 18 * dpr;
  const dB = pts.map(p => 20 * Math.log10(p.mag));
  let mx = Math.min(60, Math.max(20, ...dB)),
    mn = Math.max(-60, Math.min(-20, ...dB));
  let cl = [];
  if (AN.showCL && !R.noCL)
    cl = pts.map(p => {
      const S1 = Cx.div([1, 0], Cx.add([1, 0], p.L)),
        Tn = Lparts(M, [0, p.w]).Le;
      return {w: p.w, S: 20 * Math.log10(Cx.abs(S1)), T: 20 * Math.log10(Cx.abs(Cx.mul(Tn, S1)))};
    });
  const A = anFrame(G, [L, top, w - Rm, mid - 4 * dpr], [wmin, wmax], [mn, mx], {logx: true, noxlab: true, ystep: 20});
  c.strokeStyle = TOK.muted;
  c.setLineDash([3 * dpr, 3 * dpr]);
  c.beginPath();
  c.moveTo(L, A.Y(0));
  c.lineTo(w - Rm, A.Y(0));
  c.stroke();
  c.setLineDash([]);
  if (AN.showCL) {
    c.lineWidth = 1.4 * dpr;
    c.strokeStyle = TOK.rose;
    polyline2(
      c,
      cl.map(p => [p.w, Math.max(mn, Math.min(mx, p.S))]),
      A.X,
      A.Y
    );
    c.strokeStyle = TOK.ok;
    polyline2(
      c,
      cl.map(p => [p.w, Math.max(mn, Math.min(mx, p.T))]),
      A.X,
      A.Y
    );
  }
  c.lineWidth = 2 * dpr;
  c.strokeStyle = TOK.ink;
  polyline2(
    c,
    pts.map((p, i) => [p.w, Math.max(mn - 5, Math.min(mx + 5, dB[i]))]),
    A.X,
    A.Y,
    [top, mid]
  );
  const phs = pts.map(p => (p.phu * 180) / Math.PI),
    pmx = Math.min(90, Math.ceil(Math.max(...phs) / 90) * 90),
    pmn = Math.max(-540, Math.floor(Math.min(...phs.filter(v => v > -560)) / 90) * 90);
  const B = anFrame(G, [L, mid + 4 * dpr, w - Rm, bot], [wmin, wmax], [Math.min(pmn, -180 - 10), Math.max(pmx, -90)], {
    logx: true,
    ystep: 90
  });
  c.strokeStyle = TOK.bad;
  c.setLineDash([3 * dpr, 3 * dpr]);
  c.beginPath();
  c.moveTo(L, B.Y(-180));
  c.lineTo(w - Rm, B.Y(-180));
  c.stroke();
  c.setLineDash([]);
  c.lineWidth = 2 * dpr;
  c.strokeStyle = TOK.ink;
  polyline2(
    c,
    pts.map((p, i) => [p.w, phs[i]]),
    B.X,
    B.Y,
    [mid, bot]
  );
  // Nyquist frequency of the sampling
  c.strokeStyle = TOK.muted;
  c.setLineDash([2 * dpr, 4 * dpr]);
  const xn = A.X(F.wN) - 1;
  c.beginPath();
  c.moveTo(xn, top);
  c.lineTo(xn, bot);
  c.stroke();
  c.setLineDash([]);
  label(G, 'π/T', xn - 3 * dpr, top + 12 * dpr, TOK.muted, 'right', 'top');
  if (F.wc) {
    const x = A.X(F.wc);
    c.strokeStyle = TOK.accent;
    c.lineWidth = 1 * dpr;
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x, bot);
    c.stroke();
    const p = F.pts.reduce((a, q) => (Math.abs(Math.log(q.w / F.wc)) < Math.abs(Math.log(a.w / F.wc)) ? q : a));
    const ph = (p.phu * 180) / Math.PI,
      ref = ph - F.pm;
    c.strokeStyle = F.pm > 30 ? TOK.ok : F.pm > 0 ? TOK.warn : TOK.bad;
    c.lineWidth = 3 * dpr;
    c.beginPath();
    c.moveTo(x, B.Y(ref));
    c.lineTo(x, B.Y(ph));
    c.stroke();
    {
      const rt = x > w * 0.7,
        xo = rt ? x - 5 * dpr : x + 4 * dpr,
        al = rt ? 'right' : 'left';
      label(G, `ωc ${fmt(F.wc)} rad/s`, xo, top + 2 * dpr, TOK.accent, al, 'top');
      label(G, `PM ${fmt(F.pm, 0)}°`, xo, B.Y((ref + ph) / 2), c.strokeStyle, al, 'middle');
    }
  }
  if (F.w180 && F.w180 < wmax) {
    const x = A.X(F.w180),
      m = -F.gm;
    c.strokeStyle = F.gm > 6 ? TOK.ok : F.gm > 0 ? TOK.warn : TOK.bad;
    c.lineWidth = 3 * dpr;
    c.beginPath();
    c.moveTo(x, A.Y(0));
    c.lineTo(x, A.Y(Math.max(mn, m)));
    c.stroke();
    {
      const rt = x > w * 0.72;
      label(
        G,
        `GM ${fmt(F.gm, 1)} dB`,
        rt ? x - 5 * dpr : x + 4 * dpr,
        A.Y(Math.max(mn, m / 2)),
        c.strokeStyle,
        rt ? 'right' : 'left',
        'middle'
      );
    }
  }
  if (AN.meas.freq && AN.meas.freq.length) {
    c.fillStyle = TOK.amber;
    for (const q of AN.meas.freq) {
      let ph = (q.ph * 180) / Math.PI;
      const ref = (F.pts.reduce((a, p) => (Math.abs(Math.log(p.w / q.w)) < Math.abs(Math.log(a.w / q.w)) ? p : a)).phu * 180) / Math.PI;
      ph += 360 * Math.round((ref - ph) / 360);
      c.beginPath();
      c.arc(A.X(q.w), A.Y(20 * Math.log10(q.mag)), 3.2 * dpr, 0, TAU);
      c.fill();
      c.beginPath();
      c.arc(B.X(q.w), B.Y(ph), 3.2 * dpr, 0, TAU);
      c.fill();
    }
  }
  const nm = R.loop === 'spd' && R.M.kind !== 'mpc' ? 'G' : 'L',
    spdOpen = nm === 'G';
  anKeyHTML('lg-bode', [
    [TOK.ink, '', spdOpen ? 'G(jω): speed command → speed (no feedback)' : 'L(jω): open loop (gain on top, phase below)'],
    ...(AN.showCL && !R.noCL
      ? [
          [TOK.rose, '', 'S = 1/(1+L): share of a disturbance that gets through'],
          [TOK.ok, '', R.loop === 'spd' ? 'T: reference → speed' : 'T: closed-loop tracking']
        ]
      : []),
    ...(F.wc ? [[TOK.accent, '', 'gain crossover ω<sub>c</sub>, and the phase margin bar']] : []),
    [TOK.bad, 'dash', '−180°: the phase where the loop would oscillate'],
    [TOK.muted, 'dot2', 'π/T: the highest frequency a 20 Hz loop sees'],
    ...(AN.meas.freq && AN.meas.freq.length ? [[TOK.amber, 'dot', 'measured in the simulator']] : [])
  ]);
  label(G, `|${nm}| dB`, L + 4 * dpr, mid - 6 * dpr, TOK.muted);
  label(G, `∠${nm} °`, L + 4 * dpr, bot - 4 * dpr, TOK.muted);
  label(G, 'ω [rad/s]', w - Rm, h - 2 * dpr, TOK.muted, 'right', 'bottom');
}
// Nyquist plot of L(jω) (compressed or linear radius) with the −1 point, the closest approach and the encirclement count.
function drawNyq(R) {
  const G = anCanvas('cv-nyq');
  if (!G) return;
  const {c, dpr, w, h} = G,
    F = R.F,
    lg = AN.nyqScale === 'log';
  const map = L => {
    if (!lg) return L;
    const r = Cx.abs(L),
      k = r > 0 ? Math.log2(1 + r) / r : 1;
    return [L[0] * k, L[1] * k];
  };
  const span = lg ? 3.4 : 2.4,
    ar = w / h,
    cx = lg ? -0.7 : -0.6,
    yr = span,
    xr = span * ar;
  const X = v => w / 2 + ((v - cx) / xr) * (w / 2),
    Y = v => h / 2 - (v / yr) * (h / 2);
  c.strokeStyle = TOK.grid;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, Y(0));
  c.lineTo(w, Y(0));
  c.moveTo(X(0), 0);
  c.lineTo(X(0), h);
  c.stroke();
  c.strokeStyle = TOK.muted;
  c.setLineDash([3 * dpr, 3 * dpr]);
  c.beginPath();
  c.arc(X(0), Y(0), X(1) - X(0), 0, TAU);
  c.stroke();
  c.setLineDash([]);
  const pos = F.pts.map(p => map(p.L)),
    neg = pos.map(p => [p[0], -p[1]]);
  c.lineWidth = 1.3 * dpr;
  c.strokeStyle = TOK.muted;
  c.setLineDash([4 * dpr, 3 * dpr]);
  c.beginPath();
  neg.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))));
  c.stroke();
  c.setLineDash([]);
  c.lineWidth = 2 * dpr;
  c.strokeStyle = TOK.ink;
  c.beginPath();
  pos.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1]))));
  c.stroke();
  // direction arrow near crossover
  const ia = F.pts.findIndex(p => p.w >= (F.wc || 1) * 0.6);
  if (ia > 0) {
    const a = pos[ia - 1],
      b = pos[ia],
      ang = Math.atan2(Y(b[1]) - Y(a[1]), X(b[0]) - X(a[0]));
    c.fillStyle = TOK.ink;
    c.beginPath();
    const tx = X(b[0]),
      ty = Y(b[1]);
    c.moveTo(tx, ty);
    c.lineTo(tx - 9 * dpr * Math.cos(ang - 0.4), ty - 9 * dpr * Math.sin(ang - 0.4));
    c.lineTo(tx - 9 * dpr * Math.cos(ang + 0.4), ty - 9 * dpr * Math.sin(ang + 0.4));
    c.closePath();
    c.fill();
  }
  // closest approach to −1 (1/Ms)
  let best = null;
  F.pts.forEach((p, i) => {
    const d = Cx.abs(Cx.add([1, 0], p.L));
    if (!best || d < best.d) best = {d, i};
  });
  if (best) {
    const q = pos[best.i];
    c.strokeStyle = TOK.rose;
    c.lineWidth = 1.5 * dpr;
    c.beginPath();
    c.moveTo(X(-1), Y(0));
    c.lineTo(X(q[0]), Y(q[1]));
    c.stroke();
  }
  if (F.wc) {
    const p = F.pts.reduce((a, q) => (Math.abs(Math.log(q.w / F.wc)) < Math.abs(Math.log(a.w / F.wc)) ? q : a)),
      u = map(p.L);
    c.fillStyle = TOK.accent;
    c.beginPath();
    c.arc(X(u[0]), Y(u[1]), 4 * dpr, 0, TAU);
    c.fill();
  }
  c.strokeStyle = TOK.bad;
  c.lineWidth = 2.5 * dpr;
  const s = 6 * dpr;
  c.beginPath();
  c.moveTo(X(-1) - s, Y(0) - s);
  c.lineTo(X(-1) + s, Y(0) + s);
  c.moveTo(X(-1) - s, Y(0) + s);
  c.lineTo(X(-1) + s, Y(0) - s);
  c.stroke();
  label(G, '−1', X(-1) - 8 * dpr, Y(0) - 6 * dpr, TOK.bad, 'right', 'bottom');
  if (AN.meas.freq) {
    c.fillStyle = TOK.amber;
    for (const q of AN.meas.freq) {
      const u = map(q.L);
      c.beginPath();
      c.arc(X(u[0]), Y(u[1]), 3.2 * dpr, 0, TAU);
      c.fill();
    }
  }
  const Z = F.Ncw + (F.P || 0),
    ok = Z === 0;
  label(
    G,
    `N = ${F.Ncw} encirclement${Math.abs(F.Ncw) === 1 ? '' : 's'} of −1 · Z = N + P = ${F.P ? `${F.Ncw} + ${F.P} = ` : ''}${Z}  →  ${ok ? 'stable' : 'unstable'}`,
    6 * dpr,
    h - 4 * dpr,
    ok ? TOK.ok : TOK.bad,
    'left',
    'bottom'
  );
  label(G, lg ? 'radius log₂(1+|L|): −1 and the unit circle stay in place' : 'linear scale', 6 * dpr, 4 * dpr, TOK.muted, 'left', 'top');
  anKeyHTML('lg-nyq', [
    [TOK.ink, '', 'L(jω) for ω > 0 (the arrow points to rising ω)'],
    [TOK.muted, 'dash', 'ω < 0: its mirror image'],
    [TOK.muted, 'dash', 'unit circle |L| = 1'],
    [TOK.rose, '', 'closest approach to −1, length 1/M<sub>s</sub>'],
    ...(F.wc ? [[TOK.accent, 'dot', 'crossover ω<sub>c</sub>']] : []),
    [TOK.bad, 'x', '−1: the point the curve must not circle'],
    ...(AN.meas.freq && AN.meas.freq.length ? [[TOK.amber, 'dot', 'measured in the simulator']] : [])
  ]);
}
// The response plot seen from above: the offset or the bias response of the linear model, with the simulator's step test over it.
function drawStep(R) {
  if (R.loop !== 'spd') return drawResp(R);
  const G = anCanvas('cv-step');
  if (!G) return;
  const {c, dpr, w, h} = G,
    spd = R.loop === 'spd',
    kind = spd ? 'offset' : AN.stepKind,
    bu = biasUnit();
  const sc = kind === 'offset' ? 1 : bu.toModel(bu.val),
    pred = (kind === 'offset' ? R.step : R.bias).map(p => [p[0], p[1] * sc]);
  const ms = spd
    ? AN.meas.spd
      ? AN.meas.spd.data
      : null
    : AN.meas.step && AN.meas.step.kind === kind
      ? AN.meas.step.data.map(p => [p[0], p[1] * sc])
      : null;
  const all = pred
    .concat(ms || [])
    .map(p => p[1])
    .filter(isFinite);
  let lo = Math.min(...all),
    hi = Math.max(...all);
  if (kind === 'offset') {
    lo = Math.min(lo, -0.1);
    hi = Math.max(hi, 1.05);
  } else {
    const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-3);
    lo = Math.min(lo, -0.1 * m);
    hi = Math.max(hi, 0.1 * m);
  }
  lo = Math.max(lo, kind === 'offset' ? -1.5 : -10);
  hi = Math.min(hi, kind === 'offset' ? 2 : 10);
  const A = anFrame(G, [44 * dpr, 8 * dpr, w - 10 * dpr, h - 18 * dpr], [0, R.tEnd], [lo, hi]);
  c.strokeStyle = TOK.muted;
  c.beginPath();
  c.moveTo(A.X(0), A.Y(0));
  c.lineTo(A.X(R.tEnd), A.Y(0));
  c.stroke();
  const m = kind === 'offset' ? R.smOff : R.smBias,
    fin = spd ? 1 : kind === 'offset' ? 0 : m.final * sc,
    band = kind === 'offset' ? 0.02 : 0.02 * Math.abs(m.peak * sc);
  c.fillStyle = rgba(TOK.ok, 0.12);
  c.fillRect(A.X(0), A.Y(fin + band), A.X(R.tEnd) - A.X(0), A.Y(fin - band) - A.Y(fin + band));
  if (R.stable && m.settle && m.settle < R.tEnd) {
    c.strokeStyle = TOK.ok;
    c.setLineDash([3 * dpr, 3 * dpr]);
    c.beginPath();
    c.moveTo(A.X(m.settle), A.Y(lo));
    c.lineTo(A.X(m.settle), A.Y(hi));
    c.stroke();
    c.setLineDash([]);
    label(G, `settles ${fmt(m.settle, 1)} s`, A.X(m.settle) + 3 * dpr, 8 * dpr + 2 * dpr, TOK.ok, 'left', 'top');
  }
  if (spd) {
    c.strokeStyle = TOK.accent;
    c.lineWidth = 1.5 * dpr;
    c.setLineDash([6 * dpr, 4 * dpr]);
    c.beginPath();
    c.moveTo(A.X(0), A.Y(1));
    c.lineTo(A.X(R.tEnd), A.Y(1));
    c.stroke();
    c.setLineDash([]);
  }
  c.save();
  c.beginPath();
  c.rect(44 * dpr, 8 * dpr, w - 54 * dpr, h - 26 * dpr);
  c.clip();
  c.lineWidth = 2 * dpr;
  c.strokeStyle = TOK.ink;
  polyline2(c, pred, A.X, A.Y);
  if (ms) {
    c.lineWidth = 2 * dpr;
    c.strokeStyle = TOK.amber;
    c.setLineDash([5 * dpr, 3 * dpr]);
    polyline2(c, ms, A.X, A.Y);
    c.setLineDash([]);
  }
  c.restore();
  label(
    G,
    spd
      ? `(v − v₀) / Δv, Δv = ${fmt(AN.spdAmp || 0.2)} m/s`
      : kind === 'offset'
        ? 'e(t) / e₀  (path offset step)'
        : `e(t) [m] for a ${bu.val}${bu.unit} actuator bias`,
    48 * dpr,
    h - 20 * dpr,
    TOK.muted,
    'left',
    'bottom'
  );
  label(G, 't [s]', w - 14 * dpr, h - 21 * dpr, TOK.muted, 'right', 'bottom');
  if (spd)
    anLegend(
      G,
      [
        [TOK.accent, [6 * dpr, 4 * dpr], 'new reference speed'],
        [TOK.ink, [], 'model (linear)'],
        ...(ms ? [[TOK.amber, [5 * dpr, 3 * dpr], 'simulator (Run step test)']] : []),
        [TOK.ok, [], 'within 2 % of the reference', 'band']
      ],
      [44 * dpr, 8 * dpr, w - 10 * dpr, h - 18 * dpr],
      'mr'
    );
}
function drawLocus(R) {
  const G = anCanvas('cv-loc');
  if (!G) return;
  const {c, dpr, w, h} = G;
  const near = R.poles
    .map(s => Math.hypot(s[0], s[1]))
    .filter(r => r < 200)
    .sort((a, b) => a - b);
  const Rv = Math.max(1, Math.min(80, 1.6 * (near[Math.min(near.length - 1, 3)] || 5)));
  let xr = [-Rv, 0.35 * Rv];
  const ar = (w - 48 * dpr) / (h - 24 * dpr);
  let half = (xr[1] - xr[0]) / ar / 2;
  const needY = 1.12 * Math.max(0, ...R.poles.filter(s => s[0] >= xr[0] && s[0] <= xr[1]).map(s => Math.abs(s[1])));
  let Rs = Rv;
  if (needY > half) {
    const k = Math.min(4, needY / half);
    Rs = Rv * k;
    xr = [-Rs, 0.35 * Rs];
    half *= k;
  }
  const yr = [-half, half];
  const A = anFrame(G, [40 * dpr, 6 * dpr, w - 8 * dpr, h - 18 * dpr], xr, yr);
  c.fillStyle = rgba(TOK.bad, 0.07);
  c.fillRect(A.X(0), 6 * dpr, A.X(xr[1]) - A.X(0), A.Y(yr[0]) - 6 * dpr);
  c.strokeStyle = TOK.muted;
  c.beginPath();
  c.moveTo(A.X(0), A.Y(yr[0]));
  c.lineTo(A.X(0), A.Y(yr[1]));
  c.moveTo(A.X(xr[0]), A.Y(0));
  c.lineTo(A.X(xr[1]), A.Y(0));
  c.stroke();
  // constant damping rays
  c.setLineDash([2 * dpr, 3 * dpr]);
  for (const z of [0.3, 0.5, 0.7]) {
    const th = Math.acos(z);
    for (const sg of [1, -1]) {
      c.beginPath();
      c.moveTo(A.X(0), A.Y(0));
      c.lineTo(A.X(-Rs * Math.cos(th)), A.Y(sg * Rs * Math.sin(th)));
      c.stroke();
    }
    label(G, `ζ ${z}`, A.X(-0.9 * Rs * Math.cos(th)), A.Y(0.9 * Rs * Math.sin(th)), TOK.muted, 'center', 'bottom');
  }
  c.setLineDash([]);
  c.fillStyle = rgba(TOK.accent, 0.5);
  for (const p of R.locus) {
    if (p[0] < xr[0] || p[0] > xr[1] || Math.abs(p[1]) > yr[1]) continue;
    c.fillRect(A.X(p[0]) - 1.2 * dpr, A.Y(p[1]) - 1.2 * dpr, 2.4 * dpr, 2.4 * dpr);
  }
  c.strokeStyle = TOK.muted;
  c.lineWidth = 1.5 * dpr;
  const s = 4 * dpr;
  for (const p of R.olp) {
    if (p[0] < xr[0] || p[0] > xr[1]) continue;
    const x = A.X(p[0]),
      y = A.Y(p[1]);
    c.beginPath();
    c.moveTo(x - s, y - s);
    c.lineTo(x + s, y + s);
    c.moveTo(x - s, y + s);
    c.lineTo(x + s, y - s);
    c.stroke();
  }
  for (const p of R.olz) {
    if (p[0] < xr[0] || p[0] > xr[1]) continue;
    c.beginPath();
    c.arc(A.X(p[0]), A.Y(p[1]), s, 0, TAU);
    c.stroke();
  }
  let off = 0;
  for (const p of R.poles) {
    if (p[0] < xr[0] || p[0] > xr[1] || Math.abs(p[1]) > yr[1]) {
      off++;
      continue;
    }
    c.fillStyle = p[0] > 0 ? TOK.bad : TOK.ok;
    c.beginPath();
    c.arc(A.X(p[0]), A.Y(p[1]), 5 * dpr, 0, TAU);
    c.fill();
  }
  label(
    G,
    `● closed loop  × ○ open loop  · locus ×0.06–16${off ? `  ·  ${off} off-scale` : ''}`,
    44 * dpr,
    h - 21 * dpr,
    TOK.muted,
    'left',
    'bottom'
  );
  label(G, 'Re s', w - 12 * dpr, A.Y(0) - 3 * dpr, TOK.muted, 'right', 'bottom');
}
function blockDiagram(R) {
  const M = R.M,
    car = M.car,
    u = car ? 'δ' : 'ω';
  let C;
  if (M.kind === 'static') C = `${u} = −(${fmt(M.Ke)}·e + ${fmt(M.Kth)}·θₑ)`;
  else if (M.kind === 'pid') C = `${u} = PID(α),  α ≈ −e/${fmt(M.Ld)} − θₑ`;
  else
    C = `${u}̇ = −(${fmt(M.K.e)}e + ${fmt(M.K.th)}θₑ + ${fmt(M.K.s)}${u}${M.lagModel ? ` + ${fmt(M.K.c)}${u}cmd` : ''}) + ${fmt(M.K.u)}${u}̇prev`;
  const box = (x, wd, t, sub) =>
    `<g><rect x="${x}" y="22" width="${wd}" height="40" rx="5" class="bd-box"/><text x="${x + wd / 2}" y="${sub ? 39 : 46}" class="bd-t">${t}</text>${sub ? `<text x="${x + wd / 2}" y="54" class="bd-s">${sub}</text>` : ''}</g>`;
  const ar = (x1, x2, y = 42) =>
    `<line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" class="bd-l"/><path d="M${x2} ${y} l-7 -4 v8 z" class="bd-a"/>`;
  const act = M.kind === 'mpc' ? (M.tau > 0 ? `∫ then 1/(${fmt(M.tau)}s+1)` : '∫ (rate input)') : M.tau > 0 ? `1/(${fmt(M.tau)}s+1)` : '1';
  return `<svg viewBox="0 0 860 104" class="bd" role="img" aria-label="Block diagram of the lateral loop">
  <text x="6" y="46" class="bd-s" text-anchor="start">e₀ step</text>${ar(52, 76)}
  <circle cx="86" cy="42" r="10" class="bd-box"/><text x="86" y="46" class="bd-t">Σ</text>${ar(96, 118)}
  ${box(118, 190, 'Controller', C.length > 34 ? C.slice(0, 34) + '…' : C)}${ar(308, 330)}
  ${box(330, 92, 'e^(−sT_d)', `T_d ${fmt(M.Td * 1000, 0)} ms`)}${ar(422, 442)}
  ${box(442, 116, 'Actuator', act)}${ar(558, 578)}
  ${box(578, 92, M.dyn ? 'Tyres, heading' : 'Heading', M.dyn ? 'G_r(s) · 1/s' : car ? `v/L · 1/s` : '1/s')}${ar(670, 690)}
  ${box(690, 92, 'Lateral', M.dyn ? `(v + slide)/s` : `v/s, v ${fmt(M.v0)}`)}${ar(782, 830)}<text x="836" y="46" class="bd-s" text-anchor="start">e</text>
  <polyline points="806,42 806,92 86,92 86,52" class="bd-l" fill="none"/><path d="M86 52 l-4 7 h8 z" class="bd-a"/>
  <polyline points="680,42 680,80 213,80 213,62" class="bd-l bd-dash" fill="none"/><text x="446" y="76" class="bd-s">θₑ</text><text x="446" y="88" class="bd-s">e</text></svg>`;
}
function chip(lbl, val, cls, tip) {
  return `<div class="chip ${cls || ''}" title="${tip || ''}"><span>${lbl}</span><b>${val}</b></div>`;
}
/* ---------- the lateral response in physical units: sideways offset [cm] against distance driven [m] ---------- */
function drawResp(R) {
  const G = anCanvas('cv-step');
  if (!G) return;
  const {c, dpr, w, h} = G,
    M = R.M,
    v0 = M.v0,
    kind = AN.stepKind,
    bu = biasUnit(),
    wi = AN.wi;
  const sc = kind === 'offset' ? AN.stepAmp * 100 : bu.toModel(bu.val) * 100; // model curves are per unit offset or per unit bias
  const tr = (pts, k) => pts.map(p => [p[0] * v0, p[1] * k]);
  const pred = tr(kind === 'offset' ? R.step : R.bias, sc),
    ms0 = AN.meas.step && AN.meas.step.kind === kind ? AN.meas.step : null;
  const ms = ms0 ? tr(ms0.data, kind === 'offset' ? ms0.amp * 100 : sc) : null,
    wiP = wi ? tr(kind === 'offset' ? wi.step : wi.bias, sc) : null;
  const all = pred
    .concat(ms || [], wiP || [])
    .map(p => p[1])
    .filter(isFinite);
  let lo = Math.min(0, ...all),
    hi = Math.max(0, ...all);
  const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-3);
  lo = Math.max(lo - 0.08 * m, -3 * sc - 1);
  hi = Math.min(hi + 0.12 * m, 3 * Math.abs(sc) + 1);
  const L = 48 * dpr,
    Rr = 10 * dpr,
    top = 20 * dpr,
    bot = h - 30 * dpr,
    xEnd = R.tEnd * v0;
  const A = anFrame(G, [L, top, w - Rr, bot], [0, xEnd], [lo, hi]);
  // time on the top axis
  {
    const st = niceStep(R.tEnd);
    anFont(G, 10);
    c.fillStyle = TOK.muted;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (let t = 0; t <= R.tEnd + 1e-9; t += st) {
      const x = A.X(t * v0);
      c.strokeStyle = TOK.muted;
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, top - 3 * dpr);
      c.stroke();
      c.fillText(`${fmtTick(t, st)} s`, x, top - 4 * dpr);
    }
  }
  // the path, and where the robot starts
  c.strokeStyle = rgba(TOK.accent, 0.45);
  c.lineWidth = 5 * dpr;
  c.beginPath();
  c.moveTo(A.X(0), A.Y(0));
  c.lineTo(A.X(xEnd), A.Y(0));
  c.stroke();
  label(G, 'path', A.X(xEnd) - 4 * dpr, A.Y(0) - 5 * dpr, TOK.accent, 'right', 'bottom');
  const sm = kind === 'offset' ? R.smOff : R.smBias;
  if (kind === 'offset') {
    const band = 0.02 * sc;
    c.fillStyle = rgba(TOK.ok, 0.1);
    c.fillRect(A.X(0), A.Y(band), A.X(xEnd) - A.X(0), A.Y(-band) - A.Y(band));
  }
  if (R.stable && sm.settle && sm.settle < R.tEnd * 0.98) {
    const x = A.X(sm.settle * v0);
    c.strokeStyle = TOK.ok;
    c.lineWidth = 1 * dpr;
    c.setLineDash([3 * dpr, 3 * dpr]);
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x, bot);
    c.stroke();
    c.setLineDash([]);
    label(
      G,
      `settled after ${fmt(sm.settle * v0, 1)} m`,
      x + (x > w * 0.7 ? -3 : 3) * dpr,
      bot - 3 * dpr,
      TOK.ok,
      x > w * 0.7 ? 'right' : 'left',
      'bottom'
    );
  }
  c.save();
  c.beginPath();
  c.rect(L, top, w - Rr - L, bot - top);
  c.clip();
  c.lineWidth = 2.2 * dpr;
  c.strokeStyle = R.stable ? TOK.ink : TOK.bad;
  polyline2(c, pred, A.X, A.Y);
  if (wiP) {
    c.lineWidth = 2 * dpr;
    c.strokeStyle = wi.unstable ? TOK.bad : TOK.accent;
    c.setLineDash([7 * dpr, 4 * dpr]);
    polyline2(c, wiP, A.X, A.Y);
    c.setLineDash([]);
  }
  const pl = AN.play && ms0 && ms0.pose ? AN.play : null,
    tNow = pl ? Math.min(pl.t, R.tEnd) : Infinity;
  if (ms) {
    c.lineWidth = 2 * dpr;
    c.strokeStyle = pl ? rgba(TOK.amber, 0.35) : TOK.amber;
    c.setLineDash([3 * dpr, 3 * dpr]);
    polyline2(c, ms, A.X, A.Y);
    c.setLineDash([]);
    if (pl) {
      c.lineWidth = 2.6 * dpr;
      c.strokeStyle = TOK.amber;
      polyline2(
        c,
        ms.filter((p, i) => ms0.data[i][0] <= tNow + 1e-9),
        A.X,
        A.Y
      );
    }
  }
  if (kind === 'offset') {
    c.fillStyle = TOK.ink;
    c.beginPath();
    c.arc(A.X(0), A.Y(sc), 4 * dpr, 0, TAU);
    c.fill();
  }
  c.restore();
  if (pl) anRobotGlyph(G, A, ms0.pose, tNow, v0, L, top);
  label(
    G,
    kind === 'offset'
      ? 'sideways offset [cm]'
      : `offset from a ${bu.val} ${bu.unit} ${isCar() ? 'steering misalignment' : 'turn-rate bias'} [cm]`,
    L + 4 * dpr,
    top + 3 * dpr,
    TOK.muted,
    'left',
    'top'
  );
  label(G, 'distance driven along the path [m]', w - Rr, h - 2 * dpr, TOK.muted, 'right', 'bottom');
  // legend
  anFont(G, 10);
  let ly = top + 8 * dpr;
  const lx = w - Rr - 80 * dpr,
    leg = (col, dash, t) => {
      c.strokeStyle = col;
      c.lineWidth = 2 * dpr;
      c.setLineDash(dash);
      c.beginPath();
      c.moveTo(lx, ly);
      c.lineTo(lx + 16 * dpr, ly);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = TOK.muted;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(t, lx + 20 * dpr, ly);
      ly += 13 * dpr;
    };
  leg(R.stable ? TOK.ink : TOK.bad, [], 'model');
  if (wiP) leg(wi.unstable ? TOK.bad : TOK.accent, [7 * dpr, 4 * dpr], wi.unstable ? 'what-if (unstable)' : 'what-if');
  if (ms) leg(TOK.amber, pl ? [] : [3 * dpr, 3 * dpr], 'simulator');
  AN.stretch = ((A.Y(0) - A.Y(1)) * 100) / Math.max(1e-9, A.X(1) - A.X(0)); // screen px per m sideways over px per m along
}
// the simulated robot at time t on the response plot: same stretched axes as the curve, so its heading is stretched too
function anRobotGlyph(G, A, pose, t, v0, x0, y0) {
  const {c, dpr} = G,
    i = Math.min(pose.length - 1, Math.max(0, Math.round(t / DT))),
    p = pose[i],
    car = isCar();
  const x = A.X(t * v0),
    y = A.Y(p[2] * 100),
    kx = A.X(1) - A.X(0),
    ky = (A.Y(0) - A.Y(1)) * 100,
    ang = Math.atan2(-Math.sin(p[3]) * ky, Math.cos(p[3]) * kx);
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.lineWidth = 1.5 * dpr;
  c.strokeStyle = TOK.ink;
  c.fillStyle = rgba(TOK.amber, 0.9);
  if (car) {
    const Lb = 26 * dpr,
      Wb = 12 * dpr;
    c.beginPath();
    c.rect(-6 * dpr, -Wb / 2, Lb, Wb);
    c.fill();
    c.stroke();
    for (const sy of [-1, 1]) {
      c.save();
      c.translate(Lb - 10 * dpr, (sy * Wb) / 2);
      c.rotate(-p[4]);
      c.fillStyle = TOK.ink;
      c.fillRect(-4 * dpr, -1.5 * dpr, 8 * dpr, 3 * dpr);
      c.restore();
    }
  } // front wheels at the steering angle (screen y points down)
  else {
    const r = 8 * dpr;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(r + 5 * dpr, 0);
    c.stroke();
    if (Math.abs(p[4]) > 0.02) {
      c.strokeStyle = TOK.accent;
      c.lineWidth = 2 * dpr;
      const s = p[4] > 0 ? -1 : 1,
        sw = Math.min(1.4, Math.abs(p[4])) * 1.2;
      c.beginPath();
      c.arc(0, 0, r + 4 * dpr, 0, s * sw, s < 0);
      c.stroke();
    }
  } // arc: which way it is turning
  c.restore();
  const deg = v => (v * 180) / Math.PI;
  AN.playTxt = `offset ${(p[2] * 100).toFixed(1)} cm · heading ${deg(p[3]).toFixed(1)}° · ${car ? `steering ${deg(p[4]).toFixed(1)}°` : `turning ${deg(p[4]).toFixed(0)}°/s`}`; // shown under the plot
}
// playback of the simulated step test: real time (or faster), driven by requestAnimationFrame while Analyze shows it
function anPlayStart() {
  const sp = AN.play ? AN.play.speed : 1;
  AN.play = {t: 0, on: true, last: performance.now(), speed: sp};
  requestAnimationFrame(anPlayTick);
}
function anPlayTick(now) {
  const pl = AN.play;
  if (!pl || !pl.on) return;
  const R = AN.res;
  if (AN.mode !== 'an' || AN.loop !== 'lat' || !R || !R.step) {
    // no linear model (DWA, your code) or none computed yet: nothing to play
    pl.on = false;
    anPlayUI();
    return;
  }
  pl.t += Math.min(0.1, (now - pl.last) / 1000) * pl.speed;
  pl.last = now;
  if (pl.t >= R.tEnd) {
    pl.t = R.tEnd;
    pl.on = false;
  }
  drawStep(R);
  anPlayUI();
  if (pl.on) requestAnimationFrame(anPlayTick);
}
function anPlayUI() {
  const pl = AN.play,
    R = AN.res,
    b = $('#an-play'),
    sc = $('#an-scrub'),
    lb = $('#an-pt');
  if (!b || !R) return;
  const has = !!(AN.meas.step && AN.meas.step.pose && AN.meas.step.kind === AN.stepKind);
  $('#an-play-row').hidden = !has;
  if (!has) return;
  b.textContent = pl && pl.on ? '❚❚ Pause' : pl && pl.t >= R.tEnd - 1e-9 ? '↺ Replay' : '▶ Play';
  sc.max = String(Math.round(R.tEnd * 100));
  sc.value = String(Math.round((pl ? pl.t : R.tEnd) * 100));
  lb.textContent = `${fmt(pl ? pl.t : R.tEnd, 1)} / ${fmt(R.tEnd, 1)} s${pl && AN.playTxt ? ' · ' + AN.playTxt : ''}`;
}

/* ---------- poles you can drag ---------- */
const PZ = {view: null, map: null, drag: false, raf: 0};
// The pole plot: closed-loop poles, the root locus or the knob curve, and the draggable what-if design.
function drawPoles(R) {
  const G = anCanvas('cv-pz');
  if (!G) return;
  const {c, dpr, w, h} = G,
    wi = AN.wi,
    kn = R.knob;
  const L = 44 * dpr,
    Rr = 8 * dpr,
    top = 8 * dpr,
    bot = h - 34 * dpr;
  if (!PZ.drag || !PZ.view) {
    // a stable view while dragging, so the pole stays under the finger; equal scales so ζ angles are true
    const pts = [R.dom, wi && wi.dom, wi && wi.tg].filter(Boolean);
    if (kn) {
      const q = kn.pts.reduce((a, q) => (q.dom && Math.abs(q.x - kn.cur) < Math.abs(a.x - kn.cur) ? q : a), kn.pts[0]);
      if (q.dom) pts.push(q.dom);
    }
    let X = 1,
      Xp = 0,
      Y = 0.6;
    for (const s of pts) {
      if (s[0] < 0) X = Math.max(X, 1.3 * -s[0]);
      else Xp = Math.max(Xp, 1.3 * s[0]);
      Y = Math.max(Y, 1.3 * Math.abs(s[1]));
    }
    X = Math.min(X, 60);
    Xp = Math.min(Xp, 60);
    Y = Math.min(Y, 60);
    const Wp = (w - L - Rr) / dpr,
      Hp = (bot - top) / dpr,
      k = Math.max(X / (0.82 * Wp), Xp / (0.18 * Wp), Y / (0.9 * Hp));
    PZ.view = {xr: [-0.82 * Wp * k, 0.18 * Wp * k], yr: [-0.1 * Hp * k, 0.9 * Hp * k]};
  }
  const {xr, yr} = PZ.view,
    A = anFrame(G, [L, top, w - Rr, bot], xr, yr);
  PZ.map = {x0: L / dpr, x1: (w - Rr) / dpr, y0: top / dpr, y1: bot / dpr, xr, yr};
  c.fillStyle = rgba(TOK.bad, 0.07);
  c.fillRect(A.X(0), top, A.X(xr[1]) - A.X(0), bot - top);
  label(G, 'unstable', A.X(xr[1]) - 3 * dpr, top + 3 * dpr, TOK.bad, 'right', 'top');
  c.strokeStyle = TOK.muted;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(A.X(0), top);
  c.lineTo(A.X(0), bot);
  c.moveTo(L, A.Y(0));
  c.lineTo(w - Rr, A.Y(0));
  c.stroke();
  c.setLineDash([2 * dpr, 3 * dpr]);
  const Rs = Math.hypot(xr[0], yr[1]);
  for (const z of [0.3, 0.7, 1]) {
    const th = Math.acos(z);
    c.beginPath();
    c.moveTo(A.X(0), A.Y(0));
    c.lineTo(A.X(-Rs * Math.cos(th)), A.Y(Rs * Math.sin(th)));
    c.stroke();
    const rr = 0.93 * Math.min(-xr[0] / Math.max(Math.cos(th), 1e-6), yr[1] / Math.max(Math.sin(th), 1e-6));
    label(
      G,
      `ζ ${z}`,
      A.X(-rr * Math.cos(th)) + (z === 1 ? 2 * dpr : 0),
      A.Y(rr * Math.sin(th)) + (z === 1 ? -3 * dpr : 0),
      TOK.muted,
      'left',
      z === 1 ? 'bottom' : 'top'
    );
  }
  c.setLineDash([]);
  const inV = s => s[0] >= xr[0] && s[0] <= xr[1] && Math.abs(s[1]) <= yr[1];
  // the knob's curve: where a one-knob tracker can put its poles
  if (kn) {
    c.strokeStyle = rgba(TOK.accent, 0.55);
    c.lineWidth = 2 * dpr;
    c.beginPath();
    let up = true;
    for (const q of kn.pts) {
      if (!q.dom || !inV(q.dom)) {
        up = true;
        continue;
      }
      const x = A.X(q.dom[0]),
        y = A.Y(q.dom[1]);
      if (up) {
        c.moveTo(x, y);
        up = false;
      } else c.lineTo(x, y);
    }
    c.stroke();
    let last = null;
    kn.pts.forEach((q, i) => {
      if (i % 6 || !q.dom || !inV(q.dom)) return;
      const x = A.X(q.dom[0]),
        y = A.Y(q.dom[1]);
      if (last && Math.hypot(x - last[0], y - last[1]) < 46 * dpr) return;
      last = [x, y];
      c.fillStyle = TOK.accent;
      c.beginPath();
      c.arc(x, y, 2.5 * dpr, 0, TAU);
      c.fill();
      label(
        G,
        `${kn.sym} ${q.x.toFixed(q.x < 1 ? 2 : 1)}${kn.unit ? ' ' + kn.unit : ''}`,
        x + 5 * dpr,
        y - 3 * dpr,
        TOK.accent,
        'left',
        'bottom'
      );
    });
  }
  let off = 0;
  const dot = (s, col, r, ring) => {
    if (!inV(s)) {
      off++;
      return;
    }
    c.beginPath();
    c.arc(A.X(s[0]), A.Y(s[1]), r, 0, TAU);
    if (ring) {
      c.strokeStyle = col;
      c.lineWidth = 2 * dpr;
      c.stroke();
    } else {
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = TOK['map-bg'];
      c.lineWidth = 1.5 * dpr;
      c.stroke();
    }
  };
  for (const s of R.poles) dot(s, s[0] > 0 ? TOK.bad : TOK.ink, 5.5 * dpr);
  if (wi) {
    c.setLineDash([3 * dpr, 2 * dpr]);
    dot(wi.tg, TOK.accent, 9 * dpr, true);
    c.setLineDash([]);
    for (const s of wi.ps) if (inV(s)) dot(s, s[0] > 0 ? TOK.bad : TOK.accent, 4.5 * dpr);
  }
  label(
    G,
    `● now${wi ? '  ● what-if  ◌ dragged' : ''}${kn ? "  — this tracker's knob" : ''}${off ? `  · ${off} fast pole${off > 1 ? 's' : ''} off the plot` : ''}`,
    L,
    h - 2 * dpr,
    TOK.muted,
    'left',
    'bottom'
  );
  label(G, '← dies out faster', L + 4 * dpr, A.Y(0) + 3 * dpr, TOK.muted, 'left', 'top');
  label(G, 'swings faster ↑', A.X(0) - 4 * dpr, top + 3 * dpr, TOK.muted, 'right', 'top');
}
function pzEvent(e) {
  const m = PZ.map,
    cv = $('#cv-pz');
  if (!m || !cv) return null;
  const r = cv.getBoundingClientRect(),
    px = e.clientX - r.left,
    py = e.clientY - r.top;
  const sx = m.xr[0] + ((px - m.x0) / (m.x1 - m.x0)) * (m.xr[1] - m.xr[0]),
    sy = m.yr[1] - ((py - m.y0) / (m.y1 - m.y0)) * (m.yr[1] - m.yr[0]);
  return [sx, Math.abs(sy)];
} // the right half too: a what-if may be unstable
// A design from numbers rather than a drag: pole placement by (ζ, ω_n) or LQR by (q_e, q_θ, r). The gains are the
// delay-free textbook ones; the what-if then shows where the pair really lands with the hold, latency and lag in the loop.
function anDesign(kind, a, b, c) {
  const R = AN.res;
  if (!R || R.loop === 'spd' || R.M.kind === 'none') return;
  const d = kind === 'lqr' ? lqrGains(R.M, a, b, c) : placeGains(R.M, a, b);
  if (!isFinite(d.tg[0]) || !isFinite(d.tg[1])) return;
  anWhatIfAt(d.tg);
  if (AN.wi) {
    const w = AN.wi,
      ask =
        kind === 'lqr'
          ? `LQR with q_e = ${a}, q_θ = ${b}, r = ${c} asks for a pair at ζ ${fmt(d.zeta, 2)}, ω_n ${fmt(d.wn, 2)} rad/s`
          : `pole placement asks for a pair at ζ ${a}, ω_n ${b} rad/s`;
    w.design = `${ask}. The textbook gains ignore the delays: K_e = ${fmt(d.Ke, 2)}, K_θ = ${fmt(d.Kth, 2)}. With the hold, latency and lag in the loop the same pair needs K_e = ${fmt(w.Ke, 2)}, K_θ = ${fmt(w.Kth, 2)}${w.clamped ? ', beyond what the Control sliders reach (Apply writes their ends)' : ''}.`;
    renderAnalysis();
  }
}
function wireAnDesign() {
  const row = $('#an-design');
  if (!row) return;
  const num = id => parseFloat($('#' + id).value);
  $('#d-place').onclick = () => anDesign('place', clamp(num('d-zeta') || 0.7, 0.05, 2), clamp(num('d-wn') || 2, 0.1, 30));
  $('#d-lqr').onclick = () =>
    anDesign('lqr', clamp(num('d-qe') || 1, 1e-4, 1e4), clamp(num('d-qth') || 0, 0, 1e4), clamp(num('d-r') || 0.1, 1e-4, 1e4));
  row.querySelectorAll('input').forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') (i.id === 'd-zeta' || i.id === 'd-wn' ? $('#d-place') : $('#d-lqr')).click();
      })
  );
}
wireAnDesign();
function anWhatIfAt(tg) {
  const R = AN.res;
  if (!R || R.loop === 'spd' || R.M.kind === 'none') return;
  if (R.knob === undefined) R.knob = anKnobCurve(R);
  const r = anWhatIf(R, tg);
  if (r) {
    AN.wi = r;
    renderAnalysis();
  }
}
{
  const cv = $('#cv-pz');
  if (cv) {
    cv.tabIndex = 0;
    cv.addEventListener('pointerdown', e => {
      const t = pzEvent(e);
      if (!t) return;
      e.preventDefault();
      PZ.drag = true;
      cv.setPointerCapture(e.pointerId);
      anWhatIfAt(t);
    });
    cv.addEventListener('pointermove', e => {
      if (!PZ.drag) return;
      const t = pzEvent(e);
      if (!t) return;
      cancelAnimationFrame(PZ.raf);
      PZ.raf = requestAnimationFrame(() => anWhatIfAt(t));
    });
    const end = () => {
      if (!PZ.drag) return;
      PZ.drag = false;
      renderAnalysis();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', e => {
      const R = AN.res;
      if (!R || !R.dom) return;
      const k = {ArrowLeft: [1.1, 1], ArrowRight: [1 / 1.1, 1], ArrowUp: [1, 1.1], ArrowDown: [1, 1 / 1.1]}[e.key];
      if (!k) return;
      e.preventDefault();
      const b = AN.wi ? AN.wi.tg : R.dom,
        st = 0.08 * Math.max(1, Math.hypot(b[0], b[1])); // left/right by steps, so the pole can cross into the right half
      anWhatIfAt([e.key === 'ArrowLeft' ? b[0] - st : e.key === 'ArrowRight' ? b[0] + st : b[0], Math.max(0.05, b[1]) * k[1]]);
    });
  }
}
$('#an-wi-x').onclick = () => {
  AN.wi = null;
  renderAnalysis();
};

/* ---------- the loop in plain words, with the gains in physical units ---------- */
const d10 = (10 * Math.PI) / 180;
function gainWords(M, Ke, Kth) {
  // what the controller does for a 10 cm offset and a 10° heading error
  const car = M.car,
    u = car ? 'steers' : 'turns';
  const f = v => `${fmt((Math.abs(v) * 180) / Math.PI, 1)}°${car ? '' : '/s'}`;
  return `<b>${u} ${f(Ke * 0.1)}</b> back toward the path for every <b>10 cm</b> of sideways offset, and <b>${f(Kth * d10)}</b> for every <b>10°</b> the heading points away from the path`;
}
function anStory(R) {
  const M = R.M,
    v = M.v0,
    ctlN = CTL_NAMES[anCtl()] || P.ctl,
    car = M.car,
    cm = Math.round(AN.stepAmp * 100);
  const where = anR() ? `a left turn of radius <b>${anR()} m</b>` : 'a <b>straight path</b>';
  let h = `<p><b>The situation.</b> The ${car ? 'car' : 'robot'} drives ${where} at <b>${fmt(v)} m/s</b> (the cruise speed). Something pushes it <b>${cm} cm</b> to the side. How does <b>${ctlN}</b> steer it back, and how robust is that? Everything below comes from a linear model of this situation (small errors), and <i>Run step test</i> checks it against the full simulator.</p>`;
  let ctl;
  if (M.kind === 'static') {
    ctl = `it ${gainWords(M, M.Ke, M.Kth)}.`;
    if (M.ctl === 'pp') {
      const Ld = Math.max(0.1, P.ppL0 + P.ppK * v);
      ctl += ` Both numbers come from one knob, the lookahead L<sub>d</sub> = ${fmt(Ld)} m (L₀ + k·v): the offset gain is 2v/L<sub>d</sub>², the heading gain 2v/L<sub>d</sub>. So pure pursuit's damping is fixed (ζ ≈ 0.71) and L<sub>d</sub> only sets how fast.`;
    } else if (M.ctl === 'rwf')
      ctl += ` The two settings act separately: k<sub>e</sub> = ${fmt(P.rwKe, 1)} is the spring (offset), k<sub>θ</sub> = ${fmt(P.rwKth, 1)} the damper (heading).`;
    else if (M.ctl === 'stanley') ctl += ` It steers the front wheels to the path heading plus atan(k·e/v), k = ${fmt(P.stanK, 1)}.`;
  } else if (M.kind === 'pid') {
    const Ld = M.Ld;
    ctl = `it aims at a point L<sub>d</sub> = ${fmt(Ld)} m ahead on the path: the angle to it is α ≈ −e/L<sub>d</sub> − θₑ, and the command is K<sub>p</sub>α + K<sub>i</sub>∫α + K<sub>d</sub>α̇ with K<sub>p</sub> ${fmt(P.kp, 1)}, K<sub>i</sub> ${fmt(P.ki, 2)}, K<sub>d</sub> ${fmt(P.kd, 2)}. The proportional part alone ${gainWords(M, P.kp / Ld, P.kp)}.`;
  } else {
    const K = M.K,
      f = x => fmt((Math.abs(x) * 180) / Math.PI, 0);
    ctl = `MPC replans every tick, but near this situation it acts like a feedback on the <i>rate</i> of ${car ? 'steering' : 'turning'}: it changes the ${car ? 'steering angle' : 'turn rate'} by about <b>${f(K.e * 0.1)}°/s${car ? '' : '²'}</b> for every 10 cm of offset and <b>${f(K.th * d10)}°/s${car ? '' : '²'}</b> for every 10° of heading error, and backs off in proportion to the ${car ? 'steering' : 'turning'} it already has (gains read from the MPC by finite differences).`;
  }
  const sw = v * Math.sin(d10) * 100,
    Td = M.Td * 1000;
  h += `<p><b>The controller</b> (${ctlN}): ${ctl}</p>`;
  if (M.dyn) {
    const D = dynInfo(),
      Gr = M.dyn.nr[0] / M.dyn.det[0],
      md = dynModes(v);
    h += `<p><b>The vehicle: a car with tyre slip.</b> A tyre pushes sideways only by slipping, so steering does not set the turn rate directly: the front tyres must slip before they push, and the yaw rate follows the steering through the car's own yaw mode (${md.text}). It settles at <b>${fmt(Gr, 2)} rad/s per radian of steering</b>, ${fmt((100 * Gr) / M.g, 0)} % of what the kinematic car would do (v/L = ${fmt(M.g, 2)}): this car ${D.K > 0 ? `understeers (K<sub>us</sub> ${fmt(D.K, 4)} rad per m/s², characteristic speed ${fmt(D.vch, 2)} m/s)` : D.K < 0 ? `oversteers (critical speed ${fmt(D.vcrit, 2)} m/s)` : 'is neutral'}. While it turns, the rear axle also slides sideways. Pointing 10° away from the path still drifts it sideways at <b>${fmt(sw, 0)} cm/s</b>. So offset builds up from heading, heading from yaw rate, and yaw rate from steering through the tyres: the two integrations of the kinematic car plus a lag, which costs phase. The model holds while the tyres stay below their grip limit of μg = ${fmt(D.aMax, 2)} m/s².</p>`;
  } else
    h += `<p><b>The vehicle.</b> ${car ? `The heading turns at v·tan δ / L = ${fmt(v / P.wheelbase, 2)} rad/s per radian of steering (wheelbase ${fmt(P.wheelbase, 2)} m)` : 'The heading turns at the commanded rate'}; pointing 10° away from the path at ${fmt(v)} m/s drifts it sideways at <b>${fmt(sw, 0)} cm/s</b>. So offset builds up from heading error, and heading from steering: two integrations, which is why the loop can overshoot.</p>`;
  h += `<p><b>Delays.</b> The ${car ? 'wheels' : 'motors'} act on a measurement about <b>${fmt(Td, 0)} ms</b> old (half of the 50 ms control tick${M.nL ? ` plus ${fmt(M.nL * DT * 1000, 0)} ms of latency` : ''})${M.tau > 0 ? `, and the actuator follows its command with a lag τ = ${fmt(M.tau, 2)} s` : ''}. Delay is what eventually makes a fast controller oscillate.</p>`;
  return h;
}
function anKeyChips(R) {
  const M = R.M,
    so = R.smOff,
    sb = R.smBias,
    bu = biasUnit(),
    ms = AN.meas.step,
    F = R.F,
    cm = AN.stepAmp * 100,
    v = M.v0;
  const sim = ms && ms.kind === 'offset' ? stepMetrics(ms.data, 'offset') : null;
  if (!R.stable)
    return (
      chip(
        'Comes back to the path?',
        'no: the swing grows',
        'badc',
        'The linear loop is unstable; in the simulator the steering limits usually turn this into a sustained weave'
      ) + chip('Unstable modes', String(R.unstableZ), 'badc', 'Closed-loop poles in the right half plane (red region of the pole plot)')
    );
  return (
    chip('Comes back to the path?', 'yes', 'good', 'All closed-loop poles are in the stable (left) half') +
    chip(
      'Back within 2 %',
      `${fmt(so.settle, 1)} s · ${fmt(so.settle * v, 1)} m driven${sim ? ` (sim ${fmt(sim.settle, 1)} s)` : ''}`,
      '',
      'Time, and distance along the path, until the offset stays within 2 % of where it started'
    ) +
    chip(
      'Overshoot',
      so.overshoot < 0.5
        ? 'none'
        : `${fmt(so.overshoot, 0)} % · crosses the path by ${fmt((so.overshoot / 100) * cm, 1)} cm${sim ? ` (sim ${fmt(sim.overshoot, 0)} %)` : ''}`,
      so.overshoot > 25 ? 'warnc' : '',
      'How far it swings past the path, for this starting offset'
    ) +
    chip(
      'Extra delay it tolerates',
      F.dm != null ? fmt(F.dm * 1000, 0) + ' ms' : '—',
      F.dm != null ? (F.dm > 0.1 ? 'good' : F.dm > 0.03 ? 'warnc' : 'badc') : '',
      'Add this much more latency between sensing and steering and the loop starts to oscillate forever (delay margin = phase margin / crossover)'
    ) +
    chip(
      `Left over from a ${bu.val} ${bu.unit} ${isCar() ? 'misalignment' : 'turn bias'}`,
      `${fmt(Math.abs(sb.final * bu.toModel(bu.val)) * 100, 1)} cm`,
      Math.abs(sb.final * bu.toModel(bu.val)) < 0.005 ? 'good' : '',
      'A constant actuator error leaves a steady sideways offset unless the controller has integral action'
    ) +
    (anR()
      ? chip(
          'Offset on the curve',
          fmt((M.ess || 0) * 100, 1) + ' cm',
          Math.abs(M.ess || 0) < 0.03 ? 'good' : 'warnc',
          'Steady offset in the turn: positive = inside (cutting)'
        )
      : '')
  );
}
function anPzCaption(R) {
  const wi = AN.wi,
    v = R.M.v0;
  const modeTxt = s => {
    if (!s) return '—';
    const sig = -s[0],
      om = Math.abs(s[1]),
      sw = om > 0.02 ? `, swings once every <b>${fmt((2 * Math.PI) / om, 1)} s</b> (${fmt(((2 * Math.PI) / om) * v, 1)} m)` : ', no swing';
    if (sig > 1e-6) return `dies out with time constant <b>${fmt(1 / sig, 2)} s</b>${sw}`;
    if (sig < -1e-6) return `<b class="bad">grows</b>, doubling every <b>${fmt(Math.LN2 / -sig, 2)} s</b>${sw}`;
    return `neither grows nor dies out${sw}`;
  };
  let h = `<p>Each pole is one way the error can move, <i>e</i><sup>st</sup>. Further <b>left</b> = it dies out faster; further from the axis (<b>up</b>) = it swings faster; a pole in the red half grows. Now the slowest pair ${modeTxt(R.dom)}${R.zeta != null ? ` (damping ζ ${fmt(R.zeta, 2)})` : ''}.</p>`;
  if (!wi)
    h += `<p class="an-hint">${R.knob ? `${CTL_NAMES[R.M.ctl]} has one knob, so its poles can only move along the blue curve. Drag a pole along it, or into the red half to see an unstable loop` : R.M.kind === 'static' ? 'Drag a pole anywhere, including into the red half: the two gains that put it there are computed for you' : 'Drag a pole to try a design, including into the red half: the what-if is a state-feedback tracker (rear-wheel feedback) with the gains that put the pole there'}; the response on the left updates. Keyboard: focus the plot and use the arrow keys.</p>`;
  else {
    const ap = wi.set,
      neg = wi.Kth < 0;
    h +=
      `<p><b>What-if:</b> ${wi.unstable ? `<b class="bad">unstable</b>: the slowest pair ${modeTxt(wi.dom)}` : modeTxt(wi.dom)}${wi.unstable ? '' : `, overshoot ${fmt(wi.sm.overshoot, 0)} %, back within 2 % after ${fmt(wi.sm.settle * v, 1)} m`}. ${wi.beyond ? `${CTL_NAMES[R.M.ctl]}'s knob cannot leave its curve, so this is the two-gain form u = −(K<sub>e</sub>e + K<sub>θ</sub>θₑ) with K<sub>e</sub> ${fmt(wi.Ke)} and K<sub>θ</sub> ${fmt(wi.Kth)}. ` : ''}${wi.knob ? '' : neg ? `It needs a <b>negative heading gain</b> (K<sub>θ</sub> = ${fmt(wi.Kth)}): the controller would turn further away the more the heading points away, which pumps energy into the swing.` : `The controller would ${gainWords(R.M, wi.Ke, wi.Kth)}.`}${wi.err != null && wi.err > 0.05 * Math.hypot(wi.tg[0], wi.tg[1]) ? ' The delay keeps the pole from landing exactly where you dragged it.' : ''}</p>` +
      (wi.knob || wi.applicable
        ? `<p><button type="button" class="btn small" id="an-wi-apply">${ap.ctl && ap.ctl !== P.ctl ? 'Switch to rear-wheel feedback with ' : 'Apply '}${wi.setTxt.replace('k_e', 'k<sub>e</sub>').replace('k_θ', 'k<sub>θ</sub>')}</button>${wi.clamped ? ' <span class="note">(clamped to the slider range)</span>' : ''}</p>`
        : `<p class="note">Not applicable: rear-wheel feedback would need k<sub>e</sub> = ${fmt(wi.need.ke, 1)}, k<sub>θ</sub> = ${fmt(wi.need.kth, 1)}, and its settings stop at 0. It is here to show what an unstable loop does.</p>`);
  }
  return h;
}
function anApplyWhatIf() {
  const wi = AN.wi;
  if (!wi) return;
  const set = wi.set;
  AN.wi = null;
  if (set.ctl && set.ctl !== P.ctl) setParam('ctl', set.ctl, false);
  for (const [k, v] of Object.entries(set)) if (k !== 'ctl') setParam(k, v, false);
  logE(`Analyze: applied ${wi.setTxt}${set.ctl && set.ctl !== 'rwf' ? '' : ''}`);
  renderAllPanes();
  anInvalidate();
  renderAnalysis();
}
// the car with tyre slip: the plant in numbers (yaw rate per steering angle, with the tyres' yaw mode)
function anDynTF(M) {
  const D = M.dyn,
    pn = p => p.map(x => fmt(x, 2)),
    [n0, n1] = pn(D.nr),
    [d0, d1] = pn(D.det),
    [m0, m1] = pn(D.nvy),
    Gr0 = D.nr[0] / D.det[0],
    md = dynModes(M.v0);
  return `<p><b>The plant with tyre slip.</b> Steering does not set the yaw rate directly; the tyres do, through the car's own yaw mode: G<sub>r</sub>(s) = r/δ = (${n1} s + ${n0}) / (s² + ${d1} s + ${d0}), and the lateral velocity G<sub>vy</sub>(s) = (${m1} s + ${m0}) / (same). Then θ̇ₑ = r and ė = v₀ θₑ + v<sub>y</sub> − l<sub>r</sub> r (the rear axle slides sideways at v<sub>y</sub> − l<sub>r</sub> r), so the vehicle part of L(s) is K<sub>e</sub>·(v₀ G<sub>r</sub>/s + G<sub>vy</sub> − l<sub>r</sub> G<sub>r</sub>)/s + K<sub>θ</sub>·G<sub>r</sub>/s. Steady gain G<sub>r</sub>(0) = ${fmt(Gr0, 2)} 1/s against the kinematic v₀/L = ${fmt(M.g, 2)} (${fmt((100 * Gr0) / M.g, 0)} %); yaw mode ${md.text}. The 20 Hz loop uses the exact sampled plant (δ held over each tick), not the T/2 delay.</p>`;
}
function anTF(R) {
  const M = R.M,
    g = M.g,
    v = M.v0,
    lag = M.tau > 0 ? ` · 1/(${fmt(M.tau, 2)}s + 1)` : '',
    dl = `e<sup>−${fmt(M.Td, 3)}s</sup>`;
  if (M.dyn)
    return (
      anDynTF(M) +
      anTFkin(R)
        .replace('<p><b>Transfer function.</b> ', '<p><b>Transfer function, if the car were kinematic</b> (for comparison): ')
        .replace('the exact 20 Hz loop with the delay gives', 'the exact 20 Hz loop with the delay and the tyres gives')
    );
  return anTFkin(R);
}
function anTFkin(R) {
  const M = R.M,
    g = M.g,
    v = M.v0,
    lag = M.tau > 0 ? ` · 1/(${fmt(M.tau, 2)}s + 1)` : '',
    dl = `e<sup>−${fmt(M.Td, 3)}s</sup>`;
  let h = '<p><b>Transfer function.</b> ';
  if (M.kind === 'static') {
    const a = g * M.Kth,
      b = g * v * M.Ke,
      wn = Math.sqrt(Math.max(0, b)),
      z = wn > 0 ? a / (2 * wn) : 0;
    h += `Open loop from the ${M.car ? 'steering' : 'turn-rate'} command around to itself: L(s) = (g K<sub>θ</sub> s + g v₀ K<sub>e</sub>) / s² · e<sup>−sT<sub>d</sub></sup>${M.tau > 0 ? ' · 1/(τs+1)' : ''}, with g = ${M.car ? `v₀/L = ${fmt(g, 2)} 1/s` : '1'}, K<sub>e</sub> = ${fmt(M.Ke, 2)}, K<sub>θ</sub> = ${fmt(M.Kth, 2)}:</p><div class="eq">L(s) = (${fmt(a, 2)} s + ${fmt(b, 2)}) / s² · ${dl}${lag}</div>
      <p>Without the delay the closed loop is s² + ${fmt(a, 2)} s + ${fmt(b, 2)} = 0, so ω<sub>n</sub> = √(g v₀ K<sub>e</sub>) = ${fmt(wn, 2)} rad/s and ζ = g K<sub>θ</sub> / (2ω<sub>n</sub>) = ${fmt(z, 2)}; the exact 20 Hz loop with the delay gives ω<sub>n</sub> ${fmt(R.wn, 2)}, ζ ${fmt(R.zeta, 2)}. Units: s in 1/s, K<sub>e</sub> in ${M.car ? 'rad' : 'rad/s'} per m, K<sub>θ</sub> in ${M.car ? 'rad' : 'rad/s'} per rad.</p>`;
  } else if (M.kind === 'pid')
    h += `L(s) = C(z) · (g v₀/L<sub>d</sub> + g s) / s² · ${dl}${lag}, with the 20 Hz PID C(z) = K<sub>p</sub> + K<sub>i</sub>T/(1 − z⁻¹) + K<sub>d</sub>(1 − z⁻¹)/T, z = e<sup>sT</sup>, L<sub>d</sub> = ${fmt(M.Ld, 2)} m.</p>`;
  else
    h += `L(s) = T/(1 − z⁻¹) · 1/(1 − K<sub>u</sub>z⁻¹) · [K<sub>c</sub>z⁻¹ + (K<sub>s</sub>z⁻¹ + (K<sub>e</sub> g v₀ + K<sub>θ</sub> g s)/s² · ${dl})${lag}], with K<sub>e</sub> ${fmt(M.K.e, 2)}, K<sub>θ</sub> ${fmt(M.K.th, 2)}, K<sub>s</sub> ${fmt(M.K.s, 2)}, K<sub>c</sub> ${fmt(M.K.c || 0, 2)}, K<sub>u</sub> ${fmt(M.K.u, 2)} read from the MPC.</p>`;
  return h;
}
/* ---------- where the numbers come from: each chip derived, with today's values ---------- */
const chLink = (sec, t) => `<a class="chref" href="#notes=ch6/${sec}">${t}</a>`;
function anFormulaGains(M) {
  // the tracker's linear gains from its formula (the chips use the ones read from the code)
  const v = M.v0,
    car = M.car,
    L = P.wheelbase;
  if (M.ctl === 'pp') {
    const Ld = Math.max(0.1, P.ppL0 + P.ppK * v),
      a = car ? L : v;
    return {
      txt: `pure pursuit turns toward a point L<sub>d</sub> = L₀ + k·v₀ = ${fmt(Ld)} m ahead: ${car ? 'δ = atan(2L sin α / L<sub>d</sub>)' : 'ω = 2v sin α / L<sub>d</sub>'} with α ≈ −e/L<sub>d</sub> − θₑ, so K<sub>e</sub> = 2${car ? 'L' : 'v₀'}/L<sub>d</sub>² and K<sub>θ</sub> = 2${car ? 'L' : 'v₀'}/L<sub>d</sub>`,
      Ke: (2 * a) / (Ld * Ld),
      Kth: (2 * a) / Ld
    };
  }
  if (M.ctl === 'rwf') {
    const a = car ? L : v;
    return {
      txt: `rear-wheel feedback commands the curvature −k<sub>θ</sub>θₑ − k<sub>e</sub>e (k<sub>e</sub> = ${fmt(P.rwKe, 1)}, k<sub>θ</sub> = ${fmt(P.rwKth, 1)}), ${car ? 'steering δ = atan(L κ)' : 'turning at ω = v κ'}, so K<sub>e</sub> = ${car ? 'L' : 'v₀'}k<sub>e</sub> and K<sub>θ</sub> = ${car ? 'L' : 'v₀'}k<sub>θ</sub>`,
      Ke: a * P.rwKe,
      Kth: a * P.rwKth
    };
  }
  if (M.ctl === 'stanley') {
    const q = 0.5 + v;
    return {
      txt: `Stanley steers δ = −θₑ − atan(k e<sub>f</sub> / (0.5 + v)) with the front-axle offset e<sub>f</sub> ≈ e + L θₑ (k = ${fmt(P.stanK, 1)}), so K<sub>e</sub> = k/(0.5 + v₀) and K<sub>θ</sub> = 1 + kL/(0.5 + v₀)`,
      Ke: P.stanK / q,
      Kth: 1 + (P.stanK * L) / q
    };
  }
  return null;
}
function anWhy(R) {
  const M = R.M,
    v = M.v0,
    g = M.g,
    car = M.car,
    so = R.smOff,
    sb = R.smBias,
    F = R.F,
    bu = biasUnit(),
    d = bu.toModel(bu.val),
    cm = AN.stepAmp * 100;
  const ctlN = CTL_NAMES[M.ctl] || M.ctl,
    unit = car ? 'rad' : 'rad/s',
    deg = x => (x * 180) / Math.PI;
  let h = `<p><b>1. The vehicle near the path.</b> With e the sideways offset (left of the path positive) and θₑ the heading error, small errors obey θ̇ₑ = g·u and ė = v₀·θₑ: the ${car ? 'steering angle' : 'turn-rate command'} u turns the heading, and the heading moves the ${car ? 'car' : 'robot'} sideways. g = ${car ? `v₀/L = ${fmt(v)}/${fmt(P.wheelbase)} = ${fmt(g)} 1/s` : '1'}, v₀ = ${fmt(v)} m/s. Two integrations from command to offset.${M.dyn ? " With tyre slip the yaw rate follows the steering through the tyres' own yaw mode; the chips use that full model, the formulas in 2–3 the kinematic one." : ''} ${chLink('1-the-vehicle-in-path-coordinates', 'chapter 6 §1')}</p>`;
  if (M.kind === 'static') {
    const f = anFormulaGains(M),
      a = g * M.Kth,
      b = g * v * M.Ke,
      wn = Math.sqrt(Math.max(0, b)),
      z = wn > 0 ? a / (2 * wn) : 0;
    h += `<p><b>2. The controller near the path.</b> For small errors every tracker acts like u = −(K<sub>e</sub>·e + K<sub>θ</sub>·θₑ). ${f ? `Here ${f.txt}: K<sub>e</sub> = ${fmt(f.Ke)}, K<sub>θ</sub> = ${fmt(f.Kth)}. ` : ''}The app does not trust the formula: it reads both gains off ${ctlN}'s own code, by moving the ${car ? 'car' : 'robot'} ±1 mm sideways and turning it ±1 mrad in a copy of the simulator and dividing the change in the command (a central difference): <b>K<sub>e</sub> = ${fmt(M.Ke)} ${unit} per m, K<sub>θ</sub> = ${fmt(M.Kth)} ${unit} per rad</b>. ${chLink('2-pure-pursuit-is-a-pd-controller-in-disguise', 'chapter 6 §2')}</p>`;
    h += `<div class="eq">ë + g K_θ ė + g v₀ K_e e = 0      (substitute u into θ̇ₑ = g u, ė = v₀ θₑ)
ω_n = √(g v₀ K_e) = √(${fmt(b, 3)}) = ${fmt(wn)} rad/s        ζ = g K_θ / (2 ω_n) = ${fmt(a, 3)} / ${fmt(2 * wn, 3)} = ${fmt(z)}</div>`;
    if (z < 1 && wn > 0) {
      const sq = Math.sqrt(1 - z * z),
        os = 100 * Math.exp((-Math.PI * z) / sq),
        ts = Math.log(50 / sq) / (z * wn);
      h += `<p><b>3. Without the delays</b>, from e(0) = e₀ and θₑ(0) = 0: e(t) = e₀ e<sup>−ζω<sub>n</sub>t</sup>(cos ω<sub>d</sub>t + ζ/√(1−ζ²) sin ω<sub>d</sub>t), ω<sub>d</sub> = ω<sub>n</sub>√(1−ζ²). It crosses the path and swings to −e₀·exp(−πζ/√(1−ζ²)): <b>${fmt(os, 1)} % overshoot</b>; its envelope e<sup>−ζω<sub>n</sub>t</sup>/√(1−ζ²) falls below 2 % after t = ln(50/√(1−ζ²)) / (ζω<sub>n</sub>) = <b>${fmt(ts, 1)} s</b>.</p>`;
    } else if (wn > 0) {
      const s1 = -z * wn + wn * Math.sqrt(z * z - 1);
      h += `<p><b>3. Without the delays</b> ζ ≥ 1: two real poles, no swing. The slower one, s = −ζω<sub>n</sub> + ω<sub>n</sub>√(ζ² − 1) = ${fmt(s1)} 1/s, decides: within 2 % after about ln(50)/|s| = <b>${fmt(Math.log(50) / Math.abs(s1), 1)} s</b> (longer when the two poles are close).</p>`;
    }
  } else if (M.kind === 'pid') {
    h += `<p><b>2. The controller near the path.</b> PID aims at a point L<sub>d</sub> = ${fmt(M.Ld)} m ahead: α ≈ −e/L<sub>d</sub> − θₑ and u = K<sub>p</sub>α + K<sub>i</sub>∫α dt + K<sub>d</sub>α̇ (K<sub>p</sub> ${fmt(P.kp, 2)}, K<sub>i</sub> ${fmt(P.ki, 2)}, K<sub>d</sub> ${fmt(P.kd, 2)}). The proportional part alone is K<sub>e</sub> = K<sub>p</sub>/L<sub>d</sub> = ${fmt(P.kp / M.Ld)}, K<sub>θ</sub> = K<sub>p</sub> = ${fmt(P.kp)}; the integral adds a third state, so there is no two-pole formula and the numbers below come from the discrete loop directly.</p>`;
  } else {
    const K = M.K;
    h += `<p><b>2. The controller near the path.</b> Near the path MPC acts on the <i>rate</i> of ${car ? 'steering' : 'turning'}: u̇ = −(K<sub>e</sub>e + K<sub>θ</sub>θₑ + K<sub>s</sub>u) + K<sub>u</sub>u̇<sub>prev</sub>, with K<sub>e</sub> ${fmt(K.e)}, K<sub>θ</sub> ${fmt(K.th)}, K<sub>s</sub> ${fmt(K.s)}, K<sub>u</sub> ${fmt(K.u)} read off the MPC's own code by central differences (the optimization run to convergence). The rate form integrates, which makes the loop third order; the numbers below come from the discrete loop directly. Derivation: <a class="chref" href="#notes=ch7/6-what-the-analyze-view-sees">chapter 7 §6</a></p>`;
  }
  h += `<p><b>4. With the clock, lag and latency</b> (what the chips show). The controller samples every T = 50 ms and its command is held for the tick, so on average it acts T/2 = 25 ms late${M.nL ? `, plus ${fmt(M.nL * DT * 1000, 0)} ms of latency` : ''}${M.tau > 0 ? `, through an actuator lag τ = ${fmt(M.tau, 2)} s` : ''}. The app steps this exact 20 Hz loop, x<sub>k+1</sub> = A x<sub>k</sub>, from e = 1, θₑ = 0 for ${fmt(R.tEnd, 1)} s and reads: <b>Back within 2 %</b> = the last time |e| > 0.02 = ${fmt(so.settle, 2)} s, × v₀ = ${fmt(so.settle * v, 1)} m driven; <b>Overshoot</b> = the deepest crossing of the path = ${fmt(so.overshoot, 1)} %, × the ${fmt(cm, 0)} cm start = ${fmt((so.overshoot / 100) * cm, 1)} cm. The eigenvalues of A are the poles: the slowest pair z maps to s = ln z / T, so ω<sub>n</sub> = |s| = ${fmt(R.wn)} rad/s and ζ = −Re s / |s| = ${fmt(R.zeta)}. ${chLink('3-the-open-loop-l-s-with-the-clock-in-it', 'chapter 6 §3')} ${chLink('5-poles-damping-and-the-shape-of-the-response', '§5')}</p>`;
  if (F && F.dm != null)
    h += `<p><b>5. Extra delay it tolerates.</b> At the crossover ω<sub>c</sub> = ${fmt(F.wc)} rad/s the open loop has gain |L| = 1, and its phase is ${fmt(F.pm, 1)}° short of −180° (the phase margin). A pure delay Δ costs ω<sub>c</sub>Δ radians of phase there, so the loop starts to oscillate when Δ = PM / ω<sub>c</sub> = ${fmt((F.pm * Math.PI) / 180, 3)} rad / ${fmt(F.wc)} rad/s = <b>${fmt(F.dm * 1000, 0)} ms</b>. ${chLink('4-reading-the-margins', 'chapter 6 §4')}</p>`;
  const essF = M.kind === 'static' ? d / M.Ke : M.kind === 'pid' ? (P.ki ? 0 : (d * M.Ld) / P.kp) : null;
  h +=
    `<p><b>6. Left over from a constant ${car ? 'misalignment' : 'turn bias'}.</b> A constant actuator error d adds to the command: θ̇ₑ = g(u + d), d = ${bu.val} ${bu.unit}${car ? ` = ${fmt(d, 4)} rad` : ''}. Once the ${car ? 'car' : 'robot'} settles, ė = 0 so θₑ = 0, and θ̇ₑ = 0 so the controller must cancel the error, u = −d. ` +
    (M.kind === 'static'
      ? `For u = −(K<sub>e</sub>e + K<sub>θ</sub>θₑ) that means K<sub>e</sub>e = d: e<sub>ss</sub> = d / K<sub>e</sub> = ${fmt(d, 4)} / ${fmt(M.Ke)} = <b>${fmt(essF * 100, 1)} cm</b>.`
      : M.kind === 'pid'
        ? P.ki
          ? 'The integral keeps growing until α = 0, so e<sub>ss</sub> = 0.'
          : `Without the integral, K<sub>p</sub>α = d: e<sub>ss</sub> = d·L<sub>d</sub>/K<sub>p</sub> = <b>${fmt(essF * 100, 1)} cm</b>.`
        : 'The rate form holds u where u̇ = 0, so the offset depends on how K<sub>s</sub> and K<sub>e</sub> balance; it is read off the simulated response.') +
    ` The chip reads the end of the simulated bias response: ${fmt(Math.abs(sb.final * d) * 100, 1)} cm. Integral action (PID with K<sub>i</sub> > 0) removes it. ${chLink('5-poles-damping-and-the-shape-of-the-response', 'chapter 6 §5')}</p>`;
  h += `<p><b>7. Reading a pole.</b> A pole s = −σ ± jω is the motion e<sup>−σt</sup>cos ωt: it shrinks by a factor e every 1/σ seconds (the time constant) and repeats every 2π/ω seconds, which is 2πv₀/ω metres along the path. A pole with σ < 0 (right half) grows instead: it doubles every ln 2 / |σ| seconds.</p>`;
  return h;
}
function anAdvChips(R) {
  const F = R.F,
    pmC = F.pm == null ? '' : F.pm > 45 ? 'good' : F.pm > 25 ? 'warnc' : 'badc',
    gmC = F.gm == null ? 'good' : F.gm > 6 ? 'good' : F.gm > 0 ? 'warnc' : 'badc';
  return (
    chip(
      'Closed loop',
      R.stable ? 'stable' : `unstable (${R.unstableZ} pole${R.unstableZ > 1 ? 's' : ''})`,
      R.stable ? 'good' : 'badc',
      'From the eigenvalues of the exact 20 Hz loop; the Nyquist count must agree'
    ) +
    chip('Phase margin', F.pm == null ? '—' : fmt(F.pm, 0) + '°', pmC, '180° + ∠L at the gain crossover') +
    chip(
      'Gain margin',
      F.gm == null ? '∞' : fmt(F.gm, 1) + ' dB' + (F.gm != null ? ` (×${fmt(Math.pow(10, F.gm / 20), 1)})` : ''),
      gmC,
      'How much the loop gain can grow before instability'
    ) +
    chip('Crossover ω<sub>c</sub>', F.wc ? fmt(F.wc) + ' rad/s' : '—', '', '|L(jω_c)| = 1; roughly the closed-loop bandwidth') +
    chip(
      'Delay margin',
      F.dm != null ? fmt(F.dm * 1000, 0) + ' ms' : '—',
      F.dm != null ? (F.dm > 0.1 ? 'good' : F.dm > 0.03 ? 'warnc' : 'badc') : '',
      'Extra latency the loop tolerates: PM / ω_c'
    ) +
    chip(
      'M<sub>s</sub>',
      fmt(F.ms, 2),
      F.ms < 1.6 ? 'good' : F.ms < 2.2 ? 'warnc' : 'badc',
      'Peak sensitivity = 1 / closest distance from L to −1'
    ) +
    chip(
      'Dominant poles',
      R.zeta != null ? `ζ ${fmt(R.zeta, 2)} · ω<sub>n</sub> ${fmt(R.wn, 2)}` : '—',
      '',
      'Slowest closed-loop pole pair'
    )
  );
}
function renderAnalysis() {
  const view = $('#anview');
  if (!view || AN.mode !== 'an') return;
  readTokens();
  const estL = $('#an-est-l');
  if (estL) estL.hidden = P.loc === 'truth' || P.loc === 'custom';
  if (AN.loop === 'spd') return renderSpeed();
  if (AN.dirty || !AN.res) {
    anCompute();
    AN.dirty = false;
    AN.wi = null;
  }
  const R = AN.res,
    M = R.M,
    ctlN = CTL_NAMES[anCtl()] || P.ctl;
  // the simulator runs the same step by itself (well under 0.1 s), and the robot plays it back on the response plot
  {
    const ms = AN.meas.step;
    if (M.kind !== 'none' && !AN.busy && (!ms || ms.kind !== AN.stepKind || (AN.stepKind === 'offset' && ms.amp !== AN.stepAmp))) {
      runStepTest();
      anPlayStart();
    }
  }
  $('#an-op').innerHTML =
    `<b>${isDyn() ? 'Car with tyre slip' : isCar() ? 'Car-like' : 'Diff-drive'} · ${ctlN}</b> · ${anR() ? `left turn R ${anR()} m` : 'straight path'} at ${fmt(M.v0)} m/s · settings come from the Control and Vehicle tabs`;
  if (M.kind === 'none') return renderAnalysisNone(ctlN);
  $('#an-body').hidden = false;
  $('#an-none').hidden = true;
  if (R.knob === undefined) R.knob = anKnobCurve(R);
  $('#an-story').innerHTML = anStory(R);
  $('#an-key').innerHTML = anKeyChips(R);
  renderAnalysisWhy(R);
  renderAnalysisCaptions(R);
  $('#an-wi-x').hidden = !AN.wi;
  const ap = $('#an-wi-apply');
  if (ap) ap.onclick = anApplyWhatIf;
  const ms = AN.meas.step;
  $('#an-msg').textContent =
    AN.msg +
    (ms && ms.satT > 0
      ? ` The steering-rate limit was active for ${fmt(ms.satT, 2)} s of the test${ms.satT > 0.3 ? ', so the response departs from the linear prediction' : ''}.`
      : '') +
    (ms && ms.coll ? ' The robot collided during the test.' : '');
  $('#an-step').disabled = AN.busy;
  $('#an-inj').disabled = AN.busy;
  $('#an-inj').hidden = false;
  $('#an-inja').hidden = false;
  $('#an-amp').hidden = false;
  $('#an-kind').hidden = false;
  $('#an-cl').hidden = false;
  drawStep(R);
  drawPoles(R);
  anPlayUI();
  renderAnalysisAdvanced(R);
}

// The Analyze view when the tracker has no linear model (DWA, your code): the explanation instead of the plots
function renderAnalysisNone(ctlN) {
  $('#an-body').hidden = true;
  $('#an-none').hidden = false;
  $('#an-none').innerHTML =
    `<p><b>${ctlN}</b> has no linear model to analyze. ${P.ctl === 'dwa' ? 'DWA picks the best of a grid of sampled commands, so its output is piecewise constant in the state and has no meaningful derivative.' : 'Your code runs as a black box in a worker.'} Pick pure pursuit, rear-wheel feedback, Stanley (car), PID or MPC in the Control tab.</p>`;
  return;
}

// The "where these numbers come from" section: the derivation (or why there is none), with chapter links that open Learn
function renderAnalysisWhy(R) {
  const why = $('#an-why');
  if (why) {
    why.hidden = false;
    if (why.open !== !!AN.why) why.open = !!AN.why;
    if (AN.why) {
      const wb = $('#an-why-body');
      wb.innerHTML = R.stable
        ? anWhy(R)
        : '<p>The loop is unstable here, so there is no settling time, overshoot or margin to derive: the pole plot shows which poles sit in the right half. The derivations return once the loop is stable.</p>';
      wb.querySelectorAll('a.chref').forEach(
        a =>
          (a.onclick = e => {
            e.preventDefault();
            const m = /^#notes=([\w-]+)(?:\/([\w-]+))?$/.exec(a.getAttribute('href'));
            if (!m) return;
            try {
              history.replaceState(null, '', a.getAttribute('href'));
            } catch (_) {}
            setUIMode('learn');
            openChapter(m[1], m[2]);
          })
      );
    }
  }
}

// The captions of the response and pole plots for the current step kind
function renderAnalysisCaptions(R) {
  $('#cap-step-t').textContent = AN.stepKind === 'offset' ? 'Response: back to the path' : 'Response: a constant actuator error';
  const watch = `The amber ${isCar() ? 'car' : 'robot'} is the full simulator driving the same test (▶ replays it); sideways is stretched about ×${fmt(AN.stretch || 1, 0)} so the offset is visible, and its heading is stretched with it.`;
  $('#cap-step').innerHTML =
    AN.stepKind === 'offset'
      ? `Seen from above: the ${isCar() ? 'car' : 'robot'} starts ${fmt(AN.stepAmp * 100, 0)} cm to the side of the path (the blue line) and drives right; the curve is its sideways offset, the green band ±2 %. Time is on the top axis. ${watch}`
      : `A ${biasUnit().val} ${biasUnit().unit} ${isCar() ? 'steering misalignment' : 'turn-rate bias'} acts from the start, with the ${isCar() ? 'car' : 'robot'} on the path: it drifts off and, without integral action, settles to the side, where the offset makes the controller cancel the error. ${watch}`;
  $('#fig-pz').hidden = false;
  $('#cap-pz').innerHTML =
    anPzCaption(R) +
    (AN.wi && AN.wi.design ? `<p><b>Design.</b> ${AN.wi.design} Apply writes them as rear-wheel feedback's k_e and k_θ.</p>` : '');
  const dr = $('#an-design');
  if (dr) dr.hidden = R.M.kind !== 'static' && R.M.kind !== 'dyn';
}

// The collapsed section for control engineers: block diagram, transfer function, margin chips, Bode, Nyquist, root locus
function renderAnalysisAdvanced(R) {
  const adv = $('#an-adv');
  if (adv && adv.open !== !!AN.adv) adv.open = !!AN.adv;
  if (AN.adv) {
    $('#an-diagram').innerHTML = blockDiagram(R);
    $('#an-tf').innerHTML = anTF(R);
    $('#an-chips').innerHTML = anAdvChips(R);
    for (const id of ['cv-nyq', 'cv-loc']) $('#' + id).parentNode.hidden = false;
    drawBode(R);
    drawNyq(R);
    drawLocus(R);
  }
}
function renderSpeed() {
  if (AN.dirty || !AN.resSpd) {
    spdCompute();
    AN.dirty = false;
  }
  const R = AN.resSpd,
    M = R.M,
    ctlN = CTL_NAMES[anCtl()] || P.ctl,
    ms = AN.meas.spd;
  $('#an-op').innerHTML =
    `<b>${isDyn() ? 'Car with tyre slip' : isCar() ? 'Car-like' : 'Diff-drive'} · ${ctlN}</b> · speed loop at ${fmt(M.v0)} m/s`;
  if (M.kind === 'none') {
    $('#an-body').hidden = true;
    $('#an-none').hidden = false;
    $('#an-none').innerHTML = `<p><b>${ctlN}</b> runs as a black box. Pick a built-in tracker.</p>`;
    return;
  }
  $('#an-body').hidden = false;
  $('#an-none').hidden = true;
  const mpc = M.kind === 'mpc',
    sm = R.smOff,
    msm = ms ? spdMetrics(ms.data) : null,
    amp = AN.spdAmp || 0.2;
  $('#an-story').innerHTML =
    `<p><b>The situation.</b> The ${isCar() ? 'car' : 'robot'} cruises at <b>${fmt(M.v0)} m/s</b> and the reference speed steps up by <b>${fmt(amp)} m/s</b>. How quickly does the real speed follow?</p>
    <p>${mpc ? `<b>MPC closes a speed loop</b>: it changes the acceleration by about ${fmt(M.K.v, 2)} m/s² for every m/s of speed error, so the speed is fed back.` : `<b>${ctlN} does not feed speed back</b>: it commands the speed from the profile and nothing corrects the actual speed. The response is just the actuator.`} ${M.tau > 0 ? `The actuator follows with a lag τ = ${fmt(M.tau, 2)} s (63 % of a step after τ)` : 'There is no actuator lag'}${M.nL ? `, after ${fmt(M.nL * DT * 1000, 0)} ms of latency` : ''}${P.accel ? `; the acceleration limit of ${fmt(P.amax)} m/s² is not in the linear model (a ${fmt(amp)} m/s step takes at least ${fmt(amp / P.amax, 2)} s)` : ''}.</p>`;
  $('#an-key').innerHTML =
    chip(
      'Rise 10–90 %',
      sm.rise != null ? fmt(sm.rise, 2) + ' s' + (msm && msm.rise != null ? ` (sim ${fmt(msm.rise, 2)} s)` : '') : '—',
      '',
      'Time from 10 % to 90 % of the step'
    ) +
    chip('Settled within 2 %', fmt(sm.settle, 2) + ' s' + (msm ? ` (sim ${fmt(msm.settle, 2)} s)` : ''), '', '') +
    chip('Overshoot', fmt(sm.overshoot, 0) + ' %' + (msm ? ` (sim ${fmt(msm.overshoot, 0)} %)` : ''), '', '') +
    (mpc
      ? chip('Speed loop', R.stable ? 'stable' : `unstable (${R.unstableZ})`, R.stable ? 'good' : 'badc', '')
      : chip('Speed feedback', 'none (feedforward)', '', ''));
  $('#cap-step-t').textContent = 'Response: speed after a step in the reference';
  $('#cap-step').innerHTML =
    `The reference speed steps up by ${fmt(AN.spdAmp || 0.2)} m/s at t = 0. The curve is how much of that change the real speed has made: 0 is the old speed, 1 (the dashed blue line) the new reference. The solid curve is the linear model; dashed amber is the full simulator (Run step test); the green band is ±2 % of the reference, where "settled" is measured.`;
  $('#fig-pz').hidden = true;
  $('#an-wi-x').hidden = true;
  $('#an-why').hidden = true;
  $('#an-play-row').hidden = true;
  $('#an-msg').textContent =
    AN.msg +
    (ms && ms.satT > 0.1
      ? ` The acceleration limit was active for ${fmt(ms.satT, 2)} s of the test, which the linear model does not include.`
      : '');
  $('#an-step').disabled = AN.busy;
  $('#an-inj').hidden = true;
  $('#an-inja').hidden = true;
  $('#an-amp').hidden = true;
  $('#an-kind').hidden = true;
  $('#an-cl').hidden = true;
  drawStep(R);
  const adv = $('#an-adv');
  if (adv && adv.open !== !!AN.adv) adv.open = !!AN.adv;
  if (AN.adv) {
    $('#an-diagram').innerHTML = speedDiagram(R);
    $('#an-tf').innerHTML = '';
    $('#an-chips').innerHTML = mpc
      ? (() => {
          const F = R.F,
            pmC = F.pm == null ? '' : F.pm > 45 ? 'good' : F.pm > 25 ? 'warnc' : 'badc';
          return (
            chip('Phase margin', F.pm == null ? '—' : fmt(F.pm, 0) + '°', pmC, '') +
            chip('Gain margin', F.gm == null ? '∞' : fmt(F.gm, 1) + ' dB', '', '') +
            chip('Crossover ω<sub>c</sub>', F.wc ? fmt(F.wc) + ' rad/s' : '—', '', '') +
            chip('Delay margin', F.dm != null ? fmt(F.dm * 1000, 0) + ' ms' : '—', '', '') +
            chip('M<sub>s</sub>', fmt(F.ms, 2), F.ms < 1.6 ? 'good' : F.ms < 2.2 ? 'warnc' : 'badc', '') +
            chip(
              'Gains',
              `K<sub>v</sub> ${fmt(M.K.v, 2)}${M.lagModel ? ` · K<sub>vc</sub> ${fmt(M.K.vc, 2)}` : ''} · K<sub>u</sub> ${fmt(M.K.u, 2)}`,
              '',
              'Read from the MPC by finite differences'
            )
          );
        })()
      : chip('Bandwidth of G', R.bw ? fmt(R.bw, 2) + ' rad/s' : '—', '', 'Where the command-to-speed gain drops 3 dB') +
        chip('Time constant', M.tau > 0 ? fmt(M.tau, 2) + ' s' : '0 s', '', 'First-order actuator lag τ') +
        chip('Latency', fmt(M.nL * DT * 1000, 0) + ' ms', '', 'Whole ticks between command and actuator');
    $('#cv-nyq').parentNode.hidden = !mpc;
    $('#cv-loc').parentNode.hidden = !mpc;
    drawBode(R);
    if (mpc) {
      drawNyq(R);
      drawLocus(R);
    }
  }
}
function speedDiagram(R) {
  const M = R.M,
    mpc = M.kind === 'mpc';
  const box = (x, wd, t, sub) =>
    `<g><rect x="${x}" y="22" width="${wd}" height="40" rx="5" class="bd-box"/><text x="${x + wd / 2}" y="${sub ? 39 : 46}" class="bd-t">${t}</text>${sub ? `<text x="${x + wd / 2}" y="54" class="bd-s">${sub}</text>` : ''}</g>`;
  const ar = (x1, x2, y = 42) =>
    `<line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" class="bd-l"/><path d="M${x2} ${y} l-7 -4 v8 z" class="bd-a"/>`;
  const lag = M.tau > 0 ? `1/(${fmt(M.tau)}s+1)` : '1';
  if (!mpc)
    return `<svg viewBox="0 0 860 104" class="bd" role="img" aria-label="Open speed chain"><text x="6" y="46" class="bd-s" text-anchor="start">v<tspan baseline-shift="sub" font-size="8">ref</tspan></text>${ar(52, 118)}${box(118, 170, 'Speed profile', 'cruise, curvature, stopping')}${ar(288, 330)}${box(330, 120, 'Latency', `${fmt(M.nL * DT * 1000, 0)} ms`)}${ar(450, 492)}${box(492, 150, 'Actuator', lag)}${ar(642, 684)}${box(684, 120, 'Accel limit', P.accel ? `±${fmt(P.amax)} m/s²` : 'off')}${ar(804, 840)}<text x="846" y="46" class="bd-s" text-anchor="start">v</text></svg>`;
  return `<svg viewBox="0 0 860 104" class="bd" role="img" aria-label="MPC speed loop"><text x="6" y="46" class="bd-s" text-anchor="start">v<tspan baseline-shift="sub" font-size="8">ref</tspan></text>${ar(52, 76)}<circle cx="86" cy="42" r="10" class="bd-box"/><text x="86" y="46" class="bd-t">Σ</text>${ar(96, 118)}${box(118, 210, 'MPC (rate input a)', `a = −K_v Δv${M.lagModel ? ' − K_vc Δv_cmd' : ''} + K_u a_prev`)}${ar(328, 370)}${box(370, 100, '∫ a dt', 'v_cmd')}${ar(470, 512)}${box(512, 120, 'Latency', `${fmt(M.nL * DT * 1000, 0)} ms`)}${ar(632, 674)}${box(674, 140, 'Actuator', lag)}${ar(814, 840)}<text x="846" y="46" class="bd-s" text-anchor="start">v</text><polyline points="826,42 826,92 86,92 86,52" class="bd-l" fill="none"/><path d="M86 52 l-4 7 h8 z" class="bd-a"/></svg>`;
}
let anTimer = null;
function anInvalidate(keepMeas) {
  AN.dirty = true;
  AN.wi = null;
  AN.resSpd = null;
  if (!keepMeas) {
    AN.meas = {step: null, freq: null, spd: null};
    AN.msg = '';
  }
  chapterLiveSoon();
  if (AN.mode === 'an') {
    clearTimeout(anTimer);
    anTimer = setTimeout(renderAnalysis, 90);
  }
}
function setMode(m) {
  AN.mode = m;
  $('#simview').hidden = m !== 'sim';
  $('#anview').hidden = m !== 'an';
  if (uiMode !== 'learn') uiMode = m;
  syncModeUI();
  hashSoon();
  if (m === 'an') {
    running = false;
    AN.dirty = true;
    renderAnalysis();
  } else {
    draw();
    drawPlot();
    refreshAll();
  }
}
