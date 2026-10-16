// @example Dead reckoning
// Your localizer. Called every 50 ms tick, before the planner and controller use the estimate.
// Return { x, y, th } and optionally cov: a 3×3 covariance as 9 numbers, row-major (drawn as an ellipse).
//
// obs.init    {x, y, th} on the first call only (the start pose), else null
// obs.dt      0.05 s
// obs.odom    {v, w}   measured speed and yaw rate (noisy, slightly biased)
// obs.beacons [{id, r, b}] or null: range and bearing (body frame) to beacons seen this tick; id is -1 when unlabeled
// obs.map     [{id, x, y}] beacon positions
// obs.scan    Float32Array(120) of lidar ranges or null; beam k points at -π + k·2π/120 in the body frame, 8 m max
// obs.field   {w, h, res, dist} on the first call when there is a prior map: its distance field, metres to the nearest wall per cell (row-major), else null
// mem persists between calls. Budget: 200 ms per call.

function localize(obs, mem) {
  if (obs.init) { mem.x = obs.init.x; mem.y = obs.init.y; mem.th = obs.init.th; }
  // dead reckoning with the exact arc
  const v = obs.odom.v, w = obs.odom.w, dt = obs.dt;
  if (Math.abs(w) < 1e-6) { mem.x += v * dt * Math.cos(mem.th); mem.y += v * dt * Math.sin(mem.th); }
  else { const r = v / w, t2 = mem.th + w * dt; mem.x += r * (Math.sin(t2) - Math.sin(mem.th)); mem.y -= r * (Math.cos(t2) - Math.cos(mem.th)); mem.th = t2; }
  // pull toward each labeled beacon reading: a fixed-gain correction, not a Kalman filter
  if (obs.beacons) for (const z of obs.beacons) {
    const b = obs.map.find(m => m.id === z.id); if (!b) continue;
    const dx = b.x - mem.x, dy = b.y - mem.y, rHat = Math.hypot(dx, dy), bHat = Math.atan2(dy, dx) - mem.th;
    const er = z.r - rHat, eb = Math.atan2(Math.sin(z.b - bHat), Math.cos(z.b - bHat));
    const ux = dx / rHat, uy = dy / rHat;
    mem.x -= 0.2 * er * ux; mem.y -= 0.2 * er * uy; mem.th -= 0.2 * eb;   // a larger measured bearing means the heading estimate is too large
  }
  mem.th = Math.atan2(Math.sin(mem.th), Math.cos(mem.th));
  return { x: mem.x, y: mem.y, th: mem.th };
}
