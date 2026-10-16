// @example Particle filter with beacons
// Your localizer: a particle filter (Monte Carlo localization), the page's pfUpdate and pfResample written plainly
// (Learn → Localization, lesson 4). N particles move along the odometry with noise; after 5 cm of motion each is
// weighted by how well the beacon readings fit its pose; when the effective number of particles drops below N/2 they
// are resampled (low-variance). The estimate is the weighted mean. No injection, so a kidnapped robot stays lost: the
// lesson shows what injection adds. Return { x, y, th, cov }.

const N = 300, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };   // repeatable
const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
function localize(obs, mem) {
  if (obs.init) {
    mem.x = new Float64Array(N).fill(obs.init.x); mem.y = new Float64Array(N).fill(obs.init.y);
    mem.th = new Float64Array(N).fill(obs.init.th); mem.lw = new Float64Array(N); mem.moved = 0;
  }
  // 1. move every particle along the odometry, each with its own noise draw
  const { v, w } = obs.odom, dt = obs.dt;
  const sv = Math.max(0.1 * Math.abs(v) + 0.02, 0.02), sw = Math.max(0.2 * Math.abs(w) + 0.1 * Math.abs(v) + 0.02, 0.02);
  for (let i = 0; i < N; i++) {
    const vi = v + sv * gauss(), wi = w + sw * gauss(), th = mem.th[i];
    if (Math.abs(wi) < 1e-6) { mem.x[i] += vi * dt * Math.cos(th); mem.y[i] += vi * dt * Math.sin(th); }
    else { const R = vi / wi; mem.x[i] += R * (Math.sin(th + wi * dt) - Math.sin(th)); mem.y[i] += R * (Math.cos(th) - Math.cos(th + wi * dt)); mem.th[i] = wrap(th + wi * dt); }
  }
  mem.moved += Math.abs(v) * dt + 0.5 * Math.abs(w) * dt;
  // 2. weight by the beacon readings, once the robot has moved: readings in between are not independent evidence
  const z = obs.beacons || [];
  if (z.length && mem.moved >= 0.05) {
    mem.moved = 0;
    for (let i = 0; i < N; i++) {
      let ll = 0;
      for (const m of z) {
        const lm = obs.map.find(l => l.id === m.id); if (!lm) continue;
        const dx = lm.x - mem.x[i], dy = lm.y - mem.y[i];
        const er = (m.r - Math.hypot(dx, dy)) / 0.08, eb = wrap(m.b - (Math.atan2(dy, dx) - mem.th[i])) / 0.03;
        ll += Math.log(Math.exp(-0.5 * (er * er + eb * eb)) + 1e-3);   // the floor keeps one bad reading from killing a particle
      }
      mem.lw[i] += ll;
    }
    // 3. normalise, N_eff, and resample when the weights have collapsed onto a few particles
    let mx = -Infinity; for (let i = 0; i < N; i++) mx = Math.max(mx, mem.lw[i]);
    const wt = new Float64Array(N); let sum = 0, s2 = 0;
    for (let i = 0; i < N; i++) { wt[i] = Math.exp(mem.lw[i] - mx); sum += wt[i]; }
    for (let i = 0; i < N; i++) { wt[i] /= sum; s2 += wt[i] * wt[i]; }
    if (1 / s2 < N / 2) {
      const nx = new Float64Array(N), ny = new Float64Array(N), nt = new Float64Array(N);
      let u = rnd() / N, c = wt[0], j = 0;                        // low-variance resampling: one random offset, N even steps
      for (let m = 0; m < N; m++) {
        const U = u + m / N;
        while (U > c && j < N - 1) { j++; c += wt[j]; }
        nx[m] = mem.x[j]; ny[m] = mem.y[j]; nt[m] = mem.th[j];
      }
      mem.x = nx; mem.y = ny; mem.th = nt; mem.lw = new Float64Array(N);
    }
  }
  // 4. the estimate: the weighted mean (the heading as a mean direction) and the spread as the covariance
  let mx = -Infinity; for (let i = 0; i < N; i++) mx = Math.max(mx, mem.lw[i]);
  let sw2 = 0, sx = 0, sy = 0, sc = 0, ss = 0; const wt = new Float64Array(N);
  for (let i = 0; i < N; i++) { wt[i] = Math.exp(mem.lw[i] - mx); sw2 += wt[i]; }
  for (let i = 0; i < N; i++) { wt[i] /= sw2; sx += wt[i] * mem.x[i]; sy += wt[i] * mem.y[i]; sc += wt[i] * Math.cos(mem.th[i]); ss += wt[i] * Math.sin(mem.th[i]); }
  const th = Math.atan2(ss, sc), C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) { const d = [mem.x[i] - sx, mem.y[i] - sy, wrap(mem.th[i] - th)]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += wt[i] * d[a] * d[b]; }
  return { x: sx, y: sy, th, cov: C };
}
