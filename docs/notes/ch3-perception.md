id: ch3
num: 3
sys: per
summary: The derivations behind the Perception lessons: the binary Bayes filter behind log-odds mapping, the distance transform and inflation cost, lidar clustering, the constant-velocity Kalman tracker and its gains, prediction with growing uncertainty, what sensor latency does to each estimator, and the social-force model of people.

# Perception: maps, costs and people

Perception turns raw sensor returns into the three things the rest of the stack consumes: a map of what is static, a cost for every cell the planner may enter, and a list of things that move with a guess of where they will be. This chapter derives the versions of each that run in the lab, in the order of the Perception lessons: log-odds mapping (lesson 1), the costmap (lesson 2), tracking and prediction (lesson 3), what latency does to all of it (lesson 4) and the model of people that react (lesson 5). The blue numbers follow your settings: the lidar noise is σ = {{live:lidarSig}} m, the inflation band {{live:infl}} m, the tracker's process noise σ<sub>a</sub> = {{live:agSigA}} m/s², the prediction horizon {{live:agT}} s, and sensor latency is {{live:sensLat}} s.

## 1. Everything is in the estimated frame

A lidar return is a range along a known beam direction *relative to the robot*. To put it on a map, or to compare it with a map, the robot has to know where it is, so every hit is placed with the current pose estimate:

$$
p_k = \hat p + r_k\,[\cos(\hat\theta + \alpha_k),\ \sin(\hat\theta + \alpha_k)], \qquad \alpha_k = -\pi + k\,\frac{2\pi}{120}
$$

If the estimate is off by $(\delta_x, \delta_y, \delta_\theta)$, every hit is off by the same translation plus $r_k\,\delta_\theta$ across the beam. That is the whole relationship between chapter 2 and this one: a map is only as good as the localization that placed its hits, and a drifting estimate does not make a blurry map, it makes a map with the same wall drawn several times. The lab's lidar has 120 beams over 360°, 8 m range, 10 Hz, and Gaussian range noise σ = {{live:lidarSig}} m; on the levels with mapping, localization runs on the EKF with beacons, so the frame error is centimetres, which is why the first mapping experiment looks clean and the second, on dead reckoning, does not.

## 2. Occupancy mapping as a binary Bayes filter

**One cell.** Treat each 0.1 m cell as a binary variable, occupied or not, that does not change (the static-world assumption), and treat the beams as independent evidence about it. Bayes' rule for the cell after a measurement $z$ is

$$
p(m \mid z_{1:t}) = \frac{p(z_t \mid m)\, p(m \mid z_{1:t-1})}{p(z_t)}
$$

and the same for $\neg m$. Dividing the two removes the normalizer, and taking logs turns the product into a sum. With the log-odds $l = \ln\frac{p(m)}{1 - p(m)}$ and an inverse sensor model written in the same units,

$$
l_t = l_{t-1} + \underbrace{\ln\frac{p(m \mid z_t)}{1 - p(m \mid z_t)}}_{l_{\text{meas}}} - \underbrace{\ln\frac{p(m)}{1 - p(m)}}_{l_0}
$$

With the prior $p(m) = 0.5$, $l_0 = 0$ and the update is one addition per cell per beam. That is the entire reason for log-odds: a Bayes update that is a multiply-and-normalize in probability becomes an add in log-odds, and a cell seen a hundred times costs the same as one seen once.

**The inverse sensor model.** A beam that returns at range $r$ says the cells along it are probably free and the cell it ends in is probably occupied. The lab uses $l_{\text{free}} = -0.4$ for every cell the beam crosses and $l_{\text{hit}} = +0.85$ for the end cell when the beam returned (a beam at maximum range marks free cells and no hit). In probabilities those are $p(m \mid \text{crossed}) = 0.40$ and $p(m \mid \text{end}) = 0.70$: a single hit is enough to call a cell occupied at the threshold $l > 0.5$ ($p > 0.62$), and it takes about two clean passes through a cell to undo one hit. The asymmetry is deliberate; a false "occupied" costs a detour, a false "free" costs a collision.

**Clamping.** Log-odds are capped at ±4, which is $p = 0.982$. Without a cap a wall seen for a minute at 10 Hz would sit at $l \approx 500$ and could never be erased when the pallet moves; with it, a cell can always change its mind in about ten contradicting beams. The threshold for "unknown" used by the costmap is $|l| < 0.05$: untouched cells only.

**Tracing the beam.** Each beam is walked cell by cell from the robot's cell to the end cell with Bresenham's line algorithm, 120 beams every 0.1 s, so the map absorbs about 1200 beams per second of a few dozen cells each. The costmap is rebuilt from the log-odds every 0.5 s.

**What a frame error does.** A hit placed from a pose that is 1 m off lands 1 m from the wall it came from. The next scan, from a slightly different wrong pose, lands somewhere else. Over a minute of dead reckoning the wall is painted as a smear of parallel ghosts, and free-space evidence from later scans crosses the earlier ghosts and partly erases them, so the map ends up with fragments of walls that do not exist and gaps in walls that do. Lesson 1 measures it: with the EKF, 100 % of the cells the map calls occupied have a real obstacle within one cell and 96 % of the seen obstacle cells are mapped; with dead reckoning the same numbers are 23 % and 18 %.

[try: Map the building, EKF | {"sim":true,"level":3,"tab":"per"}] [try: Map with dead reckoning | {"sim":true,"level":3,"set":{"loc":"dr"},"tab":"per"}]

## 3. The costmap: distance transform and inflation

**From occupancy to distance.** The planner needs, for every cell, how far the nearest obstacle is. Computing that exactly for 38 400 cells against every occupied cell is too slow at 2 Hz, so the lab uses a two-pass chamfer distance transform: sweep the grid forward and take the minimum over the already-visited neighbours with weights 1 (straight) and $\sqrt 2$ (diagonal), then sweep backward and do the same. Two passes, eight neighbours, no searching. The result is the length of the shortest 8-connected path to an obstacle, which over-estimates the Euclidean distance by at most about 8 % (at angles between the straight and diagonal directions), an error on the safe side.

**Lethal and the band.** The robot is a disc of radius 0.3 m, so any cell closer than 0.3 m to an obstacle would put the body inside it; the lab adds a 0.1 m margin for the sins of tracking and calls cells with $d < 0.4$ m lethal. Beyond that, a penalty fades out across the inflation band of width $w$ = {{live:infl}} m:

$$
\text{penalty}(d) = \left(\frac{0.4 + w - d}{w}\right)^2 \text{ for } 0.4 \le d < 0.4 + w, \qquad \text{edge cost} = \text{length} \times (1 + 3\,\text{penalty})
$$

Quadratic, so a path pays little for brushing the outer edge of the band and a lot for hugging the lethal boundary; the factor 3 means a cell at the inner edge costs four times its length. The planner is free to enter the band when the alternative is longer by more than that; the band is a preference, not a wall. That is also why widening it to 1.4 m in lesson 2 changes the path in open floor (it moves to the middle of aisles) but not through a doorway narrower than the band: there every route pays the same penalty, and the planner simply pays it.

**Unknown cells.** On a map being built, most cells have never been seen. "Unknown is free" lets the planner plan into rooms it has not entered, which is optimistic and is corrected by replanning as walls appear. "Unknown is lethal" refuses to plan anywhere unseen, which is safe and useless on its own: the goal is in unknown space, so there is no path, and the mission skips every goal in the first 17 s of lesson 2's third experiment. What makes the cautious choice workable is a separate behaviour that drives toward the boundary between seen and unseen, frontier exploration, which this lab does not implement.

[try: The cost layer | {"sim":true,"level":1,"layers":{"cost":true},"tab":"per"}] [try: Inflation 1.4 m | {"sim":true,"level":1,"set":{"infl":1.4},"layers":{"cost":true},"tab":"per"}]

## 4. Finding people in a scan

A person is a cluster of lidar hits that the static map cannot explain. The lab calls a hit explained when the costmap distance at its cell is under 0.25 m (against a known map), or, on a map being built, when any neighbouring cell has log-odds above 2.0, meaning it has been seen occupied several times; a person who stood still for a while becomes "map" and stops being tracked, which is a real failure mode of this design. The unexplained hits are grouped over consecutive beams: a hit joins the current cluster if it is within 0.45 m of the previous hit and at most one beam was skipped, and the first and last clusters are joined when the scan wraps around behind the robot. Clusters wider than 1.2 m are discarded (2.2 m on the level with vehicles), which removes most furniture and all walls that slipped through.

Two corrections make the centroid usable. Lidar only sees the near side of a body, so the centroid of the hits is biased toward the robot; the lab pushes it away by 0.6 of the estimated radius. And the radius is estimated from the cluster's extent, clamped to 0.3–0.55 m for people, and smoothed into the track with a factor 0.2 per update so that a half-seen person does not shrink.

## 5. Tracking: a constant-velocity Kalman filter

**The model.** Each confirmed person is a state $[p_x, p_y, v_x, v_y]$ and the assumption is that velocity is constant except for random accelerations. For one axis over an update interval $\Delta t$:

$$
\begin{bmatrix} p \\ v \end{bmatrix}_{t+1} = \underbrace{\begin{bmatrix} 1 & \Delta t \\ 0 & 1 \end{bmatrix}}_{F} \begin{bmatrix} p \\ v \end{bmatrix}_t + \begin{bmatrix} \Delta t^2/2 \\ \Delta t \end{bmatrix} a, \qquad a \sim \mathcal N(0, \sigma_a^2)
$$

The acceleration enters through the vector $\Gamma = [\Delta t^2/2, \Delta t]^{\mathsf T}$, so the process noise covariance is $Q = \Gamma \sigma_a^2 \Gamma^{\mathsf T}$:

$$
Q = \sigma_a^2 \begin{bmatrix} \Delta t^4/4 & \Delta t^3/2 \\ \Delta t^3/2 & \Delta t^2 \end{bmatrix}
$$

which is exactly the "a, b, c" update in the lab's tracker. The two axes share one covariance because the noise is isotropic, so the filter stores three numbers, $P_{pp}, P_{pv}, P_{vv}$, not sixteen. The measurement is position only, $z = p + \nu$, $\nu \sim \mathcal N(0, \sigma_z^2)$ with $\sigma_z$ = 0.1 m. Velocity is never measured. It is inferred by the filter from how the position innovations accumulate, which is the source of everything that is hard about tracking.

**The gains, and why velocity lags.** With the models above the Kalman gain settles to a steady state that depends on one dimensionless number, the tracking index $\lambda = \sigma_a \Delta t^2 / \sigma_z$: how much the target can move unpredictably in one update, measured in sensor noise. With your settings, σ<sub>a</sub> = {{live:agSigA}} m/s², Δt = 0.1 s and σ<sub>z</sub> = 0.1 m, λ = {{live:lam}}, and the steady-state gains are α = {{live:alpha}} on position and β = {{live:beta}} on velocity, meaning each update moves the position estimate a fraction α of the way to the measurement and adds β × innovation / Δt to the velocity. (These are the closed-form α–β filter gains, $\alpha = -\tfrac18\left(\lambda^2 + 8\lambda - (\lambda + 4)\sqrt{\lambda^2 + 8\lambda}\right)$, $\beta = \tfrac14\left(\lambda^2 + 4\lambda - \lambda\sqrt{\lambda^2 + 8\lambda}\right)$.) The error dynamics have eigenvalues of magnitude $\sqrt{1 - \alpha}$ per update, a time constant of {{live:tauv}} s, so a sudden change of a person's velocity takes two to three times that to be fully reflected in the track, during which the prediction points the wrong way. Raise σ<sub>a</sub> and the track follows faster and jitters more; lower it and the velocity is smooth and late. Lesson 3's run measures the compromise: a mean velocity error of about 0.14 m/s against walking speeds of 0.6 to 0.9 m/s.

**Association and lifecycle.** Each detection is compared with each predicted track by the Mahalanobis distance of its position, $d^2 = \|z - \hat p\|^2 / (P_{pp} + \sigma_z^2) < 9.21$, the same χ²₂ gate as chapter 2, and pairs are taken greedily in order of increasing $d^2$, each track and detection used once. Detections that matched nothing start a tentative track with $P_{pp} = \sigma_z^2$ and $P_{vv}$ = 1, which is a velocity known to ±1 m/s, i.e. not at all. A track is confirmed after three hits, so a single stray cluster never becomes a person; a tentative track that misses an update for 0.25 s is dropped, a confirmed one coasts on its prediction for 1 s before it is, so a person walking behind a pillar keeps their track. Velocities are capped at 2.5 m/s.

[try: Lidar tracker | {"sim":true,"level":4,"tab":"per"}] [try: Ground-truth tracks | {"sim":true,"level":4,"set":{"agents":"truth"},"tab":"per"}]

## 6. Prediction, and why the radius grows

The planner needs where the person will be, not where they are. Constant-velocity prediction extrapolates the track, and the uncertainty of that extrapolation grows with the horizon, from the velocity uncertainty in the track and from the fact that people change their minds:

$$
p(t) = p + v\,t, \qquad r(t) = r + g\,t
$$

The lab does not propagate the track covariance through time for the planner; it inflates the person's radius linearly at $g$ = {{live:agGrow}} m/s out to a horizon of {{live:agT}} s, so a person of radius 0.35 m is a disc of {{live:rAtT}} m at the end of the horizon. Linear growth is the cheap stand-in for the $\sqrt{P_{vv}}\,t$ a covariance would give, and it is what the space-time planner and the speed planner of chapter 4 block cells with. Freezing the prediction ($v = 0$ for planning, radius constant) is the other extreme: the planner reacts to where people are now, which looks reasonable and is wrong by $v \times$ (reaction time) every time, the extra contacts in lesson 3's third experiment.

[try: Prediction frozen | {"sim":true,"level":4,"set":{"agPred":"static"},"tab":"per","plot":"st"}]

## 7. Latency: the reading is true, the time is wrong

Real sensors deliver late: exposure, transfer, processing. The lab queues each lidar scan and beacon reading and delivers it $T_s$ = {{live:sensLat}} s later, to estimators that assume it was taken now. Three things go wrong, one per consumer.

**The EKF.** The innovation is computed against a prediction that has moved on by $v\,T_s$. For a beacon roughly ahead, $\nu \approx v\,T_s$ along the beam, which at 0.8 m/s and 0.2 s latency is a 16 cm range error that is not noise: it has the same sign every time the robot moves. The filter treats it as noise, pulls the estimate back along the direction of travel, and its covariance says nothing about it. The result is the signature of chapter 2 §5: a biased, overconfident filter, NEES in the tens while driving and normal the moment the robot stops, which is lesson 4's first experiment.

**The map and the tracker.** Lidar hits are placed with the pose at *delivery* time, so every scan is shifted by $v\,T_s$ against the direction of travel: 24 cm at 0.3 s latency. Walls perpendicular to the motion are painted $v\,T_s$ too close, then erased by the next scan from a different place, and recall of the real walls drops from 96 % to 84 % in lesson 4's third experiment, with twice the replans. For the tracker it is worse: the same shift applies to a person's hits, so a person seen while the robot turns appears to jump, fails the gate, and starts a new tentative track; in lesson 4's second experiment the tracker creates dozens of tracks for four people and the speed planner yields to ghosts.

**The fix.** Stamp each reading with the time it was taken, keep the state (or the odometry) since then, and apply the reading at its own time: rewind the estimate to the reading's timestamp, correct it there, and replay the odometry forward. A lagged-state or buffered filter does exactly this; the lab does not implement it, so the lesson shows the problem rather than the cure.

[try: EKF, latency 0.2 s | {"sim":true,"level":2,"set":{"loc":"ekf","sensLat":0.2},"tab":"veh","plot":"pos"}] [try: Mapping with latency 0.3 s | {"sim":true,"level":3,"set":{"sensLat":0.3},"tab":"per"}]

## 8. People who react: the social-force model

Scripted people walk their segment whatever the robot does. Reactive people follow a simplified social-force model (Helbing and Molnár, 1995): each person accelerates toward their preferred velocity and is pushed away from everything close.

$$
\dot v = \frac{v_0\,e - v}{\tau} \;+\; \sum_{j} A\,e^{(r_i + r_j - d_{ij})/B}\, n_{ij} \;+\; A_r\,e^{(r_i + r_{\text{robot}} - d)/B_r}\, n \;+\; A_w\,e^{(r_i - d_{\text{wall}})/B_w}\, \nabla d_{\text{wall}}
$$

The first term is the drive: $e$ is the unit vector to the goal, $v_0$ the preferred speed (0.6 to 0.9 m/s on the busy floor) and τ = 0.5 s the relaxation time, so a person recovers their walking velocity in about half a second after a disturbance. The others are exponential repulsions from other people ($A$ = 2 m/s², $B$ = 0.35 m), from the robot ($A_r$ = 3, $B_r$ = 0.5 m, a stronger and longer push, because people give machines room) and from walls ($A_w$ = 2.5, $B_w$ = 0.25 m, directed along the gradient of the distance field, which is the chamfer transform of §3 reused as a potential). Speed is capped at 1.3 $v_0$. The exponential form means the push is negligible beyond a few $B$ and overwhelming inside the sum of radii, which is what makes it behave like a soft body rather than a spring.

For evaluating a planner the point is in lesson 5: reactive people absorb the planner's mistakes. A robot that ignores people entirely makes 4 contacts on the busy floor with scripted people and 2 with reactive ones, because the people step aside, and the closest-approach metric moves the same way. A benchmark against reactive agents therefore under-reports the planner's errors by whatever the agents absorbed, which is why contact counts should be read together with closest approach and why scripted, non-yielding agents are the stricter test.

[try: Reactive people, speed planning | {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"veh"}] [try: Scripted people, ignored | {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}]

## 9. What to carry into the next chapters

The log-odds map and the costmap are what the planners of chapter 4 search; the inflation penalty is the term that makes A* prefer the middle of an aisle, and the unknown-cell policy decides whether an unexplored room is a route or a wall. The tracks and their growing radii are what the space-time planner blocks cells with and what the speed planner slows down for, and everything in §7 is why those planners work on timestamps rather than on "now". The pattern from chapter 2 holds throughout: the covariance, or its stand-in, is consumed downstream, and a tracker that reports a velocity it does not really know yet is as dangerous to the speed planner as an overconfident EKF is to the costmap.
