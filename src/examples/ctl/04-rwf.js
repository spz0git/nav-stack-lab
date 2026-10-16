// @example Rear-wheel feedback
// Your controller: rear-wheel feedback (Samson; Paden et al. 2016 §V-A), the page's ctlRWF written plainly and the
// controller the Analyze view's loop model is built on. Curvature feedforward from the path plus heading and lateral
// feedback: κ_c = κ cos θ_e / (1 − κ e) − k_θ θ_e − k_e sinc(θ_e) e. k_e 6.0 and k_θ 3.0 are the Control tab's defaults;
// the design row under the pole plot (Learn → Control, lesson 18) gives you other pairs to try here. The path's
// heading and curvature come from finite differences over the 0.1 m points.
//
// obs.pose, obs.odom, obs.path [[x, y], …], obs.dir, obs.vehicle {model, wheelbase, steerMax}, obs.limits

function control(obs, mem) {
  const { pose, path, limits } = obs, car = obs.vehicle.model === 'car', ke = 6.0, kth = 3.0;
  const dir = obs.dir, th = dir > 0 ? pose.th : pose.th + Math.PI, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // 1. the nearest path point; the path heading and curvature there (curvature read 0.2 m ahead, covering the lag)
  let ni = 0, nd = Infinity;
  for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i][0] - pose.x, path[i][1] - pose.y); if (d < nd) { nd = d; ni = i; } }
  const at = i => path[Math.max(0, Math.min(path.length - 1, i))];
  const hd = i => { const a = at(i - 1), b = at(i + 1); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const curv = i => wrap(hd(i + 1) - hd(i - 1)) / Math.max(1e-3, Math.hypot(at(i + 1)[0] - at(i - 1)[0], at(i + 1)[1] - at(i - 1)[1]));
  const q = at(ni), thp = hd(ni), kmax = car ? Math.tan(obs.vehicle.steerMax) / obs.vehicle.wheelbase : 3;
  const k = Math.max(-kmax, Math.min(kmax, path.length > 4 ? curv(ni + 2) : 0));
  // 2. the two errors and the law
  const el = Math.cos(thp) * (pose.y - q[1]) - Math.sin(thp) * (pose.x - q[0]), the = wrap(th - thp);   // lateral (left > 0), heading
  const sinc = Math.abs(the) < 1e-4 ? 1 : Math.sin(the) / the;
  const kc = (k * Math.cos(the)) / Math.max(0.3, 1 - k * el) - kth * the - ke * sinc * el;
  // 3. speed: cruise, slower where the path is curved, braking into the end of the leg
  const end = path[path.length - 1], dEnd = Math.hypot(end[0] - pose.x, end[1] - pose.y);
  let v = Math.min(0.8, limits.vmax); if (Math.abs(k) > 1e-6) v = Math.min(v, Math.sqrt(0.6 / Math.abs(k)));
  v = Math.min(v, Math.sqrt(2 * 0.8 * Math.max(0, dEnd - 0.08)) + 0.02);
  if (car) {   // reverse legs slowly, a ramp into the leg end, slow when pointing far off the path
    const sm = obs.vehicle.steerMax, vc = Math.min(v, dir > 0 ? 0.8 : 0.35, 0.1 + 0.6 * dEnd) * (Math.abs(the) > Math.PI / 2 ? 0.25 : 1);
    return { v: dir * vc, steer: dir * Math.max(-sm, Math.min(sm, Math.atan(obs.vehicle.wheelbase * kc))), mark: q };
  }
  if (Math.abs(the) > Math.PI / 2) return { v: 0, w: -Math.sign(the) * limits.wmax * 0.7 };   // facing away: turn in place first
  return { v, w: Math.max(-limits.wmax, Math.min(limits.wmax, v * kc)), mark: q };
}
