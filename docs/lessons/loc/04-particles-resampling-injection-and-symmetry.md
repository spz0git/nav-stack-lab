group: loc
title: Particles: resampling, injection and symmetry

<p><b>Why this matters.</b> A Gaussian filter can hold one hypothesis. A robot switched on in an unknown place, or recovering from being lost, needs to hold many, and to let the readings kill them off one by one. The particle filter is the standard way to do that, and it is also the most honest estimator here about what it does not know, which is why its output drives the lost guard on the busy floor. Its failure modes are different from the EKF's: it does not get stuck confidently wrong, but it can collapse onto a lucky particle, run out of diversity, or settle on a pose that is indistinguishable from the right one.</p>
<p><b>The idea.</b> Represent the belief by 400 sample poses, the particles, each with a weight. Prediction moves every particle through the motion model with its own random odometry noise, so the cloud spreads the way Σ would grow. Correction multiplies each weight by how likely the reading is from that particle's pose, so particles that explain the reading well gain weight and the rest fade. Left alone the weights collapse onto one particle, so the filter resamples: it draws a new set of 400 from the old one in proportion to weight, copying the heavy ones and dropping the light ones. The estimate shown on the map is the weighted mean, and the reported Σ is the weighted scatter, which is why it is honestly enormous when the cloud is spread over the floor.</p>
<div class="eq">N_eff = 1 / Σ w_i²        resample when N_eff < N/2
augmented MCL: w_fast ← w_fast + 0.1 (w − w_fast),  w_slow ← w_slow + 0.001 (w − w_slow)
inject up to 25 % new particles with probability max(0, 1 − w_fast / w_slow)</div>
<p><b>Where it comes from.</b> Weighting by the likelihood is Bayes' rule applied one sample at a time; the weighted sum of any function of the particles approximates its expectation under the posterior. <i>N</i><sub>eff</sub> is the number of equally weighted particles that would carry the same statistical information as the current unequal set, which is why resampling is triggered on it and not on a timer. Low-variance resampling walks the cumulative weights with one random offset, so a particle of weight <i>w</i> is copied ⌊<i>Nw</i>⌋ or ⌈<i>Nw</i>⌉ times, never wildly more. <a class="chref" href="#notes=ch2/7-the-particle-filter">Derivation: chapter 2 §7</a></p>
<p><b>The models.</b> Each particle <i>i</i> moves by the arc model <i>g</i> of the dead-reckoning lesson with its own draw of odometry noise (σ<sub>v</sub>, σ<sub>ω</sub> from the same noise formula, at least 0.02). A beacon reading (<i>r</i>, <i>b</i>) is scored by a Gaussian on its range and bearing as predicted from that particle (<i>r̂</i>, <i>b̂</i>), taking the best-fitting beacon <i>j</i> when they are unlabeled, plus a floor of 10⁻³. The lidar adds a likelihood field: <i>d</i> is the distance from a beam's end point, placed from the particle, to the nearest wall of the map. An injected particle is placed by inverting one reading with a random direction φ.</p>
<div class="eq">predict:  x_i ← g(x_i, (v + σ_v ε₁, ω + σ_ω ε₂)),   ε₁, ε₂ ~ N(0, 1)
beacons:  log w_i += Σ_readings log( max_j exp(−½[(r − r̂_j)²/σ_r² + (b − b̂_j)²/σ_b²]) + 10⁻³ )
lidar:    log w_i += 0.4 · Σ_24 beams log( 0.9 exp(−d²/(2·0.2²)) + 0.05 )
inject:   (x, y) = m_j − (r + σ_r ε)·(cos φ, sin φ),   θ = φ − (b + σ_b ε),   φ uniform</div>
<p><b>Injection.</b> The filter keeps a slow and a fast running average of how well the readings fit the particle set. When the fast one drops well below the slow one, the readings have stopped fitting: the robot was moved, or the cloud converged on the wrong place. The filter then replaces up to a quarter of the particles with new ones, each placed where one current reading says the robot could be: at the measured range from a beacon, facing so that the bearing matches. That is what makes global localization possible at all. Scatter the particles over the whole floor and the filter still converges, because the readings keep proposing places and the next readings keep testing them.</p>
<p><b>Symmetry.</b> The warehouse is nearly the same after a 180° turn about its centre. With unlabeled beacons the readings cannot tell the true pose from the mirror pose, so the cloud may converge on either. A labeled beacon breaks the tie at once. The lidar against the map breaks it too, but slowly: the map's asymmetries are small and visible only from some places, and the lidar likelihood is deliberately tempered so that 24 beams cannot collapse the set on their own.</p>
<p><b>What the lab does.</b> L5 is the busy floor: unlabeled beacons, clutter, the lidar on, and the lost guard on, so when σ exceeds 1 m the mission stops and the robot turns in place until σ is back under 0.4 m. Each button restarts the level, drives 8 s, then scatters all 400 particles uniformly over free space, which is global localization from nothing. The particle cloud, the mean estimate and its ellipse are drawn on the map; the status strip shows <i>N</i><sub>eff</sub> and the injection fraction live (the fast and slow averages are internal).</p>

## Try: Scatter the particles (unlabeled)
cfg: {"sim":true,"level":4,"set":{"loc":"pf"},"tab":"loc","act":"scatter"}
Setup: L5 defaults: unlabeled beacons, lidar on, injection on. Scattered at 8 s.
See: The cloud covers the floor (σ about 8.5 m) for one update, then collapses within a second onto a tight cluster, confident to 2 cm, on the mirror pose: 14 m from the truth with the heading 180° off. The lost guard releases the mission and the robot drives on the wrong belief. Over the next minute the fast average sags, the guard trips a few times (σ leaps, up to 25 % of the particles are injected, the robot turns in place) and the set returns to the mirror each time. Around 85 s the readings finally favour the true pose, the cloud jumps across the floor, and from then on the error is centimetres; the first goal falls at about 110 s.
Shows: Convergence is not correctness. The filter did exactly what the readings justified: with unlabeled beacons the two poses are equally likely, and it picked one. What eventually broke the tie was the lidar seeing an asymmetry of the map from the right place. The long wait is the honest cost of a symmetric environment and an unlabeled sensor; a real stack would add a second cue (a labeled landmark, a magnetometer, a WiFi fingerprint) rather than wait.
Predict: After the 400 particles are scattered over the floor with unlabeled beacons, what does the cloud do in the next second?
- Stays spread over the floor for tens of seconds
- Collapses onto the true pose and stays there
- Collapses onto a tight cluster, which may be the wrong one
Answer: 2

## Try: Scatter with known IDs
cfg: {"sim":true,"level":4,"set":{"loc":"pf","assoc":"known"},"tab":"loc","act":"scatter"}
Setup: The same scatter with readings that name their beacon.
See: The lost guard holds the robot for three seconds while the cloud sorts itself out: 7 m error after one update, 0.7 m after three, 16 cm after four. The mission resumes at about 12 s and the first goal is reached around 38 s, with the error at a few centimetres throughout.
Shows: With the symmetry removed, three or four readings are enough to pick out the true pose from 400 scattered guesses, because each reading now rules out every particle that is at the wrong range or bearing from a specific beacon. The lesson of the pair is that labels are worth more than particles: identity is the cheapest disambiguation there is.
Predict: Same scatter, but the readings name their beacon. How long until the error is under 20 cm?
- About a second, a handful of readings
- About half a minute
- A minute or more: it still needs the lidar to break the symmetry
Answer: 0

## Try: Scatter, lidar off
cfg: {"sim":true,"level":4,"set":{"loc":"pf","pfLidar":false},"tab":"loc","act":"scatter"}
Setup: Unlabeled beacons and no lidar term in the weights; only the beacon likelihood is left.
See: The cloud collapses onto a wrong cluster at once (near the centre of the floor the mirror pose is close in position but 165° off in heading), loses it, and spends the next hundred seconds in the LOST state with σ around 7 m, the robot turning in place and the fast average never settling. Near 118 s it converges on the truth and reaches a goal at about 150 s; then at 160 s the set collapses again (<i>N</i><sub>eff</sub> down to 3–9) and the robot is lost once more.
Shows: Without a second sensor the beacon readings alone cannot separate the two poses, and without the lidar's steady evidence the set keeps being pulled apart by clutter and injection. The filter is right to be unsure. Watch what the planner does with a belief like that: nothing, which is the lost guard working as intended.
Predict: Scatter with unlabeled beacons and the lidar term removed from the weights. What happens?
- It converges faster: fewer terms, less noise in the weights
- It spends most of the run lost, with σ of several metres
- Same as with lidar: mirror pose, then the truth after a minute
Answer: 1

## Think about
Q: Why 400 particles, and not 40 or 40 000?
A: Global localization has to cover a three-dimensional pose space finely enough that some particle lands near the truth; with injection proposing poses from the readings, 400 is plenty here. Tracking a converged filter would need far fewer. The cost is linear in <i>N</i> per update, and 40 000 particles would spend their time resampling copies of the same few poses.
Q: Why is the lidar likelihood multiplied by 0.4 before it enters the weights?
A: Twenty-four beams treated as independent evidence give a likelihood so sharply peaked that one particle wins every update and the set collapses onto its sampling noise. The beams are not independent (neighbouring beams hit the same wall), so tempering is a crude correction for over-counting. It is the particle filter's version of keeping Σ honest.
Q: When the set holds two clusters, the mean lies between them. What should the planner do with that?
A: Nothing; the mean is in a place the robot is certainly not. The reported Σ is enormous in that case, which is the right signal, and the lost guard reads it to stop the mission and turn in place until one cluster wins. An estimator that reported the biggest cluster instead would be more useful and less honest.

## Check yourself
Q: In a set of 400 particles, 10 particles each hold weight 0.05 and the other 390 share the remaining 0.5 equally. What is N_eff?
Answer: 39
Tolerance: 0.8
Unit: 
How: Σw² = 10 × 0.05² + 390 × (0.5/390)² = 0.025 + 0.00064 = 0.02564; N_eff = 1/0.02564 = 39, below N/2 = 200, so the filter resamples
