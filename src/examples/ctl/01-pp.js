// @example Pure pursuit
// Your controller. Called every 50 ms while the robot drives a leg.
// Return { v, w } in m/s and rad/s, or { v, steer } (rad) for the car-like model.
// Add mark: [x, y] to draw a point on the map.
//
// obs.pose   {x, y, th}      estimated pose (not ground truth)
// obs.odom   {v, w}          measured velocity from wheel odometry
// obs.path   [[x, y], ...]   current global path, resampled every 0.1 m
// obs.goal   {x, y}          current goal
// obs.scan   [[x, y], ...]   lidar hits in the world frame (from the estimate)
// obs.agents [{id, x, y, vx, vy, r}]  tracked moving agents (Perceive → Moving agents)
// obs.limits {vmax, wmax, accel, amax, alpha}
// obs.dir                    +1 on a forward leg, -1 on a reverse leg (car paths have cusps)
// obs.vehicle {model, wheelbase, steerMax, steer}   model is 'diff' or 'car'
// obs.pathId                 changes whenever the planner replans or a new leg starts
// obs.t, obs.dt              sim time and step [s]
// mem                        object that persists between calls

function control(obs, mem) {
  const { pose, path, goal, limits } = obs;
  if (mem.pathId !== obs.pathId) { mem.pathId = obs.pathId; mem.i = 0; }

  // 1. closest path index, searching forward from last time
  let best = Infinity;
  const i0 = mem.i;
  for (let i = i0; i < Math.min(path.length, i0 + 60); i++) {
    const d = Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y);
    if (d < best) { best = d; mem.i = i; }
  }

  // 2. carrot: first path point at least L ahead
  const L = 0.8;
  let c = path[path.length - 1];
  for (let i = mem.i; i < path.length; i++) {
    if (Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y) >= L) { c = path[i]; break; }
  }

  // 3. heading error measured against the direction of travel
  const dir = obs.dir;
  const th = dir > 0 ? pose.th : pose.th + Math.PI;
  const a = Math.atan2(c[1] - pose.y, c[0] - pose.x) - th;
  const err = Math.atan2(Math.sin(a), Math.cos(a));

  // 4. slow down when misaligned or near the end of this leg
  const end = path[path.length - 1];
  const dEnd = Math.hypot(end[0] - pose.x, end[1] - pose.y);
  if (obs.vehicle.model === 'car') {
    // the car: slower on a reverse leg (manoeuvring), a ramp into the end of the leg, slow when pointing far off
    const speed = Math.min(dir > 0 ? 0.8 : 0.35, 0.1 + 0.6 * dEnd) * (Math.abs(err) > Math.PI / 2 ? 0.25 : Math.max(0.3, Math.cos(err)));
    const Lc = Math.max(0.1, Math.hypot(c[0] - pose.x, c[1] - pose.y));
    const steer = Math.atan(obs.vehicle.wheelbase * 2 * Math.sin(err) / Lc);
    return { v: dir * speed, steer: dir * steer, mark: c };
  }
  const v = Math.min(0.7, 0.8 * dEnd) * Math.max(0, Math.cos(err));
  return { v, w: 2.0 * err, mark: c };
}
