/* ============================================================
   URL state (Phase 2.3): the hash always says what the page shows. In Simulate and Analyze it is the setup link
   (#l=L3&seed=7&loc=ekf…, as Copy link writes it; a custom level is l=C with the level itself, lz= deflated or lj= plain
   JSON in base64url, a generated one l=G&gen=family:…,seed:…) plus mode=an in Analyze and t=<s> while a recorded moment is
   replayed; in Learn it is #learn, #lesson=… or #notes=… (learn.js, chapters.js). Written with replaceState, so the
   back button is untouched and a pasted link reproduces the setup; a link with t= runs the setup headless to that
   moment and shows it paused. Writes are debounced and skipped when nothing changed.
   ============================================================ */
let hashLast = null,
  hashTimer = null;
function hashNow() {
  let h;
  if (uiMode === 'learn')
    h = lessonOpen ? lessonLink(lessonOpen).split('#')[1] : chapterOpen ? chapterLink(chapterOpen, chapterSec).split('#')[1] : 'learn';
  else {
    h = configURL().split('#')[1];
    if (AN.mode === 'an') h += '&mode=an';
    else if (REPLAY.active) h += `&t=${shownT().toFixed(1)}`;
  }
  return h;
}
function hashSync() {
  if (!S || !LV) return;
  let h;
  try {
    h = hashNow();
  } catch (_) {
    return;
  }
  if (h === hashLast) return;
  hashLast = h;
  if (location.hash.slice(1) === h) return;
  try {
    history.replaceState(null, '', '#' + h);
  } catch (_) {}
}
function hashSoon() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(hashSync, 250);
}
// A pasted or edited setup link while the page is open: apply it (our own writes do not fire hashchange)
window.addEventListener('hashchange', async () => {
  const h = location.hash.slice(1);
  if (h === hashLast) return;
  if (h === 'learn') {
    setUIMode('learn');
    hashLast = h;
    return;
  }
  try {
    const c = await configResolve(configFromHash());
    if (!c) return;
    applyConfig(c);
    hashLast = h;
    if (c.mode === 'an') setMode('an');
    else if (c.t > 0) runToMoment(c.t);
  } catch (e) {
    logE('Could not apply the link: ' + e.message, 'warn');
  }
});
// t=<s>: run the setup headless to that moment, then show it paused as a replay
async function runToMoment(t) {
  const n = Math.round(clamp(t, 0, 300) / DT);
  if (!n) return;
  if ((S.fsm.state === 'IDLE' || S.fsm.state === 'DONE') && remaining().length) startMission();
  running = false;
  await advance(n);
  seekTime(t);
  logE(`Ran the setup to ${t.toFixed(1)} s from the link`, 'ok');
}
