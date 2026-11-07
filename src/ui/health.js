/* ============================================================
   Health (7.6, 2.6): one light per subsystem under the status strip, each with the reason in words (Foxglove's
   diagnostics, RViz's display status). Green: working as intended. Amber: degraded. Red: failing. Grey: idle or off.
   Every subsystem has a list of checks; the worst one that holds is the light (the worst child wins), and a click
   opens the list: each check with its state, the subsystem's recent events (a click seeks the timeline) and a button
   to its tab. The rules are in core/health.js, so that a run without a page records them too (core/safety.js); this
   file draws them, live or, while the timeline replays, from the recorded frame where it can. A light turning amber
   or red marks the timeline.
   ============================================================ */
const HEALTH = {ev: [], prev: {}, S: null, open: null}; // open: the subsystem whose check list is shown
// One status row (UI review, step 3): the mission state, the figures, then the four lights; the phone keeps its own order
{
  const row = document.createElement('div'),
    st = $('#status');
  row.className = 'statusrow';
  st.parentNode.insertBefore(row, st);
  row.appendChild(st);
  row.appendChild($('#health'));
}
// The short forms of the light names, which the CSS shows where the row is narrow (a data-s attribute on the name)
const H_SHORT = {loc: 'Loc', per: 'Per', plan: 'Plan', ctl: 'Ctl'};
function renderHealth() {
  const el = $('#health');
  if (!el || !S) return;
  if (HEALTH.S !== S) {
    HEALTH.S = S;
    HEALTH.ev = [];
    HEALTH.prev = {};
    tlKey = '';
  }
  const f = replayFrame();
  const H = healthNow(f);
  // the moments a light turned amber or red, for the timeline (live only)
  if (!f)
    for (const [k, name] of H_SYS) {
      const lv = H[k][0],
        pv = HEALTH.prev[k];
      if (pv != null && H_RANK[lv] >= 2 && H_RANK[lv] > H_RANK[pv]) {
        HEALTH.ev.push({t: S.t, sys: k, lvl: lv, msg: `${name}: ${H[k][1]}`});
        if (HEALTH.ev.length > 200) HEALTH.ev.shift();
      }
      HEALTH.prev[k] = lv;
    }
  const html = H_SYS.map(
    ([k, name]) =>
      `<button type="button" class="hl ${H[k][0]}" data-sys="${k}" data-hs="${k}" aria-expanded="${HEALTH.open === k}" title="${esc(name)}: ${esc(H[k][1])} (click for every check)"><i aria-hidden="true"></i><b data-s="${H_SHORT[k]}">${name}</b><span>${esc(H[k][1])}</span></button>`
  ).join('');
  if (el.dataset.h !== html) {
    el.dataset.h = html;
    el.innerHTML = html;
    el.querySelectorAll('[data-hs]').forEach(b => (b.onclick = () => healthOpen(HEALTH.open === b.dataset.hs ? null : b.dataset.hs, b)));
  }
  if (HEALTH.open) renderHealthPop(H);
  renderSensorDots();
}
// The check list of one subsystem, as a popover under its light
function healthOpen(k, btn) {
  HEALTH.open = k;
  let pop = $('#healthpop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'healthpop';
    pop.className = 'healthpop';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    document.body.appendChild(pop);
    document.addEventListener(
      'pointerdown',
      e => {
        if (HEALTH.open && !pop.contains(e.target) && !e.target.closest('#health')) healthOpen(null);
      },
      true
    );
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && HEALTH.open) healthOpen(null);
    });
  }
  if (!k) {
    pop.hidden = true;
    HEALTH.pop = null;
    $('#health') &&
      $('#health')
        .querySelectorAll('[data-hs]')
        .forEach(b => b.setAttribute('aria-expanded', 'false'));
    return;
  }
  if (btn) {
    const r = btn.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 368)) + 'px';
    pop.style.top = r.bottom + 6 + 'px';
  }
  pop.hidden = false;
  HEALTH.pop = '';
  renderHealth();
}
function renderHealthPop(H) {
  const pop = $('#healthpop'),
    k = HEALTH.open;
  if (!pop || !k || !H.all[k]) return;
  const name = H_SYS.find(s => s[0] === k)[1],
    ev = HEALTH.ev
      .filter(e => e.sys === k)
      .slice(-5)
      .reverse();
  const html =
    `<div class="hp-head" data-sys="${k}"><i class="hl-dot ${H[k][0]}"></i><b>${name}</b><span>${esc(H[k][1])}</span><button type="button" class="ibtn sm hp-x" title="Close (Esc)">×</button></div>` +
    `<ul class="hp-list">${H.all[k].map(c => `<li class="${c.on ? c.lvl : 'off'}"><i class="hl-dot ${c.on ? c.lvl : 'off'}"></i><b>${esc(c.name)}</b><span>${c.on ? esc(c.msg) : 'ok'}</span></li>`).join('')}</ul>` +
    (ev.length
      ? `<p class="hp-h">Recent</p><ul class="hp-ev">${ev.map(e => `<li data-t="${e.t}" title="Show this moment"><span>${e.t.toFixed(1)}s</span>${esc(e.msg.replace(/^[^:]+: /, ''))}</li>`).join('')}</ul>`
      : '') +
    `<div class="hp-foot"><button type="button" class="btn small" data-tab="${k}">Open the ${TAB_NAME[k]} tab</button><span class="note">the worst check that holds is the light</span></div>`;
  if (HEALTH.pop === html) return;
  HEALTH.pop = html;
  pop.innerHTML = html;
  pop.querySelector('.hp-x').onclick = () => healthOpen(null);
  pop.querySelector('[data-tab]').onclick = () => {
    healthOpen(null);
    if (uiMode === 'learn') setUIMode(AN.mode);
    if (WS.inspOff) wsInspector(true);
    showTab(k);
  };
  pop.querySelectorAll('.hp-ev li').forEach(
    li =>
      (li.onclick = () => {
        if (REC.frames.length > 1) seekTime(+li.dataset.t);
      })
  );
}

/* ---------- Sensors in the health checks: what each switched-off sensor takes away, per subsystem ---------- */
// The sensor dots: one per modality beside the subsystem lights, so what the robot senses with is visible at a glance.
// A click opens the Sensors tab at its switches.
function renderSensorDots() {
  const h = $('#health');
  if (!h) return;
  let el = $('#sensdots');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sensdots';
    el.className = 'sensdots';
    h.parentNode.insertBefore(el, h.nextSibling);
    el.onclick = () => {
      if (uiMode === 'learn') setUIMode(AN.mode);
      if (WS.inspOff) wsInspector(true);
      showTab('sen');
      const s = $('#sens-head');
      if (s) s.scrollIntoView({block: 'start'});
    };
  }
  const blind = sensorsBlind(),
    html =
      SENSORS.map(s => {
        const on = sensorOn(s);
        return `<span class="sd ${on ? 'on' : 'off'}" data-k="${s.key}" title="${esc(s.label)}: ${on ? 'on' : 'off'}. ${esc(s.gives)}"><i aria-hidden="true"></i>${esc(s.short)}</span>`;
      }).join('') +
      (blind ? '<span class="sd blind" title="Every sensor of the world is off: the estimate can only drift">blind</span>' : '');
  if (el.dataset.h !== html) {
    el.dataset.h = html;
    el.innerHTML = html;
    el.setAttribute('role', 'button');
    el.setAttribute(
      'aria-label',
      `Sensors: ${SENSORS.map(s => `${s.label} ${sensorOn(s) ? 'on' : 'off'}`).join(', ')}${blind ? '; blind' : ''}`
    );
  }
}
