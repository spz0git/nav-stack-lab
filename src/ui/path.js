/* ============================================================
   UI: the learning path. A "Start here" card at the top of the Learn column (who the lessons are for, what they
   assume, how lessons, chapters, levels and Symbols relate) and a recommended first pass through eight lessons.
   What the reader has opened is remembered in this browser (localStorage, guarded).
   ============================================================ */
const LEARN_KEY = 'nav-stack-lab.learn';
// start: the Start here card is unfolded; pred: predictions picked; check: self-checks passed; seen: lessons opened;
// tried: the experiments pressed per lesson
const LEARN = {start: true, pred: {}, check: {}, seen: {}, tried: {}};
try {
  const s = JSON.parse(localStorage.getItem(LEARN_KEY) || 'null');
  if (s && typeof s === 'object') Object.assign(LEARN, s);
} catch (_) {}
for (const k of ['pred', 'check', 'seen', 'tried']) if (!LEARN[k] || typeof LEARN[k] !== 'object') LEARN[k] = {};
// Progress: a lesson is started once opened, done once every experiment has been pressed and its self-check passed
function lessonState(id) {
  const it = lessonItem(id);
  if (!it) return {st: 'none'};
  const n = it.L.tries.length,
    tried = (LEARN.tried[id] || []).filter(j => j < n).length,
    chk = !it.L.check || !!LEARN.check[id];
  const done = n > 0 && tried >= n && chk,
    started = !!LEARN.seen[id] || tried > 0;
  return {st: done ? 'done' : started ? 'part' : 'none', n, tried, chk};
}
// What the circle in front of a lesson means, in words: its tooltip in the list and the strip in the open lesson
function lessonStateText(id) {
  const s = lessonState(id);
  if (s.st === 'none') return 'Not started: open the lesson to start it';
  const exp = `${s.tried} of ${s.n} experiment${s.n === 1 ? '' : 's'} run`,
    it = lessonItem(id),
    chk = it && it.L.check ? (s.chk ? 'Check yourself passed' : 'Check yourself not passed yet') : '';
  return `${s.st === 'done' ? 'Done' : 'Started'}: ${exp}${chk ? ', ' + chk : ''}`;
}
function learnTried(id, j) {
  const a = LEARN.tried[id] || (LEARN.tried[id] = []);
  if (!a.includes(j)) {
    a.push(j);
    learnSave();
  }
}
// Reset: one lesson back to not started (its experiments, its self-check, its predictions), or every lesson
function learnReset(id) {
  const keys = id ? [id] : null;
  for (const k of ['seen', 'tried', 'check']) {
    if (!keys) LEARN[k] = {};
    else delete LEARN[k][id];
  }
  for (const pk of Object.keys(LEARN.pred)) if (!keys || pk.startsWith(id + ':')) delete LEARN.pred[pk];
  learnSave();
}
const allLessonIds = () => LESSON_GROUPS().flatMap(G => G.items.map((_, i) => `${G.id}:${i}`));
// Next: along the first pass while the open lesson is on it, otherwise the next lesson in the list
function learnNextId(id) {
  const k = LEARN_PATH.findIndex(p => p[0] === id);
  if (k >= 0 && k < LEARN_PATH.length - 1) return LEARN_PATH[k + 1][0];
  const all = allLessonIds(),
    i = all.indexOf(id);
  return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
}
const onPath = id => LEARN_PATH.some(p => p[0] === id);
function progressHTML() {
  const groups = LESSON_GROUPS().map(G => {
    const ids = G.items.map((_, i) => `${G.id}:${i}`),
      st = ids.map(lessonState);
    return {G, n: ids.length, done: st.filter(x => x.st === 'done').length, part: st.filter(x => x.st === 'part').length};
  });
  const n = groups.reduce((a, g) => a + g.n, 0),
    done = groups.reduce((a, g) => a + g.done, 0),
    part = groups.reduce((a, g) => a + g.part, 0);
  const path = LEARN_PATH.filter(([id]) => lessonState(id).st === 'done').length;
  const key = `<p class="note pkey"><span><i class="ldot" data-st="none" aria-hidden="true"></i>not started</span><span><i class="ldot" data-st="part" aria-hidden="true"></i>started</span><span><i class="ldot" data-st="done" aria-hidden="true"></i>done</span> A lesson's circle fills once you have pressed each of its experiment buttons and passed its Check yourself.${done || part ? ' <button type="button" class="linkbtn" id="learn-reset" title="Clear every lesson\'s progress, predictions and self-checks in this browser">Reset all progress</button>' : ''}</p>`;
  if (!done && !part) return `<div class="progress" role="group" aria-label="Your progress">${key}</div>`;
  return (
    `<div class="progress" role="group" aria-label="Your progress"><p class="note">${done} of ${n} lessons done${part ? `, ${part} started` : ''} · first pass ${path} of ${LEARN_PATH.length}</p>${key}<div class="pbars">` +
    groups
      .map(
        g =>
          `<div class="pbar" data-sys="${g.G.id}" title="${g.G.title}: ${g.done} of ${g.n} done${g.part ? `, ${g.part} started` : ''}"><i style="width:${(100 * g.done) / g.n}%"></i><i class="part" style="width:${(100 * (g.done + g.part)) / g.n}%"></i></div>`
      )
      .join('') +
    `</div></div>`
  );
}
function learnSave() {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(LEARN));
  } catch (_) {}
}
// The first pass: concrete and visual first (the simulator), the linear analysis once the loop has been seen running.
const LEARN_PATH = [
  ['loc:0', 'what odometry alone does, and why the filter has to know it'],
  ['loc:1', 'how a beacon reading corrects the pose, and how to tell when a filter lies'],
  ['per:0', 'how lidar hits become a map'],
  ['per:1', 'how a map becomes a cost the planner can use'],
  ['plan:0', 'the planner everyone starts with, and what ε buys'],
  ['ctl:0', 'the steering loop as two integrators: the model behind every tracker'],
  ['ctl:1', 'pure pursuit has one knob, and this is what it turns'],
  ['ctl:2', 'how to read the Bode plot the Analyze view draws']
];
// Minutes to read a lesson's text (the experiments run for one to three minutes each on top)
function lessonMinutes(L) {
  const words = L.b
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(3, Math.round(words / 170));
}
function startHereHTML() {
  const steps = LEARN_PATH.map(([id, why], n) => {
    const it = lessonItem(id);
    if (!it) return '';
    const [g, i] = id.split(':');
    const st = lessonState(id).st;
    return `<li class="${st}"><a class="lsref" href="#lesson=${g}:${+i + 1}" data-sys="${g}">${it.L.t}</a> <span class="note">${why} · ${lessonMinutes(it.L)} min</span>${st === 'done' ? ' <span class="ldone" title="done">✓</span>' : ''}</li>`;
  }).join('');
  const mins = LEARN_PATH.reduce((a, [id]) => {
    const it = lessonItem(id);
    return a + (it ? lessonMinutes(it.L) : 0);
  }, 0);
  return `<details class="starthere" id="starthere" ${LEARN.start ? 'open' : ''}><summary><h3>Start here</h3></summary><div class="sh-body">
<p><b>Who this is for.</b> Students and engineers who want to see localization, perception, planning and control work together on one robot, change one thing, and watch what happens. The lessons assume vectors and matrices, a little probability (a Gaussian, a variance) and derivatives. The control lessons also use transfer functions and Bode plots; if those are new, chapter 6 builds them in order.</p>
<p><b>How the pieces fit.</b> A <b>lesson</b> is a short read with experiments: each button sets the lab up and runs it, and the numbers in the text were measured in this simulator. A <b>chapter</b> (the companion notes at the end of this list) derives the formulas a lesson uses; the <i>Derivation</i> links go there and Back returns. The <b>levels</b> L1 to L7 are the floors the robot drives on; each has quick one-click experiments in its own panel under Simulate. The <b>Symbols</b> tab under Reference lists every symbol with its meaning; dotted terms in a lesson show their definition on hover or tap.</p>
<p><b>A first pass, about ${mins} minutes of reading plus the experiments.</b> Eight lessons that visit every part of the stack once; then go deeper in whichever group interests you.</p>
<ol class="path">${steps}</ol>
<button class="btn small primary" type="button" id="path-start">${pathNextLabel()}</button></div></details>`;
}
// the first lesson of the pass not yet done
const pathNext = () => {
  const p = LEARN_PATH.find(([id]) => lessonState(id).st !== 'done');
  return p ? p[0] : null;
};
function pathNextLabel() {
  const id = pathNext();
  if (!id) return 'Start again from lesson 1';
  const k = LEARN_PATH.findIndex(p => p[0] === id);
  return k === 0 ? 'Start with lesson 1' : `Continue with lesson ${k + 1}`;
}
function wireStartHere(v) {
  const d = v.querySelector('#starthere');
  if (!d) return;
  d.ontoggle = () => {
    LEARN.start = d.open;
    learnSave();
  };
  const b = v.querySelector('#path-start');
  if (b) b.onclick = () => openLesson(pathNext() || LEARN_PATH[0][0]);
}
