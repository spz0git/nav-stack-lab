let symQuery = '',
  symGroup = '';
function symPane() {
  return (
    `<p class="note">Notation follows the usual IEEE style. Some letters are reused between subsystems, as in the literature (for example ${I('g')}, ${I('H')}, ${I('S')}, ${I('J')}, ${I('k')}, α and ${I('s')}). The group heading tells you which meaning applies. SI units; angles in radians unless a panel shows degrees.</p>
  <input class="symsearch" id="symq" type="search" placeholder="Search symbols and definitions…" value="${esc(symQuery)}" aria-label="Search symbols">
  <div class="symchips"><button data-g="" aria-pressed="${symGroup === ''}">All</button>${NOMEN.map(g => `<button data-g="${g.id}" aria-pressed="${symGroup === g.id}">${g.title}</button>`).join('')}</div>` +
    NOMEN.map(
      g =>
        `<section class="nom" id="sym-${g.id}"><h3>${g.title}</h3><dl>${g.rows.map(([sy, d, u]) => `<dt>${sy}</dt><dd>${d}${u ? ` <span class="unit">[${u}]</span>` : ''}</dd>`).join('')}</dl></section>`
    ).join('')
  );
}
function symFilter() {
  const q = symQuery.trim().toLowerCase();
  document.querySelectorAll('#pane .nom').forEach(sec => {
    const gid = sec.id.slice(4);
    let any = false;
    const dts = sec.querySelectorAll('dt');
    dts.forEach(dt => {
      const dd = dt.nextElementSibling,
        txt = (dt.textContent + ' ' + dd.textContent).toLowerCase(),
        show = (!symGroup || symGroup === gid) && (!q || txt.includes(q));
      dt.classList.toggle('hidden', !show);
      dd.classList.toggle('hidden', !show);
      if (show) any = true;
    });
    sec.classList.toggle('hidden', !any);
  });
}
function wireSym(pane) {
  const q = $('#symq');
  if (q) {
    q.oninput = () => {
      symQuery = q.value;
      symFilter();
    };
  }
  pane.querySelectorAll('.symchips button').forEach(
    b =>
      (b.onclick = () => {
        symGroup = b.dataset.g;
        pane.querySelectorAll('.symchips button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        symFilter();
      })
  );
  symFilter();
}
// Each pipeline tab has a default layer set; changing tab, level or agent mode applies it, until the user edits Layers this session.
// The lookahead point is a UI-only layer (core's LAYERS has no key for it).
if (!('look' in LAYERS)) LAYERS.look = true;
if (!('slip' in LAYERS)) LAYERS.slip = true; // the sideslip arrow of the car with tyre slip, also UI-only
const TAB_LAYERS = {
  loc: ['belief', 'beam', 'gnss', 'trail', 'ghost', 'ghostrun', 'slip', 'graph', 'sonar'],
  per: ['lidar', 'cost', 'ghost', 'ghostrun', 'slip', 'frontier', 'sonar'],
  mis: ['ghostrun', 'slip', 'frontier', 'lidar'],
  plan: ['search', 'ghostrun', 'slip', 'frontier'],
  ctl: ['dwa', 'look', 'trail', 'ghostrun', 'slip', 'vo', 'agents', 'sonar']
};
let layersEdited = false,
  layersKey = '';
function applyTabLayers(force) {
  const set = TAB_LAYERS[activeTab];
  if (!layersEdited && radarOn()) LAYERS.radar = true; // turning the radar on shows it, in a lesson too
  if (!set || layersEdited || lessonOpen) return;
  const key = activeTab + '|' + LV.id + '|' + agOn() + '|' + radarOn();
  if (key === layersKey && !force) return;
  layersKey = key;
  const on = new Set(set);
  if (agOn()) on.add('agents');
  for (const [k, v] of Object.entries(LV.layers || {})) if (v) on.add(k); // a level's own layers (L2's costmap) stay
  on.add('sweep'); // an experiment's runs show whatever tab is open
  if (radarOn()) on.add('radar'); // the radar, when on, on every tab
  for (const k of Object.keys(LAYERS)) LAYERS[k] = on.has(k);
  if (S && AN.mode === 'sim') draw();
}
function layersPane() {
  const L = [
    ['frontier', 'Frontiers: known free cells next to unknown space, while exploring'],
    ['graph', 'Pose graph: keyframes and edges, loop closures in the accent colour'],
    ['vo', 'Velocity obstacles: the cones, the command and the chosen velocity'],
    ['sweep', 'Experiment runs: the paths of the last experiment, coloured by the varied value'],
    ['ghost', 'True-map outline over the built map'],
    ['cost', 'Costmap inflation'],
    ['search', 'Planner search (A* closed set / RRT* tree)'],
    ['lidar', 'Lidar hits (as perceived)'],
    ['radar', 'Radar: field of view and detections with their radial velocity'],
    ['beam', 'Beacon measurements (from the estimate)'],
    ['gnss', 'GNSS fixes: fused (dots), gated (crosses), not fused (hollow); the newest with its reported 2σ'],
    ['belief', 'Particles / 95% covariance ellipse'],
    ['trail', 'Trails (solid = truth, dashed = estimate)'],
    ['dwa', 'Local planner: DWA rollouts, MPC prediction and reference'],
    ['look', 'Lookahead point of the path tracker'],
    ['slip', 'Sideslip of the car with tyre slip: velocity at the centre of mass against the heading'],
    ['agents', "Agent tracks, predictions, and the ego's predicted positions at the same times"],
    ['ghostrun', 'Previous run on this level: ghost trail on the map and ghost series in the plot']
  ];
  return (
    `<p class="note">What to draw on the map. Nothing here changes the simulation. ${layersEdited ? `You have edited the layers, so tabs no longer change them. <button class="linkbtn" id="layers-auto" type="button">Let each tab choose again</button>` : 'Each pipeline tab (1–5) shows its own set; ticking a box here keeps your choice for this session.'}</p>` +
    L.map(
      ([k, l]) =>
        `<label class="check"><input type="checkbox" id="layer-${k}" data-layer="${k}" ${LAYERS[k] ? 'checked' : ''}><span>${l}</span></label>`
    ).join('') +
    (GHOST && GHOST.level === LV.id
      ? `<p class="note">Ghost: ${esc(GHOST.label)} (${GHOST.t.toFixed(0)} s). <button class="linkbtn" id="ghost-clear" type="button">Forget it</button></p>`
      : '')
  );
}
let codeSlot = 'ctl';
function codePane() {
  const sl = SLOTS[codeSlot],
    D = SLOT_DEFS[codeSlot];
  const blurb = {
    ctl: 'A path tracker: called every 50 ms while the robot drives a leg. It sees the estimated pose, odometry, the planned path, lidar points and the agent tracks, and returns speed and steering.',
    plan: 'A global planner: called when the mission needs a path. It gets the costmap grid, the start and the goal, and returns a path (or reverse legs for the car).',
    loc: 'A localizer: called every tick with odometry and the sensor readings of that tick, and returns the pose estimate the rest of the stack uses.',
    pred: "An agent predictor: called at 10 Hz with the confirmed tracks and returns each one's predicted trajectory, which the speed planner, DWA and MPC then avoid."
  }[codeSlot];
  return `<div class="field"><span class="lbl">Slot</span><div class="seg" id="codeslot">${Object.keys(SLOT_DEFS)
    .map(k => `<button data-v="${k}" aria-pressed="${k === codeSlot}">${SLOT_DEFS[k].name}${SLOTS[k].worker ? ' ●' : ''}</button>`)
    .join('')}</div></div>
  <p class="note">${blurb} It runs in a sandboxed Web Worker in lockstep with the simulation, with a ${D.timeout} ms budget per call: no access to the page or its state beyond what it is given, and no network except what the page's own origin would allow a worker.</p>
  <details class="codehow" id="codehow"${howOpen.code ? ' open' : ''}><summary>How this fits in</summary>${codeHowHTML(codeSlot)}</details>
  <div class="codewrap"><pre class="codehl" id="codehl" aria-hidden="true"></pre><textarea id="code" spellcheck="false" aria-label="${D.name} code">${esc(sl.code)}</textarea></div>
  <div class="controls codebar"><button class="btn primary" id="loadcode">Load and use</button><label class="lbl codeexl">Example <select class="sel" id="codeex" aria-label="Slot example">${(SLOT_LIBRARY[codeSlot] || []).map(e => `<option value="${e.id}"${e.code === sl.code ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}<option value=""${(SLOT_LIBRARY[codeSlot] || []).some(e => e.code === sl.code) ? '' : ' selected'}>edited</option></select></label><button class="btn" id="viewsrc" data-src="${codeSlot}">Built-in source</button><span class="lbl" id="codeinfo"></span></div>
  <p class="codestat ${sl.status.cls}" id="codestat">${esc(sl.status.msg)}</p>`;
}
// A small highlighter for the editor: comments, strings, numbers, keywords, and the obs/out property names the
// slot API uses; the line an error names (status "Line n: …") is tinted.
const CODE_KW =
  /\b(const|let|var|function|return|if|else|for|while|do|of|in|new|true|false|null|undefined|this|class|break|continue|switch|case|default|typeof|throw|try|catch|finally|Math)\b/g;
function codeHighlight(src, errLine, focus) {
  const esc2 = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/g;
  let out = '',
    i = 0,
    m;
  const plainTok = t =>
    esc2(t)
      .replace(CODE_KW, '<span class="k">$1</span>')
      .replace(/\b(obs|out|vehicle|path|scan|agents|limits|pose|odom|goal|grid|tracks)\b(?=\s*[.:])/g, '<span class="p">$1</span>');
  while ((m = re.exec(src))) {
    out += plainTok(src.slice(i, m.index));
    out += m[1]
      ? `<span class="c">${esc2(m[1])}</span>`
      : m[2]
        ? `<span class="s">${esc2(m[2])}</span>`
        : `<span class="n">${esc2(m[3])}</span>`;
    i = m.index + m[0].length;
  }
  out += plainTok(src.slice(i));
  if (errLine > 0 || (focus && focus.size)) {
    const L = out.split('\n');
    if (errLine > 0 && L[errLine - 1] != null) L[errLine - 1] = `<span class="errl">${L[errLine - 1] || ' '}</span>`;
    if (focus) for (const n of focus) if (L[n - 1] != null) L[n - 1] = `<span class="focl">${L[n - 1] || ' '}</span>`;
    out = L.join('\n');
  }
  return out + '\n';
}
function codeSync() {
  const ta = $('#code'),
    hl = $('#codehl');
  if (!ta || !hl) return;
  const st = SLOTS[codeSlot].status,
    m = st.cls === 'err' && /^Line (\d+)/.exec(st.msg || '');
  hl.innerHTML = codeHighlight(ta.value, m ? +m[1] : 0);
  hl.scrollTop = ta.scrollTop;
  hl.scrollLeft = ta.scrollLeft;
  hl.style.height = ta.offsetHeight + 'px';
  const info = $('#codeinfo');
  if (info) info.textContent = `${ta.value.split('\n').length} lines`;
}
function setCodeStatus(msg, cls) {
  slotStatus(codeSlot, msg, cls);
}
UI.slotStatus = (k, msg, cls) => {
  if (k !== codeSlot) return;
  const el = $('#codestat');
  if (el) {
    el.textContent = msg;
    el.className = 'codestat ' + cls;
  }
  codeSync();
};
function wireCode() {
  const ta = $('#code');
  if (!ta) return;
  ta.oninput = () => {
    SLOTS[codeSlot].code = ta.value;
    codeSync();
  };
  ta.onscroll = () => {
    const hl = $('#codehl');
    if (hl) {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    }
  };
  ta.onkeydown = e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('  ', s, ta.selectionEnd, 'end');
      SLOTS[codeSlot].code = ta.value;
      codeSync();
    }
  };
  codeSync();
  if (typeof ResizeObserver !== 'undefined')
    new ResizeObserver(() => {
      const hl = $('#codehl');
      if (hl) hl.style.height = ta.offsetHeight + 'px';
    }).observe(ta);
  $('#codeslot')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          codeSlot = b.dataset.v;
          renderAllPanes();
        })
    );
  $('#loadcode').onclick = () => {
    if (slotLoad(codeSlot, ta.value)) {
      logE(`Loaded your ${SLOT_DEFS[codeSlot].name.toLowerCase()} code`);
      renderAllPanes();
      refreshAll();
    }
  };
  $('#codeex').onchange = e => {
    const ex = slotExample(codeSlot, e.target.value);
    if (!ex.code) return;
    SLOTS[codeSlot].code = ex.code;
    ta.value = ex.code;
    codeSync();
  };
  const how = $('#codehow');
  if (how) how.ontoggle = () => (howOpen.code = how.open);
  $('#viewsrc').onclick = () =>
    showSource({ctl: 'core/controllers.js', plan: 'core/planning.js', loc: 'core/localization.js', pred: 'core/agents.js'}[codeSlot]);
}

// Where a slot sits in the tick, what it gets and returns, and what happens when it fails: the Code tab's
// "How this fits in" panel. The slot's chip is lit in the pipeline strip.
const CODE_HOW = {
  loc: {
    when: 'every 50 ms tick, right after the sensors deliver and before the mission, the planner and the controller read the estimate',
    gets: 'obs.odom (v, ω), obs.beacons (range and bearing per beacon seen, or null), obs.map, obs.scan, obs.gnss (a GNSS fix {x, y, sigma} when one arrived, or null), obs.sonar (with the ultrasonic ring on: the readings that arrived, each with the bearing, width and mount of its sonar in the body frame; null otherwise), obs.init on the first call, obs.dt; mem, an object that survives between calls',
    returns: '{x, y, th}, and cov (3×3, nine numbers) for the ellipse: the pose the whole stack uses from then on',
    fails:
      'an error, or a call over 200 ms, stops the slot: the status line names the line, the estimate stays where it was until Load and use again'
  },
  plan: {
    when: 'when the mission needs a path: at the start, after a replan trigger (path blocked, off path, stuck, periodic, agent blocking), after a skipped goal',
    gets: 'obs.start and obs.goal (poses), obs.grid, obs.lethal and obs.dist (the costmap as the planners see it), obs.vehicle',
    returns: '{path: [[x, y], …]}, or {segs} with reverse legs for the car, or {error}',
    fails:
      'an error, a call over 3 s, or a path with fewer than two points counts as a failed plan: NO_PATH, retried after 2 s, the goal skipped after three failures'
  },
  ctl: {
    when: 'every 50 ms while the robot drives a leg (state DRIVE); the lidar safety stop and the speed planner act on what it returns',
    gets: 'obs.pose (the estimate, not the truth), obs.odom, obs.path (the leg, resampled every 0.1 m), obs.goal, obs.scan, obs.agents, obs.limits, obs.dir, obs.vehicle',
    returns: '{v, w} for the unicycle or {v, steer} for the car, and mark to draw a point',
    fails:
      'an error, or a call over 200 ms, stops the robot (v = 0) until Load and use again; the lidar safety stop (Control → guard), when on, caps the speed of your code as it does the trackers'
  },
  pred: {
    when: 'at 10 Hz with the confirmed tracks, before the speed planner, DWA and MPC plan around them',
    gets: "obs.tracks (position, velocity, radius, age), obs.radar (this scan's radar detections, when the radar is on: range r, bearing b, radial velocity v, and x, y placed from the pose estimate), obs.horizon, obs.dt, obs.lethal and obs.grid; obs.sonar with the ultrasonic ring on (each sonar's latest arc on the map, and its age)",
    returns: '{trajectories: {id: [[x, y, r], …]}}, one sample per step out to the horizon',
    fails: 'an error, or a call over 200 ms, leaves the planners without predictions: they see nobody coming'
  }
};
function codeHowHTML(k) {
  const H = CODE_HOW[k],
    D = SLOT_DEFS[k],
    tab = {loc: 'Localize', plan: 'Plan', ctl: 'Control', pred: 'Perceive'}[k];
  const strip = [
    ['sens', 'sensors'],
    ['loc', 'localizer'],
    ['mis', 'mission'],
    ['plan', 'planner'],
    ['pred', 'predictor'],
    ['ctl', 'controller'],
    ['veh', 'vehicle']
  ]
    .map(([id, n]) => `<span class="chip${id === k ? ' on' : ''}">${n}</span>`)
    .join('<span class="arr">→</span>');
  return `<div class="codestrip">${strip}</div><dl class="codedl"><dt>Called</dt><dd>${H.when}.</dd><dt>Gets</dt><dd>${H.gets}.</dd><dt>Returns</dt><dd>${H.returns}.</dd><dt>If it fails</dt><dd>${H.fails}.</dd><dt>Load and use</dt><dd>compiles the editor into a fresh Web Worker (${D.timeout} ms per call) and switches ${tab} → ${D.name.toLowerCase()} to Your code; pick the built-in there to go back. Every lesson's "The code" block has Edit and run, which fills this editor with the matching example on the lesson's level.</dd></dl>`;
}
// "Your code" info lines in the pipeline tabs carry a button into the Code tab (schema.js); the example loads as is
document.addEventListener('click', e => {
  const b = e.target && e.target.closest ? e.target.closest('[data-code]') : null;
  if (b) codeOpen(b.dataset.code, null);
});
// and some carry a button that sets one setting (Perceive: "Turn on lidar tracking")
document.addEventListener('click', e => {
  const b = e.target && e.target.closest ? e.target.closest('[data-setp]') : null;
  if (!b) return;
  const [k, v] = b.dataset.setp.split(':');
  setParam(k, v);
  renderAllPanes();
});
