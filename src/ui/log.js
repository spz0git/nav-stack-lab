/* ---------- event log rendering ---------- */
// Each line seeks the timeline to its time; while replaying, lines after the shown moment are dimmed and the log
// scrolls to the moment. A search box and a severity filter narrow the lines (matches are marked on the timeline),
// and the order can be flipped to oldest first (the log itself is kept newest first).
// The list is rebuilt on every change (replay dimming, search), so it is not a live region itself: a hidden role=log
// region takes only the newest new line with a severity (a contact, a fault, a warning, the mission's end).
const LOGV = {q: '', sev: 'all', asc: false, hits: null, lastI: -1, said: null};
const LOG_SEV = [
  ['all', 'All'],
  ['warn', 'Warnings'],
  ['bad', 'Errors']
];
const logShow = l =>
  (LOGV.sev === 'all' || (LOGV.sev === 'warn' ? l.cls === 'warn' || l.cls === 'bad' : l.cls === 'bad')) &&
  (!LOGV.q || l.msg.toLowerCase().includes(LOGV.q));
function renderLog() {
  if (!logDirty) return;
  logDirty = false;
  logAnnounce();
  const tc = REPLAY.active ? shownT() : Infinity,
    rows = S.log.filter(logShow),
    shown = LOGV.asc ? rows.slice().reverse() : rows;
  $('#log').innerHTML = shown
    .map(
      l =>
        `<li class="${l.cls}${l.t > tc + 1e-6 ? ' later' : ''}${LOGV.q ? ' hit' : ''}" data-t="${l.t}" title="Show this moment (${l.t.toFixed(1)} s)"><span>${l.t.toFixed(1)}s</span>${esc(l.msg)}</li>`
    )
    .join('');
  $('#log-n').textContent = LOGV.q || LOGV.sev !== 'all' ? `${rows.length} of ${S.log.length}` : '';
  LOGV.hits = LOGV.q ? rows.map(l => l.t) : null;
  // follow the replayed moment: the first line at or before it comes into view
  if (REPLAY.active && REPLAY.i !== LOGV.lastI) {
    LOGV.lastI = REPLAY.i;
    const li = [...$('#log').children].find(e => !e.classList.contains('later'));
    if (li) li.scrollIntoView({block: 'nearest'});
  }
}
function logAnnounce() {
  const top = S.log[0];
  if (top === LOGV.said) return;
  const fresh = [];
  for (const l of S.log.slice(0, 5)) {
    if (l === LOGV.said) break;
    fresh.push(l);
  }
  const first = LOGV.said === null; // the page's first render: nothing is news yet
  LOGV.said = top;
  const l = fresh.find(l => l.cls);
  if (!l || first || REPLAY.active) return;
  const live = $('#log-live'),
    p = document.createElement('p');
  p.textContent = l.msg;
  live.replaceChildren(p);
}
$('#log').addEventListener('click', e => {
  const li = e.target.closest('li[data-t]');
  if (li && REC.frames.length > 1) seekTime(+li.dataset.t);
});
{
  const q = $('#log-q');
  q.oninput = () => {
    LOGV.q = q.value.trim().toLowerCase();
    logDirty = true;
    tlKey = '';
    renderLog();
    syncScrub();
  };
  seg(
    $('#log-sev'),
    LOG_SEV,
    () => LOGV.sev,
    v => {
      LOGV.sev = v;
      logDirty = true;
      renderLog();
    }
  );
  const o = $('#log-order');
  o.onclick = () => {
    LOGV.asc = !LOGV.asc;
    o.setAttribute('aria-pressed', String(LOGV.asc));
    o.textContent = LOGV.asc ? '↑' : '↓';
    o.title = LOGV.asc ? 'Newest first' : 'Oldest first';
    logDirty = true;
    renderLog();
  };
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
