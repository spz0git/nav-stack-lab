group: per
title: Log-odds mapping

<p><b>Why this matters.</b> A robot that has to work in a building it has not seen must build its own map while driving, and everything downstream, the costmap, the planner, the people detector, reads that map as if it were true. Two decisions shape it: how to combine thousands of noisy beams per second into a belief per cell without the cost exploding, and whose coordinates to draw it in. The first has an elegant answer, log-odds. The second has no answer at all: the map is drawn in the frame of the pose estimate, so every localization error becomes a map error, permanently. This lesson shows both.</p>
<p><b>The idea.</b> Cut the floor into 0.1 m cells and ask of each one: occupied or not? Each lidar beam is a small piece of evidence. The cells it crosses are probably free (the beam went through them), the cell it ends in is probably occupied (something stopped it). Bayes' rule says how to combine evidence, but applying it as probabilities means a multiply and a renormalization per cell per beam. Written in log-odds, the logarithm of the probability ratio occupied to free, the same update is one addition: evidence simply adds up, and a cell seen a thousand times costs no more than one seen once. A cap on the log-odds keeps any cell from becoming so certain that it can never be corrected when the pallet moves.</p>
<div class="eq">l ← clamp(l + l_meas, ±4),   l_free = −0.4,   l_hit = +0.85
occupied if l > 0.5;   unknown while l ≈ 0
l = ln(p / (1 − p)),   p = 1 / (1 + e^(−l))
inverse sensor model:  l_meas = l_hit for the cell a returned beam ends in,  l_free for every other cell it crosses
                       (a beam at maximum range adds l_free to all of its cells)</div>
<p><b>Where it comes from.</b> Apply Bayes' rule to the cell being occupied and to it being free, divide the two, and the normalizer cancels; take the logarithm and the product of evidence becomes a sum. With a 50 % prior the prior term is zero and the update is just <i>l</i> + <i>l</i><sub>meas</sub>. <a class="chref" href="#notes=ch3/2-occupancy-mapping-as-a-binary-bayes-filter">Derivation: chapter 3 §2</a></p>
<p><b>What the lab does.</b> The lidar has 120 beams over 360°, 8 m range, 10 Hz, 2 cm noise. Every scan, each beam is traced cell by cell from the robot to its end point with Bresenham's algorithm and the cells get −0.4 (crossed) or +0.85 (end, if the beam returned); the values correspond to "40 % occupied" and "70 % occupied", so one hit is enough to call a cell occupied and it takes about two clean passes to undo it. The cap of ±4 is 98 %. The costmap is rebuilt from the log-odds every 0.5 s and the planner replans whenever a newly occupied cell lands on its path. The map is drawn in the <i>estimated</i> frame, from the pose the EKF with beacons reports on this level; the true map is shown faintly underneath as a ghost so you can compare.</p>

## Try: Map the building (EKF)
cfg: {"sim":true,"level":3,"tab":"per"}
Setup: L4, the unknown building, with the EKF on beacons for localization and mapping on. Perceive tab; the map layer shows the log-odds grid, dark for occupied, light for free, grey for unseen.
See: The map grows outward from the robot as it drives, walls appearing as thin dark lines within a scan or two of coming into range. Each newly discovered wall across the planned path triggers a "Replan (path blocked)" in the event log, three in this run, and the mission reaches all four goals in about 80 s with the pose error under 5 cm throughout. Measured against the truth, 100 % of the cells the map calls occupied have a real obstacle within one cell, and 96 % of the obstacle cells the lidar has seen are in the map.
Shows: With a good pose the log-odds map is almost exact, and it is cheap: 1200 beam traces per second on a 38 400-cell grid. Note how walls thicken slightly where the robot saw them from several places; that is the discretization, not the sensor. Watch the ghost: everywhere the robot has been, the two agree.
Predict: Mapping the building with the EKF on beacons: how much of what the map calls occupied will have a real obstacle within a cell?
- About half: walls seen from several places smear
- About three quarters: lidar noise paints phantom cells
- Nearly all of it
Answer: 2

## Try: Map with dead reckoning
cfg: {"sim":true,"level":3,"set":{"loc":"dr"},"tab":"per"}
Setup: The same level with localization switched to dead reckoning (odometry noise ×1, bias ×0.5 on this level).
See: The map and the ghost separate as the pose drifts: 1.4 m off by 40 s, 3.8 m by 80 s. Walls are painted as parallel ghosts of themselves, later scans erase parts of earlier walls, and the map ends up with fragments that do not exist and gaps where walls do. Only 23 % of the mapped occupied cells are near a real obstacle, and only 18 % of the seen obstacle cells are mapped. The planner replans ten times, reports "no path to goal 3" three times in a row from a costmap full of phantom walls, skips two of the four goals, and the run ends with two reached.
Shows: The map does not degrade gracefully with pose error; it fills with contradictions, because every scan is drawn in a different wrong frame. A planner then has to route around walls that are not there, and may be unable to route through a doorway that is. This is why SLAM (chapter 2 §8) exists: if the map must be built, the pose must be estimated against it, not alongside it.
Predict: Switch localization to dead reckoning and map the same building. What does the map look like after 80 s?
- Slightly blurred walls, still usable by the planner
- Walls doubled and broken; most mapped cells are phantoms
- The same map, shifted as a whole by the pose drift
Answer: 1

## Try: Hide the true-map ghost
cfg: {"sim":true,"level":3,"layers":{"ghost":false},"tab":"view"}
Setup: The EKF run again with the ghost layer off (Layers tab), so the map shows only what the robot believes.
See: The same run as the first experiment, without the answer key: grey unknown space, walls that end where the lidar stopped seeing them, rooms that do not exist yet.
Shows: This is what the planner sees. Everything it decides about unseen rooms comes from the unknown-cell policy of the next lesson, not from the map.
Predict: With the ghost layer off, what fills the parts of the map the lidar has not reached yet?
- Free space, since nothing was seen there
- Walls, since unseen cells count as obstacles
- Grey unknown cells
Answer: 2

## Think about
Q: Why use log-odds instead of storing a probability per cell?
A: Because Bayes' rule for a binary cell becomes an addition in log-odds, with no normalization, and the clamp is a simple cap. Storing probabilities would need a multiply, a renormalize and care near 0 and 1 for every one of the thousand beams per second. Log-odds also make the asymmetry explicit: +0.85 for a hit against −0.4 for a crossing is a design choice about which error is cheaper.
Q: A person stands still in a corridor for ten seconds. What happens to the map and the tracker?
A: Their hits land in the same cells for a hundred scans and the cells saturate at +4: the person becomes a wall. The people detector only looks at hits the map cannot explain, so the track is dropped. When they walk away, the cells need about ten free beams each to be erased, and until then the planner routes around an obstacle that has left. Real stacks keep a separate short-memory layer for dynamic obstacles for exactly this reason.
Q: Could the map be built in the true frame instead?
A: Only in a simulator. On a real robot there is no true frame, there is the estimate, and the map inherits whatever error it has. The honest options are to make the estimate good (beacons, loop closure) or to estimate the pose against the map as it is built (SLAM), so that at least map and pose are consistent with each other even when both are off.

## Check yourself
Q: A cell starts at l = 0, is the end point of 3 returned beams (+0.85 each) and is then crossed by 5 beams (−0.4 each). What is its log-odds afterwards?
Answer: 0.55
Tolerance: 0.01
Unit: 
How: l = 3 × 0.85 − 5 × 0.4 = 2.55 − 2.0 = 0.55, still just above the 0.5 threshold: occupied
