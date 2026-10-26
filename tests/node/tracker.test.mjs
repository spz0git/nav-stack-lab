// The people trackers on L5 (core/agents.js agTrack, core/radar.js agTrackFused): the lidar-only tracker and the fused one
// with the radar, in clear air and in fog. Each run is stepped tick by tick and the tracks counted; the numbers were
// measured before the two trackers were merged onto one lifecycle and must not move.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';

loadCore();
const C = globalThis.self.__core;

async function trackStats(overrides, secs = 60, seed = 7) {
  const P = C.P;
  P.seed = seed;
  C.loadLevel(4);
  for (const [k, v] of Object.entries(overrides)) C.setParam(k, v, false);
  C.startMission();
  const conf = new Set(),
    seen = new Set();
  let confTicks = 0,
    sum = 0;
  const N = Math.round(secs / 0.05);
  for (let n = 0; n < N; n++) {
    await C.advance(1);
    for (const t of C.S.agents.tracks) {
      seen.add(t.id);
      if (t.conf) {
        conf.add(t.id);
        confTicks++;
      }
      sum += t.x + 2 * t.y + 3 * t.vx + 5 * t.vy + 7 * t.pxx;
    }
  }
  const pe = C.predErrors(),
    r6 = x => +x.toFixed(6);
  return {tracks: seen.size, confirmed: conf.size, confTicks, sum: +sum.toFixed(3), predErr: pe.cv.map(r6), n: pe.n};
}

// 60 s at seed 7: tracks started, tracks confirmed, confirmed track-ticks, a checksum of every track's state at every
// tick, and the constant-velocity predictor's mean error at 1 s and 2 s over its n scored predictions (core/predict.js)
const CASES = [
  ['lidar', {}, {tracks: 17, confirmed: 9, confTicks: 918, sum: 33303.88, predErr: [0.316587, 0.631182], n: 425}],
  [
    'both',
    {radar: true, trkIn: 'both'},
    {tracks: 263, confirmed: 7, confTicks: 910, sum: 86588.585, predErr: [0.272449, 0.564461], n: 426}
  ],
  [
    'radar',
    {radar: true, trkIn: 'radar'},
    {tracks: 222, confirmed: 4, confTicks: 416, sum: 60097.345, predErr: [0.295637, 0.574284], n: 203}
  ],
  [
    'both, fog',
    {radar: true, trkIn: 'both', weather: 'fog'},
    {tracks: 485, confirmed: 14, confTicks: 1080, sum: 136716.595, predErr: [0.430747, 0.820232], n: 491}
  ]
];
for (const [name, o, want] of CASES)
  test(`L5 people tracker, ${name}: the tracks and their predictions are as measured`, async () => {
    assert.deepEqual(await trackStats(o), want);
  });
