group: loc
title: EKF-SLAM: the map is part of the state
level: 3

<p><b>Why this matters.</b> Everything so far assumed that the beacon positions were known. A robot in a new building has no map, and a vehicle whose map is six months old has the wrong one. Simultaneous localization and mapping (SLAM) estimates the map and the pose together. It works because the robot's error is correlated with the errors of everything it has mapped. Keeping those correlations is what makes it expensive. They also move the whole map at once when a loop closes, which is striking the first time you see it.</p>
<p><b>The idea.</b> The beacon positions are appended to the state. The first time a beacon is seen, the filter places it from the current pose and the reading. Its error is then the pose error plus sensor noise, and it stays correlated with the pose. Every later reading of that beacon constrains the pose <i>relative to the landmark</i>, never absolutely, because nothing in a range-and-bearing reading says where either of them is in the world. So between re-observations of old landmarks, the absolute error of the robot and the map together drifts like dead reckoning. Sometimes the robot sees again a beacon that it mapped while it was still certain of its pose. The correction then reaches the pose and every landmark placed since, through the correlations. That is loop closure.</p>
$$x = [x,\ y,\ \theta,\ m_{1x},\ m_{1y},\ \dots] \qquad P \text{ is } (3 + 2n)^2$$
$$\text{new landmark:} \quad m = p + r\begin{bmatrix} \cos(\theta + b) \\ \sin(\theta + b) \end{bmatrix}, \qquad P_{mm} = J_x P_{xx} J_x^\top + J_z Q J_z^\top$$
$$J_x = \begin{bmatrix} 1 & 0 & -r\sin(\theta + b) \\ 0 & 1 & r\cos(\theta + b) \end{bmatrix} \qquad J_z = \begin{bmatrix} \cos(\theta + b) & -r\sin(\theta + b) \\ \sin(\theta + b) & r\cos(\theta + b) \end{bmatrix} \qquad Q = \begin{bmatrix} \sigma_r^2 & 0 \\ 0 & \sigma_b^2 \end{bmatrix}$$
<p><b>Where it comes from.</b> The landmark initialization uses the same linearization argument as the motion model. The new landmark is a function of the pose and the reading. So its covariance is the pose covariance pushed through $J_x$, plus the sensor noise pushed through $J_z$, and its cross-covariance with the pose is $J_x P_{xx}$. The measurement Jacobian's landmark columns are the negatives of its pose columns. That is how "only relative positions are observed" shows up in the algebra. <a class="chref" href="#notes=ch2/8-ekf-slam-the-map-joins-the-state">Derivation: chapter 2 §8</a></p>
<p>Prediction and update are the EKF's, on the larger state. The pose moves by the arc model $g$ with the Jacobians $G$, $V$ of the dead-reckoning lesson, and the landmarks stay put. A reading of landmark $j$ is predicted from the difference $m_j - p$. So its Jacobian $H_j$ is the beacon Jacobian of the Kalman lesson on the pose columns, and the negative of that Jacobian's position part on the landmark's columns.</p>
$$\begin{aligned}
\text{predict:}\quad & (x, y, \theta) \leftarrow g(x, y, \theta, u), \qquad P_{xx} \leftarrow G P_{xx} G^\top + V M V^\top, \qquad P_{xm} \leftarrow G P_{xm}, \qquad P_{mm} \text{ unchanged} \\
\text{update:}\quad & \hat z_j = \begin{bmatrix} \sqrt{q} \\ \operatorname{atan2}(\Delta y, \Delta x) - \theta \end{bmatrix}, \qquad (\Delta x, \Delta y) = m_j - p, \qquad \frac{\partial h}{\partial m_j} = -\frac{\partial h}{\partial p} \\
& K = P H_j^\top S^{-1}, \qquad x \leftarrow x + K\nu, \qquad P \leftarrow P - K S K^\top \quad \text{(then symmetrized)}
\end{aligned}$$
<p><b>What the lab does.</b> Readings carry their beacon ID on this level, so association is free. A beacon seen for the first time is added to the state. Prediction updates only the pose block and its cross terms, and updates use the full $(3 + 2n)^2$ covariance. The ellipses drawn on the beacons are the landmarks' own covariances. The beacon range slider sets how far the robot sees. At 7 m, few beacons are visible from any one place, and the map is a chain of weakly connected pieces. At 12 m, most of the floor shares landmarks, and loops close all the time.</p>

## Try: EKF-SLAM, range 7 m
cfg: {"sim":true,"level":2,"set":{"loc":"slam"},"tab":"loc","plot":"pos"}
Setup: L3 with EKF-SLAM and the default 7 m beacon range. The filter starts with an empty map.
See: The error grows to about 0.5 m in the first 10 s and 1.4 m by 20 s. It then levels off between 1.0 and 1.5 m for the rest of the run, and grows no further. The filter's $\sigma$ settles near 0.55 m, so NEES sits around 8 and the status strip calls the filter overconfident. The mission suffers. In 150 s the robot reaches one goal, skips four as "stuck" and has two collisions. The ellipses on the beacons stay large.
Shows: The plateau shows both what SLAM does and where it stops. Re-observing the same few beacons keeps the pose bounded <i>relative to them</i>. The map itself, though, was laid down from a pose that had already drifted, and nothing ties it to the world. So the robot and the map together are offset by a metre and stay there. The overconfidence has the same cause as in lesson 2, the unmodelled odometry bias, which is now built into the landmark positions as well. Where the plateau lies changes from run to run. On seeds 1 to 5 the error settles anywhere from 5 cm to 2.3 m, depending on how far the pose drifted before the robot saw its first beacons again. The filter is overconfident on some of these seeds and not on others. On every seed, the error stops growing.
Predict: EKF-SLAM from an empty map with the 7 m beacon range: what does the position error do over the two-minute run?
- Grows without bound, like dead reckoning
- Rises for the first half minute, then stops growing, at a level that changes from run to run
- Shrinks to a few centimetres on every run, once the map is built
Answer: 1

## Try: EKF-SLAM, range 12 m
cfg: {"sim":true,"level":2,"set":{"loc":"slam","lmRange":12},"tab":"loc","plot":"pos"}
Setup: The same filter with beacons visible to 12 m.
See: The error rises to about 1 m by 40 s, then falls. It is 0.4 m at 60 s and 0.3 m at 90 s, under 10 cm from 100 s on, and 7 cm by 120 s. NEES stays between 1 and 3.6 throughout. Four of five goals are reached. One is skipped after the robot brushes a shelf at 55 s. Watch the ellipses on the beacons shrink together when the robot comes back towards beacons it mapped at the start.
Shows: With most of the floor sharing landmarks, loop closures happen all the time instead of once. Each re-observation of an early landmark corrects the pose and, through the correlations, every landmark placed since. So the error falls after rising, instead of levelling off. In the filter the longer range costs only larger matrices, and it gives a connected map. It cannot undo drift that happened before the first closure. On seeds 1 to 5 the 12 m run ends between 3 cm and 1.3 m, and on seed 2 both ranges end near 1.3 m. It never ends clearly worse than the 7 m run, and on most seeds it ends far better.
Predict: With beacons visible to 12 m instead of 7 m, where does the error end up compared with the 7 m run?
- Clearly higher: readings from farther away carry more noise
- Lower, or at worst about the same: more shared beacons mean more loop closures
- Near zero throughout: the error never rises in the first place
Answer: 1

## Try: EKF with the known map
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: The plain EKF of lesson 2 on the same level, with the beacon positions given.
See: The error is mostly between 1 and 8 cm (RMS 4 cm, peaks near 14 cm). The robot reaches five goals in about 90 s, with no collisions.
Shows: The gap between about 5 cm here and 1.4 m with SLAM is the difference between measuring the robot against the world and measuring it against things it placed itself. For this reason a map is usually built once, carefully, with loop closures forced. The vehicle then runs localization against that map.
Predict: The plain EKF on the same level with the beacon map given: what error should you expect?
- About half of SLAM's plateau, 0.5 m
- A few centimetres
- Like SLAM at 12 m: metre-sized at first, centimetres by the end
Answer: 1

## Code: slamAdd, a landmark enters the state
snippet: slam-add
focus: const Jx = [1, 0, -r * Math.sin(a), 0, 1, r * Math.cos(a)], … Jz = [Math.cos(a), -r * Math.sin(a), Math.sin(a), r * Math.cos(a)];
focus: // P_mx = Jx P_xx ; P_mm = Jx P_xx Jxᵀ + Jz R Jzᵀ ; P_m,others = Jx P_x,others … Pn[(n0 + i) * n + n0 + j] = s;
Note: The marked lines are the two Jacobians of the inverse observation and the four blocks of the grown covariance. A new landmark starts out correlated with the pose that saw it, and that is what makes loop closure work later. No slot runs SLAM, though the localizer slot could, with the landmarks kept in mem. The code calls the reading's noise R; it is the lesson's $Q$.

## Think about
Q: Why does SLAM's absolute error never reach zero even when every loop is closed?
A: No reading says where anything is in the world; only relative positions are observed. The initial pose fixes the frame, so the whole map carries the initial uncertainty plus whatever drift occurred before the first loop closed. This is called the gauge freedom of SLAM. Real systems that need world coordinates anchor the map with GPS or a surveyed landmark for this reason.
Q: The covariance $P$ becomes dense: every landmark correlated with every other. Is that waste?
A: No. The correlations carry the information that passes a correction on one landmark to the others. Dropping them (keeping only the diagonal) is known to make EKF-SLAM inconsistent and eventually wrong. The cost is $O(n^2)$ per update. Systems with thousands of features moved to sparse graph formulations for this reason; these keep the same information in a different form.
Q: What breaks if the beacons were unlabeled in SLAM?
A: Association breaks, because the map it matches readings against is itself uncertain. A reading from a new beacon can look like a reading from a mapped beacon that has drifted, and the other way round. The level's own Try list under the level bar has an "EKF-SLAM, unlabeled" button that shows the result. Wrong associations do more harm in SLAM than in localization. They corrupt the map, and the map then corrupts every later pose.

## Check yourself
Q: The robot is at (2, 3) with heading $\theta = 20°$ and sees a new beacon at range 4 m, bearing 40°. What y coordinate does the filter give the new landmark?
Answer: 6.464
Tolerance: 0.13
Unit: m
How: $m_y = y + r\sin(\theta + b) = 3 + 4 \times \sin 60° = 3 + 3.464 = 6.46$ m. The same reading gives $m_x = 2 + 4\cos 60° = 4$ m.
