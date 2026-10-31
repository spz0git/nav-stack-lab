id: ch2
num: 2
sys: loc
summary: The derivations behind the Localization lessons: the motion and measurement models and their Jacobians, the Kalman update from first principles, NEES and the gate, the particle filter and EKF-SLAM, with the lab's own noise numbers.

# Localization: the estimators derived

The Localization lessons give the formulas and show what they do. This chapter shows where they come from, in the order of the lessons. Lesson 1 is the motion model and how uncertainty moves through it. Lesson 2 is the Kalman update and the consistency test, lesson 3 the gate, lesson 4 the particle filter and lesson 5 EKF-SLAM. Lessons 6 to 9 add sensors and a second kind of SLAM: a gyro in the motion model (§9), scan matching (§10), pose-graph SLAM (§11) and GNSS (§12). The numbers are the lab's own, and the ones in blue follow your current settings. The robot is on **{{live:loc}}** with odometry noise ×{{live:odoK}} and calibration bias ×{{live:odoB}}. At the cruise speed $v_0$ = {{live:v0}} m/s, one tick of odometry carries $\sigma_v$ = {{live:sigv}} m/s and $\sigma_\omega$ = {{live:sigw}} rad/s.

## 1. One problem, three estimators

Every estimator in the Localize tab answers the same question. Given everything the robot has measured so far, where is it? The answer is a probability distribution over the pose $x = [x, y, \theta]$, called the belief, and never a single point. Two kinds of information arrive at every tick. The odometry $u = (v, \omega)$ says how the robot moved, and a motion model with noise links it to the pose. A sensor reading $z$ says something about where the robot is, through a measurement model with noise. The Bayes filter combines the two with this recursion:

$$
\overline{bel}(x_t) = \int p(x_t \mid x_{t-1}, u_t)\, bel(x_{t-1})\, dx_{t-1}
\qquad
bel(x_t) = \eta\, p(z_t \mid x_t)\, \overline{bel}(x_t)
$$

The first formula is the prediction. It pushes the old belief through the motion model. The second is the correction. It multiplies by the likelihood of the reading and renormalizes ($\eta$ is the normalizer). Every estimator in this lab runs this recursion, except pose-graph SLAM (§11). That one keeps the whole path and solves for it in one go instead of filtering. The three estimators differ only in how they represent $bel$:

| Estimator | Belief represented as | Prediction | Correction |
| --- | --- | --- | --- |
| Dead reckoning | one Gaussian $(\mu, \Sigma)$ | linearized motion model | none |
| EKF, EKF-SLAM | one Gaussian $(\mu, \Sigma)$, SLAM adds the map to $x$ | linearized motion model | linearized measurement model |
| Particle filter | $N$ samples with weights | each sample moved with its own noise | weights × likelihood, then resampling |

A Gaussian needs a mean and a variance per state, plus the correlations between the states. It is cheap, and it is exact only when the models are linear and the belief has a single peak. Particles cost $N$ times more, but they can hold several peaks at once. The kidnapping and global-localization lessons depend on that.

## 2. The motion model and its Jacobians

**The arc model.** Over one tick, $\Delta t$ = 0.05 s, the odometry reports $v$ and $\omega$. The model holds both constant, so the robot moves along a circular arc of radius $v/\omega$:

$$
g(\mu, u) = \begin{bmatrix} x + \dfrac{v}{\omega}\left(\sin(\theta + \omega\Delta t) - \sin\theta\right) \\[6pt] y - \dfrac{v}{\omega}\left(\cos(\theta + \omega\Delta t) - \cos\theta\right) \\[6pt] \theta + \omega\Delta t \end{bmatrix}
\;\xrightarrow{\;\omega \to 0\;}\;
\begin{bmatrix} x + v\Delta t\cos\theta \\ y + v\Delta t\sin\theta \\ \theta \end{bmatrix}
$$

The limit on the right is the straight-line case. The code switches to it when $|\omega| < 10^{-6}$ rad/s, to avoid dividing by zero.

**Why the covariance needs Jacobians.** Suppose the pose is uncertain by a small error $\delta$ around $\mu$. Then the next pose is $g(\mu + \delta, u) \approx g(\mu, u) + G\,\delta$, where $G = \partial g / \partial x$ is evaluated at $\mu$. The error after the step is $G\delta$. The error before the step has the pose covariance, so the error after it has covariance $G \Sigma G^{\mathsf T}$. The same argument applies to the odometry input. With noise $\epsilon \sim \mathcal N(0, M)$ in $u$, it adds $V M V^{\mathsf T}$, with $V = \partial g / \partial u$. Together:

$$
\mu' = g(\mu, u), \qquad \Sigma' = G\,\Sigma\,G^{\mathsf T} + V\,M\,V^{\mathsf T}
$$

This is exact for a linear model with Gaussian noise and an approximation otherwise. The "E" in EKF (extended) refers to that approximation. For the straight-line step the derivatives are short:

$$
G = \begin{bmatrix} 1 & 0 & -v\Delta t\sin\theta \\ 0 & 1 & \phantom{-}v\Delta t\cos\theta \\ 0 & 0 & 1 \end{bmatrix},
\qquad
V = \begin{bmatrix} \Delta t\cos\theta & 0 \\ \Delta t\sin\theta & 0 \\ 0 & \Delta t \end{bmatrix},
\qquad
M = \begin{bmatrix} \sigma_v^2 & 0 \\ 0 & \sigma_\omega^2 \end{bmatrix}
$$

The lab uses these straight-line Jacobians even when $\omega \ne 0$. Over 50 ms the difference from the arc Jacobians is second order in $\omega\Delta t$, far below the noise. The third column of $G$ matters most. Every tick, it turns a heading error $\delta_\theta$ into a position error $v\Delta t\,\delta_\theta$ across the heading. This column is what stretches the uncertainty ellipse sideways. It is also why a cheap gyro is worth more than a better wheel encoder.

**The noise model.** With $V$ as above, $V M V^{\mathsf T}$ adds $(\Delta t\,\sigma_v)^2$ to the variance along the heading and $(\Delta t\,\sigma_\omega)^2$ to the heading variance. It adds nothing directly across the heading. The simulator's odometry noise grows with the motion:

$$
\sigma_v = k\,(0.1\,|v| + 0.02)\ \text{m/s}, \qquad \sigma_\omega = k\,(0.2\,|\omega| + 0.1\,|v| + 0.02)\ \text{rad/s}
$$

Here $k$ is the odometry-noise slider (×{{live:odoK}} now). The filter builds its $M$ from the same formula with $k_{\text{filter}} = \text{(assumed motion noise)} \times \max(k, 0.25)$. By default the assumed noise therefore follows the true noise, and the Localize tab can scale it. The floor of 0.25 keeps $\Sigma$ growing even on a level with perfect odometry, because a filter has no way to know that its odometry is perfect. The calibration bias is separate from the noise. With $b$ the bias slider (×{{live:odoB}} now), the readings are

$$
v_{\text{meas}} = v\,(1 + 0.02\,b) + \sigma_v\,\varepsilon_1, \qquad \omega_{\text{meas}} = \omega + 0.01\,b\,v + \sigma_\omega\,\varepsilon_2, \qquad \varepsilon_1, \varepsilon_2 \sim \mathcal N(0, 1)\ \text{fresh every tick}
$$

The bias appears nowhere in $M$. Lesson 1 and the second half of lesson 2 show what that omission does.

**In numbers.** Driving straight at 0.8 m/s with both sliders at ×1, each reading has a random error of $\sigma_v \approx$ 0.10 m/s and $\sigma_\omega \approx$ 0.10 rad/s (5.7°/s). The bias makes the speed read 2 % high (+1.6 cm/s) and adds +0.008 rad/s (0.46°/s) to the turn rate. It always acts in the same direction, and it adds up to about 28° of heading per minute. At the current settings and {{live:v0}} m/s, $\sigma_v$ = {{live:sigv}} m/s and $\sigma_\omega$ = {{live:sigw}} rad/s. The bias is +{{live:odoBv}} cm/s and +{{live:odoBw}} rad/s, and the heading drifts {{live:odoDrift}}° per minute. The noise partly averages out, and the heading error it causes grows like $\sqrt t$. The bias does not average out. Its heading error grows like $t$, and the position error like $t^2$.

[try: Dead reckoning, L3 | {"sim":true,"level":2,"set":{"loc":"dr"},"tab":"loc","plot":"pos"}] [try: Same, noise ×3 | {"sim":true,"level":2,"set":{"loc":"dr","odoK":3},"tab":"loc","plot":"pos"}]

**How fast it grows.** Take straight driving at speed $v$ with heading noise only. The heading variance after time $t$ is the number of ticks times the variance each tick adds: $\sigma_\theta^2(t) = \sigma_\omega^2\, t / \Delta t \cdot \Delta t^2 = \sigma_\omega^2 \Delta t\, t$. This is a random walk. The sideways position error is the speed times the heading error, summed over the drive, and its variance grows like $v^2 \sigma_\omega^2 \Delta t\, t^3/3$, cubic in time. Speed noise alone adds nothing sideways. It gives an along-track variance that grows linearly in $t$. The ellipse comes from this difference: $t^3$ across the heading against $t$ along it.

## 3. The measurement model

A beacon $j$ at a known position $(m_x, m_y)$ is seen as a range and a bearing relative to the heading. With $\delta_x = m_x - x$, $\delta_y = m_y - y$ and $q = \delta_x^2 + \delta_y^2$:

$$
h(x) = \begin{bmatrix} \sqrt q \\ \operatorname{atan2}(\delta_y, \delta_x) - \theta \end{bmatrix},
\qquad
H = \frac{\partial h}{\partial x} = \begin{bmatrix} -\delta_x/\sqrt q & -\delta_y/\sqrt q & 0 \\ \delta_y/q & -\delta_x/q & -1 \end{bmatrix}
$$

The two rows can be read one at a time. The range row is minus the unit vector towards the beacon. Moving towards the beacon shortens the range, and moving across the line to it changes nothing to first order. The bearing row is the perpendicular unit vector divided by the distance. A sideways step of one metre at 5 m therefore changes the bearing by 0.2 rad. The $-1$ in the heading column means that turning left makes every beacon appear further right. These rows are the directions a reading can correct. The Kalman update cannot move the estimate in a direction that $H$ does not see.

The sensor noise is $Q = \operatorname{diag}(\sigma_r^2, \sigma_b^2)$ with $\sigma_r$ = 8 cm and $\sigma_b$ = 0.03 rad (1.7°) at the default beacon-noise setting. Readings arrive every 0.2 s (every fourth tick) from beacons within {{live:lmRange}} m and in line of sight.

## 4. The Kalman update, derived

Suppose the belief before the reading is $\mathcal N(\mu, \Sigma)$ and the reading is $z = h(x) + \nu$ with $\nu \sim \mathcal N(0, Q)$. Linearize $h$ about $\mu$, so that $h(x) \approx h(\mu) + H(x - \mu)$. The predicted reading is then $\hat z = h(\mu)$. The innovation $\nu = z - \hat z \approx H(x - \mu) + \text{noise}$ is a linear function of the unknown error $x - \mu$, whose covariance is $\Sigma$, plus the sensor noise. So the innovation has covariance

$$
S = H\,\Sigma\,H^{\mathsf T} + Q
$$

This is the pose uncertainty seen through the measurement, plus the sensor noise. The error and the innovation are jointly Gaussian, with cross-covariance $\Sigma H^{\mathsf T}$. Conditioning one Gaussian on another is a standard result. The conditional mean shifts by (cross-covariance)(innovation covariance)$^{-1}$(innovation). The conditional covariance loses (cross-covariance)(innovation covariance)$^{-1}$(cross-covariance)$^{\mathsf T}$. Putting in the two covariances above gives the update:

$$
K = \Sigma H^{\mathsf T} S^{-1}, \qquad \mu \leftarrow \mu + K\nu, \qquad \Sigma \leftarrow \Sigma - K S K^{\mathsf T} = (I - KH)\,\Sigma
$$

These three formulas are the whole update. Nothing in $K$ is tuned. It is the ratio of the part of the surprise the state could explain, $\Sigma H^{\mathsf T}$, to the total spread of the surprise, $S$. Two limits show how it behaves. A perfect sensor, $Q \to 0$, gives $K = \Sigma H^{\mathsf T}(H\Sigma H^{\mathsf T})^{-1}$. That gain moves the estimate until $h(\mu)$ equals $z$ in the measured directions. A useless sensor, $Q \to \infty$, gives $K \to 0$, and the estimate does not move. The same formula also comes out of minimizing the trace of the posterior covariance over all linear updates $\mu + K\nu$. Older textbooks derive the "optimal gain" that way. The Bayesian derivation above is shorter and reaches the same result.

**The Joseph form.** $(I - KH)\Sigma$ is algebraically correct but numerically fragile. It is the difference of two nearly equal matrices, and after many updates it can lose symmetry or become slightly indefinite. The same quantity can be written as a sum of two positive terms:

$$
\Sigma \leftarrow (I - KH)\,\Sigma\,(I - KH)^{\mathsf T} + K\,Q\,K^{\mathsf T}
$$

This form is exact for the optimal $K$ (expand it and the extra terms cancel), and it stays positive definite for any $K$. The EKF in this lab uses it. EKF-SLAM uses the short form and re-symmetrizes, because on the full map state the Joseph form costs $O(n^3)$.

**Several readings at once.** When $k$ beacons are visible, the lab applies $k$ updates in sequence, each with a 2 × 2 $S$, instead of one update with a $2k \times 2k$ $S$. For independent readings the two are equivalent to first order. The sequential version is in fact slightly better, because the second update linearizes about the once-corrected $\mu$. Each 2 × 2 matrix can be inverted by hand, so the EKF runs in microseconds.

[try: EKF on L3 | {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}]

## 5. Consistency: NEES and the 2σ band

The covariance is only useful if it matches the real error. To test it, measure the actual error $e = x_{\text{true}} - \mu$ in the units the filter itself proposes. If the filter is consistent, $e \sim \mathcal N(0, \Sigma)$, and the whitened error $\Sigma^{-1/2} e$ has three independent standard-normal components. Its squared length is

$$
\text{NEES} = e^{\mathsf T}\,\Sigma^{-1}\,e = \big\|\Sigma^{-1/2} e\big\|^2 \;\sim\; \chi^2_3
$$

This is chi-squared with three degrees of freedom. Its mean is 3, and 95 % of samples fall below 7.81. The lab computes NEES every fourth tick. The status strip shows the mean of the last 100 samples (20 s) and flags the filter as overconfident above 7.8. The average of 100 samples of a $\chi^2_3$ variable has a standard deviation of $\sqrt{6/100} \approx 0.25$. A steady reading of 5 is therefore already significant, and a reading of 10 cannot be put down to chance. The 2σ band on the Position error plot is the one-dimensional version of the test. Its half-width is $2\sqrt{\sigma_x^2 + \sigma_y^2}$, and the position error should stay under it about 95 % of the time if the two coordinates are independent. When they are correlated, it stays under slightly less often. So the band is a guide, and NEES is the actual test.

Anything the model lacks breaks consistency. Unmodelled bias is the usual case. The innovations stop being zero-mean, but $K$ still treats them as noise, and $\Sigma$ keeps shrinking as if every reading were fully informative. There are two repairs. The proper one is to model the bias: add a scale state to the filter, and the beacons then make it observable. The practical one is to inflate $M$ so that $\Sigma$ stays large enough to absorb the bias. Lesson 2's third experiment does that.

[try: EKF, bias ×3 | {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3},"tab":"loc","plot":"pos"}] [try: Bias ×3, assumed noise ×4 | {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3,"filtK":4},"tab":"loc","plot":"pos"}]

## 6. Data association and the gate

When readings do not say which beacon they came from, the filter has to decide. For a reading $z$ and a candidate beacon $j$, it has a predicted reading $\hat z_j$ and an innovation covariance $S_j$. The natural distance between reading and prediction is then the innovation measured in its own units:

$$
d_j^2 = \nu_j^{\mathsf T}\, S_j^{-1}\, \nu_j, \qquad \nu_j = z - \hat z_j
$$

This is the squared Mahalanobis distance. If $j$ is the right beacon and the filter is consistent, $\nu_j$ is zero-mean Gaussian with covariance $S_j$. Then $d_j^2 \sim \chi^2_2$, with two degrees of freedom, one per measured quantity. The 99 % point of $\chi^2_2$ is 9.21. The gate follows from that. Take the beacon with the smallest $d^2$ (the nearest neighbour), and use the reading only if $d^2 < 9.21$. Otherwise treat the reading as an outlier and discard it. A correct reading is then wrongly discarded 1 % of the time. The gate accepts that loss so that it can reject clutter (readings that match no real beacon).

The gate is also what makes a kidnapping fatal to a Gaussian filter. After the jump, every reading is many σ from its prediction and every $d^2$ is in the thousands. Every reading is rejected as an outlier, including the ones that would correct the estimate. The filter keeps predicting with the odometry, and its $\Sigma$ grows only at the odometry rate. It can take minutes before the gate opens wide enough for a reading to pass, and by then the association will probably be wrong. With known IDs there is no gate, and the EKF recovers slowly but steadily. Each reading moves the estimate by $K\nu$ with the same small $K$, so a 16 m error decays geometrically. In lesson 3's first experiment it falls by about a third every second. Without a gate, though, a filter has no defence against clutter. A real stack therefore keeps the gate and adds a way to recover. The particle filter's injection, in the next section, is one.

[try: Kidnap, EKF with known IDs | {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos","act":"kidnap"}] [try: Kidnap, EKF unlabeled | {"sim":true,"level":2,"set":{"loc":"ekf","assoc":"unknown"},"tab":"loc","plot":"pos","act":"kidnap"}]

## 7. The particle filter

**Importance sampling.** The particle filter represents the belief by $N$ poses $x^{[i]}$ with weights $w^{[i]}$ that sum to one. Any expectation is then approximated by $\sum_i w^{[i]} f(x^{[i]})$. The Bayes recursion becomes two concrete operations. The prediction moves each particle through the motion model with its own draw of odometry noise, $x^{[i]} \leftarrow g(x^{[i]}, u + \epsilon^{[i]})$. The particles are then a sample of $\overline{bel}$. The correction multiplies each weight by the likelihood of the reading at that particle,

$$
w^{[i]} \leftarrow w^{[i]}\; p(z \mid x^{[i]}), \qquad p(z \mid x) = \prod_{\text{readings}} \exp\!\left(-\tfrac12\left[\frac{(r - \hat r)^2}{\sigma_r^2} + \frac{(b - \hat b)^2}{\sigma_b^2}\right]\right)
$$

and then normalizes the weights. This is Bayes' rule applied to each sample. Particles that explain the reading well gain weight, and the others lose it. The lab keeps log-weights, so products become sums and nothing underflows. It adds a floor of $10^{-3}$ to each reading's likelihood, so that one bad reading cannot set a particle's weight to zero. With unlabeled beacons, it matches each reading to the beacon that fits it best as seen from that particle. This is nearest-neighbour association, done per particle rather than once for the whole filter. Because of it, the particle filter survives the kidnapping that defeats the EKF in section 6. A particle near the true pose finds the beacons that fit it, whatever the other particles do.

**Degeneracy and resampling.** Left alone, the weights collapse. After a few updates one particle holds nearly all the weight, and the rest are wasted. The effective sample size measures how far the collapse has gone:

$$
N_{\text{eff}} = \frac{1}{\sum_i \left(w^{[i]}\right)^2}
$$

It is $N$ when all weights are equal and 1 when one particle has all the weight. (With weights $w$ and $1-w$ on two particles, $N_{\text{eff}} = 1/(w^2 + (1-w)^2)$, between 1 and 2.) When $N_{\text{eff}} < N/2$ the lab resamples. It draws a new set of $N$ particles from the old one, each with probability proportional to its weight, and then sets all weights equal. Heavy particles are copied and light ones disappear. Drawing $N$ independent random numbers would add sampling noise of its own. Low-variance resampling instead draws one number $u \in [0, 1/N)$ and walks the cumulative weights at $u, u + 1/N, u + 2/N, \ldots$. A particle with weight $w$ is then copied either $\lfloor Nw \rfloor$ or $\lceil Nw \rceil$ times, never more or fewer. The update step runs only after the robot has moved 5 cm since the last one. Otherwise a robot standing still would resample the same readings over and over, and the set would collapse for no reason.

**Augmented MCL: noticing that the readings stopped fitting.** The filter keeps two running averages of the mean likelihood $\bar w$ per update, a fast one and a slow one:

$$
w_{\text{slow}} \leftarrow w_{\text{slow}} + 0.001\,(\bar w - w_{\text{slow}}), \qquad w_{\text{fast}} \leftarrow w_{\text{fast}} + 0.1\,(\bar w - w_{\text{fast}})
$$

The slow average remembers how well the readings normally fit, and the fast one follows the last few seconds. When the fast average drops well below the slow one, the readings have suddenly stopped fitting the particle set. Seen from inside the filter, that is how a kidnapping or a lost filter shows up. The lab then replaces a fraction $\min(0.25,\, 1 - w_{\text{fast}}/w_{\text{slow}})$ of the resampled particles with fresh ones. It does not scatter them uniformly. It draws each one from a current reading, which is called sensor-resetting. It picks a reading and a beacon, and places the particle at the reading's range from that beacon, in a random direction. Then it sets the particle's heading so that the bearing matches. Every injected particle agrees with at least one reading, so the next update sorts them quickly. Lesson 3's kidnap recovery and lesson 4's global localization both rely on this.

**The lidar against the map.** With a known map, the lidar gives a second likelihood. For 24 of the 120 beams, the lab places the beam's endpoint from the particle's pose and looks up the distance $d$ from it to the nearest occupied cell. It scores each beam as $\log(0.9\,e^{-d^2/2\sigma^2} + 0.05)$ with $\sigma$ = 0.2 m. This is a likelihood-field model, and it needs no ray tracing. The 0.05 floor keeps a beam the map cannot explain from being fatal. The sum over beams is multiplied by 0.4 before it enters the log-weight. This tempering matters. Treated as independent, 24 beams would give a likelihood so peaked that one particle would win every update, and the set would collapse onto noise. In lesson 4 the lidar is what finally breaks the warehouse's 180° symmetry. It does so slowly, because the map's asymmetries are small and can be seen only from some places.

**Estimate and covariance.** The reported pose is the weighted mean of the particles. The heading is averaged as a unit vector $(\sum w\cos\theta, \sum w\sin\theta)$, so that angles near ±π do not cancel. The reported $\Sigma$ is the weighted scatter about that mean. When the set holds two clusters, say the true pose and its mirror, the mean sits between them and $\Sigma$ is huge. That correctly says the filter does not know which cluster is right. The lost guard reads it to decide that the robot should stop and turn in place.

[try: Scatter the particles, unlabeled | {"sim":true,"level":4,"set":{"loc":"pf"},"tab":"loc","act":"scatter"}] [try: Scatter, known IDs | {"sim":true,"level":4,"set":{"loc":"pf","assoc":"known"},"tab":"loc","act":"scatter"}]

## 8. EKF-SLAM: the map joins the state

EKF-SLAM takes the beacon positions out of the filter's knowledge and appends them to its state:

$$
x = [\,x, y, \theta,\; m_{1x}, m_{1y},\; m_{2x}, m_{2y}, \ldots\,]^{\mathsf T}, \qquad P \text{ is } (3 + 2n) \times (3 + 2n)
$$

Everything in sections 2 to 4 still applies, with larger matrices. Three things are new.

**Prediction touches only the pose block.** Landmarks do not move, so the motion Jacobian is $G$ on the pose and the identity on the map. The prediction $P \leftarrow G P G^{\mathsf T} + V M V^{\mathsf T}$ (with the motion noise of §2) changes the 3 × 3 pose block. It multiplies the 3 × 2n cross-covariances by $G$, and it leaves the map block alone. The lab uses that sparsity. A dense multiply would cost $O(n^3)$ per tick.

**A new landmark inherits the pose uncertainty.** The first reading $(r, b)$ of a beacon places it by the inverse measurement model $m = p + r\,[\cos(\theta + b), \sin(\theta + b)]$. Its covariance comes from the same linearization as in section 2. This time there are two Jacobians, one for the pose and one for the reading:

$$
J_x = \begin{bmatrix} 1 & 0 & -r\sin(\theta + b) \\ 0 & 1 & \phantom{-}r\cos(\theta + b) \end{bmatrix},
\quad
J_z = \begin{bmatrix} \cos(\theta + b) & -r\sin(\theta + b) \\ \sin(\theta + b) & \phantom{-}r\cos(\theta + b) \end{bmatrix}
$$

$$
P_{mm} = J_x P_{xx} J_x^{\mathsf T} + J_z Q J_z^{\mathsf T}, \qquad P_{mx} = J_x P_{xx}, \qquad P_{m,\text{others}} = J_x P_{x,\text{others}}
$$

The second and third pieces are what make this SLAM. The new landmark is placed from an uncertain pose, so its error is the pose error (through $J_x$) plus sensor noise. It is therefore correlated with the pose, and with every landmark the pose is correlated with. The map and the robot form one jointly uncertain object, rather than a set of independent points.

**Updates constrain relative positions.** The measurement Jacobian for landmark $j$ is the $H$ of section 3 with two extra nonzero columns. They are the derivatives with respect to $m_j$, and they are the negatives of the position columns: $\partial h/\partial m = -\partial h/\partial p$. A reading therefore says nothing about where the pose and the landmark are in absolute terms. It says only where they are relative to each other. Between observations of old landmarks, the absolute error of the whole structure drifts like dead reckoning (section 2). The correlations are what make loop closure work. Suppose the robot re-observes a landmark it mapped early, while its pose was still certain. The innovation is applied through $K = P H^{\mathsf T} S^{-1}$ to every state the landmark is correlated with. That is the pose, and through the pose, every landmark placed since. One reading moves the whole map. With a longer beacon range, distant parts of the route share more landmarks. Loop closures then happen all the time and the drift stays bounded, as lesson 5's second experiment shows.

The cost lies in the dense $P$. Each update is $O(n^2)$ in the number of landmarks, and the memory is $O(n^2)$ too. That is fine for a dozen beacons. Once maps grew to thousands of features, real systems moved to sparse graph formulations for this reason.

[try: EKF-SLAM, range 7 m | {"sim":true,"level":2,"set":{"loc":"slam"},"tab":"loc","plot":"pos"}] [try: Range 12 m | {"sim":true,"level":2,"set":{"loc":"slam","lmRange":12},"tab":"loc","plot":"pos"}]

## 9. Heading sensors: a gyro in the motion model

The filter stays the same when the turn rate comes from a yaw-rate gyro instead of the wheel encoders. The input is still $u = (v, \omega)$, and the prediction is still the arc model of §2 with its Jacobians $G$ and $V$. Only the input noise changes. The wheels' turn rate is the difference of two wheel speeds, so its noise is large and it carries the wheel-calibration bias. The gyro reads the body's yaw rate directly. It has a small noise of its own and does not depend on the wheel geometry. In the lab the gyro's reading is

$$
\omega_g = \omega + b + n, \qquad n \sim \mathcal N(0, \sigma_g^2), \qquad \sigma_g = 0.3°/\mathrm s \text{ per reading}
$$

The wheels give $\sigma_\omega = 0.2|\omega| + 0.1|v| + 0.02$ rad/s, about $5.7°/\mathrm s$ at 0.8 m/s, plus their bias of $0.01\,v$ rad/s. With the gyro, $M = \mathrm{diag}(\sigma_v^2, \sigma_g^2)$, and the heading's share of $V M V^{\mathsf T}$ shrinks by $(\sigma_\omega/\sigma_g)^2$. At the cruise speed that is about 360 times.

**The random walk.** Each tick adds $\sigma_g^2 \Delta t^2$ to the heading variance (the $b$ term of §2), so after $t$ seconds of noise alone

$$
\sigma_\theta^2(t) = \sigma_g^2\,\Delta t\, t,
$$

This is a random walk, and the standard deviation grows with $\sqrt t$. With $\sigma_g = 0.3°/\mathrm s$ and $\Delta t = 0.05$ s, that is $0.5°$ after a minute, against $10°$ for the wheels' noise alone. The wheels' bias adds $0.46°/\mathrm s$ on top of that, and the heading error it causes grows in a straight line with time.

**A constant bias.** A gyro bias $b$ that the filter does not know about integrates once into the heading and twice into the sideways position:

$$
\theta_{err}(t) = b\,t, \qquad e_\perp(t) \approx \int_0^t v\,\theta_{err}\,\mathrm d\tau = \tfrac12\, v\, b\, t^2.
$$

At $0.5°/\mathrm s$ and 0.8 m/s, that is $30°$ and 12.6 m after a minute of straight driving. Meanwhile $\Sigma$ grows only by the noise term, so the filter is overconfident by the ratio of the two. That ratio is what drives NEES so high in the lesson. On a real MEMS gyro the bias is a few tenths of a degree per second, and it changes with temperature. In every IMU-based dead reckoning, the bias is a larger error than the noise.

**The zero-velocity update.** While the robot stands still, the true yaw rate is zero. Every reading is then $b + n$, and the mean of $N$ readings estimates $b$ with standard deviation $\sigma_g / \sqrt N$. The lab uses an exponential average,

$$
\hat b \leftarrow \hat b + \alpha(\omega_g - \hat b), \qquad \alpha = 0.1,
$$

which settles during the 2 s hold at the start of a run. The hold gives 40 readings, and the fraction of the bias left over is $0.9^{40} \approx 1.5\,\%$. The average reduces the noise by a factor $\sqrt{\alpha/(2-\alpha)} \approx 0.23$, so the estimate is good to about $0.07°/\mathrm s$. The estimate is subtracted from every reading and refreshed at every later stop. When stops are rare, the alternative is to make $b$ a fourth state of the filter. The beacons then observe it through the heading, and the update of §4 corrects it like everything else. Both approaches are standard. The lab keeps the three-state filter and uses the stops.

## 10. Scan matching: the lidar as a position sensor

**The cost.** With a prior map, the map's distance field $d(\cdot)$ gives every point in the world its distance to the nearest wall. It is the same transform the costmap uses (chapter 3 §3). A scan is a set of hits $p_i$ in the body frame. Placed in the world at a pose $\xi = (x, y, \theta)$, they land at $T_\xi p_i = R(\theta)\,p_i + (x, y)$. If $\xi$ is right, the hits lie on walls and $d(T_\xi p_i) = 0$. If it is wrong, they lie beside the walls. Scan matching minimizes
$$
F(\xi) = \sum_i d(T_\xi p_i)^2
$$
over the pose. Hits with $d > 0.5$ m are left out. They are people, or beams that hit something the map does not have, and they would drag a least-squares fit away from the walls.

**Gauss–Newton.** The lab reads $d$ from the grid by bilinear interpolation, which also gives its gradient $\nabla d = (d_x, d_y)$. By the chain rule, the residual's derivative with respect to the pose is one row per hit,
$$
J_i = \nabla d\,\frac{\partial T_\xi p_i}{\partial \xi} = \begin{bmatrix} d_x & d_y & d_x(-s\,p_x - c\,p_y) + d_y(c\,p_x - s\,p_y)\end{bmatrix}, \quad c = \cos\theta,\ s = \sin\theta,
$$
and the linearized problem has the normal equations $H\,\delta = -b$, with $H = \sum_i J_i^\top J_i$ and $b = \sum_i J_i^\top d_i$. The step $\delta$ is added to $\xi$. The loop repeats until the step is under a millimetre and a milliradian, for ten steps at most. The method drops the second derivatives of $d$, and that makes it Gauss–Newton rather than Newton. Near a fit they hardly matter. Sixty hits and ten steps come to about a thousand field reads, which take well under a millisecond.

**The covariance.** For a least-squares fit, the estimate's covariance is $s^2 H^{-1}$, with $s^2 = \sum d_i^2 / (n - 3)$ the residual variance. The lab corrects it twice before using it. Neighbouring beams hit the same wall, so the $n$ residuals are not independent, and the covariance is inflated by a factor of four. No fit is better than the map's cells, so the covariance is floored at $(5\,\text{cm})^2$ in position and $(1°)^2$ in heading. The structure of $H$ shows what the fit can and cannot tell. Its eigenvectors are the directions in which moving the scan changes the cost most and least. In a long featureless corridor the along-corridor eigenvalue is near zero, and $H^{-1}$ is long in that direction. The fix then reports, correctly, that it knows where the robot is across the corridor but not where along it.

**The fusion.** The matched pose is a measurement of the whole state with $H = I$. The innovation is $\nu = \xi_\text{fix} - \mu$ (heading wrapped), $S = \Sigma + \Sigma_\text{fix}$, and the gain is $K = \Sigma S^{-1}$. This is the update of §4, with the Joseph form. The gate is $\nu^\top S^{-1}\nu < \chi^2_3(99\,\%) = 11.3$. Two further rules apply. A match is fused only once the robot has moved 5 cm or turned 6° since the last fused one. The same scan from the same place is not new evidence. A fit with a residual over 12 cm, or with fewer than 60 % of its hits near any wall, has matched onto the wrong walls, and it is dropped.

**The double counting.** The matcher starts from the estimate, and its result corrects that same estimate. Part of the fix is therefore the prior, and fusing the fix at full weight counts the prior twice. Because of this, the NEES of the lidar-only runs below sits near 6 rather than 3, even with the inflation. A sound version would start the match from the odometry-only prediction. Another would treat matches as constraints between poses in a smoother (chapter 2 §8's EKF-SLAM is the filter form of that, and pose-graph SLAM its sparse form).

**Aliasing.** Gauss–Newton converges to the nearest minimum of $F$. On this map the basin around the right minimum is about half a metre and 20° wide. From an estimate inside it, the fit finds the right pose. After a kidnap, the nearest minimum is whichever shelves happen to be near the old estimate. In a warehouse of identical shelves, those fit the new scan as well as the right ones would. The residual is small, the gate lets the match through, and the filter is wrong while reporting high confidence. A single scan cannot show the mistake. Detecting it needs a second hypothesis (the particle filter's injected samples, §7), a sensor that sees past the shelves (the beacons), or a check over a sequence of scans.

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

On L2's aisles, with odometry noise and bias ×1 and no beacons, the error is 0.04 m RMS and the robot reaches all four goals.

[try: Lidar only: every beacon off | {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos"}] [try: Kidnapped, lidar only | {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}]

## 11. Pose-graph SLAM: the map as a set of constraints

**The graph.** A node is a keyframe pose $x_i = (x, y, \theta)_i$. An edge $(i, j, z_{ij}, \Omega_{ij})$ is a measurement of pose $j$ in the frame of pose $i$, with information matrix $\Omega_{ij}$ (the inverse of its covariance). There are two kinds of edge. An odometry edge joins each keyframe to the next. A loop-closure edge joins a keyframe to an earlier one that saw the same place. The maximum-likelihood poses minimize
$$
F(x) = \sum_{ij} e_{ij}^\top \Omega_{ij}\, e_{ij}, \qquad e_{ij} = z_{ij}^{-1} \oplus \left(x_i^{-1} \oplus x_j\right),
$$
Each error term is the mismatch between what the chain says about $j$ relative to $i$ and what the edge measured. Here $\oplus$ is the pose composition, and the heading is wrapped.

**The Jacobians.** With $\Delta = x_i^{-1} \oplus x_j$ (so $\Delta_t = R_i^\top (t_j - t_i)$, $\Delta_\theta = \theta_j - \theta_i$) and $e = (R_z^\top(\Delta_t - z_t),\ \Delta_\theta - z_\theta)$,
$$
B_{ij} = \frac{\partial e}{\partial x_j} = \begin{bmatrix} R_z^\top R_i^\top & 0 \\ 0 & 1 \end{bmatrix}, \qquad
A_{ij} = \frac{\partial e}{\partial x_i} = \begin{bmatrix} -R_z^\top R_i^\top & R_z^\top \dfrac{\partial R_i^\top}{\partial \theta_i}(t_j - t_i) \\ 0 & -1 \end{bmatrix},
$$
with $\partial R^\top/\partial\theta = \begin{bmatrix} -s & c \\ -c & -s\end{bmatrix}$. Gauss–Newton linearizes each error as $e_{ij}(x + \delta) \approx e_{ij} + A_{ij}\delta_i + B_{ij}\delta_j$. The normal equations $H\delta = -b$ are then built edge by edge. Each edge adds $A^\top\Omega A$ into block $(i,i)$, $A^\top\Omega B$ into $(i,j)$ and its transpose, and $B^\top\Omega B$ into $(j,j)$. It also adds $A^\top\Omega e$ and $B^\top\Omega e$ into $b_i$ and $b_j$. Every edge touches two poses, so $H$ has non-zero blocks only where there are edges, and it is sparse. Real solvers (g2o, Ceres, GTSAM) use that sparsity to handle tens of thousands of poses. The lab's graphs have a few hundred, and a dense Cholesky factorization takes a tenth of a second at two hundred keyframes.

**The gauge.** Shifting and turning every pose together changes no edge, so $H$ has a three-dimensional null space. One pose has to be fixed. The lab adds a prior of $10^6$ on the first pose's three unknowns, which has the same effect as removing them. The map is then expressed in the first keyframe's frame. It is consistent within itself, but not aligned to anything outside it.

**The marginal covariance.** After an optimization, the covariance of the last pose is the corresponding $3\times 3$ block of $H^{-1}$. The lab gets it with three solves against the factored $H$, one per unit vector. Between optimizations the covariance grows with the odometry edges. They are composed the way §2 composes an uncertain motion onto an uncertain pose, so the keyframe's heading uncertainty swings the leg sideways. The current estimate is the last keyframe composed with the odometry since then. Its covariance is that marginal plus the odometry's, and the ellipse on the map draws it.

**Two levels.** The matcher of §10 is the local level. Before a keyframe's odometry edge is written, its scan is aligned to the map the keyframes have built so far. That map is a hit map: the cells in which the earlier scans' beams ended. Free-space updates never carve it, because carving erodes walls that have been seen only a few times. The result of the alignment is fused with the odometry as a Kalman update. Along a corridor the fit cannot pin down the position along it, and the odometry still counts there. The edge then carries the matched motion, with the fit's information. The graph is the global level. When a keyframe comes within reach of one at least ten keyframes back, ICP (iterative closest point, below) aligns its scan to that earlier one. It starts from the chain's own guess. The reach grows with the pose uncertainty. A fit with most of its hits paired within 30 cm and a small residual becomes a closure. Closures are batched into one optimization per second. The optimization runs at once if a closure moved a pose by more than 0.3 m. After it, the maps (the hit map and the planning grid) are rebuilt from the scans at the new poses. Each scan stays attached to its keyframe by the relative pose it had.

**ICP.** The lab's ICP is the point-to-point version. It pairs every source point with its nearest destination point within half a metre. Then it computes the best rigid transform of the pairs in closed form. From the centroids $\bar p$ and $\bar q$ and the $2\times 2$ cross-covariance $M = \sum (q - \bar q)(p - \bar p)^\top$, the rotation is $\theta = \operatorname{atan2}(M_{10} - M_{01},\ M_{00} + M_{11})$ and the translation $t = \bar q - R\bar p$. It repeats until the transform stops moving. ICP converges to the nearest fit from where it starts, so a closure needs a guess within its reach. When the chain's guess is far off, the lab tries a grid of starts around it and accepts only a stricter fit.

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

"Worst" is the largest error at any tick. On a building this size, the scan-to-map level does the work. With the gyro, the closures add nothing these numbers can show. Loop closures need odometry good enough to put the chain's guess within ICP's reach. With the gyro, the lidar alone builds a map that agrees with the floor to within a percentage point of the beacon EKF's map.

[try: Pose-graph SLAM on wheel odometry | {"sim":true,"level":3,"set":{"loc":"pgslam"},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}] [try: Both levels, with the gyro | {"sim":true,"level":3,"set":{"loc":"pgslam","gyro":true},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}]

## 12. GNSS: when the noise is not white

Every update so far assumed that the measurement noise is **white**. Each reading's error is drawn fresh, independent of the last one: $\mathrm E[v_k v_j^{\mathsf T}] = Q\,\delta_{kj}$. Under that assumption the filter can treat ten readings as ten times the evidence. A GNSS receiver breaks the assumption. Most of its error comes from the atmosphere, the satellite orbits and clocks, and the reflections around the antenna. All of these change over tens of seconds to minutes, much more slowly than the time between one fix and the next.

**The lab's receiver.** A fix at $t_k$ is the true position plus two errors per axis:

$$
z_k = p_k + b_k + w_k, \qquad w_k \sim \mathcal N(0, \sigma_w^2)
$$

$$
b_{k+1} = \phi\, b_k + \sigma_b\sqrt{1-\phi^2}\;\eta_k, \qquad \phi = e^{-\Delta t/\tau}, \qquad \eta_k \sim \mathcal N(0, 1)
$$

The bias $b$ is a first-order **Gauss–Markov** process. It is stationary with variance $\sigma_b^2$ (the factor $\sqrt{1-\phi^2}$ keeps it there), and it is correlated in time as

$$
\mathrm E[b_k\, b_{k+m}] = \sigma_b^2\, \phi^{m} = \sigma_b^2\, e^{-m\Delta t/\tau}.
$$

In continuous time it is $\dot b = -b/\tau + n(t)$ with white $n$ of spectral density $2\sigma_b^2/\tau$. That is a random walk pulled back towards zero with time constant $\tau$. The settings here are $\sigma_w$ = {{live:gnssSig}} m, $\sigma_b$ = {{live:gnssBias}} m and $\tau$ = {{live:gnssTau}} s, at {{live:gnssHz}} fixes per second. Two consecutive fixes therefore share their bias with correlation $\phi$ = {{live:gnssPhi}}. The receiver reports $\sigma_{rep} = \sqrt{\sigma_w^2 + \sigma_b^2}$ = {{live:gnssRep}} m per axis. That is the true spread of one fix in the open, and it says nothing about the correlation.

**What the plain filter does with it.** Suppose the filter takes the fixes as white, with $Q = \sigma_{rep}^2 I$. This is the update of §4 with $H = [I_2\; 0]$, since the fix measures $x$ and $y$ directly. Standing still for $N$ fixes, the filter's position variance falls as $\sigma_{rep}^2/N$, the variance of an average of independent readings. The average of the actual errors has variance

$$
\mathrm{Var}\Big(\tfrac1N \sum_k (b_k + w_k)\Big) = \frac{\sigma_w^2}{N} + \frac{\sigma_b^2}{N^2}\sum_{i,j} \phi^{|i-j|}, \qquad \sum_{i,j}\phi^{|i-j|} = N + 2\sum_{m=1}^{N-1}(N-m)\,\phi^m .
$$

For $N\Delta t \ll \tau$ the double sum is about $N^2$, and the bias term does not average down at all. For $N\Delta t \gg \tau$ it is about $N(1+\phi)/(1-\phi) \approx N\,2\tau/\Delta t$. A span of $T$ seconds then holds only about $T/2\tau$ independent samples of the bias. Over a minute of fixes the filter claims {{live:gnssClaim}} m, and the truth is {{live:gnssTrue}} m. With the defaults, the filter's variance on each axis is about 80 times smaller than it should be. NEES on the two position axes alone is then near 160, where 2 is expected. When the robot is moving, the odometry keeps the variance from collapsing all the way. The fixes still pull the estimate onto $p + b$, though. That point wanders by a metre over a minute, while the band shrinks to a few tenths of a metre. The lesson's second experiment shows this: NEES in the hundreds, and the error inside the 2σ band a tenth of the time.

**The fix: put the bias in the state.** An error with structure can be modelled. Augment the state with the bias, $x_a = (x, y, \theta, b_x, b_y)$, and let the filter estimate it:

$$
F_a = \begin{bmatrix} G & 0 \\ 0 & I_2 \end{bmatrix}, \qquad R_a = \begin{bmatrix} V M V^{\mathsf T} & 0 \\ 0 & q\,\Delta t\, I_2 \end{bmatrix}
$$

$$
H_a = \begin{bmatrix} I_2 & 0 & I_2 \end{bmatrix}, \qquad Q = \sigma_w^2 I_2 .
$$

The bias is modelled as a random walk with $q = 2\sigma_b^2/\tau$ = {{live:gnssQ}} m²/s. Over short times this matches the Gauss–Markov process ($\mathrm{Var}(b_{t+\Delta} - b_t) = 2\sigma_b^2(1 - e^{-\Delta/\tau}) \approx 2\sigma_b^2 \Delta/\tau$), and over long times it is more cautious. $Q$ now holds only the white part, which is the reported $\sigma_{rep}^2$ less the $\sigma_b^2$ the state carries. Write the covariance in blocks as $P_a = \begin{bmatrix} P & C \\ C^{\mathsf T} & B\end{bmatrix}$, with $C$ the 3×2 cross-covariance of pose and bias. The update is then the §4 update with

$$
\nu = z - (\hat p + \hat b), \qquad S = P_{pp} + C_p + C_p^{\mathsf T} + B + Q
$$

$$
K = \begin{bmatrix} P_{:,p} + C \\ C_p^{\mathsf T} + B \end{bmatrix} S^{-1}
$$

where $P_{pp}$ is the 2×2 position block, $P_{:,p}$ the first two columns of $P$ and $C_p$ the first two rows of $C$. The prediction moves the cross-covariance with the pose, $C \leftarrow G\,C$, and grows $B$ by $q\Delta t$. In the lab's runs, the filter that carries the bias stays consistent: NEES is at most 1.9 at seed 7, against 186 for the plain filter. Its band widens to a metre and a half, and the error stays inside it.

**What the state cannot do.** The fixes see only the sum $p + b$. How that sum splits between position and bias depends on what else the filter knows. At first that is the start pose, and later the odometry. The odometry lets the position drift by its own random walk while the bias drifts by its own. So the band widens with time instead of settling. How much the error itself shrinks depends on the run. It fell from 1.64 m RMS to 0.56 m at seed 7 and from 1.36 to 0.73 m at seed 11. At seed 3 it grew from 1.38 to 1.55 m, though it stayed inside its band. Another position source makes the bias observable. Every beacon fix moves $\hat b$ through the cross-covariance, $K_b = (H C)^{\mathsf T} S^{-1}$. A GNSS/INS calibrates its receiver in the same way, against any better source it has. The random walk is a deliberate choice. The exact Gauss–Markov state bounds $B$ at $\sigma_b^2$, which makes the gate tighter. In the lab's runs that version rejected more fixes and lost track at one seed of three (NEES above 100 at seed 11).

**Multipath and the gate.** Next to a wall or a parked car, the receiver also picks up reflections. The lab models them as a jump of 2 to 4 m, roughly away from the wall or car, held for 2 to 6 s, with extra noise. The reported σ does not change. A jump is neither white nor slow, so neither noise model covers it. The gate of §6 ($\chi^2_2$, 9.21) catches the worst of them. Along the parked cars the gate rejects 15 to 21 of the first 40 fixes at seeds 3, 7 and 11. When every fix has been rejected for 10 s, the filter is trapped as it is after a kidnapping (§6). The lab then restarts it from the fixes. The position moves by the mean innovation of the last six fixes. The heading is taken from their track, if they lie on a line and match the distance the odometry drove. Beside the cars this restart lands on reflected fixes, and NEES leaves the band.

| Run on L6, 120 s, seed 7 | RMS error | Worst | NEES max | Inside 2σ | NEES max, seeds 3 / 11 |
| --- | --- | --- | --- | --- | --- |
| Dead reckoning, odometry noise ×1 | 1.45 m | 3.21 m | 2.7 | 100 % | 3.3 / 1.4 |
| GNSS alone (odometry off) | 2.11 m | 3.54 m | 503 | 10 % | 2835 / 128 |
| GNSS and odometry, plain EKF | 1.64 m | 2.90 m | 186 | 11 % | 207 / 154 |
| … with the bias in the state | 0.56 m | 1.10 m | 1.9 | 100 % | 8.6 / 3.1 |
| … along the parked cars (multipath) | 1.93 m | 3.78 m | 127 | 59 % | 50 / 64 |
| … with outages, 50 % in 15 s spells | 1.23 m | 2.14 m | 2.6 | 100 % | 3.7 / 2.3 |

The first four runs and the last drive laps of an 18 × 10 m rectangle on the lot's empty floor (Map → empty), where only the people get in the way. The multipath run drives the lane above the middle row of parked cars. "NEES max" is the largest value of the status strip's 20 s mean, read every 10 s. The beacons are off in all the runs.

**What the model leaves out.** The first thing is satellite geometry. A real fix is worse when the visible satellites bunch in one part of the sky (the dilution of precision, DOP), and better when more of them are visible. The second is the sky itself. Next to a wall a real receiver loses satellites as well as picking up reflections. A 2D world has no sky, so the lab models the effect with distance instead. The third is the receiver's clock and the atmosphere, which are where the slow bias comes from. The fourth is carrier phase and RTK. With a base station nearby, a receiver that tracks the carrier's phase is good to centimetres, and the error model is entirely different. The last is the receiver's own filter. It smooths the fixes, and so correlates them further, before the robot's filter sees them.

**When GNSS still beats beacons.** GNSS needs nothing installed, and it works anywhere under open sky. Its error does not grow with distance or with time. However long the robot drives, the next fix is within a few metres. Beacons give centimetres, but only where someone installed them and only within their range. Most systems use both: GNSS to find where on Earth the robot is, and the lidar, beacons or a map to find where it is in the lane.

[try: GNSS and odometry, plain | {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"loc","plot":"pos","panes":[["nees"]]}] [try: The bias in the state | {"sim":true,"level":5,"set":{"loc":"ekf","bOff":"all","gnss":true,"gnssAug":true,"odoK":1,"map":"empty","misLoop":true,"vehicles":false},"goals":[[3,13],[21,13],[21,3],[3,3]],"tab":"loc","plot":"pos","panes":[["nees"]]}]

## 13. What to carry into the next chapters

Three ideas from this chapter come back throughout the stack. The first is to linearize and then propagate the covariance through the Jacobian. The tracker's constant-velocity filter in chapter 3 uses the same machinery on a person's position and velocity. The second is to measure surprise in units of the expected spread. The Mahalanobis gate reappears in data association for tracks, and NEES is the test for any filter that reports a covariance. The third is to keep the uncertainty accurate, even when that makes it large. The costmap margins, the speed planner's growing radii and the lost guard all use $\Sigma$, and each of them is only as good as the covariance it is given.
