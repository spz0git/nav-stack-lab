// @example EKF with beacons
// Your localizer: an extended Kalman filter on (x, y, θ), the page's locPredict and ekfUpdate written plainly (Learn →
// Localization, lessons 1 and 2). Odometry predicts along the exact arc and grows the covariance; each beacon reading
// (range r and bearing b to a beacon of known position) corrects it. The noise it assumes is the lab's default; the
// Localize sliders do not reach in here: speed σ = 0.1|v| + 0.02, turn σ = 0.2|ω| + 0.1|v| + 0.02, range σ = 0.08 m,
// bearing σ = 0.03 rad. Return { x, y, th, cov }: cov is the 3×3 covariance, row-major, drawn as the ellipse.
//
// obs.init {x, y, th} on the first call, obs.dt, obs.odom {v, w}, obs.beacons [{id, r, b}] or null, obs.map [{id, x, y}]

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
function localize(obs, mem) {
  if (obs.init) { mem.x = obs.init.x; mem.y = obs.init.y; mem.th = obs.init.th; mem.P = [0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.01]; }
  const { v, w } = obs.odom, dt = obs.dt;
  // 1. predict: the exact arc, the Jacobian G of the motion, the input noise mapped into the state (V M Vᵀ)
  const th = mem.th, c = Math.cos(th), s = Math.sin(th);
  if (Math.abs(w) < 1e-6) { mem.x += v * dt * c; mem.y += v * dt * s; }
  else { const R = v / w; mem.x += R * (Math.sin(th + w * dt) - s); mem.y += R * (c - Math.cos(th + w * dt)); mem.th = wrap(th + w * dt); }
  const G = [1, 0, -v * dt * s, 0, 1, v * dt * c, 0, 0, 1];
  const sv = 0.1 * Math.abs(v) + 0.02, sw = 0.2 * Math.abs(w) + 0.1 * Math.abs(v) + 0.02;
  const a = dt * dt * sv * sv, b = dt * dt * sw * sw;
  const Q = [a * c * c, a * c * s, 0, a * c * s, a * s * s, 0, 0, 0, b];
  let P = add(mul(mul(G, mem.P), T(G)), Q);
  // 2. update, one beacon at a time: innovation ν = z − h(x), S = H P Hᵀ + R, gain K = P Hᵀ S⁻¹
  const sr = 0.08, sb = 0.03;
  for (const m of obs.beacons || []) {
    const lm = obs.map.find(l => l.id === m.id); if (!lm) continue;      // unlabeled readings (id -1) are skipped here
    const dx = lm.x - mem.x, dy = lm.y - mem.y, q = dx * dx + dy * dy, r = Math.sqrt(q); if (r < 1e-6) continue;
    const H = [-dx / r, -dy / r, 0, dy / q, -dx / q, -1];                 // 2×3: how r and b change with x, y, θ
    const PHt = mulHt(P, H);                                              // P Hᵀ, 3×2
    const S = [H[0] * PHt[0] + H[1] * PHt[2] + H[2] * PHt[4] + sr * sr, H[0] * PHt[1] + H[1] * PHt[3] + H[2] * PHt[5],
               H[3] * PHt[0] + H[4] * PHt[2] + H[5] * PHt[4], H[3] * PHt[1] + H[4] * PHt[3] + H[5] * PHt[5] + sb * sb];
    const det = S[0] * S[3] - S[1] * S[2]; if (Math.abs(det) < 1e-12) continue;
    const Si = [S[3] / det, -S[1] / det, -S[2] / det, S[0] / det];
    const nu = [m.r - r, wrap(m.b - (Math.atan2(dy, dx) - mem.th))];
    const K = [PHt[0] * Si[0] + PHt[1] * Si[2], PHt[0] * Si[1] + PHt[1] * Si[3], PHt[2] * Si[0] + PHt[3] * Si[2],
               PHt[2] * Si[1] + PHt[3] * Si[3], PHt[4] * Si[0] + PHt[5] * Si[2], PHt[4] * Si[1] + PHt[5] * Si[3]];
    mem.x += K[0] * nu[0] + K[1] * nu[1]; mem.y += K[2] * nu[0] + K[3] * nu[1]; mem.th = wrap(mem.th + K[4] * nu[0] + K[5] * nu[1]);
    // P ← (I − K H) P: the textbook line (the page uses the Joseph form, which keeps P symmetric under rounding)
    const KH = [K[0] * H[0] + K[1] * H[3], K[0] * H[1] + K[1] * H[4], K[0] * H[2] + K[1] * H[5],
                K[2] * H[0] + K[3] * H[3], K[2] * H[1] + K[3] * H[4], K[2] * H[2] + K[3] * H[5],
                K[4] * H[0] + K[5] * H[3], K[4] * H[1] + K[5] * H[4], K[4] * H[2] + K[5] * H[5]];
    P = mul([1 - KH[0], -KH[1], -KH[2], -KH[3], 1 - KH[4], -KH[5], -KH[6], -KH[7], 1 - KH[8]], P);
  }
  mem.P = P;
  return { x: mem.x, y: mem.y, th: mem.th, cov: P };
}
// 3×3 helpers, row-major
function mul(A, B) { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j]; return C; }
function T(A) { return [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]]; }
function add(A, B) { return A.map((x, i) => x + B[i]); }
function mulHt(P, H) { return [P[0] * H[0] + P[1] * H[1] + P[2] * H[2], P[0] * H[3] + P[1] * H[4] + P[2] * H[5], P[3] * H[0] + P[4] * H[1] + P[5] * H[2], P[3] * H[3] + P[4] * H[4] + P[5] * H[5], P[6] * H[0] + P[7] * H[1] + P[8] * H[2], P[6] * H[3] + P[7] * H[4] + P[8] * H[5]]; }
