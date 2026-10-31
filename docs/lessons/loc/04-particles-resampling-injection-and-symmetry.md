group: loc
title: Particles: resampling, injection and symmetry

<p><b>Why this matters.</b> A Gaussian filter can hold only one hypothesis. A robot switched on in an unknown place, or recovering from being lost, needs to hold many and let the readings rule them out one by one. The particle filter is the standard way to do that. Of the estimators here, it also reports its own uncertainty most faithfully, so its output drives the lost guard on the busy floor. It fails in different ways from the EKF. It does not get stuck confidently wrong. It can collapse onto a lucky particle, run out of diversity, or settle on a pose that the readings cannot tell apart from the right one.</p>
<p><b>The idea.</b> The filter represents the belief by 400 sample poses, the particles, each with a weight. Prediction moves every particle through the motion model with its own random odometry noise, so the cloud spreads in the way $\Sigma$ would grow. Correction multiplies each weight by how likely the reading is from that particle's pose. Particles that explain the reading well gain weight, and the rest fade. Left alone, the weight would end up on one particle, so the filter resamples. It draws a new set of 400 from the old one in proportion to weight, copying the heavy particles and dropping the light ones. The estimate shown on the map is the weighted mean, and the reported $\Sigma$ is the weighted scatter. So when the cloud is spread over the floor, the reported uncertainty is enormous, as it should be.</p>
$$N_\text{eff} = \frac{1}{\sum_i w_i^2} \qquad \text{resample when } N_\text{eff} < N/2$$
$$\text{augmented MCL:} \quad w_\text{fast} \leftarrow w_\text{fast} + 0.1\,(w - w_\text{fast}), \qquad w_\text{slow} \leftarrow w_\text{slow} + 0.001\,(w - w_\text{slow})$$
<p>The filter injects up to 25 % new particles with probability $\max(0,\ 1 - w_\text{fast}/w_\text{slow})$.</p>
<p><b>Where it comes from.</b> Weighting by the likelihood is Bayes' rule applied one sample at a time. The weighted sum of any function of the particles approximates its expectation under the posterior. $N_\text{eff}$ is the number of equally weighted particles that would carry the same statistical information as the current unequal set. So the filter resamples when this number falls, instead of on a timer. Low-variance resampling walks through the cumulative weights with a single random offset. A particle of weight $w$ is then copied $\lfloor Nw \rfloor$ or $\lceil Nw \rceil$ times, never many more. <a class="chref" href="#notes=ch2/7-the-particle-filter">Derivation: chapter 2 §7</a></p>
<p><b>The models.</b> Each particle $i$ moves by the arc model $g$ of the dead-reckoning lesson, with its own draw of odometry noise ($\sigma_v$, $\sigma_\omega$ from the same noise formula, at least 0.02). A beacon reading $(r, b)$ is scored by a Gaussian on its range and bearing, against what that particle predicts, $(\hat r, \hat b)$. When the beacons are unlabeled, the score uses the best-fitting beacon $j$. A floor of $10^{-3}$ is added. The lidar adds a likelihood field. For each beam, $d$ is the distance from the beam's end point, placed from the particle, to the nearest wall of the map. An injected particle is placed by inverting one reading, with a random direction $\varphi$.</p>
$$\begin{aligned}
\text{predict:}\quad & x_i \leftarrow g\bigl(x_i,\ (v + \sigma_v\varepsilon_1,\ \omega + \sigma_\omega\varepsilon_2)\bigr), \qquad \varepsilon_1, \varepsilon_2 \sim \mathcal{N}(0, 1) \\
\text{beacons:}\quad & \log w_i \mathrel{+}= \sum_\text{readings} \log\Bigl(\max_j \exp\bigl(-\tfrac12\bigl[(r - \hat r_j)^2/\sigma_r^2 + (b - \hat b_j)^2/\sigma_b^2\bigr]\bigr) + 10^{-3}\Bigr) \\
\text{lidar:}\quad & \log w_i \mathrel{+}= 0.4 \sum_\text{24 beams} \log\bigl(0.9\,\exp\bigl(-d^2/(2 \cdot 0.2^2)\bigr) + 0.05\bigr) \\
\text{inject:}\quad & (x, y) = m_j - (r + \sigma_r\varepsilon)(\cos\varphi, \sin\varphi), \qquad \theta = \varphi - (b + \sigma_b\varepsilon), \qquad \varphi \text{ uniform}
\end{aligned}$$
<p><b>Injection.</b> The filter keeps a slow and a fast running average of how well the readings fit the particle set. When the fast one drops well below the slow one, the readings have stopped fitting. Either the robot was moved, or the cloud converged on the wrong place. The filter then replaces up to a quarter of the particles with new ones. Each new particle is placed where one current reading says the robot could be: at the measured range from a beacon, facing so that the bearing matches. Without injection, global localization (finding the pose with no estimate to start from) would not be possible at all. Scatter the particles over the whole floor and the filter still converges, because the readings keep proposing places and the next readings keep testing them.</p>
<p><b>Symmetry.</b> The warehouse looks nearly the same after a 180° turn about its centre. With unlabeled beacons the readings cannot tell the true pose from the mirror pose, the pose turned half a turn about the centre. So the cloud may converge on either. A labeled beacon breaks the tie at once. The lidar compared against the map breaks it too, but slowly. The map's asymmetries are small and can be seen only from some places. The lidar likelihood is also tempered on purpose (scaled down), so that 24 beams cannot collapse the set on their own.</p>
<p><b>What the lab does.</b> L5 is the busy floor, with unlabeled beacons, clutter (readings that come from things other than beacons) and the lidar on. The lost guard is on too. When $\sigma$ exceeds 1 m it stops the mission, and the robot turns in place until $\sigma$ is back under 0.4 m. Each button restarts the level and drives for 8 s. It then scatters all 400 particles uniformly over free space, so the filter has to localize from nothing. The map shows the particle cloud, the mean estimate and its ellipse. The status strip shows $N_\text{eff}$ and the injection fraction live (the fast and slow averages are internal).</p>

## Try: Scatter the particles (unlabeled)
cfg: {"sim":true,"level":4,"set":{"loc":"pf"},"tab":"loc","act":"scatter"}
Setup: L5 with its defaults: unlabeled beacons, lidar on, injection on. The particles are scattered at 8 s.
See: The cloud covers the floor ($\sigma$ about 8.5 m) for one update. Within a second it collapses onto a tight cluster, confident to 2 cm, 14 m from the truth with the heading only a few degrees off. This is another place that the unlabeled readings fit. The lost guard releases the mission, and the robot drives on the wrong belief. At 12 s the guard trips: $\sigma$ leaps, up to 25 % of the particles are injected, and the robot turns in place. The set then settles on the mirror pose, 7 to 16 m from the truth with the heading 180° off. The robot drives on that and makes contact with an obstacle at 39 s. From 40 s the fast average sags and the guard trips again and again, and each time the set returns to the mirror pose. Near 79 s the readings finally favour the true pose, and the cloud jumps across the floor. From 80 s the error is centimetres, apart from three guard trips of a tenth of a second each between 168 and 170 s. The first goal is reached at about 106 s.
Shows: A filter that has converged can still be wrong. This one did what the readings justified. With unlabeled beacons several poses fit them, the mirror pose as well as the true one, and the filter picked one. The tie was finally broken when the lidar saw an asymmetry of the map from the right place. In a symmetric environment with an unlabeled sensor, a long wait like this is to be expected. A real stack would add a second cue instead of waiting, such as a labeled landmark, a magnetometer or a WiFi fingerprint. The details change from run to run. On seeds 1 to 5 the cloud takes one to three seconds to collapse, and lands on the mirror pose, on another wrong place, or now and then on the truth. Reaching the truth takes from a few seconds to a minute and a half.
Predict: After the 400 particles are scattered over the floor with unlabeled beacons, what does the cloud do in the next few seconds?
- Stays spread over the floor for tens of seconds
- Collapses onto the true pose and stays there
- Collapses onto a tight cluster, which may be the wrong one
Answer: 2

## Try: Scatter with known IDs
cfg: {"sim":true,"level":4,"set":{"loc":"pf","assoc":"known"},"tab":"loc","act":"scatter"}
Setup: The same scatter with readings that name their beacon.
See: The lost guard holds the robot for three seconds while the cloud sorts itself out. The error is 7.7 m after one update and still 6.5 m two seconds later, then 0.7 m after three seconds and 16 cm after four. The mission resumes at about 11 s, and the first goal is reached around 30 s. The error stays under 18 cm from 11.5 s, and is a few centimetres from 20 s on.
Shows: With the symmetry removed, three or four seconds of readings (some fifteen beacon scans) are enough to pick out the true pose from 400 scattered guesses. Each reading now rules out every particle that is at the wrong range or bearing from one named beacon. Set against the first experiment, knowing which beacon a reading came from helps far more than extra particles would, and it is the cheapest way to tell the candidate poses apart.
Predict: Same scatter, but the readings name their beacon. How long until the error is under 20 cm?
- A few seconds, a handful of beacon scans
- About half a minute
- A minute or more: it still needs the lidar to break the symmetry
Answer: 0

## Try: Scatter, lidar off
cfg: {"sim":true,"level":4,"set":{"loc":"pf","pfLidar":false},"tab":"loc","act":"scatter"}
Setup: Unlabeled beacons and no lidar term in the weights, so only the beacon likelihood is left.
See: The cloud collapses onto a wrong cluster at once. (Near the centre of the floor the mirror pose is close in position but 165° off in heading.) It then loses that cluster and spends the next eighty seconds in the LOST state, with $\sigma$ around 7 m. The robot turns in place, and the fast average never settles. Near 105 s the cloud converges on the truth, and the robot reaches a goal at about 134 s. At 149 s the set comes apart again ($N_\text{eff}$ in single digits between resamples from 156 s), and the robot is lost once more.
Shows: Without a second sensor, the beacon readings alone barely separate the poses that fit them. Without the lidar's steady evidence, clutter and injection also keep pulling the set apart. The filter is right to be unsure. How that uncertainty shows depends on the run. On seeds 2 to 5 the cloud instead sits confidently on a wrong pose for 30 s to two minutes before it finds the truth. On seed 1 it does not find the truth in three minutes. On every seed it takes longer than with the lidar, except on seed 2, where it takes about as long. While the belief is like this the planner does nothing, because the lost guard holds the mission, as intended.
Predict: Scatter with unlabeled beacons and the lidar term removed from the weights. Do the beacon readings alone settle where the robot is?
- Yes, within a few seconds: fewer terms, less noise in the weights
- Not reliably: the cloud spends tens of seconds lost or on a wrong pose, and when it finds the truth varies
- Never: without the lidar it stays lost for the whole run
Answer: 1

## Code: pfResample
snippet: pf-resample
focus: f.neff = 1 / s2; … if (pinj > 0 && g.u() < pinj) {
example: loc/pf
Note: $N_\text{eff}$ decides whether to resample at all. The loop after it is low-variance resampling: one random offset, then $N$ even steps through the cumulative weights. The branch inside the loop draws an injected sample instead of copying a particle. Edit and run loads the particle-filter example, which resamples the same way but never injects. Change $N$ or the $N/2$ threshold and watch $N_\text{eff}$ in Signals.

## Think about
Q: Why 400 particles, and not 40 or 40 000?
A: Global localization has to cover a three-dimensional pose space finely enough that some particle lands near the truth. Injection proposes poses from the readings, so 400 is plenty here. Tracking with a converged filter would need far fewer. The cost per update is linear in $N$, and 40 000 particles would spend their time resampling copies of the same few poses.
Q: Why is the lidar likelihood multiplied by 0.4 before it enters the weights?
A: Twenty-four beams treated as independent evidence give a likelihood so sharply peaked that one particle wins every update, and the set collapses onto its sampling noise. The beams are not independent, because neighbouring beams hit the same wall. Tempering is a crude correction for counting the same evidence more than once. In the particle filter it plays the part that keeping $\Sigma$ consistent plays in the EKF.
Q: When the set holds two clusters, the mean lies between them. What should the planner do with that?
A: Nothing, because the mean is in a place where the robot certainly is not. The reported $\Sigma$ is enormous in that case, which is the right signal. The lost guard reads it, stops the mission and turns the robot in place until one cluster wins. An estimator that reported the biggest cluster instead would give the planner a pose to use, but it would hide that the robot may be in the other cluster.

## Check yourself
Q: In a set of 400 particles, 10 particles each hold weight 0.05 and the other 390 share the remaining 0.5 equally. What is $N_\text{eff}$?
Answer: 39
Tolerance: 0.8
Unit: 
How: $\sum w^2 = 10 \times 0.05^2 + 390 \times (0.5/390)^2 = 0.025 + 0.00064 = 0.02564$. Then $N_\text{eff} = 1/0.02564 = 39$. That is below $N/2 = 200$, so the filter resamples.
