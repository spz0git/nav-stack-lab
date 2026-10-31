group: loc
title: Gating, and the kidnapped robot

<p><b>Why this matters.</b> A localization system that works from unlabeled features has to decide which feature each reading came from. One that works outdoors also has to cope with readings that came from nothing in its map, such as reflections, other vehicles or a bird. The gate is the standard answer to both problems, and a good one. It has a failure mode, though, that is easy to miss on the bench and costly in the field. A filter that is badly wrong, for any reason, sees every reading as an outlier. It throws them all away and stays wrong with full confidence. The kidnapping in this lesson puts the filter in that state on demand. In practice a long sensor outage, a wheel slipping on a ramp or a map that has changed can do the same.</p>
<p><b>The experiment.</b> Each button restarts L3 and drives for 8 s. It then picks the robot up and puts it down at a free spot at least 6 m away (usually more than 12 m), without telling the estimator. That is a kidnapping. The run continues from just after the jump. On the map, compare the solid disc (where the robot really is) with the blue ring (where the filter thinks it is) and the pink ellipse or the particles (how sure it is). The Position error plot and the pose error in the status strip jump to about 15 m at 8 s. (In the first experiment they peak at 12 m, because there the first reading already pulls the estimate back.) The question is whether they come back down.</p>
<p><b>The idea.</b> With unlabeled beacons a reading does not say which beacon it came from. The filter predicts what each candidate beacon would read from the current estimate and takes the candidate whose prediction is closest. It uses the reading only if that prediction is close enough. Closeness has to be measured in the right units. A 0.3 m range error is nothing when the filter is uncertain by a metre. When the filter claims to know its position to a centimetre, the same error says the match is wrong. So the distance is the innovation divided by its own expected spread, which is called the Mahalanobis distance. The threshold is set as a probability instead of a number of metres.</p>
$$d^2 = \nu^\top S^{-1} \nu < 9.21 \qquad (\chi^2 \text{ with 2 degrees of freedom, } 99\,\%)$$
<p><b>Where it comes from.</b> If the candidate is the right beacon and the filter is consistent, $\nu$ is zero-mean Gaussian with covariance $S$, so $d^2$ is the squared length of a 2-D standard normal vector. That is $\chi^2$ with two degrees of freedom, and its 99 % point is 9.21. So the gate also rejects a correct reading 1 % of the time. <a class="chref" href="#notes=ch2/6-data-association-and-the-gate">Derivation: chapter 2 §6</a></p>
<p><b>What the gate does after a kidnapping.</b> Every reading is now tens of $\sigma$ from its prediction. Every $d^2$ is in the thousands, so every reading is rejected. The filter keeps predicting with the odometry alone. Its $\Sigma$ grows only at the slow odometry rate, so the gate stays narrow for minutes, and the filter discards the very readings that would correct it. It keeps its small ellipse and stays confidently wrong. The status strip's NEES gives it away. It reads in the tens of thousands, which is what a 15 m error comes to when it is measured against a claimed $\sigma$ of centimetres. It stays there because the error never shrinks.</p>
<p><b>What the lab does.</b> The kidnap moves the robot to a random free cell and sets its speed to zero, so it starts again from rest. The estimators are not reset. On this level the lost guard, which holds the robot while localization reports it is lost, is off. So the mission keeps driving on the wrong estimate. The planner notices only that the robot is "off path" or "stuck", and replans from the wrong pose. The NEES average covers the last 20 s. After a jump it reports enormous values for 20 s, even for a filter that recovers in 5.</p>

## Try: 1 · EKF, known IDs
cfg: {"sim":true,"level":2,"set":{"loc":"ekf"},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: L3 with the EKF. The readings carry their beacon ID, so there is no association step and no gate. The robot is kidnapped at 8 s.
See: The robot is moved about 16 m, and the first beacon scan already takes a quarter of that off, so the plot peaks at 12 m. One second later the error is 6.6 m. After three seconds it is 2.6 m, and after seven 0.5 m. From 22 s on (14 s after the kidnap) it is back under 10 cm, apart from one brief rise to 19 cm near 65 s. The first goal is reached around 19 s. The error decays geometrically: each second removes roughly a third of what is left, about a tenth per scan. Meanwhile the event log fills with "Replan (off path)" as the planner chases the moving estimate. NEES shows tens of thousands until the jump has dropped out of the 20 s window.
Shows: With the correct beacon named, the innovation is huge but correct, and the update $K\nu$ pulls the estimate towards the truth. It moves step by step because the gain is small. $\Sigma$ is a few centimetres, so the filter believes its own position far more than any single reading, and moves only a fraction of the way each time. A filter that could inflate $\Sigma$ when its innovations stay large would recover in one or two readings. The particle filter's injection test does that, in the third experiment. Known IDs make recovery possible but do not guarantee it. The first readings after the jump also twist the heading. On some seeds (4 and 5 of seeds 1 to 5) the estimate settles 2 to 7 m off, with the heading 20° to 60° wrong, and stays there for most of a minute. The update relies on a linearization, and that far from the truth the linearization is poor.
Predict: After the 16 m kidnap with known beacon IDs, how does the EKF recover?
- It snaps back in one or two readings
- It decays back over several seconds, a fraction per reading
- It never recovers: the readings are all gated out
Answer: 1

## Try: 2 · EKF, unlabeled
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","assoc":"unknown"},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The same filter with unlabeled beacons: nearest-neighbour association and the 99 % gate.
See: The error stays at 16 m for the whole run. The ellipse stays small ($\sigma$ about 8 cm, creeping to 30 cm after a minute). The Gated measurements counter in the status strip climbs by about 15 per second, because every reading fails the gate. The robot steers by an estimate that is in a different aisle. It hits a shelf within a few seconds, then spends the run "stuck", replanning and skipping goals one after another. After 90 s it has reached none.
Shows: The gate works as designed, and the design offers no way out. The filter rejects the very readings that would correct it. They go on being rejected until $\Sigma$ has grown enough to admit them. At the odometry rate that takes minutes, and by then the nearest beacon will often be the wrong one. A gated Gaussian filter needs an outside trigger that tells it it is lost and must start over. It cannot find that out by itself from readings it refuses to use.
Predict: With unlabeled beacons and the 99 % gate, where is the EKF estimate a minute after the kidnap?
- Back at the truth, slower than with known IDs
- Still off, but with an ellipse grown to cover the truth
- Still about 16 m off, with a small ellipse
Answer: 2

## Try: 3 · Particle filter, unlabeled
cfg: {"sim":true,"level":2,"set":{"loc":"pf","assoc":"unknown"},"tab":"loc","plot":"pos","act":"kidnap"}
Setup: The particle filter with 400 particles and unlabeled beacons, with injection on. Injection adds new particles where the readings fit, when the existing particles stop fitting them. The robot is kidnapped at 8 s.
See: The jump is about 15 m. The filter keeps two running averages of how well the readings fit its particles, a fast one and a slow one. The fast likelihood average falls from about 0.3 to 0.1 within two seconds, while the slow one stays near 0.12. In the status strip, $N_\text{eff}$ (the effective number of particles) collapses to about 15 of 400, and the injection fraction rises to its 25 % cap. New particles appear at the ranges the readings report, and by 11 s the error is 16 cm. Around 14 s the set briefly splits into two clusters ($\sigma$ jumps to 6 m for two seconds), then settles on the true one. From 16 s the error is a few centimetres, and the first goal is reached at 24 s. While the estimate is still moving, the robot touches a shelf at 12 s.
Shows: The particle filter does three things the EKF cannot. First, the particle set holds several hypotheses at once, and each particle does its own association. A particle near the true pose finds the beacons that fit it, even while the main cluster does not. Second, the filter watches whether the readings fit at all, through the fast and slow likelihood averages. That turns the same innovations the EKF throws away into a kidnap detector. Third, it can put probability mass anywhere the readings allow, by placing new particles at the measured range from a beacon. The belief can then move 15 m in one update, without any $\Sigma$ having to grow first. The split at 14 s happens because two places fit the readings for a moment, and the filter keeps both. Not every run is this quick. On seeds 1 to 5 the error is first under a metre 2 to 7 s after the kidnap. On seed 5, though, the cloud then jumps to a wrong place for 7 s before it settles.
Predict: The particle filter with injection on, unlabeled beacons, kidnapped at 8 s: when is the error back under a metre?
- Within a few seconds
- After about a minute, once the cloud has spread enough
- Never: unlabeled readings cannot relocalize it
Answer: 0

## Code: ekfUpdate, the gate
snippet: ekf-update
focus: const d2 = nu[0] * (Si[0] * nu[0] + Si[1] * nu[1]) + nu[1] * (Si[2] * nu[0] + Si[3] * nu[1]);
focus: const gate = P.assoc === 'unknown' ? 9.21 : 1e9; … continue;
example: loc/ekf
Note: $d^2$ is the Mahalanobis distance of the innovation. The gate is $\chi^2$ with two degrees of freedom at 99 %, and it applies only when the beacons are unlabeled. Edit and run loads the EKF example, which has no gate. Add one (skip the update when $d^2 > 9.21$), then kidnap the robot and compare with the lesson.

## Think about
Q: The gate rejects a correct reading 1 % of the time. What would a 99.99 % gate ($d^2 < 18.4$) change?
A: Fewer good readings would be lost, and more clutter (readings from things that are not beacons) would get through. After a kidnapping it would make no difference, because the innovations there are hundreds of $\sigma$, far beyond any gate anyone would set. The gate handles the normal case. Recovering from a gross error needs a separate mechanism.
Q: Why does the known-ID EKF recover geometrically rather than in one update?
A: The gain is $\Sigma H^\top S^{-1}$, and $\Sigma$ is a few centimetres while the innovation is metres. The filter trusts itself more than any one reading, so each update moves a fixed fraction of the remaining error. It would recover in one step only if $\Sigma$ were large. It is not, because nothing told the filter that its uncertainty had changed.
Q: Could an EKF detect its own kidnapping?
A: Yes, from the statistics of its innovations. A run of consecutive rejections, or a normalized innovation squared that stays far above its $\chi^2$ expectation, is the same signal the particle filter's fast and slow averages read. A practical EKF stack watches for it and, when it trips, re-initializes from the readings. That amounts to global localization, finding the pose from scratch.

## Check yourself
Q: A candidate beacon gives an innovation of 0.24 m in range and 0.06 rad in bearing; $S$ is diagonal with $\sigma_r = 0.08$ m and $\sigma_b = 0.03$ rad. What is $d^2$?
Answer: 13
Tolerance: 0.3
Unit: 
How: $d^2 = (0.24/0.08)^2 + (0.06/0.03)^2 = 9 + 4 = 13$. That is above 9.21, so the reading is rejected.
