id: ch2
num: 2
sys: loc
summary: The derivations behind the Localization lessons: the motion and measurement models and their Jacobians, the Kalman update from first principles, NEES and the gate, the particle filter and EKF-SLAM, with the lab's own noise numbers.

# Localization: the estimators derived

The Localization lessons give the formulas and show what they do. This chapter shows where they come from. It follows the lessons in order: the motion model and how uncertainty moves through it (lesson 1), the Kalman update and the consistency test (lesson 2), the gate (lesson 3), the particle filter (lesson 4) and EKF-SLAM (lesson 5). The numbers are those of the lab, and the ones in blue follow your current settings: the robot is on **{{live:loc}}** with odometry noise ×{{live:odoK}} and calibration bias ×{{live:odoB}}, and at the cruise speed $v_0$ = {{live:v0}} m/s one tick of odometry carries $\sigma_v$ = {{live:sigv}} m/s and $\sigma_\omega$ = {{live:sigw}} rad/s.

## 1. One problem, three estimators

Every estimator in the Localize tab answers the same question: given everything the robot has measured so far, where is it? The answer is never a point; it is a probability distribution over the pose $x = [x, y, \theta]$, called the belief. Two kinds of information arrive at every tick. The odometry $u = (v, \omega)$ says how the robot moved, through a motion model with noise; a sensor reading $z$ says something about where it is, through a measurement model with noise. The recursion that combines them is the Bayes filter:

$$
\overline{bel}(x_t) = \int p(x_t \mid x_{t-1}, u_t)\, bel(x_{t-1})\, dx_{t-1}
\qquad
bel(x_t) = \eta\, p(z_t \mid x_t)\, \overline{bel}(x_t)
$$

The first line is prediction: push the old belief through the motion model. The second is correction: multiply by the likelihood of the reading and renormalize ($\eta$ is the normalizer). Nothing in this lab does anything else. The three estimators differ only in how they represent $bel$:

| Estimator | Belief represented as | Prediction | Correction |
| --- | --- | --- | --- |
| Dead reckoning | one Gaussian $(\mu, \Sigma)$ | linearized motion model | none |
| EKF, EKF-SLAM | one Gaussian $(\mu, \Sigma)$, SLAM adds the map to $x$ | linearized motion model | linearized measurement model |
| Particle filter | $N$ samples with weights | each sample moved with its own noise | weights × likelihood, then resampling |

A Gaussian is two numbers per state plus their correlations, cheap and exact only when the models are linear and the belief is one bump. Particles cost $N$ times more and can hold several bumps at once, which is what the kidnapping and global-localization lessons are about.

## 2. The motion model and its Jacobians

**The arc model.** Over one tick $\Delta t$ = 0.05 s the odometry reports $v$ and $\omega$ and the model holds both constant, so the robot moves along a circular arc of radius $v/\omega$:

$$
g(\mu, u) = \begin{bmatrix} x + \dfrac{v}{\omega}\left(\sin(\theta + \omega\Delta t) - \sin\theta\right) \\[6pt] y - \dfrac{v}{\omega}\left(\cos(\theta + \omega\Delta t) - \cos\theta\right) \\[6pt] \theta + \omega\Delta t \end{bmatrix}
\;\xrightarrow{\;\omega \to 0\;}\;
\begin{bmatrix} x + v\Delta t\cos\theta \\ y + v\Delta t\sin\theta \\ \theta \end{bmatrix}
$$

The limit on the right is the straight-line case, and the code switches to it below $|\omega| < 10^{-6}$ rad/s to avoid dividing by zero.

**Why the covariance needs Jacobians.** If the pose is uncertain by a small error $\delta$ around $\mu$, the next pose is $g(\mu + \delta, u) \approx g(\mu, u) + G\,\delta$ where $G = \partial g / \partial x$ evaluated at $\mu$. The error after the step is $G\delta$, and the covariance of a linearly transformed variable is $G \Sigma G^{\mathsf T}$. The same argument on the odometry input, with noise $\epsilon \sim \mathcal N(0, M)$ in $u$, adds $V M V^{\mathsf T}$ with $V = \partial g / \partial u$. Together:

$$
\mu' = g(\mu, u), \qquad \Sigma' = G\,\Sigma\,G^{\mathsf T} + V\,M\,V^{\mathsf T}
$$

This is exact for a linear model with Gaussian noise and an approximation otherwise; the "E" in EKF stands for that approximation. For the straight-line step the derivatives are short:

$$
G = \begin{bmatrix} 1 & 0 & -v\Delta t\sin\theta \\ 0 & 1 & \phantom{-}v\Delta t\cos\theta \\ 0 & 0 & 1 \end{bmatrix},
\qquad
V = \begin{bmatrix} \Delta t\cos\theta & 0 \\ \Delta t\sin\theta & 0 \\ 0 & \Delta t \end{bmatrix},
\qquad
M = \begin{bmatrix} \sigma_v^2 & 0 \\ 0 & \sigma_\omega^2 \end{bmatrix}
$$

The lab uses these straight-line Jacobians even when $\omega \ne 0$; over 50 ms the difference from the arc Jacobians is second order in $\omega\Delta t$ and far below the noise. Read the third column of $G$: a heading error $\delta_\theta$ becomes a position error $v\Delta t\,\delta_\theta$ pointing across the heading, every tick. That column is the whole reason the uncertainty ellipse stretches sideways, and why a cheap gyro is worth more than a better wheel encoder.

**The noise model.** With $V$ as above, $V M V^{\mathsf T}$ adds $(\Delta t\,\sigma_v)^2$ along the heading, $(\Delta t\,\sigma_\omega)^2$ to the heading variance, and nothing across the heading directly. The simulator's odometry noise grows with the motion:

$$
\sigma_v = k\,(0.1\,|v| + 0.02)\ \text{m/s}, \qquad \sigma_\omega = k\,(0.2\,|\omega| + 0.1\,|v| + 0.02)\ \text{rad/s}
$$

with $k$ the odometry-noise slider (×{{live:odoK}} now). The filter builds its $M$ from the same formula with $k_{\text{filter}} = \text{(assumed motion noise)} \times \max(k, 0.25)$, so the assumed noise follows the true noise by default and can be scaled in the Localize tab; the floor of 0.25 keeps $\Sigma$ growing even on a level whose odometry is perfect, because a filter cannot know that. The calibration bias is a separate thing, with $b$ the bias slider (×{{live:odoB}} now). Together with the noise, the readings are

$$
v_{\text{meas}} = v\,(1 + 0.02\,b) + \sigma_v\,\varepsilon_1, \qquad \omega_{\text{meas}} = \omega + 0.01\,b\,v + \sigma_\omega\,\varepsilon_2, \qquad \varepsilon_1, \varepsilon_2 \sim \mathcal N(0, 1)\ \text{fresh every tick}
$$

The bias appears nowhere in $M$. That omission is what lesson 1 and the second half of lesson 2 are about.

**In numbers.** Driving straight at 0.8 m/s with both sliders at ×1, each reading is off by $\sigma_v \approx$ 0.10 m/s and $\sigma_\omega \approx$ 0.10 rad/s (5.7°/s) at random. The bias makes the speed read 2 % high (+1.6 cm/s) and adds +0.008 rad/s (0.46°/s) to the turn rate, always in the same direction, about 28° of heading per minute. At the current settings and {{live:v0}} m/s: $\sigma_v$ = {{live:sigv}} m/s, $\sigma_\omega$ = {{live:sigw}} rad/s, bias +{{live:odoBv}} cm/s and +{{live:odoBw}} rad/s, heading drift {{live:odoDrift}}° per minute. The noise partly averages out (its heading error grows like $\sqrt t$), while the bias never does: its heading error grows like $t$ and the position error like $t^2$.

[try: Dead reckoning, L3 | {"sim":true,"level":2,"set":{"loc":"dr"},"tab":"loc","plot":"pos"}] [try: Same, noise ×3 | {"sim":true,"level":2,"set":{"loc":"dr","odoK":3},"tab":"loc","plot":"pos"}]

**How fast it grows.** For straight driving at speed $v$ with heading noise only, the heading variance after time $t$ is $\sigma_\theta^2(t) = \sigma_\omega^2\, t / \Delta t \cdot \Delta t^2 = \sigma_\omega^2 \Delta t\, t$, a random walk, and the sideways position error integrates it: its variance grows like $v^2 \sigma_\omega^2 \Delta t\, t^3/3$. Cubic in time. Speed noise alone gives a sideways-free, along-track variance linear in $t$. That asymmetry, $t^3$ across against $t$ along, is the ellipse.

## 3. The measurement model

A beacon $j$ at a known position $(m_x, m_y)$ is seen as a range and a bearing relative to the heading. With $\delta_x = m_x - x$, $\delta_y = m_y - y$ and $q = \delta_x^2 + \delta_y^2$:

$$
h(x) = \begin{bmatrix} \sqrt q \\ \operatorname{atan2}(\delta_y, \delta_x) - \theta \end{bmatrix},
\qquad
H = \frac{\partial h}{\partial x} = \begin{bmatrix} -\delta_x/\sqrt q & -\delta_y/\sqrt q & 0 \\ \delta_y/q & -\delta_x/q & -1 \end{bmatrix}
$$

Read the rows. The range row is minus the unit vector toward the beacon: moving toward it shortens the range, moving across it changes nothing to first order. The bearing row is the perpendicular unit vector divided by the distance, so a sideways step of one metre at 5 m changes the bearing by 0.2 rad, and the $-1$ says turning left makes every beacon appear further right. These rows are the directions each reading can correct; the Kalman update cannot move the estimate in a direction $H$ does not see.

The sensor noise is $Q = \operatorname{diag}(\sigma_r^2, \sigma_b^2)$ with $\sigma_r$ = 8 cm and $\sigma_b$ = 0.03 rad (1.7°) at the default beacon-noise setting, readings every 0.2 s (every fourth tick) from beacons within {{live:lmRange}} m and in line of sight.

## 4. The Kalman update, derived

Suppose the belief before the reading is $\mathcal N(\mu, \Sigma)$ and the reading is $z = h(x) + \nu$ with $\nu \sim \mathcal N(0, Q)$. Linearize $h$ about $\mu$: $h(x) \approx h(\mu) + H(x - \mu)$. Then the predicted reading is $\hat z = h(\mu)$, and the innovation $\nu = z - \hat z \approx H(x - \mu) + \text{noise}$ is a linear function of the unknown error $x - \mu$, which has covariance $\Sigma$. So the innovation has covariance

$$
S = H\,\Sigma\,H^{\mathsf T} + Q
$$

the pose uncertainty seen through the measurement plus the sensor noise, and the error and the innovation are jointly Gaussian with cross-covariance $\Sigma H^{\mathsf T}$. Conditioning one Gaussian on another is a standard result: the conditional mean shifts by (cross-covariance)(innovation covariance)$^{-1}$(innovation), and the conditional covariance loses (cross-covariance)(innovation covariance)$^{-1}$(cross-covariance)$^{\mathsf T}$:

$$
K = \Sigma H^{\mathsf T} S^{-1}, \qquad \mu \leftarrow \mu + K\nu, \qquad \Sigma \leftarrow \Sigma - K S K^{\mathsf T} = (I - KH)\,\Sigma
$$

That is the whole update. $K$ is not a tuning knob; it is the ratio of what the state could explain, $\Sigma H^{\mathsf T}$, to the total spread of the surprise, $S$. Two limits make it concrete. A perfect sensor, $Q \to 0$, gives $K = \Sigma H^{\mathsf T}(H\Sigma H^{\mathsf T})^{-1}$, which moves the estimate until $h(\mu)$ matches $z$ exactly in the measured directions. A useless sensor, $Q \to \infty$, gives $K \to 0$ and nothing moves. The same formula also drops out of minimizing the trace of the posterior covariance over all linear updates $\mu + K\nu$, which is the "optimal gain" derivation in older textbooks; the Bayesian one above is shorter and says the same thing.

**The Joseph form.** $(I - KH)\Sigma$ is algebraically correct but numerically fragile: it is a difference of two nearly equal matrices and can lose symmetry or go slightly indefinite after many updates. Writing the same quantity as a sum of two positive terms,

$$
\Sigma \leftarrow (I - KH)\,\Sigma\,(I - KH)^{\mathsf T} + K\,Q\,K^{\mathsf T}
$$

is exact for the optimal $K$ (expand it and the extra terms cancel) and stays positive definite for any $K$. The EKF in this lab uses it; EKF-SLAM uses the short form and re-symmetrizes, because the Joseph form costs $O(n^3)$ on the full map state.

**Several readings at once.** When $k$ beacons are visible the lab applies $k$ updates in sequence, each with a 2 × 2 $S$, instead of one update with a $2k \times 2k$ $S$. For independent readings the two are equivalent to first order (the second update linearizes about the once-corrected $\mu$, which is slightly better, not worse), and inverting 2 × 2 matrices by hand is why the EKF runs in microseconds.

[try: EKF on L3 | {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}]

## 5. Consistency: NEES and the 2σ band

The covariance is only useful if it is true. The test is to measure the actual error $e = x_{\text{true}} - \mu$ in the units the filter itself proposes. If the filter is consistent then $e \sim \mathcal N(0, \Sigma)$, and the whitened error $\Sigma^{-1/2} e$ has three independent standard-normal components. Its squared length,

$$
\text{NEES} = e^{\mathsf T}\,\Sigma^{-1}\,e = \big\|\Sigma^{-1/2} e\big\|^2 \;\sim\; \chi^2_3
$$

is chi-squared with three degrees of freedom: mean 3, and below 7.81 in 95 % of samples. The lab computes it every fourth tick and the status strip shows the mean of the last 100 samples (20 s), flagging the filter as overconfident above 7.8. The average of 100 samples of a $\chi^2_3$ variable has a standard deviation of $\sqrt{6/100} \approx 0.25$, so a steady reading of 5 is already significant and a reading of 10 is not noise. The 2σ band on the Position error plot is the one-dimensional version: $2\sqrt{\sigma_x^2 + \sigma_y^2}$, which the position error should stay under about 95 % of the time if the two coordinates are independent (slightly less often when they are correlated, which is why the band is a guide and NEES is the test).

What breaks consistency is anything the model lacks. Unmodeled bias is the usual case: the innovations stop being zero-mean, but $K$ still treats them as noise and $\Sigma$ keeps shrinking as if every reading were fully informative. The honest repairs are to model the bias (add a scale state to the filter, which the beacons then make observable) or, pragmatically, to inflate $M$ so that $\Sigma$ stays large enough to absorb it, which is what lesson 2's third experiment does.

[try: EKF, bias ×3 | {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3},"tab":"loc","plot":"pos"}] [try: Bias ×3, assumed noise ×4 | {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3,"filtK":4},"tab":"loc","plot":"pos"}]

## 6. Data association and the gate

When readings do not say which beacon they came from, the filter must decide. For a reading $z$ and a candidate beacon $j$ it has a predicted reading $\hat z_j$ and an innovation covariance $S_j$, so the natural distance is the innovation measured in its own units:

$$
d_j^2 = \nu_j^{\mathsf T}\, S_j^{-1}\, \nu_j, \qquad \nu_j = z - \hat z_j
$$

the squared Mahalanobis distance. If $j$ is the right beacon and the filter is consistent, $\nu_j$ is zero-mean Gaussian with covariance $S_j$, so $d_j^2 \sim \chi^2_2$: two degrees of freedom, one per measured quantity. The 99 % point of $\chi^2_2$ is 9.21. The rule is therefore: take the beacon with the smallest $d^2$ (nearest neighbour), and use the reading only if $d^2 < 9.21$; otherwise call it an outlier and discard it. A correct reading is wrongly discarded 1 % of the time, which is the price of rejecting clutter.

The gate is also exactly what makes a kidnapping fatal to a Gaussian filter. After the jump, every reading is many σ from its prediction, every $d^2$ is in the thousands, and every reading is rejected as an outlier. The filter is protected from the evidence that would save it. It keeps predicting with the odometry, its $\Sigma$ grows only at the odometry rate, and it can take minutes before the gate opens wide enough for a reading to pass, by which time the association will probably be wrong. Known IDs remove the gate and the EKF recovers, badly but steadily: each reading moves the estimate by $K\nu$ with the same small $K$, so a 16 m error decays geometrically, falling by about a third every second in lesson 3's first experiment. A filter with no gate is also a filter with no defence against clutter, so a real stack keeps the gate and adds a recovery mechanism, which is the particle filter's injection, next.

[try: Kidnap, EKF with known IDs | {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos","act":"kidnap"}] [try: Kidnap, EKF unlabeled | {"sim":true,"level":2,"set":{"loc":"ekf","assoc":"unknown"},"tab":"loc","plot":"pos","act":"kidnap"}]

## 7. The particle filter

**Importance sampling.** Represent the belief by $N$ poses $x^{[i]}$ with weights $w^{[i]}$ that sum to one, so that any expectation is approximated by $\sum_i w^{[i]} f(x^{[i]})$. The Bayes recursion then becomes two concrete operations. Prediction: move each particle through the motion model with its own draw of odometry noise, $x^{[i]} \leftarrow g(x^{[i]}, u + \epsilon^{[i]})$. The particles now sample $\overline{bel}$. Correction: multiply each weight by the likelihood of the reading at that particle,

$$
w^{[i]} \leftarrow w^{[i]}\; p(z \mid x^{[i]}), \qquad p(z \mid x) = \prod_{\text{readings}} \exp\!\left(-\tfrac12\left[\frac{(r - \hat r)^2}{\sigma_r^2} + \frac{(b - \hat b)^2}{\sigma_b^2}\right]\right)
$$

then normalize. This is Bayes' rule applied per sample: particles that explain the reading well gain weight, the others lose it. The lab keeps log-weights (sums instead of products, no underflow), adds a floor of $10^{-3}$ to each reading's likelihood so that one bad reading cannot zero a particle, and with unlabeled beacons takes the best-matching beacon for each reading, which is nearest-neighbour association done per particle rather than once for the whole filter. That per-particle association is why the particle filter survives what kills the EKF in section 6: a particle near the true pose finds the beacons that fit it, whatever the others do.

**Degeneracy and resampling.** Left alone, the weights collapse: after a few updates one particle holds nearly all the weight and the rest are wasted. The effective sample size measures it:

$$
N_{\text{eff}} = \frac{1}{\sum_i \left(w^{[i]}\right)^2}
$$

which is $N$ when all weights are equal and 1 when one particle has everything. (With weights $w$ and $1-w$ on two particles, $N_{\text{eff}} = 1/(w^2 + (1-w)^2)$, between 1 and 2.) When $N_{\text{eff}} < N/2$ the lab resamples: draws a new set of $N$ particles from the old one with probability proportional to weight, then resets all weights to equal. Heavy particles are copied, light ones vanish. Drawing $N$ independent random numbers would add sampling noise of its own; low-variance resampling draws one number $u \in [0, 1/N)$ and walks the cumulative weights at $u, u + 1/N, u + 2/N, \ldots$, so a particle with weight $w$ is copied either $\lfloor Nw \rfloor$ or $\lceil Nw \rceil$ times, never more or fewer. The update step runs only once the robot has moved 5 cm since the last one, so that a stationary robot does not resample the same readings over and over and collapse the set for nothing.

**Augmented MCL: noticing that the readings stopped fitting.** Keep two running averages of the mean likelihood $\bar w$ per update, a fast one and a slow one:

$$
w_{\text{slow}} \leftarrow w_{\text{slow}} + 0.001\,(\bar w - w_{\text{slow}}), \qquad w_{\text{fast}} \leftarrow w_{\text{fast}} + 0.1\,(\bar w - w_{\text{fast}})
$$

The slow one remembers how well the readings normally fit; the fast one tracks the last few seconds. When the fast average drops well below the slow one the readings have suddenly stopped fitting the particle set, which is what a kidnapping or a lost filter looks like from inside. The lab then replaces a fraction $\min(0.25,\, 1 - w_{\text{fast}}/w_{\text{slow}})$ of the resampled particles with fresh ones. Rather than scattering them uniformly, it draws each from a current reading (sensor-resetting): pick a reading, pick a beacon, place the particle at that range from the beacon in a random direction and set the heading so the bearing matches. Every injected particle is consistent with at least one reading, so the next update sorts them quickly. This is the mechanism behind the kidnap recovery in lesson 3 and the global localization in lesson 4.

**The lidar against the map.** With a known map the lidar is a second likelihood. For 24 of the 120 beams the lab looks up the distance $d$ from each beam's endpoint (placed from the particle's pose) to the nearest occupied cell and scores $\log(0.9\,e^{-d^2/2\sigma^2} + 0.05)$ with $\sigma$ = 0.2 m, a likelihood-field model: no ray tracing, and the 0.05 floor keeps unexplained beams from being fatal. The sum over beams is multiplied by 0.4 before it enters the log-weight. That tempering matters: 24 beams treated as independent would give a likelihood so peaked that one particle wins every update and the set collapses onto noise. The lidar is what eventually breaks the warehouse's 180° symmetry in lesson 4, but slowly, because the map's asymmetries are small and visible only from some places.

**Estimate and covariance.** The reported pose is the weighted mean of the particles, with the heading averaged as a unit vector $(\sum w\cos\theta, \sum w\sin\theta)$ so that angles near ±π do not cancel, and the reported $\Sigma$ is the weighted scatter about that mean. When the set holds two clusters, say the true pose and its mirror, the mean sits between them and $\Sigma$ is huge, which is honest and is what the lost guard reads to decide that the robot should stop and turn in place.

[try: Scatter the particles, unlabeled | {"sim":true,"level":4,"set":{"loc":"pf"},"tab":"loc","act":"scatter"}] [try: Scatter, known IDs | {"sim":true,"level":4,"set":{"loc":"pf","assoc":"known"},"tab":"loc","act":"scatter"}]

## 8. EKF-SLAM: the map joins the state

Remove the beacon positions from the filter's knowledge and append them to its state:

$$
x = [\,x, y, \theta,\; m_{1x}, m_{1y},\; m_{2x}, m_{2y}, \ldots\,]^{\mathsf T}, \qquad P \text{ is } (3 + 2n) \times (3 + 2n)
$$

Everything from sections 2 to 4 still applies with larger matrices, and three things are new.

**Prediction touches only the pose block.** Landmarks do not move, so the motion Jacobian is $G$ on the pose and the identity on the map. $P \leftarrow G P G^{\mathsf T} + V M V^{\mathsf T}$ (the motion noise of §2) then changes the 3 × 3 pose block, scales the 3 × 2n cross-covariances by $G$, and leaves the map block alone. The lab exploits that sparsity; a dense multiply would be $O(n^3)$ per tick.

**A new landmark inherits the pose uncertainty.** The first reading $(r, b)$ of a beacon places it by the inverse measurement model $m = p + r\,[\cos(\theta + b), \sin(\theta + b)]$. Its covariance comes from the same linearization argument as section 2, now with two Jacobians, one on the pose and one on the reading:

$$
J_x = \begin{bmatrix} 1 & 0 & -r\sin(\theta + b) \\ 0 & 1 & \phantom{-}r\cos(\theta + b) \end{bmatrix},
\quad
J_z = \begin{bmatrix} \cos(\theta + b) & -r\sin(\theta + b) \\ \sin(\theta + b) & \phantom{-}r\cos(\theta + b) \end{bmatrix}
$$

$$
P_{mm} = J_x P_{xx} J_x^{\mathsf T} + J_z Q J_z^{\mathsf T}, \qquad P_{mx} = J_x P_{xx}, \qquad P_{m,\text{others}} = J_x P_{x,\text{others}}
$$

The second and third pieces are the point of SLAM. The new landmark is placed from an uncertain pose, so its error is the pose error (through $J_x$) plus sensor noise, and it is correlated with the pose and with every landmark the pose is correlated with. The map is not a set of independent points; it is one jointly uncertain object with the robot in it.

**Updates constrain relative positions.** The measurement Jacobian for landmark $j$ is the $H$ of section 3 with two extra nonzero columns, the derivatives with respect to $m_j$, which are the negatives of the pose columns: $\partial h/\partial m = -\partial h/\partial p$. A reading therefore says nothing about where the pose and the landmark are absolutely, only about their difference. The absolute error of the whole structure drifts like dead reckoning (section 2) between observations of old landmarks, and the correlations are what make loop closure work: when the robot re-observes a landmark it mapped early, while its pose was still certain, the innovation is applied through $K = P H^{\mathsf T} S^{-1}$ to every state the landmark is correlated with, which is the pose and, through the pose, every landmark placed since. One reading moves the whole map. A longer beacon range means more landmarks are shared between distant parts of the route, so loop closures happen continuously and the drift stays bounded, which is lesson 5's second experiment.

The cost is the dense $P$: each update is $O(n^2)$ and memory is $O(n^2)$ in the number of landmarks, fine for a dozen beacons and the reason real systems moved to sparse graph formulations once maps grew to thousands of features.

[try: EKF-SLAM, range 7 m | {"sim":true,"level":2,"set":{"loc":"slam"},"tab":"loc","plot":"pos"}] [try: Range 12 m | {"sim":true,"level":2,"set":{"loc":"slam","lmRange":12},"tab":"loc","plot":"pos"}]

## 9. Heading sensors: a gyro in the motion model

Nothing in the filter changes when the turn rate comes from a yaw-rate gyro instead of the wheel encoders. The input is still $u = (v, \omega)$ and the prediction is still the arc model of §2 with its Jacobians $G$ and $V$; what changes is the input noise. The wheels' turn rate is a difference of two wheel speeds, so its noise is large and it carries the wheel-calibration bias; the gyro reads the body's yaw rate directly, with a small noise of its own and none of the wheel geometry. In the lab the gyro's reading is

$$
\omega_g = \omega + b + n, \qquad n \sim \mathcal N(0, \sigma_g^2), \qquad \sigma_g = 0.3°/\mathrm s \text{ per reading}
$$

against the wheels' $\sigma_\omega = 0.2|\omega| + 0.1|v| + 0.02$ rad/s, about $5.7°/\mathrm s$ at 0.8 m/s, plus their bias of $0.01\,v$ rad/s. So $M = \mathrm{diag}(\sigma_v^2, \sigma_g^2)$ and the heading's share of $V M V^{\mathsf T}$ shrinks by $(\sigma_\omega/\sigma_g)^2$, about 360 times at the cruise speed.

**The random walk.** Each tick adds $\sigma_g^2 \Delta t^2$ to the heading variance (the $b$ term of §2), so after $t$ seconds of noise alone

$$
\sigma_\theta^2(t) = \sigma_g^2\,\Delta t\, t,
$$

a random walk: the standard deviation grows with $\sqrt t$. With $\sigma_g = 0.3°/\mathrm s$ and $\Delta t = 0.05$ s that is $0.5°$ after a minute, against $10°$ for the wheels' noise alone, and the wheels' bias adds $0.46°/\mathrm s$ on top, which is not a random walk but a straight line.

**A constant bias.** A gyro bias $b$ the filter does not know integrates once into the heading and twice into the sideways position:

$$
\theta_{err}(t) = b\,t, \qquad e_\perp(t) \approx \int_0^t v\,\theta_{err}\,\mathrm d\tau = \tfrac12\, v\, b\, t^2.
$$

At $0.5°/\mathrm s$ and 0.8 m/s that is $30°$ and 7.9 m after a minute of straight driving. Meanwhile $\Sigma$ grows only by the noise term, so the filter is overconfident by the ratio of the two, which is why NEES explodes in the lesson. On a real MEMS gyro the bias is a few tenths of a degree per second and moves with temperature; this is the dominant error of every IMU-based dead reckoning, not the noise.

**The zero-velocity update.** While the robot stands still the true yaw rate is exactly zero, so every reading is $b + n$ and their mean is an estimate of $b$ with standard deviation $\sigma_g / \sqrt N$ over $N$ readings. The lab uses an exponential average,

$$
\hat b \leftarrow \hat b + \alpha(\omega_g - \hat b), \qquad \alpha = 0.1,
$$

which settles in the 2 s hold at the start of a run (40 readings; the remaining fraction of the bias is $0.9^{40} \approx 1.5\,\%$) and averages the noise down by $\sqrt{\alpha/(2-\alpha)} \approx 0.23$, so the estimate is good to about $0.07°/\mathrm s$. The estimate is then subtracted from every reading, and refreshed at every later stop. The alternative, used when stops are rare, is to make $b$ a fourth state of the filter: the beacons then observe it through the heading, and §4 corrects it like everything else. Both are standard; the lab keeps the three-state filter and uses the stop.

## 10. Scan matching: the lidar as a position sensor

**The cost.** With a prior map, its distance field $d(\cdot)$ gives every point in the world its distance to the nearest wall (the same transform the costmap uses, chapter 3 §2). A scan is a set of hits $p_i$ in the body frame; placed in the world at a pose $\xi = (x, y, \theta)$ they land at $T_\xi p_i = R(\theta)\,p_i + (x, y)$. If $\xi$ is right the hits lie on walls and $d(T_\xi p_i) = 0$; if it is wrong they lie beside them. Scan matching minimizes
$$
F(\xi) = \sum_i d(T_\xi p_i)^2
$$
over the pose. Hits with $d > 0.5$ m are left out: they are people, or beams that hit nothing in the map, and a least-squares fit would be dragged by them.

**Gauss–Newton.** $d$ is read from the grid by bilinear interpolation, which also gives its gradient $\nabla d = (d_x, d_y)$. By the chain rule the residual's derivative with respect to the pose is one row per hit,
$$
J_i = \nabla d\,\frac{\partial T_\xi p_i}{\partial \xi} = \begin{bmatrix} d_x & d_y & d_x(-s\,p_x - c\,p_y) + d_y(c\,p_x - s\,p_y)\end{bmatrix}, \quad c = \cos\theta,\ s = \sin\theta,
$$
and the linearized problem has the normal equations $H\,\delta = -b$ with $H = \sum_i J_i^\top J_i$ and $b = \sum_i J_i^\top d_i$. The step $\delta$ is added to $\xi$ and the loop repeats until the step is under a millimetre and a milliradian, ten times at most. The second derivatives of $d$ are dropped, which is what makes it Gauss–Newton rather than Newton; near a fit they hardly matter. Sixty hits and ten steps are about a thousand field reads, well under a millisecond.

**The covariance.** For a least-squares fit the estimate's covariance is $s^2 H^{-1}$ with $s^2 = \sum d_i^2 / (n - 3)$ the residual variance. Two corrections before it is believed: neighbouring beams hit the same wall, so the $n$ residuals are not independent and the covariance is inflated by four; and no fit is better than the map's cells, so it is floored at $(5\,\text{cm})^2$ in position and $(1°)^2$ in heading. The structure of $H$ is the interesting part. Its eigenvectors are the directions in which moving the scan changes the cost most and least; in a long featureless corridor the along-corridor eigenvalue is near zero, $H^{-1}$ is long in that direction, and the fix honestly reports that it knows where across the corridor the robot is but not where along it.

**The fusion.** The matched pose is a measurement of the whole state with $H = I$: innovation $\nu = \xi_\text{fix} - \mu$ (heading wrapped), $S = \Sigma + \Sigma_\text{fix}$, gain $K = \Sigma S^{-1}$, the update of §4 with the Joseph form. The gate is $\nu^\top S^{-1}\nu < \chi^2_3(99\,\%) = 11.3$. Two rules keep it honest: a match is fused only once the robot has moved 5 cm or turned 6° since the last fused one, because the same scan from the same place is not new evidence; and a fit with residual over 12 cm, or with fewer than 60 % of its hits near any wall, is a match onto the wrong walls and is dropped.

**The double counting.** The matcher starts from the estimate and its result corrects that same estimate: part of the fix is the prior, and fusing it at full weight counts the prior twice. That is why the NEES of the lidar-only runs below sits near 6 rather than 3 even with the inflation. The honest versions start the match from the odometry-only prediction, or treat matches as constraints between poses in a smoother (chapter 2 §8's EKF-SLAM is the filter form of that, and pose-graph SLAM its sparse one).

**Aliasing.** Gauss–Newton converges to the nearest minimum of $F$. From an estimate within its basin, half a metre and some 20° on this map, that is the right one. After a kidnap it is whichever shelves happen to be near the old estimate, and in a warehouse of identical shelves those fit the new scan as well as the right ones did: the residual is small, the gate is quiet, and the filter is confidently wrong. Nothing in one scan can tell; detection needs a second hypothesis (the particle filter's injected samples, §7), a sensor that sees past the shelves (the beacons), or a check over a sequence of scans.

**Measured** on L3 at seed 7, the EKF, 120 s:

| Run | Pose RMS | NEES | Inside 2σ | Goals |
| --- | --- | --- | --- | --- |
| Dead reckoning, no beacons | 1.58 m | – | – | 2 of 5, one collision |
| Scan matching, no beacons | 0.04 m | 2 to 9 (≈ 6) | 85 % | 5 |
| Beacons only | 0.04 m | 2.8 to 5.2 | 97 % | 5 |
| Beacons and scan matching | 0.03 m | ≈ 4.5 | 91 % | 5 |
| Beacons down 70 %, scan matching | 0.04 m | 2 to 9.5 | 87 % | 5 (up to 0.46 m without it) |
| Kidnapped at 8 s, lidar only | 16 m from then on | 10⁵ | 0 | 0, no match rejected by the gate (8 poor fits dropped after a minute) |
| Kidnapped at 8 s, beacons and lidar | 0.25 m at 24 s, 2 cm at 34 s | back to 3.5 by 54 s | – | 76 matches rejected on the way (39 poor fits, 37 by the gate) |

L2's aisles, with odometry noise and bias ×1 and no beacons: 0.04 m RMS, all four goals.

[try: Lidar only: every beacon off | {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos"}] [try: Kidnapped, lidar only | {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}]

## 11. Pose-graph SLAM: the map as a set of constraints

**The graph.** A node is a keyframe pose $x_i = (x, y, \theta)_i$; an edge $(i, j, z_{ij}, \Omega_{ij})$ is a measurement of pose $j$ in the frame of pose $i$ with information matrix $\Omega_{ij}$ (the inverse of its covariance). Two kinds: the odometry edge from each keyframe to the next, and loop-closure edges between a keyframe and an earlier one that saw the same place. The maximum-likelihood poses minimize
$$
F(x) = \sum_{ij} e_{ij}^\top \Omega_{ij}\, e_{ij}, \qquad e_{ij} = z_{ij}^{-1} \oplus \left(x_i^{-1} \oplus x_j\right),
$$
the mismatch between what the chain says about $j$ relative to $i$ and what the edge measured, with $\oplus$ the pose composition and the heading wrapped.

**The Jacobians.** With $\Delta = x_i^{-1} \oplus x_j$ (so $\Delta_t = R_i^\top (t_j - t_i)$, $\Delta_\theta = \theta_j - \theta_i$) and $e = (R_z^\top(\Delta_t - z_t),\ \Delta_\theta - z_\theta)$,
$$
B_{ij} = \frac{\partial e}{\partial x_j} = \begin{bmatrix} R_z^\top R_i^\top & 0 \\ 0 & 1 \end{bmatrix}, \qquad
A_{ij} = \frac{\partial e}{\partial x_i} = \begin{bmatrix} -R_z^\top R_i^\top & R_z^\top \dfrac{\partial R_i^\top}{\partial \theta_i}(t_j - t_i) \\ 0 & -1 \end{bmatrix},
$$
with $\partial R^\top/\partial\theta = \begin{bmatrix} -s & c \\ -c & -s\end{bmatrix}$. Gauss–Newton linearizes each error, $e_{ij}(x + \delta) \approx e_{ij} + A_{ij}\delta_i + B_{ij}\delta_j$, and the normal equations $H\delta = -b$ sum, per edge, $A^\top\Omega A$ into block $(i,i)$, $A^\top\Omega B$ into $(i,j)$ and its transpose, $B^\top\Omega B$ into $(j,j)$, and $A^\top\Omega e$, $B^\top\Omega e$ into $b_i$, $b_j$. Every edge touches two poses, so $H$ has non-zero blocks only where edges are: sparse, and the reason real solvers (g2o, Ceres, GTSAM) handle tens of thousands of poses. The lab's graphs have a few hundred, and a dense Cholesky takes a tenth of a second at two hundred keyframes.

**The gauge.** Shifting and turning every pose together changes no edge, so $H$ has a three-dimensional null space. One pose has to be fixed; the lab adds a prior of $10^6$ on the first pose's three unknowns, which comes to the same as removing them. The map is then expressed in the first keyframe's frame, consistent within itself and aligned to nothing outside it.

**The marginal covariance.** After an optimization the covariance of the last pose is the corresponding $3\times 3$ block of $H^{-1}$, obtained with three solves against the factored $H$ (one per unit vector); between optimizations it grows by the odometry edges, composed the way §2 composes an uncertain motion onto an uncertain pose (the heading uncertainty of the keyframe swings the leg sideways). The current estimate is the last keyframe composed with the odometry since, and its covariance that marginal plus the odometry's, which is what the ellipse on the map draws.

**Two levels.** The matcher of §10 is the local level: before a keyframe's odometry edge is written, its scan is aligned to the map the keyframes have built so far (a hit map, the cells the earlier scans' beams ended in, never carved by free-space updates, because carving erodes walls seen only a few times) and the result is fused with the odometry as a Kalman update, so that along a corridor, where the fit is undetermined, the odometry keeps its say. The edge then carries the matched motion with the fit's information. The graph is the global level: a keyframe within reach of one at least ten keyframes back (the reach grows with the pose uncertainty) has its scan aligned to that one by ICP, from the chain's own guess, and a fit with most of the hits paired within 30 cm and a small residual becomes a closure. Closures are batched into one optimization per second, at once when one moved a pose by more than 0.3 m; after it the maps, the hit map and the planning grid, are rebuilt from the scans at the new poses, every scan hung off its keyframe by the relative pose it had.

**ICP.** Point-to-point: pair every source point with its nearest destination point within half a metre, then the best rigid transform of the pairs in closed form, centroids $\bar p$, $\bar q$, the $2\times 2$ cross-covariance $M = \sum (q - \bar q)(p - \bar p)^\top$, $\theta = \operatorname{atan2}(M_{10} - M_{01},\ M_{00} + M_{11})$, $t = \bar q - R\bar p$; repeat until the transform stops moving. It converges to the nearest fit from where it starts, which is why a closure needs a guess within its reach, and why, when the chain's guess is far off, the lab tries a grid of starts around it and accepts only a stricter fit.

**Measured** on L4 at seed 7, the out-and-back tour (the four goals and back along them, about 100 m), 200 s:

| Estimator | Pose RMS | Worst | Goals | Map agreement | Closures |
| --- | --- | --- | --- | --- | --- |
| Dead reckoning, wheels | 1.97 m | 3.83 m | 2 of 7 | 86 % | – |
| Graph, loop closures only, wheels | 2.40 m | 2.86 m | 4 of 7 | 89 % | 13, twelve in the first half-minute; stuck at the far end after a contact, never drives back |
| Graph, scan-to-map only, wheels | 0.25 m | 0.55 m | 7 | 93 % | – |
| Graph, both, wheels | 0.33 m | 0.61 m | 7 | 93 % | 85 |
| Dead reckoning, gyro | 0.23 m | 0.40 m | 7 | 93.5 % | – |
| Graph, loop closures only, gyro | 0.19 m | 0.27 m | 7 | 94 % | 82 |
| Graph, scan-to-map only, gyro | 0.12 m | 0.26 m | 7 | 96 % | – |
| Graph, both, gyro | 0.12 m | 0.22 m | 7 | 95 % | 84 |
| EKF with the beacons | 0.03 m | 0.12 m | 7 | 96 % | – |
| Graph, both, gyro, frontier exploration | 0.10 m | 0.22 m | – | 96 % | 37 |

"Worst" is the largest error at any tick. The honest reading: on a building this size the scan-to-map level does the work, and with the gyro the closures add nothing these numbers can see; loop closures need an odometry good enough to put the chain's guess within ICP's reach; and with the gyro the lidar alone builds a map within a point of the beacon EKF's.

[try: Pose-graph SLAM on wheel odometry | {"sim":true,"level":3,"set":{"loc":"pgslam"},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}] [try: Both levels, with the gyro | {"sim":true,"level":3,"set":{"loc":"pgslam","gyro":true},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}]

## 12. GNSS: when the noise is not white

Every update so far assumed that the measurement noise is **white**: each reading's error is drawn fresh, independent of the last one, $\mathrm E[v_k v_j^{\mathsf T}] = R\,\delta_{kj}$. That assumption is what lets the filter treat ten readings as ten times the evidence. A GNSS receiver breaks it. Most of its error comes from the atmosphere, the satellite orbits and clocks, and the reflections around the antenna, and all of these change over tens of seconds to minutes, not between one fix and the next.

**The lab's receiver.** A fix at $t_k$ is the true position plus two errors per axis:

$$
z_k = p_k + b_k + w_k, \qquad w_k \sim \mathcal N(0, \sigma_w^2)
$$

$$
b_{k+1} = \phi\, b_k + \sigma_b\sqrt{1-\phi^2}\;\eta_k, \qquad \phi = e^{-\Delta t/\tau}, \qquad \eta_k \sim \mathcal N(0, 1)
$$

The bias $b$ is a first-order **Gauss–Markov** process: stationary with variance $\sigma_b^2$ (the $\sqrt{1-\phi^2}$ keeps it there), and correlated in time as

$$
\mathrm E[b_k\, b_{k+m}] = \sigma_b^2\, \phi^{m} = \sigma_b^2\, e^{-m\Delta t/\tau}.
$$

In continuous time it is $\dot b = -b/\tau + n(t)$ with white $n$ of spectral density $2\sigma_b^2/\tau$: a random walk that is pulled back toward zero with time constant $\tau$. The settings here are $\sigma_w$ = {{live:gnssSig}} m, $\sigma_b$ = {{live:gnssBias}} m and $\tau$ = {{live:gnssTau}} s at {{live:gnssHz}} fixes per second, so two consecutive fixes share their bias with correlation $\phi$ = {{live:gnssPhi}}. The receiver reports $\sigma_{rep} = \sqrt{\sigma_w^2 + \sigma_b^2}$ = {{live:gnssRep}} m per axis: the true spread of one fix in the open, and nothing about the correlation.

**What the plain filter does with it.** Take the fixes as white with $R = \sigma_{rep}^2 I$ (the update of §4 with $H = [I_2\; 0]$, the fix measuring $x$ and $y$ directly). Standing still for $N$ fixes, the filter's position variance falls as $\sigma_{rep}^2/N$, the variance of an average of independent readings. The average of the actual errors has variance

$$
\mathrm{Var}\Big(\tfrac1N \sum_k (b_k + w_k)\Big) = \frac{\sigma_w^2}{N} + \frac{\sigma_b^2}{N^2}\sum_{i,j} \phi^{|i-j|}, \qquad \sum_{i,j}\phi^{|i-j|} = N + 2\sum_{m=1}^{N-1}(N-m)\,\phi^m .
$$

For $N\Delta t \ll \tau$ the double sum is about $N^2$ and the bias term does not average down at all; for $N\Delta t \gg \tau$ it is about $N(1+\phi)/(1-\phi) \approx N\,2\tau/\Delta t$, so a span of $T$ seconds holds only about $T/2\tau$ independent samples of the bias. Over a minute of fixes the filter claims {{live:gnssClaim}} m and the truth is {{live:gnssTrue}} m: with the defaults, a variance about 80 times smaller than it should be on each axis, so NEES on the two position axes alone near 160 where 2 is expected. Moving, the odometry stops the variance from collapsing all the way, but the fixes still pull the estimate onto $p + b$, a point that wanders by a metre over a minute, while the band shrinks to a few tenths of a metre. That is the lesson's second experiment: NEES in the hundreds, the error inside the 2σ band a tenth of the time.

**The fix: put the bias in the state.** If the error has structure, model it. Augment the state with the bias, $x_a = (x, y, \theta, b_x, b_y)$, and let the filter estimate it:

$$
F_a = \begin{bmatrix} G & 0 \\ 0 & I_2 \end{bmatrix}, \qquad Q_a = \begin{bmatrix} V M V^{\mathsf T} & 0 \\ 0 & q\,\Delta t\, I_2 \end{bmatrix}
$$

$$
H_a = \begin{bmatrix} I_2 & 0 & I_2 \end{bmatrix}, \qquad R = \sigma_w^2 I_2 .
$$

The bias is modelled as a random walk with $q = 2\sigma_b^2/\tau$ = {{live:gnssQ}} m²/s, which matches the Gauss–Markov process over short times ($\mathrm{Var}(b_{t+\Delta} - b_t) = 2\sigma_b^2(1 - e^{-\Delta/\tau}) \approx 2\sigma_b^2 \Delta/\tau$) and is more cautious over long ones. $R$ is now only the white part: the reported $\sigma_{rep}^2$ less the $\sigma_b^2$ the state carries. With the covariance in blocks, $P_a = \begin{bmatrix} P & C \\ C^{\mathsf T} & B\end{bmatrix}$, $C$ the 3×2 cross-covariance of pose and bias, the update is the §4 update with

$$
\nu = z - (\hat p + \hat b), \qquad S = P_{pp} + C_p + C_p^{\mathsf T} + B + R
$$

$$
K = \begin{bmatrix} P_{:,p} + C \\ C_p^{\mathsf T} + B \end{bmatrix} S^{-1}
$$

where $P_{pp}$ is the 2×2 position block, $P_{:,p}$ the first two columns of $P$ and $C_p$ the first two rows of $C$. The prediction moves the cross-covariance with the pose, $C \leftarrow G\,C$, and grows $B$ by $q\Delta t$. In the lab's runs the filter that carries the bias stays consistent (NEES at most 1.9 at seed 7, against 186 for the plain filter) and its band widens to a metre and a half, which is the honest answer.

**What the state cannot do.** The fixes see only the sum $p + b$. The split between the two is held by what else the filter knows: the start pose at first, then the odometry, which lets the position drift by its own random walk while the bias drifts by its own. So the band widens with time rather than settling, and how much the error itself shrinks depends on the run: from 1.64 m RMS to 0.56 m at seed 7 and from 1.36 to 0.73 m at seed 11, but at seed 3 it grew from 1.38 to 1.55 m, still inside its band. Another position source makes the bias observable: every beacon fix moves $\hat b$ through the cross-covariance, $K_b = (H C)^{\mathsf T} S^{-1}$, which is how a GNSS/INS calibrates its receiver against anything better it has. And the random walk is a deliberate choice: the exact Gauss–Markov state bounds $B$ at $\sigma_b^2$, which makes the gate tighter, and in the lab's runs it rejected more fixes and lost track at one seed of three (NEES above 100 at seed 11).

**Multipath and the gate.** Next to a wall or a parked car the receiver also sees reflections. The lab models them as a jump of 2 to 4 m, roughly away from the shape, held for 2 to 6 s, with extra noise, while the reported σ does not change. A jump is neither white nor slow, so neither model covers it; the gate of §6 ($\chi^2_2$, 9.21) catches the worst. Along the parked cars the gate rejects 15 to 21 of the first 40 fixes at seeds 3, 7 and 11. When every fix is rejected for 10 s the filter is trapped as after a kidnapping (§6), so the lab restarts it from the fixes: the position moves by the mean innovation of the last six, and the heading is taken from their track when they lie on a line and match the distance the odometry drove. Beside the cars that restart lands on reflected fixes, and NEES leaves the band.

| Run on L6, 120 s, seed 7 | RMS error | Worst | NEES max | Inside 2σ | NEES max, seeds 3 / 11 |
| --- | --- | --- | --- | --- | --- |
| Dead reckoning, odometry noise ×1 | 1.45 m | 3.21 m | 2.7 | 100 % | 3.3 / 1.4 |
| GNSS alone (odometry off) | 2.11 m | 3.54 m | 503 | 10 % | 2835 / 128 |
| GNSS and odometry, plain EKF | 1.64 m | 2.90 m | 186 | 11 % | 207 / 154 |
| … with the bias in the state | 0.56 m | 1.10 m | 1.9 | 100 % | 8.6 / 3.1 |
| … along the parked cars (multipath) | 1.93 m | 3.78 m | 127 | 59 % | 50 / 64 |
| … with outages, 50 % in 15 s spells | 1.23 m | 2.14 m | 2.6 | 100 % | 3.7 / 2.3 |

The first four and the last drive laps of an 18 × 10 m rectangle on the lot's empty floor (Map → empty, so nothing but the people gets in the way); the multipath run drives the lane above the middle row of parked cars. "NEES max" is the largest value of the status strip's 20 s mean, read every 10 s. The beacons are off in all of them.

**What the model leaves out.** Satellite geometry: a real fix is worse when the visible satellites bunch in one part of the sky (the dilution of precision, DOP), and better with more of them. The sky itself: next to a wall a real receiver loses satellites, not only gains reflections; a 2D world has no sky, so the lab stands in for it with distance. The receiver's clock and the atmosphere, which are where the slow bias comes from. Carrier phase and RTK: with a base station nearby, a receiver that tracks the carrier's phase is good to centimetres, and the error model changes entirely. And the receiver's own filter, which smooths the fixes and correlates them further before the robot's filter ever sees them.

**When GNSS still beats beacons.** It needs nothing installed, works anywhere under open sky, and its error does not grow with distance or with time: however long the robot drives, the next fix is within a few metres. Beacons give centimetres, but only where someone put them and only in their range. The usual answer is both: GNSS for where on Earth, and the lidar, beacons or a map for where in the lane.

[try: GNSS and odometry, plain | {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"loc","plot":"pos","panes":[["nees"]]}] [try: The bias in the state | {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"gnssAug":true,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"loc","plot":"pos","panes":[["nees"]]}]

## 13. What to carry into the next chapters

Three ideas from this chapter recur everywhere in the stack. Linearize, then propagate covariance through the Jacobian: the tracker's constant-velocity filter in chapter 3 is the same machinery on a person's position and velocity. Measure surprise in units of the expected spread: the Mahalanobis gate reappears in data association for tracks, and NEES is the test for any filter that claims a covariance. And keep the uncertainty honest rather than small: the costmap margins, the speed planner's growing radii and the lost guard all consume $\Sigma$, and all of them are only as good as it is.
