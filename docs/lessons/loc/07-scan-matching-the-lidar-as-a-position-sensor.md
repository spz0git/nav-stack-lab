group: loc
title: Scan matching: the lidar as a position sensor

<p><b>Why this matters.</b> Beacons are a convenience of this lab. Most real robots have no beacons and localize with the lidar alone: given a map, the scan says where the robot must be for the hits to fall on the walls. Scan matching is the algorithm that turns that sentence into a pose, and it is the workhorse of every indoor stack from Hector and Cartographer to AMCL's cousins. This lesson adds it to the EKF as one more sensor, and shows what it buys (localization with no infrastructure at all), what it is honest about (its covariance, up to a factor), and where it fails (it is local: it only looks near the estimate, so after a kidnap it finds nothing that fits, or a good fit to the wrong shelves).</p>
<p><b>The idea.</b> Take the prior map's distance field, the distance from every cell to the nearest wall. Place the scan's hits in the world at the current pose estimate: a hit that lands on a wall reads 0, a hit that lands 10 cm off reads 0.1 m. Sum the squares. Now move the pose, a little in $x$, in $y$, in $\theta$, so that the sum shrinks, and repeat until it stops shrinking: that pose is where the scan fits the map. The move is Gauss–Newton: the gradient of the distance field at each hit says which way to push, and the normal equations combine all the pushes into one step. Ten steps at most, from an estimate that is already close. The fit's residual and curvature give a covariance, and the pose goes into the EKF as a direct measurement of the state, gated like a beacon reading.</p>
$$F(\xi) = \sum_i d(T_\xi\,p_i)^2, \qquad \xi = (x, y, \theta), \qquad T_\xi\,p = R(\theta)\,p + (x, y)$$
<p>That is the cost, the squared distance of every hit to the nearest wall. The chain rule gives one row of its Jacobian per hit, with $c = \cos\theta$ and $s = \sin\theta$:</p>
$$J_i = \nabla d(T_\xi\,p_i) \cdot \frac{\partial (T_\xi\,p_i)}{\partial \xi} = \bigl[\, d_x,\ \ d_y,\ \ d_x(-s\,p_x - c\,p_y) + d_y(c\,p_x - s\,p_y) \,\bigr]$$
<p>The Gauss–Newton step solves the normal equations, and the fix's covariance is the least-squares one, inflated by 4 and floored, with $s^2$ the residual variance:</p>
$$H\delta = -b, \qquad H = \sum_i J_i^\top J_i, \qquad b = \sum_i J_i^\top d_i \qquad\qquad \Sigma_\text{fix} = 4\,s^2 H^{-1} + \operatorname{diag}\bigl((5\ \text{cm})^2,\ (5\ \text{cm})^2,\ (1°)^2\bigr)$$
<p>The fix is fused as a pose measurement with $H = I$, gated at $\chi^2_3(99\,\%) = 11.3$:</p>
$$\nu = \xi_\text{fix} - \mu, \qquad S = \Sigma + \Sigma_\text{fix}, \qquad K = \Sigma S^{-1}, \qquad \mu \leftarrow \mu + K\nu$$
<p><b>Where it comes from.</b> The cost is a least-squares problem in three unknowns; Gauss–Newton drops the second derivatives of $d$ and solves the linearized problem at each step. The covariance is the usual least-squares estimate, inflated because neighbouring beams see the same wall and floored at half the map's cell size, and the fusion is the Kalman update with the identity as measurement matrix. <a class="chref" href="#notes=ch2/10-scan-matching-the-lidar-as-a-position-sensor">Derivation, the degeneracy of $H$ and the measured runs: chapter 2 §10</a></p>
<p><b>What the lab does.</b> Localize → Lidar scan matching, with the EKF and a prior map (Perceive → Map source). Every fourth tick (5 Hz) the scan is aligned from the current estimate and fused; the Localize tab reports the last match (points used, residual, iterations, how far it moved the estimate, its $\sigma$) and why it was not fused when it was not: the robot has not moved since the last fix (the same scan from the same place is not new evidence), a poor fit (most hits far from any wall), or the gate. When fewer than twelve hits land near any wall there is no match at all, and the tab shows no last match. Signals has the residual. All numbers below are from L3 at seed 7 over 120 s.</p>

## Try: Lidar only: every beacon off
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos"}
Setup: L3 with its noisy odometry, every beacon switched off, the EKF with scan matching against the prior map. Localize tab, Position error plot, lidar layer on.
See: The error stays mostly between 1 and 7 cm (11 cm at worst), pose RMS 0.04 m, all five goals reached: the same as with the beacons (RMS 0.04 m). NEES runs between 2 and 9, about 6 on average, and the error is inside the 2σ band 85 % of the time against 97 % with the beacons. Dead reckoning on the same run drifts to 1.6 m RMS, reaches two goals and hits a shelf.
Shows: The lidar is a position sensor once there is a map to match it against: no infrastructure, centimetre accuracy. The NEES says the filter is a little overconfident, by about a factor two: the fix is computed from the estimate it then corrects, so it is not independent evidence, and no covariance formula fixes that entirely.
Predict: Switch every beacon off and turn scan matching on. How good is the estimate?
- As good as with the beacons: a few centimetres
- Within half a metre: it drifts along the aisles, where the walls all look alike
- Lost after the first turn: the lidar sees too little of the map
Answer: 0

## Try: The beacons alone, for comparison
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: The EKF with its beacons and no scan matching, the reference of lesson 2.
See: Pose RMS 0.04 m, NEES 2.8 to 5.2, inside the 2σ band 97 % of the time. Add scan matching to the beacons (Localize) and the RMS drops to 0.03 m, NEES averages 4.3 over the run against 3.6, and the band share falls to 91 %.
Shows: Two sensors are better than one by a centimetre, on every seed. What the matcher's double counting does to consistency is small next to the beacons: on this run NEES is a little higher and the band share lower, on seeds 3 and 4 both move the other way. With the lidar alone, as in the first experiment, it shows plainly: NEES averages 4.7 to 6.2 over the run on seeds 1 to 5 and 7. On a real robot the beacons are a GPS fix, a UWB anchor or nothing at all; the lidar is what is always there.
Predict: Add scan matching to the beacons. What happens to the error and to NEES?
- The error gets a little smaller and NEES stays about where it was, near 4
- The error halves and NEES falls below 1: two sensors make the filter underconfident
- NEES climbs past 7.8: two sensors double the overconfidence
Answer: 0

## Try: Beacons mostly down, lidar on
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","scanMatch":true,"bOut":70,"bOutLen":6},"tab":"loc","plot":"pos"}
Setup: Every beacon down 70 % of the time in outages of about 6 s (the "EKF, long outages" case in L3's own Try list, the hardest beacon case there) with scan matching on.
See: Pose RMS 0.04 m and never worse than 9 cm, as if the outages were not there; with the beacons alone the same run reaches 0.3 to 0.45 m during the gaps. NEES 2 to 9.5.
Shows: A second position sensor with its own failure modes is what makes outages harmless. The two fail differently: beacons go down, scan matching goes wrong where the map is wrong or the walls all look alike, and a filter that has both coasts through either.
Predict: Beacons down 70 % of the time, scan matching on. What happens to the error during the outages?
- Nothing: the lidar fills the gaps
- It grows to tenths of a metre as before: the matcher only runs when a beacon is seen
- It grows more: two sensors disagree during the gaps
Answer: 0

## Try: Kidnapped, lidar only
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: Scan matching without beacons, and at 8 s the robot is moved 16 m across the warehouse without telling the filter.
See: The estimate stays where the robot was, and the Localize tab's last-match line disappears: placed from the old estimate, too few of the new scan's hits land near any wall of the map, so the matcher finds no fit at all and nothing is fused. Between 57 and 60 s a few scans do reach walls but fit them badly and are dropped as poor fits; none is fused and the gate never fires. The filter coasts on the odometry and claims 7 cm while it is 16 m off (NEES in the hundred thousands). The robot drives into a shelf at 10 s and skips its goals one by one.
Shows: Scan matching is local: it searches only near the estimate, and 16 m from the truth nothing near the estimate fits. The matcher is honest about that, it fuses nothing, but silence is not a correction: the filter keeps its small $\sigma$ and drives on the odometry, and no gate can fire when there is nothing to gate. The same happens on seeds 1 to 5: not one match is fused after the kidnap. Closer to the truth a local matcher fails the other way, with a good fit to the wrong shelves (perceptual aliasing), which the next experiment shows. Recovering from a kidnap needs a global method: the particle filter's injection of lesson 4, a different sensor, or place recognition.
Predict: Kidnap the robot with scan matching as its only sensor. What does the matcher do?
- Keeps fusing good-looking fits at the wrong place: the shelves all look alike
- Finds nothing that fits near the old estimate and fuses nothing, while the filter stays sure of itself
- Snaps to the right place within a few scans, as the beacons would
Answer: 1

## Try: Kidnapped, beacons and lidar
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The same kidnap with the beacons on as well.
See: The beacons pull the estimate across the warehouse: 8.8 m off after one second, 2.1 m at 14 s, 0.25 m at 24 s, 2 cm at 34 s and a few centimetres after. On the way 76 scan matches are rejected: 39 up to 18 s as poor fits, then 37 by the gate between 18 and 26 s, the matches at the wrong place that disagree with the beacons. The first match fused after the kidnap comes at 25 s, when the estimate is back within about 20 cm. The robot brushes a shelf at 13 s. With the beacons alone the recovery is a little faster (5 cm at 24 s, no contact).
Shows: Two sensors are also two opinions. While the beacons pull the estimate across the floor, the matcher, starting from each intermediate estimate, finds either no good fit (the poor fits up to 18 s) or a good fit to the wrong shelves (the gated matches from 18 to 26 s, residuals under 5 cm: perceptual aliasing). Fused, those would hold the estimate at the wrong place. The gate is what keeps the lidar from winning that argument; the beacons are what wins it. The matcher fuses nothing during the recovery, so it does not slow it down directly; the difference from the beacons alone lies in the state the kidnap found, and the first beacon corrections turn the heading further wrong here (38° off at 10 s against 11°). On other seeds it goes either way: on seed 3 the pair is back under 10 cm at 20 s and the beacons alone only after 30 s, and on seeds 4 and 5 both are still metres off a minute later, the EKF's trap of lesson 3.
Predict: The same kidnap with the beacons on. What does the scan matcher do while the beacons pull the estimate back?
- Its matches are dropped, as poor fits or by the gate, until the estimate is close again
- It agrees with the beacons at once: two sensors find the new place together
- It holds the estimate where it was: the matcher outvotes the beacons
Answer: 0

## Code: scanMatch, the Gauss–Newton step
snippet: scan-match
focus: const J = [f.gx, f.gy, f.gx * (-s * px - c * py) + f.gy * (c * px - s * py)];
focus: const dx = -(Hi[0] * b[0] + Hi[1] * b[1] + Hi[2] * b[2]), … dth = -(Hi[6] * b[0] + Hi[7] * b[1] + Hi[8] * b[2]);
example: loc/sm
Note: One row of the Jacobian per hit, the chain rule of the lesson; the three marked lines after the loop are the step $H\delta = -b$, solved with the $3 \times 3$ inverse. The bilinear field above gives $d$ and its gradient; the fusion into the EKF is ekfScanUpdate, right below in the module. Edit and run: the scan-matching example replaces the estimate by the matched pose instead of fusing it; raise the 0.5 m outlier cut to 2 m and kidnap the robot by hand to see the basin.

## Think about
Q: The matcher starts from the estimate and the result is fused into the same estimate. Why is that a problem, and what does the lab do about it?
A: The fix is not independent evidence: part of what it reports is the prior it started from, so fusing it with the full weight of its fit covariance counts that prior twice and the filter grows overconfident. The lab inflates the fit's covariance by four and floors it at the map's resolution, which brings NEES from about 9 to about 5; the honest fixes are to match from the odometry-only prediction rather than the posterior, or to treat the match as a constraint in a smoother, as Cartographer does.
Q: In a long featureless corridor the Hessian $H$ has one small eigenvalue. What does that mean for the fix, and how does the filter see it?
A: Pushing the scan along the corridor changes the cost hardly at all, so along that direction $H$ says the fit is undetermined, and $H^{-1}$ makes the fix's covariance long in that direction: the matcher reports honestly that it knows where across the corridor the robot is but not where along it. The EKF then trusts the odometry along the corridor and the lidar across it, which is the right answer, and the ellipse on the map stretches along the aisle until a shelf end comes into view.
Q: The kidnapped run never recovered with the lidar alone, and the gate never fired. Could a better gate have caught it?
A: No: there was nothing to gate. From the wrong estimate the scan fitted no walls at all, so the matcher fused nothing and the filter simply dead-reckoned with its small $\sigma$. What could have caught it is a watch on the matcher's silence: a run of failed or poor matches while the robot moves is as clear a sign of being lost as a run of rejected beacon readings. And where the matcher does find a good fit at the wrong place, as in the last experiment, the fit itself looks fine, so no gate on the fit alone can catch that either. Recovery needs a second hypothesis, which is what the particle filter's injection provides and what a smoother tests with loop closures.

## Check yourself
Q: Sixty hits each lie 3 cm beyond their wall with the same gradient (1, 0), so each contributes $J\,d = 0.03$ to $b_x$ and 1 to $H_{xx}$. How far, in centimetres, does the Gauss–Newton step move x?
Answer: 3
Tolerance: 0.1
Unit: cm
How: $\delta x = -b_x / H_{xx} = -(60 \times 0.03) / 60 = -0.03$ m: one step puts all sixty hits back on the wall
