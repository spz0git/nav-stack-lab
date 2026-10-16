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
  loc: ['belief', 'beam', 'trail', 'ghost', 'ghostrun', 'slip'],
  per: ['lidar', 'cost', 'ghost', 'ghostrun', 'slip', 'frontier'],
  mis: ['ghostrun', 'slip', 'frontier', 'lidar'],
  plan: ['search', 'ghostrun', 'slip', 'frontier'],
  ctl: ['dwa', 'look', 'trail', 'ghostrun', 'slip']
};
let layersEdited = false,
  layersKey = '';
function applyTabLayers(force) {
  const set = TAB_LAYERS[activeTab];
  if (!set || layersEdited || lessonOpen) return;
  const key = activeTab + '|' + LV.id + '|' + agOn();
  if (key === layersKey && !force) return;
  layersKey = key;
  const on = new Set(set);
  if (agOn()) on.add('agents');
  for (const [k, v] of Object.entries(LV.layers || {})) if (v) on.add(k); // a level's own layers (L2's costmap) stay
  on.add('sweep'); // an experiment's runs show whatever tab is open
  for (const k of Object.keys(LAYERS)) LAYERS[k] = on.has(k);
  if (S && AN.mode === 'sim') draw();
}
function layersPane() {
  const L = [
    ['frontier', 'Frontiers: known free cells next to unknown space, while exploring'],
    ['sweep', 'Experiment runs: the paths of the last experiment, coloured by the varied value'],
    ['ghost', 'True-map outline over the built map'],
    ['cost', 'Costmap inflation'],
    ['search', 'Planner search (A* closed set / RRT* tree)'],
    ['lidar', 'Lidar hits (as perceived)'],
    ['beam', 'Beacon measurements (from the estimate)'],
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
  <div class="codewrap"><pre class="codehl" id="codehl" aria-hidden="true"></pre><textarea id="code" spellcheck="false" aria-label="${D.name} code">${esc(sl.code)}</textarea></div>
  <div class="controls codebar"><button class="btn primary" id="loadcode">Load and use</button><button class="btn" id="resetcode">Restore example</button><button class="btn" id="viewsrc" data-src="${codeSlot}">Built-in source</button><span class="lbl" id="codeinfo"></span></div>
  <p class="codestat ${sl.status.cls}" id="codestat">${esc(sl.status.msg)}</p>`;
}
// A small highlighter for the editor: comments, strings, numbers, keywords, and the obs/out property names the
// slot API uses; the line an error names (status "Line n: …") is tinted.
const CODE_KW =
  /\b(const|let|var|function|return|if|else|for|while|do|of|in|new|true|false|null|undefined|this|class|break|continue|switch|case|default|typeof|throw|try|catch|finally|Math)\b/g;
function codeHighlight(src, errLine) {
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
  if (errLine > 0) {
    const L = out.split('\n');
    if (L[errLine - 1] != null) {
      L[errLine - 1] = `<span class="errl">${L[errLine - 1] || ' '}</span>`;
      out = L.join('\n');
    }
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
  $('#resetcode').onclick = () => {
    const ex = codeSlot === 'ctl' ? DEFAULT_CODE : SLOT_EXAMPLES[codeSlot];
    SLOTS[codeSlot].code = ex;
    ta.value = ex;
    codeSync();
  };
  $('#viewsrc').onclick = () =>
    showSource({ctl: 'core/controllers.js', plan: 'core/planning.js', loc: 'core/localization.js', pred: 'core/agents.js'}[codeSlot]);
}
