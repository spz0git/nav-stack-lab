/* ---------- transport & tap ---------- */
let speed = 1,
  tapMode = 'wp',
  plotCh = 'pos',
  plotCh2 = 'none',
  poseDrag = null;
function seg(el, opts, get, set) {
  el.innerHTML = opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(get()) === String(v)}">${l}</button>`).join('');
  el.querySelectorAll('button').forEach(
    b =>
      (b.onclick = () => {
        set(b.dataset.v);
        el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === String(get()))));
      })
  );
}
// playback speed: a compact menu in the timeline ([ and ] step through it)
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8],
  SPEED_L = {0.25: '¼×', 0.5: '½×', 1: '1×', 2: '2×', 4: '4×', 8: '8×'};
$('#speed').innerHTML = SPEEDS.map(v => `<option value="${v}">${SPEED_L[v]}</option>`).join('');
$('#speed').value = String(speed);
$('#speed').onchange = e => {
  speed = +e.target.value;
};
function setSpeed(v) {
  speed = v;
  $('#speed').value = String(v);
}
// whether focus last moved by keyboard (Tab, arrows) rather than by a click: Space then presses a focused button or tab
// instead of running, while a button just clicked keeps Space as Run
let kbNav = false;
document.addEventListener('pointerdown', () => (kbNav = false), true);
document.addEventListener('keydown', e => {
  const t = e.target,
    tag = t && t.tagName;
  if (/^(Tab|Arrow|Home$|End$)/.test(e.key)) kbNav = true;
  if ((tag === 'INPUT' && t.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ') {
    if (kbNav && (tag === 'BUTTON' || t.getAttribute('role') === 'tab')) return;
    e.preventDefault();
    $('#run').click();
  } else if (e.key === 'n' || e.key === 'N') $('#stepb').click();
  else if (e.key === 'r' || e.key === 'R') $('#resetb').click();
  else if (e.key === '[') {
    setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)]);
  } else if (e.key === ']') {
    setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)]);
  } else if (e.key === 'f' || e.key === 'F') {
    $('#mv-follow').click();
  } else if (e.key === '0') {
    $('#mv-fit').click();
  } else if (e.key === 'a' || e.key === 'A') {
    setMode(AN.mode === 'sim' ? 'an' : 'sim');
  }
});
$('#pausec').onchange = e => {
  pauseOnContact = e.target.checked;
};
$('#legendmore').onclick = () => showSym('map');
$('#an-src').onclick = () => showSource('analysis/model.js');
$('#an-back').onclick = () => setMode('sim');
function syncAnControls() {
  seg(
    $('#an-loop'),
    [
      ['lat', 'Lateral'],
      ['spd', 'Speed']
    ],
    () => AN.loop,
    v => {
      if (v !== AN.loop) {
        AN.meas = {step: null, freq: null, spd: null};
        AN.play = null;
      }
      AN.loop = v;
      AN.msg = '';
      renderAnalysis();
    }
  );
  seg(
    $('#an-curve'),
    [
      ['0', 'Straight'],
      ['4', 'Curve R 4 m'],
      ['2', 'Curve R 2 m']
    ],
    () => String(AN.curveR || 0),
    v => {
      AN.curveR = +v;
      anInvalidate();
      renderAnalysis();
    }
  );
  const ce = $('#an-est');
  if (ce) {
    ce.checked = AN.useEst;
    ce.onchange = () => {
      AN.useEst = ce.checked;
      AN.meas = {step: null, freq: null, spd: null};
      AN.msg = AN.useEst
        ? `Simulator tests now close the loop through the ${{dr: 'dead reckoning', ekf: 'EKF', pf: 'particle filter', slam: 'EKF-SLAM'}[P.loc] || P.loc} estimate, with beacons every 4 m beside the path. The model curves, poles and margins still assume the true pose, so the gap between amber and black is what the estimator costs.${P.loc === 'pf' || P.loc === 'slam' ? ' With the particle filter and EKF-SLAM the offset step moves only the true pose, so the estimator sees it as a small kidnap.' : ''}`
        : '';
      renderAnalysis();
    };
  }
  seg(
    $('#an-cl'),
    [
      ['0', 'L only'],
      ['1', '+ closed loop']
    ],
    () => (AN.showCL ? '1' : '0'),
    v => {
      AN.showCL = v === '1';
      renderAnalysis();
    }
  );
  seg(
    $('#an-nyq'),
    [
      ['log', 'compressed'],
      ['lin', 'linear']
    ],
    () => AN.nyqScale,
    v => {
      AN.nyqScale = v;
      renderAnalysis();
    }
  );
  seg(
    $('#an-kind'),
    [
      ['offset', 'path offset'],
      ['bias', 'actuator bias']
    ],
    () => AN.stepKind,
    v => {
      AN.stepKind = v;
      renderAnalysis();
    }
  );
  $('#an-amp').value = String(AN.stepAmp);
  $('#an-inja').value = AN.injAmp;
}
syncAnControls();
$('#an-why').addEventListener('toggle', () => {
  const o = $('#an-why').open;
  if (o !== !!AN.why) {
    AN.why = o;
    renderAnalysis();
  }
});
$('#an-adv').addEventListener('toggle', () => {
  const o = $('#an-adv').open;
  if (o !== AN.adv) {
    AN.adv = o;
    renderAnalysis();
  }
});
$('#an-amp').onchange = e => {
  AN.stepAmp = +e.target.value;
  renderAnalysis();
};
$('#an-inja').onchange = e => {
  AN.injAmp = e.target.value;
};
$('#an-step').onclick = () => {
  if (AN.loop === 'spd') {
    if (!AN.resSpd) spdCompute();
    runSpeedStepTest();
    AN.msg = `Speed step test: +${fmt(AN.spdAmp || 0.2)} m/s on the cruise speed in the full simulator (dashed amber).`;
    renderAnalysis();
    return;
  }
  if (!AN.res) anCompute();
  runStepTest();
  anPlayStart();
  AN.msg = `Step test: ${AN.stepKind === 'offset' ? AN.stepAmp + ' m path offset' : biasUnit().val + biasUnit().unit + ' actuator bias'} in the full simulator (dashed amber).`;
  renderAnalysis();
};
$('#an-inj').onclick = () => {
  if (!AN.busy) runInjection();
};
$('#an-play').onclick = () => {
  const pl = AN.play,
    R = AN.res;
  if (!R) return;
  if (!pl || pl.t >= R.tEnd - 1e-9) return anPlayStart();
  pl.on = !pl.on;
  pl.last = performance.now();
  if (pl.on) requestAnimationFrame(anPlayTick);
  anPlayUI();
};
$('#an-scrub').oninput = e => {
  const R = AN.res;
  if (!R) return;
  const sp = AN.play ? AN.play.speed : 1;
  AN.play = {t: +e.target.value / 100, on: false, last: performance.now(), speed: sp};
  drawStep(R);
  anPlayUI();
};
seg(
  $('#an-pspeed'),
  [
    ['0.5', '½×'],
    ['1', '1×'],
    ['2', '2×']
  ],
  () => String(AN.play ? AN.play.speed : 1),
  v => {
    if (!AN.play) AN.play = {t: 0, on: false, last: performance.now(), speed: 1};
    AN.play.speed = +v;
  }
);
const PLOT_OPTS = [
  ['pos', 'Position error'],
  ['eth', 'θ error'],
  ['cte', 'Cross-track'],
  ['v', 'Speed'],
  ['turn', 'Steering'],
  ['st', 'ST graph']
];
seg(
  $('#plotsel'),
  PLOT_OPTS,
  () => plotCh,
  v => {
    plotCh = v;
    plotUser = true;
    drawPlot();
  }
);
// The preset plot follows the level until the user picks one: cross-track where the pose is known (L1, L2, L6, L7:
// the position error would be a flat zero), position error where there is an estimate to judge.
let plotUser = false;
function plotDefault() {
  if (plotUser) return;
  const ch = P.loc === 'truth' ? 'cte' : 'pos';
  if (ch !== plotCh) {
    plotCh = ch;
    seg(
      $('#plotsel'),
      PLOT_OPTS,
      () => plotCh,
      v => {
        plotCh = v;
        plotUser = true;
        drawPlot();
      }
    );
  }
}
$('#plotsel2').onchange = e => {
  plotCh2 = e.target.value;
  drawPlot();
};
let firstRun = true;
function firstRunDone() {
  if (!firstRun) return;
  firstRun = false;
  const h = $('#firstrun');
  if (h) h.hidden = true;
}
$('#firstrun-x').onclick = firstRunDone;
if ($('#firstrun-min')) $('#firstrun-min').textContent = firstPassMinutes();
$('#run').onclick = () => {
  exitReplay();
  running = !running;
  if (running) firstRunDone();
  if (running && (S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') && remaining().length) {
    startMission();
  }
  if (running && S.fsm.state === 'DONE' && !remaining().length) logE('All goals done. Tap the map to add more.', 'warn');
  refreshAll();
};
$('#stepb').onclick = async () => {
  exitReplay();
  running = false;
  if (S.fsm.state === 'IDLE' && remaining().length) startMission();
  await advance(10);
  draw();
  refreshAll();
};
$('#resetb').onclick = () => {
  running = false;
  reset();
};
const toCanvas = e => {
  const r = cv.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
};
const toWorld = e => {
  const [sx, sy] = toCanvas(e),
    {kz, tx, ty} = viewXform();
  return [(sx - tx) / kz, (ty - sy) / kz];
};
const toScreen = (x, y) => {
  const {kz, tx, ty} = viewXform(),
    r = cv.getBoundingClientRect();
  return [((x * kz + tx) * r.width) / cv.width, ((ty - y * kz) * r.height) / cv.height];
};
function addPosed(x, y, th) {
  const k = cellIdx(x, y);
  if (k < 0) return;
  const ok = isCar() && th != null ? !carHits(x, y, th, S.shapes, 0.05) : LV.truthDist[k] > (isCar() ? CAR.width / 2 + 0.05 : RR + 0.02);
  if (!ok) {
    logE('That pose overlaps an obstacle', 'warn');
    draw();
    return;
  }
  if (remaining().length >= 8) {
    logE('Up to 8 open goals', 'warn');
    return;
  }
  WPS.push({x, y, th, done: false});
  if (th != null && !isCar()) logE(`Goal ${WPS.length} faces ${deg(th).toFixed(0)}°: the robot turns in place there once it arrives`);
  startMission();
  doPlan('initial');
  draw();
  refreshAll();
}
// Wheel zooms the map. In the stacked layouts (narrow or short windows) the map sits in a page that scrolls, so there a
// plain wheel scrolls past it and Ctrl or ⌘ + wheel (a trackpad pinch arrives as Ctrl + wheel) zooms.
cv.addEventListener(
  'wheel',
  e => {
    if (!wideUI() && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const [sx, sy] = toCanvas(e);
    zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy);
  },
  {passive: false}
);
let panDrag = null;
cv.addEventListener('pointermove', e => {
  if (panDrag) {
    const [sx, sy] = toCanvas(e);
    const d = hyp(sx - panDrag.sx, sy - panDrag.sy);
    if (d > 6 * (window.devicePixelRatio || 1)) panDrag.moved = true;
    if (panDrag.moved) {
      const {kz} = viewXform();
      VIEW.cx = panDrag.cx - (sx - panDrag.sx) / kz;
      VIEW.cy = panDrag.cy + (sy - panDrag.sy) / kz;
      VIEW.follow = false;
      viewClamp();
      syncViewUI();
      draw();
    }
    return;
  }
  if (paintStroke) {
    const [x, y] = toWorld(e),
      [x0, y0] = paintStroke.last,
      n = Math.ceil(hyp(x - x0, y - y0) / 0.1);
    for (let i = 1; i <= n; i++) strokeAt(x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n);
    paintStroke.last = [x, y];
    draw();
    return;
  }
  if (poseDrag) {
    const [x, y] = toWorld(e);
    poseDrag.x2 = x;
    poseDrag.y2 = y;
    draw();
    return;
  }
  hoverAt(e);
});
cv.addEventListener('pointerleave', () => hideTip());
cv.addEventListener('pointerup', e => {
  if (panDrag) {
    const d = panDrag;
    panDrag = null;
    if (!d.moved) tapAt(d.wx, d.wy);
    return;
  }
  if (paintStroke) return strokeEnd();
  if (!poseDrag) return;
  const d = poseDrag;
  poseDrag = null;
  const dx = d.x2 - d.x,
    dy = d.y2 - d.y;
  addPosed(d.x, d.y, hyp(dx, dy) > 0.3 ? Math.atan2(dy, dx) : null);
});
cv.addEventListener('pointercancel', () => {
  paintStroke = null;
  poseDrag = null;
  panDrag = null;
  draw();
});
cv.addEventListener('pointerdown', e => {
  hideTip();
  const [x, y] = toWorld(e);
  if ((tapMode !== 'pose' && !drawTool()) || e.button === 1 || e.shiftKey) {
    const [sx, sy] = toCanvas(e);
    panDrag = {sx, sy, cx: VIEW.cx, cy: VIEW.cy, wx: x, wy: y, moved: false};
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    return;
  }
  tapAt(x, y, e);
});
// Paint and Erase: a drag collects cells (and, erasing, the level's obstacles it touches) and applies them on release as
// one change of mapAdd / mapDel, so the grids, the costmap and the plan are rebuilt once per stroke
function strokeStart(x, y, e) {
  paintStroke = {mode: tapMode, add: new Set(), rem: new Set(), del: new Set(), last: [x, y], blocked: false};
  try {
    if (e) cv.setPointerCapture(e.pointerId);
  } catch (_) {}
  strokeAt(x, y);
  draw();
}
function strokeAt(x, y) {
  const st = paintStroke,
    c = paintCell(x, y);
  if (st.mode === 'paint') {
    if (c < 0 || st.add.has(c)) return;
    const r = S.robot,
      cell = {t: 'r', x: (c % PGW) * PAINT, y: Math.floor(c / PGW) * PAINT, w: PAINT, h: PAINT};
    if (circleHits(r.x, r.y, (isCar() ? carLen() * 0.7 : RR) + 0.05, [cell])) {
      st.blocked = true; // not on top of the robot
      return;
    }
    st.add.add(c);
    return;
  }
  if (c >= 0 && idList(P.mapAdd).includes(c)) st.rem.add(c);
  if (P.map === 'empty') return;
  const del = idList(P.mapDel);
  LV.shapes0.forEach((q, i) => {
    if (!q.border && !del.includes(i) && !st.del.has(i) && circleHits(x, y, 0.1, [q])) st.del.add(i);
  });
}
function strokeEnd() {
  const st = paintStroke;
  paintStroke = null;
  const cells = new Set(idList(P.mapAdd));
  if (st.mode === 'paint') {
    const n = [...st.add].filter(c => !cells.has(c)).length;
    if (n) {
      st.add.forEach(c => cells.add(c));
      setParam('mapAdd', [...cells].sort((a, b) => a - b).join(','), false);
      logE(`Painted ${n} block${n > 1 ? 's' : ''} (0.4 m); ${cells.size} painted in all`);
    }
    if (st.blocked) logE('Not painted on top of the robot', 'warn');
  } else {
    if (st.del.size) setParam('mapDel', [...new Set([...idList(P.mapDel), ...st.del])].sort((a, b) => a - b).join(','), false);
    if (st.rem.size) {
      st.rem.forEach(c => cells.delete(c));
      setParam('mapAdd', [...cells].sort((a, b) => a - b).join(','), false);
    }
    const n = st.del.size + st.rem.size;
    if (n)
      logE(
        `Erased ${st.del.size ? `${st.del.size} of the level's obstacles` : ''}${st.del.size && st.rem.size ? ' and ' : ''}${st.rem.size ? `${st.rem.size} painted block${st.rem.size > 1 ? 's' : ''}` : ''}`
      );
    else logE('Nothing to erase there: the outer walls stay', 'warn');
  }
  renderAllPanes();
  draw();
  refreshAll();
}
function tapAt(x, y, e) {
  if (drawTool()) return strokeStart(x, y, e);
  if (tapMode === 'select') {
    mapSelectAt(x, y);
    return;
  }
  const k = cellIdx(x, y);
  if (k < 0) return;
  if (tapMode === 'beacon') {
    const {kz} = viewXform(),
      r = cv.getBoundingClientRect(),
      tol = (22 * (cv.width / r.width)) / kz;
    let best = null;
    for (const b of S.beacons) {
      const d = hyp(x - b.x, y - b.y);
      if (d < tol && (!best || d < best[0])) best = [d, b];
    }
    if (best) {
      toggleBeacon(best[1].id);
      renderAllPanes();
    } else logE('No beacon there: tap a diamond', 'warn');
    return;
  }
  if (tapMode === 'pose') {
    poseDrag = {x, y, x2: x, y2: y};
    try {
      if (e) cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    draw();
    return;
  }
  const free = LV.truthDist[k] > (isCar() ? CAR.width / 2 + 0.05 : RR + 0.02);
  if (tapMode === 'kidnap') {
    if (isCar() ? carHits(x, y, S.robot.th, S.shapes, 0.02) : !free) {
      logE('Cannot place the robot inside an obstacle', 'warn');
      return;
    }
    kidnapTo([x, y]);
    setTool(toolBefore);
    return;
  }
  if (!free) {
    logE('That spot is inside an obstacle (or too close for the robot)', 'warn');
    return;
  }
  if (tapMode === 'goal') {
    WPS.forEach(w => (w.done = true));
    WPS = [{x, y, th: null, done: false}];
  } else {
    if (remaining().length >= 8) {
      logE('Up to 8 open goals', 'warn');
      return;
    }
    WPS.push({x, y, th: null, done: false});
  }
  startMission();
  doPlan('initial');
  draw();
  refreshAll();
}
// view buttons on the map
{
  const mw = $('.mapwrap');
  const bar = document.createElement('div');
  bar.className = 'mapview';
  bar.innerHTML = `<button id="mv-in" title="Zoom in (scroll on the map also zooms)">+</button><button id="mv-out" title="Zoom out">−</button><button id="mv-fit" title="Fit the whole world (0)">⤢</button><button id="mv-follow" title="Follow the robot (F)" aria-pressed="false">◎</button><button id="mv-key" title="Map key: what the symbols mean" aria-pressed="false" aria-controls="legend">?</button>`;
  mw.appendChild(bar);
  const tip = document.createElement('div');
  tip.className = 'maptip';
  tip.id = 'maptip';
  tip.hidden = true;
  mw.appendChild(tip);
  $('#mv-in').onclick = () => zoomAt(1.5, cv.width / 2, cv.height / 2);
  $('#mv-out').onclick = () => zoomAt(1 / 1.5, cv.width / 2, cv.height / 2);
  $('#mv-fit').onclick = () => {
    VIEW.z = 1;
    VIEW.cx = W / 2;
    VIEW.cy = H / 2;
    VIEW.follow = false;
    syncViewUI();
    draw();
  };
  $('#mv-key').onclick = () => legendShow($('#legend').hidden);
  $('#mv-follow').onclick = () => {
    VIEW.follow = !VIEW.follow;
    if (VIEW.follow && VIEW.z === 1) VIEW.z = 2.5;
    syncViewUI();
    draw();
  };
  syncViewUI();
}
// The map key ("?"): Escape, a mode change and a level change close it; it stays open across tabs and tools.
function legendShow(on) {
  $('#legend').hidden = !on;
  $('#mv-key').setAttribute('aria-pressed', String(on));
}
function hideTip() {
  const t = $('#maptip');
  if (t && !t.hidden) t.hidden = true;
}
// Things on the map under a point: [distance, card html, reference]; the Select tool keeps the reference (maptools.js)
function mapCandidates(x, y) {
  const C = [],
    rb = S.robot,
    es = S.est;
  C.push([
    hyp(x - rb.x, y - rb.y),
    () =>
      `<b>True pose</b><br>${rb.x.toFixed(2)}, ${rb.y.toFixed(2)} m · ${deg(rb.th).toFixed(0)}°<br>v ${rb.v.toFixed(2)} m/s · ${isCar() ? `δ ${deg(rb.d).toFixed(0)}°` : `ω ${rb.w.toFixed(2)} rad/s`}`,
    {k: 'robot'}
  ]);
  if (P.loc !== 'truth')
    C.push([
      hyp(x - es.x, y - es.y),
      () =>
        `<b>Estimate</b> (${{dr: 'dead reckoning', ekf: 'EKF', pf: 'particle filter', slam: 'EKF-SLAM', custom: 'your code'}[P.loc]})<br>${es.x.toFixed(2)}, ${es.y.toFixed(2)} m · ${deg(es.th).toFixed(0)}°<br>error ${hyp(rb.x - es.x, rb.y - es.y).toFixed(2)} m${S.Pc ? ` · σ<sub>pos</sub> ${posSigma().toFixed(2)} m` : ''}`,
      {k: 'est'}
    ]);
  WPS.forEach((w, i) => {
    const q = S.fsm.queue.indexOf(i);
    C.push([
      hyp(x - w.x, y - w.y),
      () =>
        `<b>Goal ${q >= 0 ? q + 1 : i + 1}</b> · ${w.done ? (w.skipped ? 'skipped' : 'reached') : q === 0 ? 'active' : 'queued'}<br>${w.x.toFixed(2)}, ${w.y.toFixed(2)} m${w.th != null ? ` · heading ${deg(w.th).toFixed(0)}°` : ''}`,
      {k: 'goal', i}
    ]);
  });
  S.peds.forEach((p, i) =>
    C.push([
      hyp(x - p.x, y - p.y) - 0.1,
      () =>
        p.car
          ? `<b>Vehicle</b> (ground truth)<br>${p.v.toFixed(2)} m/s${p.v < 0.05 ? ' · yielding' : ''}`
          : `<b>Person ${i + 1}</b> (ground truth)<br>${hyp(p.vx || 0, p.vy || 0).toFixed(2)} m/s${p.wait > 0 ? ' · paused' : ''}`,
      {k: 'ped', i}
    ])
  );
  if (S.agents && agOn())
    for (const t of S.agents.tracks)
      C.push([
        hyp(x - t.x, y - t.y) - 0.1,
        () =>
          `<b>Agent #${t.id}</b> · ${t.conf ? 'confirmed' : 'tentative'}<br>v ${hyp(t.vx, t.vy).toFixed(2)} m/s · heading ${deg(Math.atan2(t.vy, t.vx)).toFixed(0)}°<br>r ${t.r.toFixed(2)} m · ${t.hits} hits · σ<sub>pos</sub> ${Math.sqrt(Math.max(0, t.pxx)).toFixed(2)} m`,
        {k: 'track', id: t.id}
      ]);
  for (const b of S.beacons)
    C.push([
      hyp(x - b.x, y - b.y),
      () =>
        `<b>Beacon ${b.id}</b> · ${beaconsOff().has(b.id) ? 'switched off' : S.bDown && S.bDown[b.id] ? 'outage' : 'on'}<br>${b.x.toFixed(2)}, ${b.y.toFixed(2)} m${tapMode === 'beacon' ? '<br>tap to switch it ' + (beaconsOff().has(b.id) ? 'on' : 'off') : ''}`,
      {k: 'beacon', id: b.id}
    ]);
  return C;
}
// the nearest candidate within tolPx screen pixels of world point (x, y)
function mapPick(x, y, tolPx) {
  const {kz} = viewXform(),
    r = cv.getBoundingClientRect(),
    tol = (tolPx * (cv.width / r.width)) / kz;
  let best = null;
  for (const c of mapCandidates(x, y)) if (c[0] < tol && (!best || c[0] < best[0])) best = c;
  return best;
}
// hover cards: nearest of robot, estimate, goals, people, tracks, beacons within 14 px
function hoverAt(e) {
  if (!S) return;
  const [x, y] = toWorld(e),
    r = cv.getBoundingClientRect(),
    best = mapPick(x, y, 14);
  const t = $('#maptip');
  if (!best) {
    hideTip();
    return;
  }
  t.innerHTML = best[1]();
  t.hidden = false;
  const px = e.clientX - r.left,
    py = e.clientY - r.top;
  t.style.left = Math.min(px + 14, r.width - t.offsetWidth - 6) + 'px';
  t.style.top = Math.max(4, py - t.offsetHeight - 10) + 'px';
}
