id: ch3
num: 3
sys: per
summary: The derivations behind the Perception lessons: the binary Bayes filter behind log-odds mapping, the distance transform and inflation cost, lidar clustering, the constant-velocity Kalman tracker and its gains, prediction with growing uncertainty, what sensor latency does to each estimator, the social-force model of people, the sonar ring's arc inverse sensor model and cone likelihood, and a radar's measurement model fused into the tracker.

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

**Between the beams.** The beams are 3° apart, which at range $r$ is $r \cdot 2\pi/120 \approx 0.052\,r$ between neighbours: more than a cell beyond 2 m, 42 cm at the 8 m limit. Beyond about 2 m a scan therefore leaves unseen cells between its beams, and they stay unseen while the robot stands still, since it fires the same beams every time. That is harmless when unknown counts as free; under the cautious policy (§3) every one of them is an obstacle inflated by 0.4 m, and after one scan the robot could plan only within about 3 m. So each gap between two neighbouring beams also gets four virtual rays, one every 0.6°, which reach the cells closer than both beams' ranges, stopping one cell short, and mark an untouched cell with a value no beam produces ($l = -0.06$). The costmap reads it as free; everything that asks whether the robot has looked there (the frontiers of exploration, the floor seen, the map's agreement with the truth) reads it as unseen, and the first real beam through the cell starts from zero as if it had never been marked. The rays stop at a cell a beam has seen occupied, but a corner that pokes between two beams can be marked free until a beam hits it, and an obstacle thinner than the gap that no beam hits is drawn free, as it would be by a lidar that had missed it. With unknown counted as free, none of this changes a run: the costmap is the same, and exploration sees the same map. After the first scan at the start of L2 the floor the robot can plan through reaches 7 m instead of 3.

**What a frame error does.** A hit placed from a pose that is 1 m off lands 1 m from the wall it came from. The next scan, from a slightly different wrong pose, lands somewhere else. Over a minute of dead reckoning the wall is painted as a smear of parallel ghosts, and free-space evidence from later scans crosses the earlier ghosts and partly erases them, so the map ends up with fragments of walls that do not exist and gaps in walls that do. Lesson 1 measures it: with the EKF, 100 % of the cells the map calls occupied have a real obstacle within one cell and 96 % of the seen obstacle cells are mapped; with dead reckoning the same numbers are 22 % and 18 %.

[try: Map the building, EKF | {"sim":true,"level":3,"tab":"per"}] [try: Map with dead reckoning | {"sim":true,"level":3,"set":{"loc":"dr"},"tab":"per"}]

## 3. The costmap: distance transform and inflation

**From occupancy to distance.** The planner needs, for every cell, how far the nearest obstacle is. Computing that exactly for 38 400 cells against every occupied cell is too slow at 2 Hz, so the lab uses a two-pass chamfer distance transform: sweep the grid forward and take the minimum over the already-visited neighbours with weights 1 (straight) and $\sqrt 2$ (diagonal), then sweep backward and do the same. Two passes, eight neighbours, no searching. The result is the length of the shortest 8-connected path to an obstacle, which over-estimates the Euclidean distance by at most about 8 % (at angles between the straight and diagonal directions), an error on the safe side.

**Lethal and the band.** The robot is a disc of radius 0.3 m, so any cell closer than 0.3 m to an obstacle would put the body inside it; the lab adds a 0.1 m margin for the sins of tracking and calls cells with $d < 0.4$ m lethal. Beyond that, a penalty fades out across the inflation band of width $w$ = {{live:infl}} m:

$$
\text{penalty}(d) = \left(\frac{0.4 + w - d}{w}\right)^2 \text{ for } 0.4 \le d < 0.4 + w, \qquad \text{edge cost} = \text{length} \times (1 + 3\,\text{penalty})
$$

Quadratic, so a path pays little for brushing the outer edge of the band and a lot for hugging the lethal boundary; the factor 3 means a cell at the inner edge costs four times its length. The planner is free to enter the band when the alternative is longer by more than that; the band is a preference, not a wall. That is also why widening it to 1.4 m in lesson 2 changes the path in open floor (it moves to the middle of aisles) but not through a doorway narrower than the band: there every route pays the same penalty, and the planner simply pays it.

**Unknown cells.** On a map being built, most cells have never been seen. "Unknown is free" lets the planner plan into rooms it has not entered, which is optimistic and is corrected by replanning as walls appear. "Unknown is lethal" refuses to plan anywhere unseen, which is safe and on its own leaves a goal in unknown space with no path; seeing farther does not change that, since one scan reaches 8 m at most and nothing behind a wall. What makes the cautious choice workable is a behaviour that drives toward the boundary between seen and unseen: toward the goal, the mission layer's stand-in at the edge of the seen floor (chapter 4 §5), and with no goal at all, frontier exploration (Mission → Explore, chapter 4 §7).

[try: The cost layer | {"sim":true,"level":1,"layers":{"cost":true},"tab":"per"}] [try: Inflation 1.4 m | {"sim":true,"level":1,"set":{"infl":1.4},"layers":{"cost":true},"tab":"per"}]

## 4. Finding people in a scan

A person is a cluster of lidar hits that the static map cannot explain. The lab calls a hit explained when the costmap distance at its cell is under 0.25 m (against a known map), or, on a map being built, when any neighbouring cell has log-odds above 2.0, meaning it has been seen occupied several times; a person who stood still for a while becomes "map" and stops being tracked, which is a real failure mode of this design. The unexplained hits are grouped over consecutive beams: a hit joins the current cluster if it is within 0.45 m of the previous hit and at most one beam was skipped, and the first and last clusters are joined when the scan wraps around behind the robot. Clusters wider than 1.2 m are discarded (2.2 m on the level with vehicles), which removes most furniture and all walls that slipped through.

Two corrections make the centroid usable. Lidar only sees the near side of a body, so the centroid of the hits is biased toward the robot; the lab pushes it away by 0.6 of the estimated radius. And the radius is estimated from the cluster's extent, clamped to 0.3–0.55 m for people, and smoothed into the track with a factor 0.2 per update so that a half-seen person does not shrink.

## 5. Tracking: a constant-velocity Kalman filter

**The model.** Each confirmed person is a state $[p_x, p_y, v_x, v_y]$ and the assumption is that velocity is constant except for random accelerations. For one axis over an update interval $\Delta t$:

$$
\begin{bmatrix} p \\ v \end{bmatrix}_{t+1} = \underbrace{\begin{bmatrix} 1 & \Delta t \\ 0 & 1 \end{bmatrix}}_{F} \begin{bmatrix} p \\ v \end{bmatrix}_t + \begin{bmatrix} \Delta t^2/2 \\ \Delta t \end{bmatrix} a, \qquad a \sim \mathcal N(0, \sigma_a^2)
$$

The acceleration enters through the vector $\Gamma = [\Delta t^2/2, \Delta t]^{\mathsf T}$, so the process noise covariance is $R = \Gamma \sigma_a^2 \Gamma^{\mathsf T}$ ($R$ for the process noise in state space and $Q$ for the measurement noise, as in chapter 2 and in *Probabilistic Robotics*; many Kalman-filter texts swap the two letters):

$$
R = \sigma_a^2 \begin{bmatrix} \Delta t^4/4 & \Delta t^3/2 \\ \Delta t^3/2 & \Delta t^2 \end{bmatrix}
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

**The EKF.** The innovation is computed against a prediction that has moved on by $v\,T_s$. For a beacon roughly ahead, $\nu \approx v\,T_s$ along the beam, which at 0.8 m/s and 0.2 s latency is a 16 cm range error that is not noise: it has the same sign every time the robot moves. The filter treats it as noise, pulls the estimate back along the direction of travel, and its covariance says nothing about it. The result is the signature of chapter 2 §5: a biased, overconfident filter, NEES of 25 to 110 while driving and back to normal within about ten seconds of the robot stopping, which is lesson 4's first experiment.

**The map and the tracker.** Lidar hits are placed with the pose at *delivery* time, so every scan is shifted by $v\,T_s$ against the direction of travel: 24 cm at 0.3 s latency. Walls perpendicular to the motion are painted $v\,T_s$ too close, then erased by the next scan from a different place, and recall of the real walls drops from 96 % to 84 % in lesson 4's third experiment, with twice the replans. For the tracker it is worse: the same shift applies to a person's hits, so a person seen while the robot turns appears to jump, fails the gate, and starts a new tentative track; in lesson 4's second experiment the tracker confirms hundreds of tracks for four people and the speed planner yields to ghosts.

**The fix.** Stamp each reading with the time it was taken, keep the state (or the odometry) since then, and apply the reading at its own time: rewind the estimate to the reading's timestamp, correct it there, and replay the odometry forward. A lagged-state or buffered filter does exactly this; the lab does not implement it, so the lesson shows the problem rather than the cure.

[try: EKF, latency 0.2 s | {"sim":true,"level":2,"set":{"loc":"ekf","sensLat":0.2},"tab":"veh","plot":"pos"}] [try: Mapping with latency 0.3 s | {"sim":true,"level":3,"set":{"sensLat":0.3},"tab":"per"}]

## 8. People who react: the social-force model

Scripted people walk their segment whatever the robot does. Reactive people follow a simplified social-force model (Helbing and Molnár, 1995): each person accelerates toward their preferred velocity and is pushed away from everything close.

$$
\dot v = \frac{v_0\,e - v}{\tau} \;+\; \sum_{j} A\,e^{(r_i + r_j - d_{ij})/B}\, n_{ij} \;+\; A_r\,e^{(r_i + r_{\text{robot}} - d)/B_r}\, n \;+\; A_w\,e^{(r_i - d_{\text{wall}})/B_w}\, \nabla d_{\text{wall}}
$$

The first term is the drive: $e$ is the unit vector to the goal, $v_0$ the preferred speed (0.6 to 0.9 m/s on the busy floor) and τ = 0.5 s the relaxation time, so a person recovers their walking velocity in about half a second after a disturbance. The others are exponential repulsions from other people ($A$ = 2 m/s², $B$ = 0.35 m), from the robot ($A_r$ = 3, $B_r$ = 0.5 m, a stronger and longer push, because people give machines room) and from walls ($A_w$ = 2.5, $B_w$ = 0.25 m, directed along the gradient of the distance field, which is the chamfer transform of §3 reused as a potential). Speed is capped at 1.3 $v_0$. The exponential form means the push is negligible beyond a few $B$ and overwhelming inside the sum of radii, which is what makes it behave like a soft body rather than a spring.

For evaluating a planner the point is in lesson 5: reactive people absorb the planner's mistakes. A robot that ignores people entirely makes 3 contacts on the busy floor with scripted people and 2 with reactive ones (counted up to Mission complete), because the people step aside, and the closest-approach metric moves further: a 0.57 m overlap against 0.18 m. A benchmark against reactive agents therefore under-reports the planner's errors by whatever the agents absorbed, which is why contact counts should be read together with closest approach and why scripted, non-yielding agents are the stricter test.

[try: Reactive people, speed planning | {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"veh"}] [try: Scripted people, ignored | {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}]

## 9. A learned detector

**What it replaces.** §4 finds people as hits the map cannot explain. That test is only as good as its premise, that the map is right and the robot knows where it is on it. While the map is being built nothing is explained, so on a level the robot explores for the first time the rule returns thousands of detections, nearly all walls (precision 0.07 on L5 under lidar mapping, measured below); and when the pose estimate drifts the walls of a correct map land beside the walls the lidar sees, and the rule calls every one of them a person. The learned detector replaces that one stage and nothing else: it still hands clusters to the tracker of §5.

**The network.** The scan is a ring of $120$ beams with seven numbers each: the range $r/8$; the previous scan reprojected through the odometry into the current body frame, $\tilde r_{prev}/8$ (each previous point moved by $(v\,\Delta t, \omega\,\Delta t)$ and re-binned by beam, so that a static wall reads the same range twice and a person does not); the difference $\mathrm{clip}(r - \tilde r_{prev}, \pm 1)$; the hit flag; $v/1.5$ and $\omega/2$ broadcast; and the map evidence $s$, how well the robot's map explains the hit, placed from the estimated pose. With the prior map $s = \mathrm{clip}(1 - d/0.5, 0, 1)$ for the distance $d$ from the hit to the nearest mapped obstacle, so $s = 0.5$ exactly at the rule's 0.25 m; with the built map $s = \mathrm{clip}(\ell_{max}/4, 0, 1)$ for the highest log-odds $\ell_{max}$ around the cell, 0.5 at the rule's settling level of 2. It is the rule's test kept as a number instead of a verdict. Four one-dimensional convolutions with circular padding (beam 119 is next to beam 0), kernels of 7, 7, 5 and 1 beams and 24 channels, ReLU between them and a sigmoid at the end, give one probability per beam from a receptive field of 17 beams: 8 185 parameters. Beams above 0.8 are clustered as §4 clusters unexplained hits; a cluster of a person's width is a detection.

**Why the map is an input and not a mask.** The obvious alternative is to run the rule first and let the network look only at the unexplained hits. That inherits every failure of the rule: while the map is unsettled nothing is masked, a person within 0.25 m of a wall is masked away, and under drift the misplaced walls pass the mask. As an input the evidence is one more cue the network weighs against the others. The first version of this detector had no map channel at all, and it lost to the rule wherever a map existed (precision 0.73 against 0.92 on L5), with nearly all its false positives on walls: the frame-to-frame change is a weak cue there, because re-binning a wall seen at a grazing angle, or the edge of an occlusion, moves the range by more than 15 cm on 7–9 % of wall beams between scans even with perfect odometry. Shape and that change alone cannot match a map; shape, change and the map together beat it.

**Training.** `tools/collect-detector.mjs` runs 36 headless missions on the two levels with people (L5, L6; scripted and reacting; seeds 21–38) and labels each beam from the true pose and the true discs: 43 000 scans, 3.7 % person beams. The runs take three map conditions in turn: the prior map with the level's localization, the map built by lidar, and the prior map with dead reckoning on noisy, biased odometry. The first teaches the network that good evidence is reliable; the other two, that weak or misplaced evidence is not, and that a wall-shaped arc that does not move is a wall whatever the map says. `training/detector/train.py` holds the last three runs out (one per condition) and minimizes a binary cross-entropy with the positive class weighted by $\sqrt{(1-\pi)/\pi}$ (the full ratio of 26 buys recall with false beams), with Adam and a cosine decay of the learning rate. Sixty epochs, thirteen minutes on a laptop. Per beam on the held-out runs at the threshold: precision 0.99 and recall 0.97 with the prior map, 0.95 and 0.81 under mapping, 0.74 and 0.79 under drift. The weights are written as flat lists to `src/models/detector.json` with the threshold and the fewest beams per detection (one), the build inlines them, and `nnForward` in `src/core/nn.js` runs the same four layers in plain loops: a fraction of a millisecond per scan, no dependency. The seeds start at 21 so that every seed a lesson uses is a run the network has not seen.

**Measured** on L5 at seed 7, 120 s, the speed planner, per scan against the truth (a person is detectable when a beam hits it; a detection is true within 0.5 m of a person, compared in the robot's frame, so that an error of the pose estimate is not counted against the detector; velocity RMS over the confirmed tracks):

| Detector | Map and pose | Detections | Precision | Recall | Confirmed tracks (most of the time / at most) | Velocity RMS |
| --- | --- | --- | --- | --- | --- | --- |
| rule (unexplained hits) | prior, particle filter | 1 034 | 0.92 | 1.00 | 1 / 6 | 0.26 m/s |
| rule, with scan matching | prior, particle filter | 977 | 0.93 | 1.00 | | 0.25 m/s |
| learned | prior, particle filter | 907 | 0.96 | 0.96 | 1 / 5 | 0.27 m/s |
| rule | built by lidar | 8 214 | 0.07 | 1.00 | 12 / 36 | 0.35 m/s |
| learned | built by lidar | 966 | 0.74 | 0.88 | 1 / 9 | 0.31 m/s |
| learned, with scan matching | built by lidar | 765 | 0.84 | 0.89 | 1 / 4 | 0.30 m/s |
| rule | prior, dead reckoning | 10 026 | 0.06 | 1.00 | 13 / 21 | 0.26 m/s |
| learned | prior, dead reckoning | 563 | 0.71 | 0.65 | 0 / 3 | 0.27 m/s |
| rule | prior, particle filter, seed 12 | 1 948 | 0.33 | 0.99 | 1 / 18 | 0.40 m/s |
| learned | prior, particle filter, seed 12 | 614 | 0.81 | 0.85 | 0 / 4 | 0.43 m/s |
| rule | L6 parking lot, built | 6 618 | 0.29 | 0.89 | | 0.28 m/s |
| learned | L6 parking lot, built | 2 087 | 0.93 | 0.93 | | 0.23 m/s |
| rule | L6, dead reckoning (odometry noise and bias ×1) | 14 788 | 0.13 | 0.77 | | 0.27 m/s |
| learned | L6, dead reckoning (the same) | 2 845 | 0.83 | 0.91 | | 0.25 m/s |

The reading: with a good map and a good pose the two are level (over seeds 2 to 5 and 7 the mean precision is 0.94 for both, recall 0.96 for the network against 1.00 for the rule), because the rule is already nearly perfect there. Everywhere its premise breaks the network wins by a factor of ten or more in precision: the map being built (0.68 against 0.06, mean of five seeds), the pose drifting on dead reckoning (0.71 against 0.06), and a particle filter that slips for a few scans at a time with nothing switched off (seed 12, 0.81 against 0.33). The confirmed tracks tell the same story at a glance: the rule carries a dozen phantoms or more, the network one or none. That is the argument for learned perception, measured: not that a network knows more than a map, but that it weighs several cues and degrades gently when one of them fails, where a rule built on one cue fails with it. The price is the training set, which has to contain the failures (here the built-map and drift runs), and a detector whose mistakes nobody can read off its weights. Its misses are people seen edge-on far down an aisle, a beam or two. Per-target scan matching (§5, ICP of a track's hits from one scan to the next, fused as a velocity measurement with the filter's own gain) changes the velocity error by a few centimetres per second, within the run-to-run variation.

**The pipeline.** Collect in Node over the headless core, train in Python, export JSON, inline at build, run in plain JavaScript: this is how every learned block of the lab arrives, and the reason training is the only place Python enters the project (`training/README.md`).

[try: The learned detector, the pose drifting | {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","loc":"dr"},"tab":"per","layers":{"lidar":true,"agents":true}}] [try: The rule, the pose drifting | {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","loc":"dr"},"tab":"per"}]

## 10. A learned predictor

**What it replaces.** §6 predicts every person by constant velocity, $p(t) = p + v\,t$, and grows the radius. That prediction is wrong in its mean (a walker turns back at the end of an aisle, a reacting person steps aside, and the tracker's $v$ itself wobbles, every wobble multiplied by $t$) and in its shape: a person who may walk on or turn back has two likely futures, and one line through their middle is a place nobody goes. The learned predictor replaces that one function. It still hands the planners a disc per person and time through `agPred`, so the speed planner, space-time A*, DWA and MPC do not know which predictor they are using.

**The network.** One tracked person at a time, in the person's frame: the origin at the tracked position now, the $x$ axis along the displacement over the last second (towards the robot when they stand). A walker in an aisle then looks the same whichever way the aisle runs, and the network does not have to learn every heading. Twenty-four inputs: the five past positions at 0.2, 0.4, … 1.0 s ago relative to now (from the track's history, kept by id), the tracked velocity, the robot's position (divided by 4, clipped at 8 m) and velocity, and the free space along eight rays from the person, every 45°, in the robot's map (sphere-traced on the distance transform, divided by 4, clipped at 4 m). A multilayer perceptron $24 \to 64 \to 64 \to 39$ with ReLU, 8 295 parameters. The 39 outputs are three logits $z_k$ and, for each of the $K = 3$ futures, six points at $t_j = 0.5, 1, \dots, 3$ s written as corrections $\Delta_{kj}$ to constant velocity:

$$
\pi_k = \frac{e^{z_k}}{\sum_m e^{z_m}}, \qquad \mu_k(t_j) = v\,t_j + \Delta_{kj}
$$

so that a network whose last layer outputs zeros is constant velocity, with three equal probabilities. The futures are turned back into the map by the frame, and between the six points the position is linear (from the person's position at $t = 0$; past 3 s the last segment continues).

**The loss and its gradient.** Let $y \in \mathbb{R}^{12}$ be where the person really went (six points) and $\mu_k \in \mathbb{R}^{12}$ future $k$. A mixture of $K$ Gaussians of fixed spread $\sigma$ gives the outcome a likelihood, and its negative logarithm is the loss:

$$
p(y \mid x) = \sum_{k=1}^{K} \pi_k\, \mathcal{N}\big(y;\ \mu_k,\ \sigma^2 I\big), \qquad L = -\log \sum_{k=1}^{K} \pi_k \exp\!\Big(-\frac{\lVert y - \mu_k \rVert^2}{2\sigma^2}\Big)
$$

up to a constant that does not depend on the weights. Write $a_k = \log \pi_k - \lVert y - \mu_k \rVert^2 / 2\sigma^2$, so that $L = -\log \sum_k e^{a_k}$, and define the responsibilities

$$
\gamma_k = \frac{e^{a_k}}{\sum_m e^{a_m}} = \frac{\pi_k\, e^{-\lVert y - \mu_k \rVert^2 / 2\sigma^2}}{\sum_m \pi_m\, e^{-\lVert y - \mu_m \rVert^2 / 2\sigma^2}}
$$

the posterior probability that future $k$ is the one that happened. The derivative of $-\log \sum e^{a}$ with respect to each $a_k$ is $-\gamma_k$. Only $a_k$ depends on $\mu_k$, with $\partial a_k / \partial \mu_k = -(\mu_k - y)/\sigma^2$; and every $a_k$ depends on every logit through $\log \pi_k = z_k - \log \sum_m e^{z_m}$, with $\partial \log \pi_k / \partial z_m = \delta_{km} - \pi_m$. By the chain rule

$$
\frac{\partial L}{\partial \mu_k} = \gamma_k\, \frac{\mu_k - y}{\sigma^2}, \qquad \frac{\partial L}{\partial z_m} = -\sum_k \gamma_k (\delta_{km} - \pi_m) = \pi_m - \gamma_m
$$

using $\sum_k \gamma_k = 1$. The first says that each future moves towards the outcome in proportion to how much of it it explains; the second, that each probability moves towards its responsibility. A future that never explains anything gets no gradient and stays where it is (the mixture's well-known dead component, which the K = 3 here mostly escapes: the held-out mean probabilities are 0.67, 0.18 and 0.15). Since $\mu_k = v\,t + \Delta_k$ and the $v\,t$ term does not depend on the weights, $\partial L / \partial \Delta_k = \partial L / \partial \mu_k$: the correction trains exactly like the positions would. These two lines are `mixLoss` in `src/core/nn-train.js`; the gradient check of `tests/node/train.test.mjs` compares them with central differences.

**σ, and winner-takes-all.** As $\sigma \to 0$ the responsibilities become one-hot on the future nearest the outcome: only that future gets a gradient, and the logits learn to pick it. That limit is the winner-takes-all loss many trajectory predictors use. A small σ gives the most distinct futures and the least accurate most probable one; a large σ pulls all three towards the mean. Measured on the held-out runs (the last two seeds of each level, 7 868 samples; 60 epochs each):

| σ | most probable, 1 s · 2 s | best of three, 1 s · 2 s | constant velocity, 1 s · 2 s |
| --- | --- | --- | --- |
| 0.2 m | 0.21 · 0.35 m | 0.14 · 0.21 m | 0.28 · 0.52 m |
| 0.3 m (built in) | 0.21 · 0.34 m | 0.14 · 0.21 m | 0.28 · 0.52 m |
| 0.5 m | 0.20 · 0.31 m | 0.15 · 0.22 m | 0.28 · 0.52 m |

σ is fixed rather than learned: a learned spread per future is the full mixture density network, less stable to train, and the planners here would not use it, since they give the learned futures the same growing radius $r + g\,t$ as constant velocity, so that the two differ only in their centres.

**Training.** `tools/collect-pred.mjs` runs 48 headless missions of 150 s on L5 and L6 (seeds 21 to 44), the people scripted and reacting in turn, the robot yielding with the speed planner and driving through with Ignore in turn (so that reacting people also meet it up close), the mission looping. At every scan each confirmed lidar track within 0.8 m of a person gives a sample: its 24 inputs, and where that person really was 0.5 to 3 s later, seen through the robot's pose estimate of the moment (the true displacement from the true robot pose, placed at the estimated one), so that a localization error is not taught as motion; minus the constant-velocity points. 84 760 samples, 76 892 for training. `training/predictor/train.py` minimizes the loss above with Adam and a cosine decay, sixty epochs in ten seconds; per held-out run, at 1 s and 2 s:

| Held-out run | constant velocity | learned, most probable | best of three |
| --- | --- | --- | --- |
| L5 seed 43, scripted, robot ignoring | 0.31 · 0.61 m | 0.18 · 0.31 m | 0.13 · 0.21 m |
| L5 seed 44, reacting, robot yielding | 0.28 · 0.54 m | 0.24 · 0.45 m | 0.17 · 0.30 m |
| L6 seed 43, scripted | 0.28 · 0.50 m | 0.19 · 0.28 m | 0.12 · 0.16 m |
| L6 seed 44, reacting | 0.26 · 0.50 m | 0.21 · 0.33 m | 0.14 · 0.21 m |

The weights go to `src/models/predictor.json` (67 KB), the build inlines them, and `mlpForward` runs them in plain loops for every confirmed track every scan.

**In the page,** scored per scan against the truth (the error of the most probable future and of constant velocity, 1 s and 2 s after each prediction, on the tracks near a person; the predictor not in use is scored on what it would have said), L5 at seed 7, read at Mission complete:

| Run | Mission complete | Contacts | Closest to a person | Constant velocity, 1 s · 2 s | Learned, 1 s · 2 s |
| --- | --- | --- | --- | --- | --- |
| constant velocity, scripted people | 121 s | 1 | contact | 0.24 · 0.45 m | (0.15 · 0.26 m) |
| learned, scripted people | 119 s | 1 | contact | 0.24 · 0.46 m | 0.18 · 0.34 m |
| constant velocity, reacting people | 122 s | 0 | 0.18 m | 0.27 · 0.55 m | (0.22 · 0.42 m) |
| learned, reacting people | 124 s | 0 | 0.46 m | 0.23 · 0.45 m | 0.20 · 0.36 m |
| learned, every future ≥ 20 % | 121 s | 0 | 0.14 m | 0.24 · 0.47 m | 0.16 · 0.29 m |
| learned, ground-truth tracks | 127 s | 0 | 0.25 m | 0.03 · 0.13 m | 0.18 · 0.32 m |
| constant velocity, L6 | 148 s | 0 | 0.32 m | 0.27 · 0.48 m | (0.21 · 0.32 m) |
| learned, L6 | 162 s | 0 | 0.06 m | 0.25 · 0.46 m | 0.21 · 0.34 m |

and over seeds 1 to 12, the same core in Node (contacts in all, the mean time to Mission complete over the runs that finished in 240 s):

| Case | constant velocity | learned |
| --- | --- | --- |
| L5, scripted | 14 contacts, 131 s | 11 contacts, 135 s |
| L5, reacting | 1 contact, 139 s | 0 contacts, 135 s |
| L6, scripted | 4 contacts, 164 s | 2 contacts, 168 s |
| L6, reacting | 0 contacts, 161 s | 0 contacts, 171 s |
| L5, scripted, every future ≥ 20 % | | 8 contacts, 147 s |
| L5, scripted, space-time A* | 6 contacts, 146 s (11 finished) | 11 contacts, 126 s (9 finished) |
| L5, scripted, ground-truth tracks | 7 contacts, 139 s | 7 contacts, 139 s |

The learned error at 2 s is lower than constant velocity's on every seed with lidar tracks, on both levels, scripted or reacting (by about a third with scripted people at L5, a quarter with reacting ones), and higher on every seed with ground-truth tracks (0.32 m against 0.13 m).

**What it did not learn, and where constant velocity still wins.** The reading is sobering, and it is the point of the section. *A better prediction is not safer driving by itself:* the speed planner's margin and growing radius already absorb most of constant velocity's error, and the contacts that remain on L5 are scripted walkers reaching a robot that has already slowed for them, from the side or the front; the speed planner only changes the speed along a fixed path, and slowing is no escape from someone who walks through where the robot stands. The network moves such a contact to another encounter (at seeds 2, 3, 7 and 11 constant velocity's contact is at about 52 s, the network's at about 102 s); it does not remove the kind. With reacting people the gain is distance (the closest approach larger on ten seeds of twelve), not goals or seconds. *It learned the tracker as much as the people:* given exact tracks it keeps correcting a wobble that is not there, and constant velocity, which is exact for a scripted walker on a straight line, wins by a factor of two and a half. An upstream improvement (a better tracker, per-target scan matching) can make it worse. *With space-time A* it does worse* (11 contacts against 6 over twelve seeds, two more runs unfinished): that planner commits to a path through gaps in the predicted futures, and a confident wrong future, unlike a growing constant-velocity disc, leaves a gap that is not there. *It does not know the robot's plan,* only its position and velocity now, so it cannot model people who react to where the robot will be: prediction and planning each treat the other as given. *It was trained on two levels* and has not been tested on another map; the rays that let it anticipate the end of an aisle may have learned these levels' layouts. *It cannot know when a pause ends,* only how often pauses end each way, which is why the futures split near the ends of a walk (a second future of 20 % or more about half the time within a metre of the end, one time in five in mid-walk, on L6) and why the car waits longer on L6. Velocity obstacles (lesson 6) still read the track's velocity, not the learned futures, and the predictor slot of the Code tab receives the tracks, not the network's output.

**Planning against three futures.** The default gives the planners the most probable future of each person. *Every future ≥ 20 %* makes each likely future an obstacle of its own: fewer contacts (8 against 11 over twelve seeds) and slower (147 s against 135 s), the robot waiting for turns that do not happen. Weighting each future by its probability inside the planner's cost, and replanning as the futures resolve, is how real stacks sit between the two; the lab offers the two ends.

[try: Learned, scripted people | {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}] [try: Where the network is wrong: perfect tracks | {"sim":true,"level":4,"set":{"agPred":"learned","agents":"truth"},"tab":"per","layers":{"agents":true}}]

## 11. Sonar: one range for a whole cone

**The sensor.** An ultrasonic transducer sends a ping and times the first echo; half the time of flight at the speed of sound is the range. The ring in the lab has {{live:sonN}} of them round the hull (Sensors → Ultrasonic ring, off by default), each a cone {{live:sonBeam}}° wide that reports *one number*: the range of the nearest surface anywhere in the cone that sends the echo back, from {{live:sonMin}} m to {{live:sonMax}} m, with σ = {{live:sonSig}} m of noise. The cone is simulated as a fan of rays 2° apart. A ray's echo comes back only if three things hold:

- *The surface faces the sensor.* A smooth surface reflects sound like a mirror: met at an incidence beyond {{live:sonSpec}}° from square-on, the echo goes elsewhere and the sonar hears nothing (a specular miss). With the cone's half-width added, a sonar hears a flat wall only when its axis is within about $15° + 30° = 45°$ of the wall's normal.
- *It is beyond the dead zone.* The transducer rings for a moment after its own ping; an echo from closer than {{live:sonMin}} m arrives during the ringing and is lost.
- *It is within reach.* No echo at all reads as the maximum range, {{live:sonMax}} m.

The sonars fire in turn, one ping every 50 ms (so that one's echoes have died before the next listens), and the ring's cycle is {{live:sonN}} × 50 ms = {{live:sonCycle}} s against the lidar's 0.1 s. With {{live:sonN}} cones of {{live:sonBeam}}°, {{live:sonGap}}° between neighbours are seen by no sonar at all. A share of readings (Crosstalk, {{live:sonXt}} %) are a neighbour's echo, reported as this sonar's own range; this is a phenomenological model, not a simulation of the sound field.

**What it is good for, and what the lab leaves out.** A sonar costs a fraction of a lidar, needs no moving parts, and on a real robot it hears glass doors, mirrors, and dark or shiny surfaces that a laser can pass through or fail to see. The lab does not model materials: every surface reflects the laser and the sound alike. So everything below is the sonar's failure modes on the lab's surfaces, and none of its strengths over a lidar. A ring is the cheap proximity sensor under a robot's bumper, not a mapping sensor, and the numbers below say why.

**The arc inverse sensor model.** A lidar beam (§2) says "free along the line, occupied at its end". A sonar reading $z = r$ says less: *something on the arc of radius $r$ inside the cone echoed, and nothing inside the cone before it did*, with no bearing for the echo. Write $A$ for the $n$ cells of that arc which could have echoed, and $h_c$ for "the echo came from cell $c$". With nothing to prefer one cell over another, $p(h_c) = 1/n$. Cell $c$ is occupied if the echo came from it, or otherwise with the prior one half:

$$
p(m_c \mid z) = \frac{1}{n} + \Big(1 - \frac{1}{n}\Big)\frac{1}{2} = \frac{n + 1}{2n}, \qquad l_\text{arc}(n) = \ln\frac{p(m_c \mid z)}{1 - p(m_c \mid z)} = \ln\frac{n + 1}{n - 1} \approx \frac{2}{n}
$$

capped at the lidar's $l_\text{hit} = 0.85$ (for $n \le 2$). The arc is a band 1.4 cells thick (cell centres within 0.07 m of $r$), so $n \approx 1.4\, r \beta / 0.1$ m for a beam of $\beta$ radians: at 2 m about {{live:sonArcN2}} cells, each getting $l_\text{arc} \approx$ {{live:sonLarc2}}. One lidar hit makes a cell occupied ($l > 0.5$); at 2 m it takes four sonar readings that put the same cell on their arcs. That is the whole difference between the two maps in one number: the sonar's evidence is spread over the arc it cannot resolve.

The cells *inside* the cone before the arc get $l_\text{free} = -0.2$ ($p = 0.45$), half the lidar's: a surface met too obliquely to echo can sit inside a cone that read farther, so "nothing closer echoed" is weaker than "the beam went through". A reading at the maximum range updates nothing: an empty cone and a cone full of specular walls read the same.

**Which cells could have echoed.** The $n$ in $l_\text{arc}$ counts only the arc's cells that the map does not already know to be free ($l > -0.5$). A cell that other cones have seen through cannot be the echo, so as the robot drives, the arc's evidence gathers on the cells that are left, which is where the wall is. This is the usual refinement of the model, and it is not an independent-evidence update: it uses the map to interpret the reading that then updates the map, so the map can talk itself into a wall. Measured on the rough-wall run of the table below, counting every arc cell instead costs a goal and doubles the collisions (3 goals of 4 with 4 collisions, against 4 with 2; at seeds 3 and 11, 6 and 5 collisions against 3 each).

**What it predicts.** For a flat wall at perpendicular distance $d$ with the normal inside the cone, $r = d$. The arc's points at angle $\varphi$ off the normal lie $d(1 - \cos\varphi)$ in front of the wall, up to $d(1 - \cos 15°) = 0.034\,d$ (one cell at 3 m), and its ends lie $d \sin 15° = 0.26\,d$ to either side. So the wall is drawn smeared along itself: past a wall's end (a door jamb, the end of a shelf) by up to a quarter of the range, which narrows doorways until a cone sees through them and the free cells take them back. Blind spots come from the physics, not the noise: walls passed at a slant are never heard (the specular rule), and the wall the robot is pressed against is never heard either (the dead zone).

**The cone likelihood.** The particle filter can weight particles by the ring against the prior map (Localize → Also weight particles by the sonar ring), as it does with the lidar's likelihood field (chapter 2 §7). For a particle at pose $x$, the expected reading $\hat z(x)$ is the range of the nearest obstacle of the map inside that sonar's cone, beyond the dead zone and within reach: seven rays 5° apart marched on the map's distance field, the shortest one kept. Then

$$
p(z \mid x) = \begin{cases} 0.85\, \exp\!\big(-\tfrac{1}{2}(z - \hat z)^2/\sigma^2\big) + 0.05, & z < z_\text{max} \\ 0.9, & z = z_\text{max},\ \hat z \ge z_\text{max} \\ 0.3, & z = z_\text{max},\ \hat z < z_\text{max} \end{cases} \qquad \sigma = 0.15\ \text{m}
$$

The floor 0.05 is for readings the map cannot explain: people, crosstalk. The 0.3 is the chance of a specular miss when the map has a wall in reach; about a third of the ring's readings in the warehouse are exactly that (measured on L5). The log-likelihood of each reading is tempered by 0.5, since successive readings of the same wall are not independent, and nothing is weighted while the robot stands still. The expectation ignores the specular rule (the grid stores no surface normals), so the max-range term carries all of it; that and the dependence between readings are why the filter is overconfident.

**How much it tells.** The lidar's likelihood uses 24 beams at 5 Hz, each with a bearing: 120 numbers a second. The ring gives {{live:sonN}} numbers every {{live:sonCycle}} s, about 20 a second, each blurred over its cone, and a reading at maximum range is nearly no evidence. Measured, the error is about twice the lidar's, not six times: a cone's nearest range still pins the distance to a wall.

**Measured** (Perceive lesson 9; seed 7, checked at seeds 3 and 11):

| Experiment | Seed 7 | Seeds 3 and 11 |
|---|---|---|
| Map the building (L4), lidar | 4 of 4 goals, no collision; floor seen 96 %; precision 1.00, recall 0.96 | 4 of 4, 1 collision each |
| Sonar only, smooth walls (30°) | 0 of 4, 2 collisions (first at 8.6 s); floor seen 14 %; precision 0.73, recall 0.36 | 0 of 4; 5 and 2 collisions |
| Sonar only, rough walls (50°) | 4 of 4 by 89 s, 2 collisions, 15 replans; floor seen 67 %; precision 0.88, recall 0.75 | 1 of 4; 3 collisions each; precision 0.93 and 0.95 |
| Rough walls, crosstalk 30 % | 0 of 4, 2 collisions; precision 0.42 | 1 of 4; precision 0.76 both |
| Map the aisles (L2), lidar | 4 of 4, no collision; precision 1.00, recall 0.88 | 4 of 4, no collision; recall 0.85 and 0.87 |
| Aisles, sonar only | 1 of 4, a shelf hit at 3.6 s; floor seen 28 %; precision 0.83, recall 0.68 | 1 of 4; precision 0.81 and 0.82 |
| Safety stop (L5, people who react), none | 2 contacts | 2 and 2 |
| Safety stop on the lidar | no contact, closest 0.03 m | none; 0.04 and 0.03 m |
| Safety stop on the sonar ring | 2 contacts, both with the person ahead in the dead zone | 2 and 2 |
| Sonar safety stop, no dead zone | no contact | 1 and 0 |
| Particle filter (L3), beacons only | pose RMS 0.04 m | — |
| Lidar only, every beacon off | RMS 0.06 m, inside 2σ 91 % | 0.06 m both; 99 % and 92 % |
| Sonar only, every beacon off | 5 of 5 goals; RMS 0.13 m, inside 2σ 77 % | 5 of 5 (a shelf brushed at seed 3); RMS 0.13 and 0.07 m |
| Sonar only, crosstalk 30 % | 5 of 5; RMS 0.13 m, inside 2σ 94 % | 5 of 5; 0.12 and 0.10 m |

Precision is the share of the cells the map calls occupied that have a real obstacle within a cell, recall the share of the seen obstacle cells the map has (lesson 1's measures). The safety-stop runs drive the cross aisle at x = 12 m, where all three walkers cross or meet the robot, with agent tracking off so that the stop is the only thing between them.

**Reading the table.** *Mapping:* with smooth walls the robot hits the first wall it meets at a slant, because no cone hears it; the map it builds is a few fragments. Rougher walls give the map its walls back, blurred, and the mission succeeds at one seed of three: the robot still finds the walls it is pressed against by hitting them. *The safety stop:* the lidar stop keeps the reacting walkers off the robot; the sonar stop does not, and the cause is the dead zone. As the person comes within 0.2 m of the hull, the front sonar's next reading is a miss, it replaces the echo that was there, and the stop forgets the person at the moment it matters. Without the dead zone the sonar stop holds. A real ring keeps the last close echo for a while; the lab's does not, so that the failure shows. *Localization:* sonar alone against the map is enough to localize on L3 (five goals of five), with about twice the lidar's error and a band about twice as wide, and crosstalk costs it almost nothing, since the floor in the likelihood absorbs readings the map cannot explain.

[try: Sonar only, the building | {"sim":true,"level":3,"set":{"sonar":true,"mapSrc":"sonar"},"tab":"per"}] [try: Sonar safety stop | {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar"},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}] [try: Sonar-only particle filter | {"sim":true,"level":2,"set":{"loc":"pf","pfLidar":false,"sonar":true,"pfSonar":true,"bOff":"all"},"tab":"loc","plot":"pos"}]

## 12. Radar: range, bearing and Doppler

**The sensor.** A radar sends a radio wave and listens for echoes. The delay gives the range, the phase across its receiving antennas the bearing, and the Doppler shift of the echo's frequency, $f_D = 2 v_r / \lambda$, the *radial velocity* $v_r$: the rate at which the range changes, the part of the relative velocity along the line of sight. The lab's radar looks forward, {{live:radFov}}° wide and {{live:radRange}} m deep, at 10 Hz, and each detection is

$$
z = [\,r,\ b,\ v_r\,] + \nu, \qquad \nu \sim \mathcal N\big(0,\ \operatorname{diag}(0.1^2\ \text{m}^2,\ (3°)^2,\ 0.1^2\ \text{m}^2/\text{s}^2)\big)
$$

A person echoes once per scan from the near side of the body (missed one scan in ten: a person is a weak reflector); a vehicle hardly ever misses. A flat surface reflects like a mirror, so a wall echoes strongly only where it faces the radar: the lab samples the field of view every half resolution cell and keeps an echo with probability $0.1 + 0.85\cos^4\phi$ for the incidence angle $\phi$, at most three per shape, which gives a wall a few echoes around its perpendicular and a pillar one or two. On top of that come false detections, Poisson with {{live:radClutter}} per scan on average, anywhere in the field of view with random radial velocities, and ghosts.

**Resolution.** Two echoes become one detection when they are closer than the resolution in all three of range (0.4 m), radial velocity (0.25 m/s) and bearing ({{live:radRes}}°), at their amplitude-weighted average. Across the line of sight the angular resolution is a distance that grows with range: at 10 m, {{live:radRes}}° is {{live:radCross10}} m. Two people walking side by side at the same speed are one detection there; two people at different speeds, or at different ranges, are two, because radar separates by range and Doppler far better than by angle.

**Ghosts.** A wave can reach a person by way of a wall and come back the same way. The echo then seems to come from the person's mirror image in the wall plane (the image method): for a wall along $x = c$ the image of $(p_x, p_y)$ moving at $(v_x, v_y)$ is $(2c - p_x, p_y)$ moving at $(-v_x, v_y)$. The lab adds such a ghost with probability {{live:radGhost}} % per person per scan, through the face of a rectangle that faces both the robot and the person, when the bounce point lies on the face and both legs of the path are clear. A ghost sits behind the wall and moves like a person, so the map does not explain it and its Doppler marks it as moving: the tracker has no way to tell it from a person in the next aisle. Ghosts and clutter are drawn like every other detection for that reason.

**The robot's own speed.** Doppler is relative. A person's radial velocity is the reading minus the robot's own contribution, so the robot must know its speed better than the radar's 0.1 m/s; one tick of wheel odometry on the busy floor is off by about 0.15 m/s. The static world measures it instead: every static echo at bearing $b$ reads $v_r = -v\cos b$, so with the echoes that agree with the odometry's guess to within 0.4 m/s,

$$
\hat v = -\frac{\sum_i v_{r,i} \cos b_i}{\sum_i \cos^2 b_i}
$$

by least squares (the odometry when fewer than three agree). A detection is a candidate for the people tracker when its reading differs from $-\hat v\cos b$ by more than $3\sigma_v + 0.05$ m/s (it moves), or when the map does not explain it within $0.25 + 2\,r\,\sigma_b$, the smear of its bearing noise. A person standing still within that smear of a shelf is therefore invisible to the radar tracker, the classic blind spot of Doppler processing.

**The measurement model.** With the track's state $x = [p_x, p_y, v_x, v_y]$, the estimated robot pose $(\hat p, \hat\theta)$ and its velocity $v_e = \hat v\,[\cos\hat\theta, \sin\hat\theta]$, write $d = p - \hat p$, $\rho = \lVert d \rVert$ and $w = v - v_e$. The radar should read

$$
h(x) = \begin{bmatrix} \rho - b_0 \\ \operatorname{atan2}(d_y, d_x) - \hat\theta \\ v_r \end{bmatrix}, \qquad v_r = \frac{d \cdot w}{\rho}
$$

where $b_0$ = 0.24 m is the distance from what the tracker calls a person's centre to the surface that echoes. It is not the body radius of 0.3 m: the lidar's cluster centres sit about 6 cm short of the true centre, and the two sensors have to agree on where a person is, or every scan in which only one of them sees the person moves the track by the difference. That calibration between sensors is part of fusion. The Jacobian, row by row: the range depends on position only, through the unit vector $d/\rho$; the bearing through the perpendicular, scaled by $1/\rho$, since a sideways step changes the angle less the farther away it is; and the radial velocity

$$
\frac{\partial v_r}{\partial p} = \frac{1}{\rho}\Big(w - v_r \frac{d}{\rho}\Big)^{\mathsf T}, \qquad \frac{\partial v_r}{\partial v} = \frac{d^{\mathsf T}}{\rho}
$$

so that

$$
H = \begin{bmatrix} d_x/\rho & d_y/\rho & 0 & 0 \\ -d_y/\rho^2 & d_x/\rho^2 & 0 & 0 \\ (w_x - v_r d_x/\rho)/\rho & (w_y - v_r d_y/\rho)/\rho & d_x/\rho & d_y/\rho \end{bmatrix}
$$

The velocity block of the last row is the line of sight: one detection measures the velocity in that one direction and says nothing across it. Its position block is the tangential part of $w$ divided by $\rho$: moving the track sideways turns the line of sight onto which the velocity is projected. Both are what make the problem nonlinear, and the update is the extended Kalman filter's, linearized at the predicted track,

$$
S = H C H^{\mathsf T} + Q, \quad K = C H^{\mathsf T} S^{-1}, \quad x \leftarrow x + K\big(z - h(x)\big), \quad C \leftarrow (I - KH)\,C\,(I - KH)^{\mathsf T} + K Q K^{\mathsf T}
$$

with the bearing innovation wrapped to $(-\pi, \pi]$ and the covariance update in Joseph's form, which stays symmetric and positive with gains this uneven. $C$ is now the full 4×4 covariance. The lidar tracker of §5 keeps one covariance for both axes, which is exact only while every measurement is a position with the same noise in $x$ and $y$; a radar detection pins range and radial velocity to a tenth and the bearing to 3°, {{live:radLat10}} m across the line of sight at 10 m, so after one update the uncertainty is an ellipse along the line of sight and the filter has to carry all of it. With both sensors, the lidar's clusters update the same filter with $H = [I\ \ 0]$, the update of §5 written for the full covariance.

**Gating and association.** Candidates are paired with tracks nearest first, as in §5, by the Mahalanobis distance of the range and bearing only, $d^2 < 9.21$ (χ² with two degrees of freedom at 99 %); the paired update then uses all three rows. Gating on the radial velocity too would be tighter against clutter, and it was the first version: it rejected exactly the echo of a person who had just turned around, whose Doppler is many σ from a confident wrong track, so the track coasted on the old velocity, and the velocity of tracks older than two seconds came out worse than with the lidar alone (0.18 against 0.11 m/s at seed 7). Gate on position, update with everything: the standard compromise for targets that manoeuvre. A candidate left unpaired starts a tentative track at its range plus $b_0$ along its bearing, with the radial velocity known ($\hat v_r + v_e \cdot u$ along the unit line of sight $u$, σ 0.1 m/s) and the tangential velocity not (σ 1 m/s, as a lidar track starts), unless a track is already within 1 m.

**Clutter, and what nearest neighbour does with it.** For a false detection to become a track it has to fall inside a gate three scans running. A gate's area is roughly $\pi \cdot 9.21 \cdot \sigma_r \cdot \rho\sigma_b$, a third of a square metre at 10 m; the field of view is about {{live:radRange}}²·{{live:radFov}}/360·π ≈ 420 m², so with λ false detections per scan the chance per scan of one landing in a given gate is about λ times one in a thousand. Most false tracks are therefore born far out, where the gates are widest and only the radar sees. Nearest neighbour also has a quieter weakness: when a person's own echo is missing (one scan in ten), a false one inside their gate is taken as theirs and pulls the track. Probabilistic data association (PDA, and JPDA for several targets) weighs every echo in the gate by how likely it is to be the target's, including "none of them"; the lab does not implement it.

**Confirmation with two sensors.** With both sensors in the tracker, a track inside the radar's field of view is confirmed only once at least one of its hits came from the radar, or after six lidar hits. Each sensor's artefacts are rare in the other: the air returns lidar hits in fog but no radar echo, and a radar ghost behind a wall returns no lidar hit. The six-hit rule keeps a person the radar cannot see (standing by a shelf) from going unconfirmed; it delays them by 0.3 s. Outside the radar's view the lidar alone confirms as before.

**Weather.** Fog and rain scatter a lidar's near-infrared light (a micrometre against droplets of a few) and barely touch millimetre waves. In the lab, fog cuts the lidar's reach to about 4 m of its 8, drops one beam in seven, adds 5 cm of range noise and returns one beam in two hundred from the air within 2 m; rain is milder (6 m, one beam in sixteen, 3 cm, one in five hundred). The radar loses a tenth of its reach in rain and sees 0.3 more false detections per scan; fog leaves it alone.

**Measured** on L5 at seed 7, read at Mission complete, the speed planner, with seeds 2 and 3 in brackets; *in view* is the radar's field (±60°, within 8 m, in line of sight); a track of nobody is a confirmed track that was more often than not more than 1 m from every person; *turn* is the time until a track's velocity is within 0.3 m/s of a person's who turned round at 50 s, 2 to 3 m ahead, walking straight back at the robot:

| Tracker inputs | Weather | Contacts, people · shelf | Mission complete | Prediction error at 1 s | Velocity error, first 0.5 s in view | Turn at 50 s | In view, untracked | Tracks of nobody | Yields to them |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lidar | clear | 1 · 0 (1 · 0, 1 · 0) | 121 s (119, 118) | 0.23 m (0.24, 0.23) | 0.63 m/s (0.48, 0.47) | 0.7 s (0.7, 0.7) | 2 % (1, 3) | 11 (1, 3) | 0 (1, 0) |
| lidar + radar | clear | 2 · 0 (1 · 1, 1 · 0) | 119 s (127, 119) | 0.23 m (0.29, 0.22) | 0.46 m/s (0.40, 0.36) | 0.1 s (0.2, 0.3) | 1 % (3, 2) | 4 (3, 3) | 0 (0, 1) |
| radar | clear | 1 · 1 (1 · 1, 1 · 1) | 127 s (127, 127) | 0.37 m (0.35, 0.33) | 0.45 m/s (0.43, 0.34) | 0.1 s (0.2, 0.2) | 10 % (12, 13) | 1 (0, 0) | 0 (0, 0) |
| lidar | fog | 1 · 0 (4 · 0, 4 · 0) | 121 s (118, 123) | 0.37 m (0.39, 0.40) | 0.75 m/s (0.59, 0.59) | 0.6 s (1.3, 0.8) | 12 % (15, 12) | 19 (16, 26) | 4 (6, 3) |
| lidar + radar | fog | 1 · 0 (3 · 0, 4 · 1) | 123 s (113, 134) | 0.39 m (0.46, 0.44) | 0.61 m/s (0.45, 0.66) | 0.5 s (0.8, 0.9) | 4 % (7, 19) | 12 (15, 17) | 1 (2, 2) |
| lidar + radar, 10 false per scan | clear | 1 · 0 (1 · 0, 0 · 1) | 131 s (134, 129) | 0.38 m (0.33, 0.32) | 0.56 m/s (0.50, 0.36) | 2.8 s (1.7, 0.8) | 2 % (1, 3) | 221 (206, 203) | 25 (22, 14) |
| lidar + radar, ghosts 50 % | clear | 0 · 1 (1 · 1, 2 · 0) | 127 s (127, 119) | 0.34 m (0.28, 0.24) | 0.49 m/s (0.32, 0.32) | 0.3 s (0.2, 0.3) | 3 % (3, 2) | 18 (24, 16) | 1 (1, 2) |

The radar sees about four static echoes a scan on this floor, half a false one, a person in a quarter of the scans (the shelves hide the rest from a forward sensor) and a ghost in one scan in fifty. The reading: the radar's gain is speed, early. A head-on turn is followed in a scan or two instead of most of a second, and a track's first half second in view is a quarter better; a turn across the line of sight (at 83 s, at 1.6 m) is followed in 0.8 s with or without it, since Doppler does not see it. Averaged over a run, which old tracks dominate, the prediction error does not move, because once a track is a second old the lidar's inferred velocity is as good along the line of sight and better across it. Alone, the radar tracks only ahead, a person in its view goes untracked a tenth of the time, and its coarse positions make the prediction error half as large again. The shelf column is the cost of reacting sooner: with the radar in the tracker the robot touched a shelf end in 7 runs of 15, with the lidar alone in none of 6 (the one examined: stopped for a person, then turning in place beside a shelf end); lesson 3's ground-truth tracks do the same. Better tracks make the speed planner's yields sharper, and a sharp yield next to a shelf is a hazard this planner does not weigh. In fog the fusion keeps people ahead tracked on two seeds of three (on the third the robot was held against a shelf end with a person in view) and halves the yields to tracks of nobody on all three; it does not improve the lidar's own tracks, which still believe their fogged clusters to 0.1 m, so the turn at 50 s takes 0.5 s instead of 0.1: the noise a filter assumes has to follow the conditions, and here nothing tells it the weather changed. The prediction error in fog is slightly higher with the radar, because the radar keeps tracks of people far down the aisles, with coarse positions, that the fogged lidar never had, and they are scored too.

**Where the radar is worse, and where the lidar still wins.** *Angle:* 3° of bearing noise is {{live:radLat10}} m at 10 m and the resolution {{live:radCross10}} m, against centimetres for a lidar cluster; two people walking together are one target. *Ghosts:* along walls, a person in one aisle appears in the next, moving like a person; the map cannot reject them and Doppler marks them as moving. *No shape:* one point per target, so no outline, no size, no map; a person standing still is the same echo as a post. *Standing targets near structure* are filed as structure. *Coverage:* this radar looks forward over {{live:radFov}}°; the lidar sees all round. *Tangential velocity:* none from one detection. The lidar still wins on position, on everything to the sides and behind, on mapping and localization (chapter 2's scan matching needs its geometry), and on anything that stands still. The radar wins on speed along the line of sight from the first echo, on range, and on weather; the moose test of control lesson 17 shows the cheapest use of it, a time to contact $r / (-v_r)$ from one detection with no tracking at all.

[try: Lidar + radar | {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both"},"tab":"per","layers":{"agents":true,"radar":true}}] [try: Fog, lidar only | {"sim":true,"level":4,"set":{"radar":true,"weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}] [try: Fog, lidar + radar | {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both","weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}]

## 13. What to carry into the next chapters

The log-odds map and the costmap are what the planners of chapter 4 search; the inflation penalty is the term that makes A* prefer the middle of an aisle, and the unknown-cell policy decides whether an unexplored room is a route or a wall. The tracks and their growing radii are what the space-time planner blocks cells with and what the speed planner slows down for, and everything in §7 is why those planners work on timestamps rather than on "now". The pattern from chapter 2 holds throughout: the covariance, or its stand-in, is consumed downstream, and a tracker that reports a velocity it does not really know yet is as dangerous to the speed planner as an overconfident EKF is to the costmap.
