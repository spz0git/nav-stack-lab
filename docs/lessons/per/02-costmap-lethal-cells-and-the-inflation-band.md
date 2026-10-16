group: per
title: Costmap: lethal cells and the inflation band

<p><b>Why this matters.</b> A planner does not see walls; it sees a cost for every cell it might enter. That translation, from a map to a cost, is where a robot's size, its margin for error and its taste for the middle of corridors are encoded. Get it wrong one way and the robot scrapes shelves; the other way and it refuses doorways it fits through, or plans nowhere at all because everything it has not seen is treated as a wall.</p>
<p><b>The idea.</b> First, distance: every cell needs to know how far the nearest obstacle is. A distance transform computes that for the whole grid in two sweeps. Then two thresholds. Cells closer than the robot's radius plus a margin are lethal: the body would overlap something there, no matter the cost. Beyond that, a penalty that fades out across the inflation band makes the planner prefer the middle of a corridor without forbidding the sides; it will enter the band when the detour would cost more. Finally, a policy for the cells the map has never seen: free, which plans optimistically into unexplored rooms and corrects as walls appear, or lethal, which is cautious and cannot plan anywhere new on its own.</p>
<div class="eq">lethal if d < 0.4 m (radius 0.3 + margin)
penalty = ((0.4 + w − d)/w)²  for d < 0.4 + w,   edge cost = length · (1 + 3 · penalty)</div>
<p><b>Where it comes from.</b> The distance transform is a two-pass chamfer: sweep forward taking the minimum over already-visited neighbours with weights 1 and √2, then sweep backward; the result is the shortest 8-connected distance, within 8 % of the Euclidean one and never smaller. The quadratic penalty is a choice, not a derivation: a cell at the inner edge costs four times its length, at the outer edge nothing, and the curvature in between means brushing the band is cheap and hugging the lethal boundary is not. <a class="chref" href="#notes=ch3/3-the-costmap-distance-transform-and-inflation">Derivation: chapter 3 §3</a></p>
<p><b>What the lab does.</b> Robot radius 0.3 m, margin 0.1 m, so lethal below 0.4 m. The band width is the inflation slider (0.6 m by default), and the penalty multiplier is 3. The costmap is recomputed every 0.5 s from the log-odds map (or from the true map on levels with a known map). The cost layer draws lethal cells dark and the band as a fading tint.</p>

## Try: Show the cost layer
cfg: {"sim":true,"level":1,"layers":{"cost":true},"tab":"per"}
Setup: L2, the warehouse with a known map, with the cost layer on. Default band of 0.6 m.
See: Every shelf and wall wears a dark lethal collar 0.4 m wide and a tinted band 0.6 m beyond it; the aisles have a clear channel down the middle. The planned path runs along those channels and cuts into the band only at corners. The mission takes four A* plans of 8.6, 13.0, 12.9 and 26.1 m and the robot never comes closer than 0.27 m to a shelf.
Shows: The costmap is the planner's whole view of the world: it will trade a longer route for a cheaper one by exactly the factor the band sets. Everything about the robot's shape has been reduced to one radius and one margin; the car-like robot on L6 needs three circles for the same purpose.
Predict: With the default 0.6 m band on the warehouse, where will the planned path run in a 2 m aisle?
- Down the middle, entering the band only at corners
- Along one side: the band penalty is symmetric
- Hugging the lethal collar to keep the path short
Answer: 0

## Try: Inflation 1.4 m
cfg: {"sim":true,"level":1,"set":{"infl":1.4},"layers":{"cost":true},"tab":"per"}
Setup: The same level with the band widened to 1.4 m, which is wider than most aisles are from their centre line.
See: The tint now fills the aisles edge to edge and the planner replans at once ("costmap changed"). The four legs become 9.1, 14.2, 13.3 and 27.6 m, 6 % longer in total, and the search expands about twice as many nodes. The path hugs the centre of open floor more tightly, but the closest approach to a shelf in this run is 0.20 m, no better than before.
Shows: A band wider than the corridor is symmetric: every route through the corridor pays the same penalty, so the band stops steering and only adds cost. The closest approach is set by the tracker cutting a corner in a doorway, which no band changes, only the lethal radius does. The band is a preference about open space; margins against contact belong in the lethal threshold.
Predict: Widening the band to 1.4 m, wider than the aisles: what happens to the closest approach to a shelf?
- It grows to about a metre: the band keeps the robot central
- It shrinks: a uniform penalty stops steering the planner
- It stays about the same; only the lethal radius sets it
Answer: 2

## Try: Unknown = lethal
cfg: {"sim":true,"level":3,"set":{"unknownAs":"lethal"},"tab":"per"}
Setup: L4, the unknown building, with unseen cells treated as obstacles.
See: The robot does not move. All four goals lie in unseen space, so every plan fails with "goal is in unexplored space", three attempts each, and the mission skips the last goal 17 s in. The map stays a small island around the start.
Shows: Cautious and useless on its own: a planner that cannot enter the unknown cannot discover anything. The missing piece is frontier exploration, a behaviour that picks goals on the boundary between seen and unseen space and drives there, which turns the cautious policy into a safe one. Optimistic planning gets the same job done by replanning every time it is wrong, which on this level is three times in 80 s.
Predict: On the unknown building with unseen cells treated as lethal, what does the robot do?
- Explores cautiously, one visible room at a time
- Does not move: every goal is in unexplored space
- Drives the same route as the optimistic policy, more slowly
Answer: 1

## Think about
Q: Why is the lethal radius 0.4 m and not 0.3 m, the robot's radius?
A: The extra 0.1 m is the budget for everything the planner does not model: tracking error, the 0.1 m cell size, the chamfer transform's rounding. A planned path grazing a 0.3 m boundary would put the real robot in contact every time the tracker was a few centimetres off, which is always.
Q: The band is 0.6 m and an aisle is 2 m wide. Where does the cheapest straight path run?
A: Down the middle, 1 m from each side, where the distance is 1.0 m and the penalty is zero on both sides. Offset the path by 0.3 m and one side enters the band at d = 0.7 m with penalty ((1.0 − 0.7)/0.6)² = 0.25, a 75 % surcharge on those cells. The quadratic makes the centre a flat valley with steep walls.
Q: The cost layer is rebuilt every 0.5 s. Why not every scan?
A: A full distance transform over 38 400 cells costs a few milliseconds, which is affordable at 2 Hz and wasteful at 10 Hz, and the planner only replans when its path crosses a newly lethal cell. The map itself updates every scan; it is the derived cost that is cached.

## Check yourself
Q: A cell is 0.55 m from the nearest obstacle; lethal is below 0.4 m and the band is w = 0.6 m. What is the cost multiplier 1 + 3·penalty for a move entering that cell?
Answer: 2.6875
Tolerance: 0.05
Unit: 
How: penalty = ((0.4 + 0.6 − 0.55)/0.6)² = 0.75² = 0.5625; multiplier = 1 + 3 × 0.5625 = 2.69
