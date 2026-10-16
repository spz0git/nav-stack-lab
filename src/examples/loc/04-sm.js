// @example Scan matching against the map
// Your localizer: dead reckoning corrected by scan matching, the page's scanMatch written plainly (Learn → Localization,
// lesson 7). The odometry moves the pose along the arc; every fourth scan is aligned to the prior map by Gauss–Newton
// on the map's distance field (obs.field, given on the first call), and when the fit is good the matched pose replaces
// the estimate. No beacons needed. The page fuses the match into an EKF instead, gated and weighted; this is the bare
// version. Return { x, y, th, cov }: cov from the fit, floored at 5 cm.
//
// obs.init {x, y, th} on the first call, obs.field {w, h, res, dist} with it when there is a prior map (null otherwise),
// obs.odom {v, w}, obs.dt, obs.scan Float32Array(120) or null: beam k points at -π + k·2π/120 in the body frame, 8 m max

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
function localize(obs, mem) {
  if (obs.init) { mem.x = obs.init.x; mem.y = obs.init.y; mem.th = obs.init.th; mem.F = obs.field; mem.n = 0; mem.cov = [0.0025, 0, 0, 0, 0.0025, 0, 0, 0, 0.0003]; }
  // 1. dead reckoning along the arc
  const { v, w } = obs.odom, dt = obs.dt, th = mem.th;
  if (Math.abs(w) < 1e-6) { mem.x += v * dt * Math.cos(th); mem.y += v * dt * Math.sin(th); }
  else { const R = v / w; mem.x += R * (Math.sin(th + w * dt) - Math.sin(th)); mem.y += R * (Math.cos(th) - Math.cos(th + w * dt)); mem.th = wrap(th + w * dt); }
  // 2. every fourth scan: align it to the map and, when the fit is good, take the matched pose
  if (obs.scan && mem.F && mem.n++ % 4 === 0) {
    const m = scanMatch(obs.scan, mem.F, mem.x, mem.y, mem.th);
    if (m && m.rms < 0.12 && m.n >= 0.6 * m.hits) { mem.x = m.x; mem.y = m.y; mem.th = m.th; mem.cov = m.cov; }
  }
  return { x: mem.x, y: mem.y, th: mem.th, cov: mem.cov };
}
// Gauss–Newton on ξ = (x, y, θ): each hit p, placed at T_ξ p in the world, costs d(T_ξ p)², d the distance to the nearest
// wall read from the field by bilinear interpolation; the Jacobian is ∇d times the derivative of the transform.
function scanMatch(ranges, F, x, y, th) {
  const { w, h, res, dist: D } = F, pts = [];
  for (let k = 0; k < ranges.length; k += 2) { const r = ranges[k]; if (r >= 7.99) continue; const a = -Math.PI + (k * 2 * Math.PI) / ranges.length; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  if (pts.length < 12) return null;
  const field = (px, py) => {                        // d and ∇d at a world point
    const fx = px / res - 0.5, fy = py / res - 0.5, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) return null;
    const tx = fx - i, ty = fy - j, k = j * w + i, d00 = D[k], d10 = D[k + 1], d01 = D[k + w], d11 = D[k + w + 1];
    return { d: (1 - ty) * ((1 - tx) * d00 + tx * d10) + ty * ((1 - tx) * d01 + tx * d11),
      gx: ((1 - ty) * (d10 - d00) + ty * (d11 - d01)) / res, gy: ((1 - tx) * (d01 - d00) + tx * (d11 - d10)) / res };
  };
  let H = null, n = 0, ss = 0;
  for (let it = 0; it < 10; it++) {
    const c = Math.cos(th), s = Math.sin(th), b = [0, 0, 0]; H = [0, 0, 0, 0, 0, 0, 0, 0, 0]; n = 0; ss = 0;
    for (const [px, py] of pts) {
      const f = field(x + c * px - s * py, y + s * px + c * py); if (!f || f.d > 0.5) continue;   // hits far from any wall: people, outliers
      const J = [f.gx, f.gy, f.gx * (-s * px - c * py) + f.gy * (c * px - s * py)];
      for (let a = 0; a < 3; a++) { b[a] += J[a] * f.d; for (let q = 0; q < 3; q++) H[a * 3 + q] += J[a] * J[q]; }
      n++; ss += f.d * f.d;
    }
    if (n < 12) return null;
    for (let a = 0; a < 3; a++) H[a * 4] += 1e-6;
    const Hi = inv3(H); if (!Hi) return null;
    const dx = -(Hi[0] * b[0] + Hi[1] * b[1] + Hi[2] * b[2]), dy = -(Hi[3] * b[0] + Hi[4] * b[1] + Hi[5] * b[2]), dth = -(Hi[6] * b[0] + Hi[7] * b[1] + Hi[8] * b[2]);
    x += dx; y += dy; th = wrap(th + dth);                                   // the Gauss–Newton step, H δ = −b
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3 && Math.abs(dth) < 1e-3) break;
  }
  const s2 = Math.max(ss / Math.max(1, n - 3), 1e-4), Hi = inv3(H); if (!Hi) return null;
  const cov = Hi.map(v => v * s2 * 4); cov[0] += 0.0025; cov[4] += 0.0025; cov[8] += 0.0003;   // inflated, floored at 5 cm and 1°
  return { x, y, th, cov, rms: Math.sqrt(ss / n), n, hits: pts.length };
}
function inv3(A) {
  const [a, b, c, d, e, f, g, h, i] = A, C0 = e * i - f * h, C1 = -(d * i - f * g), C2 = d * h - e * g, det = a * C0 + b * C1 + c * C2;
  if (Math.abs(det) < 1e-18) return null;
  return [C0 / det, -(b * i - c * h) / det, (b * f - c * e) / det, C1 / det, (a * i - c * g) / det, -(a * f - c * d) / det, C2 / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
