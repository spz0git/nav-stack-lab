/* ---------- What's new: the release log under the version label ---------- */
// CHANGES is CHANGELOG.md, one entry per release, newest first ({v, date, html}; tools/changelog.mjs at build time).
// The label in the header opens it: hovering with a mouse shows it while the pointer is on the label or the popover,
// a click or a tap pins it open, Esc or a click outside closes it. Releases newer than the one this browser last
// opened the popover on are marked new (and the label carries a dot until then); a first visit marks nothing.
const CHANGES = /*__CHANGES__*/ [];
const WN = {pinned: false, timer: 0, seen: null, cur: 0};
const WN_KEY = 'nav-stack-lab.seenVersion',
  WN_REPO = 'https://github.com/spz0git/nav-stack-lab';
function wnInit() {
  const btn = $('#appver');
  if (!btn || !CHANGES.length) return;
  WN.cur = +((/v(\d+)/.exec(btn.textContent) || [])[1] || CHANGES[0].v);
  try {
    const s = localStorage.getItem(WN_KEY);
    WN.seen = s == null ? null : +s;
    if (WN.seen == null) localStorage.setItem(WN_KEY, String(WN.cur));
  } catch (_) {}
  const fresh = WN.seen != null && WN.seen < WN.cur;
  btn.classList.toggle('has-new', fresh);
  btn.setAttribute('aria-label', `Version ${WN.cur}${fresh ? ', updated since your last visit' : ''}: what's new`);
  const pop = document.createElement('div');
  pop.id = 'verpop';
  pop.className = 'verpop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', "What's new");
  pop.hidden = true;
  document.body.appendChild(pop);
  const later = () => {
    clearTimeout(WN.timer);
    WN.timer = setTimeout(() => !WN.pinned && wnShow(false), 250);
  };
  btn.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(WN.timer);
    if (pop.hidden) WN.timer = setTimeout(() => wnShow(true), 120);
  });
  btn.addEventListener('pointerleave', e => e.pointerType === 'mouse' && later());
  pop.addEventListener('pointerenter', () => clearTimeout(WN.timer));
  pop.addEventListener('pointerleave', e => e.pointerType === 'mouse' && later());
  btn.addEventListener('click', () => {
    clearTimeout(WN.timer);
    if (!pop.hidden && WN.pinned) wnShow(false);
    else {
      WN.pinned = true;
      wnShow(true);
      $('#verpop .wn-x').focus({preventScroll: true});
    }
  });
  document.addEventListener(
    'pointerdown',
    e => {
      if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) wnShow(false);
    },
    true
  );
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !pop.hidden) {
      wnShow(false);
      btn.focus();
    }
  });
  addEventListener('resize', () => !pop.hidden && wnPlace());
}
// Opens (filled and placed under the label) or closes the popover; opening it counts as having seen this version
function wnShow(on) {
  const pop = $('#verpop'),
    btn = $('#appver');
  if (!on) {
    pop.hidden = true;
    WN.pinned = false;
    btn.setAttribute('aria-expanded', 'false');
    return;
  }
  if (pop.hidden) pop.innerHTML = wnHTML();
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  wnPlace();
  pop.querySelector('.wn-x').onclick = () => {
    wnShow(false);
    btn.focus();
  };
  if (WN.seen == null || WN.seen < WN.cur) {
    try {
      localStorage.setItem(WN_KEY, String(WN.cur));
    } catch (_) {}
    btn.classList.remove('has-new');
    btn.setAttribute('aria-label', `Version ${WN.cur}: what's new`);
  }
}
function wnPlace() {
  const pop = $('#verpop'),
    r = $('#appver').getBoundingClientRect(),
    w = Math.min(460, innerWidth - 16);
  pop.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - w - 8)) + 'px';
  pop.style.top = r.bottom + 8 + 'px';
}
function wnHTML() {
  const [now, ...before] = CHANGES,
    seen = WN.seen,
    isNew = c => seen != null && c.v > seen,
    since = seen != null && seen < WN.cur ? ` <span class="wn-since">new since v${seen}, the version you last saw</span>` : '';
  const rel = c =>
    `<details class="wn-rel"${isNew(c) ? ' open' : ''}><summary><b>v${c.v}</b> <span class="lbl">${c.date}</span>${isNew(c) ? ' <span class="wn-new">new</span>' : ''}</summary><div class="wn-txt">${c.html}</div></details>`;
  return (
    `<div class="wn-head"><b>What's new in v${now.v}</b><span class="lbl">${now.date}</span><button type="button" class="ibtn wn-x" aria-label="Close">×</button></div>` +
    (since ? `<p class="wn-note">${since}</p>` : '') +
    `<div class="wn-txt">${now.html}</div>` +
    (before.length ? `<h4 class="wn-h">Earlier versions</h4>${before.map(rel).join('')}` : '') +
    `<p class="wn-foot">The full log, and what came before v${CHANGES[CHANGES.length - 1].v}: <a href="${WN_REPO}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">CHANGELOG.md on GitHub</a></p>`
  );
}
wnInit();
