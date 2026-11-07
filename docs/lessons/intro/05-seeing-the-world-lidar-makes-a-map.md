group: intro
title: Seeing the world: lidar makes a map
level: 1

<p><b>Why this matters.</b> On the first floors the robot was handed the map. A robot in a new building has to draw its own, from what its sensors see as it drives. The most common sensor for this is a lidar, a spinning laser that measures the distance to whatever each ray hits. Turning thousands of such distances into a map the planner can use is the job of the perception step.</p>
<p><b>The idea.</b> Cut the floor into small square cells, and keep for each cell a belief that it is occupied. At first every cell is unknown. Each lidar ray, called a beam, tells two things. The cells it passes through are probably free, because the light got through. The cell where it ends is probably occupied, because something reflected it. So every beam nudges the cells along it towards free and the last one towards occupied. One beam is not proof, since a reading can be noisy, but beams from many scans pile up evidence, and the cells settle. A cell that no beam has reached keeps its unknown value, however long the robot drives nearby. The result is an occupancy grid.</p>
<p><b>What the lab does.</b> L4 is an unknown building with rooms and doorways. The lidar has 120 beams all the way round, a reach of 8 m and ten scans a second. The cells are 0.1 m. The map layer draws occupied cells dark, free cells light and unknown cells grey. The true-map outline (the ghost) is drawn on top, so you can compare. The robot localizes with an EKF on beacons, as in lesson 3, so it knows where it is while it maps. The Metrics list shows <i>Floor seen</i>, the share of the real floor whose cells are no longer unknown.</p>
<p><b>Where it comes from.</b> Each cell holds its belief as log-odds $l$, the logarithm of the odds that it is occupied. Evidence then simply adds, and the probability comes back from $l$:</p>
$$l \leftarrow l + l_\text{beam}, \qquad p = \frac{1}{1 + e^{-l}}$$
<p>A beam passing through adds a negative $l_\text{beam}$, a beam ending adds a positive one, and $l = 0$ means unknown ($p = 0.5$). Go deeper: <a class="lsref" href="#lesson=per:1">Log-odds mapping</a> · <a class="chref" href="#notes=ch3/2-occupancy-mapping-as-a-binary-bayes-filter">occupancy mapping as a Bayes filter: chapter 3 §2</a></p>

## Try: Map the building
cfg: {"sim":true,"level":3,"tab":"per"}
Setup: L4, the unknown building, with mapping on and the EKF on beacons. The Perceive tab is open.
See: The map grows outward from the robot. A wall appears as a dark line within a scan or two of coming into range, and the light free floor spreads out from the robot as far as the beams reach. Rooms the robot has not looked into stay grey. Floor seen is 33 % after 10 s and 96 % when the mission completes, at 67 s. Where the robot has been, the dark cells sit on the ghost's walls.
Shows: With a good position estimate, the map is close to exact: 96 % of the walls the lidar has seen are in the map. The grey that is left is floor no beam has reached, behind walls and in corners. A lidar maps only what it can see.
Predict: The robot drives past a closed room without looking in. What does the map show inside that room?
- Light (free), because the robot assumes empty space
- Grey (unknown), until a beam gets in through a doorway
- Dark (occupied), because the room is walled in
Answer: 1

## Try: Hide the true map
cfg: {"sim":true,"level":3,"layers":{"ghost":false},"tab":"view"}
Setup: The same run with the true-map outline switched off (Layers tab), so the map shows only what the robot believes.
See: Walls end where the lidar stopped seeing them, and unseen rooms are blank grey. The planner still plans through grey space. When a wall turns up across the planned path, the event log reads “Replan (path blocked)” and the path bends around it: three times on this run, at 4, 13 and 31 s.
Shows: This is what the planner sees. Here it treats unknown cells as free: it is optimistic, plans through rooms it has not seen and corrects itself when a wall appears. On seeds 1 to 4 that happens two to four times per run. The next lesson turns the map into the costs the planner actually uses.
Predict: What does the planner do with the grey, unknown cells?
- It treats them as free, plans through them, and replans when a wall appears
- It treats them as walls and only plans through cells it has seen
- It waits until the whole building is mapped before planning
Answer: 0

## Think about
Q: Why does a wall look slightly thicker in places the robot saw it from several angles?
A: The cells are 0.1 m, and a beam's end is rounded to the cell it falls in. Beams that hit the same wall from different angles end in slightly different cells, so the dark line is one or two cells thick. That comes from cutting the floor into cells, not from the lidar's noise, which is only about 2 cm.

## Check yourself
Q: In the first experiment, what does Floor seen in the Metrics list read when the mission completes?
Answer: 96
Tolerance: 2
Unit: %
How: Floor seen reaches 96 % at 67 s, when the last goal is reached. The 4 % left is floor no beam has reached.
