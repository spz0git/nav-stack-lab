/* ============================================================
   The ODD monitor (design C6; safety lesson 9). Off by default (P.oddMon). It watches what the robot itself can observe
   of its operating domain against the sheet it was given (P.oddSheet, a sheet's name or its JSON) and, once it has been
   outside for 1 s, takes a minimal-risk manoeuvre (P.oddResp): a crawl at 0.3 m/s or a stop, until it has been back
   inside for 3 s. Observable here:
   - the weather, from the lidar's return share averaged over the last 2 s: below 0.65 the air is not clear (measured,
     L5 and generated warehouses: 0.86–0.93 in clear air, 0.67–0.76 in rain, 0.57–0.59 in fog); checked only when the
     sheet allows clear air alone, and blind to rain, which sits between;
   - a learned block in use whose input has been outside its training data for most of the last 5 s (core/learnmon.js).
   Not observable, and so left to operational restrictions: the floor's grip, the people's intentions, the aisle width
   before it is seen. With the monitor off nothing here runs.
   ============================================================ */
const OM_SHARE = 0.65, // the 2 s mean return share below which the air is not clear
  OM_WIN = 2, // s
  OM_ENTER = 1, // s outside before the manoeuvre
  OM_LEAVE = 3, // s inside before it ends
  OM_CRAWL = 0.3; // m/s
function oddSheetOf(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string' && v.trim().startsWith('{'))
    try {
      return JSON.parse(v);
    } catch (_) {
      return null;
    }
  return ODD_SHEETS[v] || null;
}
// Once per tick, after the scan (core/step.js postSense)
function oddTick() {
  if (!P.oddMon) return;
  if (!S.odd) S.odd = {win: [], out: false, since: S.t, why: '', outS: 0, first: null, n: 0};
  const O = S.odd,
    sh = oddSheetOf(P.oddSheet);
  if (S.scanTick === S.tick && S.scan && P.lidar) {
    let h = 0;
    for (const r of S.scan) if (r < LMAX - 1e-3) h++;
    O.win.push([S.t, h / S.scan.length]);
  }
  while (O.win.length && O.win[0][0] < S.t - OM_WIN) O.win.shift();
  const why = [];
  if (sh && sh.weather && sh.weather.length === 1 && sh.weather[0] === 'clear' && O.win.length >= 10) {
    const m = O.win.reduce((a, w) => a + w[1], 0) / O.win.length;
    O.share = m;
    if (m < OM_SHARE) why.push(`the air is not clear (the lidar returns ${(100 * m).toFixed(0)} % of its beams)`);
  }
  const L = S.learn;
  if (L)
    for (const [b, [, used, name]] of Object.entries(LM_USE)) {
      const W = used() && L.ood[b] && L.ood[b].win;
      if (W && W.length >= 3 && W.filter(w => w[1]).length / W.length > 0.5)
        why.push(`the learned ${name}'s input is unlike its training data`);
    }
  const outNow = why.length > 0;
  if (outNow !== O.rawOut) {
    O.rawOut = outNow;
    O.rawSince = S.t;
  }
  if (outNow) O.why = why.join('; ');
  const held = S.t - (O.rawSince ?? S.t);
  if (!O.out && outNow && held >= OM_ENTER) {
    O.out = true;
    O.n++;
    if (O.first == null) O.first = +S.t.toFixed(2);
    logE(`Outside the operating domain: ${O.why} · ${P.oddResp === 'stop' ? 'stopping' : `crawling at ${OM_CRAWL} m/s`}`, 'warn');
  } else if (O.out && !outNow && held >= OM_LEAVE) {
    O.out = false;
    logE('Back inside the operating domain · normal speed', 'ok');
  }
  if (O.out && S.fsm.state !== 'IDLE' && S.fsm.state !== 'DONE') O.outS += DT;
}
// The command with the manoeuvre applied (core/step.js applyCmd, after every controller)
function oddCmd(c) {
  if (!P.oddMon || !S.odd || !S.odd.out) return c;
  const lim = P.oddResp === 'stop' ? 0 : OM_CRAWL,
    v = Math.abs(c.v || 0);
  if (v <= lim) return c;
  const f = v > 1e-9 ? lim / v : 0;
  return {...c, v: c.v * f, ...(c.w != null && !isCar() ? {w: c.w * f} : {})};
}
function oddSummary() {
  const O = S.odd;
  return O ? {oddFirst: O.first, oddOutS: +O.outS.toFixed(1), oddN: O.n} : {oddFirst: null, oddOutS: 0, oddN: 0};
}
