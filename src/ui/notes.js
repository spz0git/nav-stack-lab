// The Simulate tabs' "How it works" panels. Math is TeX, as in the lessons: $ … $ inline, $$ … $$ display. A template
// literal tagged TEX is rewritten by the build (tools/tex.mjs, texSource) into one holding MathML, so the page never
// sees the TeX; String.raw only keeps the source plain JS for the linter and the formatter.
const TEX = String.raw;
const NOTES = {
  sen: TEX`<p><b>Odometry</b> reports the applied speed and turn rate every 50 ms tick with two kinds of error. $k$ is the <b>noise</b> slider and $b$ the <b>calibration bias</b> slider; ×1 is the base model below.</p>
$$\begin{aligned}
v_\text{meas} &= v\,(1 + 0.02\,b) + \sigma_v\,\varepsilon_1, & \sigma_v &= k\,(0.1\,|v| + 0.02)\ \text{m/s} \\
\omega_\text{meas} &= \omega + 0.01\,b\,v + \sigma_\omega\,\varepsilon_2, & \sigma_\omega &= k\,(0.2\,|\omega| + 0.1\,|v| + 0.02)\ \text{rad/s}
\end{aligned}$$
<p>with $\varepsilon_1, \varepsilon_2 \sim \mathcal N(0, 1)$, fresh every tick. The filters assume $k_\text{filter} = (\text{assumed motion noise}) \times \max(k, 0.25)$ and $b = 0$.</p>
<p><b>Noise</b> is random and new every tick, so it partly averages out: the heading error it leaves grows like a random walk ($\sigma_\theta \propto \sqrt t$). At 0.8 m/s straight, ×1 is σ 0.10 m/s in speed and 0.10 rad/s (5.7°/s) in turn rate per reading. <b>Bias</b> models a wheel-radius mismatch: the same error every tick, in the same direction, so it never averages. Heading drift grows linearly in time and the position error it causes quadratically. At 0.8 m/s, ×1 is +1.6 cm/s and +0.008 rad/s (0.46°/s), about 28° of heading per minute. The filters model the noise (the Localize tab scales their assumption) but are never told about the bias, so only beacons or lidar can correct it.</p>
<p><b>Beacons:</b> range $\sigma_r$ = 0.08 m, bearing $\sigma_b$ = 0.03 rad (× noise scale), line-of-sight required. The beacon sensor (above) has the details.</p>
<p><b>The beacon sensor.</b> One scan every 0.2 s (5 Hz) reads every beacon that is on, 0.2 m to the sensor range (7 m by default) away and in line of sight (walls, shelves, cars and people block it completely; there is no partial signal). Each reading is range and bearing with Gaussian noise $\sigma_r$ = 0.08 m, $\sigma_b$ = 0.03 rad (1.7°), × the noise scale, the same at every distance; a bearing error moves the implied position sideways by $d\,\sigma_b$, so far beacons pin the pose less. Open <i>Beacon sensor</i> below the beacon chips for a live line per beacon.</p>
<p><b>Beacon availability.</b> Switch beacons off (the numbered chips, or the map's Beacon tool) or let them fail at random. While no beacon is in view the EKF and the particle filter only predict, exactly as dead reckoning does, and the ellipse grows; the first reading back pulls the estimate in. Dead reckoning never uses beacons, so the map draws no beacon readings for it. On the map a switched-off beacon is a grey hollow diamond with a stroke; one in a random outage is a hollow diamond.</p>
<p><b>Lidar.</b> 120 beams over 360°, 10 scans a second, each a range to the first surface along the beam with Gaussian noise $\sigma$ (Range noise). Nothing within the reach (8 m at most) reads as no return; so does a beam lost at random (Dropouts, on their own random stream, so the range noise is unchanged). Mapping treats a no-return beam as free floor out to the reach, so a short reach maps less and a lost beam can clear a cell it should not. Weather adds its own fading, dropouts, noise and returns from the air.</p>
<p><b>Timing.</b> Sensor latency holds the lidar, beacon, sonar and GNSS readings for whole ticks before the stack sees them; the odometry is never late.</p>`,
  loc: TEX`<p>The sensors the estimators read, with their noise models (the odometry's $\sigma_v$ and $\sigma_\omega$, the beacons' $\sigma_r$ and $\sigma_b$), are in the Sensors tab and its How it works. The filters assume $k_\text{filter} = (\text{assumed motion noise}) \times \max(k, 0.25)$ for the odometry's noise scale $k$, and no bias.</p>
<p><b>Dead reckoning</b> integrates measured $(v, \omega)$ through the exact arc model. Covariance is propagated but never corrected, so it only grows.</p>
$$\mu' = g(\mu, u) \qquad\qquad \Sigma' = G\,\Sigma\,G^\top + V M V^\top$$
<p>$g$ holds $(v, \omega)$ over the tick, $\Delta t$ = 50 ms:</p>
$$\begin{aligned}
x' &= x + \frac{v}{\omega}\bigl(\sin(\theta + \omega\Delta t) - \sin\theta\bigr) \\
y' &= y - \frac{v}{\omega}\bigl(\cos(\theta + \omega\Delta t) - \cos\theta\bigr) \\
\theta' &= \theta + \omega\Delta t
\end{aligned}$$
<p>and below $|\omega| = 10^{-6}$ the straight-line step $x' = x + v\Delta t\cos\theta$, $y' = y + v\Delta t\sin\theta$.</p>
$$G = \frac{\partial g}{\partial x} = \begin{bmatrix} 1 & 0 & -v\Delta t\sin\theta \\ 0 & 1 & v\Delta t\cos\theta \\ 0 & 0 & 1 \end{bmatrix}$$
$$V = \frac{\partial g}{\partial u} = \begin{bmatrix} \Delta t\cos\theta & 0 \\ \Delta t\sin\theta & 0 \\ 0 & \Delta t \end{bmatrix} \qquad M = \operatorname{diag}(\sigma_v^2, \sigma_\omega^2)$$
<p>$G$ and $V$ are the straight-line Jacobians, also used on arcs; $M$ is the assumed noise × the filter scale.</p>
<p><b>EKF</b> corrects with each beacon reading $z = [r, \varphi]$ at 5 Hz, using the Joseph-form covariance update.</p>
$$\hat z = \begin{bmatrix} \sqrt q \\ \operatorname{atan2}(\Delta y, \Delta x) - \theta \end{bmatrix}, \qquad q = \Delta x^2 + \Delta y^2$$
$$H = \begin{bmatrix} -\Delta x/\sqrt q & -\Delta y/\sqrt q & 0 \\ \Delta y/q & -\Delta x/q & -1 \end{bmatrix}$$
$$S = H\Sigma H^\top + Q, \qquad K = \Sigma H^\top S^{-1}, \qquad \mu \mathrel{+}= K\,(z - \hat z)$$
<p>Unlabeled beacons: the reading goes to the beacon with the smallest Mahalanobis distance $d^2 = \nu^\top S^{-1} \nu$, gated at $d^2 < 9.21$ ($\chi^2_2$, 99 %).</p>
<p><b>Particle filter</b> (Monte Carlo localization) samples the motion model per particle, weights by beacon likelihood with a robust floor, and resamples with the low-variance sampler when $N_\text{eff} < N/2$. Augmented MCL tracks short- and long-term likelihood averages ($\alpha_\text{fast} = 0.1$, $\alpha_\text{slow} = 0.001$) and, when the short-term average drops, replaces up to 25% of particles with poses drawn from the current beacon readings (sensor-resetting localization). That is what recovers from kidnapping.</p>
$$\begin{aligned}
&\text{predict:} && x_i \leftarrow g\bigl(x_i, (v + \sigma_v\varepsilon_1,\ \omega + \sigma_\omega\varepsilon_2)\bigr), \quad \varepsilon \sim \mathcal N(0, 1), \quad \sigma \ge 0.02 \\
&\text{weight:} && \log w_i \mathrel{+}= \sum_\text{readings} \log\Bigl(\max_j \exp\Bigl(-\tfrac12\Bigl[\frac{(r - \hat r_j)^2}{\sigma_r^2} + \frac{(b - \hat b_j)^2}{\sigma_b^2}\Bigr]\Bigr) + 10^{-3}\Bigr) \\
&\text{inject:} && (x, y) = m_j - (r + \sigma_r\varepsilon)(\cos\varphi, \sin\varphi), \quad \theta = \varphi - (b + \sigma_b\varepsilon), \quad \varphi \text{ uniform}
\end{aligned}$$
<p>$j$ is the labelled beacon, or the best-fitting one when unlabeled; $\hat r_j$ and $\hat b_j$ are predicted from particle $i$.</p>
<p>With a prior map the particle filter can also score lidar scans (likelihood field, 24 beams, $\sigma$ = 0.2 m, tempered by 0.4 because beams are correlated). Beacons alone are sparse; walls are everywhere. With $d$ the distance from a beam's end point (placed from particle $i$) to the nearest wall:</p>
$$\log w_i \mathrel{+}= 0.4 \sum_\text{beams} \log\bigl(0.9\,e^{-d^2/2\sigma^2} + 0.05\bigr)$$
<p>Like AMCL, the filter skips sensor updates until the robot has moved about 5 cm (or turned about 0.1 rad). Updating while parked would resample the same evidence over and over and collapse the particle set.</p>
<p><b>EKF-SLAM</b> adds the beacon positions to the state, $[x, y, \theta, m_1, m_2, \dots]$ with a full covariance. A beacon seen for the first time is placed from the current pose (inverse observation, with the Jacobians carrying the pose uncertainty into the landmark). Known IDs give the data association; with unlabeled beacons readings are matched to mapped landmarks inside the same $\chi^2$ gate and far-off readings start new landmarks. The pose is anchored only through landmarks mapped while it was certain, so the error drifts until loop closure.</p>
$$\begin{aligned}
&\text{predict:} && \text{pose} \leftarrow g(\text{pose}, u), \quad P_{xx} \leftarrow G P_{xx} G^\top + V M V^\top \\
&&& P_{xm} \leftarrow G P_{xm}, \quad \text{landmarks unchanged} \\
&\text{new:} && m = p + r \begin{bmatrix} \cos(\theta + b) \\ \sin(\theta + b) \end{bmatrix}, \quad P_{mm} = J_x P_{xx} J_x^\top + J_z R J_z^\top, \quad P_{mx} = J_x P_{xx} \\
&&& J_x = \begin{bmatrix} 1 & 0 & -r\sin(\theta + b) \\ 0 & 1 & r\cos(\theta + b) \end{bmatrix} \\
&&& J_z = \begin{bmatrix} \cos(\theta + b) & -r\sin(\theta + b) \\ \sin(\theta + b) & r\cos(\theta + b) \end{bmatrix} \\
&\text{update:} && \hat z_j = h(p, \theta, m_j) \text{ as for the EKF}, \quad \frac{\partial h}{\partial m_j} = -\frac{\partial h}{\partial p} \\
&&& P \leftarrow P - K S K^\top \ \text{(symmetrized)}
\end{aligned}$$
<p><b>Consistency check.</b> NEES $= e^\top \Sigma^{-1} e$ for the 3-state error. A consistent filter averages about 3. Well above that means the filter is more confident than its error justifies.</p>`,
  per: TEX`<p><b>Prior map</b> hands the planner the true static map. People never appear in it; they are only visible to the lidar.</p>
<p><b>Lidar mapping</b> casts 120 beams (360°, 8 m, 10 Hz) and updates a 0.1 m log-odds grid along each ray with Bresenham traversal. The grid is built in the <i>estimated</i> frame, so localization error shows up as smeared or doubled walls.</p>
$$l \leftarrow \operatorname{clamp}(l + l_\text{meas}, \pm 4), \qquad l_\text{free} = -0.4, \quad l_\text{hit} = +0.85, \qquad l = \ln\frac{p}{1 - p}$$
<p>A cell is occupied if $l > 0.5$ and unknown if $l \approx 0$. Inverse sensor model: $l_\text{hit}$ on the cell a returned beam ends in, $l_\text{free}$ on every cell before it (a beam at maximum range: $l_\text{free}$ on all of its cells).</p>
<p><b>Costmap.</b> A two-pass chamfer distance transform gives distance to the nearest occupied cell. Cells closer than 0.4 m (robot radius 0.3 m plus margin) are lethal; a quadratic penalty fades out across the inflation band.</p>
<p><b>Agent tracking.</b> The lidar tracker takes the hits the static map does not explain (prior map: more than 0.25 m from it; built map: cells that are not persistently occupied) and clusters them over consecutive beams. Clusters wider than 1.2 m are dropped as map error. Hits lie on the near side of a person, so the center is pushed $0.6\,r$ away from the sensor. Each track is a constant-velocity Kalman filter with state $x = [p_x, p_y, v_x, v_y]$ and white acceleration noise:</p>
$$x' = F x, \quad F = \begin{bmatrix} I & \Delta t\, I \\ 0 & I \end{bmatrix}, \qquad Q = \sigma_a^2 \begin{bmatrix} \tfrac{\Delta t^4}{4} I & \tfrac{\Delta t^3}{2} I \\ \tfrac{\Delta t^3}{2} I & \Delta t^2 I \end{bmatrix}$$
$$z = p + \text{noise}\ (\sigma_z = 0.1\text{ m}), \qquad \text{gate: } d^2 = \frac{\lVert z - \hat p \rVert^2}{P_{pp} + \sigma_z^2} < 9.21 \quad (\chi^2_2,\ 99\,\%)$$
<p>Assignment is greedy nearest-neighbour; a track is confirmed after 3 hits and coasts up to 1 s unseen. Its prediction is $p(t) = p + v\,t$, with radius $r(t) = r + g\,t$.</p>
<p><b>Ground truth</b> hands over true positions and velocities, which separates prediction error from tracking error. Hits that belong to confirmed tracks are taken out of the static obstacle set the local planners see; the predictions replace them. People do not react to the robot, so this is prediction without interaction.</p>`,
  mis: TEX`<p>The behavior layer is a small state machine. Watch its state in the status bar and its transitions in the event log.</p>
$$\begin{aligned}
\text{IDLE} &\;\to\; \text{PLAN} && \text{Run} \\
\text{PLAN} &\;\to\; \text{DRIVE} && \text{a path is found} \\
\text{DRIVE} &\;\to\; \text{PLAN} && \text{arrived: the next goal (DONE after the last)} \\
\text{PLAN} &\;\to\; \text{NO\_PATH} && \text{no path} \\
\text{NO\_PATH} &\;\to\; \text{PLAN} && \text{after 2 s (the goal is skipped after 3 tries)} \\
\text{DRIVE} &\;\to\; \text{LOST} && \text{guard on and } \sigma_\text{pos} > 1\text{ m} \\
\text{LOST} &\;\to\; \text{PLAN} && \sigma_\text{pos} < 0.4\text{ m}
\end{aligned}$$
<p>DRIVE goes back to PLAN when the path is blocked in the costmap, when the robot is off the path (estimate more than 1 m from it), when an agent blocks it (speed planner), when it is stuck (less than 0.15 m in 5 s; skip after 3), and on a periodic timer.</p>
<p><b>Arrival is declared on the estimate</b> (0.25 m). The log reports the true distance at that moment, so localization error shows up as missed goals.</p>
<p><b>Goals with a heading</b> (map tool H: press and drag the way the robot should face; the goal shows an arrow). The unicycle drives to the point, then stops and turns in place, $\omega = 2.5\,(\theta_\text{goal} - \hat\theta)$ within the turn-rate limit, until the estimate is within 2° of the heading. The car arrives posed with Hybrid A* or Reeds–Shepp (within 0.2 m and 11°); A*, RRT* and Straight plan to a point, so the car reports the heading and does not wait for it.</p>
<p><b>Ordering.</b> Greedy and Optimal build a cost matrix by running Dijkstra on the costmap from the robot and every goal. Optimal solves the open-path TSP by branch-and-bound enumeration, fine up to about 8 waypoints.</p>`,
  plan: TEX`<p><b>Straight line</b> ignores obstacles. The event-driven blocked-path check is disabled for it, so it fails honestly.</p>
<p><b>A*</b> on the 0.1 m costmap grid, 8-connected, no corner cutting. The heuristic $h$ is the octile distance, which is admissible:</p>
$$\begin{aligned}
f &= g + \varepsilon\,h \\
h &= \bigl(\max(\Delta i, \Delta j) + (\sqrt 2 - 1)\min(\Delta i, \Delta j)\bigr) \cdot 0.1\text{ m} \\
\text{edge cost} &= \text{length} \cdot (1 + 3 \cdot \text{penalty})
\end{aligned}$$
<p>$\varepsilon > 1$ makes it weighted A*: the cost is at most $\varepsilon$ × optimal, with fewer expansions.</p>
<p><b>RRT*</b> grows a tree by sampling (10% goal bias, 0.6 m steer), chooses the cheapest parent in a shrinking radius $r = \min\bigl(8\sqrt{\log n / n},\ 1.5\text{ m}\bigr)$ and rewires neighbors. It is asymptotically optimal; with a finite budget it is just "good".</p>
<p><b>Smoothing</b> greedily replaces the path with the farthest visible path point, keeping 0.5 m clearance.</p>
<p><b>Reeds–Shepp</b> (car only) is the shortest path for a car that drives forward and backward with a minimum turning radius, ignoring obstacles. It has a closed-form solution over 48 path words such as $L^+S^+R^-$ (left forward, straight forward, right reverse).</p>
<p><b>Hybrid A*</b> (car only) searches cells of 0.2 m × 5°, but each node keeps its continuous pose, so every edge is a drivable arc: 5 steering angles × forward/reverse, 0.4 m each. An edge is a bicycle arc of curvature $\kappa = \tan\delta / L$ over $s = \pm 0.4$ m, with $\delta \in \{-\delta_p, -\delta_p/2, 0, \delta_p/2, \delta_p\}$ and $\delta_p$ = steering margin × $\delta_{\max}$, taken in four 0.1 m steps with the footprint checked:</p>
$$x' = x + \frac{\sin(\theta + \kappa s) - \sin\theta}{\kappa}, \quad y' = y - \frac{\cos(\theta + \kappa s) - \cos\theta}{\kappa}, \quad \theta' = \theta + \kappa s$$
$$\begin{aligned}
g &\mathrel{+}= \text{length} \cdot (1 \text{ or reverse} \times) + \text{gear-change penalty} \\
&\qquad + \text{steering terms} + \text{proximity} \\
&= 0.4 \cdot (1 \text{ or } 2) + 2 \cdot [\text{gear change}] + 0.05\,\frac{|\delta|}{\delta_p} \\
&\qquad + 0.1\,\frac{|\delta - \delta_\text{prev}|}{\delta_p} + 0.8 \max\Bigl(0, \frac{0.4 - \text{clearance}}{0.4}\Bigr)^2 \\
h &= \varepsilon \cdot \max(\text{2D Dijkstra with obstacles},\ \text{Reeds–Shepp without obstacles})
\end{aligned}$$
<p>Margin 0.15 m. Analytic expansion: a Reeds–Shepp shot to the goal every 10 expansions, and every expansion within 2.5 m of the goal; it is accepted if collision-free.</p>
<p><b>Space-time A*</b> (diff-drive) searches $(x, y, t)$ on a 0.2 m grid with moves to the 8 neighbours or a wait, each costing its time at the reference speed. A cell is blocked at a time when a tracked agent's predicted disc, inflated by the robot radius and the clearance margin, covers it; past the prediction horizon only the static map counts. The path geometry goes to the tracker and the speed planner keeps the schedule.</p>
$$\begin{aligned}
&\text{blocked}(i, j, k) \ \text{ if } \ \lVert c_{ij} - p_a(k\Delta t) \rVert < r_a(k\Delta t) + r_\text{robot} + \text{margin} \\
&p_a(t) = p_a + v_a t, \quad r_a(t) = r_a + g\,t, \qquad \Delta t = 0.2\text{ m} / v_\text{ref} \\
&\text{move: } \Delta t\,(1 \text{ or } \sqrt 2) + 0.3\,\Delta t \cdot \text{penalty}, \qquad \text{wait: } 1.2\,\Delta t \\
&h = \text{octile distance} \cdot \Delta t / \text{cell}
\end{aligned}$$
<p><b>Steering margin.</b> Planning at 100% of $\delta_{\max}$ produces full-lock arcs. A tracker that starts such an arc slightly off has no steering left to correct with. By default the planners use 85%. Push it to 100% and watch the parking legs fail.</p>
<p>The two heuristics cover each other's blind spots. The 2D term sees walls but not turning; the Reeds–Shepp term sees turning but not walls. Collision checks use the car footprint (three covering circles) on the costmap distance field.</p>
<p>To give a goal a heading, use the map's <b>Goal with heading</b> tool and drag in the direction the car should face. Goals without a heading are accepted at any heading.</p>
<p><b>Agents and the global plan.</b> The global plan ignores them on purpose: people move faster than a global plan stays valid, and the speed planner handles them. Only when it reports an agent blocking the path does the replan add that agent's predicted positions over the next 2 s to the costmap, for that one plan.</p>`,
  ctl: TEX`<p><b>Pure pursuit</b> steers toward a carrot point an arc length $L$ ahead on the path; $\alpha$ is the angle to the carrot in the body frame.</p>
$$\begin{aligned}
L &= L_0 + k\,v, & \kappa &= \frac{2\sin\alpha}{L}, & \omega &= v\,\kappa \\
v &\le \sqrt{a_\text{lat}/|\kappa|}, & v &\le \sqrt{2\,a\,d_\text{goal}}
\end{aligned}$$
<p>If $|\omega| > \omega_{\max}$, then $\omega = \pm\omega_{\max}$ and $v = \omega_{\max}/|\kappa|$, which keeps the curvature.</p>
<p><b>PID heading</b> uses the same carrot: $\omega = K_p e + K_i \int e + K_d \dot e$, with $v = v_\text{cruise} \cos^2 e$. Integral is clamped to ±1 rad·s.</p>
<p><b>DWA</b> (dynamic window) samples 7 × 15 $(v, \omega)$ pairs reachable within 0.25 s under the acceleration limits, rolls each out over the horizon, rejects those that hit perceived lidar points or cannot brake in time, and scores the rest:</p>
$$J = w_g\bigl(\lVert \text{end} - \text{carrot} \rVert + 0.3\,|\text{heading err}|\bigr) + \frac{w_o}{\text{clearance}} + w_v\,(v_\text{top} - v)$$
<p>A rollout holds $(v, \omega)$ for $T$ (1.6 s) in 0.1 s steps of the arc model (the car samples $\delta$, with $\omega = v\tan\delta / L$). It is rejected if its clearance is below 0.05 m or $v > \sqrt{2\,a_{\max} \cdot \text{clearance}}$.</p>
<p>Without agent tracking DWA treats people as static at the moment of the scan. With tracking on, each rollout is checked against the agents' predicted positions at the same time step. MPC gets one clearance constraint per footprint circle and prediction step against the nearest predicted agent. With Response to agents set to Speed planning, its reference follows the ST profile, so the tracking cost asks it to yield instead of pulling it into people. The last step must also stay clear while the robot would wait there, out to $T_p$ + 3 s, as in the speed planner's terminal cost. Each agent constraint is relaxed by what braking to a stop now would violate, so a person walking into the robot cannot make the problem infeasible.</p>
<p><b>Rear-wheel feedback</b> (Samson; Paden et al. 2016) projects the rear axle onto the path and commands a curvature: the path's own curvature as feedforward, plus heading and lateral feedback. It works for both models ($\omega = v\kappa$ for diff-drive, $\delta = \arctan(L\kappa)$ for the car).</p>
$$\kappa_\text{cmd} = \frac{\kappa(s)\cos\theta_e}{1 - \kappa(s)\,e} - k_\theta\,\theta_e - k_e\,\frac{\sin\theta_e}{\theta_e}\,e$$
<p>$e$ is the lateral offset (positive to the left), $\theta_e$ the heading error, and $\kappa(s)$ is previewed 0.2 m ahead. Pure pursuit has no feedforward. On full-lock arcs it cuts the inside of the turn, which is why it struggles in the parking lot.</p>
<p><b>MPC</b> solves a finite-horizon optimal control problem every 50 ms and applies only the first move. The state is $x = [x, y, \theta, v, s]$ with $s = \omega$ (diff-drive) or $\delta$ (car), plus $[v_\text{cmd}, s_\text{cmd}]$ if lag is modeled. The input is $u = [a, \dot s]$, so $|a| \le a_{\max}$ and $|\dot s| \le$ rate limit are exact box constraints. The model steps by the midpoint rule:</p>
$$\begin{aligned}
\theta_\text{mid} &= \theta + \tfrac12\,\omega\,\Delta t, \qquad \omega = s \text{ (diff-drive) or } v\tan\delta / L \text{ (car)} \\
x^+ &= x + v\cos\theta_\text{mid}\,\Delta t, \qquad y^+ = y + v\sin\theta_\text{mid}\,\Delta t, \qquad \theta^+ = \theta + \omega\,\Delta t \\
v^+ &= v + a\,\Delta t, \qquad s^+ = \operatorname{sat}(s + \dot s\,\Delta t)
\end{aligned}$$
<p>With lag modeled, $v^+ = v + (v_\text{cmd} - v)\bigl(1 - e^{-\Delta t/\tau}\bigr)$ and $s^+$ likewise, while $v_\text{cmd}^+ = v_\text{cmd} + a\,\Delta t$ and $s_\text{cmd}^+ = \operatorname{sat}(s_\text{cmd} + \dot s\,\Delta t)$.</p>
$$\begin{aligned}
\min\ & \sum_{k=1}^{N_p} w_k \bigl(Q_\text{lon} e_\text{lon}^2 + Q_\text{lat} e_\text{lat}^2 + Q_\theta e_\theta^2 + Q_v e_v^2\bigr) \qquad (w_{N_p} = \text{terminal} \times) \\
& + \sum_{k=0}^{N_p - 1} \bigl(R_a a_k^2 + R_s \dot s_k^2\bigr) + R_\Delta \sum_{k < N_c} \lVert u_k - u_{k-1} \rVert^2 \\
\text{s.t.}\ & u_k = u_{N_c - 1} \text{ for } k \ge N_c \ \text{(control horizon)} \\
& \text{speed sign and limit per leg}, \quad \text{footprint clearance} \ge \text{margin}, \quad |s| \le s_{\max}
\end{aligned}$$
<p>The constraints are handled by an augmented Lagrangian; $s$ is also saturated inside the model, as the real actuator is.</p>
<p><b>Solver.</b> Single-shooting Gauss–Newton SQP. Each iteration rolls the model out, computes sensitivities $\partial x_k / \partial U$ from the Jacobians $A_k$ and $B_k$, builds $H = J^\top J$ and $g = J^\top r$ over the $2N_c$ decision variables, and solves the box-constrained QP by projected Newton. A backtracking line search on the true cost follows, then a multiplier update. It is warm-started from the previous solution shifted by one tick, which is the real-time-iteration idea.</p>
<p><b>NMPC</b> relinearizes about its own rollout every iteration, so it stays valid far from the path and can take nonconvex obstacle constraints. <b>LTV</b> linearizes once about the reference trajectory and predicts with that linear model, which makes it one convex QP. On the map, LTV's linear prediction is dashed and what those inputs really do is solid. The two separate when heading error is large.</p>
<p><b>Horizons.</b> $N_p$ is how far the model looks ahead. $N_c$ is how many independent moves it may choose. Small $N_c$ means fewer variables and smoother, less agile control. $N_c = 1$ is a single held command.</p>
<p><b>Car-like model.</b> Pure pursuit outputs steering directly. Stanley uses the front axle as its reference point.</p>
$$\begin{aligned}
\text{pure pursuit:}\quad \delta &= \arctan\frac{2 L_\text{wb} \sin\alpha}{L_d} \\
\text{Stanley:}\quad \delta &= (\theta_\text{path} - \theta) - \operatorname{atan2}\bigl(k\,e_\text{left},\ 0.5 + |v|\bigr)
\end{aligned}$$
<p>$e_\text{left}$ is the front axle's offset, positive left of the path. On reverse legs, pure pursuit and PID work in a virtual frame (heading $\theta + \pi$, steering sign flipped). That is exact for the rear-axle point. Stanley's reference point would trail on a reverse leg, so reverse legs fall back to pure pursuit. A leg ends within 0.12 m of its cusp. The built-in car controllers hold speed until the wheels reach the commanded angle (dry steering), and reverse legs are capped at 0.35 m/s.</p>
<p><b>Response to agents with a path tracker: speed planning.</b> Pure pursuit, rear-wheel feedback, Stanley and PID only steer. To handle people the stack splits the problem (path–velocity decomposition): keep the path, choose the speed. The ST graph (Telemetry) has distance $s$ ahead on the path against time $t$. A cell is blocked when the footprint at $s$ overlaps a predicted agent at $t$, plus the clearance. Dynamic programming over $(t, s, v)$ picks the profile:</p>
$$\begin{aligned}
v' &= v + a\,\Delta t, \qquad a \in \{-b, -b/2, -b/5, 0, a_c/2, a_c\}, \qquad \Delta t = 0.2\text{ s, horizon } T_p \\
J &= \sum \Delta t\,\bigl[(v_\text{ref}(s) - v)^2 + 0.3\,a^2 + 3 \cdot \text{proximity}\bigr], \qquad \text{blocked cells forbidden}
\end{aligned}$$
<p>The speed at $t$ = 0.2 s caps the tracker's speed; the commanded curvature is kept. $a_c$ and $b$ are the acceleration limit when limits are on, otherwise 0.8 and 1.5 m/s². If no profile avoids the agents the robot brakes. If that lasts about 1 s, or it has waited about 4 s, the behavior layer asks the global planner for a path around the agents' predicted positions. <b>Reactive stop</b> is the baseline without tracking or prediction: brake for any unexplained lidar hit in the footprint corridor ahead.</p>`,
  veh: TEX`<p><b>Unicycle model</b>, a good first abstraction of a differential-drive robot.</p>
$$\dot x = v\cos\theta, \qquad \dot y = v\sin\theta, \qquad \dot\theta = \omega$$
<p>It is integrated exactly over each tick of $\Delta t$ = 50 ms (a straight line if $\omega \approx 0$):</p>
$$\begin{aligned}
x' &= x + \frac{v}{\omega}\bigl(\sin(\theta + \omega\Delta t) - \sin\theta\bigr) \\
y' &= y - \frac{v}{\omega}\bigl(\cos(\theta + \omega\Delta t) - \cos\theta\bigr) \\
\theta' &= \theta + \omega\Delta t
\end{aligned}$$
$$\text{command} \to \text{saturate} \to \text{first-order lag } \tau \to \text{rate limits} \to \text{integrate}$$
<p>The lag is $u \leftarrow u + (u_\text{cmd} - u)\bigl(1 - e^{-\Delta t/\tau}\bigr)$ for $v$ and $\omega$; with acceleration limits on, $|\dot v| \le a_{\max}$ and $|\dot\omega| \le \alpha_{\max}$.</p>
<p><b>Collisions</b> stop translation. The diff-drive robot can still turn in place. The odometry and beacon sensors are described under Localize.</p>
<p><b>Car-like (kinematic bicycle)</b>, pose at the rear-axle center.</p>
$$\dot x = v\cos\theta, \qquad \dot y = v\sin\theta, \qquad \dot\theta = \frac{v\tan\delta}{L}$$
$$|\delta| \le \delta_{\max} \ \Rightarrow\ R_{\min} = \frac{L}{\tan\delta_{\max}}, \qquad |\dot\delta| \le \text{steering rate}$$
$$\text{command } (v, \delta) \to \text{lag } \tau \to \text{accel limit} \to \text{steering-rate limit} \to \text{integrate}$$
<p>The integration takes $\omega = v\tan\delta / L$ and then the unicycle arc above, exact for $v$ and $\delta$ held over the tick.</p>
<p><b>Sensor latency</b> delays the lidar and beacon readings by whole ticks; the estimators process them as if current. <b>People</b> are scripted (back and forth on a segment, pausing at the ends) or reactive (social forces: goal attraction with relaxation time 0.5 s, exponential repulsion from the robot, other people and walls, speed capped at 1.3× their pace). <b>Other vehicles</b> follow a lane loop at constant speed and brake when the robot or a person is close ahead; the lidar sees them as three covering circles and the tracker as one wide cluster. Reactive people move by</p>
$$\begin{aligned}
\dot v &= \frac{v_0\,e - v}{\tau} + \sum_j A \exp\Bigl(\frac{r + r_j - d_j}{B}\Bigr) n_j \\
&\qquad + A_r \exp\Bigl(\frac{r + r_\text{robot} - d}{B_r}\Bigr) n + A_w \exp\Bigl(\frac{r - D}{B_w}\Bigr) \nabla D \\
v &\leftarrow v + \dot v\,\Delta t, \quad |v| \le 1.3\,v_0, \qquad p \leftarrow p + v\,\Delta t
\end{aligned}$$
<p>where $e$ is the unit vector to the goal and $n$ the unit vector away from the other body; $\tau$ = 0.5 s, $A = 2$ and $B$ = 0.35 m (people), $A_r = 3$ and $B_r$ = 0.5 m (robot), $A_w = 2.5$ and $B_w$ = 0.25 m (walls, with $D$ the distance field).</p>
<p>The car cannot turn in place: heading changes only while it moves. Physics uses the exact body rectangle. Planners and DWA use three covering circles, which overestimates the bumpers by about 0.14 m. Odometry still reports $(v, \omega)$, so localization works unchanged.</p>`
};
