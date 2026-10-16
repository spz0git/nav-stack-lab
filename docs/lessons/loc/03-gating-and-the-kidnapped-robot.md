group: loc
title: Gating, and the kidnapped robot

<p><b>Why this matters.</b> Every localization system that works from unlabeled features has to decide which feature each reading came from, and every one that works outdoors has to survive readings that came from nothing at all: reflections, other vehicles, a bird. The gate is the standard answer to both, and it is a good one, but it has a failure mode that is easy to miss on the bench and expensive in the field. A filter that is badly wrong, for whatever reason, sees every reading as an outlier, throws them all away, and stays wrong with full confidence. The kidnapping in this lesson is the cleanest way to produce that state on demand; in practice it is produced by a long sensor outage, a wheel slipping on a ramp, or a map that changed.</p>
<p><b>The experiment.</b> Each button restarts L3, drives for 8 s, then picks the robot up and puts it down at a free spot at least 6 m away (usually more than 12 m) without telling the estimator. That is a kidnapping. The run continues from just after the jump. On the map, compare the solid disc (where the robot really is) with the blue ring (where the filter thinks it is) and the pink ellipse or the particles (how sure it is). The Position error plot and the pose error in the status strip jump to about 15 m at 8 s. The question is whether they come back down.</p>
<p><b>The idea.</b> With unlabeled beacons a reading does not say which beacon it came from. The filter predicts what each candidate beacon would read from the current estimate, takes the candidate whose prediction is closest, and uses the reading only if it is close enough. "Close" has to be measured in the right units: a 0.3 m range error is nothing when the filter is uncertain by a metre and damning when it is sure to a centimetre. So the distance is the innovation divided by its own expected spread, the Mahalanobis distance, and the threshold is a probability, not a number of metres.</p>
<div class="eq">d² = νᵀ S⁻¹ ν < 9.21   (χ² with 2 degrees of freedom, 99 %)</div>
<p><b>Where it comes from.</b> If the candidate is the right beacon and the filter is consistent, ν is zero-mean Gaussian with covariance <i>S</i>, so <i>d</i>² is the squared length of a 2-D standard normal vector: χ² with two degrees of freedom, whose 99 % point is 9.21. A correct reading is rejected 1 % of the time; that is the price. <a class="chref" href="#notes=ch2/6-data-association-and-the-gate">Derivation: chapter 2 §6</a></p>
<p><b>What the gate does after a kidnapping.</b> Every reading is now tens of σ from its prediction, every <i>d</i>² is in the thousands, every reading is rejected. The filter keeps predicting with the odometry alone. Its Σ grows only at the slow odometry rate, so the gate stays narrow for minutes, and the filter discards exactly the evidence that would correct it. It keeps its small ellipse and stays confidently wrong. The status strip's NEES is the tell: it reads in the tens of thousands, which is what a 15 m error measured in centimetres of claimed σ looks like, and it stays there because the error never shrinks.</p>
<p><b>What the lab does.</b> The kidnap is a teleport to a random free cell; the robot's speed is zeroed so it starts again from rest. The estimators are not reset. On this level the lost guard is off, so the mission keeps driving on the wrong estimate; the planner notices only that the robot is "off path" or "stuck" and replans from the wrong pose. The NEES average covers the last 20 s, so after a jump it reports enormous values for 20 s even for a filter that recovers in 5.</p>

## Try: 1 · EKF, known IDs
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: L3, EKF, readings carry their beacon ID, so there is no association step and no gate. Kidnapped at 8 s.
See: The jump is about 16 m. One second later the error is 6.6 m, after three seconds 2.6 m, after seven 0.5 m, and from 14 s on it is back under 10 cm; the first goal is reached around 19 s. The recovery is not a snap but a geometric decay: each reading removes roughly a third of what is left. Meanwhile the event log fills with "Replan (off path)" as the planner chases the moving estimate. NEES shows tens of thousands until the 20 s window has forgotten the jump.
Shows: With the correct beacon named, the innovation is huge but honest, and the update <i>K</i>ν drags the estimate toward the truth. It drags rather than jumps because the gain is small: Σ is a few centimetres, so the filter believes its own position far more than any single reading and moves only a fraction of the way each time. A filter that could inflate Σ when its innovations are consistently large would recover in one or two readings; that is what the particle filter's injection test does, in the third experiment.
Predict: After the 16 m kidnap with known beacon IDs, how does the EKF recover?
- It snaps back in one or two readings
- It decays back over several seconds, a fraction per reading
- It never recovers: the readings are all gated out
Answer: 1

## Try: 2 · EKF, unlabeled
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","assoc":"unknown"},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The same filter with unlabeled beacons: nearest-neighbour association and the 99 % gate.
See: The error stays at 16 m for the whole run. The ellipse stays small (σ about 8 cm, creeping to 30 cm after a minute). The Gated measurements counter in the status strip climbs by about 15 per second: every reading fails the gate. The robot, steering by an estimate that is in a different aisle, hits a shelf within a few seconds and then spends the run being "stuck", replanning, and skipping goals one after another; after 90 s it has reached none.
Shows: The gate is doing its job as designed and the design has no exit. The readings that would correct the filter are the ones it rejects, and they will go on being rejected until Σ has grown enough to admit them, which at the odometry rate takes minutes, and by then the nearest beacon will often be the wrong one. A gated Gaussian filter needs an external trigger to say "you are lost, start over"; it cannot find out on its own from readings it refuses to look at.
Predict: With unlabeled beacons and the 99 % gate, where is the EKF estimate a minute after the kidnap?
- Back at the truth, slower than with known IDs
- Still off, but with an ellipse grown to cover the truth
- Still about 16 m off, with a small ellipse
Answer: 2

## Try: 3 · Particle filter, unlabeled
cfg: {"sim":true,"level":2,"set":{"loc":"pf","assoc":"unknown"},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The particle filter with 400 particles, unlabeled beacons, injection on. Kidnapped at 8 s.
See: The jump is about 15 m. Inside the filter the fast likelihood average falls from about 0.3 to 0.1 within two seconds while the slow one stays near 0.12; in the status strip <i>N</i><sub>eff</sub> collapses to about 15 of 400 and the injection fraction rises to its 25 % cap. New particles appear at the ranges the readings report; by 11 s the error is 16 cm. Around 14 s the set briefly splits into two clusters (σ jumps to 6 m for two seconds) and then settles on the true one; from 16 s the error is a few centimetres and the first goal is reached at 24 s.
Shows: Three things the EKF cannot do. The particle set holds several hypotheses at once, and each particle does its own association, so a particle near the true pose finds the beacons that fit it even while the main cluster does not. The filter watches whether the readings fit at all, through the fast and slow likelihood averages, which is a kidnap detector built from the same innovations the EKF throws away. And it can put probability mass anywhere the readings allow, by placing new particles at the measured range from a beacon, so the belief can move 15 m in one update without any Σ having to grow first. The split at 14 s is the filter being honest that two places fit the readings for a moment.
Predict: The particle filter with injection on, unlabeled beacons, kidnapped at 8 s: when is the error back under a metre?
- Within a few seconds
- After about a minute, once the cloud has spread enough
- Never: unlabeled readings cannot relocalize it
Answer: 0

## Think about
Q: The gate rejects a correct reading 1 % of the time. What would a 99.99 % gate (d² < 18.4) change?
A: Fewer good readings lost, more clutter admitted, and no difference at all after a kidnapping: the innovations there are hundreds of σ, far beyond any gate anyone would set. The gate is a tool for the normal case; recovery from gross error needs a separate mechanism.
Q: Why does the known-ID EKF recover geometrically rather than in one update?
A: The gain is Σ<i>H</i>ᵀ<i>S</i>⁻¹, and Σ is a few centimetres while the innovation is metres. The filter trusts itself more than any one reading, so each update moves a fixed fraction of the remaining error. It would recover in one step only if Σ were large, which it is not, because nothing told the filter that its uncertainty had changed.
Q: Could an EKF detect its own kidnapping?
A: Yes, from the statistics of its innovations: a run of consecutive rejections, or a normalized innovation squared that stays far above its χ² expectation, is exactly the signal the particle filter's fast and slow averages read. A practical EKF stack monitors that and re-initializes from the readings when it trips, which is global localization by another name.

## Check yourself
Q: A candidate beacon gives an innovation of 0.24 m in range and 0.06 rad in bearing; S is diagonal with σ_r = 0.08 m and σ_b = 0.03 rad. What is d²?
Answer: 13
Tolerance: 0.3
Unit: 
How: d² = (0.24/0.08)² + (0.06/0.03)² = 9 + 4 = 13, above 9.21, so the reading is rejected
