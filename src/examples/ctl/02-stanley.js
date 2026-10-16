// @example Stanley
// Your controller: Stanley (Hoffmann et al. 2007), the page's ctlStanley written plainly (Learn → Control). The error
// is measured at the front axle: the heading error to the path plus the arctangent of the cross-track error, scaled
// by k and divided by the speed, so the correction softens as the car goes faster. Written for the car; on the
// unicycle the "front axle" is 0.3 m ahead of the pose and the steering angle becomes a turn rate.
//
// obs.pose, obs.odom, obs.path [[x, y], …] (0.1 m apart), obs.dir (+1 forward, -1 reverse), obs.vehicle, obs.limits

function control(obs, mem) {
  const { pose, path, odom, limits } = obs, car = obs.vehicle.model === 'car', L = car ? obs.vehicle.wheelbase : 0.3, K = 2.0;
  const dir = obs.dir, th = dir > 0 ? pose.th : pose.th + Math.PI, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const fx = pose.x + L * Math.cos(th), fy = pose.y + L * Math.sin(th);              // the front axle
  // 1. the nearest path segment to the front axle, and the path heading there
  let best = Infinity, bx = fx, by = fy, bth = th;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy; if (l2 < 1e-12) continue;
    const t = Math.max(0, Math.min(1, ((fx - a[0]) * vx + (fy - a[1]) * vy) / l2)), qx = a[0] + vx * t, qy = a[1] + vy * t;
    const d = (fx - qx) ** 2 + (fy - qy) ** 2;
    if (d < best) { best = d; bx = qx; by = qy; bth = Math.atan2(vy, vx); }
  }
  // 2. the Stanley law: heading error plus the cross-track term, softened by speed
  const eLeft = Math.cos(bth) * (fy - by) - Math.sin(bth) * (fx - bx);               // cross-track error, left positive
  const delta = wrap(bth - th) - Math.atan2(K * eLeft, 0.5 + Math.abs(odom.v));
  const steerMax = car ? obs.vehicle.steerMax : 1.0, d = Math.max(-steerMax, Math.min(steerMax, delta));
  // 3. speed: cruise, slower in a tight turn, braking into the end of the leg
  const end = path[path.length - 1], dEnd = Math.hypot(end[0] - pose.x, end[1] - pose.y), kap = Math.abs(Math.tan(d)) / L;
  let v = Math.min(0.8, limits.vmax); if (kap > 1e-6) v = Math.min(v, Math.sqrt(0.6 / kap));
  v = Math.min(v, Math.sqrt(2 * 0.8 * Math.max(0, dEnd - 0.08)) + 0.02);
  if (car) return { v: dir * Math.min(v, dir > 0 ? 0.8 : 0.35, 0.1 + 0.6 * dEnd), steer: dir * d, mark: [bx, by] };   // reverse legs slowly, a ramp into the leg end
  return { v, w: Math.max(-limits.wmax, Math.min(limits.wmax, v * Math.tan(d) / L)), mark: [bx, by] };
}
