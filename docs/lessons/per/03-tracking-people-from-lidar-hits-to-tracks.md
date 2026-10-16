group: per
title: Tracking people: from lidar hits to tracks

<p><b>Why this matters.</b> Everything that moves has to be found, followed and predicted, because the planner needs where a person will be, not where their hits are now. On a real robot there is no ground truth to compare against, only this chain: detection (which hits are not the map), association (which detection is which person), tracking (a filter per person) and prediction. Each link has a classic failure, and the one that matters most for a speed planner is velocity: it is never measured, only inferred, so it is late and noisy, and the prediction built on it points the wrong way for a second after every change of pace.</p>
<p><b>The idea.</b> A person is a cluster of lidar hits that the static map cannot explain. Each confirmed person gets a constant-velocity Kalman filter: the state is position and velocity, the prediction moves the position by the velocity, and the only measurement is a position. Detections are matched to predicted tracks by Mahalanobis distance inside a gate, nearest first. Three hits confirm a track, and once confirmed it coasts on its prediction for a second when the person is hidden. The prediction handed to the planner extrapolates the velocity and inflates the radius with time, to cover the error in a velocity that was only inferred.</p>
<div class="eq">x = [p_x, p_y, v_x, v_y],   x' = F x,   R from white acceleration σ_a
gate d² < 9.21;   prediction p(t) = p + v t,   r(t) = r + g t
F = [I  Δt·I;  0  I],   R = σ_a²·[Δt⁴/4·I  Δt³/2·I;  Δt³/2·I  Δt²·I],   z = p + noise,  H = [I  0],  Q = σ_z²·I
d² = ‖z − p̂‖² / (P_pp + σ_z²);   gains  k_p = P_pp / (P_pp + σ_z²),  k_v = P_pv / (P_pp + σ_z²)</div>
<p>Here Δ<i>t</i> is the time since the last scan (0.1 s), <i>z</i> the centre of a detection, <i>p̂</i> the track's predicted position, and <i>P</i><sub>pp</sub>, <i>P</i><sub>pv</sub> the position variance and position–velocity covariance, which both axes share; the update adds <i>k</i><sub>p</sub>(<i>z</i> − <i>p̂</i>) to the position and <i>k</i><sub>v</sub>(<i>z</i> − <i>p̂</i>) to the velocity.</p>
<p><b>Where it comes from.</b> Integrating a random acceleration <i>a</i> over Δ<i>t</i> adds Δ<i>t</i>²/2·<i>a</i> to position and Δ<i>t</i>·<i>a</i> to velocity, so <i>Q</i> = σ<sub>a</sub>² times the outer product of [Δ<i>t</i>²/2, Δ<i>t</i>]. With position-only measurements the Kalman gain settles to the α–β filter's steady state, set by one number, the tracking index λ = σ<sub>a</sub>Δ<i>t</i>²/σ<sub>z</sub> (0.08 here): about a third of each innovation goes into position and the velocity error decays with a time constant of about 0.5 s. <a class="chref" href="#notes=ch3/5-tracking-a-constant-velocity-kalman-filter">Derivation: chapter 3 §5</a> · detection: <a class="chref" href="#notes=ch3/4-finding-people-in-a-scan">§4</a> · prediction: <a class="chref" href="#notes=ch3/6-prediction-and-why-the-radius-grows">§6</a></p>
<p><b>What the lab does.</b> Hits are unexplained when the known map has nothing within 0.25 m (or, on a built map, no well-seen occupied cell next to them). Clusters are grown over consecutive beams (0.45 m jump, one beam gap), discarded when wider than 1.2 m, and the centroid is pushed away from the robot because lidar only sees the near side. The tracker runs at the lidar rate, 10 Hz, with σ<sub>z</sub> = 0.1 m and the process noise slider σ<sub>a</sub> (0.8 m/s² by default). Prediction uses a 4 s horizon and inflates the radius by 0.1 m/s. The ST graph in the plot area shows the speed planner's view of the predictions along the path.</p>

## Try: Lidar tracker
cfg: {"sim":true,"level":4,"tab":"per"}
Setup: L5, the busy floor: four people at 0.6 to 0.9 m/s, unlabeled beacons, the lidar tracker feeding the speed planner. Perceive tab.
See: Confirmed tracks appear as solid rings with a line to their predicted position and dashed, fading circles one per second ahead; tentative tracks are dotted. The tracker keeps up to six confirmed tracks for four people over the run (a person seen around a corner briefly becomes two), the mean error of the tracked velocity against the true one is about 0.14 m/s, and the speed planner yields four times and escalates to a replan twice. The mission reaches all five goals in about 190 s with two contacts; the closest approach is a 0.55 m overlap, a person walking into the robot from behind a shelf.
Shows: Tracks from lidar are good enough to drive by and never clean. The doubles and the velocity error are the price of inferring motion from positions 0.1 s apart; the contacts come from people the lidar could not see until they were already close, which no filter fixes. Compare a track's prediction line with the person's actual motion when someone turns around: the line follows about half a second later.
Predict: Four people walk the busy floor. How many confirmed tracks will the lidar tracker hold over the run?
- Exactly four, one per person
- Fewer than four: people behind shelves are never confirmed
- More than four at times: a person can briefly become two
Answer: 2

## Try: Ground truth tracks
cfg: {"sim":true,"level":4,"set":{"agents":"truth"},"tab":"per"}
Setup: The same run with the tracker replaced by the simulator's true positions and velocities: no detection, no association, no lag.
See: The velocity error is zero and exactly four tracks exist. The run is not simply better: one contact instead of two, but the robot also gets stuck behind a person who stops in an aisle, replans three times, skips goal 3, and clips a shelf once; four of five goals in 200 s.
Shows: The difference between the two runs is what tracking costs, and it is smaller than the difference between two seeds. Perfect tracks make the speed planner's decisions sharper, not the floor less crowded; a planner that yields correctly to a person standing in the only aisle is still stuck. Tracking quality is one term in the contact count, and on this level not the dominant one.
Predict: Replace the tracker with the simulator's true positions and velocities. What happens to the mission?
- Contacts drop to zero and all goals are reached
- A little better on contacts, but not simply better overall
- Identical: the tracker was already perfect
Answer: 1

## Try: Prediction frozen
cfg: {"sim":true,"level":4,"set":{"agPred":"static"},"tab":"per","plot":"st"}
Setup: The lidar tracker again, but the planner is handed each person's current position with zero velocity and a constant radius. The ST graph shows the result.
See: The dashed prediction circles collapse onto the track and the prediction line vanishes. The speed planner reacts only once a person is already on the path, so it brakes late: four contacts over the run, twice the tracker's, with the same five goals reached. In the ST graph the blocked regions are horizontal bars (a person in one place for the whole horizon) instead of the sloping bands of a moving one.
Shows: Prediction is worth exactly the reaction time it buys. Without it the planner is a reflex, and a reflex at 0.8 m/s against people at 0.9 m/s loses. The constant-velocity extrapolation is crude, and crude is enough here: people walk in straight lines for the 4 s that matter.
Predict: Hand the planner each person's current position with zero velocity. What happens to the contact count?
- It roughly doubles: the planner brakes late
- It stays the same: the speed planner reacts to position anyway
- It falls: a wrong velocity was misleading the planner
Answer: 0

## Think about
Q: Why is velocity so much harder than position for this tracker?
A: Position is measured directly every 0.1 s with 10 cm noise. Velocity is the difference of two such positions divided by 0.1 s: a 10 cm noise becomes a 1 m/s noise, larger than the walking speed. The filter averages that down over many updates, which is where the lag comes from. A sensor that measured velocity (Doppler radar) changes the problem completely.
Q: What does raising σ_a do, and what would you set it to for a sprinting child?
A: It tells the filter that velocity can change a lot between updates, so it trusts recent innovations more: the track follows a turn faster and jitters more in between. For a child, raise it until the lag is acceptable and accept the jitter, or better, grow the predicted radius faster to cover the uncertainty rather than chase it.
Q: A track is confirmed after three hits and coasts for one second. Why those numbers?
A: Three hits at 10 Hz is 0.3 s, long enough that a single stray cluster or a wall corner never becomes a person, short enough that a person stepping out from behind a pillar is tracked before they reach the path. One second of coasting is about one occluding pillar at walking speed; longer and a person who really left keeps blocking the planner.

## Check yourself
Q: A track's predicted position variance P_pp is 0.03 m² and the measurement noise is σ_z = 0.1 m. What is the position gain k_p?
Answer: 0.75
Tolerance: 0.02
Unit: 
How: k_p = P_pp/(P_pp + σ_z²) = 0.03/(0.03 + 0.01) = 0.75: three quarters of the innovation goes into the position
