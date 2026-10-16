/* ---------- status & metrics ---------- */
// Status strip: the state as a coloured chip (grey ready/idle, amber plan, green drive, blue done, red stuck/lost/contact), then large figures
const STATE_CLS = {IDLE: 'idle', PLAN: 'plan', DRIVE: 'drive', NO_PATH: 'bad', DONE: 'done', LOST: 'bad'};
// While the timeline replays a moment, the strip shows that moment (the recorded frame), marked "replay"
function renderStatus() {
  const f = replayFrame(),
    V = f || S,
    F = V.fsm,
    r = V.robot,
    e = V.est,
    ep = hyp(r.x - e.x, r.y - e.y),
    done = f ? f.done.filter(d => d[0]).length : WPS.filter(w => w.done).length,
    nc = V.coll + V.collPed;
  const ready = !f && !running && S.t === 0 && (F.state === 'DRIVE' || F.state === 'PLAN'),
    contact = r.contact || r.pedContact;
  const st = contact ? 'CONTACT' : ready ? 'READY' : F.state.replace('_', ' '),
    cls = contact ? 'bad' : ready ? 'ready' : STATE_CLS[F.state];
  const cell = (k, v, c = '', tip = '') =>
    `<span class="kv"${tip ? ` title="${tip}"` : ''}><span>${k}</span><b class="${c}">${v}</b></span>`;
  $('#status').innerHTML =
    `<span class="pill ${cls}">${st}</span>${F.state === 'IDLE' && WPS.length === 0 ? `<span class="st-note">tap the map to add goals</span>` : ''}` +
    cell('t', `${V.t.toFixed(1)} s`, f ? 'replay' : '', f ? 'Replaying a recorded moment; Live or Run returns to the live state' : '') +
    cell('goals', `${done}/${f ? f.done.length : WPS.length}`) +
    (P.loc === 'truth'
      ? cell('pose', 'known', '', 'Ground truth: the estimate is the true pose; pick an estimator in Localize to see an error')
      : cell('pose error', `${ep.toFixed(2)} m`, ep > 0.5 ? 'bad' : '', 'Distance between the true pose and the estimate')) +
    cell('collisions', String(nc), nc ? 'bad' : '', `${V.coll} static, ${V.collPed} people`) +
    (isCar() ? cell('gear · steer', `${r.v < -0.01 ? 'R' : r.v > 0.01 ? 'D' : '–'} · ${deg(r.d).toFixed(0)}°`) : '') +
    (f ? `<span class="st-replay" title="The page shows a recorded moment. Live or Run returns to the live state.">replay</span>` : '');
  $('#run').textContent = running ? 'Pause' : 'Run';
}
function renderMetrics() {
  const r = S.robot,
    e = S.est,
    ep = hyp(r.x - e.x, r.y - e.y);
  const nees = S.nees.length ? S.nees.reduce((a, b) => a + b, 0) / S.nees.length : null;
  const ps = S.planStats;
  const items = [
    ['Distance', `${S.dist.toFixed(1)} m`],
    ['Collisions', `${S.coll} static, ${S.collPed} people${S.collPedStill ? ` (${S.collPedStill} into the stopped robot)` : ''}`],
    ...(P.loc === 'truth'
      ? [['Localization', 'ground truth: the pose is known, no estimate error', 'loc']]
      : [
          ['Pose error', `${ep.toFixed(2)} m · ${deg(Math.abs(wrap(r.th - e.th))).toFixed(1)}°`, 'loc'],
          ['Pose RMS', S.errN ? `${Math.sqrt(S.errSq / S.errN).toFixed(2)} m` : '—', 'loc'],
          ['NEES (3 = consistent)', nees == null ? '—' : `${nees.toFixed(1)}${nees > 7.8 ? ' · overconfident' : ''}`, 'loc']
        ]),
    ['Cross-track RMS', S.cteN ? `${Math.sqrt(S.cteSq / S.cteN).toFixed(3)} m` : '—', 'ctl'],
    ['Last plan', ps ? `${ps.name} · ${ps.len.toFixed(1)} m${ps.extra ? ' · ' + ps.extra : ''} · ${ps.ms.toFixed(0)} ms` : '—', 'plan'],
    ['Search effort', ps && ps.exp ? `${ps.exp} ${ps.name === 'RRT*' ? 'tree nodes' : 'expansions'}` : '—', 'plan']
  ];
  if (P.ctl === 'mpc' && S.mpcStats) {
    const m = S.mpcStats;
    items.push(
      ['MPC solve', `${m.mode} · ${m.ms.toFixed(1)} ms · ${m.it} it · J ${m.J.toFixed(1)}`, 'ctl'],
      ['MPC violation', m.viol > 0.005 ? `${m.viol.toFixed(3)}` : 'none', 'ctl']
    );
  }
  if (S.peds.length) items.push(['Closest to a person', isFinite(S.minPed) ? `${Math.max(0, S.minPed).toFixed(2)} m` : '—']);
  if (S.agents && agOn()) {
    const tr = S.agents.tracks,
      cf = tr.filter(t => t.conf).length;
    items.push(['Agent tracks', `${cf} confirmed · ${tr.length - cf} tentative`, 'per']);
  }
  if (S.slam) items.push(['SLAM map', `${S.slam.n} of ${S.beacons.length} beacons · ${3 + 2 * S.slam.n} states`, 'loc']);
  if (S.pf) items.push(['Particles', `N_eff ${S.pf.neff.toFixed(0)}/${S.pf.N}, inj ${(S.pf.inj * 100).toFixed(0)}%`, 'loc']);
  if (P.assoc === 'unknown' && P.loc !== 'truth' && P.loc !== 'dr') items.push(['Gated measurements', String(S.rejected), 'loc']);
  $('#metrics').innerHTML = items.map(([a, b, c]) => `<div${c ? ` data-sys="${c}"` : ''}><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}
