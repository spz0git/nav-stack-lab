group: loc
title: The Kalman update, and NEES as a lie detector

<p><b>Why this matters.</b> Localization stops drifting once the filter fuses the odometry with a sensor that sees the world. Any sensor that measures something fixed in the world can pull the estimate back. Here it measures the range and bearing to beacons on the walls. The question is how hard to pull. The reading is noisy and the estimate is uncertain, so the right correction weighs one against the other. The Kalman gain does that weighing. It is computed from the covariance, so the covariance has to be right. A filter that thinks it is more certain than it is will trust its sensors too little. It discounts the very readings that would correct it, and it drifts while reporting centimetre accuracy. NEES is the standard test for that failure. Real stacks are checked with it on logged drives with ground truth, and this lab shows it live.</p>
<p><b>The idea.</b> The filter repeats three steps: predict, compare, correct. Between readings it predicts with the odometry, as dead reckoning does, and $\Sigma$ grows. When a beacon reading $z$ arrives, the filter first works out from the current estimate what the reading <i>should</i> be, $\hat z$. The predicted range is the distance from the estimated position to the beacon. The predicted bearing is the angle to the beacon minus the estimated heading. The innovation $\nu = z - \hat z$ is the part of the reading the filter did not expect. If the estimate had no error at all, $\nu$ would be pure sensor noise. The update moves the estimate by a fraction of $\nu$, and that fraction is the Kalman gain. It is large when the estimate is uncertain and the sensor precise, and small when the filter is already confident. After the update $\Sigma$ shrinks, but only in the directions the reading informs. A range measurement constrains the position along the line to the beacon and says nothing across it. A bearing constrains the position across that line, and the heading as well. Several beacons in different directions pin everything down.</p>
<p><b>The math.</b> With $H$ the Jacobian of the measurement model (how the predicted reading changes when the pose changes) and $Q$ the sensor noise covariance:</p>
$$\begin{aligned} S &= H\Sigma H^\top + Q, & K &= \Sigma H^\top S^{-1} \\ \mu &\leftarrow \mu + K\nu, & \Sigma &\leftarrow (I - KH)\,\Sigma\,(I - KH)^\top + KQK^\top \end{aligned}$$
$$\text{NEES} = e^\top \Sigma^{-1} e \approx 3 \quad \text{for a consistent 3-state filter}$$
<p>The measurement model $h$ for one beacon at $(m_x, m_y)$ is the range from the estimated position and the bearing relative to the estimated heading, and $H$ is its Jacobian:</p>
$$\hat z = h(\mu) = \begin{bmatrix} \sqrt{q} \\ \operatorname{atan2}(\Delta y, \Delta x) - \theta \end{bmatrix} \qquad \Delta x = m_x - x, \quad \Delta y = m_y - y, \quad q = \Delta x^2 + \Delta y^2$$
$$H = \frac{\partial h}{\partial x} = \begin{bmatrix} -\Delta x/\sqrt{q} & -\Delta y/\sqrt{q} & 0 \\ \Delta y/q & -\Delta x/q & -1 \end{bmatrix} \qquad Q = \begin{bmatrix} \sigma_r^2 & 0 \\ 0 & \sigma_b^2 \end{bmatrix}$$
<p>The innovation is $\nu = z - \hat z$ with the bearing wrapped to $\pm\pi$. The prediction step between readings is the arc model of the previous lesson.</p>
<p><b>Where it comes from.</b> The error $x - \mu$ and the innovation $\nu$ are jointly Gaussian ($\nu \approx H(x - \mu)$ + noise). Conditioning the error on $\nu$ is then the standard Gaussian conditioning formula. It shifts the mean by (cross-covariance) $S^{-1}\nu$ and subtracts the part of the covariance that the innovation explains. $K$ is that cross-covariance divided by $S$, and nothing in it is tuned. <a class="chref" href="#notes=ch2/4-the-kalman-update-derived">Derivation: chapter 2 §4</a> · NEES as a $\chi^2$ variable: <a class="chref" href="#notes=ch2/5-consistency-nees-and-the-2-band">chapter 2 §5</a></p>
<p>$S$ is the innovation covariance. It says how spread out $\nu$ should be if the filter is right, and it is the pose uncertainty projected into measurement space, plus the sensor noise. $K$ divides the state's uncertainty by that total. It is the share of the surprise that the filter puts down to its own error, as against the sensor's. The $\Sigma$ update is in Joseph form. That is the long way of writing $(I - KH)\Sigma$, and it stays symmetric and positive definite in floating point, which the short form does not. NEES takes the true error $e$, which you have in a simulator or on a logged drive with ground truth. It measures that error in units of $\Sigma$ and sums over the three states. Each consistent state contributes about 1, so the expected value is 3, and 95 % of samples fall below 7.8. A steady average well above 3 means $\Sigma$ is too small for the real error, and the filter is claiming more confidence than it has.</p>
<p><b>What the lab does.</b> Beacons within 7 m and in line of sight report every 0.2 s (every fourth tick), with $\sigma_r = 8$ cm and $\sigma_b = 0.03$ rad (about 1.7°). On this level the readings carry known IDs, so the filter always knows which beacon a reading came from. There is no association problem yet. The odometry noise and bias are those of the previous lesson, and the <b>assumed motion noise</b> slider in the Localize tab scales the filter's $M$. The status strip shows NEES averaged over the last 20 s, and marks the filter overconfident above 7.8. All numbers below are at seed 7 over one mission of about 90 s.</p>

## Try: EKF
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: L3 with the EKF (the extended Kalman filter, which runs the update above on the linearized models), odometry noise ×1 and bias ×1, assumed noise ×1. Localize tab and the Position error plot.
See: The error stays mostly between 1 and 8 cm (RMS 4 cm, peaks near 14 cm), and the $\sigma$ reported by the filter is the same size. NEES stays between 2.5 and 5, and the error is inside the 2σ band about 97 % of the time. The robot reaches all five goals in about 90 s with no collisions. Dead reckoning on the same level reaches none. Press F (or ◎ on the map) to follow the robot, and watch the estimate. Between readings it slides with the odometry, and five times a second it jumps towards the truth as a reading arrives. The ellipse keeps the same rhythm: it grows for three ticks and collapses on the fourth.
Shows: This is a healthy filter. The small ×1 bias is still there. A beacon fix every 0.2 s corrects what the bias adds up in 0.2 s, which is far below the sensor noise, so the bias never shows. Look at what consistency looks like in the plot. The error pokes out of the band about one time in twenty, as it should.
Predict: With a beacon fix every 0.2 s on L3, how large will the EKF's position error be during the run?
- About half a metre
- A few centimetres
- Over a metre, like dead reckoning
Answer: 1

## Try: EKF, odometry bias ×3
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3},"tab":"loc","plot":"pos"}
Setup: The same filter with the calibration bias at ×3 (Sensors tab, Odometry). The speed reads 6 % high, and the turn rate carries an offset of 0.03 rad/s per m/s. The filter is not told.
See: The pose error is still small, 2 to 20 cm (peaks near 30 cm), because the beacons keep correcting it. But NEES is 6 to 19 whenever the robot is moving, and the status strip flags the filter as overconfident for most of the drive. The error leaves the 2σ band about half the time while driving. The mission completes near 90 s and the robot stops. NEES then falls back to 2 to 5 within about 12 s, once the drive has dropped out of the 20 s window.
Shows: This is what an unmodelled bias usually looks like. $\Sigma$ shrinks as if the odometry were unbiased, so the gain discounts the innovations. The innovations are now a steady pull in one direction instead of zero-mean noise: the filter keeps believing it went a little farther and turned a little more than it did. The error is small only because the beacons are frequent and precise. With a landmark every 50 m instead of every 0.2 s, the same bias would give an error of metres, and the filter would still claim centimetres. NEES drops when the robot stops because the bias is proportional to speed. With no motion there is no bias, and the filter's covariance matches its error again.
Predict: The calibration bias is tripled and the filter is not told. What does NEES do?
- Stays near 3: the beacons correct the bias before it accumulates
- Rises above 7.8 and the error grows to metres
- Rises well above 7.8 while driving, though the error stays small
Answer: 2

## Try: Bias ×3, assumed noise ×4
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3,"filtK":4},"tab":"loc","plot":"pos"}
Setup: Bias ×3 as before, and the filter's assumed motion noise at ×4 (Localize tab), so its uncertainty grows four times faster between readings.
See: NEES comes down to about 2 while driving and never goes above 3.5. The error is inside the band 99 % of the time. The pose error is a little smaller than in the previous run: mostly 1 to 6 cm, and 7 cm RMS while driving against 11 cm. The ellipse is visibly larger between readings and shrinks further at each one.
Shows: Inflating the process noise is the standard practical fix, and it is most of what "tuning" a deployed filter means. (The process noise is $M$ here; many texts call it $Q$.) The extra assumed noise stands in for the bias that the model lacks. It works because it makes $\Sigma$ large enough between readings for the gain to trust the beacons more, and that also makes the error smaller. The cost comes later. A filter that assumes more noise between fixes loses confidence faster during a beacon outage. That is correct, but the planner has to live with it. Once the filter starts gating readings, it will also accept readings that disagree more with its prediction, which is the next lesson's problem. A bias state in the filter would fix the cause instead of the symptom.
Predict: Keeping the ×3 bias but raising the assumed motion noise to ×4, what happens to the position error?
- It gets a little smaller than with ×1 assumed noise
- It grows: the filter trusts its odometry less and wanders
- It stays the same; only NEES changes
Answer: 0

## Code: ekfUpdate, one beacon reading
snippet: ekf-update
focus: const K = [ … S.est = {x: e.x + K[0]
example: loc/ekf
Note: The marked lines are the gain $K = PH^\top S^{-1}$ and the state correction $x + K\nu$. Everything above them builds $H$, $S$ and the innovation $\nu$ for one reading. The Joseph form below them keeps $\Sigma$ symmetric. Edit and run loads the EKF example, which has the same update in plain $3 \times 3$ arithmetic. Double sr (the assumed range noise) and watch NEES fall below 1.

## Think about
Q: Why is the expected NEES 3, and not 1 or 9?
A: $\Sigma^{-1}$ whitens the error. If the filter is consistent, $\Sigma^{-1/2} e$ has three components that are each standard normal. The sum of three squared standard normals is $\chi^2$ with three degrees of freedom, and its mean is 3. A check on the 2-D position alone would expect 2, and a track with position and velocity would expect 4.
Q: Overconfident and underconfident are both inconsistent. Which is more dangerous downstream?
A: Overconfident. An overconfident filter rejects or discounts the measurements that would correct it, so the error grows while the reported uncertainty does not. The planner then plans with margins that are too small, around a pose that is wrong. An underconfident filter wastes information and makes the planner over-cautious. That costs performance, but it does not make the robot less safe. For this reason most practitioners tune towards slight underconfidence.
Q: In the second experiment the error stayed around 30 cm at worst. Why worry about NEES at all if the pose is that good?
A: The pose is good only because there is a beacon fix every 0.2 s, and that will not always be so. NEES measures the filter itself, in any scenario. Put the same filter where fixes are sparser, where an outage lasts longer, or where a reading is matched to the wrong beacon, and it will fail. A high NEES on an easy log warns you before that happens.

## Check yourself
Q: The true error is 0.3 m in x, 0.4 m in y and zero in heading, and the filter reports $\Sigma = \operatorname{diag}(0.1^2, 0.1^2, \sigma_\theta^2)$ with no correlations. What is NEES?
Answer: 25
Tolerance: 0.5
Unit: 
How: $\text{NEES} = e^\top\Sigma^{-1}e = (0.3/0.1)^2 + (0.4/0.1)^2 + 0 = 9 + 16 = 25$. That is far above the 7.8 flag.
