// @example Constant velocity
// Your agent predictor. Called at 10 Hz with the current tracks.
// Return { trajectories: { [id]: [[x, y, r], ...] } }: one sample per step of obs.dt from t = 0 to obs.horizon, per track.
// The speed planner, DWA and MPC read these samples instead of the built-in constant-velocity model.
//
// obs.tracks  [{id, x, y, vx, vy, r, age}]  position, velocity estimate, radius, seconds since confirmed
// obs.horizon seconds to predict (the Prediction horizon slider)
// obs.dt      sample step (0.1 s)
// obs.lethal, obs.grid  the static map, as for the planner (people do not walk through walls)
// mem persists between calls. Budget: 200 ms per call.

function predict(obs, mem) {
  const out = {}, n = Math.round(obs.horizon / obs.dt);
  for (const t of obs.tracks) {
    const samples = [];
    let vx = t.vx, vy = t.vy;
    for (let k = 0; k <= n; k++) {
      const tt = k * obs.dt;
      // constant velocity, with the velocity decaying toward a walking pace after 2 s: people rarely keep running
      const sp = Math.hypot(vx, vy), cap = tt > 2 ? 1.2 : Infinity;
      if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
      samples.push([t.x + vx * tt, t.y + vy * tt, t.r + 0.1 * tt]);
    }
    out[t.id] = samples;
  }
  return { trajectories: out };
}
