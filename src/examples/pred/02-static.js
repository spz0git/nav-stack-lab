// @example Standing still
// Your agent predictor: everyone stays where they are. The speed planner, DWA and MPC then plan around each person's
// current position only, which is what a stack that tracks positions but not velocities would do; compare the yields
// and contacts on L5 with the constant-velocity example. The radius grows a little with time, as a hedge.
//
// obs.tracks [{id, x, y, vx, vy, r, age}], obs.horizon (s), obs.dt (s)

function predict(obs, mem) {
  const out = {}, n = Math.round(obs.horizon / obs.dt);
  for (const t of obs.tracks) {
    const samples = [];
    for (let k = 0; k <= n; k++) samples.push([t.x, t.y, t.r + 0.05 * k * obs.dt]);
    out[t.id] = samples;
  }
  return { trajectories: out };
}
