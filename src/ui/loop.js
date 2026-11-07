/* ---------- main loop ---------- */
function refreshAll() {
  renderStatus();
  renderMetrics();
  renderLog();
  fsmRefresh();
  renderSelection();
  renderLayerPop();
  renderValues();
  renderChangedBadge();
  renderHealth();
  renderRunsBadge();
  renderGhostChip();
  renderBeaconSensor();
  renderInfoLines();
  holdHeights();
}
// Phones: the telemetry dock and the status strip keep the tallest height they reached, so the page never gets shorter
// while a run changes their rows and lines. A page that shrinks under a finger at its bottom has its scroll position
// moved by the browser, and iPhone then drops the swipe: the page would not scroll back up. The hold is let go when
// the floor, the run (time goes back), the width, the mode, the dock, the level or the Metrics/Values view changes.
const HOLD = {key: '', t: 0, els: ['#dock', '#status']};
function holdHeights() {
  const on = narrowUI(),
    key = on ? [LV.id, LV.name, innerWidth, uiMode, AN.mode, WS.dockOff, WS.level, !!lessonOpen, metView].join('|') : '';
  const back = !REPLAY.active && S && S.t + 1e-9 < HOLD.t;
  if (S && !REPLAY.active) HOLD.t = S.t;
  const els = HOLD.els.map(q => $(q)).filter(Boolean);
  if (key !== HOLD.key || back) {
    HOLD.key = key;
    for (const el of els) el.style.minHeight = '';
  }
  if (!on) return;
  for (const el of els) {
    const h = el.getBoundingClientRect().height;
    if (h > (parseFloat(el.style.minHeight) || 0) + 0.5) el.style.minHeight = Math.ceil(h) + 'px';
  }
}
// An error nothing else caught (a tick of the core, a promise, a handler) goes to the event log as an error, once per
// message in a run's log, so that a failure does not leave the robot standing still with nothing said.
function reportError(what, e) {
  const line = `${what}: ${(e && e.message) || String(e)}`;
  if (S && !S.log.some(l => l.msg === line)) logE(line, 'bad');
}
let lastTs = 0,
  acc = 0,
  frame = 0;
function loop(ts) {
  const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (running && !busy) {
    acc += dt * speed;
    const n = Math.min(40, Math.floor(acc / DT));
    if (n > 0) {
      acc -= n * DT;
      advance(n).catch(e => {
        running = false; // a tick that throws would throw again on the next frame
        reportError('The run stopped on an error', e);
      });
    }
  } else if (!running) acc = 0;
  replayTick(dt);
  if (AN.mode === 'sim') {
    drawMaybeReplay();
    if (frame++ % 3 === 0) {
      drawPlot();
      refreshAll();
      syncScrub();
    }
  }
  requestAnimationFrame(loop);
}
{
  const right = document.createElement('div');
  right.className = 'right';
  const ctxEl = $('.ctx'),
    con = $('.console');
  ctxEl.parentNode.insertBefore(right, ctxEl);
  if ($('.sheet-head')) right.appendChild($('.sheet-head')); // the phone sheet's head (ui/polish.js) heads the part that scrolls
  right.appendChild(ctxEl);
  right.appendChild(con);
  right.appendChild($('#learnview'));
}
const mo = new MutationObserver(() => {
  tokKey = '';
  if (AN.mode === 'an') renderAnalysis();
});
mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
window.addEventListener('resize', () => {
  if (AN.mode === 'an') renderAnalysis();
  else {
    draw();
    drawPlot();
  }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  tokKey = '';
  if (AN.mode === 'an') setTimeout(renderAnalysis, 30);
});
