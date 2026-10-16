// @example PID on the heading error
// Your controller: a PID on the heading error toward a look-ahead point, the page's ctlPID written plainly (Learn →
// Control, lesson 8 on integral action). Kp 2.0, Ki 0 and Kd 0.15 are the Control tab's defaults; set Ki to 0.3 and
// watch the integral wind up and unwind. The speed drops with the heading error and into the end of the leg.
//
// obs.pose, obs.odom, obs.path [[x, y], …] (0.1 m apart), obs.pathId (changes with every new leg), obs.dt, obs.limits

function control(obs, mem) {
  const { pose, path, odom, limits } = obs, dt = obs.dt, car = obs.vehicle.model === 'car';
  const Kp = 2.0, Ki = 0.0, Kd = 0.15, dir = obs.dir, th = dir > 0 ? pose.th : pose.th + Math.PI;
  if (mem.pathId !== obs.pathId) { mem.pathId = obs.pathId; mem.I = 0; mem.prev = null; }   // a new leg: reset the memory
  // 1. the look-ahead point: the first path point at least Ld ahead of the nearest one
  const Ld = Math.max(0.1, 0.5 + 0.5 * Math.abs(odom.v));
  let ni = 0, nd = Infinity;
  for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y); if (d < nd) { nd = d; ni = i; } }
  let c = path[path.length - 1];
  for (let i = ni; i < path.length; i++) if (Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y) >= Ld) { c = path[i]; break; }
  // 2. the three terms on the heading error
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), err = wrap(Math.atan2(c[1] - pose.y, c[0] - pose.x) - th);
  mem.I = Math.max(-1, Math.min(1, mem.I + err * dt));                         // integral, clamped (anti-windup)
  const D = mem.prev == null ? 0 : wrap(err - mem.prev) / dt; mem.prev = err;  // derivative of the error
  const u = Kp * err + Ki * mem.I + Kd * D;
  // 3. speed: cruise, less when pointing the wrong way, braking into the end of the leg
  const end = path[path.length - 1], dEnd = Math.hypot(end[0] - pose.x, end[1] - pose.y);
  let v = Math.min(0.8, limits.vmax) * Math.max(0, Math.cos(err)) ** 2;
  v = Math.min(v, Math.sqrt(2 * 0.8 * Math.max(0, dEnd - 0.08)) + 0.02);
  if (car) { const sm = obs.vehicle.steerMax; return { v: dir * Math.min(v, dir > 0 ? 0.8 : 0.35, 0.1 + 0.6 * dEnd), steer: dir * Math.max(-sm, Math.min(sm, u)), mark: c }; }   // reverse legs slowly, a ramp into the leg end
  return { v, w: Math.max(-limits.wmax, Math.min(limits.wmax, u)), mark: c };
}
