group: loc
title: EKF-SLAM: the map is part of the state

<p><b>Why this matters.</b> Everything so far assumed the beacon positions were known. A robot in a new building has no map; a vehicle whose map is six months old has the wrong one. Simultaneous localization and mapping estimates the map and the pose together, and the mechanism that makes it work, the correlation between the robot's error and the errors of everything it has mapped, is also what makes it expensive and what makes loop closure feel like magic the first time you see a whole map shift at once.</p>
<p><b>The idea.</b> Append the beacon positions to the state. The first time a beacon is seen it is placed from the current pose and the reading, so its error is the pose error plus sensor noise, and it stays correlated with the pose. Every later reading of that beacon constrains the pose <i>relative to the landmark</i>, never absolutely: nothing in a range-and-bearing reading says where either of them is in the world. So the absolute error of the whole structure, robot and map together, drifts like dead reckoning between re-observations of old landmarks. When the robot sees again a beacon it mapped while it was still certain, the correction is applied through the correlations to the pose and to every landmark placed since: that is loop closure.</p>
$$x = [x,\ y,\ \theta,\ m_{1x},\ m_{1y},\ \dots] \qquad P \text{ is } (3 + 2n)^2$$
$$\text{new landmark:} \quad m = p + r\begin{bmatrix} \cos(\theta + b) \\ \sin(\theta + b) \end{bmatrix}, \qquad P_{mm} = J_x P_{xx} J_x^\top + J_z Q J_z^\top$$
$$J_x = \begin{bmatrix} 1 & 0 & -r\sin(\theta + b) \\ 0 & 1 & r\cos(\theta + b) \end{bmatrix} \qquad J_z = \begin{bmatrix} \cos(\theta + b) & -r\sin(\theta + b) \\ \sin(\theta + b) & r\cos(\theta + b) \end{bmatrix} \qquad Q = \begin{bmatrix} \sigma_r^2 & 0 \\ 0 & \sigma_b^2 \end{bmatrix}$$
<p><b>Where it comes from.</b> The landmark initialization is the same linearization argument as the motion model: the new landmark is a function of the pose and the reading, so its covariance is the pose covariance pushed through $J_x$ plus the sensor noise pushed through $J_z$, and its cross-covariance with the pose is $J_x P_{xx}$. The measurement Jacobian's landmark columns are the negatives of its pose columns, which is the algebraic form of "only relative positions are observed". <a class="chref" href="#notes=ch2/8-ekf-slam-the-map-joins-the-state">Derivation: chapter 2 §8</a></p>
<p>Prediction and update are the EKF's on the larger state. The pose moves by the arc model $g$ with the Jacobians $G$, $V$ of the dead-reckoning lesson and the landmarks stay put; a reading of landmark $j$ is predicted from the difference $m_j - p$, so its Jacobian $H_j$ is the beacon Jacobian of the Kalman lesson on the pose columns and the negative of its position part on that landmark's columns.</p>
$$\begin{aligned}
\text{predict:}\quad & (x, y, \theta) \leftarrow g(x, y, \theta, u), \qquad P_{xx} \leftarrow G P_{xx} G^\top + V M V^\top, \qquad P_{xm} \leftarrow G P_{xm}, \qquad P_{mm} \text{ unchanged} \\
\text{update:}\quad & \hat z_j = \begin{bmatrix} \sqrt{q} \\ \operatorname{atan2}(\Delta y, \Delta x) - \theta \end{bmatrix}, \qquad (\Delta x, \Delta y) = m_j - p, \qquad \frac{\partial h}{\partial m_j} = -\frac{\partial h}{\partial p} \\
& K = P H_j^\top S^{-1}, \qquad x \leftarrow x + K\nu, \qquad P \leftarrow P - K S K^\top \quad \text{(then symmetrized)}
\end{aligned}$$
<p><b>What the lab does.</b> Readings carry their beacon ID on this level, so association is free; a beacon seen for the first time is added to the state. Prediction updates only the pose block and its cross terms; updates use the full $(3 + 2n)^2$ covariance. The map ellipses drawn on the beacons are the landmarks' own covariances. The beacon range slider sets how far the robot sees: with 7 m few beacons are visible from any one place and the map is a chain of weakly connected pieces; with 12 m most of the floor shares landmarks and the map closes on itself continuously.</p>

## Try: EKF-SLAM, range 7 m
cfg: {"sim":true,"level":2,"set":{"loc":"slam"},"tab":"loc","plot":"pos"}
Setup: L3 with EKF-SLAM and the default 7 m beacon range; the filter starts with an empty map.
See: The error grows to about 0.5 m in the first 10 s and 1.4 m by 20 s, then plateaus between 1.0 and 1.5 m for the rest of the run instead of growing further. The filter's $\sigma$ settles near 0.55 m, so NEES sits around 8 and the status strip calls it overconfident. The mission suffers: one goal reached in 150 s, four skipped as "stuck", two collisions. The map ellipses on the beacons stay large.
Shows: The plateau is SLAM working and its limit at the same time. Re-observing the same few beacons keeps the pose bounded <i>relative to them</i>, but the map itself was laid down from an already-drifted pose and nothing ties it to the world, so the whole structure is offset by a metre and stays there. The overconfidence has the same cause as in lesson 2, the unmodeled odometry bias, now baked into the landmark positions as well. Where the plateau lies changes from run to run: on seeds 1 to 5 the error settles anywhere from 5 cm to 2.3 m (and the filter is overconfident on some seeds and not on others), depending on how far the pose drifted before the robot saw its first beacons again. What every seed shares is that the error stops growing.
Predict: EKF-SLAM from an empty map with the 7 m beacon range: what does the position error do over the two-minute run?
- Grows without bound, like dead reckoning
- Rises for the first half minute, then stops growing, at a level that changes from run to run
- Shrinks to a few centimetres on every run, once the map is built
Answer: 1

## Try: EKF-SLAM, range 12 m
cfg: {"sim":true,"level":2,"set":{"loc":"slam","lmRange":12},"tab":"loc","plot":"pos"}
Setup: The same filter with beacons visible to 12 m.
See: The error rises to about 1 m by 40 s, then falls: 0.4 m at 60 s, 0.3 m at 90 s, under 10 cm from 100 s on and 7 cm by 120 s, with NEES between 1 and 3.6 throughout. Four of five goals are reached; one is skipped after the robot brushes a shelf at 55 s. Watch the map ellipses shrink together when the robot returns toward beacons it mapped at the start.
Shows: With most of the floor sharing landmarks, loop closures happen all the time rather than once. Each re-observation of an early landmark corrects the pose and, through the correlations, every landmark placed since, which is why the error falls after rising rather than plateauing. The longer range costs nothing in the filter except larger matrices; what it buys is a connected map. It cannot undo drift that happened before the first closure: on seeds 1 to 5 the 12 m run ends between 3 cm and 1.3 m, and on seed 2 both ranges end near 1.3 m. It never ends clearly worse than the 7 m run, and on most seeds it ends far better.
Predict: With beacons visible to 12 m instead of 7 m, where does the error end up compared with the 7 m run?
- Clearly higher: readings from farther away carry more noise
- Lower, or at worst about the same: more shared beacons mean more loop closures
- Near zero throughout: the error never rises in the first place
Answer: 1

## Try: EKF with the known map
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: The plain EKF of lesson 2 on the same level, with the beacon positions given.
See: Error mostly between 1 and 8 cm (RMS 4 cm, peaks near 14 cm), five goals in about 90 s, no collisions.
Shows: This is the price of the map. Between 5 cm and 1.4 m lies the difference between measuring the robot against the world and measuring it against things it placed itself. It is also why mapping is usually done once, carefully, with loop closures forced, and localization against that map is what runs in the vehicle.
Predict: The plain EKF on the same level with the beacon map given: what error should you expect?
- About half of SLAM's plateau, 0.5 m
- A few centimetres
- Like SLAM at 12 m: metre-sized at first, centimetres by the end
Answer: 1

## Code: slamAdd, a landmark enters the state
snippet: slam-add
focus: const Jx = [1, 0, -r * Math.sin(a), 0, 1, r * Math.cos(a)], … Jz = [Math.cos(a), -r * Math.sin(a), Math.sin(a), r * Math.cos(a)];
focus: // P_mx = Jx P_xx ; P_mm = Jx P_xx Jxᵀ + Jz R Jzᵀ ; P_m,others = Jx P_x,others … Pn[(n0 + i) * n + n0 + j] = s;
Note: The two Jacobians of the inverse observation and the four blocks of the grown covariance: a new landmark is born correlated with the pose that saw it, which is what makes loop closure work later. No slot runs SLAM; the localizer slot could, with the landmarks kept in mem. The code calls the reading's noise R; it is the lesson's $Q$.

## Think about
Q: Why does SLAM's absolute error never reach zero even when every loop is closed?
A: Because no reading says where anything is in the world; only relative positions are observed. The frame is pinned by the initial pose, so the whole map carries the initial uncertainty plus whatever drift occurred before the first loop closed. That is the gauge freedom of SLAM, and it is why real systems anchor the map with GPS or a surveyed landmark when they need world coordinates.
Q: The covariance $P$ becomes dense: every landmark correlated with every other. Is that waste?
A: No, it is the information. The correlations are how a correction to one landmark propagates to the others, and dropping them (keeping only the diagonal) is known to make EKF-SLAM inconsistent and eventually wrong. The cost is $O(n^2)$ per update, which is why systems with thousands of features moved to sparse graph formulations that keep the same information in a different shape.
Q: What breaks if the beacons were unlabeled in SLAM?
A: Association against a map that is itself uncertain: a reading from a new beacon can look like a reading from a mapped one that has drifted, and vice versa. The level's own Try list under the level bar has an "EKF-SLAM, unlabeled" button that shows the result. Wrong associations in SLAM are worse than in localization because they corrupt the map, which then corrupts every later pose.

## Check yourself
Q: The robot is at (2, 3) with heading $\theta = 20°$ and sees a new beacon at range 4 m, bearing 40°. What y coordinate does the filter give the new landmark?
Answer: 6.464
Tolerance: 0.13
Unit: m
How: $m_y = y + r\sin(\theta + b) = 3 + 4 \times \sin 60° = 3 + 3.464 = 6.46$ m (and $m_x = 2 + 4\cos 60° = 4$ m)
