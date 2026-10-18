group: loc
title: Particles: resampling, injection and symmetry

<p><b>Why this matters.</b> A Gaussian filter can hold one hypothesis. A robot switched on in an unknown place, or recovering from being lost, needs to hold many, and to let the readings kill them off one by one. The particle filter is the standard way to do that, and it is also the most honest estimator here about what it does not know, which is why its output drives the lost guard on the busy floor. Its failure modes are different from the EKF's: it does not get stuck confidently wrong, but it can collapse onto a lucky particle, run out of diversity, or settle on a pose that is indistinguishable from the right one.</p>
<p><b>The idea.</b> Represent the belief by 400 sample poses, the particles, each with a weight. Prediction moves every particle through the motion model with its own random odometry noise, so the cloud spreads the way $\Sigma$ would grow. Correction multiplies each weight by how likely the reading is from that particle's pose, so particles that explain the reading well gain weight and the rest fade. Left alone the weights collapse onto one particle, so the filter resamples: it draws a new set of 400 from the old one in proportion to weight, copying the heavy ones and dropping the light ones. The estimate shown on the map is the weighted mean, and the reported $\Sigma$ is the weighted scatter, which is why it is honestly enormous when the cloud is spread over the floor.</p>
$$N_\text{eff} = \frac{1}{\sum_i w_i^2} \qquad \text{resample when } N_\text{eff} < N/2$$
$$\text{augmented MCL:} \quad w_\text{fast} \leftarrow w_\text{fast} + 0.1\,(w - w_\text{fast}), \qquad w_\text{slow} \leftarrow w_\text{slow} + 0.001\,(w - w_\text{slow})$$
<p>The filter injects up to 25 % new particles with probability $\max(0,\ 1 - w_\text{fast}/w_\text{slow})$.</p>
<p><b>Where it comes from.</b> Weighting by the likelihood is Bayes' rule applied one sample at a time; the weighted sum of any function of the particles approximates its expectation under the posterior. $N_\text{eff}$ is the number of equally weighted particles that would carry the same statistical information as the current unequal set, which is why resampling is triggered on it and not on a timer. Low-variance resampling walks the cumulative weights with one random offset, so a particle of weight $w$ is copied $\lfloor Nw \rfloor$ or $\lceil Nw \rceil$ times, never wildly more. <a class="chref" href="#notes=ch2/7-the-particle-filter">Derivation: chapter 2 §7</a></p>
<p><b>The models.</b> Each particle $i$ moves by the arc model $g$ of the dead-reckoning lesson with its own draw of odometry noise ($\sigma_v$, $\sigma_\omega$ from the same noise formula, at least 0.02). A beacon reading $(r, b)$ is scored by a Gaussian on its range and bearing as predicted from that particle $(\hat r, \hat b)$, taking the best-fitting beacon $j$ when they are unlabeled, plus a floor of $10^{-3}$. The lidar adds a likelihood field: $d$ is the distance from a beam's end point, placed from the particle, to the nearest wall of the map. An injected particle is placed by inverting one reading with a random direction $\varphi$.</p>
$$\begin{aligned}
\text{predict:}\quad & x_i \leftarrow g\bigl(x_i,\ (v + \sigma_v\varepsilon_1,\ \omega + \sigma_\omega\varepsilon_2)\bigr), \qquad \varepsilon_1, \varepsilon_2 \sim \mathcal{N}(0, 1) \\
\text{beacons:}\quad & \log w_i \mathrel{+}= \sum_\text{readings} \log\Bigl(\max_j \exp\bigl(-\tfrac12\bigl[(r - \hat r_j)^2/\sigma_r^2 + (b - \hat b_j)^2/\sigma_b^2\bigr]\bigr) + 10^{-3}\Bigr) \\
\text{lidar:}\quad & \log w_i \mathrel{+}= 0.4 \sum_\text{24 beams} \log\bigl(0.9\,\exp\bigl(-d^2/(2 \cdot 0.2^2)\bigr) + 0.05\bigr) \\
\text{inject:}\quad & (x, y) = m_j - (r + \sigma_r\varepsilon)(\cos\varphi, \sin\varphi), \qquad \theta = \varphi - (b + \sigma_b\varepsilon), \qquad \varphi \text{ uniform}
\end{aligned}$$
<p><b>Injection.</b> The filter keeps a slow and a fast running average of how well the readings fit the particle set. When the fast one drops well below the slow one, the readings have stopped fitting: the robot was moved, or the cloud converged on the wrong place. The filter then replaces up to a quarter of the particles with new ones, each placed where one current reading says the robot could be: at the measured range from a beacon, facing so that the bearing matches. That is what makes global localization possible at all. Scatter the particles over the whole floor and the filter still converges, because the readings keep proposing places and the next readings keep testing them.</p>
<p><b>Symmetry.</b> The warehouse is nearly the same after a 180° turn about its centre. With unlabeled beacons the readings cannot tell the true pose from the mirror pose, so the cloud may converge on either. A labeled beacon breaks the tie at once. The lidar against the map breaks it too, but slowly: the map's asymmetries are small and visible only from some places, and the lidar likelihood is deliberately tempered so that 24 beams cannot collapse the set on their own.</p>
<p><b>What the lab does.</b> L5 is the busy floor: unlabeled beacons, clutter, the lidar on, and the lost guard on, so when $\sigma$ exceeds 1 m the mission stops and the robot turns in place until $\sigma$ is back under 0.4 m. Each button restarts the level, drives 8 s, then scatters all 400 particles uniformly over free space, which is global localization from nothing. The particle cloud, the mean estimate and its ellipse are drawn on the map; the status strip shows $N_\text{eff}$ and the injection fraction live (the fast and slow averages are internal).</p>

## Try: Scatter the particles (unlabeled)
cfg: {"sim":true,"level":4,"set":{"loc":"pf"},"tab":"loc","act":"scatter"}
Setup: L5 defaults: unlabeled beacons, lidar on, injection on. Scattered at 8 s.
See: The cloud covers the floor ($\sigma$ about 8.5 m) for one update, then collapses within a second onto a tight cluster, confident to 2 cm, 14 m from the truth with the heading only a few degrees off: another place the unlabeled readings fit. The lost guard releases the mission and the robot drives on the wrong belief. At 12 s the guard trips ($\sigma$ leaps, up to 25 % of the particles are injected, the robot turns in place) and the set settles on the mirror pose, 7 to 16 m from the truth with the heading 180° off; the robot drives on that and makes contact with an obstacle at 39 s. From 40 s the fast average sags and the guard trips again and again, the set returning to the mirror each time. Near 79 s the readings finally favour the true pose, the cloud jumps across the floor, and from 80 s the error is centimetres (apart from three guard trips of a tenth of a second each between 168 and 170 s); the first goal falls at about 106 s.
Shows: Convergence is not correctness. The filter did exactly what the readings justified: with unlabeled beacons several poses fit them, the mirror pose as well as the true one, and it picked one. What eventually broke the tie was the lidar seeing an asymmetry of the map from the right place. The long wait is the honest cost of a symmetric environment and an unlabeled sensor; a real stack would add a second cue (a labeled landmark, a magnetometer, a WiFi fingerprint) rather than wait. The details change from run to run: on seeds 1 to 5 the cloud takes one to three seconds to collapse and lands on the mirror pose, on another wrong place, or now and then on the truth, and reaching the truth takes from a few seconds to a minute and a half.
Predict: After the 400 particles are scattered over the floor with unlabeled beacons, what does the cloud do in the next few seconds?
- Stays spread over the floor for tens of seconds
- Collapses onto the true pose and stays there
- Collapses onto a tight cluster, which may be the wrong one
Answer: 2

## Try: Scatter with known IDs
cfg: {"sim":true,"level":4,"set":{"loc":"pf","assoc":"known"},"tab":"loc","act":"scatter"}
Setup: The same scatter with readings that name their beacon.
See: The lost guard holds the robot for three seconds while the cloud sorts itself out: 7.7 m error after one update, still 6.5 m two seconds later, 0.7 m after three seconds, 16 cm after four. The mission resumes at about 11 s and the first goal is reached around 30 s; the error stays under 18 cm from 11.5 s and is a few centimetres from 20 s on.
Shows: With the symmetry removed, three or four seconds of readings, some fifteen beacon scans, are enough to pick out the true pose from 400 scattered guesses, because each reading now rules out every particle that is at the wrong range or bearing from a specific beacon. The lesson of the pair is that labels are worth more than particles: identity is the cheapest disambiguation there is.
Predict: Same scatter, but the readings name their beacon. How long until the error is under 20 cm?
- A few seconds, a handful of beacon scans
- About half a minute
- A minute or more: it still needs the lidar to break the symmetry
Answer: 0

## Try: Scatter, lidar off
cfg: {"sim":true,"level":4,"set":{"loc":"pf","pfLidar":false},"tab":"loc","act":"scatter"}
Setup: Unlabeled beacons and no lidar term in the weights; only the beacon likelihood is left.
See: The cloud collapses onto a wrong cluster at once (near the centre of the floor the mirror pose is close in position but 165° off in heading), loses it, and spends the next eighty seconds in the LOST state with $\sigma$ around 7 m, the robot turning in place and the fast average never settling. Near 105 s it converges on the truth and reaches a goal at about 134 s; then at 149 s the set comes apart again ($N_\text{eff}$ in single digits between resamples from 156 s) and the robot is lost once more.
Shows: Without a second sensor the beacon readings alone barely separate the poses that fit them, and without the lidar's steady evidence the set keeps being pulled apart by clutter and injection. The filter is right to be unsure. How that uncertainty shows depends on the run: on seeds 2 to 5 the cloud instead sits confidently on a wrong pose for 30 s to two minutes before it finds the truth, on seed 1 it never finds it in three minutes, and on every seed it takes longer than with the lidar or, on seed 2, about as long. Watch what the planner does with a belief like that: nothing, which is the lost guard working as intended.
Predict: Scatter with unlabeled beacons and the lidar term removed from the weights. Do the beacon readings alone settle where the robot is?
- Yes, within a few seconds: fewer terms, less noise in the weights
- Not reliably: the cloud spends tens of seconds lost or on a wrong pose, and when it finds the truth varies
- Never: without the lidar it stays lost for the whole run
Answer: 1

## Code: pfResample
snippet: pf-resample
focus: f.neff = 1 / s2; … if (pinj > 0 && g.u() < pinj) {
example: loc/pf
Note: $N_\text{eff}$ decides whether to resample at all; the loop after it is low-variance resampling, one random offset and $N$ even steps through the cumulative weights; the branch inside it draws an injected sample instead of copying a particle. Edit and run: the particle-filter example resamples the same way but never injects; change $N$ or the $N/2$ threshold and watch $N_\text{eff}$ in Signals.

## Think about
Q: Why 400 particles, and not 40 or 40 000?
A: Global localization has to cover a three-dimensional pose space finely enough that some particle lands near the truth; with injection proposing poses from the readings, 400 is plenty here. Tracking a converged filter would need far fewer. The cost is linear in $N$ per update, and 40 000 particles would spend their time resampling copies of the same few poses.
Q: Why is the lidar likelihood multiplied by 0.4 before it enters the weights?
A: Twenty-four beams treated as independent evidence give a likelihood so sharply peaked that one particle wins every update and the set collapses onto its sampling noise. The beams are not independent (neighbouring beams hit the same wall), so tempering is a crude correction for over-counting. It is the particle filter's version of keeping $\Sigma$ honest.
Q: When the set holds two clusters, the mean lies between them. What should the planner do with that?
A: Nothing; the mean is in a place the robot is certainly not. The reported $\Sigma$ is enormous in that case, which is the right signal, and the lost guard reads it to stop the mission and turn in place until one cluster wins. An estimator that reported the biggest cluster instead would be more useful and less honest.

## Check yourself
Q: In a set of 400 particles, 10 particles each hold weight 0.05 and the other 390 share the remaining 0.5 equally. What is $N_\text{eff}$?
Answer: 39
Tolerance: 0.8
Unit: 
How: $\sum w^2 = 10 \times 0.05^2 + 390 \times (0.5/390)^2 = 0.025 + 0.00064 = 0.02564$; $N_\text{eff} = 1/0.02564 = 39$, below $N/2 = 200$, so the filter resamples
