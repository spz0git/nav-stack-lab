/* ============================================================
   Health (7.6, 2.6): one light per subsystem under the status strip, each with the reason in words (Foxglove's
   diagnostics, RViz's display status). Green: working as intended. Amber: degraded. Red: failing. Grey: idle or off.
   Every subsystem has a list of checks; the worst one that holds is the light (the worst child wins), and a click
   opens the list: each check with its state, the subsystem's recent events (a click seeks the timeline) and a button
   to its tab. Computed in the page from what the run records (no new simulation state); while the timeline replays,
   from the recorded frame where it can. A light turning amber or red marks the timeline.
   ============================================================ */
const HEALTH = {ev: [], prev: {}, S: null, lastZ: 0, open: null}; // open: the subsystem whose check list is shown
const H_SYS = [
  ['loc', 'Localize'],
  ['per', 'Perceive'],
  ['plan', 'Plan'],
  ['ctl', 'Control']
];
const H_RANK = {idle: 0, ok: 1, warn: 2, bad: 3};
// Every check of every subsystem, from the live state or a recorded frame f: H.all[k] = [{name, on, lvl, msg}],
// H[k] = [level, reason] of the worst check that holds (ties: the first listed)
function healthNow(f) {
  const V = f || S,
    r = V.robot,
    F = V.fsm,
    st = F.state,
    drive = st === 'DRIVE',
    sig = f ? f.sig || {} : null,
    all = {};
  const C = (k, name, on, lvl, msg) => {
    (all[k] || (all[k] = [])).push({name, on: !!on, lvl, msg});
  };
  // localization
  {
    const sp = V.Pc ? Math.sqrt(Math.max(0, V.Pc[0] + V.Pc[4])) : null,
      nees = sig ? sig.nees : S.nees.length ? S.nees.slice(-25).reduce((a, b) => a + b, 0) / Math.min(25, S.nees.length) : null,
      neff = neffAvg(V.t),
      N = S.pf ? S.pf.N : P.npart,
      usesB = ['ekf', 'pf', 'slam'].includes(P.loc),
      silent = usesB && !f ? S.t - HEALTH.lastZ : 0;
    if (P.loc === 'truth') C('loc', 'Estimator', true, 'idle', 'ground truth: the pose is known');
    else {
      C('loc', 'Lost', st === 'LOST' || (sp != null && sp > 1), 'bad', `lost: position σ ${sp != null ? sp.toFixed(1) : '?'} m`);
      C(
        'loc',
        'Consistency',
        nees != null && nees > 9,
        'warn',
        `overconfident: NEES ${nees != null ? nees.toFixed(1) : '—'} (3 is consistent)`
      );
      if (P.loc === 'pf')
        C(
          'loc',
          'Particles',
          neff != null && neff < 0.15 * N,
          'warn',
          `particles degenerate: N_eff ${neff != null ? neff.toFixed(0) : '—'} of ${N} (2 s mean)`
        );
      if (usesB)
        C(
          'loc',
          'Beacon readings',
          silent > 3 && drive,
          beaconUse() ? 'ok' : 'warn',
          beaconUse()
            ? `no beacon readings for ${silent.toFixed(0)} s; lidar against the map holds it (σ ${sp != null ? sp.toFixed(2) : '—'} m)`
            : `no beacon readings for ${silent.toFixed(1)} s`
        );
      C(
        'loc',
        'Estimator',
        true,
        'ok',
        P.loc === 'dr'
          ? `dead reckoning${sp != null ? `: σ ${sp.toFixed(2)} m and growing` : ''}`
          : `σ ${sp != null ? sp.toFixed(2) : '—'} m${nees != null ? ` · NEES ${nees.toFixed(1)}` : ''}${neff != null && P.loc === 'pf' ? ` · N_eff ${neff.toFixed(0)}` : ''}`
      );
    }
  }
  // perception
  {
    const hits = f ? (f.scan ? f.scan.length / 2 : 0) : S.scanPts.length,
      tr = V.agents ? V.agents.tracks : [],
      cf = tr.filter(t => t.conf).length,
      people = V.peds.filter(p => !p.car).length;
    let gap = Infinity;
    for (const p of V.peds) gap = Math.min(gap, hyp(r.x - p.x, r.y - p.y) - (p.r || 0.3) - RR);
    C('per', 'Person contact', r.pedContact, 'bad', 'contact with a person');
    C('per', 'Lidar returns', V.t > 0.5 && hits === 0, 'warn', 'no lidar returns');
    if (agOn())
      C(
        'per',
        'Phantom tracks',
        cf > people + 1,
        'warn',
        `${cf} confirmed tracks for ${people} ${people === 1 ? 'person' : 'people'}: phantom tracks`
      );
    if (people) C('per', 'Person nearby', gap < 0.3 && drive, 'warn', `a person ${Math.max(0, gap).toFixed(2)} m away`);
    if (people && !agOn()) C('per', 'Tracking', true, 'idle', `${hits} lidar hits · people not tracked (agent tracking off)`);
    else
      C(
        'per',
        'Sensing',
        true,
        'ok',
        `${hits} lidar hits${agOn() ? ` · ${cf} track${cf === 1 ? '' : 's'}` : ''}${P.per === 'mapping' ? ' · mapping' : ''}`
      );
  }
  // mission and plan
  {
    const ps = S.planStats,
      skipped = f ? f.done.filter(d => d[1]).length : WPS.filter(w => w.skipped).length,
      n = f ? f.done.length : WPS.length;
    C('plan', 'Path', st === 'NO_PATH', 'bad', `no path to the next goal${F.fails ? ` (attempt ${F.fails} of 3)` : ''}`);
    C('plan', 'Goals', st === 'IDLE' && !n, 'idle', 'no goals: tap the map to add some');
    C('plan', 'Goals skipped', skipped > 0, 'warn', `${skipped} goal${skipped === 1 ? '' : 's'} skipped`);
    C('plan', 'Plan time', ps && ps.ms > 250 && !f, 'warn', ps ? `last plan took ${ps.ms.toFixed(0)} ms (${ps.name})` : '');
    C(
      'plan',
      'Mission',
      true,
      st === 'DONE' ? 'ok' : st === 'IDLE' ? 'idle' : 'ok',
      st === 'DONE'
        ? 'all goals reached'
        : st === 'IDLE'
          ? 'ready: press Run'
          : ps
            ? `${ps.name} · ${ps.len.toFixed(1)} m · ${ps.ms.toFixed(0)} ms`
            : st.toLowerCase()
    );
  }
  // control
  {
    const D = S.plot,
      tE = V.t,
      win = D.filter(d => d.t > tE - 2 && d.t <= tE + 1e-6),
      lim = isCar() ? 0.97 * P.steerMaxDeg : 0.97 * P.wmax,
      sat = win.length ? win.filter(d => d.ta != null && Math.abs(d.ta) >= lim).length / win.length : 0,
      last = win.length ? win[win.length - 1] : null,
      cte = last && last.cte != null ? Math.abs(last.cte) : null,
      mms = sig ? sig.mpcMs : S.mpcStats && P.ctl === 'mpc' ? S.mpcStats.ms : null;
    const dq = !isDyn() ? null : f ? sig.dyn : dynSig(r),
      ayF = dq && dq.mug > 0 ? Math.abs(dq.ay) / dq.mug : 0;
    C('ctl', 'Obstacle contact', r.contact, 'bad', 'contact with an obstacle');
    if (isDyn())
      C(
        'ctl',
        'Grip',
        drive && ayF > 0.8,
        'warn',
        dq
          ? `near the grip limit: a_y ${Math.abs(dq.ay).toFixed(2)} m/s², ${(100 * ayF).toFixed(0)} % of μg (${dq.mug.toFixed(2)} m/s²)`
          : ''
      );
    C(
      'ctl',
      'Actuator limit',
      drive && sat > 0.5,
      'warn',
      `${isCar() ? 'steering' : 'turn rate'} at its limit ${(sat * 100).toFixed(0)} % of the last 2 s`
    );
    if (P.ctl === 'mpc') {
      C('ctl', 'MPC budget', mms != null && mms >= 13, 'warn', `MPC at its 15 ms budget (${mms != null ? mms.toFixed(1) : '—'} ms)`);
      C(
        'ctl',
        'MPC constraints',
        !f && S.mpcStats && S.mpcStats.viol > 0.05,
        'warn',
        S.mpcStats ? `MPC constraints violated by ${S.mpcStats.viol.toFixed(2)}` : ''
      );
    }
    C('ctl', 'On the path', drive && cte != null && cte > 0.5, 'warn', `${cte != null ? cte.toFixed(2) : '—'} m off the path`);
    C(
      'ctl',
      'Driving',
      true,
      drive ? 'ok' : 'idle',
      !drive
        ? st === 'DONE'
          ? 'stopped: mission complete'
          : 'not driving'
        : `cross-track ${cte != null ? cte.toFixed(2) : '—'} m${mms != null ? ` · MPC ${mms.toFixed(1)} ms` : ''}`
    );
  }
  const H = {all};
  for (const k of Object.keys(all)) {
    const on = all[k].filter(c => c.on).sort((a, b) => H_RANK[b.lvl] - H_RANK[a.lvl]);
    const w = on[0] || all[k][all[k].length - 1];
    H[k] = [w.lvl, w.msg];
  }
  return H;
}
// N_eff averaged over the last 2 s of recorded frames (a single reading dips at every resampling)
function neffAvg(t) {
  const F = REC.frames;
  if (!F.length || P.loc !== 'pf') return null;
  let n = 0,
    a = 0;
  for (let i = F.length - 1; i >= 0 && F[i].t > t - 2; i--) {
    if (F[i].t > t + 1e-6) continue;
    const v = F[i].sig && F[i].sig.neff;
    if (v != null) {
      a += v;
      n++;
    }
  }
  return n ? a / n : S.pf ? S.pf.neff : null;
}
// One status row (UI review, step 3): the mission state, the figures, then the four lights; the phone keeps its own order
{
  const row = document.createElement('div'),
    st = $('#status');
  row.className = 'statusrow';
  st.parentNode.insertBefore(row, st);
  row.appendChild(st);
  row.appendChild($('#health'));
}
function renderHealth() {
  const el = $('#health');
  if (!el || !S) return;
  if (HEALTH.S !== S) {
    HEALTH.S = S;
    HEALTH.ev = [];
    HEALTH.prev = {};
    HEALTH.lastZ = 0;
    tlKey = '';
  }
  const f = replayFrame();
  if (!f && S.lastZ.length) HEALTH.lastZ = S.t;
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
      `<button type="button" class="hl ${H[k][0]}" data-sys="${k}" data-hs="${k}" aria-expanded="${HEALTH.open === k}" title="${esc(name)}: ${esc(H[k][1])} (click for every check)"><i aria-hidden="true"></i><b>${name}</b><span>${esc(H[k][1])}</span></button>`
  ).join('');
  if (el.dataset.h !== html) {
    el.dataset.h = html;
    el.innerHTML = html;
    el.querySelectorAll('[data-hs]').forEach(b => (b.onclick = () => healthOpen(HEALTH.open === b.dataset.hs ? null : b.dataset.hs, b)));
  }
  if (HEALTH.open) renderHealthPop(H);
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
    `<div class="hp-head" data-sys="${k}"><i class="hl-dot ${H[k][0]}"></i><b>${name}</b><span>${esc(H[k][1])}</span><button type="button" class="ibtn hp-x" title="Close (Esc)">×</button></div>` +
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
    activeTab = k;
    consoleOpen = true;
    buildTabs();
    renderAllPanes();
  };
  pop.querySelectorAll('.hp-ev li').forEach(
    li =>
      (li.onclick = () => {
        if (REC.frames.length > 1) seekTime(+li.dataset.t);
      })
  );
}
