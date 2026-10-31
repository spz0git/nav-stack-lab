id: ch3
num: 3
sys: per
summary: The derivations behind the Perception lessons: the binary Bayes filter behind log-odds mapping, the distance transform and inflation cost, lidar clustering, the constant-velocity Kalman tracker and its gains, and prediction with growing uncertainty. Then what sensor latency does to each estimator, the social-force model of people, the sonar ring's arc inverse sensor model and cone likelihood, and a radar's measurement model fused into the tracker.

# Perception: maps, costs and people

Perception turns raw sensor returns into the three things the rest of the stack consumes. They are a map of what is static, a cost for every cell the planner may enter, and a list of things that move with a guess of where they will be. This chapter derives the versions of each that run in the lab, in the order of the Perception lessons. It starts with log-odds mapping (lesson 1), the costmap (lesson 2), tracking and prediction (lesson 3), what latency does to all of these (lesson 4) and the model of people who react (lesson 5). After them come the learned detector and predictor (lessons 7 and 8, §9 and §10), the sonar ring (lesson 9, §11) and the radar (lesson 10, §12). Lesson 6's velocity obstacles are derived in chapter 4 §9. The blue numbers follow your settings. The lidar noise is σ = {{live:lidarSig}} m, the inflation band is {{live:infl}} m, the tracker's process noise is σ<sub>a</sub> = {{live:agSigA}} m/s², the prediction horizon is {{live:agT}} s, and the sensor latency is {{live:sensLat}} s.

## 1. Everything is in the estimated frame

A lidar return is a range along a known beam direction *relative to the robot*. To put it on a map, or to compare it with a map, the robot has to know where it is. Every hit is therefore placed with the current pose estimate:

$$
p_k = \hat p + r_k\,[\cos(\hat\theta + \alpha_k),\ \sin(\hat\theta + \alpha_k)], \qquad \alpha_k = -\pi + k\,\frac{2\pi}{120}
$$

If the estimate is off by $(\delta_x, \delta_y, \delta_\theta)$, every hit is off by the same translation, plus $r_k\,\delta_\theta$ across the beam. So a map can be no better than the localization that placed its hits, and this is how chapter 2 and this chapter connect. A drifting estimate does not blur the map. It draws the same wall several times, once from each wrong pose. The lab's lidar has 120 beams over 360°, a range of 8 m, a rate of 10 Hz and Gaussian range noise σ = {{live:lidarSig}} m. On the levels with mapping, localization runs on the EKF with beacons, so the frame error is a few centimetres. The first mapping experiment, on the EKF, looks clean for this reason, and the second, on dead reckoning, does not.

## 2. Occupancy mapping as a binary Bayes filter

**One cell.** Treat each 0.1 m cell as a binary variable, occupied or not, that does not change over time (the static-world assumption). Treat the beams as independent pieces of evidence about it. After a measurement $z$, Bayes' rule for the cell is

$$
p(m \mid z_{1:t}) = \frac{p(z_t \mid m)\, p(m \mid z_{1:t-1})}{p(z_t)}
$$

and the same for $\neg m$. The inverse sensor model $p(m \mid z_t)$, the probability that the cell is occupied given this one reading alone, is easier to write down than $p(z_t \mid m)$. So Bayes' rule is applied once more, $p(z_t \mid m) = p(m \mid z_t)\,p(z_t)/p(m)$. Dividing the expression for $m$ by the one for $\neg m$ removes the normalizer, and taking logs turns the product into a sum. With the log-odds $l = \ln\frac{p(m)}{1 - p(m)}$ and the inverse sensor model written in the same units,

$$
l_t = l_{t-1} + \underbrace{\ln\frac{p(m \mid z_t)}{1 - p(m \mid z_t)}}_{l_{\text{meas}}} - \underbrace{\ln\frac{p(m)}{1 - p(m)}}_{l_0}
$$

With the prior $p(m) = 0.5$, $l_0 = 0$, and the update is one addition per cell per beam. This is the reason for using log-odds. In probabilities a Bayes update is a multiplication followed by a normalization, and in log-odds it is one addition. A cell seen a hundred times costs the same to update as one seen once.

**The inverse sensor model.** A beam that returns at range $r$ says the cells along it are probably free and the cell it ends in is probably occupied. The lab uses $l_{\text{free}} = -0.4$ for every cell the beam crosses and $l_{\text{hit}} = +0.85$ for the end cell when the beam returned (a beam at maximum range marks free cells and no hit). In probabilities those are $p(m \mid \text{crossed}) = 0.40$ and $p(m \mid \text{end}) = 0.70$. A single hit is enough to call a cell occupied at the threshold $l > 0.5$ ($p > 0.62$). It takes about two clean passes through the cell to undo one hit. The asymmetry is deliberate, because a false "occupied" costs a detour and a false "free" costs a collision.

**Clamping.** Log-odds are capped at ±4, which is $p = 0.982$. Without a cap, a pallet seen for a minute at 10 Hz would sit at $l \approx 500$, and its cells could never be erased after it moved. With the cap, about ten contradicting beams are always enough to change a cell. The costmap counts a cell as unknown when $|l| < 0.05$, which holds only for cells nothing has touched.

**Tracing the beam.** Each beam is walked cell by cell from the robot's cell to the end cell with Bresenham's line algorithm. At 120 beams every 0.1 s, the map takes in about 1200 beams per second, each crossing a few dozen cells. The costmap is rebuilt from the log-odds every 0.5 s.

**Between the beams.** The beams are 3° apart, so at range $r$ neighbouring beams are $r \cdot 2\pi/120 \approx 0.052\,r$ apart. Beyond 2 m that is more than a cell, and at the 8 m limit it is 42 cm. Beyond about 2 m a scan therefore leaves unseen cells between its beams. They stay unseen while the robot stands still, because it fires the same beams every time. This does no harm when unknown counts as free. Under the cautious policy (§3), every one of them is an obstacle inflated by 0.4 m, and after one scan the robot could plan only within about 3 m. To avoid this, each gap between two neighbouring beams also gets four virtual rays, one every 0.6°. A virtual ray runs out to the shorter of the two beams' ranges and stops one cell short of it. It marks each untouched cell it crosses with a value no beam produces ($l = -0.06$). The costmap reads such a cell as free. Everything that asks whether the robot has looked there reads it as unseen: the frontiers of exploration, the floor seen, and the map's agreement with the truth. The first real beam through the cell starts from zero, as if the cell had never been marked. The virtual rays stop at any cell a beam has seen occupied. A corner that pokes out between two beams can still be marked free until a beam hits it. An obstacle thinner than the gap, which no beam hits, is drawn free, as a real lidar that missed it would draw it. With unknown counted as free, none of this changes a run, because the costmap is the same and exploration sees the same map. Under the cautious policy it does change: after the first scan at the start of L2, the floor the robot can plan through reaches 7 m instead of 3.

**What a frame error does.** A hit placed from a pose that is 1 m off lands 1 m from the wall it came from. The next scan, from a slightly different wrong pose, lands somewhere else. Over a minute of dead reckoning the wall is drawn as a row of parallel ghost walls. Free-space evidence from later scans crosses the earlier ghosts and partly erases them. The map ends up with fragments of walls that do not exist and gaps in walls that do. Lesson 1 measures the damage. With the EKF, 100 % of the cells the map calls occupied have a real obstacle within one cell, and 96 % of the seen obstacle cells are mapped. With dead reckoning the same numbers are 22 % and 18 %.

[try: Map the building, EKF | {"sim":true,"level":3,"tab":"per"}] [try: Map with dead reckoning | {"sim":true,"level":3,"set":{"loc":"dr"},"tab":"per"}]

## 3. The costmap: distance transform and inflation

**From occupancy to distance.** The planner needs to know, for every cell, how far away the nearest obstacle is. Measuring the distance from each of 38 400 cells to every occupied cell is too slow at 2 Hz, so the lab uses a two-pass chamfer distance transform. The first pass sweeps the grid forward. Each cell takes the smallest value among its already-visited neighbours plus the step to that neighbour, 1 for a straight step and $\sqrt 2$ for a diagonal one. The second pass sweeps backward and does the same with the other neighbours. Between them the two passes look at all eight neighbours of every cell, and nothing is searched. The result is the length of the shortest 8-connected path to an obstacle, which over-estimates the Euclidean distance by at most about 8 % (at angles between the straight and diagonal directions), an error on the safe side.

**Lethal and the band.** The robot is a disc of radius 0.3 m, so any cell closer than 0.3 m to an obstacle would put the body inside it. The lab adds a 0.1 m margin for path-tracking error and calls cells with $d < 0.4$ m lethal. Beyond that distance, a penalty fades out across the inflation band of width $w$ = {{live:infl}} m:

$$
\text{penalty}(d) = \left(\frac{0.4 + w - d}{w}\right)^2 \text{ for } 0.4 \le d < 0.4 + w, \qquad \text{edge cost} = \text{length} \times (1 + 3\,\text{penalty})
$$

The penalty is quadratic, so a path pays little for brushing the outer edge of the band and a lot for hugging the lethal boundary. With the factor 3, a cell at the inner edge costs four times its length. The planner enters the band whenever going round it would cost more than the penalty. So the band works as a preference, and it never blocks a path the way a lethal cell does. For the same reason, widening it to 1.4 m in lesson 2 changes the path in open floor, where the path moves to the middle of the aisles. It does not change the path through a doorway narrower than the band, because there every route pays the same penalty and the planner pays it.

**Unknown cells.** On a map being built, most cells have never been seen, and the costmap needs a rule for them. "Unknown is free" lets the planner plan into rooms the robot has not entered. That is optimistic, and replanning corrects it as walls appear. "Unknown is lethal" refuses to plan anywhere unseen. That is safe, but on its own it leaves a goal in unknown space with no path. A sensor that sees farther would not fix this, since one scan reaches 8 m at most and sees nothing behind a wall. The cautious choice works only together with a behaviour that drives towards the boundary between seen and unseen floor. When there is a goal, this is the mission layer's stand-in goal at the edge of the seen floor (chapter 4 §5). With no goal at all, it is frontier exploration (Mission → Explore, chapter 4 §7).

[try: The cost layer | {"sim":true,"level":1,"layers":{"cost":true},"tab":"per"}] [try: Inflation 1.4 m | {"sim":true,"level":1,"set":{"infl":1.4},"layers":{"cost":true},"tab":"per"}]

## 4. Finding people in a scan

A person is a cluster of lidar hits that the static map cannot explain. Against a known map, the lab calls a hit explained when the costmap distance at its cell is under 0.25 m. On a map being built, a hit is explained when any neighbouring cell has log-odds above 2.0, which means the cell has been seen occupied several times. So a person who stands still for a while becomes part of the map and stops being tracked. This is a real failure mode of the design. The unexplained hits are grouped over consecutive beams. A hit joins the current cluster if it is within 0.45 m of the previous hit and at most one beam was skipped. The first and last clusters are joined when the scan wraps around behind the robot. Clusters wider than 1.2 m (2.2 m on the level with vehicles) are discarded. This removes most furniture and any wall that slipped through.

Two corrections make the cluster usable as a person. A lidar sees only the near side of a body, so the centroid of the hits is biased towards the robot. The lab moves it away from the robot by 0.6 of the estimated radius. The radius is estimated from the cluster's extent and clamped to 0.3–0.55 m for people. It is smoothed into the track with a factor 0.2 per update, so that a person seen only in part does not shrink.

## 5. Tracking: a constant-velocity Kalman filter

**The model.** Each confirmed person is a state $[p_x, p_y, v_x, v_y]$ and the assumption is that velocity is constant except for random accelerations. For one axis over an update interval $\Delta t$:

$$
\begin{bmatrix} p \\ v \end{bmatrix}_{t+1} = \underbrace{\begin{bmatrix} 1 & \Delta t \\ 0 & 1 \end{bmatrix}}_{F} \begin{bmatrix} p \\ v \end{bmatrix}_t + \begin{bmatrix} \Delta t^2/2 \\ \Delta t \end{bmatrix} a, \qquad a \sim \mathcal N(0, \sigma_a^2)
$$

The acceleration enters through the vector $\Gamma = [\Delta t^2/2, \Delta t]^{\mathsf T}$, so the process noise covariance is $R = \Gamma \sigma_a^2 \Gamma^{\mathsf T}$. ($R$ is the process noise in state space and $Q$ the measurement noise, as in chapter 2 and in *Probabilistic Robotics*; many Kalman-filter texts swap the two letters.) Written out,

$$
R = \sigma_a^2 \begin{bmatrix} \Delta t^4/4 & \Delta t^3/2 \\ \Delta t^3/2 & \Delta t^2 \end{bmatrix}
$$

This matrix is the "a, b, c" update in the lab's tracker. The noise is the same in both axes and the axes do not interact, so both axes use one covariance. The filter stores three numbers, $P_{pp}, P_{pv}, P_{vv}$, instead of sixteen. The measurement is the position only, $z = p + \nu$, $\nu \sim \mathcal N(0, \sigma_z^2)$ with $\sigma_z$ = 0.1 m. Velocity is never measured. The filter infers it from how the position innovations add up over several updates, and most of what is hard about tracking comes from this.

**The gains, and why velocity lags.** With the models above, the Kalman gain settles to a steady state. The steady state depends on one dimensionless number, the tracking index $\lambda = \sigma_a \Delta t^2 / \sigma_z$. It is how far the target can move unpredictably in one update, in units of the sensor noise. With your settings, σ<sub>a</sub> = {{live:agSigA}} m/s², Δt = 0.1 s and σ<sub>z</sub> = 0.1 m, λ = {{live:lam}}. The steady-state gains are α = {{live:alpha}} on position and β = {{live:beta}} on velocity. Each update moves the position estimate a fraction α of the way to the measurement, and adds β × innovation / Δt to the velocity. (These are the closed-form α–β filter gains, $\alpha = -\tfrac18\left(\lambda^2 + 8\lambda - (\lambda + 4)\sqrt{\lambda^2 + 8\lambda}\right)$, $\beta = \tfrac14\left(\lambda^2 + 4\lambda - \lambda\sqrt{\lambda^2 + 8\lambda}\right)$.) The error dynamics have eigenvalues of magnitude $\sqrt{1 - \alpha}$ per update. The error shrinks by that factor every Δt, so it falls by a factor $e$ in $-\Delta t / \ln\sqrt{1 - \alpha}$, a time constant of {{live:tauv}} s. When a person's velocity changes suddenly, the track needs two to three time constants to catch up fully. All that time the prediction points the wrong way. Raise σ<sub>a</sub> and the track follows faster but jitters more. Lower it and the velocity is smooth but late. Lesson 3's run measures where this trade-off lands: a mean velocity error of about 0.14 m/s, for people walking at 0.6 to 0.9 m/s.

**Association and lifecycle.** Each detection is compared with each predicted track by the Mahalanobis distance of its position. A pair passes the gate when $d^2 = \|z - \hat p\|^2 / (P_{pp} + \sigma_z^2) < 9.21$, the same χ²₂ gate as in chapter 2. The pairs that pass are taken greedily in order of increasing $d^2$, and each track and each detection is used once. A detection that matched nothing starts a tentative track with $P_{pp} = \sigma_z^2$ and $P_{vv}$ = 1. That is a velocity known to ±1 m/s, which for a walking person means not known at all. A track is confirmed after three hits, so a single stray cluster never becomes a person. A tentative track that gets no detection for 0.25 s is dropped. A confirmed one coasts on its prediction for 1 s before it is dropped, so a person who walks behind a pillar keeps their track. Velocities are capped at 2.5 m/s.

[try: Lidar tracker | {"sim":true,"level":4,"tab":"per"}] [try: Ground-truth tracks | {"sim":true,"level":4,"set":{"agents":"truth"},"tab":"per"}]

## 6. Prediction, and why the radius grows

The tracker says where each person is now, and the planner needs to know where they will be. Constant-velocity prediction extrapolates the track along its velocity. The uncertainty of that extrapolation grows with the horizon for two reasons: the track's velocity is itself uncertain, and people change their minds. A person at $p$ with velocity $v$ and radius $r$ is predicted at time $t$ ahead as

$$
p(t) = p + v\,t, \qquad r(t) = r + g\,t
$$

The lab does not propagate the track covariance through time for the planner. It inflates the person's radius linearly at $g$ = {{live:agGrow}} m/s out to a horizon of {{live:agT}} s, so a person of radius 0.35 m is a disc of {{live:rAtT}} m at the end of the horizon. Linear growth is a cheap stand-in for the $\sqrt{P_{vv}}\,t$ that propagating the covariance would give. The space-time planner and the speed planner of chapter 4 block cells with these growing discs. Freezing the prediction ($v = 0$ for planning, radius constant) is the other extreme. The planner then reacts to where people are now. That looks reasonable, but the plan is off by $v \times$ (reaction time) every time, and this is where the extra contacts in lesson 3's third experiment come from.

[try: Prediction frozen | {"sim":true,"level":4,"set":{"agPred":"static"},"tab":"per","plot":"st"}]

## 7. Latency: the reading is true, the time is wrong

Real sensors deliver their readings late, after exposure, transfer and processing. The lab queues each lidar scan and beacon reading and delivers it $T_s$ = {{live:sensLat}} s later. The estimators that receive it assume it was taken now. Each consumer goes wrong in its own way.

**The EKF.** The reading describes where the robot was, but the innovation is computed against a prediction that has moved on by $v\,T_s$ since. For a beacon roughly ahead, $\nu \approx v\,T_s$ along the beam. At 0.8 m/s and 0.2 s latency that is a 16 cm range error. It has the same sign every time the robot moves, so it is a bias and not noise. The filter treats it as noise and pulls the estimate back along the direction of travel, and its covariance does not account for the error. The result is the signature of chapter 2 §5, a biased and overconfident filter. In lesson 4's first experiment NEES is 17 to 115 while driving, and it is back to normal within about ten seconds of the robot stopping.

**The map and the tracker.** Lidar hits are placed with the pose at *delivery* time, so every scan is shifted by $v\,T_s$ against the direction of travel, which is 24 cm at 0.3 s latency. Walls across the direction of motion are drawn $v\,T_s$ too close, and the next scan, taken from a different place, erases them. In lesson 4's third experiment the recall of the real walls drops from 96 % to 83 %, and the robot replans twice as often. For the tracker it is worse. The same shift applies to a person's hits, so a person seen while the robot turns appears to jump. The detection then fails the gate and starts a new tentative track. In lesson 4's second experiment the tracker confirms hundreds of tracks for four people, and the speed planner yields to these ghosts.

**The fix.** Stamp each reading with the time it was taken, keep the states (or the odometry) since then, and apply the reading at its own time. When the reading arrives, rewind the estimate to the reading's timestamp, correct it there, and replay the odometry forward to now. A lagged-state or buffered filter works this way. The lab does not implement one, so the lesson shows the problem without the cure.

[try: EKF, latency 0.2 s | {"sim":true,"level":2,"set":{"loc":"ekf","sensLat":0.2},"tab":"veh","plot":"pos"}] [try: Mapping with latency 0.3 s | {"sim":true,"level":3,"set":{"sensLat":0.3},"tab":"per"}]

## 8. People who react: the social-force model

Scripted people walk their segment and take no notice of the robot. Reactive people follow a simplified social-force model (Helbing and Molnár, 1995). Each person accelerates towards their preferred velocity and is pushed away from everything close to them:

$$
\dot v = \frac{v_0\,e - v}{\tau} \;+\; \sum_{j} A\,e^{(r_i + r_j - d_{ij})/B}\, n_{ij} \;+\; A_r\,e^{(r_i + r_{\text{robot}} - d)/B_r}\, n \;+\; A_w\,e^{(r_i - d_{\text{wall}})/B_w}\, \nabla d_{\text{wall}}
$$

The first term is the drive. In it $e$ is the unit vector to the goal, $v_0$ the preferred speed (0.6 to 0.9 m/s on the busy floor) and τ = 0.5 s the relaxation time, so a person recovers their walking velocity in about half a second after a disturbance. The other terms are exponential repulsions. The second pushes away from other people ($A$ = 2 m/s², $B$ = 0.35 m). The third pushes away from the robot ($A_r$ = 3, $B_r$ = 0.5 m). It is stronger and reaches farther, because people give machines more room. The last pushes away from walls ($A_w$ = 2.5, $B_w$ = 0.25 m). It points along the gradient of the distance field, so the chamfer transform of §3 is reused here as a potential. Speed is capped at 1.3 $v_0$. Because of the exponential form, the push is negligible beyond a few $B$ and very strong once the distance is less than the sum of the radii. This makes it behave like a soft body rather than a spring.

Lesson 5 shows what this means for evaluating a planner. Reactive people absorb the planner's mistakes. A robot that ignores people entirely makes 3 contacts on the busy floor with scripted people and 2 with reactive ones (counted up to Mission complete), because the people step aside. The closest approach changes more, from a 0.57 m overlap with scripted people to 0.18 m with reactive ones. A benchmark against reactive agents therefore under-reports the planner's errors by the share the agents absorbed. So contact counts should be read together with closest approach, and scripted agents that do not yield are the stricter test.

[try: Reactive people, speed planning | {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"veh"}] [try: Scripted people, ignored | {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}]

## 9. A learned detector

**What it replaces.** §4 finds people as hits the map cannot explain. That test works only if the map is right and the robot knows where it is on it. While the map is being built, nothing is explained yet. So on a level the robot explores for the first time, the rule returns thousands of detections, and nearly all of them are walls (precision 0.07 on L5 under lidar mapping, measured below). When the pose estimate drifts, the walls of a correct map land beside the walls the lidar sees, and the rule calls every hit on them a person. The learned detector replaces this one stage and nothing else. It still hands clusters to the tracker of §5.

**The network.** The scan is a ring of $120$ beams with seven numbers each. The first is the range $r/8$. The second is the previous scan reprojected through the odometry into the current body frame, $\tilde r_{prev}/8$. Each previous point is moved by $(v\,\Delta t, \omega\,\Delta t)$ and re-binned by beam, so that a static wall reads the same range twice and a person does not. The third number is the difference $\mathrm{clip}(r - \tilde r_{prev}, \pm 1)$ and the fourth is the hit flag. The fifth and sixth are $v/1.5$ and $\omega/2$, the same for every beam. The seventh is the map evidence $s$, which says how well the robot's map explains the hit, placed from the estimated pose. With the prior map, $s = \mathrm{clip}(1 - d/0.5, 0, 1)$ for the distance $d$ from the hit to the nearest mapped obstacle, so $s = 0.5$ at the rule's 0.25 m. With the built map, $s = \mathrm{clip}(\ell_{max}/4, 0, 1)$ for the highest log-odds $\ell_{max}$ around the cell, which is 0.5 at the rule's level of 2. So $s$ carries the rule's test as a number instead of a yes or no. The network is four one-dimensional convolutions with circular padding, since beam 119 is next to beam 0. Their kernels are 7, 7, 5 and 1 beams wide with 24 channels, with a ReLU between layers and a sigmoid at the end. The output is one probability per beam, computed from a receptive field of 17 beams, and the network has 8 185 parameters. Beams with a probability above 0.8 are clustered in the way §4 clusters unexplained hits, and a cluster of a person's width is a detection.

**Why the map is an input and not a mask.** The obvious alternative is to run the rule first and let the network look only at the unexplained hits. That would inherit every failure of the rule. While the map is unsettled, nothing is masked. A person within 0.25 m of a wall is masked away. Under drift, the misplaced walls pass the mask. As an input, the map evidence is one more cue that the network weighs against the others. The first version of this detector had no map channel at all, and it lost to the rule wherever a map existed (precision 0.73 against 0.92 on L5). Nearly all its false positives were on walls, where the frame-to-frame change is a weak cue. Re-binning a wall seen at a grazing angle, or the edge of an occlusion, moves the range by more than 15 cm on 7–9 % of wall beams between scans, even with perfect odometry. With shape and that change alone the network could not match the rule. With the map evidence added, it beats the rule.

**Training.** `tools/collect-detector.mjs` runs 36 headless missions on the two levels with people (L5, L6; scripted and reacting; seeds 21–38). It labels each beam from the true pose and the people's true discs. That gives 43 000 scans, and 3.7 % of their beams are on a person. The runs cycle through three map conditions. The first is the prior map with the level's localization, the second the map built by lidar, and the third the prior map with dead reckoning on noisy, biased odometry. The first condition teaches the network that good map evidence is reliable. The other two teach it that weak or misplaced evidence is not, and that a wall-shaped arc that does not move is a wall, even where the map says otherwise. `training/detector/train.py` holds the last three runs out, one per condition. It minimizes a binary cross-entropy with Adam and a cosine decay of the learning rate. The positive class is weighted by $\sqrt{(1-\pi)/\pi}$, where $\pi$ is the share of person beams. Weighting it by the full ratio of 26 would gain recall at the cost of more false beams. Training takes sixty epochs, thirteen minutes on a laptop. Per beam on the held-out runs, at the threshold, precision and recall are 0.99 and 0.97 with the prior map, 0.95 and 0.81 under mapping, and 0.74 and 0.79 under drift. The weights are written as flat lists to `src/models/detector.json`, together with the threshold and the smallest number of beams per detection (one). The build inlines them. `nnForward` in `src/core/nn.js` runs the same four layers in plain loops, with no dependency, in a fraction of a millisecond per scan. The seeds start at 21 so that every seed a lesson uses is a run the network has not seen.

**Measured** on L5 at seed 7 over 120 s, with the speed planner, scored per scan against the truth. A person counts as detectable when a beam hits them. A detection counts as true when it is within 0.5 m of a person. The comparison is made in the robot's frame, so that an error of the pose estimate is not counted against the detector. The velocity RMS is over the confirmed tracks.

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

With a good map and a good pose the two detectors are level, because the rule is already nearly perfect there. Over seeds 2 to 5 and 7 the mean precision is 0.94 for both, and the recall is 0.96 for the network against 1.00 for the rule. Wherever the rule's premise breaks, the network's precision is ten or more times higher. This holds while the map is being built (0.68 against 0.06, the mean of five seeds) and when the pose drifts on dead reckoning (0.71 against 0.06). The network also wins when a particle filter, with nothing switched off, slips for a few scans at a time (seed 12, 0.81 against 0.33). The confirmed tracks show the same. Under mapping and drift the rule usually carries a dozen phantom tracks or more, and the network one or none. The network has no better knowledge of the floor than the map. It weighs several cues and degrades gently when one of them fails, while a rule built on one cue fails when that cue does. There are two costs. The training set has to contain the failures (here the built-map and drift runs), and nobody can read the detector's mistakes off its weights. Its misses are people seen edge-on far down an aisle, who are hit by only a beam or two. Per-target scan matching (§5) aligns a track's hits from one scan to the next by ICP (iterative closest point) and fuses the result as a velocity measurement with the filter's own gain. It changes the velocity error by a few centimetres per second, which is within the run-to-run variation.

**The pipeline.** The data is collected in Node over the headless core. The network is trained in Python and exported as JSON, and the build inlines it, so the page runs it in plain JavaScript. Every learned block of the lab arrives this way, so training is the only place where Python enters the project (`training/README.md`).

[try: The learned detector, the pose drifting | {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","loc":"dr"},"tab":"per","layers":{"lidar":true,"agents":true}}] [try: The rule, the pose drifting | {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","loc":"dr"},"tab":"per"}]

## 10. A learned predictor

**What it replaces.** §6 predicts every person at constant velocity, $p(t) = p + v\,t$, and grows the radius. The mean of that prediction is wrong whenever a walker turns back at the end of an aisle or a reacting person steps aside. The tracker's $v$ also wobbles, and every wobble is multiplied by $t$. The shape of the prediction is wrong too. A person who may walk on or turn back has two likely futures, and a single prediction halfway between them is a place nobody goes. The learned predictor replaces that one function. It still hands the planners a disc per person and time through `agPred`, so the speed planner, space-time A*, DWA and MPC do not know which predictor they are using.

**The network.** It predicts one tracked person at a time, in the person's own frame. The origin is the tracked position now, and the $x$ axis points along the person's displacement over the last second (towards the robot when they stand still). A walker in an aisle then looks the same in any direction the aisle runs, and the network does not have to learn every heading. There are twenty-four inputs. Ten are the five past positions at 0.2, 0.4, … 1.0 s ago, relative to now (from the track's history, kept by id). Two are the tracked velocity, and four are the robot's position (divided by 4, clipped at 8 m) and velocity. The last eight are the free space along eight rays from the person, every 45°, in the robot's map (sphere-traced on the distance transform, divided by 4, clipped at 4 m). The network is a multilayer perceptron $24 \to 64 \to 64 \to 39$ with ReLU activations and 8 295 parameters. The 39 outputs are three logits $z_k$ and, for each of the $K = 3$ futures, six points at $t_j = 0.5, 1, \dots, 3$ s written as corrections $\Delta_{kj}$ to constant velocity:

$$
\pi_k = \frac{e^{z_k}}{\sum_m e^{z_m}}, \qquad \mu_k(t_j) = v\,t_j + \Delta_{kj}
$$

so a network whose last layer outputs zeros predicts constant velocity, with three equal probabilities. The futures are turned from the person's frame back into the map's. Between the six points the position is interpolated linearly, starting from the person's position at $t = 0$, and past 3 s the last segment is extended.

**The loss and its gradient.** Let $y \in \mathbb{R}^{12}$ be where the person really went (six points) and $\mu_k \in \mathbb{R}^{12}$ the six points of future $k$. A mixture of $K$ Gaussians of fixed spread $\sigma$ gives the outcome a likelihood. The loss is the negative logarithm of that likelihood:

$$
p(y \mid x) = \sum_{k=1}^{K} \pi_k\, \mathcal{N}\big(y;\ \mu_k,\ \sigma^2 I\big), \qquad L = -\log \sum_{k=1}^{K} \pi_k \exp\!\Big(-\frac{\lVert y - \mu_k \rVert^2}{2\sigma^2}\Big)
$$

up to a constant that does not depend on the weights. Write $a_k = \log \pi_k - \lVert y - \mu_k \rVert^2 / 2\sigma^2$, so that $L = -\log \sum_k e^{a_k}$, and define the responsibilities

$$
\gamma_k = \frac{e^{a_k}}{\sum_m e^{a_m}} = \frac{\pi_k\, e^{-\lVert y - \mu_k \rVert^2 / 2\sigma^2}}{\sum_m \pi_m\, e^{-\lVert y - \mu_m \rVert^2 / 2\sigma^2}}
$$

the posterior probability that future $k$ is the one that happened. The derivative of $-\log \sum e^{a}$ with respect to each $a_k$ is $-\gamma_k$. Only $a_k$ depends on $\mu_k$, with $\partial a_k / \partial \mu_k = -(\mu_k - y)/\sigma^2$. Every $a_k$ depends on every logit through $\log \pi_k = z_k - \log \sum_m e^{z_m}$, with $\partial \log \pi_k / \partial z_m = \delta_{km} - \pi_m$. By the chain rule

$$
\frac{\partial L}{\partial \mu_k} = \gamma_k\, \frac{\mu_k - y}{\sigma^2}, \qquad \frac{\partial L}{\partial z_m} = -\sum_k \gamma_k (\delta_{km} - \pi_m) = \pi_m - \gamma_m
$$

using $\sum_k \gamma_k = 1$. The first gradient moves each future towards the outcome, in proportion to its responsibility. The second moves each probability towards its responsibility. A future that never explains anything gets no gradient and stays where it is. This is the well-known dead component of a mixture. With K = 3 the network here mostly escapes it, and the held-out mean probabilities are 0.67, 0.18 and 0.15. Since $\mu_k = v\,t + \Delta_k$ and the $v\,t$ term does not depend on the weights, $\partial L / \partial \Delta_k = \partial L / \partial \mu_k$. So the corrections train in the same way the positions would. The two gradients are computed by `mixLoss` in `src/core/nn-train.js`, and the gradient check in `tests/node/train.test.mjs` compares them with central differences.

**σ, and winner-takes-all.** As $\sigma \to 0$ the responsibilities become one-hot on the future nearest the outcome. Only that future gets a gradient, and the logits learn to pick it. This limit is the winner-takes-all loss that many trajectory predictors use. A small σ gives the most distinct futures, and the least accurate most probable one. A large σ pulls all three towards the mean. Measured on the held-out runs (the last two seeds of each level, 7 868 samples), with 60 epochs of training for each σ:

| σ | most probable, 1 s · 2 s | best of three, 1 s · 2 s | constant velocity, 1 s · 2 s |
| --- | --- | --- | --- |
| 0.2 m | 0.21 · 0.35 m | 0.14 · 0.21 m | 0.28 · 0.52 m |
| 0.3 m (built in) | 0.21 · 0.34 m | 0.14 · 0.21 m | 0.28 · 0.52 m |
| 0.5 m | 0.20 · 0.31 m | 0.15 · 0.22 m | 0.28 · 0.52 m |

σ is fixed and not learned. Learning a spread for each future gives the full mixture density network, which is less stable to train, and the planners here would not use the spread. They give the learned futures the same growing radius $r + g\,t$ as constant velocity, so that the two predictors differ only in their centres.

**Training.** `tools/collect-pred.mjs` runs 48 headless missions of 150 s on L5 and L6 (seeds 21 to 44), with the mission looping. The runs alternate between scripted and reacting people. They also alternate between a robot that yields with the speed planner and one that drives through with Ignore, so that reacting people also meet it up close. At every scan, each confirmed lidar track within 0.8 m of a person gives a sample. The sample holds the track's 24 inputs and, as the target, where that person really was 0.5 to 3 s later, minus the constant-velocity points. Where the person was is expressed through the robot's pose estimate at that moment. The true displacement from the true robot pose is placed at the estimated pose, so that a localization error is not taught to the network as motion. This gives 84 760 samples, 76 892 of them for training. `training/predictor/train.py` minimizes the loss above with Adam and a cosine decay, for sixty epochs in ten seconds. The errors per held-out run, at 1 s and 2 s, are:

| Held-out run | constant velocity | learned, most probable | best of three |
| --- | --- | --- | --- |
| L5 seed 43, scripted, robot ignoring | 0.31 · 0.61 m | 0.18 · 0.31 m | 0.13 · 0.21 m |
| L5 seed 44, reacting, robot yielding | 0.28 · 0.54 m | 0.24 · 0.45 m | 0.17 · 0.30 m |
| L6 seed 43, scripted | 0.28 · 0.50 m | 0.19 · 0.28 m | 0.12 · 0.16 m |
| L6 seed 44, reacting | 0.26 · 0.50 m | 0.21 · 0.33 m | 0.14 · 0.21 m |

The weights go to `src/models/predictor.json` (67 KB), and the build inlines them. `mlpForward` runs them in plain loops for every confirmed track at every scan.

**In the page,** the runs are on L5 at seed 7 unless the row says otherwise, read at Mission complete and scored per scan against the truth. The score is the error of the most probable learned future and of constant velocity, 1 s and 2 s after each prediction, on the tracks near a person. The predictor that is not driving the run is scored on what it would have predicted (in brackets).

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

Over seeds 1 to 12, run on the same core in Node, the results are below. The contacts are counted over all the runs, and the time is the mean time to Mission complete over the runs that finished within 240 s.

| Case | constant velocity | learned |
| --- | --- | --- |
| L5, scripted | 14 contacts, 131 s | 11 contacts, 135 s |
| L5, reacting | 1 contact, 139 s | 0 contacts, 135 s |
| L6, scripted | 4 contacts, 164 s | 2 contacts, 168 s |
| L6, reacting | 0 contacts, 161 s | 0 contacts, 171 s |
| L5, scripted, every future ≥ 20 % | | 8 contacts, 147 s |
| L5, scripted, space-time A* | 6 contacts, 146 s (11 finished) | 11 contacts, 126 s (9 finished) |
| L5, scripted, ground-truth tracks | 7 contacts, 139 s | 7 contacts, 139 s |

With lidar tracks, the learned error at 2 s is lower than constant velocity's on every seed, on both levels, with scripted or reacting people. At L5 it is lower by about a third with scripted people and by a quarter with reacting ones. With ground-truth tracks it is higher on every seed (0.32 m against 0.13 m).

**What it did not learn, and where constant velocity still wins.** *A better prediction is not safer driving by itself.* The speed planner's margin and growing radius already absorb most of constant velocity's error. The contacts that remain on L5 are scripted walkers reaching a robot that has already slowed for them, from the side or the front. The speed planner only changes the speed along a fixed path, and slowing down does not help against someone who walks into the place where the robot stands. The network moves such a contact to another encounter, but contacts of this kind remain. At seeds 2, 3, 7 and 11, constant velocity's contact is at about 52 s and the network's at about 102 s. With reacting people the gain is in distance: the closest approach is larger on ten seeds of twelve. The goals reached and the mission times do not improve. *It learned the tracker as much as the people.* Given exact tracks, it keeps correcting a wobble that is not there. Constant velocity is exact for a scripted walker on a straight line, and there it wins by a factor of two and a half. So an improvement upstream, such as a better tracker or per-target scan matching, can make the predictor worse. *With space-time A* it does worse* (11 contacts against 6 over twelve seeds, with two more runs unfinished). That planner commits to a path through gaps between the predicted futures. A confident wrong future can leave a gap where there is none, and a growing constant-velocity disc does not. *It does not know the robot's plan,* only its position and velocity now. So it cannot model people who react to where the robot will be. Prediction and planning each treat the other as given. *It was trained on two levels* and has not been tested on another map. The rays that let it anticipate the end of an aisle may have learned these levels' layouts. *It cannot know when a pause ends,* only how often pauses end each way. For this reason the futures split near the ends of a walk, and the car waits longer on L6. There, within a metre of the end of a walk, a second future of 20 % or more appears about half the time, and in mid-walk one time in five. Velocity obstacles (lesson 6) still read the track's velocity and ignore the learned futures. The predictor slot of the Code tab also receives the tracks, and not the network's output.

**Planning against three futures.** The default gives the planners the most probable future of each person. *Every future ≥ 20 %* makes each likely future an obstacle of its own. This gives fewer contacts (8 against 11 over twelve seeds) and slower missions (147 s against 135 s), because the robot waits for turns that do not happen. Real stacks sit between the two. They weight each future by its probability inside the planner's cost, and replan as the futures resolve. The lab offers only the two ends.

[try: Learned, scripted people | {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}] [try: Where the network is wrong: perfect tracks | {"sim":true,"level":4,"set":{"agPred":"learned","agents":"truth"},"tab":"per","layers":{"agents":true}}]

## 11. Sonar: one range for a whole cone

**The sensor.** An ultrasonic transducer sends a ping and times the first echo; half the time of flight at the speed of sound is the range. The ring in the lab has {{live:sonN}} of them round the hull (Sensors → Ultrasonic ring, off by default), each a cone {{live:sonBeam}}° wide that reports *one number*. That number is the range of the nearest surface anywhere in the cone that sends the echo back, from {{live:sonMin}} m to {{live:sonMax}} m, with σ = {{live:sonSig}} m of noise. The cone is simulated as a fan of rays 2° apart. A ray's echo comes back only if three things hold:

- *The surface faces the sensor.* A smooth surface reflects sound like a mirror: met at an incidence beyond {{live:sonSpec}}° from square-on, the echo goes elsewhere and the sonar hears nothing (a specular miss). With the cone's half-width added, a sonar hears a flat wall only when its axis is within about $15° + 30° = 45°$ of the wall's normal.
- *It is beyond the dead zone.* The transducer rings for a moment after its own ping; an echo from closer than {{live:sonMin}} m arrives during the ringing and is lost.
- *It is within reach.* No echo at all reads as the maximum range, {{live:sonMax}} m.

The sonars fire in turn, one ping every 50 ms, so that one's echoes have died before the next listens. The ring's cycle is {{live:sonN}} × 50 ms = {{live:sonCycle}} s against the lidar's 0.1 s. With {{live:sonN}} cones of {{live:sonBeam}}°, {{live:sonGap}}° between neighbours are seen by no sonar at all. A share of readings (Crosstalk, {{live:sonXt}} %) are a neighbour's echo, reported as this sonar's own range; this is a phenomenological model, not a simulation of the sound field.

**What it is good for, and what the lab leaves out.** A sonar costs a fraction of a lidar, needs no moving parts, and on a real robot it hears glass doors, mirrors, and dark or shiny surfaces that a laser can pass through or fail to see. The lab does not model materials: every surface reflects the laser and the sound alike. So everything below is the sonar's failure modes on the lab's surfaces, and none of its strengths over a lidar. A ring is the cheap proximity sensor under a robot's bumper, not a mapping sensor, and the numbers below say why.

**The arc inverse sensor model.** A lidar beam (§2) says "free along the line, occupied at its end". A sonar reading $z = r$ says less: *something on the arc of radius $r$ inside the cone echoed, and nothing inside the cone before it did*, with no bearing for the echo. Write $A$ for the $n$ cells of that arc which could have echoed, and $h_c$ for "the echo came from cell $c$". With nothing to prefer one cell over another, $p(h_c) = 1/n$. Cell $c$ is occupied if the echo came from it, or otherwise with the prior one half:

$$
p(m_c \mid z) = \frac{1}{n} + \Big(1 - \frac{1}{n}\Big)\frac{1}{2} = \frac{n + 1}{2n}, \qquad l_\text{arc}(n) = \ln\frac{p(m_c \mid z)}{1 - p(m_c \mid z)} = \ln\frac{n + 1}{n - 1} \approx \frac{2}{n}
$$

capped at the lidar's $l_\text{hit} = 0.85$ (for $n \le 2$). The arc is a band 1.4 cells thick (cell centres within 0.07 m of $r$), so $n \approx 1.4\, r \beta / 0.1$ m for a beam of $\beta$ radians: at 2 m about {{live:sonArcN2}} cells, each getting $l_\text{arc} \approx$ {{live:sonLarc2}}. One lidar hit makes a cell occupied ($l > 0.5$); at 2 m it takes four sonar readings that put the same cell on their arcs. That is the whole difference between the two maps in one number: the sonar's evidence is spread over the arc it cannot resolve.

The cells *inside* the cone before the arc get $l_\text{free} = -0.2$ ($p = 0.45$), half the lidar's. A surface met too obliquely to echo can sit inside a cone that read farther, so "nothing closer echoed" is weaker than "the beam went through". A reading at the maximum range updates nothing: an empty cone and a cone full of specular walls read the same.

**Which cells could have echoed.** The $n$ in $l_\text{arc}$ counts only the arc's cells that the map does not already know to be free ($l > -0.5$). A cell that other cones have seen through cannot be the echo, so as the robot drives, the arc's evidence gathers on the cells that are left, which is where the wall is. This is the usual refinement of the model, and it is not an independent-evidence update. It uses the map to interpret the reading that then updates the map, so the map can talk itself into a wall. On the rough-wall run of the table below, counting every arc cell instead costs a goal and doubles the collisions. It reaches 3 goals of 4 with 4 collisions, against 4 with 2 (at seeds 3 and 11, 6 and 5 collisions against 3 each).

**What it predicts.** For a flat wall at perpendicular distance $d$ with the normal inside the cone, $r = d$. The arc's points at angle $\varphi$ off the normal lie $d(1 - \cos\varphi)$ in front of the wall, up to $d(1 - \cos 15°) = 0.034\,d$ (one cell at 3 m), and its ends lie $d \sin 15° = 0.26\,d$ to either side. So the wall is drawn smeared along itself, past a wall's end (a door jamb, the end of a shelf) by up to a quarter of the range. That narrows doorways until a cone sees through them and the free cells take them back. Blind spots come from the physics, not the noise: walls passed at a slant are never heard (the specular rule), and the wall the robot is pressed against is never heard either (the dead zone).

**The cone likelihood.** The particle filter can weight particles by the ring against the prior map (Localize → Also weight particles by the sonar ring), as it does with the lidar's likelihood field (chapter 2 §7). For a particle at pose $x$, the expected reading $\hat z(x)$ is the range of the nearest obstacle of the map inside that sonar's cone, beyond the dead zone and within reach. It is found by marching seven rays 5° apart on the map's distance field and keeping the shortest. Then

$$
p(z \mid x) = \begin{cases} 0.85\, \exp\!\big(-\tfrac{1}{2}(z - \hat z)^2/\sigma^2\big) + 0.05, & z < z_\text{max} \\ 0.9, & z = z_\text{max},\ \hat z \ge z_\text{max} \\ 0.3, & z = z_\text{max},\ \hat z < z_\text{max} \end{cases} \qquad \sigma = 0.15\ \text{m}
$$

The floor 0.05 is for readings the map cannot explain: people, crosstalk. The 0.3 is the chance of a specular miss when the map has a wall in reach; about a third of the ring's readings in the warehouse are exactly that (measured on L5). The log-likelihood of each reading is tempered by 0.5, since successive readings of the same wall are not independent, and nothing is weighted while the robot stands still. The expectation ignores the specular rule (the grid stores no surface normals), so the max-range term carries all of it. That and the dependence between readings are why the filter is overconfident.

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

**Reading the table.** *Mapping:* with smooth walls the robot hits the first wall it meets at a slant, because no cone hears it; the map it builds is a few fragments. Rougher walls give the map its walls back, blurred, and the mission succeeds at one seed of three: the robot still finds the walls it is pressed against by hitting them. *The safety stop:* the lidar stop keeps the reacting walkers off the robot; the sonar stop does not, and the cause is the dead zone. As the person comes within 0.2 m of the hull, the front sonar's next reading is a miss, it replaces the echo that was there, and the stop forgets the person at the moment it matters. Without the dead zone the sonar stop holds. A real ring keeps the last close echo for a while; the lab's does not, so that the failure shows. *Localization:* sonar alone against the map is enough to localize on L3 (five goals of five), with about twice the lidar's error and a band about twice as wide. Crosstalk costs it almost nothing, since the floor in the likelihood absorbs readings the map cannot explain.

[try: Sonar only, the building | {"sim":true,"level":3,"set":{"sonar":true,"mapSrc":"sonar"},"tab":"per"}] [try: Sonar safety stop | {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar"},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}] [try: Sonar-only particle filter | {"sim":true,"level":2,"set":{"loc":"pf","pfLidar":false,"sonar":true,"pfSonar":true,"bOff":"all"},"tab":"loc","plot":"pos"}]

## 12. Radar: range, bearing and Doppler

**The sensor.** A radar sends a radio wave and listens for echoes. The delay gives the range, and the phase across its receiving antennas the bearing. The Doppler shift of the echo's frequency, $f_D = 2 v_r / \lambda$, gives the *radial velocity* $v_r$: the rate at which the range changes, the part of the relative velocity along the line of sight. The lab's radar looks forward, {{live:radFov}}° wide and {{live:radRange}} m deep, at 10 Hz, and each detection is

$$
z = [\,r,\ b,\ v_r\,] + \nu, \qquad \nu \sim \mathcal N\big(0,\ \operatorname{diag}(0.1^2\ \text{m}^2,\ (3°)^2,\ 0.1^2\ \text{m}^2/\text{s}^2)\big)
$$

A person echoes once per scan from the near side of the body (missed one scan in ten: a person is a weak reflector); a vehicle hardly ever misses. A flat surface reflects like a mirror, so a wall echoes strongly only where it faces the radar. The lab samples the field of view every half resolution cell and keeps an echo with probability $0.1 + 0.85\cos^4\phi$ for the incidence angle $\phi$, at most three per shape. That gives a wall a few echoes around its perpendicular and a pillar one or two. On top of that come ghosts and false detections, Poisson with {{live:radClutter}} per scan on average, anywhere in the field of view with random radial velocities.

**Resolution.** Two echoes become one detection when they are closer than the resolution in all three of range (0.4 m), radial velocity (0.25 m/s) and bearing ({{live:radRes}}°), at their amplitude-weighted average. Across the line of sight the angular resolution is a distance that grows with range: at 10 m, {{live:radRes}}° is {{live:radCross10}} m. Two people walking side by side at the same speed are one detection there; two people at different speeds, or at different ranges, are two, because radar separates by range and Doppler far better than by angle.

**Ghosts.** A wave can reach a person by way of a wall and come back the same way. The echo then seems to come from the person's mirror image in the wall plane (the image method): for a wall along $x = c$ the image of $(p_x, p_y)$ moving at $(v_x, v_y)$ is $(2c - p_x, p_y)$ moving at $(-v_x, v_y)$. The lab adds such a ghost with probability {{live:radGhost}} % per person per scan, through the face of a rectangle that faces both the robot and the person. The bounce point has to lie on the face, and both legs of the path have to be clear. A ghost sits behind the wall and moves like a person, so the map does not explain it and its Doppler marks it as moving. The tracker has no way to tell it from a person in the next aisle. Ghosts and clutter are drawn like every other detection for that reason.

**The robot's own speed.** Doppler is relative. A person's radial velocity is the reading minus the robot's own contribution, so the robot must know its speed better than the radar's 0.1 m/s; one tick of wheel odometry on the busy floor is off by about 0.15 m/s. The static world measures it instead: every static echo at bearing $b$ reads $v_r = -v\cos b$, so with the echoes that agree with the odometry's guess to within 0.4 m/s,

$$
\hat v = -\frac{\sum_i v_{r,i} \cos b_i}{\sum_i \cos^2 b_i}
$$

by least squares (the odometry when fewer than three agree). A detection is a candidate for the people tracker in two cases. Either its reading differs from $-\hat v\cos b$ by more than $3\sigma_v + 0.05$ m/s (it moves), or the map does not explain it within $0.25 + 2\,r\,\sigma_b$, the smear of its bearing noise. A person standing still within that smear of a shelf is therefore invisible to the radar tracker, the classic blind spot of Doppler processing.

**The measurement model.** With the track's state $x = [p_x, p_y, v_x, v_y]$, the estimated robot pose $(\hat p, \hat\theta)$ and its velocity $v_e = \hat v\,[\cos\hat\theta, \sin\hat\theta]$, write $d = p - \hat p$, $\rho = \lVert d \rVert$ and $w = v - v_e$. The radar should read

$$
h(x) = \begin{bmatrix} \rho - b_0 \\ \operatorname{atan2}(d_y, d_x) - \hat\theta \\ v_r \end{bmatrix}, \qquad v_r = \frac{d \cdot w}{\rho}
$$

where $b_0$ = 0.24 m is the distance from what the tracker calls a person's centre to the surface that echoes. It is not the body radius of 0.3 m: the lidar's cluster centres sit about 6 cm short of the true centre. The two sensors have to agree on where a person is, or every scan in which only one of them sees the person moves the track by the difference. That calibration between sensors is part of fusion. The Jacobian, row by row: the range depends on position only, through the unit vector $d/\rho$. The bearing depends on it through the perpendicular, scaled by $1/\rho$, since a sideways step changes the angle less the farther away it is. And the radial velocity

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

with the bearing innovation wrapped to $(-\pi, \pi]$ and the covariance update in Joseph's form, which stays symmetric and positive with gains this uneven. $C$ is now the full 4×4 covariance. The lidar tracker of §5 keeps one covariance for both axes, which is exact only while every measurement is a position with the same noise in $x$ and $y$. A radar detection pins range and radial velocity to a tenth and the bearing to 3°, {{live:radLat10}} m across the line of sight at 10 m. After one update the uncertainty is an ellipse along the line of sight, and the filter has to carry all of it. With both sensors, the lidar's clusters update the same filter with $H = [I\ \ 0]$, the update of §5 written for the full covariance.

**Gating and association.** Candidates are paired with tracks nearest first, as in §5, by the Mahalanobis distance of the range and bearing only, $d^2 < 9.21$ (χ² with two degrees of freedom at 99 %); the paired update then uses all three rows. Gating on the radial velocity too would be tighter against clutter, and it was the first version. It rejected exactly the echo of a person who had just turned around, whose Doppler is many σ from a confident wrong track, so the track coasted on the old velocity. The velocity of tracks older than two seconds came out worse than with the lidar alone (0.18 against 0.11 m/s at seed 7). Gate on position, update with everything: the standard compromise for targets that manoeuvre. A candidate left unpaired starts a tentative track at its range plus $b_0$ along its bearing, unless a track is already within 1 m. The radial velocity is known ($\hat v_r + v_e \cdot u$ along the unit line of sight $u$, σ 0.1 m/s) and the tangential velocity not (σ 1 m/s, as a lidar track starts).

**Clutter, and what nearest neighbour does with it.** For a false detection to become a track it has to fall inside a gate three scans running. A gate's area is roughly $\pi \cdot 9.21 \cdot \sigma_r \cdot \rho\sigma_b$, a third of a square metre at 10 m. The field of view is about {{live:radRange}}²·{{live:radFov}}/360·π ≈ 420 m², so with λ false detections per scan the chance per scan of one landing in a given gate is about λ times one in a thousand. Most false tracks are therefore born far out, where the gates are widest and only the radar sees. Nearest neighbour also has a quieter weakness: when a person's own echo is missing (one scan in ten), a false one inside their gate is taken as theirs and pulls the track. Probabilistic data association (PDA, and JPDA for several targets) weighs every echo in the gate by how likely it is to be the target's, including "none of them"; the lab does not implement it.

**Confirmation with two sensors.** With both sensors in the tracker, a track inside the radar's field of view is confirmed only once at least one of its hits came from the radar, or after six lidar hits. Each sensor's artefacts are rare in the other: the air returns lidar hits in fog but no radar echo, and a radar ghost behind a wall returns no lidar hit. The six-hit rule keeps a person the radar cannot see (standing by a shelf) from going unconfirmed; it delays them by 0.3 s. Outside the radar's view the lidar alone confirms as before.

**Weather.** Fog and rain scatter a lidar's near-infrared light (a micrometre against droplets of a few) and barely touch millimetre waves. In the lab, fog cuts the lidar's reach to about 4 m of its 8, drops one beam in seven, adds 5 cm of range noise and returns one beam in two hundred from the air within 2 m. Rain is milder: 6 m, one beam in sixteen, 3 cm, one in five hundred. The radar loses a tenth of its reach in rain and sees 0.3 more false detections per scan; fog leaves it alone.

**Measured** on L5 at seed 7, read at Mission complete, the speed planner, with seeds 2 and 3 in brackets. *In view* is the radar's field (±60°, within 8 m, in line of sight). A track of nobody is a confirmed track that was more often than not more than 1 m from every person. *Turn* is the time until a track's velocity is within 0.3 m/s of a person's who turned round at 50 s, 2 to 3 m ahead, walking straight back at the robot:

| Tracker inputs | Weather | Contacts, people · shelf | Mission complete | Prediction error at 1 s | Velocity error, first 0.5 s in view | Turn at 50 s | In view, untracked | Tracks of nobody | Yields to them |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| lidar | clear | 1 · 0 (1 · 0, 1 · 0) | 121 s (119, 118) | 0.23 m (0.24, 0.23) | 0.63 m/s (0.48, 0.47) | 0.7 s (0.7, 0.7) | 2 % (1, 3) | 11 (1, 3) | 0 (1, 0) |
| lidar + radar | clear | 2 · 0 (1 · 1, 1 · 0) | 119 s (127, 119) | 0.23 m (0.29, 0.22) | 0.46 m/s (0.40, 0.36) | 0.1 s (0.2, 0.3) | 1 % (3, 2) | 4 (3, 3) | 0 (0, 1) |
| radar | clear | 1 · 1 (1 · 1, 1 · 1) | 127 s (127, 127) | 0.37 m (0.35, 0.33) | 0.45 m/s (0.43, 0.34) | 0.1 s (0.2, 0.2) | 10 % (12, 13) | 1 (0, 0) | 0 (0, 0) |
| lidar | fog | 1 · 0 (4 · 0, 4 · 0) | 121 s (118, 123) | 0.37 m (0.39, 0.40) | 0.75 m/s (0.59, 0.59) | 0.6 s (1.3, 0.8) | 12 % (15, 12) | 19 (16, 26) | 4 (6, 3) |
| lidar + radar | fog | 1 · 0 (3 · 0, 4 · 1) | 123 s (113, 134) | 0.39 m (0.46, 0.44) | 0.61 m/s (0.45, 0.66) | 0.5 s (0.8, 0.9) | 4 % (7, 19) | 12 (15, 17) | 1 (2, 2) |
| lidar + radar, 10 false per scan | clear | 1 · 0 (1 · 0, 0 · 1) | 131 s (134, 129) | 0.38 m (0.33, 0.32) | 0.56 m/s (0.50, 0.36) | 2.8 s (1.7, 0.8) | 2 % (1, 3) | 221 (206, 203) | 25 (22, 14) |
| lidar + radar, ghosts 50 % | clear | 0 · 1 (1 · 1, 2 · 0) | 127 s (127, 119) | 0.34 m (0.28, 0.24) | 0.49 m/s (0.32, 0.32) | 0.3 s (0.2, 0.3) | 3 % (3, 2) | 18 (24, 16) | 1 (1, 2) |

On this floor the radar sees about four static echoes a scan and half a false one. It sees a person in a quarter of the scans (the shelves hide the rest from a forward sensor) and a ghost in one scan in fifty. The reading: the radar's gain is speed, early. A head-on turn is followed in a scan or two instead of most of a second, and a track's first half second in view is a quarter better. A turn across the line of sight (at 83 s, at 1.6 m) is followed in 0.8 s with or without it, since Doppler does not see it. Averaged over a run, which old tracks dominate, the prediction error does not move. Once a track is a second old, the lidar's inferred velocity is as good along the line of sight and better across it. Alone, the radar tracks only ahead, a person in its view goes untracked a tenth of the time, and its coarse positions make the prediction error half as large again. The shelf column is the cost of reacting sooner. With the radar in the tracker the robot touched a shelf end in 7 runs of 15, with the lidar alone in none of 6. The one examined had stopped for a person, then turned in place beside a shelf end; lesson 3's ground-truth tracks do the same. Better tracks make the speed planner's yields sharper, and a sharp yield next to a shelf is a hazard this planner does not weigh. In fog the fusion keeps people ahead tracked on two seeds of three (on the third the robot was held against a shelf end with a person in view), and halves the yields to tracks of nobody on all three. It does not improve the lidar's own tracks, which still believe their fogged clusters to 0.1 m, so the turn at 50 s takes 0.5 s instead of 0.1. The noise a filter assumes has to follow the conditions, and here nothing tells it the weather changed. The prediction error in fog is slightly higher with the radar. The radar keeps tracks of people far down the aisles, with coarse positions, that the fogged lidar never had, and they are scored too.

**Where the radar is worse, and where the lidar still wins.** *Angle:* 3° of bearing noise is {{live:radLat10}} m at 10 m and the resolution {{live:radCross10}} m, against centimetres for a lidar cluster; two people walking together are one target. *Ghosts:* along walls, a person in one aisle appears in the next, moving like a person; the map cannot reject them and Doppler marks them as moving. *No shape:* one point per target, so no outline, no size, no map; a person standing still is the same echo as a post. *Standing targets near structure* are filed as structure. *Coverage:* this radar looks forward over {{live:radFov}}°; the lidar sees all round. *Tangential velocity:* none from one detection. The lidar still wins on position, on everything to the sides and behind, on mapping and localization (chapter 2's scan matching needs its geometry), and on anything that stands still. The radar wins on speed along the line of sight from the first echo, on range, and on weather. The moose test of control lesson 17 shows the cheapest use of it: a time to contact $r / (-v_r)$ from one detection, with no tracking at all.

[try: Lidar + radar | {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both"},"tab":"per","layers":{"agents":true,"radar":true}}] [try: Fog, lidar only | {"sim":true,"level":4,"set":{"radar":true,"weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}] [try: Fog, lidar + radar | {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both","weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}]

## 13. What to carry into the next chapters

The log-odds map and the costmap are what the planners of chapter 4 search. The inflation penalty is the term that makes A* prefer the middle of an aisle, and the unknown-cell policy decides whether an unexplored room is a route or a wall. The tracks and their growing radii are what the space-time planner blocks cells with and what the speed planner slows down for. Everything in §7 is why those planners work on timestamps rather than on "now". The pattern from chapter 2 holds throughout: the covariance, or its stand-in, is consumed downstream. A tracker that reports a velocity it does not really know yet is as dangerous to the speed planner as an overconfident EKF is to the costmap.
