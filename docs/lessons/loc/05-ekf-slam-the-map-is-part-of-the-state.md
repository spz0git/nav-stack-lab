group: loc
title: EKF-SLAM: the map is part of the state

<p><b>Why this matters.</b> Everything so far assumed the beacon positions were known. A robot in a new building has no map; a vehicle whose map is six months old has the wrong one. Simultaneous localization and mapping estimates the map and the pose together, and the mechanism that makes it work, the correlation between the robot's error and the errors of everything it has mapped, is also what makes it expensive and what makes loop closure feel like magic the first time you see a whole map shift at once.</p>
<p><b>The idea.</b> Append the beacon positions to the state. The first time a beacon is seen it is placed from the current pose and the reading, so its error is the pose error plus sensor noise, and it stays correlated with the pose. Every later reading of that beacon constrains the pose <i>relative to the landmark</i>, never absolutely: nothing in a range-and-bearing reading says where either of them is in the world. So the absolute error of the whole structure, robot and map together, drifts like dead reckoning between re-observations of old landmarks. When the robot sees again a beacon it mapped while it was still certain, the correction is applied through the correlations to the pose and to every landmark placed since: that is loop closure.</p>
<div class="eq">x = [x, y, θ, m₁ₓ, m₁ᵧ, …],   P is (3 + 2n)²
new landmark:  m = p + r·[cos(θ+b), sin(θ+b)],   P_mm = J_x P_xx J_xᵀ + J_z Q J_zᵀ
J_x = [1  0  −r sin(θ+b);  0  1  r cos(θ+b)]     J_z = [cos(θ+b)  −r sin(θ+b);  sin(θ+b)  r cos(θ+b)]     Q = diag(σ_r², σ_b²)</div>
<p><b>Where it comes from.</b> The landmark initialization is the same linearization argument as the motion model: the new landmark is a function of the pose and the reading, so its covariance is the pose covariance pushed through <i>J</i><sub>x</sub> plus the sensor noise pushed through <i>J</i><sub>z</sub>, and its cross-covariance with the pose is <i>J</i><sub>x</sub><i>P</i><sub>xx</sub>. The measurement Jacobian's landmark columns are the negatives of its pose columns, which is the algebraic form of "only relative positions are observed". <a class="chref" href="#notes=ch2/8-ekf-slam-the-map-joins-the-state">Derivation: chapter 2 §8</a></p>
<p>Prediction and update are the EKF's on the larger state. The pose moves by the arc model <i>g</i> with the Jacobians <i>G</i>, <i>V</i> of the dead-reckoning lesson and the landmarks stay put; a reading of landmark <i>j</i> is predicted from the difference <i>m</i><sub>j</sub> − <i>p</i>, so its Jacobian <i>H</i><sub>j</sub> is the beacon Jacobian of the Kalman lesson on the pose columns and the negative of its position part on that landmark's columns.</p>
<div class="eq">predict:  (x, y, θ) ← g(x, y, θ, u),   P_xx ← G P_xx Gᵀ + V M Vᵀ,   P_xm ← G P_xm,   P_mm unchanged
update:   ẑ_j = [√q,  atan2(Δy, Δx) − θ],   (Δx, Δy) = m_j − p,   ∂h/∂m_j = −∂h/∂p
          K = P H_jᵀ S⁻¹,   x ← x + Kν,   P ← P − K S Kᵀ  (then symmetrized)</div>
<p><b>What the lab does.</b> Readings carry their beacon ID on this level, so association is free; a beacon seen for the first time is added to the state. Prediction updates only the pose block and its cross terms; updates use the full (3 + 2<i>n</i>)² covariance. The map ellipses drawn on the beacons are the landmarks' own covariances. The beacon range slider sets how far the robot sees: with 7 m few beacons are visible from any one place and the map is a chain of weakly connected pieces; with 12 m most of the floor shares landmarks and the map closes on itself continuously.</p>

## Try: EKF-SLAM, range 7 m
cfg: {"sim":true,"level":2,"set":{"loc":"slam"},"tab":"loc","plot":"pos"}
Setup: L3 with EKF-SLAM and the default 7 m beacon range; the filter starts with an empty map.
See: The error grows to about 0.5 m in the first 10 s and 1.4 m by 20 s, then plateaus between 1.1 and 1.4 m for the rest of the run instead of growing further. The filter's σ settles near 0.55 m, so NEES sits around 8 and the status strip calls it overconfident. The mission suffers: one goal reached in 150 s, four skipped as "stuck", two collisions. The map ellipses on the beacons stay large.
Shows: The plateau is SLAM working and its limit at the same time. Re-observing the same few beacons keeps the pose bounded <i>relative to them</i>, but the map itself was laid down from an already-drifted pose and nothing ties it to the world, so the whole structure is offset by a metre and stays there. The overconfidence has the same cause as in lesson 2, the unmodeled odometry bias, now baked into the landmark positions as well.
Predict: EKF-SLAM from an empty map with the 7 m beacon range: what does the position error do over the two-minute run?
- Grows without bound, like dead reckoning
- Rises to about a metre, then plateaus
- Shrinks to a few centimetres once the map is built
Answer: 1

## Try: EKF-SLAM, range 12 m
cfg: {"sim":true,"level":2,"set":{"loc":"slam","lmRange":12},"tab":"loc","plot":"pos"}
Setup: The same filter with beacons visible to 12 m.
See: The error rises to about 1 m by 40 s, then falls: 0.4 m at 60 s, 0.3 m at 90 s, 7 cm from 100 s on, with NEES between 1 and 3.6 throughout. Four of five goals are reached. Watch the map ellipses shrink together when the robot returns toward beacons it mapped at the start.
Shows: With most of the floor sharing landmarks, loop closures happen all the time rather than once. Each re-observation of an early landmark corrects the pose and, through the correlations, every landmark placed since, which is why the error falls after rising rather than plateauing. The longer range costs nothing in the filter except larger matrices; what it buys is a connected map.
Predict: With beacons visible to 12 m instead of 7 m, how does the error curve change?
- It plateaus at the same metre: range does not change the drift
- It never rises: the filter is accurate from the start
- It rises as before and then falls to centimetres
Answer: 2

## Try: EKF with the known map
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: The plain EKF of lesson 2 on the same level, with the beacon positions given.
See: Error between 1 and 5 cm for the whole run, five goals in about 90 s, no collisions.
Shows: This is the price of the map. Between 5 cm and 1.4 m lies the difference between measuring the robot against the world and measuring it against things it placed itself. It is also why mapping is usually done once, carefully, with loop closures forced, and localization against that map is what runs in the vehicle.
Predict: The plain EKF on the same level with the beacon map given: what error should you expect?
- About half of SLAM's plateau, 0.5 m
- A few centimetres
- The same as SLAM at 12 m once its map is complete
Answer: 1

## Code: slamAdd, a landmark enters the state
snippet: slam-add
focus: const Jx = [1, 0, -r * Math.sin(a), 0, 1, r * Math.cos(a)], … Jz = [Math.cos(a), -r * Math.sin(a), Math.sin(a), r * Math.cos(a)];
focus: // P_mx = Jx P_xx ; P_mm = Jx P_xx Jxᵀ + Jz R Jzᵀ ; P_m,others = Jx P_x,others … Pn[(n0 + i) * n + n0 + j] = s;
Note: The two Jacobians of the inverse observation and the four blocks of the grown covariance: a new landmark is born correlated with the pose that saw it, which is what makes loop closure work later. No slot runs SLAM; the localizer slot could, with the landmarks kept in mem.

## Think about
Q: Why does SLAM's absolute error never reach zero even when every loop is closed?
A: Because no reading says where anything is in the world; only relative positions are observed. The frame is pinned by the initial pose, so the whole map carries the initial uncertainty plus whatever drift occurred before the first loop closed. That is the gauge freedom of SLAM, and it is why real systems anchor the map with GPS or a surveyed landmark when they need world coordinates.
Q: The covariance <i>P</i> becomes dense: every landmark correlated with every other. Is that waste?
A: No, it is the information. The correlations are how a correction to one landmark propagates to the others, and dropping them (keeping only the diagonal) is known to make EKF-SLAM inconsistent and eventually wrong. The cost is <i>O</i>(<i>n</i>²) per update, which is why systems with thousands of features moved to sparse graph formulations that keep the same information in a different shape.
Q: What breaks if the beacons were unlabeled in SLAM?
A: Association against a map that is itself uncertain: a reading from a new beacon can look like a reading from a mapped one that has drifted, and vice versa. The level's own Try list under the level bar has an "EKF-SLAM, unlabeled" button that shows the result. Wrong associations in SLAM are worse than in localization because they corrupt the map, which then corrupts every later pose.

## Check yourself
Q: The robot is at (2, 3) with heading θ = 20° and sees a new beacon at range 4 m, bearing 40°. What y coordinate does the filter give the new landmark?
Answer: 6.464
Tolerance: 0.13
Unit: m
How: m_y = y + r sin(θ + b) = 3 + 4 × sin 60° = 3 + 3.464 = 6.46 m (and m_x = 2 + 4 cos 60° = 4 m)
