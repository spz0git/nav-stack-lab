group: per
title: Sensor latency: stale readings, moving prediction

<p><b>Why this matters.</b> Every reading a sensor delivers describes the past. Exposure, transfer and processing each add tens of milliseconds, and a lidar frame can be a tenth of a second old before any software sees it. Suppose a filter applies a reading to the current state when the reading describes an earlier one. The data is correct, but it is used at the wrong time. That is worse than noise, because the error is systematic and the filter has no term for it. A real perception stack therefore puts a timestamp on every reading first of all, and keeps a latency budget for the whole chain from sensor to motors.</p>
<p><b>The idea.</b> Delay every lidar scan and beacon reading by $T_s$, and deliver it to estimators that believe it is current. In the meantime the robot has moved $v\,T_s$. For a beacon ahead, the reading says "closer than you think" by that much, every time and in the same direction. For the lidar, every hit is placed from the current pose, so the whole scan is shifted backward along the motion. Each consumer goes wrong in its own way. The EKF settles into a steady bias, a biased estimate that reports itself as consistent. The map gets walls drawn too close and then erased. The tracker sees people who appear to jump between scans.</p>
<p>A reading taken at $t$ is applied at $t + T_s$, so the innovation contains the motion during $T_s$, measured along the beam:</p>
$$\nu \approx v\,T_s$$
<p><b>Where it comes from.</b> The predicted reading uses the pose at delivery, and the actual reading was made from the pose $T_s$ earlier. For small motion the two poses differ by $v\,T_s$ along the heading. Projected onto the beam, that difference is the range innovation. Nothing in $S = H\Sigma H^\top + Q$ accounts for it, so NEES rises in the same way as it does for odometry bias. <a class="chref" href="#notes=ch3/7-latency-the-reading-is-true-the-time-is-wrong">Derivation: chapter 3 §7</a></p>
<p><b>What the lab does.</b> The sensor latency slider in the Vehicle tab delays both sensors by a whole number of ticks (0.2 s is four ticks). The estimators are unchanged, and nothing is timestamped. The fix is to apply each reading at its own time, by rewinding the state and replaying the odometry since then. The chapter describes it, but the lab does not implement it, so each experiment shows the damage to one consumer.</p>

## Try: EKF, latency 0.2 s
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","sensLat":0.2},"tab":"veh","plot":"pos"}
Setup: L3 with the EKF. Beacon readings come every 0.2 s and are delivered 0.2 s late. The Vehicle tab is open, with the Position error plot.
See: The pose error sits at 10 to 18 cm whenever the robot is driving, against mostly 1 to 7 cm without latency. Almost all of it is along the direction of travel. The filter's $\sigma$ stays at a few centimetres. NEES in the metrics, the average over the last 20 s, therefore reads 17 to 115 and flags the filter as overconfident for the whole drive. When the mission completes at 92 s and the robot stops, the error falls to 1 or 2 cm within seconds. The 20 s average is back to about 3 some 25 s later. All five goals are still reached, in the same time.
Shows: This looks the same as odometry bias in the localization lessons, but the cause is different. Each reading is right about a pose the robot has already left. The whole effect is 0.8 m/s × 0.2 s = 16 cm, and the filter cannot see it, because it is in none of the filter's noise models. The mission survives because the error is constant and 15 cm does not matter to the planner. It would matter to a gate that expects a few centimetres of error.
Predict: Beacon readings delivered 0.2 s late to the EKF at 0.8 m/s: how large will the position error be while driving?
- A few centimetres: the filter averages the delay away
- Around 15 cm, mostly along the direction of travel
- Metres, growing with time like dead reckoning
Answer: 1

## Try: Particle filter, latency 0.2 s
cfg: {"sim":true,"level":4,"set":{"sensLat":0.2},"tab":"veh","plot":"pos"}
Setup: L5 with its particle filter, lidar tracker and speed planner, and every reading delivered 0.2 s late.
See: The pose error is 10 to 20 cm while driving, and NEES is in the hundreds. Between 54 and 63 s, while the robot waits among people, the particle filter's $\sigma$ jumps past a metre again and again. The log shows "holding and turning in place" nineteen times in nine seconds. Each time the true error reaches 1.3 m and snaps back. Two shorter spells follow at 69 and 96 s, reaching 1.5 m. The damage is largest in the tracker. Every scan is shifted by the robot's motion since it was taken, so whenever the robot turns, a person's hits jump between scans, fail the gate and start new tracks. Over the run the tracker confirms hundreds of tracks for four people, with 37 at once at the peak. The speed planner yields to agents numbered in the hundreds. The mission replans 29 times instead of twice, and 25 of those are "relocalized" replans after the particle filter's jumps. It still completes, in about 130 s, with one contact, a person walking into the robot while it waits.
Shows: Latency causes a different error in each consumer. The particle filter mostly copes. Its lidar term is tempered, so no single scan can pull the particles far, and injection repairs what the stale beacons break. Each repair is a jump in the estimate, and the planner answers each jump with a replan. The tracker cannot cope, because its gate is built for 10 cm of measurement noise and the latency shift is twice that. A stack that fuses sensors with different latencies and no timestamps will see ghosts. How much the particle filter suffers changes from seed to seed. At seeds 2 and 5 it is lost by 6 and 10 m for a while, and at seeds 3 and 4 it never strays more than 23 cm. The tracker multiplies its tracks on every seed, with 15 to 49 confirmed at once for four people.
Predict: Everything on the busy floor is delivered 0.2 s late. Which consumer breaks on every run, whatever the seed?
- The particle filter: the pose error grows to metres
- None: 0.2 s is below every noise model
- The people tracker: hits jump between scans and tracks multiply
Answer: 2

## Try: Mapping with latency 0.3 s
cfg: {"sim":true,"level":3,"set":{"sensLat":0.3},"tab":"per"}
Setup: L4, mapping the building with the EKF, with scans delivered 0.3 s late. At cruise speed that is a shift of 24 cm.
See: Walls across the direction of motion are painted about a quarter of a metre too close. The next scan, taken further on, partly erases them, so they come out thin and broken. Of the mapped occupied cells, 97 % are still near a real obstacle, but only 83 % of the seen obstacle cells make it into the map, against 96 % without latency. The planner replans seven times instead of three as walls appear and disappear. All four goals are reached.
Shows: For a map, latency acts like a pose error that depends on the motion. It is zero when the robot stands still, and largest at speed and in turns. The walls being erased and redrawn make the planner replan twice as often. The fix is to timestamp each scan and place its hits from the pose at the time of the scan. That removes the effect completely, and it only needs a short history of poses, which every real mapping stack keeps.
Predict: Mapping the building with scans 0.3 s late at cruise speed: what happens to the walls in the map?
- Drawn too close to the robot, then partly erased
- Drawn in the right place: latency only delays them
- Drawn too far away, beyond their true position
Answer: 0

## Code: sensDeliver
snippet: sens-deliver
focus: if (it.due > S.tick) { … continue;
Note: Every reading is queued with the tick at which it is due. A reading whose tick has not come yet stays in the queue, so the filter sees the world as it was one latency ago. A localizer in the Code tab gets obs.beacons and obs.scan from this queue, already late.

## Think about
Q: Why does the EKF's NEES recover when the robot stops but the map does not?
A: The EKF's latency error is proportional to speed. It vanishes when the robot stops, and the filter is consistent again within seconds. The map keeps everything it was told. The walls drawn 24 cm too close stay there until enough free beams erase them, and the walls it failed to draw are still missing.
Q: Which is more dangerous: 0.2 s of latency on the beacons or on the lidar?
A: On this floor, latency on the lidar. Late beacons bias the pose by 16 cm, which the planner tolerates. A late lidar breaks the people tracker's association, and the planner then reacts to ghosts. In general, latency does the most harm on the sensor that feeds the consumer with the tightest gate.
Q: What would a lagged-state filter need to store?
A: It stores the pose estimate, or the odometry increments, over at least the maximum latency. A reading stamped at $t - T_s$ can then be applied to the state at $t - T_s$, and the increments since then replayed. At 20 Hz and 0.3 s that is six poses, which cost almost nothing to store. The hard part is putting a timestamp on every reading in the stack.

## Check yourself
Q: The robot drives at 1.2 m/s toward a beacon straight ahead and the sensor latency is 0.25 s. By how much does each range reading disagree with the filter's prediction, in metres?
Answer: 0.3
Tolerance: 0.01
Unit: m
How: $\nu \approx v\,T_s = 1.2\ \text{m/s} \times 0.25\ \text{s} = 0.30$ m, for every reading and in the same direction.
