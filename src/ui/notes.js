const NOTES={
 loc:`<p><b>Dead reckoning</b> integrates measured (v, ω) through the exact arc model. Covariance is propagated but never corrected, so it only grows.</p>
<div class="eq">μ' = g(μ, u)            Σ' = G Σ Gᵀ + V M Vᵀ
G = ∂g/∂x = [1 0 −vΔt sinθ; 0 1 vΔt cosθ; 0 0 1]
M = diag(σ_v², σ_ω²)  (assumed noise × filter scale)</div>
<p><b>EKF</b> corrects with each beacon reading z = [r, φ] at 5 Hz, using the Joseph-form covariance update.</p>
<div class="eq">ẑ = [√q, atan2(Δy, Δx) − θ],   q = Δx² + Δy²
H = [−Δx/√q  −Δy/√q   0 ;  Δy/q  −Δx/q  −1]
S = HΣHᵀ + Q,  K = ΣHᵀS⁻¹,  μ += K(z − ẑ)
unlabeled: pick min Mahalanobis d² = νᵀS⁻¹ν, gate d² < 9.21 (χ²₂, 99%)</div>
<p><b>Beacon availability.</b> Switch beacons off (the numbered chips, or Tap map → Switch a beacon on/off) or let them fail at random. While no beacon is in view the EKF and the particle filter only predict, exactly as dead reckoning does, and the ellipse grows; the first reading back pulls the estimate in. Dead reckoning never uses beacons, so the map draws no beacon readings for it. On the map a switched-off beacon is a grey hollow diamond with a stroke; one in a random outage is a hollow diamond.</p>
<p><b>Particle filter</b> (Monte Carlo localization) samples the motion model per particle, weights by beacon likelihood with a robust floor, and resamples with the low-variance sampler when N_eff &lt; N/2. Augmented MCL tracks short- and long-term likelihood averages (α_fast = 0.1, α_slow = 0.001) and, when the short-term average drops, replaces up to 25% of particles with poses drawn from the current beacon readings (sensor-resetting localization). That is what recovers from kidnapping.</p>
<p>With a prior map the particle filter can also score lidar scans (likelihood field, 24 beams, σ = 0.2 m, tempered by 0.4 because beams are correlated). Beacons alone are sparse; walls are everywhere.</p>
<p>Like AMCL, the filter skips sensor updates until the robot has moved about 5 cm (or turned about 0.1 rad). Updating while parked would resample the same evidence over and over and collapse the particle set.</p>
<p><b>EKF-SLAM</b> adds the beacon positions to the state, [x, y, θ, m<sub>1</sub>, m<sub>2</sub>, …] with a full covariance. A beacon seen for the first time is placed from the current pose (inverse observation, with the Jacobians carrying the pose uncertainty into the landmark). Known IDs give the data association; with unlabeled beacons readings are matched to mapped landmarks inside the same χ² gate and far-off readings start new landmarks. The pose is anchored only through landmarks mapped while it was certain, so the error drifts until loop closure.</p>
<p><b>Consistency check.</b> NEES = eᵀΣ⁻¹e for the 3-state error. A consistent filter averages about 3. Well above that means the filter is more confident than its error justifies.</p>`,
 per:`<p><b>Prior map</b> hands the planner the true static map. People never appear in it; they are only visible to the lidar.</p>
<p><b>Lidar mapping</b> casts 120 beams (360°, 8 m, 10 Hz) and updates a 0.1 m log-odds grid along each ray with Bresenham traversal. The grid is built in the <i>estimated</i> frame, so localization error shows up as smeared or doubled walls.</p>
<div class="eq">l ← clamp(l + l_meas, ±4),  l_free = −0.4,  l_hit = +0.85
occupied if l > 0.5;  unknown if l ≈ 0</div>
<p><b>Costmap.</b> A two-pass chamfer distance transform gives distance to the nearest occupied cell. Cells closer than 0.4 m (robot radius 0.3 m plus margin) are lethal; a quadratic penalty fades out across the inflation band.</p>
<p><b>Agent tracking.</b> The lidar tracker takes the hits the static map does not explain (prior map: more than 0.25 m from it; built map: cells that are not persistently occupied) and clusters them over consecutive beams. Clusters wider than 1.2 m are dropped as map error. Hits lie on the near side of a person, so the center is pushed 0.6 r away from the sensor.</p>
<div class="eq">state  x = [p_x, p_y, v_x, v_y],  constant-velocity model
x' = F x,  F = [I  Δt·I; 0  I],  Q from white acceleration noise σ_a
z = p + noise (σ_z = 0.1 m);  gate d² = ‖z − p̂‖² / (P_pp + σ_z²) < 9.21  (χ²₂, 99 %)
greedy nearest-neighbour assignment · confirm after 3 hits · coast up to 1 s unseen
prediction  p(t) = p + v t,   r(t) = r + g t</div>
<p><b>Ground truth</b> hands over true positions and velocities, which separates prediction error from tracking error. Hits that belong to confirmed tracks are taken out of the static obstacle set the local planners see; the predictions replace them. People do not react to the robot, so this is prediction without interaction.</p>`,
 mis:`<p>The behavior layer is a small state machine. Watch its state in the status bar and its transitions in the event log.</p>
<div class="eq">IDLE ─Run→ PLAN ─ok→ DRIVE ─arrived→ PLAN (next) … DONE
                 └fail→ NO_PATH ─2 s→ PLAN   (skip after 3)
DRIVE → PLAN on: path blocked in costmap · off path (estimate &gt; 1 m from it) · agent blocking (speed planner) · stuck (&lt;0.15 m in 5 s,
                 skip after 3) · periodic timer
DRIVE → LOST if guard on and σ_pos > 1 m; LOST → PLAN when σ_pos &lt; 0.4 m</div>
<p><b>Arrival is declared on the estimate</b> (0.25 m). The log reports the true distance at that moment, so localization error shows up as missed goals.</p>
<p><b>Ordering.</b> Greedy and Optimal build a cost matrix by running Dijkstra on the costmap from the robot and every goal. Optimal solves the open-path TSP by branch-and-bound enumeration, fine up to about 8 waypoints.</p>`,
 plan:`<p><b>Straight line</b> ignores obstacles. The event-driven blocked-path check is disabled for it, so it fails honestly.</p>
<p><b>A*</b> on the 0.1 m costmap grid, 8-connected, no corner cutting.</p>
<div class="eq">f = g + ε·h,  h = octile distance (admissible)
edge cost = length · (1 + 3 · penalty)
ε > 1 → weighted A*, cost ≤ ε · optimal, fewer expansions</div>
<p><b>RRT*</b> grows a tree by sampling (10% goal bias, 0.6 m steer), chooses the cheapest parent in a shrinking radius r = min(8√(log n / n), 1.5 m) and rewires neighbors. It is asymptotically optimal; with a finite budget it is just "good".</p>
<p><b>Smoothing</b> greedily replaces the path with the farthest visible path point, keeping 0.5 m clearance.</p>
<p><b>Reeds–Shepp</b> (car only) is the shortest path for a car that drives forward and backward with a minimum turning radius, ignoring obstacles. It has a closed-form solution over 48 path words such as L⁺S⁺R⁻ (left forward, straight forward, right reverse).</p>
<p><b>Hybrid A*</b> (car only) searches cells of 0.2 m × 5°, but each node keeps its continuous pose, so every edge is a drivable arc: 5 steering angles × forward/reverse, 0.4 m each.</p>
<div class="eq">g += length·(1 or reverse ×) + gear-change penalty + steering terms + proximity
h  = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)
margin 0.15 m · analytic expansion: a Reeds–Shepp shot to the goal every 10 expansions,
                    every expansion within 2.5 m; accepted if collision-free</div>
<p><b>Space-time A*</b> (diff-drive) searches (x, y, t) on a 0.2 m grid with moves to the 8 neighbours or a wait, each costing its time at the reference speed. A cell is blocked at a time when a tracked agent's predicted disc, inflated by the robot radius and the clearance margin, covers it; past the prediction horizon only the static map counts. The path geometry goes to the tracker and the speed planner keeps the schedule.</p>
<p><b>Steering margin.</b> Planning at 100% of δ_max produces full-lock arcs. A tracker that starts such an arc slightly off has no steering left to correct with. By default the planners use 85%. Push it to 100% and watch the parking legs fail.</p>
<p>The two heuristics cover each other's blind spots. The 2D term sees walls but not turning; the Reeds–Shepp term sees turning but not walls. Collision checks use the car footprint (three covering circles) on the costmap distance field.</p>
<p>To give a goal a heading, use <b>Tap map to → Add posed goal</b> and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>
<p><b>Agents and the global plan.</b> The global plan ignores them on purpose: people move faster than a global plan stays valid, and the speed planner handles them. Only when it reports an agent blocking the path does the replan add that agent's predicted positions over the next 2 s to the costmap, for that one plan.</p>`,
 ctl:`<p><b>Pure pursuit</b> steers toward a carrot point an arc length L ahead on the path.</p>
<div class="eq">L = L₀ + k·v,   α = angle to carrot in body frame
κ = 2 sin α / L,   ω = v κ
v ≤ √(a_lat/|κ|),  v ≤ √(2 a d_goal)
if |ω| > ω_max: ω = ±ω_max, v = ω_max/|κ|   (keeps curvature)</div>
<p><b>PID heading</b> uses the same carrot: ω = Kp e + Ki∫e + Kd ė, with v = v_cruise · cos²e. Integral is clamped to ±1 rad·s.</p>
<p><b>DWA</b> (dynamic window) samples 7 × 15 (v, ω) pairs reachable within 0.25 s under the acceleration limits, rolls each out over the horizon, rejects those that hit perceived lidar points or cannot brake in time, and scores the rest:</p>
<div class="eq">J = w_g (‖end − carrot‖ + 0.3|heading err|) + w_o / clearance + w_v (v_top − v)</div>
<p>Without agent tracking DWA treats people as static at the moment of the scan. With tracking on, each rollout is checked against the agents' predicted positions at the same time step. MPC gets one clearance constraint per footprint circle and prediction step against the nearest predicted agent. With Response to agents set to Speed planning, its reference follows the ST profile, so the tracking cost asks it to yield instead of pulling it into people. The last step must also stay clear while the robot would wait there, out to T_p + 3 s, as in the speed planner's terminal cost. Each agent constraint is relaxed by what braking to a stop now would violate, so a person walking into the robot cannot make the problem infeasible.</p>
<p><b>Rear-wheel feedback</b> (Samson; Paden et al. 2016) projects the rear axle onto the path and commands a curvature: the path's own curvature as feedforward, plus heading and lateral feedback. It works for both models (ω = v·κ for diff-drive, δ = atan(L·κ) for the car).</p>
<div class="eq">κ_cmd = κ(s)·cos θe / (1 − κ(s)·e) − k_θ·θe − k_e·(sin θe / θe)·e
e: lateral offset (+ left),  θe: heading error,  κ(s) previewed 0.2 m ahead</div>
<p>Pure pursuit has no feedforward. On full-lock arcs it cuts the inside of the turn, which is why it struggles in the parking lot.</p>
<p><b>MPC</b> solves a finite-horizon optimal control problem every 50 ms and applies only the first move.</p>
<div class="eq">state  x = [x, y, θ, v, s]   s = ω (diff-drive) or δ (car)   (+ [v_cmd, s_cmd] if lag is modeled)
input  u = [a, ṡ]           so |a| ≤ a_max and |ṡ| ≤ rate limit are exact box constraints
model  θ_mid = θ + ½ω Δt,  x⁺ = x + v cos θ_mid Δt, …,  ω = v tan δ / L for the car

min  Σ_{k=1..Np} w_k (Q_lon e_lon² + Q_lat e_lat² + Q_θ e_θ² + Q_v e_v²)        w_Np = terminal ×
   + Σ_{k=0..Np−1} (R_a a_k² + R_s ṡ_k²) + R_Δ Σ_{k<Nc} ‖u_k − u_{k−1}‖²
s.t. u_k = u_{Nc−1} for k ≥ Nc (control horizon)
     speed sign and limit per leg, footprint clearance ≥ margin, |s| ≤ s_max  (augmented Lagrangian;
     s is also saturated inside the model, as the real actuator is)</div>
<p><b>Solver.</b> Single-shooting Gauss–Newton SQP. Each iteration rolls the model out, computes sensitivities ∂x_k/∂U from the Jacobians A_k and B_k, builds H = JᵀJ and g = Jᵀr over the 2·Nc decision variables, and solves the box-constrained QP by projected Newton. A backtracking line search on the true cost follows, then a multiplier update. It is warm-started from the previous solution shifted by one tick, which is the real-time-iteration idea.</p>
<p><b>NMPC</b> relinearizes about its own rollout every iteration, so it stays valid far from the path and can take nonconvex obstacle constraints. <b>LTV</b> linearizes once about the reference trajectory and predicts with that linear model, which makes it one convex QP. On the map, LTV's linear prediction is dashed and what those inputs really do is solid. The two separate when heading error is large.</p>
<p><b>Horizons.</b> Np is how far the model looks ahead. Nc is how many independent moves it may choose. Small Nc means fewer variables and smoother, less agile control. Nc = 1 is a single held command.</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>
<div class="eq">pure pursuit:  δ = atan(2 L_wb sin α / L_d)
Stanley:       δ = (θ_path − θ) − atan2(k · e_left, 0.5 + |v|)    e_left: front-axle offset, + = left of path</div>
<p>On reverse legs, pure pursuit and PID work in a virtual frame (heading θ + π, steering sign flipped). That is exact for the rear-axle point. Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>
<p><b>Response to agents with a path tracker: speed planning.</b> Pure pursuit, rear-wheel feedback, Stanley and PID only steer. To handle people the stack splits the problem (path–velocity decomposition): keep the path, choose the speed. The ST graph (Telemetry) has distance s ahead on the path against time t. A cell is blocked when the footprint at s overlaps a predicted agent at t, plus the clearance. Dynamic programming over (t, s, v) picks the profile:</p>
<div class="eq">v' = v + a Δt,   a ∈ {−b, −b/2, −b/5, 0, a_c/2, a_c},   Δt = 0.2 s, horizon T_p
J = Σ Δt [ (v_ref(s) − v)² + 0.3 a² + 3 · proximity ],   blocked cells forbidden
the speed at t = 0.2 s caps the tracker's speed; the commanded curvature is kept</div>
<p>a_c and b are the acceleration limit when limits are on, otherwise 0.8 and 1.5 m/s². If no profile avoids the agents the robot brakes. If that lasts about 1 s, or it has waited about 4 s, the behavior layer asks the global planner for a path around the agents' predicted positions. <b>Reactive stop</b> is the baseline without tracking or prediction: brake for any unexplained lidar hit in the footprint corridor ahead.</p>`,
 veh:`<p><b>Unicycle model</b>, a good first abstraction of a differential-drive robot.</p>
<div class="eq">ẋ = v cos θ,  ẏ = v sin θ,  θ̇ = ω     (exact arc integration, Δt = 50 ms)
command → saturate → first-order lag τ → rate limits → integrate</div>
<p><b>Odometry</b> reports the applied velocity with noise and an optional calibration bias, which models a wheel-radius mismatch. Filters model the noise but not the bias.</p>
<div class="eq">σ_v = k (0.1|v| + 0.02)      σ_ω = k (0.2|ω| + 0.1|v| + 0.02)
bias: v·(1 + 0.02 b),  ω + 0.01 b·v</div>
<p><b>Beacons:</b> range σ = 0.08 m, bearing σ = 0.03 rad (× noise scale), line-of-sight required. <b>Collisions</b> stop translation. The diff-drive robot can still turn in place.</p>
<p><b>Car-like (kinematic bicycle)</b>, pose at the rear-axle center.</p>
<div class="eq">ẋ = v cos θ,  ẏ = v sin θ,  θ̇ = v tan δ / L
|δ| ≤ δ_max  →  R_min = L / tan δ_max;   |δ̇| ≤ steering rate
command (v, δ) → lag τ → accel limit → steering-rate limit → integrate</div>
<p><b>Sensor latency</b> delays the lidar and beacon readings by whole ticks; the estimators process them as if current. <b>People</b> are scripted (back and forth on a segment, pausing at the ends) or reactive (social forces: goal attraction with relaxation time 0.5 s, exponential repulsion from the robot, other people and walls, speed capped at 1.3× their pace). <b>Other vehicles</b> follow a lane loop at constant speed and brake when the robot or a person is close ahead; the lidar sees them as three covering circles and the tracker as one wide cluster.</p>
<p>The car cannot turn in place: heading changes only while it moves. Physics uses the exact body rectangle. Planners and DWA use three covering circles, which overestimates the bumpers by about 0.14 m. Odometry still reports (v, ω), so localization works unchanged.</p>`,
};
