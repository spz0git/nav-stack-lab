group: loc
title: Scan matching: the lidar as a position sensor

<p><b>Why this matters.</b> Beacons are a convenience of this lab. Most real robots have no beacons and localize with the lidar alone: given a map, the scan says where the robot must be for the hits to fall on the walls. Scan matching is the algorithm that turns that sentence into a pose, and it is the workhorse of every indoor stack from Hector and Cartographer to AMCL's cousins. This lesson adds it to the EKF as one more sensor, and shows what it buys (localization with no infrastructure at all), what it is honest about (its covariance, up to a factor), and where it fails (it is local: it finds the nearest fit, which after a kidnap in a warehouse of identical shelves is the wrong one).</p>
<p><b>The idea.</b> Take the prior map's distance field, the distance from every cell to the nearest wall. Place the scan's hits in the world at the current pose estimate: a hit that lands on a wall reads 0, a hit that lands 10 cm off reads 0.1 m. Sum the squares. Now move the pose, a little in <i>x</i>, in <i>y</i>, in θ, so that the sum shrinks, and repeat until it stops shrinking: that pose is where the scan fits the map. The move is Gauss–Newton: the gradient of the distance field at each hit says which way to push, and the normal equations combine all the pushes into one step. Ten steps at most, from an estimate that is already close. The fit's residual and curvature give a covariance, and the pose goes into the EKF as a direct measurement of the state, gated like a beacon reading.</p>
<div class="eq">F(ξ) = Σ_i d(T_ξ p_i)²,   ξ = (x, y, θ),   T_ξ p = R(θ) p + (x, y)        the cost: squared distance of every hit to the nearest wall
J_i = ∇d(T_ξ p_i) · ∂(T_ξ p_i)/∂ξ = [d_x, d_y, d_x(−s p_x − c p_y) + d_y(c p_x − s p_y)]        the chain rule, one row per hit
H δ = −b,   H = Σ J_iᵀ J_i,   b = Σ J_iᵀ d_i        the Gauss–Newton step; Σ_fix = s² H⁻¹ · 4 + diag(5², 5², 1°) cm, s² the residual variance
ν = ξ_fix − μ,   S = Σ + Σ_fix,   K = Σ S⁻¹,   μ ← μ + K ν        fused as a pose measurement with H = I, gated at χ²₃(99 %) = 11.3</div>
<p><b>Where it comes from.</b> The cost is a least-squares problem in three unknowns; Gauss–Newton drops the second derivatives of <i>d</i> and solves the linearized problem at each step. The covariance is the usual least-squares estimate, inflated because neighbouring beams see the same wall and floored at half the map's cell size, and the fusion is the Kalman update with the identity as measurement matrix. <a class="chref" href="#notes=ch2/10-scan-matching-the-lidar-as-a-position-sensor">Derivation, the degeneracy of H and the measured runs: chapter 2 §10</a></p>
<p><b>What the lab does.</b> Localize → Lidar scan matching, with the EKF and a prior map (Perceive → Map source). Every fourth tick (5 Hz) the scan is aligned from the current estimate and fused; the Localize tab reports the last match (points used, residual, iterations, how far it moved the estimate, its σ) and why it was not fused when it was not: the robot has not moved since the last fix (the same scan from the same place is not new evidence), a poor fit (most hits far from any wall), or the gate. Signals has the residual. All numbers below are from L3 at seed 7 over 120 s.</p>

## Try: Lidar only: every beacon off
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos"}
Setup: L3 with its noisy odometry, every beacon switched off, the EKF with scan matching against the prior map. Localize tab, Position error plot, lidar layer on.
See: The error stays between 1 and 6 cm for the whole run, pose RMS 0.04 m, all five goals reached: the same as with the beacons (RMS 0.04 m). NEES runs between 2 and 9, about 5 on average, and the error is inside the 2σ band 85 % of the time against 97 % with the beacons. Dead reckoning on the same run drifts to 1.6 m RMS, reaches two goals and hits a shelf.
Shows: The lidar is a position sensor once there is a map to match it against: no infrastructure, centimetre accuracy. The NEES says the filter is a little overconfident, by about a factor two: the fix is computed from the estimate it then corrects, so it is not independent evidence, and no covariance formula fixes that entirely.
Predict: Switch every beacon off and turn scan matching on. How good is the estimate?
- As good as with the beacons: a few centimetres
- Within half a metre: it drifts along the aisles, where the walls all look alike
- Lost after the first turn: the lidar sees too little of the map
Answer: 0

## Try: The beacons alone, for comparison
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: The EKF with its beacons and no scan matching, the reference of lesson 2.
See: Pose RMS 0.04 m, NEES 2.6 to 4.7, inside the 2σ band 97 % of the time. Add scan matching to the beacons (Localize) and the RMS drops to 0.03 m while NEES rises to about 4 and the band share falls to 91 %.
Shows: Two sensors are better than one by a centimetre, and the consistency gets slightly worse, which is the price of a measurement that is not independent of the state. On a real robot the beacons are a GPS fix, a UWB anchor or nothing at all; the lidar is what is always there.
Predict: Add scan matching to the beacons. What does NEES do?
- Rises a little: the fix is computed from the estimate it corrects, so it is not independent
- Falls below 1: two sensors make the filter underconfident
- Unchanged: NEES measures the error, not the sensors
Answer: 0

## Try: Beacons mostly down, lidar on
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","scanMatch":true,"bOut":70,"bOutLen":6},"tab":"loc","plot":"pos"}
Setup: Every beacon down 70 % of the time in outages of about 6 s (lesson 2's hardest beacon case) with scan matching on.
See: Pose RMS 0.04 m, as if the outages were not there; with the beacons alone the same run reaches 0.14 m during the gaps. NEES 2 to 8.
Shows: A second position sensor with its own failure modes is what makes outages harmless. The two fail differently: beacons go down, scan matching goes wrong where the map is wrong or the walls all look alike, and a filter that has both coasts through either.
Predict: Beacons down 70 % of the time, scan matching on. What happens to the error during the outages?
- Nothing: the lidar fills the gaps
- It grows to 0.14 m as before: the matcher only runs when a beacon is seen
- It grows more: two sensors disagree during the gaps
Answer: 0

## Try: Kidnapped, lidar only
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: Scan matching without beacons, and at 8 s the robot is moved 16 m across the warehouse without telling the filter.
See: The estimate stays where the robot was. The matches keep being fused, none rejected: from the old estimate the new scan fits the shelves there about as well as it fitted the ones the robot actually sees, residual a few centimetres, so the matcher is happy and the filter claims 7 cm while it is 16 m off (NEES in the hundred thousands). The robot drives into a shelf at 11 s and skips its goals one by one.
Shows: Scan matching is local: it finds the nearest fit to where it starts, and in a warehouse of identical shelves the nearest fit is as good as the right one. This is perceptual aliasing, and no amount of gating catches it, because the gate measures the fit, which is fine. Recovering from a kidnap needs a global method: the particle filter's injection of lesson 4, a different sensor, or place recognition.
Predict: Kidnap the robot with scan matching as its only sensor. What does the matcher do?
- Keeps fusing good-looking fits at the wrong place: the shelves all look alike
- Rejects every match from then on, and the robot stops
- Snaps to the right place within a few scans, as the beacons would
Answer: 0

## Try: Kidnapped, beacons and lidar
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The same kidnap with the beacons on as well.
See: The beacons pull the estimate across the warehouse: 8.8 m off after one second, 2.1 m at 14 s, 0.25 m at 24 s, 2 cm from 34 s. On the way 76 scan matches are rejected by the gate, the matches at the wrong place that disagree with the beacons, and the filter brushes a shelf at 14 s. With the beacons alone the recovery is a little faster (5 cm at 24 s, no contact): the matcher, fitting the wrong shelves, resists the correction until the gate starts rejecting it.
Shows: Two sensors are also two opinions. While the beacons say "you are over there", the matcher says "you fit here", and the filter believes whichever claims the smaller covariance until the innovations get too large for the gate. The gate is what keeps the lidar from winning that argument; the beacons are what wins it.
Predict: The same kidnap with the beacons on. How does the recovery compare with beacons alone?
- A little slower, with many scan matches rejected on the way
- Much faster: two sensors agree on the new place at once
- It never recovers: the matcher keeps the estimate where it was
Answer: 0

## Code: scanMatch, the Gauss–Newton step
snippet: scan-match
focus: const J = [f.gx, f.gy, f.gx * (-s * px - c * py) + f.gy * (c * px - s * py)];
focus: const dx = -(Hi[0] * b[0] + Hi[1] * b[1] + Hi[2] * b[2]), … dth = -(Hi[6] * b[0] + Hi[7] * b[1] + Hi[8] * b[2]);
example: loc/sm
Note: One row of the Jacobian per hit, the chain rule of the lesson; the three marked lines after the loop are the step H δ = −b, solved with the 3×3 inverse. The bilinear field above gives d and its gradient; the fusion into the EKF is ekfScanUpdate, right below in the module. Edit and run: the scan-matching example replaces the estimate by the matched pose instead of fusing it; raise the 0.5 m outlier cut to 2 m and kidnap the robot by hand to see the basin.

## Think about
Q: The matcher starts from the estimate and the result is fused into the same estimate. Why is that a problem, and what does the lab do about it?
A: The fix is not independent evidence: part of what it reports is the prior it started from, so fusing it with the full weight of its fit covariance counts that prior twice and the filter grows overconfident. The lab inflates the fit's covariance by four and floors it at the map's resolution, which brings NEES from about 9 to about 5; the honest fixes are to match from the odometry-only prediction rather than the posterior, or to treat the match as a constraint in a smoother, as Cartographer does.
Q: In a long featureless corridor the Hessian H has one small eigenvalue. What does that mean for the fix, and how does the filter see it?
A: Pushing the scan along the corridor changes the cost hardly at all, so along that direction H says the fit is undetermined, and H⁻¹ makes the fix's covariance long in that direction: the matcher reports honestly that it knows where across the corridor the robot is but not where along it. The EKF then trusts the odometry along the corridor and the lidar across it, which is the right answer, and the ellipse on the map stretches along the aisle until a shelf end comes into view.
Q: The kidnapped run never recovered with the lidar alone, and the gate never fired. Could a better gate have caught it?
A: No gate on the fit can, because the fit was good: the scan matched a different set of shelves with the same residual it had before. What distinguishes the two places is not in a single scan; it is in the sequence (the odometry says the robot did not drive 16 m) or in a sensor that sees further than the shelves. Detection needs a second hypothesis, which is what the particle filter's injection provides and what a smoother tests with loop closures.

## Check yourself
Q: Sixty hits each lie 3 cm beyond their wall with the same gradient (1, 0), so each contributes J d = 0.03 to b_x and 1 to H_xx. How far, in centimetres, does the Gauss–Newton step move x?
Answer: 3
Tolerance: 0.1
Unit: cm
How: δx = −b_x / H_xx = −(60 × 0.03) / 60 = −0.03 m: one step puts all sixty hits back on the wall
