/* ============================================================
   UI: the three modes (Simulate · Analyze · Learn) and the Learn column
   ============================================================ */
// uiMode is what the switch shows. The left side is AN.mode (map or loop analysis); in Learn it follows the lesson.
let uiMode = 'sim',
  lessonOpen = null,
  userLayers = null;
const MODES = [
  ['sim', 'Simulate', 'mode-sim'],
  ['an', 'Analyze', 'mode-an'],
  ['learn', 'Learn', 'tab-learn']
]; // Learn keeps the old tab's id
const MODE_HINT = {
  sim: 'Run the stack on the map; tune it in the tabs on the right',
  an: 'Linear analysis of the tracking loop: margins, Bode, Nyquist, poles',
  learn: 'Guided lessons: open one, read it, press its Try buttons'
};
function setUIMode(m) {
  if (m === 'learn') {
    if (uiMode === 'learn' && lessonOpen) lessonBack();
    if (uiMode === 'learn' && chapterOpen) chapterBack();
    uiMode = 'learn';
  } else {
    uiMode = m;
    setMode(m);
  }
  syncModeUI();
  hashSoon();
}
function syncModeUI() {
  $('#modesel')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === uiMode)));
  $('.layout').dataset.mode = uiMode;
  $('#learnview').hidden = uiMode !== 'learn';
  $('#modesel').title = MODE_HINT[uiMode];
  const lb = $('#bb-learn');
  if (lb) lb.textContent = uiMode === 'learn' ? 'Simulate' : 'Learn';
}
$('#modesel').innerHTML = MODES.map(
  ([v, l, id]) => `<button type="button" id="${id}" data-v="${v}" aria-pressed="${v === uiMode}">${l}</button>`
).join('');
$('#modesel')
  .querySelectorAll('button')
  .forEach(b => (b.onclick = () => setUIMode(b.dataset.v)));

// Map layers each lesson is about (Layers tab keys); opening a lesson shows only these, Back restores the user's set.
const LESSON_LAYERS = {
  loc: [
    ['belief', 'trail'],
    ['belief', 'beam', 'trail'],
    ['belief', 'beam', 'trail'],
    ['belief', 'beam', 'lidar'],
    ['belief', 'beam', 'trail'],
    ['belief', 'trail'],
    ['belief', 'lidar', 'trail'],
    ['belief', 'graph', 'trail']
  ],
  per: [
    ['lidar', 'ghost'],
    ['cost', 'lidar', 'ghost'],
    ['lidar', 'agents'],
    ['lidar', 'agents'],
    ['agents', 'lidar'],
    ['agents', 'vo', 'trail'],
    ['lidar', 'agents']
  ],
  plan: [
    ['search', 'cost'],
    ['search', 'cost'],
    ['search', 'cost', 'trail'],
    ['search', 'cost', 'trail'],
    ['search', 'agents'],
    ['frontier', 'lidar', 'trail'],
    ['search', 'cost', 'trail'],
    ['cost', 'lidar', 'trail']
  ],
  ctl: []
};
function lessonLayers(id) {
  const [g, i] = id.split(':');
  const L = (LESSON_LAYERS[g] || [])[+i] || ['trail', 'dwa', 'look'];
  return Object.fromEntries(Object.keys(LAYERS).map(k => [k, L.includes(k)]));
}
const lessonItem = id => {
  const [g, i] = id.split(':'),
    G = LESSON_GROUPS().find(x => x.id === g);
  return G && G.items[+i] ? {G, i: +i, L: G.items[+i]} : null;
};
// Opening a lesson also sets the stage up as its first experiment would, without running it: the simulator on
// the lesson's level with its settings, tab and plot (sim lessons), or the Analyze view (control lessons), so the
// left side shows what the text talks about before any button is pressed. Not when a lesson is restored (Back from
// a chapter) or when a Try button opens it, since the Try sets the stage itself.
function openLesson(id, opts) {
  const it = lessonItem(id);
  if (!it) return false;
  const fresh = lessonOpen !== id && !(opts && opts.restore);
  if (!userLayers) userLayers = {...LAYERS};
  lessonOpen = id;
  Object.assign(LAYERS, lessonLayers(id));
  if (!LEARN.seen[id]) {
    LEARN.seen[id] = 1;
    learnSave();
  }
  renderLearn();
  if (fresh) lessonStage(id);
  else draw();
  hashSoon();
  const v = $('#learnview');
  if (v.getBoundingClientRect().top < 0) v.scrollIntoView({block: 'start'});
  return true;
}
function lessonStage(id) {
  const it = lessonItem(id),
    t = it && it.L.tries[0],
    cfg = t && t[1];
  if (!cfg) return draw();
  if (cfg.sim) tryGo({...cfg, layers: {...lessonLayers(id), ...(cfg.layers || {})}, hold: true});
  else lessonGo({...cfg, test: undefined});
}
function lessonBack() {
  lessonOpen = null;
  if (userLayers) {
    Object.assign(LAYERS, userLayers);
    userLayers = null;
  }
  renderLearn();
  draw();
  if (activeTab === 'view') renderAllPanes();
  hashSoon();
}
function lessonLink(id) {
  const [g, i] = id.split(':');
  return location.href.split('#')[0] + `#lesson=${g}:${+i + 1}`;
}
// The open lesson's progress strip: the same circle as in the list, what fills it (each experiment, the self-check)
// and a reset. Pressing an experiment or passing the check updates it in place (lessonProgRefresh).
function lessonProgHTML(id) {
  const s = lessonState(id),
    it = lessonItem(id),
    tried = LEARN.tried[id] || [];
  if (!it) return '';
  const steps = it.L.tries
    .map(
      (t, j) =>
        `<span class="lp-step${tried.includes(j) ? ' ok' : ''}" title="${tried.includes(j) ? 'Run' : 'Not run yet'}: ${t[0].replace(/<[^>]+>/g, '').replace(/"/g, '&quot;')}">${tried.includes(j) ? '✓' : '○'} Experiment ${j + 1}</span>`
    )
    .concat(it.L.check ? [`<span class="lp-step${s.chk ? ' ok' : ''}">${s.chk ? '✓' : '○'} Check yourself</span>`] : [])
    .join('');
  return `<i class="ldot" data-st="${s.st}" aria-hidden="true"></i><span class="lp-txt">${s.st === 'done' ? 'Lesson done' : 'To complete this lesson:'}</span>${steps}<button type="button" class="linkbtn lp-reset" title="Clear this lesson's experiments, predictions and self-check in this browser, so its circle is empty again">Reset</button>`;
}
function wireLessonProg(v) {
  const b = v.querySelector('.lp-reset');
  if (b)
    b.onclick = () => {
      const id = lessonOpen;
      if (!id) return;
      learnReset(id); // back in the list it shows empty until it is opened again
      renderLearn();
    };
}
function lessonProgRefresh(id) {
  const v = $('#learnview'),
    d = v && v.querySelector(`details.lesson[data-l="${id}"]`);
  if (!d) return;
  const p = d.querySelector('.lprog');
  if (p) p.innerHTML = lessonProgHTML(id);
  wireLessonProg(v);
  const s = d.querySelector('summary');
  s.title = lessonStateText(id);
  s.querySelector('.ldot').dataset.st = lessonState(id).st;
  d.querySelectorAll('[data-try]').forEach(b =>
    b.classList.toggle('tried', (LEARN.tried[id] || []).includes(+b.dataset.try.split(':')[2]))
  );
}
// A lesson body: the text, its experiments, questions, then its terms. A try is [label, cfg] or, explained,
// [label, cfg, {setup, see, shows}]; explained tries render as numbered cards. L.q = [[question, answer], …].
function lessonBodyHTML(L, id) {
  const explained = L.tries.some(t => t[2]),
    btn = j =>
      `<button class="btn small${(LEARN.tried[id] || []).includes(j) ? ' tried' : ''}" data-try="${id}:${j}">\u0002${j}\u0002</button>`; // labels are restored after marking
  // Predict first: an experiment with a `predict` question hides "What you will see" until the learner has picked an
  // answer (or opens it); the pick is remembered in this browser. Without a question the text shows as before.
  const tries = explained
    ? `<h4 class="exph">Experiments</h4><ol class="experiments">` +
      L.tries
        .map((t, j) => {
          const x = t[2] || {},
            pr = x.predict,
            pk = `${id}:${j}`,
            ch = pr ? LEARN.pred[pk] : undefined;
          const shows = x.shows ? `<p><b>What it shows.</b> ${x.shows}</p>` : '',
            see = (x.see ? `<p><b>What you will see.</b> ${x.see}</p>` : '') + shows;
          return (
            `<li><div class="exp-head">${btn(j)}</div>` +
            (x.setup ? `<p><b>Setup.</b> ${x.setup}</p>` : '') +
            (pr
              ? `<div class="predict" data-pk="${pk}"><p><b>Before you press.</b> ${pr.q}</p><div class="pred-opts">${pr.opts.map((o, k) => `<button type="button" class="pred-opt${ch == null ? '' : k === pr.a ? ' ok' : k === ch ? ' no' : ''}" data-k="${k}" aria-pressed="${ch === k}">${o}</button>`).join('')}</div><p class="pred-res">${ch == null ? '' : predResText(pr, ch)}</p></div>` +
                `<details class="see"${ch != null ? ' open' : ''}><summary>What you will see</summary>${x.see ? `<p>${x.see}</p>` : ''}${shows}</details>`
              : see) +
            `</li>`
          );
        })
        .join('') +
      `</ol>`
    : `<div class="tries">${L.tries.map((t, j) => btn(j)).join('')}</div>`;
  const triesAndCode = tries + '\u0003'; // the code block is inserted after the glossary marking (it must not be marked)
  const code = lessonCodeHTML(L, id);
  const c = L.check,
    done = c && LEARN.check[id];
  const check = c
    ? `<h4 class="exph">Check yourself</h4><div class="selfcheck" data-ck="${id}"><p>${c.q}</p><div class="sc-row"><input type="text" inputmode="decimal" autocomplete="off" aria-label="Your answer"${done ? ` value="${c.a}"` : ''}>${c.unit ? `<span class="unit">${c.unit}</span>` : ''}<button type="button" class="btn small sc-go">Check</button></div><p class="sc-res${done ? ' ok' : ''}">${done ? `Right. ${c.how}` : ''}</p></div>`
    : '';
  const q =
    L.q && L.q.length
      ? `<h4 class="exph">Think about</h4><div class="questions">${L.q.map(([qq, a]) => `<details class="q"><summary>${qq}</summary><p>${a}</p></details>`).join('')}</div>`
      : '';
  return (
    glossMarkFor(L, L.b + triesAndCode + check + q)
      .replace(/\u0002(\d+)\u0002/g, (_, j) => L.tries[+j][0])
      .replace('\u0003', () => code) + glossTermsHTML(L)
  );
}
// The code behind a lesson (L.code from "## Code:" in its markdown): the marked snippet of the page's own source,
// read-only, the lesson's focus lines tinted, with "Edit and run" (the slot example into the Code tab, the matching
// parameter on "Your code", the lesson's level set up and paused) and the whole module in the source viewer.
function lessonCodeHTML(L, id) {
  const c = L.code,
    sn = c && lessonOpen === id && codeSnippet(c.snip); // only the open lesson's: every lesson body is in the DOM
  if (!sn) return '';
  const lines = sn.text.split('\n'),
    focus = new Set();
  for (const f of c.focus) {
    const a = lines.findIndex(l => l.includes(f[0]));
    if (a < 0) continue;
    const b = f[1] ? lines.findIndex((l, k) => k >= a && l.includes(f[1])) : a;
    for (let k = a; k <= (b < 0 ? a : b); k++) focus.add(k + 1);
  }
  const ex = c.ex ? slotExample(c.ex.split('/')[0], c.ex.split('/')[1]) : null,
    slot = c.ex ? SLOT_DEFS[c.ex.split('/')[0]] : null;
  return (
    `<h4 class="exph">The code</h4><div class="lcode"><div class="lcode-head"><span class="lcode-fn">${esc(c.t)}</span><span class="lbl">${sn.file} · lines ${sn.from}–${sn.to}</span></div>` +
    `<pre class="codehl lcode-pre" tabindex="0" aria-label="${esc(c.t)}">${codeHighlight(sn.text, 0, focus)}</pre>` +
    (c.note ? `<p class="note">${c.note}</p>` : '') +
    `<div class="tries">${ex && ex.code ? `<button class="btn small" data-ex="${c.ex}" data-exl="${id}" title="Open the Code tab with this example as your ${slot.name.toLowerCase()}, on this lesson's level">Edit and run: ${esc(ex.name)} as your ${slot.name.toLowerCase()}</button>` : ''}<button class="btn small" data-src="${sn.file}">Whole module</button></div></div>`
  );
}
// "Edit and run": the example into the editor and the worker, the parameter on "Your code", the lesson's level
// (its first simulator experiment, or the vehicle's level for an Analyze lesson) set up on the Code tab, paused.
function codeOpen(exId, lessonId) {
  const [k, eid] = exId.split('/'),
    ex = slotExample(k, eid),
    D = SLOT_DEFS[k];
  if (!ex.code) return;
  const it = lessonId && lessonItem(lessonId),
    t = it && it.L.tries.find(x => x[1].sim),
    cfg0 = t ? t[1] : it ? {sim: true, level: LV_DIFF} : {sim: true, keep: true}; // an Analyze lesson: the unicycle's level (the examples are written for it)
  SLOTS[k].code = ex.code;
  codeSlot = k;
  tryGo({
    ...cfg0,
    set: {...(cfg0.set || {}), [D.param]: 'custom'},
    tab: 'code',
    hold: true,
    layers: lessonId ? lessonLayers(lessonId) : undefined
  });
  if (uiMode === 'learn') setUIMode('sim'); // the console with the Code tab is the Simulate layout's; Learn brings the lesson back
  if (slotLoad(k, ex.code))
    logE(`Loaded the example "${ex.name}" as your ${D.name.toLowerCase()}: Run drives with it; edit, Load and use, Run again to compare`);
  renderAllPanes();
  refreshAll();
}
const predResText = (pr, k) =>
  k === pr.a
    ? `You predicted right: ${pr.opts[k]}. Press the button and watch for it.`
    : `You predicted "${pr.opts[k]}". The measurement says: ${pr.opts[pr.a]}. Press the button and see why.`;
// A prediction picked: mark the pick and the measured answer, say which, open "What you will see", remember it
function predPick(div, k) {
  const pk = div.dataset.pk,
    [g, i, j] = pk.split(':'),
    it = lessonItem(g + ':' + i),
    pr = it && it.L.tries[+j][2] && it.L.tries[+j][2].predict;
  if (!pr) return;
  LEARN.pred[pk] = k;
  learnSave();
  div.querySelectorAll('.pred-opt').forEach(b => {
    const kk = +b.dataset.k;
    b.setAttribute('aria-pressed', String(kk === k));
    b.classList.toggle('ok', kk === pr.a);
    b.classList.toggle('no', kk === k && k !== pr.a);
  });
  div.querySelector('.pred-res').textContent = predResText(pr, k);
  const d = div.nextElementSibling;
  if (d && d.classList.contains('see')) d.open = true;
}
// The numeric self-check: right within the tolerance, or the working after a second miss
const scTries = {};
function selfCheck(div) {
  const id = div.dataset.ck,
    it = lessonItem(id),
    c = it && it.L.check,
    inp = div.querySelector('input'),
    res = div.querySelector('.sc-res');
  if (!c) return;
  const x = parseFloat(
    String(inp.value)
      .replace(',', '.')
      .replace(/[^\d.eE+-]/g, '')
  );
  if (!isFinite(x)) {
    res.className = 'sc-res';
    res.textContent = 'Type a number.';
    return;
  }
  if (Math.abs(x - c.a) <= c.tol) {
    res.className = 'sc-res ok';
    res.textContent = `Right. ${c.how}`;
    LEARN.check[id] = true;
    learnSave();
    lessonProgRefresh(id);
    return;
  }
  scTries[id] = (scTries[id] || 0) + 1;
  res.className = 'sc-res no';
  res.textContent = scTries[id] < 2 ? 'Not quite. Check the units and try once more.' : `Not quite. ${c.how}`;
}
// Renders the Learn column: the list (Start here, progress, the groups, the chapters) or the open lesson, and wires every control.
function renderLearn() {
  const v = $('#learnview');
  v.classList.remove('chapter');
  if (chapterOpen) return renderChapter();
  const cur = lessonOpen && lessonItem(lessonOpen);
  const all = allLessonIds(),
    k = cur ? all.indexOf(lessonOpen) : -1,
    nextId = cur ? learnNextId(lessonOpen) : null;
  v.classList.toggle('reading', !!cur);
  v.innerHTML =
    `<div class="learn-head">${
      cur
        ? `<button class="btn small" id="learn-back" type="button" title="Back to the list; your map layers come back">← All lessons</button><span class="lbl" data-sys="${cur.G.id}">${cur.G.title} · ${cur.i + 1} of ${cur.G.items.length}</span>${nextId ? `<button class="linkbtn" id="learn-next" type="button" title="${onPath(lessonOpen) && onPath(nextId) ? 'The next lesson of the first pass' : 'The next lesson in the list'}">${onPath(lessonOpen) && onPath(nextId) ? 'Next in the first pass →' : 'Next lesson →'}</button>` : ''}<button class="linkbtn" id="learn-link" type="button" title="A link that opens this lesson">Copy link</button><span class="lbl" id="learn-msg"></span>`
        : `<h2>Lessons</h2>`
    }</div>` +
    (cur ? '' : startHereHTML() + progressHTML()) +
    LESSON_GROUPS()
      .map(
        G =>
          `<section class="lgroup${cur && cur.G.id === G.id ? ' cur' : ''}" data-sys="${G.id}"><h3>${G.title}</h3>${G.note ? `<p class="note">${G.note}</p>` : ''}` +
          G.items
            .map((L, i) => {
              const id = `${G.id}:${i}`;
              return `<details class="lesson" data-l="${id}" ${lessonOpen === id ? 'open' : ''}><summary title="${lessonStateText(id)}"><span class="lnum">${i + 1}</span><i class="ldot" data-st="${lessonState(id).st}" aria-hidden="true"></i>${L.t}<span class="sr-only">, ${lessonState(id).st === 'none' ? 'not started' : lessonState(id).st === 'done' ? 'done' : 'started'}</span><span class="lmin">${lessonMinutes(L)} min</span></summary><div class="how-body">${lessonOpen === id ? `<div class="lprog" role="status">${lessonProgHTML(id)}</div>` : ''}${lessonBodyHTML(L, id)}</div></details>`;
            })
            .join('') +
          `</section>`
      )
      .join('') +
    (cur ? '' : chaptersListHTML());
  wireStartHere(v);
  const rs = v.querySelector('#learn-reset');
  if (rs)
    rs.onclick = () => {
      if (!confirm('Clear the progress of every lesson in this browser (experiments run, predictions, self-checks)?')) return;
      learnReset(null);
      renderLearn();
    };
  wireLessonProg(v);
  v.querySelectorAll('.pred-opt').forEach(b => (b.onclick = () => predPick(b.closest('.predict'), +b.dataset.k)));
  v.querySelectorAll('.selfcheck').forEach(d => {
    d.querySelector('.sc-go').onclick = () => selfCheck(d);
    d.querySelector('input').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        selfCheck(d);
      }
    };
  });
  v.querySelectorAll('.chapter-open').forEach(b => (b.onclick = () => openChapter(b.dataset.ch)));
  v.querySelectorAll('[data-ex]').forEach(b => (b.onclick = () => codeOpen(b.dataset.ex, b.dataset.exl)));
  v.querySelectorAll('[data-src]').forEach(b => (b.onclick = () => showSource(b.dataset.src)));
  v.querySelectorAll('a.chref').forEach(
    a =>
      (a.onclick = e => {
        e.preventDefault();
        const m = /^#notes=([\w-]+)(?:\/([\w-]+))?$/.exec(a.getAttribute('href')); // "Derivation: chapter 2 §4" links in lessons
        if (!m) return;
        try {
          history.replaceState(null, '', a.getAttribute('href'));
        } catch (_) {}
        openChapter(m[1], m[2]);
      })
  );
  v.querySelectorAll('a.lsref').forEach(
    a =>
      (a.onclick = e => {
        e.preventDefault();
        const m = /^#lesson=(\w+):(\d+)$/.exec(a.getAttribute('href'));
        if (m) openLesson(`${m[1]}:${+m[2] - 1}`);
      })
  ); // links to another lesson
  v.querySelectorAll('details.lesson>summary').forEach(
    s =>
      (s.onclick = e => {
        e.preventDefault();
        const id = s.parentNode.dataset.l;
        if (lessonOpen === id) lessonBack();
        else openLesson(id);
      })
  );
  v.querySelectorAll('[data-try]').forEach(
    b =>
      (b.onclick = () => {
        const [g, i, j] = b.dataset.try.split(':'),
          id = g + ':' + i;
        if (lessonOpen !== id) openLesson(id, {restore: true});
        const cfg = lessonItem(id).L.tries[+j][1];
        learnTried(id, +j);
        lessonProgRefresh(id);
        if (cfg.sim) return tryGo({...cfg, layers: {...lessonLayers(id), ...(cfg.layers || {})}});
        lessonGo(cfg);
      })
  ); // loading the level must not undo the lesson's layers
  const bk = $('#learn-back');
  if (bk) bk.onclick = lessonBack;
  const nx = $('#learn-next');
  if (nx) nx.onclick = () => openLesson(nextId);
  const lk = $('#learn-link');
  if (lk)
    lk.onclick = () => {
      const u = lessonLink(lessonOpen),
        msg = $('#learn-msg');
      try {
        history.replaceState(null, '', '#' + u.split('#')[1]);
      } catch (_) {}
      if (navigator.clipboard)
        navigator.clipboard.writeText(u).then(
          () => {
            msg.textContent = 'Link copied.';
          },
          () => {
            msg.textContent = u;
          }
        );
      else msg.textContent = u;
    };
}
// #lesson=loc:3 opens Learn on that lesson (numbers as shown in the list)
function lessonFromHash() {
  const m = /^lesson=(\w+):(\d+)$/.exec(location.hash.slice(1));
  if (!m) return false;
  const id = `${m[1]}:${+m[2] - 1}`;
  if (!lessonItem(id)) return false;
  setUIMode('learn');
  return openLesson(id);
}
window.addEventListener('hashchange', lessonFromHash);
// Term pop-ups: hover (mouse), tap or keyboard focus on a dotted term shows its short definition
const termTip = document.createElement('div');
termTip.className = 'termtip';
termTip.id = 'termtip';
termTip.setAttribute('role', 'tooltip');
termTip.hidden = true;
document.body.appendChild(termTip);
let termAt = null;
function showTerm(el) {
  const id = el.dataset.g;
  if (!GLOSS[id]) return;
  if (termAt && termAt !== el) termAt.removeAttribute('aria-describedby');
  termAt = el;
  el.setAttribute('aria-describedby', 'termtip');
  termTip.innerHTML = `<b${glossWord(id) ? ' class="w"' : ''}>${GLOSS[id][0]}</b> ${glossDef(id)}`;
  termTip.hidden = false;
  const r = el.getBoundingClientRect(),
    w = termTip.offsetWidth,
    h = termTip.offsetHeight;
  termTip.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
  termTip.style.top = (r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
function hideTerm() {
  if (termAt) termAt.removeAttribute('aria-describedby');
  termAt = null;
  termTip.hidden = true;
}
{
  const v = $('#learnview'),
    term = e => e.target.closest && e.target.closest('.term');
  v.addEventListener('pointerover', e => {
    const t = term(e);
    if (t && e.pointerType === 'mouse') showTerm(t);
  });
  v.addEventListener('pointerout', e => {
    const t = term(e);
    if (t && e.pointerType === 'mouse' && !t.contains(e.relatedTarget)) hideTerm();
  });
  v.addEventListener('click', e => {
    const t = term(e);
    if (t) showTerm(t);
  });
  v.addEventListener('focusin', e => {
    const t = term(e);
    if (t) showTerm(t);
  });
  v.addEventListener('focusout', e => {
    if (term(e) === termAt) hideTerm();
  });
  document.addEventListener(
    'pointerdown',
    e => {
      if (termAt && !term(e)) hideTerm();
    },
    true
  );
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && termAt) hideTerm();
  });
  addEventListener(
    'scroll',
    () => {
      if (termAt) hideTerm();
    },
    true
  );
  addEventListener('resize', () => {
    if (termAt) hideTerm();
  });
}
