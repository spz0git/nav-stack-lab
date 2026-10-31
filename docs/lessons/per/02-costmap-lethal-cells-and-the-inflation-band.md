group: per
title: Costmap: lethal cells and the inflation band

<p><b>Why this matters.</b> The planner never works with walls directly. It sees a cost for every cell it might enter, and the costmap turns the map into those costs. The robot's size, its margin for error and its preference for the middle of a corridor all go into that step. With too small a margin the robot scrapes shelves. With too large a margin it refuses doorways it fits through. And if every cell it has not seen counts as a wall, the planner may find no path at all.</p>
<p><b>The idea.</b> The first step is distance. Every cell needs to know how far away the nearest obstacle is, and a distance transform computes that for the whole grid in two sweeps. Then come two thresholds. Cells closer than the robot's radius plus a margin are lethal, because the robot's body would overlap something there, and the planner never enters them. Beyond them lies the inflation band, where a penalty fades out with distance. The band makes the planner prefer the middle of a corridor without forbidding the sides, so the planner still enters the band when a detour would cost more. Last, the costmap needs a policy for the cells the map has never seen. Treating them as free is optimistic: the planner plans into unexplored rooms and corrects the plan as walls appear. Treating them as lethal is cautious. The planner can then reach a goal in unseen space only by heading for the edge of the seen floor nearest the goal, and replanning as that edge moves.</p>
$$\begin{aligned} &\text{lethal if } d < 0.4\ \text{m} \quad (\text{radius } 0.3 + \text{margin}) \\ &\text{penalty} = \left(\frac{0.4 + w - d}{w}\right)^2 \ \text{ for } d < 0.4 + w \qquad \text{edge cost} = \text{length}\cdot(1 + 3\cdot\text{penalty}) \end{aligned}$$
<p><b>Where it comes from.</b> The distance transform is a two-pass chamfer. The first pass sweeps forward over the grid and gives each cell the minimum over its already-visited neighbours, with weights 1 and $\sqrt{2}$. The second pass does the same backward. The result is the shortest 8-connected distance, which is within 8 % of the Euclidean distance and never smaller. The quadratic penalty is a design choice and is not derived from anything. A move into a cell at the inner edge of the band costs four times its length, and at the outer edge it costs only its length. Because the curve is quadratic, brushing the outer part of the band is cheap and hugging the lethal boundary is expensive. <a class="chref" href="#notes=ch3/3-the-costmap-distance-transform-and-inflation">Derivation: chapter 3 §3</a></p>
<p><b>What the lab does.</b> The robot's radius is 0.3 m and the margin 0.1 m, so a cell is lethal below 0.4 m. The band width is the inflation slider (0.6 m by default), and the penalty multiplier is 3. The costmap is recomputed every 0.5 s from the log-odds map, or from the true map on levels where the map is known. The cost layer draws lethal cells dark and the band as a fading tint.</p>

## Try: Show the cost layer
cfg: {"sim":true,"level":1,"layers":{"cost":true},"tab":"per"}
Setup: L2, the warehouse with a known map, with the cost layer on and the default band of 0.6 m.
See: Every shelf and wall has a dark lethal collar 0.4 m wide, with a tinted band 0.6 m wide beyond it. Each aisle has a clear channel down the middle. The planned path runs along those channels and cuts into the band only at corners. The mission takes four A* plans, of 8.6, 13.0, 12.9 and 26.1 m. The robot never comes closer than 0.27 m to a shelf. The closest pass is at the corner at the end of a shelf row, which the robot turns about 54 s in, on the way to the last goal.
Shows: The costmap is all the planner knows about the world. The planner takes a longer route when it is cheaper, and the band sets by how much. The robot's whole shape is reduced to one radius and one margin. The car-like robot on L6 needs three circles to do the same job.
Predict: With the default 0.6 m band on the warehouse, where will the planned path run in a 2 m aisle?
- Down the middle, entering the band only at corners
- Along one side: the band penalty is symmetric
- Hugging the lethal collar to keep the path short
Answer: 0

## Try: Inflation 1.4 m
cfg: {"sim":true,"level":1,"set":{"infl":1.4},"layers":{"cost":true},"tab":"per"}
Setup: The same level with the band widened to 1.4 m, which is wider than most aisles are from their centre line.
See: The tint now fills the aisles from edge to edge, and the planner replans at once ("costmap changed"). The four legs become 9.1, 14.2, 13.3 and 27.6 m, 6 % longer in total, and the search expands about twice as many nodes. On open floor the path keeps closer to the centre. Now watch the same corner at the end of the shelf row, about 54 s in. The robot cuts it as before, and passes 0.20 m from the shelf, against 0.27 m with the default band.
Shows: When the band is wider than the corridor, every route through the corridor pays the same penalty, so the band stops steering the path and only adds cost. The closest approach comes from the path tracker cutting the corner at the end of a shelf row. The band does not change that; only the lethal radius does. Use the band for a preference about open space, and put the margin against contact in the lethal threshold.
Predict: Widening the band to 1.4 m, wider than the aisles: does the robot pass the shelf corners with more room?
- Yes: the wider band keeps it about a metre from every shelf
- No: where it cuts a corner it passes as close as before; only the lethal radius sets that
- It scrapes them: a uniform penalty no longer steers it away
Answer: 1

## Try: Unknown = lethal
cfg: {"sim":true,"level":3,"set":{"unknownAs":"lethal"},"tab":"per"}
Setup: L4, the unknown building, with unseen cells treated as obstacles.
See: The first plan fails with "goal is in unexplored space", because the map is still empty. From 2 s the robot heads for the edge of the seen floor nearest goal 1, and the event log names the point. It plans again every second as the room opens up. At 16 s goal 1 is on seen floor, and the planner plans to it. The other three goals go the same way. The robot touches an obstacle at 21 s and backs off from it at 28 s. It reaches all four goals in 83 s and 51 m, against 67 s and 50 m with unknown cells treated as free.
Shows: The cautious policy costs time, and the robot still reaches every goal. A planner that may not enter unknown cells can still be sent towards them, to the point on the edge of the seen floor nearest the goal. That point moves as the robot drives. This is called goal-directed exploration. The optimistic policy gets there sooner, because it plans through rooms it has not seen and replans when it is wrong, three times on this run. On seeds 1 to 5 the cautious run reaches all four goals every time, in 71 to 98 s, with up to two touches.
Predict: On the unknown building with unseen cells treated as lethal, what does the robot do?
- Explores the whole building first, then drives to the goals
- Does not move: every goal is in unexplored space
- Reaches the same goals as the optimistic policy, more slowly, heading each time for the edge of what it has seen nearest the goal
Answer: 2

## Code: buildCostmap
snippet: costmap
focus: cm.lethal[i] = d[i] < LETHAL ? 1 : 0; … cm.pen[i] = d[i] < LETHAL ? 1 : q > 0 ? q * q : 0;
example: plan/astar
Note: Most of the work is in the distance transform. The two marked lines turn a distance into a lethal flag and into a quadratic penalty over the inflation band. In Edit and run, the A* example reads obs.dist and adds its own penalty (the 0.6 m term). Change that number and watch the path move towards the walls or away from them.

## Think about
Q: Why is the lethal radius 0.4 m and not 0.3 m, the robot's radius?
A: The extra 0.1 m covers what the planner does not model: the tracking error, the 0.1 m cell size and the rounding in the chamfer transform. If a planned path grazed a 0.3 m boundary, the real robot would touch the obstacle whenever the tracker was a few centimetres off, and it nearly always is.
Q: The band is 0.6 m and an aisle is 2 m wide. Where does the cheapest straight path run?
A: Down the middle, 1 m from each side, where the distance is 1.0 m and the penalty is zero on both sides. Move the path 0.3 m to one side and it enters the band at $d = 0.7$ m, with a penalty of $\bigl((1.0 - 0.7)/0.6\bigr)^2 = 0.25$. That adds 75 % to the cost of those cells. Because the penalty is quadratic, the cost across the aisle is flat in the middle and rises steeply towards the sides.
Q: The cost layer is rebuilt every 0.5 s. Why not every scan?
A: A full distance transform over 38 400 cells takes a few milliseconds. That is affordable at 2 Hz and wasteful at 10 Hz, and the planner replans only when its path crosses a newly lethal cell anyway. The map itself is updated at every scan; only the cost computed from it is kept between rebuilds.

## Check yourself
Q: A cell is 0.55 m from the nearest obstacle; lethal is below 0.4 m and the band is $w = 0.6$ m. What is the cost multiplier $1 + 3\cdot\text{penalty}$ for a move entering that cell?
Answer: 2.6875
Tolerance: 0.05
Unit: 
How: $\text{penalty} = \bigl((0.4 + 0.6 - 0.55)/0.6\bigr)^2 = 0.75^2 = 0.5625$; $\text{multiplier} = 1 + 3 \times 0.5625 = 2.69$
