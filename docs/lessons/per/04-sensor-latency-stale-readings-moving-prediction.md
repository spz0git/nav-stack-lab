group: per
title: Sensor latency: stale readings, moving prediction

<p><b>Why this matters.</b> Every sensor on a vehicle delivers the past: exposure, transfer, processing, each adds tens of milliseconds, and a lidar frame can be a tenth of a second old before any software sees it. A filter that applies a reading to the current state, when the reading describes an earlier one, is not using noisy data; it is using correct data at the wrong time, which is worse, because the error is systematic and the filter has no term for it. This is why a timestamp on every reading is the first thing a real perception stack gets right, and why latency is budgeted end to end.</p>
<p><b>The idea.</b> Delay every lidar scan and beacon reading by <i>T</i><sub>s</sub> and deliver it to estimators that believe it is current. The robot has moved <i>v</i>·<i>T</i><sub>s</sub> in the meantime. For a beacon ahead, the reading says "closer than you think" by that much, every time, in the same direction. For the lidar, every hit is placed from the current pose, so the whole scan is shifted backward along the motion. The EKF turns the first into a steady bias, a biased estimate that reports itself as consistent; the map turns the second into walls drawn too close and then erased; the tracker turns it into people who appear to jump between scans.</p>
<div class="eq">reading taken at t, applied at t + T_s;   the innovation carries the motion of T_s:  ν ≈ v·T_s along the beam</div>
<p><b>Where it comes from.</b> The predicted reading uses the pose at delivery, the actual reading was made from the pose <i>T</i><sub>s</sub> earlier, and for small motion the two poses differ by <i>v</i>·<i>T</i><sub>s</sub> along the heading; project that onto the beam and it is the range innovation. Nothing in <i>S</i> = <i>H</i>Σ<i>H</i>ᵀ + <i>Q</i> accounts for it, so NEES rises exactly as it does for odometry bias. <a class="chref" href="#notes=ch3/7-latency-the-reading-is-true-the-time-is-wrong">Derivation: chapter 3 §7</a></p>
<p><b>What the lab does.</b> The sensor latency slider in the Vehicle tab delays both sensors in whole ticks (0.2 s is four ticks). The estimators are unchanged; nothing is timestamped. The cure, applying a reading at its own time by rewinding the state and replaying the odometry, is described in the chapter and not implemented, so each experiment shows the damage in one consumer.</p>

## Try: EKF, latency 0.2 s
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","sensLat":0.2},"tab":"veh","plot":"pos"}
Setup: L3 with the EKF, beacons every 0.2 s delivered 0.2 s late. Vehicle tab, Position error plot.
See: The pose error sits at 12 to 16 cm whenever the robot is driving, against 1 to 5 cm without latency, and the error is almost all along the direction of travel. The filter's σ stays at a few centimetres, so NEES reads 50 to 80 and the status strip flags it overconfident for the whole drive; the moment the mission completes and the robot stops, NEES drops to 2.7. All five goals are still reached, in the same time.
Shows: The same signature as odometry bias in the localization lessons, from a different cause: a reading that is right about a pose the robot no longer occupies. 0.8 m/s × 0.2 s = 16 cm is the whole effect, and it is invisible to the filter because it never enters any noise model. The mission survives because the error is constant and the planner does not care about 15 cm; a gate would.
Predict: Beacon readings delivered 0.2 s late to the EKF at 0.8 m/s: how large will the position error be while driving?
- A few centimetres: the filter averages the delay away
- Around 15 cm, mostly along the direction of travel
- Metres, growing with time like dead reckoning
Answer: 1

## Try: Particle filter, latency 0.2 s
cfg: {"sim":true,"level":4,"set":{"sensLat":0.2},"tab":"veh","plot":"pos"}
Setup: L5 with its particle filter, lidar tracker and speed planner, everything delivered 0.2 s late.
See: The pose error is 10 to 18 cm and NEES is in the hundreds. The tracker is where it shows: because every scan is shifted by the robot's motion since it was taken, a person's hits jump between scans whenever the robot turns, fail the gate, and start new tracks. The tracker creates dozens of confirmed tracks for four people over the run (37 at peak), the speed planner yields to agents numbered in the hundreds, and the mission replans 29 times instead of twice. It still completes, with two contacts.
Shows: Latency is not one error, it is one per consumer. The particle filter copes, because its lidar term is tempered and injection repairs what the stale beacons break. The tracker cannot cope, because its gate is built from a 10 cm measurement noise and the latency shift is twice that. Any stack that fuses sensors at different latencies without timestamps builds ghosts.
Predict: Everything on the busy floor is delivered 0.2 s late. Which consumer suffers most?
- The particle filter: the pose error grows to metres
- None: 0.2 s is below every noise model
- The people tracker: hits jump between scans and tracks multiply
Answer: 2

## Try: Mapping with latency 0.3 s
cfg: {"sim":true,"level":3,"set":{"sensLat":0.3},"tab":"per"}
Setup: L4, mapping the building with the EKF, scans delivered 0.3 s late: a shift of 24 cm at cruise speed.
See: Walls perpendicular to the motion are painted about a quarter of a metre too close, then partly erased by the next scan from further on, so they come out thin and broken; 97 % of mapped occupied cells are still near a real obstacle but only 84 % of the seen obstacle cells make it into the map, against 96 % without latency. The planner replans seven times instead of three as walls appear and disappear. Four of four goals.
Shows: For a map, latency acts like a pose error that depends on the motion: zero when stopped, largest at speed and in turns. The erase-and-redraw churn is what makes the planner replan twice as often. Timestamping the scan and placing its hits from the pose at scan time fixes it entirely, at the cost of keeping a short history of poses, which every real mapping stack does.
Predict: Mapping the building with scans 0.3 s late at cruise speed: what happens to the walls in the map?
- Drawn too close to the robot, then partly erased
- Drawn in the right place: latency only delays them
- Drawn too far away, beyond their true position
Answer: 0

## Code: sensDeliver
snippet: sens-deliver
focus: if (it.due > S.tick) { … continue;
Note: Every reading is queued with a due tick; a reading whose tick has not come is kept, so the filter sees the world as it was latency ago. A localizer in the Code tab gets obs.beacons and obs.scan from this queue, already late.

## Think about
Q: Why does the EKF's NEES recover when the robot stops but the map does not?
A: The EKF's latency error is proportional to speed, so it vanishes at rest and the filter is instantly consistent again. The map keeps everything it was told: the walls drawn 24 cm too close are still there until enough free beams erase them, and the walls it failed to draw are still missing.
Q: Which is more dangerous: 0.2 s of latency on the beacons or on the lidar?
A: On this floor, the lidar: the beacons bias the pose by 16 cm, which the planner tolerates, while the lidar shift breaks the people tracker's association and the planner then reacts to ghosts. In general, whichever sensor feeds the consumer with the tightest gate.
Q: What would a lagged-state filter need to store?
A: The pose estimate (or the odometry increments) for at least the maximum latency, so that a reading stamped at t − T_s can be applied to the state at t − T_s and the increments since then replayed. At 20 Hz and 0.3 s that is six poses; the cost is trivial, the discipline of timestamping everything is the real work.

## Check yourself
Q: The robot drives at 1.2 m/s toward a beacon straight ahead and the sensor latency is 0.25 s. By how much does each range reading disagree with the filter's prediction, in metres?
Answer: 0.3
Tolerance: 0.01
Unit: m
How: ν ≈ v·T_s = 1.2 m/s × 0.25 s = 0.30 m, every reading, in the same direction
