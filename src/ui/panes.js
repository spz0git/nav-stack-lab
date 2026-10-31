// the lessons whose experiments run on the current level (by the level their first Try names)
function lessonsOnLevel() {
  const i = LEVELS.indexOf(LV),
    out = [];
  for (const G of LESSON_GROUPS())
    G.items.forEach((L, j) => {
      if (L.tries.some(t => t[1] && t[1].level === i)) out.push([`${G.id}:${j}`, L.t]);
    });
  return out;
}
let briefOpen = true; // the level's description; folding it is remembered (workspace.js)
// The level menu (UI review, step 2): one header button names the floor; its menu lists the seven floors on the left
// and, on the right, the current floor's description and quick experiments (the brief, which used to sit above the tabs).
const lvMenu = (() => {
  const m = document.createElement('div');
  m.id = 'lvlmenu';
  m.className = 'lvlmenu';
  m.hidden = true;
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', 'Levels and quick experiments');
  m.innerHTML = `<div class="lvl-list" role="group" aria-label="Level"></div><section class="brief" id="brief" aria-live="polite"></section>`;
  document.body.appendChild(m);
  return m;
})();
// A fade at the bottom of the level list or the brief while more of it is below, so a cut-off line reads as "scroll
// for more" (overlay scrollbars on phones and Macs stay hidden until you scroll); it goes once the end is in view.
function lvMenuMore() {
  for (const el of lvMenu.querySelectorAll('.lvl-list, .brief'))
    el.classList.toggle('more-below', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
}
for (const el of lvMenu.querySelectorAll('.lvl-list, .brief')) el.addEventListener('scroll', lvMenuMore, {passive: true});
new MutationObserver(() => requestAnimationFrame(lvMenuMore)).observe(lvMenu, {childList: true, subtree: true});
addEventListener('resize', () => {
  if (!lvMenu.hidden) lvMenuMore();
});
function lvMenuOpen(on) {
  const b = $('#lvl-btn');
  if (on == null) on = lvMenu.hidden;
  lvMenu.hidden = !on;
  if (b) b.setAttribute('aria-expanded', String(on));
  if (!on || !b) return;
  const r = b.getBoundingClientRect(),
    w = Math.min(760, innerWidth - 16);
  lvMenu.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  lvMenu.style.top = r.bottom + 6 + 'px';
  lvMenu.style.width = w + 'px';
  const cur = lvMenu.querySelector('.lvl[aria-pressed="true"]');
  if (cur) cur.focus();
  requestAnimationFrame(lvMenuMore);
}
document.addEventListener(
  'pointerdown',
  e => {
    if (!lvMenu.hidden && !lvMenu.contains(e.target) && !e.target.closest('#lvl-btn')) lvMenuOpen(false);
  },
  true
);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !lvMenu.hidden) {
    lvMenuOpen(false);
    $('#lvl-btn').focus();
  }
});
const firstSentence = s => {
  const t = s.replace(/<[^>]+>/g, '');
  const k = t.indexOf('. ');
  return k > 0 ? t.slice(0, k + 1) : t;
};
function buildLevels() {
  $('#levels').innerHTML =
    `<button type="button" class="btn lvl-btn" id="lvl-btn" aria-haspopup="dialog" aria-expanded="${!lvMenu.hidden}" aria-controls="lvlmenu" title="Choose the floor; its description and quick experiments are in this menu"><b>${LV.id}</b><span class="lvl-name">${esc(LV.name)}</span><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  $('#lvl-btn').onclick = () => lvMenuOpen();
  const list = lvMenu.querySelector('.lvl-list');
  // the built-in floors, then the custom ones: kept in this browser, the one on screen if it is not kept, and the
  // Custom entry (import, export, link, generate: ui/levelmenu.js)
  const own = !LEVELS.includes(LV),
    custOn = CUST.open || own,
    item = (attr, id, name, d, on) =>
      `<button type="button" class="lvl" ${attr} aria-pressed="${on}"><b>${id}</b><span class="lvl-n">${esc(name)}</span><span class="lvl-d">${d}</span></button>`;
  list.innerHTML =
    LEVELS.map((L, i) => item(`data-i="${i}"`, L.id, L.name, firstSentence(L.adds), !custOn && L === LV)).join('') +
    CUST.saved
      .map(r =>
        item(
          `data-c="${r.id}"`,
          r.json.gen ? 'G' : 'C',
          r.name,
          `${r.json.size.join(' × ')} m, kept in this browser`,
          own && LV.savedId === r.id
        )
      )
      .join('') +
    (own && !LV.savedId ? item('data-cur="1"', LV.id, LV.name, `${levelSize(LV).join(' × ')} m, not kept`, true) : '') +
    item('data-cust="1"', '+', 'Custom level', 'Import, export, share, generate', CUST.open && !own);
  list.querySelectorAll('.lvl[data-i]').forEach(
    b =>
      (b.onclick = () => {
        CUST.open = false;
        levelPicked(+b.dataset.i);
        const nb = lvMenu.querySelector(`.lvl[data-i="${b.dataset.i}"]`);
        if (nb) nb.focus();
      })
  );
  list.querySelectorAll('.lvl[data-c]').forEach(
    b =>
      (b.onclick = () => {
        CUST.open = true;
        custPick(CUST.saved.find(r => r.id === b.dataset.c));
        const nb = lvMenu.querySelector(`.lvl[data-c="${b.dataset.c}"]`);
        if (nb) nb.focus();
      })
  );
  list.querySelectorAll('.lvl[data-cust], .lvl[data-cur]').forEach(
    b =>
      (b.onclick = () => {
        CUST.open = true;
        buildLevels();
        const nb = lvMenu.querySelector(b.dataset.cust ? '.lvl[data-cust]' : '.lvl[data-cur]');
        if (nb) nb.focus();
      })
  );
  if (custOn) {
    $('#brief').innerHTML = custBriefHTML();
    custWire($('#brief'));
    return;
  }
  $('#brief').innerHTML =
    `<div class="adds-d"><h3>What ${LV.id} <span class="lvname">${LV.name}</span> adds</h3><p class="adds">${LV.adds}</p></div><details class="try" open><summary><h3>Quick experiments (${LV.tries.length}) · one click sets the lab up and runs</h3></summary><p class="note">Short setups to poke at this floor. The guided lessons in Learn explain the same things step by step${
      lessonsOnLevel().length
        ? `: <span class="lvlessons">${lessonsOnLevel()
            .slice(0, 5)
            .map(([id, t]) => `<button type="button" class="linkbtn" data-lesson="${id}">${t}</button>`)
            .join(', ')}${lessonsOnLevel().length > 5 ? ` and ${lessonsOnLevel().length - 5} more in Learn` : ''}</span>`
        : ''
    }.</p><ul>${LV.tries.map((t, i) => `<li>${t.t}<div class="tries">${t.b.map((x, j) => `<button class="btn small" data-lt="${i}:${j}">${x[0]}</button>`).join('')}</div></li>`).join('')}</ul></details>`;
  $('#brief')
    .querySelectorAll('[data-lesson]')
    .forEach(
      b =>
        (b.onclick = () => {
          lvMenuOpen(false);
          setUIMode('learn');
          openLesson(b.dataset.lesson);
        })
    );
  $('#brief')
    .querySelectorAll('[data-lt]')
    .forEach(
      b =>
        (b.onclick = () => {
          const [i, j] = b.dataset.lt.split(':').map(Number);
          lvMenuOpen(false);
          tryGo(LV.tries[i].b[j][1]);
        })
    );
}
// A level picked in the menu or the search keeps the settings you changed (switchLevel in core/config.js)
function levelPicked(i) {
  const {kept} = switchLevel(i),
    n = Object.keys(kept).length;
  if (n) toast(`${LV.id}: kept the ${n} setting${n > 1 ? 's' : ''} you changed. Changed → Reset all gives this level's own.`, 4500);
  renderAllPanes();
}
async function tryGo(cfg) {
  firstRunDone();
  // The seed: 'next' steps it; a number pins it; a Try that names a level otherwise runs at the default seed, so the
  // numbers quoted in the lessons (measured at seed 7) hold whatever ran before. Level Try buttons keep the current seed.
  if (cfg.seed === 'next') P.seed = (P.seed % 99) + 1;
  else if (typeof cfg.seed === 'number') P.seed = cfg.seed;
  else if (cfg.level != null) P.seed = DEFAULTS.seed;
  if (cfg.level != null) LV = levelOf(cfg.level); // a built-in's index, or a generator spec (the safety lessons' worlds)
  if (!cfg.keep) loadLevel(LV);
  for (const [k, v] of Object.entries(cfg.set || {})) setParam(k, v, false);
  if (cfg.goals) setGoals(cfg.goals); // a Try with its own goals (a loop to close): the mission restarts on them
  if (cfg.saf) safFromTry(cfg.saf); // the safety lessons: a sheet and a search in Tools → Safety
  if (cfg.tab) {
    activeTab = cfg.tab;
    consoleOpen = true;
    buildTabs();
  }
  applyTabLayers();
  if (cfg.layers) Object.assign(LAYERS, cfg.layers);
  renderAllPanes();
  if (cfg.plot) {
    plotCh = cfg.plot;
    seg(
      $('#plotsel'),
      PLOT_OPTS,
      () => plotCh,
      v => {
        plotCh = v;
        drawPlot();
      }
    );
  }
  if (cfg.panes) {
    PANES.length = 0;
    for (const p of cfg.panes) addPane(p.slice());
    if (WS.dockOff) wsDock(true);
  } // added plots: a list of signal lists
  if (AN.mode !== 'sim') setMode('sim');
  if (cfg.keep) {
    draw();
    return;
  }
  if (cfg.hold) {
    running = false;
    draw();
    refreshAll();
    return;
  } // set up but do not run (a lesson being opened)
  if ((S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') && remaining().length) startMission();
  if (cfg.searchStep && searchPlayStart(true)) {
    refreshAll();
    return;
  } // planning lessons: the search plays first, Run drives
  if (cfg.act) {
    // the kidnap or scatter at 8 s, on the fault schedule (core/config.js); the first 8 s run at once, so the Try
    // starts at the moment of the act
    setParam('sched', [{t: 8, act: cfg.act}], false);
    running = false;
    await advance(160);
  }
  running = true;
  refreshAll();
}
let activeTab = 'loc';
const howOpen = {};
// Phones show the console as its tab row until a tab is tapped; tapping the open tab folds it again. Wide screens ignore this.
let consoleOpen = false;
const narrowUI = () => matchMedia('(max-width:760px)').matches;
// Show a Symbols group: scroll only the console on desktop (below its sticky tabs), the page on phones
const showSym = id => showTabAt('sym', 'sym-' + id);
// A tab of Simulate's console, scrolled to one of its elements (Learn gives way to Simulate, whose console it is)
function showTabAt(tab, elId) {
  if (uiMode === 'learn') setUIMode(AN.mode);
  activeTab = tab;
  consoleOpen = true;
  buildTabs();
  renderAllPanes();
  const el = document.getElementById(elId),
    c = document.querySelector('.right') || document.querySelector('.console');
  if (!el) return;
  if (c.scrollHeight > c.clientHeight + 1 && getComputedStyle(c).overflowY !== 'visible') {
    const tb = c.querySelector('.tabs').offsetHeight;
    c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - tb - 8;
  } else el.scrollIntoView({block: 'start'});
}
// Simulate's tabs come in three groups; only the chosen group's tabs show. Each group remembers its last tab.
// One tab row (UI review, step 6): the pipeline's tabs, then More, a menu of the tools and the reference. While one of
// those is open, More carries its name.
const tabMore = (() => {
  const m = document.createElement('div');
  m.className = 'tabmore';
  m.id = 'tabmore';
  m.hidden = true;
  m.setAttribute('role', 'menu');
  document.body.appendChild(m);
  return m;
})();
function tabMoreOpen(on) {
  const b = $('#tab-more');
  tabMore.hidden = !on;
  if (b) b.setAttribute('aria-expanded', String(on));
  if (!on || !b) return;
  const r = b.getBoundingClientRect(),
    w = 220;
  tabMore.style.top = r.bottom + 4 + 'px';
  tabMore.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
}
document.addEventListener(
  'pointerdown',
  e => {
    if (!tabMore.hidden && !tabMore.contains(e.target) && !e.target.closest('#tab-more')) tabMoreOpen(false);
  },
  true
);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !tabMore.hidden) tabMoreOpen(false);
});
// Keyboard (assessment 2026-10-25, UI 3): the row is one tab stop (the selected tab, or More while a tool is open);
// ← → Home End move along it and select, ↓ on More opens the menu; in the menu ↑ ↓ Home End move, Esc returns to More.
$('#tabs').addEventListener('keydown', e => {
  const row = [...$('#tabs').children],
    i = row.indexOf(e.target);
  if (i < 0) return;
  if (e.key === 'ArrowDown' && e.target.id === 'tab-more') {
    e.preventDefault();
    tabMoreOpen(true);
    tabMore.querySelector('.tm-item').focus();
    return;
  }
  const j = {ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: row.length - 1}[e.key];
  if (j === undefined) return;
  e.preventDefault();
  const b = row[(j + row.length) % row.length];
  if (b.getAttribute('role') === 'tab' && b.getAttribute('aria-selected') !== 'true') b.click();
  $('#' + b.id).focus();
});
tabMore.addEventListener('keydown', e => {
  const items = [...tabMore.querySelectorAll('.tm-item')],
    i = items.indexOf(document.activeElement);
  if (e.key === 'Escape' || e.key === 'Tab') {
    if (e.key === 'Escape') e.preventDefault();
    tabMoreOpen(false);
    $('#tab-more').focus();
    return;
  }
  const j = {ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: items.length - 1}[e.key];
  if (j === undefined) return;
  e.preventDefault();
  items[(j + items.length) % items.length].focus();
});
// More's label is the open tool's name; every name sits in the button (one shown), so its width, and with it the
// row's wrapping, stays the same whichever tool is open
const moreLabel = cur =>
  `<span class="tm-sz">${['More', ...TAB_GROUPS.slice(1).flatMap(g => g.tabs.map(id => TABS.find(t => t.id === id).name))]
    .map(n => `<span${n === cur ? '' : ' aria-hidden="true"'}>${n}</span>`)
    .join('')}</span>`;
function buildTabs() {
  const pipe = TAB_GROUPS[0].tabs,
    more = TAB_GROUPS.slice(1),
    inMore = !pipe.includes(activeTab),
    cur = TABS.find(t => t.id === activeTab),
    ae = document.activeElement,
    refocus = tabMore.contains(ae) ? 'tab-more' : $('#tabs').contains(ae) ? ae.id : null; // the row is rebuilt: focus comes back
  $('#tabgroups').innerHTML = '';
  $('#tabs').innerHTML =
    TABS.filter(t => pipe.includes(t.id))
      .map(
        t =>
          `<button class="tab" role="tab" id="tab-${t.id}"${SYS[t.id] ? ` data-sys="${t.id}"` : ''} aria-selected="${t.id === activeTab}" tabindex="${t.id === activeTab ? 0 : -1}" aria-controls="pane">${t.n ? `<small>${t.n}</small>` : ''}${t.name}</button>`
      )
      .join('') +
    `<button class="tab tab-more" type="button" id="tab-more" aria-haspopup="menu" aria-expanded="false" aria-selected="${inMore}" tabindex="${inMore ? 0 : -1}">${moreLabel(inMore && cur ? cur.name : 'More')}<svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  tabMore.innerHTML = more
    .map(
      g =>
        `<p class="tm-h">${g.name}</p>` +
        TABS.filter(t => g.tabs.includes(t.id))
          .map(
            t =>
              `<button type="button" role="menuitem" class="tm-item" id="tab-${t.id}" tabindex="-1" aria-current="${t.id === activeTab}">${t.name}</button>`
          )
          .join('')
    )
    .join('');
  tabMore.querySelectorAll('.tm-item').forEach(
    b =>
      (b.onclick = () => {
        tabMoreOpen(false);
        activeTab = b.id.slice(4);
        consoleOpen = true;
        buildTabs();
        renderAllPanes();
      })
  );
  $('#tab-more').onclick = e => {
    tabMoreOpen(tabMore.hidden);
    if (!tabMore.hidden && !e.detail) tabMore.querySelector('.tm-item').focus(); // opened with Enter or Space
  };
  $('#tabs')
    .querySelectorAll('.tab[role="tab"]')
    .forEach(
      b =>
        (b.onclick = () => {
          const id = b.id.slice(4);
          if (id === activeTab && consoleOpen && narrowUI()) {
            consoleOpen = false;
            buildTabs();
            return;
          }
          activeTab = id;
          consoleOpen = true;
          buildTabs();
          renderAllPanes();
        })
    );
  $('.console').classList.toggle('collapsed', !consoleOpen);
  if (refocus && $('#' + refocus)) $('#' + refocus).focus({preventScroll: true});
}
function renderAllPanes() {
  hashSoon();
  applyTabLayers();
  const t = activeTab;
  let html = '';
  btnActs = [];
  infoFns = []; // data-act / data-info index these, per render
  if (t === 'code') html = codePane();
  else if (t === 'view') html = layersPane();
  else if (t === 'sym') html = symPane();
  else if (t === 'exp') html = expPane();
  else if (t === 'train') html = trainPane();
  else if (t === 'saf') html = safPane();
  else {
    if (t === 'mis') html += `<div id="fsm-wrap" class="fsm-wrap">${fsmSVG()}</div>`;
    for (const f of SCHEMA[t]) {
      if (f.show && !f.show()) continue;
      html += fieldHTML(f);
    }
    if (NOTES[t])
      html += `<details class="how" ${howOpen[t] ? 'open' : ''} data-how="${t}"><summary>How it works</summary><div class="how-body">${NOTES[t]}<button class="linkbtn" data-sym="${t === 'sen' ? 'loc' : t}">Symbol definitions for this section</button>${t === 'ctl' ? '<button class="linkbtn" data-sym="mpc">MPC symbols</button>' : ''}${t === 'per' || t === 'ctl' ? '<button class="linkbtn" data-sym="ag">Moving-agent symbols</button>' : ''}${SRC_FILES[t] ? `<button class="linkbtn" data-source="${SRC_FILES[t][0]}">View the source</button>` : ''}</div></details>`;
  }
  $('#panes').innerHTML = `<div class="pane" id="pane" role="tabpanel">${html}</div>`;
  wirePane(t);
}
let btnActs = [],
  infoFns = [];
/* ---------- the beacon sensor explained, with a live line per beacon ---------- */
let bsOpen = false,
  bsKey = '';
const BS_WHY = {
  ok: ['reading', 'ok'],
  range: ['out of range', 'muted'],
  blocked: ['blocked (no line of sight)', 'warn'],
  off: ['switched off', 'muted'],
  outage: ['in an outage', 'warn']
};
function beaconSensorHTML() {
  const k = P.lmK,
    sr = 0.08 * k,
    sb = 0.03 * k,
    R = P.lmRange,
    r = S.robot,
    u = beaconUse();
  const rows = S.beacons
    .map(b => {
      const d = hyp(b.x - r.x, b.y - r.y),
        w = (S.bWhy && S.bWhy[b.id]) || (beaconsOff().has(b.id) ? 'off' : d > R ? 'range' : ''),
        W = S.bSeen ? S.bSeen[b.id] : [],
        rate = S.t > 0.2 ? W.filter(t => t > S.t - 5).length / Math.min(5, S.t) : 0,
        st = BS_WHY[w] || ['no scan yet', 'muted'];
      return `<tr><td>${b.id}</td><td>${d.toFixed(1)} m</td><td class="bs-${st[1]}">${st[0]}</td><td>${rate.toFixed(1)}/s</td><td>${(d * sb).toFixed(2)} m</td></tr>`;
    })
    .join('');
  return `<p>Each beacon is a fixed landmark at a known position (teal diamond on the map). The robot's beacon sensor takes one <b>scan every 0.2 s (5 Hz)</b> and in each scan reads every beacon that is</p>
<ul class="bs-list"><li>switched on and not in an outage,</li><li>between <b>0.2 m and ${R} m</b> away (Beacon sensor reach, below),</li><li>in <b>line of sight</b>: a wall, shelf, parked car or person on the straight line to the beacon blocks it completely. There is no partial or weakened signal.</li></ul>
<p>A reading is a <b>range</b> r and a <b>bearing</b> b (relative to the robot's heading) with Gaussian noise: <b>σ<sub>r</sub> = ${sr.toFixed(3)} m</b> and <b>σ<sub>b</sub> = ${sb.toFixed(3)} rad (${deg(sb).toFixed(1)}°)</b>, which is 0.08 m and 0.03 rad × the noise scale ${k.toFixed(1)} (Beacon range/bearing noise, below). The noise does <b>not</b> grow with distance, but a bearing error moves the implied position sideways by d·σ<sub>b</sub>, so a far beacon pins the position less (last column). The EKF and the particle filter assume these same σ's.</p>
<p>Also in play: Sensor latency (Timing, below) delivers readings late; Beacon association → Unlabeled (Localize) drops the IDs and adds false detections; Random outages (below) switch beacons off for a while.${u ? ` <b>Right now ${u}.</b>` : ''}</p>
<table class="bs-tab"><thead><tr><th>#</th><th>distance</th><th>this scan</th><th title="Readings received per second over the last 5 s (at most 5)">readings</th><th title="Sideways position error of one bearing reading, d·σ_b">d·σ<sub>b</sub></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderBeaconSensor() {
  const el = $('#bsens-body');
  if (!el || !bsOpen) return;
  const key = Math.round(S.t * 5) + '|' + P.lmK + P.lmRange + P.bOff + P.loc + P.pfLidar;
  if (key === bsKey) return;
  bsKey = key;
  el.innerHTML = beaconSensorHTML();
}
const TIPS = {
  policyGoal:
    'The end-to-end policy sees only the scan and a goal direction. Pointed at the mission goal it has to find its way through a building from the scan alone, which a reactive policy cannot; pointed at a point 3 m along a classical global route it only has to drive and avoid, which it can. The second is the hybrid most learned navigation stacks use.',
  agICP:
    "Each track keeps the hit points of its last detection; the next detection's points are aligned to them by ICP, and the displacement over the 0.1 s between scans is a velocity measurement the Kalman filter fuses directly, instead of inferring velocity from positions over a second.",
  voT: "How far ahead a collision counts: a robot velocity that meets a person within this time is inside that person's velocity obstacle. Short: late, sharp detours; long: wide berths and more false alarms from people who will have turned.",
  voMargin: "Added to the sum of the robot's and the person's radii when the cones are built: the gap the detour keeps.",
  pgKf: 'A new keyframe (a pose with its scan, joined to the previous one by an odometry edge) every time the robot has moved this far or turned 20°. Closer keyframes give more loop closures and a bigger graph to optimize.',
  pgMatch:
    'Each new keyframe is first aligned to the map the keyframes have built so far (Gauss–Newton on its distance field) and fused with the odometry; the edge to the previous keyframe then carries that matched motion. Off: the edges are the raw odometry, and only loop closures correct the drift.',
  pgLoop:
    "When a new keyframe comes within 2 m of a keyframe at least ten back, its scan is aligned to that one by ICP from the graph's own guess; a good fit (60 % of the hits paired, residual under 8 cm, correction under 1 m) becomes a loop-closure edge and the whole graph is re-optimized. Off: odometry edges only, which is dead reckoning with a graph.",
  scanMatch:
    'Every fourth tick the lidar scan is aligned to the prior map (Gauss–Newton on the distance field, from the current estimate) and the result is fused into the EKF as a pose measurement with the covariance of the fit. The lidar becomes a position sensor; beacons are optional.',
  loc: 'Which estimator produces the pose the planner and controller use.',
  assoc: 'Whether beacon readings carry their ID. Unlabeled readings are matched by Mahalanobis distance.',
  npart: 'More particles cost CPU and resolve the belief more finely.',
  inject: 'Replace low-weight particles with poses sampled from beacon readings when the likelihood drops.',
  pfLidar: 'Score particles against the prior map with 24 lidar beams.',
  filtK:
    'Motion noise the filter assumes: the same σ_v, σ_ω model as the odometry with k_filter = this × max(odometry noise, 0.25), and never the calibration bias; too low makes it overconfident (NEES above 3).',
  per: 'Prior map: the planner sees the true static map. Lidar mapping: an occupancy grid built from scans in the estimated frame.',
  unknownAs: 'Whether unobserved cells block the planner.',
  infl: 'Width of the soft cost band outside the lethal radius.',
  agents: 'Off: people reach the stack only as lidar hits. Ground truth: perfect tracks. Lidar: clustering plus a Kalman filter per agent.',
  agPred:
    'Constant velocity extrapolates each track; Static freezes it where it is now; Learned asks a network trained on the simulator’s walkers for three futures.',
  predModes: 'Which of the learned futures the speed planner, space-time A*, DWA and MPC treat as obstacles.',
  agT: 'How far ahead agents are predicted and the speed planner plans.',
  agGrow: 'How fast the predicted radius grows per second of prediction.',
  trkIn:
    "What updates the tracks. Lidar: the clusters' positions. Radar: the radar's detections (range, bearing, radial velocity) in an extended Kalman filter, only in its field of view. Lidar + radar: both, and a track the radar can see is confirmed only once the radar has seen it too (or after six lidar hits).",
  weather:
    "Clear, rain or fog. Fog and rain shorten the lidar's reach, drop beams, add range noise and returns from the air close to the robot; the radar barely notices.",
  radar:
    'A forward radar: detections with range, bearing and radial velocity, drawn on the map. It feeds the people tracker when Tracker inputs includes it.',
  radFov: 'How wide the radar looks, centred on the heading.',
  radRange: 'How far the radar sees.',
  radRes:
    'Two echoes closer than this in bearing (and within 0.4 m in range and 0.25 m/s in radial velocity) come back as one detection, at their amplitude-weighted average: two people side by side become one.',
  radClutter: 'False detections per scan, on average (Poisson), anywhere in the field of view, with random radial velocities.',
  radGhost:
    "The chance per scan that a person's echo also comes back by a bounce off a wall: a detection at the person's mirror image behind the wall, moving with the mirrored velocity.",
  agSigA: 'White acceleration noise of the constant-velocity model. Higher follows turns faster but gives noisier velocity.',
  mis: 'In order visits goals as numbered. Greedy picks the nearest next. Optimal solves the open-path TSP.',
  replan: 'Replan on a timer in addition to the event-driven triggers.',
  lostGuard: 'Stop when the position uncertainty exceeds 1 m.',
  oddMon:
    'Watch what the robot can observe of its operating domain against the sheet it was given, and crawl or stop while it is outside. Off by default.',
  oddResp: 'What the robot does outside its domain: crawl at 0.3 m/s, or stop until it is back inside.',
  misLoop: 'After the last goal the mission starts again from the first, so the robot drives until you stop it.',
  map: "The level's obstacles, or an empty floor with only the outer walls. Paint (W) and Erase (E) on the map edit either.",
  plan: 'Global planner on the costmap. Reeds–Shepp and Hybrid A* are car-only.',
  planPct: 'Fraction of the steering limit the planner may use. The rest is margin for the tracker.',
  eps: 'Heuristic weight. Above 1 the search is faster and the path up to ε times longer.',
  hybH: 'Which heuristic guides Hybrid A*.',
  revOK: 'Allow reverse legs with cusps.',
  revPen: 'Cost multiplier on reverse distance.',
  gearPen: 'Fixed cost for each change of direction.',
  rrtIt: 'Samples per RRT* run.',
  smooth: 'Shortcut the path with line-of-sight checks.',
  agPlan: 'When the speed planner cannot avoid an agent, replan around its predicted positions.',
  ctl: 'Path tracker that turns the plan into speed and steering.',
  vcruise: 'Speed the reference profile aims for on straights.',
  spd: "How path trackers and MPC react to tracked agents. Ignore: not at all. Reactive stop: brake for hits in the corridor ahead (path trackers). Velocity obstacles: steer and slow to the nearest velocity outside every person\'s collision cone (path trackers). Speed planning: ST-graph speed profile against the predictions; it caps a path tracker's speed and is MPC's reference.",
  stMarg: 'Clearance the speed planner keeps from predicted agents.',
  radBrake:
    "Stop when a radar echo in the robot's way closes faster than the time to contact allows. Reads the radar alone, one scan at a time, after every controller. Off by default.",
  radTTC: 'The emergency brake stops when the gap to an echo in the way, over its closing speed, falls below this.',
  ppL0: 'Lookahead distance at zero speed.',
  ppK: 'Extra lookahead per m/s of speed.',
  alat: 'Lateral acceleration cap that slows the robot in curves.',
  rwKth: 'Heading-error gain of rear-wheel feedback. Higher damps more.',
  rwKe: 'Lateral-error gain of rear-wheel feedback. Higher is stiffer.',
  stanK: 'Stanley cross-track gain.',
  kp: 'Proportional gain on heading error to the carrot.',
  ki: 'Integral gain; removes steady error but adds phase lag.',
  kd: 'Derivative gain on heading error.',
  dwaG: 'DWA weight on distance and heading to the carrot.',
  dwaO: 'DWA weight on clearance.',
  dwaV: 'DWA weight on speed.',
  dwaT: 'How far DWA rolls each candidate out.',
  mpcMode: 'NMPC relinearizes every iteration; LTV linearizes once about the reference.',
  mpcNp: 'Prediction horizon in steps of Δt.',
  mpcNc: 'Free input moves; later moves are held at the last one.',
  mpcDt: 'Prediction step.',
  mpcIt: 'SQP iterations per 50 ms tick, within the real-time budget below.',
  mpcBudget:
    'Wall-clock time a solve may take before it stops with the best iterate so far (a real controller has a deadline). It makes the result depend on the computer: on a slow or busy one a solve is cut sooner. 0: no limit, every iteration runs, the same on every computer.',
  mpcQlat: 'Penalty on lateral error.',
  mpcQlon: 'Penalty on along-track error.',
  mpcQth: 'Penalty on heading error.',
  mpcQv: 'Penalty on speed error.',
  mpcQf: 'Multiplier on the last step of the horizon.',
  mpcRa: 'Penalty on acceleration input.',
  mpcRs: 'Penalty on steering-rate or angular-acceleration input.',
  mpcRd: 'Penalty on the change between consecutive moves.',
  mpcRho: 'Augmented-Lagrangian penalty for the state constraints.',
  mpcObs: 'Add clearance constraints against lidar points and predicted agents.',
  mpcMarg: 'Extra clearance in the obstacle constraints.',
  mpcLag: 'Model the first-order actuator lag with two more states.',
  model: 'Unicycle turns in place; the bicycle model steers front wheels and needs motion to turn.',
  veh: 'Unicycle turns in place. The kinematic car goes exactly where its front wheel points. The dynamic car has mass, yaw inertia and tyres that slip, so it turns less than it steers and can run out of grip.',
  mass: 'Mass of the car with tyre slip; with the cornering stiffnesses it sets how much the tyres slip in a turn.',
  Iz: 'Yaw moment of inertia about the centre of mass; larger is slower to start and stop turning.',
  lf: 'Distance from the front axle back to the centre of mass; l_r = L − l_f. A centre of mass nearer the front loads the front tyres.',
  Cf: 'Sideways force per radian of front slip angle (both front tyres). Softer front tyres understeer more.',
  Cr: 'Sideways force per radian of rear slip angle (both rear tyres). Softer rear tyres move the car toward oversteer.',
  mu: 'Friction coefficient: a tyre pushes sideways with at most μ times its load, so the car can corner at about μg.',
  gyro: 'Report the true yaw rate in the odometry instead of v tan δ / L from the steering encoder.',
  wheelbase: 'Distance between axles.',
  steerMaxDeg: 'Steering limit; sets the minimum turning radius.',
  steerRate: 'How fast the steering angle can change.',
  vmax: 'Speed limit.',
  wmax: 'Turn-rate limit of the unicycle.',
  accel: 'Enforce acceleration limits in the vehicle.',
  amax: 'Linear acceleration limit.',
  alpha: 'Angular acceleration limit.',
  lag: 'First-order actuator time constant.',
  latency: 'Ticks a command waits before reaching the actuators.',
  biasDeg: 'Constant offset between commanded and actual steering angle.',
  biasW: 'Constant offset in turn rate, as from one weak motor.',
  odoK: 'Random odometry error, drawn fresh every 50 ms: σ_v = k (0.1|v| + 0.02) m/s on speed and σ_ω = k (0.2|ω| + 0.1|v| + 0.02) rad/s on turn rate, so ×1 at 0.8 m/s straight is σ 0.10 m/s and 0.10 rad/s per reading.',
  odoB: 'Fixed calibration error the filters are never told about: speed reads v (1 + 0.02 b) and turn rate ω + 0.01 b·v rad/s, so ×1 at 0.8 m/s is +1.6 cm/s and +0.008 rad/s (0.46°/s, about 28° of heading per minute).',
  lmK: 'Beacon noise scale: σ_r = 0.08 m and σ_b = 0.03 rad at ×1. The EKF and the particle filter assume the same σs (at least ×0.25).',
  bOff: 'Beacons switched off send no readings. Also: the Beacon tool on the map (B).',
  bOut: 'Each beacon fails at random and comes back; this is the share of time it is down. Outages have their own random stream, so the sensor noise is unchanged.',
  bOutLen: 'Average length of one outage. A few tenths of a second is a flicker; several seconds is a dead zone.',
  lmRange: 'How far the beacon sensor reads a beacon (from 0.2 m), in line of sight.',
  clutter: 'False beacon detections per scan in unlabeled mode.',
  lidarSig: 'Lidar range noise: Gaussian, new for every beam of every scan.',
  lidarRange:
    'How far the lidar sees. A surface beyond it returns nothing, and the map learns only that the floor is free out to here. At most 8 m (the learned models were trained on 8 m scans).',
  lidarDrop:
    'Share of beams that return nothing at random, as from a dark or shiny surface or a dirty window, on their own random stream. Lidar mapping takes a lost beam as free floor out to the reach, so it can clear cells behind a wall: the failure glass and black paint cause.',
  sensLat: 'Lidar, beacon, sonar and GNSS readings reach the stack this late, in whole 50 ms ticks; the odometry is on time.',
  seed: 'Seed of the world and sensor noise. Applied on Reset.'
};
function lvlDefault(k) {
  if (k === 'veh') return vehOf(lvlDefault('model'), lvlDefault('carPhys'));
  return k in (LV.cfg || {}) ? LV.cfg[k] : DEFAULTS[k];
}
function chgMark(f) {
  const d = lvlDefault(f.k);
  if (d === undefined || P[f.k] === d) return '';
  const o = f.opts && (typeof f.opts === 'function' ? f.opts() : f.opts).find(x => x[0] === d);
  const dv = typeof d === 'number' ? fmtVal(f, d) : typeof d === 'boolean' ? (d ? 'on' : 'off') : o ? o[1] : d === '' ? 'none' : d;
  return `<button class="rst" data-reset="${f.k}" title="Back to this level's default (${dv})">↺</button>`;
}
// The info lines of the rendered tabs follow the state they describe (keyframes and closures, the floor seen, the
// loaded code): re-evaluated with the rest of the refresh, written only when the text changed
function renderInfoLines() {
  document.querySelectorAll('.console [data-info]').forEach(el => {
    const fn = infoFns[+el.dataset.info];
    if (!fn) return;
    const t = fn();
    if (el.dataset.last !== t) {
      el.innerHTML = t;
      el.dataset.last = t;
    }
  });
}
function fieldHTML(f) {
  if (f.type === 'head') return `<h3 class="fhead">${f.label}</h3>`;
  if (f.type === 'info') {
    infoFns.push(f.text);
    return `<p class="note" data-info="${infoFns.length - 1}">${f.text()}</p>`;
  }
  if (f.type === 'seg')
    return `<div class="field${chgMark(f) ? ' chg' : ''}"><span class="lbl" title="${TIPS[f.k] || ''}">${f.label}${chgMark(f)}</span><div class="seg" data-k="${f.k}">${(typeof f.opts === 'function' ? f.opts() : f.opts).map(([v, l]) => `<button data-v="${v}" aria-pressed="${P[f.k] === v}">${l}</button>`).join('')}</div></div>`;
  if (f.type === 'bool')
    return `<label class="check${chgMark(f) ? ' chg' : ''}" title="${TIPS[f.k] || ''}"><input type="checkbox" id="p-${f.k}" data-k="${f.k}" ${P[f.k] ? 'checked' : ''}><span>${f.label}${chgMark(f)}</span></label>`;
  if (f.type === 'beacons') {
    const off = beaconsOff(),
      c = chgMark({k: 'bOff'});
    return `<div class="field${c ? ' chg' : ''}"><span class="lbl" title="${TIPS.bOff}">${f.label}${c}</span><div class="bchips">${S.beacons.map(b => `<button data-beacon="${b.id}" aria-pressed="${!off.has(b.id)}" title="Beacon ${b.id} at ${b.x.toFixed(1)}, ${b.y.toFixed(1)} m">${b.id}</button>`).join('')}</div><div class="bchips-all"><button class="linkbtn" data-beacon="all">All on</button><button class="linkbtn" data-beacon="none">All off</button></div></div>`;
  }
  if (f.type === 'sensors') return sensorsHTML();
  if (f.type === 'bsensor')
    return `<details class="how bsens" id="bsens" ${bsOpen ? 'open' : ''}><summary>Beacon sensor: rate, range, noise, what blocks it</summary><div class="how-body" id="bsens-body">${beaconSensorHTML()}</div></details>`;
  if (f.type === 'btns')
    return `<div class="field"><span class="lbl">${f.label}</span><div class="seg">${f
      .items()
      .map(([l, act, on, tip]) => {
        btnActs.push(act);
        return `<button type="button" data-act="${btnActs.length - 1}" aria-pressed="${!!on}"${tip ? ` title="${tip}"` : ''}>${l}</button>`;
      })
      .join('')}</div></div>`;
  if (f.type === 'btn') {
    btnActs.push(f.act);
    return `<div><button class="btn" data-act="${btnActs.length - 1}">${f.label}</button></div>`;
  }
  return `<div class="field${chgMark(f) ? ' chg' : ''}"><div class="row"><label for="p-${f.k}" title="${TIPS[f.k] || ''}">${f.label}${chgMark(f)}</label><output id="o-${f.k}">${fmtVal(f, P[f.k])}</output></div><input type="range" id="p-${f.k}" data-k="${f.k}" min="${f.min}" max="${typeof f.max === 'function' ? f.max() : f.max}" step="${f.step}" value="${P[f.k]}"></div>`;
}
function fmtVal(f, v) {
  const d = f.step < 0.01 ? 3 : f.step < 0.1 ? 2 : f.step < 1 ? (f.step % 0.1 < 1e-9 ? 1 : 2) : 0;
  return `${(+v).toFixed(d)}${f.unit ? ' ' + f.unit : ''}`;
}
function wirePane(t) {
  const pane = $('#pane');
  pane.querySelectorAll('[data-reset]').forEach(
    b =>
      (b.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        const k = b.dataset.reset;
        setParam(k, lvlDefault(k), false);
        renderAllPanes();
      })
  );
  pane.querySelectorAll('.seg[data-k]').forEach(sg =>
    sg.querySelectorAll('button').forEach(
      b =>
        (b.onclick = () => {
          setParam(sg.dataset.k, b.dataset.v);
          renderAllPanes();
        })
    )
  );
  pane.querySelectorAll('input[type=checkbox][data-k]').forEach(
    cb =>
      (cb.onchange = () => {
        setParam(cb.dataset.k, cb.checked);
        renderAllPanes();
      })
  );
  pane.querySelectorAll('input[type=range][data-k]').forEach(rg => {
    const f = Object.values(SCHEMA)
      .flat()
      .find(x => x.k === rg.dataset.k);
    rg.oninput = () => {
      $('#o-' + f.k).textContent = fmtVal(f, rg.value);
      setParam(f.k, +rg.value, true);
      pane.querySelectorAll('[data-info]').forEach(el => {
        el.innerHTML = el.dataset.last = infoFns[+el.dataset.info](); // the lines carry markup (buttons, line breaks)
      });
    };
    rg.onchange = () => setParam(f.k, +rg.value, false);
  });
  pane.querySelectorAll('[data-beacon]').forEach(
    b =>
      (b.onclick = () => {
        const v = b.dataset.beacon;
        if (v === 'all') setParam('bOff', '', false);
        else if (v === 'none') setParam('bOff', S.beacons.map(x => x.id).join(','), false);
        else toggleBeacon(+v);
        renderAllPanes();
      })
  );
  pane.querySelectorAll('input[data-sensor]').forEach(
    cb =>
      (cb.onchange = () => {
        setSensor(cb.dataset.sensor, cb.checked, false);
        renderAllPanes();
      })
  );
  pane.querySelectorAll('[data-act]').forEach(b => (b.onclick = () => btnActs[+b.dataset.act]()));
  const bs = $('#bsens');
  if (bs)
    bs.ontoggle = () => {
      bsOpen = bs.open;
      bsKey = '';
      renderBeaconSensor();
    };
  pane.querySelectorAll('details[data-how]').forEach(
    d =>
      (d.ontoggle = () => {
        howOpen[d.dataset.how] = d.open;
      })
  );
  pane.querySelectorAll('[data-sym]').forEach(b => (b.onclick = () => showSym(b.dataset.sym)));
  pane.querySelectorAll('[data-source]').forEach(b => (b.onclick = () => showSource(b.dataset.source)));
  if (t === 'code') wireCode();
  if (t === 'exp') wireExp(pane);
  if (t === 'train') wireTrain(pane);
  if (t === 'saf') wireSaf(pane);
  if (t === 'sym') wireSym(pane);
  if (t === 'view') {
    const g = $('#ghost-clear');
    if (g) g.onclick = () => forgetGhost();
  }
  if (t === 'view') {
    pane.querySelectorAll('input[data-layer]').forEach(
      cb =>
        (cb.onchange = () => {
          LAYERS[cb.dataset.layer] = cb.checked;
          renderGhostChip();
          const fresh = !layersEdited;
          layersEdited = true;
          if (fresh) renderAllPanes();
          draw();
        })
    );
    const au = $('#layers-auto');
    if (au)
      au.onclick = () => {
        layersEdited = false;
        layersKey = '';
        renderAllPanes();
      };
  }
}
let replanDebounce = null;

// Nomenclature, IEEE style: symbol — definition [unit], grouped by subsystem
const I = s => `<i>${s}</i>`;
// The Sensors switches (Sensors tab): one per registered modality (SENSORS in core/sensors.js), each with what it gives
function sensorsHTML() {
  const rows = SENSORS.map(s => {
    const on = sensorOn(s),
      av = !s.avail || s.avail(),
      d = s.val ? (lvlDefault(s.flag) === 'all' ? false : true) : lvlDefault(s.flag),
      chg = d !== undefined && on !== !!d,
      rst = chg ? `<button class="rst" data-reset="${s.flag}" title="Back to this level's default (${d ? 'on' : 'off'})">↺</button>` : '';
    return `<div class="sens-row${av ? '' : ' na'}"><label class="check${chg ? ' chg' : ''}"><input type="checkbox" data-sensor="${s.key}" ${on ? 'checked' : ''} ${av ? '' : 'disabled'}><span><b>${esc(s.label)}</b>${rst}</span></label><p class="note">${esc(s.gives)}${av ? '' : ' This level has none.'}</p></div>`;
  }).join('');
  return `<h3 class="fhead" id="sens-head">Switches</h3><div class="sens-sw">${rows}</div>`;
}
Object.assign(TIPS, {
  odom: 'Wheel encoders. Off: the filters predict with the commanded velocity instead of a measured one.',
  lidar: 'The 360° lidar. Off: no mapping, scan matching, people detection, lidar safety stop or lidar layers.',
  gnss: 'GNSS position fixes: white noise, a wandering bias, multipath near large shapes, outages.',
  gnssHz: 'Fixes per second.',
  gnssSig: 'White noise per fix, each axis: new at every fix.',
  gnssBias: 'Spread of the slowly wandering bias (first-order Gauss–Markov), each axis.',
  gnssTau: 'How long the bias takes to forget itself: correlated over about this many seconds.',
  gnssMp: 'Within 1.5 m of a wall or a parked car the fix jumps 2 to 4 m and gets noisier; the reported σ does not change.',
  gnssOut: 'Share of the time the receiver has no fix.',
  gnssOutLen: 'Average length of one GNSS outage.',
  gnssAug: 'The EKF estimates the GNSS bias as two more states (a random walk), so correlated error is modelled instead of averaged.'
});
