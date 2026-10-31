group: per
title: Log-odds mapping

<p><b>Why this matters.</b> A robot that has to work in a building it has not seen must build its own map while it drives. Everything downstream reads that map as if it were true: the costmap, the planner and the people detector. Two decisions shape the map. The first is how to combine thousands of noisy beams per second into a belief for each cell without the cost growing out of hand, and log-odds answer it. The second is whose coordinates to draw the map in, and it has no good answer. The map is drawn in the frame of the pose estimate, so every localization error becomes a map error, and the error stays in the map. This lesson shows both.</p>
<p><b>The idea.</b> Cut the floor into 0.1 m cells, and keep for each cell a belief that it is occupied. Each lidar beam is a small piece of evidence. The cells it crosses are probably free, because the beam went through them. The cell it ends in is probably occupied, because something stopped the beam. Bayes' rule says how to combine the evidence. Applied to probabilities, it costs a multiplication and a renormalization per cell per beam. Written in log-odds, the same update is one addition. The log-odds of a cell is the logarithm of the probability that it is occupied divided by the probability that it is free. The evidence adds up, and a cell seen a thousand times costs no more than one seen once. A cap on the log-odds stops any cell from becoming so certain that it can never be corrected, for example when someone moves a pallet.</p>
$$\begin{aligned} l &\leftarrow \operatorname{clamp}(l + l_\text{meas},\ \pm 4) \qquad l_\text{free} = -0.4 \qquad l_\text{hit} = +0.85 \\ l &= \ln\frac{p}{1 - p} \qquad\qquad p = \frac{1}{1 + e^{-l}} \end{aligned}$$
<p>A cell is occupied if $l > 0.5$ and unknown while $l \approx 0$. The inverse sensor model gives the evidence a beam adds to each cell: $l_\text{meas} = l_\text{hit}$ for the cell a returned beam ends in, and $l_\text{free}$ for every other cell it crosses. A beam at maximum range hit nothing, so it adds $l_\text{free}$ to all of its cells.</p>
<p><b>Where it comes from.</b> Apply Bayes' rule twice, once to the cell being occupied and once to it being free, and divide one result by the other. The normalizer cancels. Take the logarithm, and the product of the evidence becomes a sum. With a 50 % prior the prior term is zero, so the update is $l + l_\text{meas}$. <a class="chref" href="#notes=ch3/2-occupancy-mapping-as-a-binary-bayes-filter">Derivation: chapter 3 §2</a></p>
<p><b>What the lab does.</b> The lidar has 120 beams over 360°, a range of 8 m, a rate of 10 Hz and 2 cm of noise. At every scan, each beam is traced cell by cell from the robot to its end point with Bresenham's algorithm. Each cell the beam crosses gets −0.4, and the end cell gets +0.85 if the beam returned. These values correspond to "40 % occupied" and "70 % occupied". One hit is enough to call a cell occupied, and it takes about two clean passes to undo it. The cap of ±4 is 98 %. The costmap is rebuilt from the log-odds every 0.5 s, and the planner replans whenever a newly occupied cell lands on its path. The map is drawn in the <i>estimated</i> frame, from the pose that the EKF with beacons reports on this level. The true map is drawn faintly underneath as a ghost, so you can compare the two. All numbers below are for seed 7, over one mission of about a minute.</p>

## Try: Map the building (EKF)
cfg: {"sim":true,"level":3,"tab":"per"}
Setup: L4, the unknown building, with mapping on and the EKF on beacons for localization. The Perceive tab is open. The map layer shows the log-odds grid, dark for occupied, light for free and grey for unseen.
See: The map grows outward from the robot as it drives. A wall appears as a thin dark line within a scan or two of coming into range. Each newly found wall across the planned path puts a "Replan (path blocked)" in the event log, three times in this run. The mission reaches all four goals in about 67 s. The pose error stays mostly under 5 cm and peaks at 12 cm, 47 s in. Measured against the truth, 100 % of the cells the map calls occupied have a real obstacle within one cell, and 96 % of the obstacle cells the lidar has seen are in the map.
Shows: With a good pose the log-odds map is almost exact, and it is cheap to keep: 1200 beam traces per second on a 38 400-cell grid. Walls are slightly thicker where the robot saw them from several places. That comes from cutting the floor into cells, not from the sensor. Everywhere the robot has been, the map and the ghost agree.
Predict: Mapping the building with the EKF on beacons: how much of what the map calls occupied will have a real obstacle within a cell?
- About half: walls seen from several places smear
- About three quarters: lidar noise paints phantom cells
- Nearly all of it
Answer: 2

## Try: Map with dead reckoning
cfg: {"sim":true,"level":3,"set":{"loc":"dr"},"tab":"per"}
Setup: The same level with localization switched to dead reckoning (odometry noise ×1, bias ×0.5 on this level).
See: The map and the ghost separate as the pose drifts. The pose is 1.4 m off by 40 s and 3.8 m off at the end of the run, 64 s in. Each wall is painted again as a parallel copy of itself, and later scans erase parts of earlier walls. By the end the map has pieces of walls that do not exist, and gaps where real walls are. Only 22 % of the mapped occupied cells are near a real obstacle, and only 18 % of the seen obstacle cells are mapped. The planner replans ten times. It reports "no path to goal 3" three times in a row, because the costmap is full of phantom walls, and it skips two of the four goals. The run ends with two goals reached.
Shows: As the pose error grows, the map fills with contradictions instead of just getting blurrier, because every scan is drawn in a different wrong frame. The planner then has to route around walls that are not there, and may find no way through a doorway that is. SLAM (chapter 2 §8) was developed for this case. When the robot has to build the map, it estimates its pose against that map as it goes, and not separately from it.
Predict: Switch localization to dead reckoning and map the same building. What does the map look like by the end of the run?
- Slightly blurred walls, still usable by the planner
- Walls doubled and broken; most mapped cells are phantoms
- The same map, shifted as a whole by the pose drift
Answer: 1

## Try: Hide the true-map ghost
cfg: {"sim":true,"level":3,"layers":{"ghost":false},"tab":"view"}
Setup: The EKF run again with the ghost layer off (Layers tab), so the map shows only what the robot believes.
See: This is the same run as the first experiment, without the true map to compare against. You see grey unknown space, walls that end where the lidar stopped seeing them, and rooms that are not in the map yet.
Shows: This is what the planner sees. The map says nothing about rooms the robot has not seen, so what the planner decides about them comes from its policy for unknown cells, which is in the next lesson.
Predict: With the ghost layer off, what fills the parts of the map the lidar has not reached yet?
- Free space, since nothing was seen there
- Walls, since unseen cells count as obstacles
- Grey unknown cells
Answer: 2

## Code: integrateScan
snippet: logodds
focus: lo[idx] = clamp(lo[idx] + (last && hit ? L_OCC : L_FREE), -L_CLAMP, L_CLAMP);
Note: The marked line is the update this lesson is about. Every cell on the beam gets L_FREE added, the last one gets L_OCC instead if the beam hit something, and the value is clamped. The rest is Bresenham's walk from the robot's cell to the end point (rayCells), and the virtual rays between neighbouring beams. The virtual rays only add free evidence, to fill the gaps that the 3° spacing leaves beyond about 2 m. Perception has no code slot; the planner slot sees the result as obs.lethal.

## Think about
Q: Why use log-odds instead of storing a probability per cell?
A: In log-odds, Bayes' rule for a binary cell becomes an addition with no normalization, and the clamp is a cap on one number. With probabilities, each of the thousand beams per second would need a multiplication, a renormalization and care near 0 and 1. Log-odds also make the asymmetry visible. Giving a hit +0.85 and a crossing −0.4 is a design choice about which error is cheaper.
Q: A person stands still in a corridor for ten seconds. What happens to the map and the tracker?
A: Their hits land in the same cells for a hundred scans, and the cells saturate at +4, so the person becomes a wall in the map. The people detector looks only at hits the map cannot explain, so it drops the track. When the person walks away, each of those cells needs about ten free beams to be erased. Until then the planner routes around an obstacle that has left. Real stacks keep moving obstacles in a separate layer with a short memory to avoid this.
Q: Could the map be built in the true frame instead?
A: Only in a simulator. A real robot has only its estimate of the pose, and the map inherits whatever error the estimate has. There are two options. One is to make the estimate good, with beacons or loop closure. The other is to estimate the pose against the map while the map is built (SLAM). Then the map and the pose at least agree with each other, even when both are off.

## Check yourself
Q: A cell starts at $l = 0$, is the end point of 3 returned beams (+0.85 each) and is then crossed by 5 beams (−0.4 each). What is its log-odds afterwards?
Answer: 0.55
Tolerance: 0.01
Unit: 
How: $l = 3 \times 0.85 - 5 \times 0.4 = 2.55 - 2.0 = 0.55$. That is just above the 0.5 threshold, so the cell is still occupied.
