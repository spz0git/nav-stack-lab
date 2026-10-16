// Training data for the learned people detector (training/detector/train.py): every lidar scan of headless runs on
// the levels that have people, with one label per beam, 1 when the beam's hit lies on a person. Written as raw
// float32 (features) and uint8 (labels) with a JSON side file into training/data/, which is not committed.
//   node tools/collect-detector.mjs [seconds per run = 120] [seeds = 1..8]
// Features per beam, 6 channels: range/8, the previous scan reprojected through the odometry into this frame /8 (so a
// static wall reads the same range twice and a person does not), the change clipped to ±1, hit
// flag, and the odometry's v/1.5 and ω/2 broadcast over the beams. Labels come from the true pose and the people's
// true discs; the ranges are the noisy ones the page sees.
import fs from 'node:fs';
import path from 'node:path';
import {loadCore, ROOT} from '../tests/node/core.mjs';
loadCore();
const C = globalThis.__core,
  SECS = +(process.argv[2] || 120),
  SEEDS = (process.argv[3] || '1,2,3,4,5,6,7,8').split(',').map(Number),
  LMAX = 8,
  NB = 120,
  CH = 6;
const X = [],
  Y = [],
  runs = [];
let positives = 0;
for (let L = 0; L < C.LEVELS.length; L++) {
  if (!C.LEVELS[L].peds || !C.LEVELS[L].peds.length) continue;
  for (const seed of SEEDS) {
    C.P.seed = seed;
    C.loadLevel(L);
    for (const [k, v] of Object.entries({agents: 'truth', per: 'oracle', spd: 'st', people: seed % 2 ? 'scripted' : 'reactive'}))
      C.setParam(k, v, false);
    C.startMission();
    const S = C.S,
      N = Math.round(SECS / 0.05);
    let prev = null,
      prevT = 0,
      n = 0;
    for (let i = 0; i < N; i++) {
      await C.advance(1);
      if (S.scanTick !== S.tick || !S.scan) continue;
      const r = S.scan,
        rb = S.robot,
        v = S.odo ? S.odo.v : 0,
        w = S.odo ? S.odo.w : 0;
      const rp0 = prev ? C.scanReproject(prev, v, w, S.t - prevT) : null,
        f = new Float32Array(NB * CH),
        y = new Uint8Array(NB);
      for (let k = 0; k < NB; k++) {
        const rk = Math.min(r[k], LMAX),
          rp = rp0 ? rp0[k] : rk,
          hit = r[k] < LMAX - 1e-3 ? 1 : 0;
        f[k * CH] = rk / LMAX;
        f[k * CH + 1] = rp / LMAX;
        f[k * CH + 2] = Math.max(-1, Math.min(1, rk - rp));
        f[k * CH + 3] = hit;
        f[k * CH + 4] = v / 1.5;
        f[k * CH + 5] = w / 2;
        if (hit) {
          const a = rb.th - Math.PI + (k * 2 * Math.PI) / NB,
            hx = rb.x + r[k] * Math.cos(a),
            hy = rb.y + r[k] * Math.sin(a);
          for (const p of S.peds)
            if (Math.hypot(p.x - hx, p.y - hy) <= p.r + 0.12) {
              y[k] = 1;
              positives++;
              break;
            }
        }
      }
      X.push(f);
      Y.push(y);
      prev = Float32Array.from(r);
      prevT = S.t;
      n++;
      if (S.fsm.state === 'DONE') break;
    }
    runs.push({level: C.LEVELS[L].id, seed, scans: n});
    console.log(`${C.LEVELS[L].id} seed ${seed}: ${n} scans`);
  }
}
const dir = path.join(ROOT, 'training', 'data');
fs.mkdirSync(dir, {recursive: true});
const fx = new Float32Array(X.length * NB * CH),
  fy = new Uint8Array(Y.length * NB);
X.forEach((f, i) => fx.set(f, i * NB * CH));
Y.forEach((y, i) => fy.set(y, i * NB));
fs.writeFileSync(path.join(dir, 'detector-x.f32'), Buffer.from(fx.buffer));
fs.writeFileSync(path.join(dir, 'detector-y.u8'), Buffer.from(fy.buffer));
fs.writeFileSync(
  path.join(dir, 'detector.json'),
  JSON.stringify(
    {scans: X.length, beams: NB, channels: CH, runs, positives, note: 'x: [scans, beams, channels] float32; y: [scans, beams] uint8'},
    null,
    1
  )
);
console.log(
  `${X.length} scans, ${positives} person beams (${((100 * positives) / (X.length * NB)).toFixed(1)} %), ${runs.length} runs → training/data/`
);
