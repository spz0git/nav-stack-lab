/* ============================================================
   Tools → Safety → Safety argument (phase 4b; safety lesson 9). The argument of core/argument.js drawn in Goal
   Structuring Notation (goals as boxes, strategies as parallelograms, solutions as ellipses, context as rounded boxes,
   assumptions and justifications as ellipses marked A and J), each node coloured by its evidence once checked; a node
   picked on the graph can be edited, given a child, or removed; "Check the evidence" reruns every solution in the
   background workers, with the changes typed under it added to every run, and runs that two solutions share are run
   once. Arguments, ODD sheets and scenario sets are kept in this browser (IndexedDB, store 'safety', beside the custom
   levels and models), saved and loaded as JSON, and an argument travels in a link (#arg= deflated, or #argj= plain).
   ============================================================ */
const ARG = {
  list: [JSON.parse(JSON.stringify(ARG_BUILTIN))],
  cur: 0,
  sel: 'G1',
  set: {}, // the changes added to every run of the evidence
  verdicts: {},
  running: false,
  done: 0,
  total: 0,
  msg: ''
};
const argNow = () => ARG.list[ARG.cur];
const ARG_W = 168, // a node's box
  ARG_SW = 128, // a context, assumption or justification
  ARG_GAP = 14,
  ARG_ROW = 30; // vertical space between rows, beyond the tallest node
// Words to lines of at most n characters, at most m lines
function argLines(t, n, m) {
  const out = [];
  let cur = '';
  for (const w of String(t).split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > n && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > m) {
    out.length = m;
    out[m - 1] = out[m - 1].replace(/.{0,2}$/, '…');
  }
  return out;
}
// The layout: each goal or strategy over its supporting children, its context to its right; returns {pos, w, h}
function argLayout(A) {
  const kids = id => A.nodes.filter(n => n.parent === id && !ARG_SIDE.includes(n.type)),
    sides = id => A.nodes.filter(n => n.parent === id && ARG_SIDE.includes(n.type)),
    lines = n => argLines(n.text, ARG_SIDE.includes(n.type) ? 20 : 26, 6),
    hOf = n => 22 + 13 * lines(n).length + (n.type === 'solution' ? 14 : 0),
    pos = {},
    width = {};
  const unit = n => ARG_W + sides(n.id).length * (ARG_SW + ARG_GAP);
  const wOf = n => {
    const K = kids(n.id);
    return (width[n.id] = Math.max(unit(n), K.reduce((a, k) => a + wOf(k), 0) + ARG_GAP * Math.max(0, K.length - 1)));
  };
  const top = A.nodes.find(n => !n.parent);
  const total = wOf(top),
    rowH = [];
  const depth = (n, d) => {
    rowH[d] = Math.max(rowH[d] || 0, hOf(n), ...sides(n.id).map(hOf));
    kids(n.id).forEach(k => depth(k, d + 1));
  };
  depth(top, 0);
  const rowY = rowH.map((_, d) => rowH.slice(0, d).reduce((a, h) => a + h + ARG_ROW, 0));
  const place = (n, x0, d) => {
    const w = width[n.id],
      u = unit(n),
      ux = x0 + (w - u) / 2;
    pos[n.id] = {x: ux, y: rowY[d], w: ARG_W, h: hOf(n), lines: lines(n)};
    sides(n.id).forEach(
      (s, i) => (pos[s.id] = {x: ux + ARG_W + ARG_GAP + i * (ARG_SW + ARG_GAP), y: rowY[d], w: ARG_SW, h: hOf(s), lines: lines(s)})
    );
    let x = x0 + (w - (kids(n.id).reduce((a, k) => a + width[k.id], 0) + ARG_GAP * Math.max(0, kids(n.id).length - 1))) / 2;
    for (const k of kids(n.id)) {
      place(k, x, d + 1);
      x += width[k.id] + ARG_GAP;
    }
  };
  place(top, 0, 0);
  return {pos, w: total, h: rowY[rowY.length - 1] + rowH[rowH.length - 1] + 4};
}
function argSVG() {
  const A = argNow(),
    {pos, w, h} = argLayout(A),
    st = argStatus(A, ARG.verdicts),
    col = s => (s === 'pass' ? 'var(--ok)' : s === 'fail' ? 'var(--bad)' : 'var(--line-2)');
  let edges = '',
    nodes = '';
  for (const n of A.nodes) {
    if (!n.parent) continue;
    const p = pos[n.parent],
      c = pos[n.id];
    if (ARG_SIDE.includes(n.type))
      edges += `<line x1="${p.x + p.w}" y1="${p.y + 14}" x2="${c.x}" y2="${c.y + 14}" class="arg-ctx" marker-end="url(#arg-open)"/>`;
    else {
      const x1 = p.x + p.w / 2,
        y1 = p.y + p.h,
        x2 = c.x + c.w / 2,
        y2 = c.y,
        my = (y1 + y2) / 2;
      edges += `<path d="M${x1} ${y1} V${my} H${x2} V${y2 - 1}" class="arg-sup" marker-end="url(#arg-solid)"/>`;
    }
  }
  for (const n of A.nodes) {
    const p = pos[n.id],
      s = st[n.id],
      v = ARG.verdicts[n.id],
      x = p.x,
      y = p.y,
      W = p.w,
      Hh = p.h,
      sel = n.id === ARG.sel ? ' sel' : '';
    let shape;
    if (n.type === 'goal') shape = `<rect x="${x}" y="${y}" width="${W}" height="${Hh}" rx="2"/>`;
    else if (n.type === 'strategy') shape = `<polygon points="${x + 12},${y} ${x + W},${y} ${x + W - 12},${y + Hh} ${x},${y + Hh}"/>`;
    else if (n.type === 'context') shape = `<rect x="${x}" y="${y}" width="${W}" height="${Hh}" rx="${Math.min(16, Hh / 2)}"/>`;
    else shape = `<ellipse cx="${x + W / 2}" cy="${y + Hh / 2}" rx="${W / 2}" ry="${Hh / 2 + 4}"/>`;
    const mark = n.type === 'assumption' ? 'A' : n.type === 'justification' ? 'J' : '',
      text = p.lines.map((l, i) => `<tspan x="${x + W / 2}" y="${y + 18 + 13 * i}">${esc(l)}</tspan>`).join(''),
      val =
        n.type === 'solution' && v
          ? `<text class="arg-val" x="${x + W / 2}" y="${y + 18 + 13 * p.lines.length + 2}">${esc(argValText(n.evidence, v))}</text>`
          : '';
    nodes += `<g class="arg-n ${n.type}${sel}" data-argnode="${esc(n.id)}" style="--st:${col(s)}" tabindex="0" role="button" aria-label="${esc(`${n.id}, ${n.type}: ${n.text}${s ? ', ' + (s === 'pass' ? 'supported' : 'not supported') : ''}`)}">${shape}<text class="arg-id" x="${x + 5}" y="${y + 11}">${esc(n.id)}</text>${mark ? `<text class="arg-id" x="${x + W - 12}" y="${y + Hh + 2}">${mark}</text>` : ''}<text class="arg-t">${text}</text>${val}</g>`;
  }
  return `<svg class="arg-svg" viewBox="-4 -4 ${w + 8} ${h + 12}" width="${w + 8}" height="${h + 12}" role="group" aria-label="The safety argument"><defs><marker id="arg-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" class="arg-hd"/></marker><marker id="arg-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" class="arg-ho"/></marker></defs>${edges}${nodes}</svg>`;
}
const argValText = (E, v) =>
  v.error
    ? 'a run failed'
    : `${E.metric} = ${v.value == null ? '—' : isFinite(v.value) ? +(+v.value).toFixed(2) : 'never'} (${E.op} ${E.value})`;
function argPaneHTML() {
  const A = argNow(),
    n = A.nodes.find(q => q.id === ARG.sel) || A.nodes[0],
    st = argStatus(A, ARG.verdicts),
    top = st[A.nodes.find(q => !q.parent).id],
    opts = ARG.list.map((a, i) => `<option value="${i}" ${i === ARG.cur ? 'selected' : ''}>${esc(a.name)}</option>`).join(''),
    typeOpts = (cur, allow) => allow.map(t => `<option ${t === cur ? 'selected' : ''}>${t}</option>`).join('');
  const childTypes =
    n.type === 'goal'
      ? ['strategy', 'goal', 'solution', 'context', 'assumption', 'justification']
      : n.type === 'strategy'
        ? ['goal', 'context', 'assumption', 'justification']
        : [];
  return `<h4 class="saf-h">Safety argument</h4>
  <p class="note">Claims, how they are broken down, and the evidence for each, in Goal Structuring Notation. Check the evidence to rerun every solution's runs; a failed solution turns its claims red all the way up. Type changes below to rerun the whole argument with them: one changed setting shows which claims it breaks.</p>
  <div class="exprow"><label>Argument <select id="arg-pick">${opts}</select></label><button class="linkbtn" id="arg-copy">Copy as a new argument</button></div>
  <div class="arg-wrap">${argSVG()}</div>
  <div class="controls"><button class="btn small" id="arg-wide">Open the graph full width</button><span class="lbl">Scroll sideways here, or open it over the page; pick a node to edit it.</span></div>
  <p class="note">${top === 'pass' ? '<b>The top claim is supported</b> by the evidence as it stands.' : top === 'fail' ? '<b class="bad">The top claim is not supported</b>: follow the red nodes down to the evidence that failed.' : 'Not checked yet.'}${ARG.msg ? ' ' + esc(ARG.msg) : ''}</p>
  <div class="exprow"><label class="arg-set">Changes for every run <input type="text" id="arg-set" spellcheck="false" value="${esc(JSON.stringify(ARG.set))}" aria-label="Settings added to every run, as JSON"></label></div>
  <div class="controls"><button class="btn primary" id="arg-run" ${ARG.running || SAF.running ? 'disabled' : ''}>Check the evidence</button><button class="btn" id="arg-cancel" ${ARG.running ? '' : 'hidden'}>Cancel</button><span class="lbl" id="arg-prog">${ARG.running ? `${ARG.done}/${ARG.total} runs` : ''}</span></div>
  <details class="how" open><summary>${esc(n.id)}: edit this node</summary><div class="how-body">
    <div class="exprow"><label>Type <select id="arg-type">${typeOpts(n.type, n.parent ? ARG_TYPES : ['goal'])}</select></label></div>
    <textarea id="arg-text" rows="2" aria-label="The node's text">${esc(n.text)}</textarea>
    ${n.type === 'solution' ? `<p class="lbl">Evidence: {kind: "runs", level, set, seeds, metric, op, value} or {kind: "search", sheet, set, budget, seed, imp, metric, op, value}; metrics ${Object.keys(ARG_METRICS).join(', ')}</p><textarea id="arg-ev" rows="3" spellcheck="false" aria-label="The evidence, as JSON">${esc(JSON.stringify(n.evidence || {}))}</textarea>` : ''}
    <div class="controls"><button class="btn small" id="arg-apply">Apply</button>${childTypes.length ? `<label>Add a <select id="arg-addtype">${typeOpts(childTypes[0], childTypes)}</select></label><button class="btn small" id="arg-add">under it</button>` : ''}${n.parent ? '<button class="btn small" id="arg-del">Remove it and what hangs from it</button>' : ''}</div>
  </div></details>
  <div class="controls"><button class="btn small" id="arg-save">Save JSON</button><button class="btn small" id="arg-link">Copy a link</button>${ARG.cur > 0 ? '<button class="btn small" id="arg-drop">Remove this argument</button>' : ''}<span class="lbl">${SAFDB.ok ? 'Kept in this browser' : ''}</span></div>
  <details class="how"><summary>Import an argument</summary><div class="how-body"><textarea id="arg-json" rows="3" spellcheck="false" aria-label="Argument JSON"></textarea><div class="controls"><button class="btn" id="arg-import">Import</button></div></div></details>`;
}
// Every solution's evidence in the workers; runs that two solutions share are run once
async function argCheck() {
  if (ARG.running || SAF.running) return;
  const A = argNow(),
    sols = A.nodes.filter(n => n.type === 'solution' && n.evidence),
    plan = sols.map(n => ({n, jobs: argJobs(n.evidence, ARG.set)})),
    key = j => JSON.stringify([j.level, j.set, j.seed, j.secs]),
    uniq = new Map();
  for (const p of plan) for (const j of p.jobs) if (!uniq.has(key(j))) uniq.set(key(j), j);
  const list = [...uniq.values()];
  Object.assign(ARG, {running: true, done: 0, total: list.length, verdicts: {}, msg: ''});
  SAF.cancel = false;
  safRefresh();
  const sums = await safRunJobs(
    list.map(j => ({level: j.level, set: j.set, seed: j.seed, secs: j.secs})),
    {},
    () => {
      ARG.done++;
      const el = $('#arg-prog');
      if (el) el.textContent = `${ARG.done}/${ARG.total} runs`;
    }
  );
  const byKey = new Map(list.map((j, i) => [key(j), sums[i]]));
  if (!SAF.cancel)
    for (const p of plan)
      ARG.verdicts[p.n.id] = argVerdict(
        p.n.evidence,
        p.jobs.map(j => byKey.get(key(j))),
        p.jobs
      );
  const st = argStatus(A, ARG.verdicts),
    top = st[A.nodes.find(q => !q.parent).id];
  ARG.running = false;
  ARG.msg = SAF.cancel ? 'Cancelled.' : `${list.length} runs${Object.keys(ARG.set).length ? ` with ${fmtOv(ARG.set)}` : ''}.`;
  if (!SAF.cancel)
    logE(
      `Safety argument: the top claim is ${top === 'pass' ? 'supported' : 'not supported'} (${ARG.msg})`,
      top === 'pass' ? 'ok' : 'warn'
    );
  safRefresh();
}
/* ---------- keeping arguments, sheets and sets in this browser, and links ---------- */
const SAFDB = {ok: false};
async function safDBput(kind, id, name, data) {
  SAFDB.ok = !!(await trnDBdo('put', {id: `${kind}:${id}`, kind, name, data, saved: Date.now()}, 'safety'));
}
const safDBdrop = (kind, id) => trnDBdo('delete', `${kind}:${id}`, 'safety');
async function safLoadSaved() {
  const all = await trnDBdo('all', null, 'safety');
  SAFDB.ok = !!all;
  for (const r of (all || []).sort((a, b) => a.saved - b.saved)) {
    if (r.kind === 'argument' && !argError(r.data) && !ARG.list.some(a => a.id === r.data.id)) ARG.list.push(r.data);
    else if (r.kind === 'set' && !SAF.sets.some(s => s.id === r.data.id)) SAF.sets.push(r.data);
    else if (r.kind === 'sheet' && !oddSheetError(r.data) && !SAF.saved.some(s => s.id === r.data.id)) SAF.saved.push(r.data);
  }
  if (all && all.length && activeTab === 'saf') renderAllPanes();
}
const argSave = A => {
  if (!A.id) A.id = 'a' + Date.now().toString(36);
  return safDBput('argument', A.id, A.name, A);
};
function argAdd(A) {
  const err = argError(A);
  if (err) throw new Error('the argument needs ' + err);
  A.id = 'a' + Date.now().toString(36);
  ARG.list.push(A);
  ARG.cur = ARG.list.length - 1;
  ARG.sel = A.nodes.find(n => !n.parent).id;
  ARG.verdicts = {};
  argSave(A);
}
// #arg=<deflated> or #argj=<plain base64url JSON>: the argument is added and Tools → Safety opens on it
async function argFromHash() {
  const m = /^#arg(j?)=([\w-]+)$/.exec(location.hash);
  if (!m) return false;
  try {
    const A = JSON.parse(m[1] ? b64uDecText(m[2]) : await inflateText(m[2]));
    argAdd({...A, name: plainText(A.name, 80) || 'An argument from a link'});
    activeTab = 'saf';
    consoleOpen = true;
    buildTabs();
    renderAllPanes();
    logE(`Opened the argument "${argNow().name}" from the link`, 'ok');
  } catch (e) {
    logE('Could not open the argument in the link: ' + e.message, 'warn');
  }
  return true;
}
window.addEventListener('hashchange', () => argFromHash());
// The graph over the page, at full width (a node picked there is picked here too)
function argWide() {
  let d = $('#argdlg');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'argdlg';
    d.className = 'srcdlg argdlg';
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      if (e.target === d) d.close();
    });
  }
  const st = argStatus(argNow(), ARG.verdicts),
    top = st[argNow().nodes.find(q => !q.parent).id];
  d.innerHTML = `<div class="srchead"><b>${esc(argNow().name)}</b><span class="lbl">${top === 'pass' ? 'supported' : top === 'fail' ? 'not supported' : 'not checked'}</span><button class="btn" id="argdlg-close">Close</button></div><div class="arg-wrap">${argSVG()}</div>`;
  $('#argdlg-close').onclick = () => d.close();
  d.querySelectorAll('[data-argnode]').forEach(
    g =>
      (g.onclick = () => {
        ARG.sel = g.dataset.argnode;
        d.close();
        safRefresh();
      })
  );
  if (!d.open) d.showModal();
}
function wireArg(pane) {
  const A = argNow(),
    n = A.nodes.find(q => q.id === ARG.sel) || A.nodes[0];
  pane.querySelectorAll('[data-argnode]').forEach(g => {
    const pick = () => {
      ARG.sel = g.dataset.argnode;
      safRefresh();
    };
    g.onclick = pick;
    g.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick());
  });
  const editable = () => {
    if (ARG.cur > 0) return A;
    // the built-in argument stays as it is: an edit makes a copy
    argAdd({...JSON.parse(JSON.stringify(A)), name: A.name.replace(/^ARG-1/, 'ARG-1 (edited)')});
    return argNow();
  };
  $('#arg-pick').onchange = e => {
    ARG.cur = +e.target.value;
    ARG.sel = argNow().nodes.find(q => !q.parent).id;
    ARG.verdicts = {};
    safRefresh();
  };
  $('#arg-copy').onclick = () => {
    argAdd({...JSON.parse(JSON.stringify(A)), name: `${A.name} (copy)`});
    safRefresh();
  };
  $('#arg-set').onchange = e => {
    try {
      const v = JSON.parse(e.target.value || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('settings as {"key": value}');
      ARG.set = v;
      ARG.msg = '';
    } catch (er) {
      ARG.msg = 'The changes need JSON: ' + er.message;
    }
    safRefresh();
  };
  $('#arg-run').onclick = () => argCheck();
  $('#arg-wide').onclick = () => argWide();
  $('#arg-cancel').onclick = () => (SAF.cancel = true);
  $('#arg-apply').onclick = () => {
    const B = editable(),
      m = B.nodes.find(q => q.id === n.id);
    m.text = plainText($('#arg-text').value, 300) || m.text;
    m.type = $('#arg-type').value;
    if (m.type === 'solution') {
      try {
        const ev = $('#arg-ev') ? JSON.parse($('#arg-ev').value || '{}') : null;
        if (ev && Object.keys(ev).length) m.evidence = ev;
      } catch (er) {
        ARG.msg = 'The evidence needs JSON: ' + er.message;
      }
    } else delete m.evidence;
    m.rel = ARG_SIDE.includes(m.type) ? 'context' : 'support';
    const err = argError(B);
    ARG.msg = err ? 'The argument needs ' + err : ARG.msg;
    ARG.verdicts = {};
    argSave(B);
    safRefresh();
  };
  const add = $('#arg-add');
  if (add)
    add.onclick = () => {
      const B = editable(),
        t = $('#arg-addtype').value,
        pre = {goal: 'G', strategy: 'S', solution: 'E', context: 'C', assumption: 'A', justification: 'J'}[t];
      let k = 1;
      while (B.nodes.some(q => q.id === pre + k)) k++;
      const node = {id: pre + k, type: t, parent: n.id, rel: ARG_SIDE.includes(t) ? 'context' : 'support', text: `A new ${t}`};
      if (t === 'solution') node.evidence = {kind: 'runs', level: 4, set: {}, seeds: [7], metric: 'contacts', op: '<=', value: 0};
      B.nodes.push(node);
      ARG.sel = node.id;
      ARG.verdicts = {};
      argSave(B);
      safRefresh();
    };
  const del = $('#arg-del');
  if (del)
    del.onclick = () => {
      const B = editable(),
        gone = new Set([n.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const q of B.nodes)
          if (q.parent && gone.has(q.parent) && !gone.has(q.id)) {
            gone.add(q.id);
            grew = true;
          }
      }
      B.nodes = B.nodes.filter(q => !gone.has(q.id));
      ARG.sel = n.parent;
      ARG.verdicts = {};
      argSave(B);
      safRefresh();
    };
  $('#arg-save').onclick = () =>
    download(
      `nav-lab-argument-${A.name.split(',')[0].replace(/\W+/g, '-').toLowerCase()}.json`,
      JSON.stringify(A, null, 1),
      'application/json'
    );
  $('#arg-link').onclick = async () => {
    const js = JSON.stringify({...A, id: undefined}),
      z = await deflateText(js),
      u = location.href.split('#')[0] + (z ? '#arg=' + z : '#argj=' + b64uText(js));
    if (navigator.clipboard)
      navigator.clipboard.writeText(u).then(
        () => toast('Link to the argument copied'),
        () => toast(u)
      );
    else toast(u);
  };
  const drop = $('#arg-drop');
  if (drop)
    drop.onclick = () => {
      safDBdrop('argument', A.id);
      ARG.list.splice(ARG.cur, 1);
      ARG.cur = 0;
      ARG.sel = 'G1';
      ARG.verdicts = {};
      safRefresh();
    };
  $('#arg-import').onclick = () => {
    try {
      const j = JSON.parse($('#arg-json').value);
      argAdd({...j, name: plainText(j.name, 80) || 'Imported argument'});
      ARG.msg = 'Imported.';
    } catch (e) {
      ARG.msg = 'Could not import: ' + e.message;
    }
    safRefresh();
  };
}
