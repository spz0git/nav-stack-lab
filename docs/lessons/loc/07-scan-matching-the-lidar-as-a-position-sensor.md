group: loc
title: Scan matching: the lidar as a position sensor

<p><b>Why this matters.</b> The beacons are a convenience of this lab. Most real robots have none and localize with the lidar alone. Given a map, the scan tells you where the robot must be for its hits to fall on the walls. Scan matching is the algorithm that turns this into a pose. Indoor stacks from Hector and Cartographer to the relatives of AMCL all rely on it. This lesson adds it to the EKF as one more sensor. You will see that it localizes the robot with no infrastructure at all, and that its covariance is right up to a factor. You will also see where it fails. It is local, which means it only looks near the estimate. After a kidnap it finds nothing that fits, or it finds a good fit to the wrong shelves.</p>
<p><b>The idea.</b> Start from the prior map's distance field, which holds the distance from every cell to the nearest wall. Place the scan's hits in the world at the current pose estimate. A hit that lands on a wall reads 0, and a hit that lands 10 cm off reads 0.1 m. Sum the squares. Now move the pose a little in $x$, in $y$ and in $\theta$, so that the sum shrinks, and repeat until it stops shrinking. That pose is where the scan fits the map. Each move is a Gauss–Newton step. The gradient of the distance field at each hit says which way to push, and the normal equations combine all the pushes into one step. The matcher takes ten steps at most, from an estimate that is already close. The fit's residual and curvature give a covariance. The pose then goes into the EKF as a direct measurement of the state, gated like a beacon reading.</p>
$$F(\xi) = \sum_i d(T_\xi\,p_i)^2, \qquad \xi = (x, y, \theta), \qquad T_\xi\,p = R(\theta)\,p + (x, y)$$
<p>That is the cost, the squared distance of every hit to the nearest wall. The chain rule gives one row of its Jacobian per hit, with $c = \cos\theta$ and $s = \sin\theta$:</p>
$$J_i = \nabla d(T_\xi\,p_i) \cdot \frac{\partial (T_\xi\,p_i)}{\partial \xi} = \bigl[\, d_x,\ \ d_y,\ \ d_x(-s\,p_x - c\,p_y) + d_y(c\,p_x - s\,p_y) \,\bigr]$$
<p>The Gauss–Newton step solves the normal equations. The fix's covariance is the least-squares one, inflated by 4 and given a floor, with $s^2$ the residual variance:</p>
$$H\delta = -b, \qquad H = \sum_i J_i^\top J_i, \qquad b = \sum_i J_i^\top d_i \qquad\qquad \Sigma_\text{fix} = 4\,s^2 H^{-1} + \operatorname{diag}\bigl((5\ \text{cm})^2,\ (5\ \text{cm})^2,\ (1°)^2\bigr)$$
<p>The fix is fused as a pose measurement with $H = I$, gated at $\chi^2_3(99\,\%) = 11.3$:</p>
$$\nu = \xi_\text{fix} - \mu, \qquad S = \Sigma + \Sigma_\text{fix}, \qquad K = \Sigma S^{-1}, \qquad \mu \leftarrow \mu + K\nu$$
<p><b>Where it comes from.</b> The cost is a least-squares problem in three unknowns. Gauss–Newton drops the second derivatives of $d$ and solves the linearized problem at each step. The covariance is the usual least-squares estimate. It is inflated because neighbouring beams see the same wall, and it has a floor at half the map's cell size. The fusion is the Kalman update with the identity as measurement matrix. <a class="chref" href="#notes=ch2/10-scan-matching-the-lidar-as-a-position-sensor">Derivation, the degeneracy of $H$ and the measured runs: chapter 2 §10</a></p>
<p><b>What the lab does.</b> The switch is Localize → Lidar scan matching, and it works with the EKF and a prior map (Perceive → Map source). Every fourth tick (5 Hz) the scan is aligned from the current estimate and fused. The Localize tab reports the last match: points used, residual, iterations, how far it moved the estimate, and its $\sigma$. When a match was not fused, the tab says why. Either the robot has not moved since the last fix (the same scan from the same place is not new evidence), or the fit was poor (most hits far from any wall), or the gate rejected it. When fewer than twelve hits land near any wall there is no match at all, and the tab shows no last match. Signals has the residual. All numbers below are from L3 at seed 7 over 120 s.</p>

## Try: Lidar only: every beacon off
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos"}
Setup: L3 with its noisy odometry and every beacon switched off. The EKF uses scan matching against the prior map. The Localize tab, the Position error plot and the lidar layer are on.
See: The error stays mostly between 1 and 7 cm (11 cm at worst), the pose RMS is 0.04 m, and all five goals are reached. That is as good as with the beacons (RMS 0.04 m). NEES runs between 2 and 9, about 6 on average. The error is inside the 2σ band 85 % of the time, against 97 % with the beacons. Dead reckoning on the same run drifts to 1.6 m RMS, reaches two goals and hits a shelf.
Shows: Once there is a map to match it against, the lidar works as a position sensor, with no infrastructure and centimetre accuracy. NEES says the filter is a little overconfident, by about a factor of two. The fix is computed from the estimate it then corrects, so it is not independent evidence, and no covariance formula can fully make up for that.
Predict: Switch every beacon off and turn scan matching on. How good is the estimate?
- As good as with the beacons: a few centimetres
- Within half a metre: it drifts along the aisles, where the walls all look alike
- Lost after the first turn: the lidar sees too little of the map
Answer: 0

## Try: The beacons alone, for comparison
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos"}
Setup: The EKF with its beacons and no scan matching, the reference of lesson 2. Then switch scan matching on as well (Localize) and compare.
See: The pose RMS is 0.04 m, NEES is 2.8 to 5.2, and the error is inside the 2σ band 97 % of the time. Add scan matching to the beacons (Localize) and the RMS drops to 0.03 m. NEES then averages 4.3 over the run, against 3.6, and the band share falls to 91 %.
Shows: With both sensors the error is a centimetre smaller than with one, on every seed. Next to the beacons, the matcher's double counting does little to consistency. On this run NEES is a little higher and the band share lower, and on seeds 3 and 4 both move the other way. With the lidar alone, as in the first experiment, the double counting shows plainly: NEES averages 4.7 to 6.2 over the run on seeds 1 to 5 and 7. On a real robot the beacons may be a GPS fix, a UWB anchor or nothing at all, while the lidar is always there.
Predict: After this run, switch scan matching on as well, beacons and lidar together. What happens to the error and to NEES?
- The error gets a little smaller and NEES stays about where it was, near 4
- The error halves and NEES falls below 1: two sensors make the filter underconfident
- NEES climbs past 7.8: two sensors double the overconfidence
Answer: 0

## Try: Beacons mostly down, lidar on
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","scanMatch":true,"bOut":70,"bOutLen":6},"tab":"loc","plot":"pos"}
Setup: Every beacon is down 70 % of the time, in outages of about 6 s, and scan matching is on. This is the "EKF, long outages" case in L3's own Try list, the hardest beacon case there.
See: The pose RMS is 0.04 m and the error is never worse than 9 cm, as if the outages were not there. With the beacons alone, the same run reaches 0.3 to 0.45 m during the gaps. NEES is 2 to 9.5.
Shows: A second position sensor that fails in its own ways makes the outages harmless. Beacons go down. Scan matching goes wrong where the map is wrong or where the walls all look alike. A filter that has both coasts through either failure.
Predict: Beacons down 70 % of the time, scan matching on. What happens to the error during the outages?
- Nothing: the lidar fills the gaps
- It grows to tenths of a metre as before: the matcher only runs when a beacon is seen
- It grows more: two sensors disagree during the gaps
Answer: 0

## Try: Kidnapped, lidar only
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","bOff":"all","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: Scan matching without beacons, and at 8 s the robot is moved 16 m across the warehouse without telling the filter.
See: The estimate stays where the robot was, and the Localize tab's last-match line disappears. Placed from the old estimate, too few of the new scan's hits land near any wall of the map. So the matcher finds no fit at all, and nothing is fused. Between 57 and 60 s a few scans do reach walls, but they fit badly and are dropped as poor fits. None is fused, and the gate never fires. The filter coasts on the odometry and claims 7 cm while it is 16 m off (NEES in the hundred thousands). The robot drives into a shelf at 10 s and skips its goals one by one.
Shows: Scan matching is local. It searches only near the estimate, and 16 m from the truth nothing near the estimate fits. The matcher reports this correctly by fusing nothing, and so the error is never corrected. The filter keeps its small $\sigma$ and drives on the odometry, and no gate can fire when there is nothing to gate. The same happens on seeds 1 to 5: not one match is fused after the kidnap. Closer to the truth, a local matcher fails the other way, with a good fit to the wrong shelves. This is called perceptual aliasing, and the next experiment shows it. Recovering from a kidnap needs a global method: the particle filter's injection of lesson 4, a different sensor, or place recognition.
Predict: Kidnap the robot with scan matching as its only sensor. What does the matcher do?
- Keeps fusing good-looking fits at the wrong place: the shelves all look alike
- Finds nothing that fits near the old estimate and fuses nothing, while the filter stays sure of itself
- Snaps to the right place within a few scans, as the beacons would
Answer: 1

## Try: Kidnapped, beacons and lidar
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","scanMatch":true},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The same kidnap with the beacons on as well.
See: The beacons pull the estimate across the warehouse. It is 8.8 m off after one second, 2.1 m at 14 s, 0.25 m at 24 s, 2 cm at 34 s and a few centimetres after that. On the way, 76 scan matches are rejected. Up to 18 s, 39 are dropped as poor fits. Between 18 and 26 s the gate rejects 37 more, which are matches at the wrong place that disagree with the beacons. The first match fused after the kidnap comes at 25 s, when the estimate is back within about 20 cm. The robot brushes a shelf at 13 s. With the beacons alone the recovery is a little faster (5 cm at 24 s, no contact).
Shows: Two sensors can disagree. While the beacons pull the estimate across the floor, the matcher starts from each intermediate estimate. It finds either no good fit (the poor fits up to 18 s) or a good fit to the wrong shelves (the gated matches from 18 to 26 s, with residuals under 5 cm). The second kind is perceptual aliasing. Fused, those matches would hold the estimate at the wrong place. The gate keeps them out, and the beacons bring the estimate back. The matcher fuses nothing during the recovery, so it does not slow the recovery down directly. The difference from the beacons alone lies in the state the filter was in when the kidnap came. Here the first beacon corrections turn the heading further wrong (38° off at 10 s against 11°). On other seeds it goes either way. On seed 3 the pair is back under 10 cm at 20 s, and the beacons alone only after 30 s. On seeds 4 and 5 both are still metres off a minute later, caught in the EKF's trap from lesson 3.
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
Note: The first marked line builds one row of the Jacobian per hit, by the chain rule of the lesson. The three marked lines after the loop are the step $H\delta = -b$, solved with the $3 \times 3$ inverse. The bilinear field above gives $d$ and its gradient. The fusion into the EKF is ekfScanUpdate, just below in the module. Edit and run loads the scan-matching example, which replaces the estimate by the matched pose instead of fusing it. Raise the 0.5 m outlier cut to 2 m and kidnap the robot by hand. You then see the matcher's basin, how far off the estimate can be for the matcher still to pull it in.

## Think about
Q: The matcher starts from the estimate and the result is fused into the same estimate. Why is that a problem, and what does the lab do about it?
A: The fix is not independent evidence. Part of what it reports is the prior it started from. Fusing it with the full weight of its fit covariance counts that prior twice, and the filter grows overconfident. The lab inflates the fit's covariance by four and gives it a floor at the map's resolution, which brings NEES from about 9 to about 5. The proper fixes are to match from the odometry-only prediction instead of the posterior, or to treat the match as a constraint in a smoother, as Cartographer does.
Q: In a long featureless corridor the Hessian $H$ has one small eigenvalue. What does that mean for the fix, and how does the filter see it?
A: Pushing the scan along the corridor hardly changes the cost, so in that direction $H$ says the fit is undetermined. $H^{-1}$ makes the fix's covariance long in that direction. The matcher is reporting that it knows where the robot is across the corridor, but not where along it. The EKF then trusts the odometry along the corridor and the lidar across it, which is right. The ellipse on the map stretches along the aisle until a shelf end comes into view.
Q: The kidnapped run never recovered with the lidar alone, and the gate never fired. Could a better gate have caught it?
A: No, because there was nothing to gate. From the wrong estimate the scan fitted no walls at all, so the matcher fused nothing and the filter dead-reckoned with its small $\sigma$. A watch on the matcher's silence could have caught it. A run of failed or poor matches while the robot moves is as clear a sign of being lost as a run of rejected beacon readings. Where the matcher does find a good fit at the wrong place, as in the last experiment, the fit itself looks fine, so no gate on the fit alone can catch that either. Recovery needs a second hypothesis. The particle filter's injection provides one, and a smoother tests one with loop closures.

## Check yourself
Q: Sixty hits each lie 3 cm beyond their wall with the same gradient (1, 0), so each contributes $J\,d = 0.03$ to $b_x$ and 1 to $H_{xx}$. How far, in centimetres, does the Gauss–Newton step move x?
Answer: 3
Tolerance: 0.1
Unit: cm
How: $\delta x = -b_x / H_{xx} = -(60 \times 0.03) / 60 = -0.03$ m. One step puts all sixty hits back on the wall.
