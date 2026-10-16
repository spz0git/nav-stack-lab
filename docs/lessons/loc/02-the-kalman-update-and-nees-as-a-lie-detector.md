group: loc
title: The Kalman update, and NEES as a lie detector

<p><b>Why this matters.</b> Fusion is where localization stops drifting. Any sensor that measures something fixed in the world, here the range and bearing to beacons on the walls, can pull the estimate back, and the whole question is how hard to pull: a reading is noisy, the estimate is uncertain, and the right correction weighs one against the other. The Kalman gain is that weighing. It is computed from the covariance, which is why the covariance has to be right: a filter that thinks it is more certain than it is will under-trust its sensors, discount exactly the readings that would correct it, and drift while reporting centimetre accuracy. NEES is the standard test for that failure. It is how real stacks are checked on logged drives with ground truth, and it is a number this lab shows live.</p>
<p><b>The idea.</b> The filter runs a loop of predict, compare, correct. Between readings it predicts with the odometry, exactly as dead reckoning does, and Σ grows. When a beacon reading <i>z</i> arrives it first predicts what the reading <i>should</i> be from the current estimate, <i>ẑ</i>: the range is the distance from the estimated position to the beacon, the bearing is the angle to it minus the estimated heading. The innovation ν = <i>z</i> − <i>ẑ</i> is the part of the reading the filter did not expect. If the filter were exactly right, ν would be pure sensor noise. The update moves the estimate by a fraction of ν, and the fraction is the Kalman gain: large when the estimate is uncertain and the sensor precise, small when the filter is already confident. After the update Σ shrinks, but only in the directions the reading informs. A range measurement constrains the position along the line to the beacon and says nothing across it; a bearing constrains the position across that line and the heading. Several beacons from different directions pin everything down.</p>
<p><b>The math.</b> With <i>H</i> the Jacobian of the measurement model (how the predicted reading changes when the pose changes) and <i>Q</i> the sensor noise covariance:</p>
<div class="eq">S = HΣHᵀ + Q,   K = ΣHᵀS⁻¹
μ ← μ + Kν,   Σ ← (I−KH)Σ(I−KH)ᵀ + KQKᵀ
NEES = eᵀΣ⁻¹e ≈ 3 for a consistent 3-state filter
ẑ = h(μ) = [√q,  atan2(Δy, Δx) − θ],   Δx = m_x − x,  Δy = m_y − y,  q = Δx² + Δy²
H = ∂h/∂x = [−Δx/√q  −Δy/√q  0;  Δy/q  −Δx/q  −1],   Q = diag(σ_r², σ_b²),   ν = z − ẑ with the bearing wrapped to ±π</div>
<p>The last two lines are the measurement model <i>h</i> for one beacon at (<i>m</i><sub>x</sub>, <i>m</i><sub>y</sub>): the range from the estimated position and the bearing relative to the estimated heading, with <i>H</i> its Jacobian. The prediction step between readings is the arc model of the previous lesson.</p>
<p><b>Where it comes from.</b> The error <i>x</i> − μ and the innovation ν are jointly Gaussian (ν ≈ <i>H</i>(<i>x</i> − μ) + noise), so conditioning the error on ν is the standard Gaussian conditioning formula: shift the mean by (cross-covariance)(<i>S</i>)⁻¹ν and subtract the explained covariance. <i>K</i> is that cross-covariance over <i>S</i>; nothing in it is tuned. <a class="chref" href="#notes=ch2/4-the-kalman-update-derived">Derivation: chapter 2 §4</a> · NEES as a χ² variable: <a class="chref" href="#notes=ch2/5-consistency-nees-and-the-2-band">chapter 2 §5</a></p>
<p><i>S</i> is the innovation covariance: how spread out ν should be if the filter is right, the pose uncertainty projected into measurement space plus the sensor noise. <i>K</i> divides the state's uncertainty by that total, so it is literally the ratio "how much of this surprise is my fault". The Σ update is in Joseph form, the long way of writing (<i>I</i> − <i>KH</i>)Σ, which stays symmetric and positive definite in floating point; the short form does not. NEES takes the true error <i>e</i> (available in a simulator, or on a logged drive with ground truth), measures it in units of Σ, and sums over the three states. Each consistent state contributes about 1, so the expected value is 3, and 95 % of samples fall below 7.8. A steady average well above 3 means Σ is too small for the real error: the filter is lying about its confidence.</p>
<p><b>What the lab does.</b> Beacons report every 0.2 s (every fourth tick) within 7 m and in line of sight, with σ<sub>r</sub> = 8 cm and σ<sub>b</sub> = 0.03 rad (about 1.7°). On this level the readings carry known IDs, so there is no association problem yet. The odometry noise and bias are those of the previous lesson, and the <b>assumed motion noise</b> slider in the Localize tab scales the filter's <i>M</i>. The status strip shows NEES averaged over the last 20 s and marks it overconfident above 7.8.</p>

## Try: EKF
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: L3 with the EKF, odometry noise ×1 and bias ×1, assumed noise ×1. Localize tab and the Position error plot.
See: The error stays between 1 and 5 cm for the whole run and the σ reported by the filter is the same size, so NEES hovers between 2.5 and 5 with the error inside the 2σ band about 97 % of the time. All five goals are reached in about 90 s with no collisions, against zero goals for dead reckoning on the same level. Press F (or ◎ on the map) to follow the robot and watch the estimate: between readings it slides with the odometry, and five times a second it snaps toward the truth as a reading lands. The ellipse breathes in the same rhythm, growing for four ticks and collapsing on the fifth.
Shows: This is a healthy filter. The small ×1 bias is there, but a beacon fix every 0.2 s corrects what it accumulates in 0.2 s, which is far below the sensor noise, so it never shows. Note what consistency looks like in the plot: the error is not always inside the band; it pokes out about one time in twenty, as it should.
Predict: With a beacon fix every 0.2 s on L3, how large will the EKF's position error be during the run?
- About half a metre
- A few centimetres
- Over a metre, like dead reckoning
Answer: 1

## Try: EKF, odometry bias ×3
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3},"tab":"loc","plot":"pos"}
Setup: The same filter with the calibration bias at ×3 (Localize tab, Odometry): the speed reads 6 % high and the turn rate carries an offset of 0.03 rad/s per m/s. The filter is not told.
See: The pose error is still small, 5 to 16 cm, because the beacons keep catching it, but NEES is 8 to 16 whenever the robot is moving, and the status strip flags the filter as overconfident for most of the drive. The error leaves the 2σ band about a third of the time. When the mission completes near 90 s and the robot stops, NEES falls back to 2 to 5 within a few seconds.
Shows: The classic signature of unmodeled bias. Σ shrinks as if the odometry were unbiased, so the gain discounts the innovations, which are no longer zero-mean noise but a steady, one-signed pull (the filter keeps believing it went a little farther and turned a little more than it did). The error is small only because the beacons are frequent and precise. The same bias with a landmark every 50 m instead of every 0.2 s would be metres, with the filter still claiming centimetres. NEES drops when the robot stops because the bias is proportional to speed: no motion, no bias, and the filter is suddenly telling the truth again.
Predict: The calibration bias is tripled and the filter is not told. What does NEES do?
- Stays near 3: the beacons correct the bias before it accumulates
- Rises above 7.8 and the error grows to metres
- Rises well above 7.8 while driving, though the error stays small
Answer: 2

## Try: Bias ×3, assumed noise ×4
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","odoB":3,"filtK":4},"tab":"loc","plot":"pos"}
Setup: Bias ×3 as before, and the filter's assumed motion noise at ×4 (Localize tab), so its uncertainty grows four times faster between readings.
See: NEES comes down to 2 to 3 while driving, the error is inside the band 99 % of the time, and the pose error is actually a little smaller than in the previous run, 1 to 4 cm instead of 5 to 16. The ellipse is visibly larger between readings and collapses harder at each one.
Shows: Inflating the process noise is the standard practical fix, and it is what "tuning <i>Q</i>" means in most deployed filters: the extra assumed noise stands in for the bias the model lacks. It works here because it makes Σ large enough between readings that the gain trusts the beacons more, which is also why the error improves. The cost comes later: a filter that admits more ignorance between fixes will lose confidence faster during a beacon outage (correct, but the planner has to live with it) and will accept readings from farther away when it starts gating them, which is the next lesson's problem. A bias state in the filter would fix the cause instead of the symptom.
Predict: Keeping the ×3 bias but raising the assumed motion noise to ×4, what happens to the position error?
- It gets a little smaller than with ×1 assumed noise
- It grows: the filter trusts its odometry less and wanders
- It stays the same; only NEES changes
Answer: 0

## Think about
Q: Why is the expected NEES 3, and not 1 or 9?
A: Σ⁻¹ whitens the error: if the filter is consistent, Σ^{−1/2} <i>e</i> has three components that are each standard normal, and the sum of three squared standard normals is χ² with three degrees of freedom, whose mean is 3. With a 2-D position-only check it would be 2; for a track with position and velocity, 4.
Q: Overconfident and underconfident are both inconsistent. Which is more dangerous downstream?
A: Overconfident. An overconfident filter rejects or discounts the measurements that would correct it, so the error grows while the reported uncertainty does not; the planner then plans with margins that are too small around a pose that is wrong. An underconfident filter wastes information and makes the planner over-cautious, which is a performance cost, not a safety one. Most practitioners tune toward slight underconfidence for that reason.
Q: In the second experiment the error stayed under 16 cm. Why worry about NEES at all if the pose is that good?
A: Because the pose is good for a reason that will not hold: beacons every 0.2 s. NEES is measuring the filter, not the scenario. The same filter in a scenario with sparser fixes, a longer outage, or a wrong association will fail, and NEES on a benign log is the warning you get before it does.

## Check yourself
Q: The true error is 0.3 m in x, 0.4 m in y and zero in heading, and the filter reports Σ = diag(0.1², 0.1², σ_θ²) with no correlations. What is NEES?
Answer: 25
Tolerance: 0.5
Unit: 
How: NEES = eᵀΣ⁻¹e = (0.3/0.1)² + (0.4/0.1)² + 0 = 9 + 16 = 25, far above the 7.8 flag
