group: plan
title: Frontier exploration: the robot picks its own goals

<p><b>Why this matters.</b> Every mission so far came with its goals. A robot that has to map a building it has never seen cannot be given goals, because nobody knows yet where the rooms are. In exploration, the mission layer chooses goals for itself. The classic method, frontier exploration, is very simple: drive to the edge of what you know. A vacuum robot does this on its first run, and a survey robot does it in a mine. For the first time in these lessons, the robot does not need to reach its goals. It goes towards them to see what lies beyond.</p>
<p><b>The idea.</b> A frontier cell is a known-free cell with an unknown neighbour. From there, the lidar would see something new. Group the frontier cells into connected clusters and drop the tiny ones, and you have a short list of candidate goals. Pick one, drive there, let the map grow and pick again. When the list is empty, the building is mapped. Only two decisions are needed. The first is which frontier to go to. The lab scores each by its size divided by its distance, so a big frontier nearby wins over a bigger one far away. The second is when to give up on a goal. The lab gives up as soon as none of the goal's cells borders unknown space any more. That usually happens before the robot arrives, because the drive there shows what was behind the frontier.</p>
<!-- math -->
<p>The map stores each cell as a log-odds value $l$, which is negative for free and positive for occupied. A frontier cell is known free ($l < -0.05$), has an unknown 4-neighbour ($|l| < 0.05$), one of the four cells that share a side with it, and has no seen wall within the lethal radius. A frontier is an 8-connected cluster of at least $N_{\min}$ cells. Its goal is the known-free cell nearest its centroid, a margin beyond the inflation. Each frontier is scored</p>
$$\text{score} = \frac{\text{size}}{1 + d}, \qquad d = \text{distance from the estimate}$$
<p>and the highest score is the next goal. Exploration is done when no frontier is left, or when every frontier left has already failed.</p>
<p><b>Where it comes from.</b> The method was named in Yamauchi's 1997 paper. The score is one of the simplest utility functions. Research then moved on to deriving better ones, such as the expected information gain per metre driven. <a class="chref" href="#notes=ch4/8-frontier-exploration-the-robot-picks-its-own-goals">The definitions, the goal cell and the measured runs: chapter 4 §8</a></p>
<!-- /math -->
<p><b>What the lab does.</b> Mission → Goal order → Explore turns it on, on any level with lidar mapping (Perceive → Map source). The level's own goals are then ignored. The Frontiers layer paints every frontier amber and the chosen one brighter. The status strip and the Mission tab show the floor seen, which is the share of the true free floor whose cells are known. The event log lists each pick with its size, the number of frontiers and the floor seen. It also lists every goal dropped as "seen on the way". All numbers below are from L4 at seed 7.</p>

## Try: Explore the building
cfg: {"sim":true,"level":3,"set":{"mis":"explore"},"tab":"mis"}
Setup: L4, the unknown building, with lidar mapping. Explore is on, so the level's own goals are ignored. Mission tab, with the Frontiers layer on.
See: The first scan leaves three frontiers. The largest, of 1739 cells, is the whole rim of the visible area, and the robot heads for its middle. By 10 s there are 14 frontiers and 42 % of the floor is seen. The robot sets 14 frontier goals in all. It drops 13 of them before arriving, because the drive there showed what was behind them, and reaches only one. It has seen 100 % of the floor after 123 s and 94 m, with no replan and no collision.
Shows: This is the plan, drive and replan loop of the replanning lesson, with the goals now taken from the map itself. Nearly every goal is dropped early, as intended. The robot heads for a frontier goal in order to see from it, and once the area behind it has been seen there is no need to arrive. Watch the amber rim shrink room by room.
Predict: Let the robot pick its own goals in the unknown building. How many goals will it set itself, and how many of them will it reach?
- About four, like the level's goals, all of them reached
- Around fifteen, most dropped before arrival because the way there showed what was behind them
- Dozens, one for every corner, each reached in turn
Answer: 1

## Try: The level's own goals, for comparison
cfg: {"sim":true,"level":3,"tab":"mis"}
Setup: The same level with its four hand-placed goals, in order.
See: The robot reaches the four goals in 67 s and 50 m, with three "path blocked" replans at the walls. When the mission ends, 96 % of the floor has been seen. Two corners of the building were never looked into.
Shows: The goals were placed by hand by someone who knew the building. They give the fastest tour of it, and they still miss the corners nobody thought of. Frontier exploration takes twice the time and the distance, but it leaves nothing unseen, and nobody has to know the building first.
Predict: The level's four goals, placed by hand, against the frontiers: which sees more of the floor?
- The goals: they were placed to cover the building
- The frontiers: they stop only when nothing is unknown
- The same: both drive the same corridors
Answer: 1

## Try: Only the big frontiers
cfg: {"sim":true,"level":3,"set":{"mis":"explore","exploreMin":20},"tab":"mis"}
Setup: Explore, with the size of the smallest frontier worth a visit raised from 6 to 20 cells.
See: The robot sees 99 % of the floor in 102 s and 78 m, with 13 goals. It skips a 14-cell frontier near (11.6, 1.3), which the default run looked at last, after a 20 s drive. With the threshold at 2 cells, seeing 100 % takes 141 s and 107 m.
Shows: The threshold trades a little coverage for time. Small frontiers are slivers seen through doorways, and gaps between cells that the lidar only grazed. Most of them are seen on the way to something else. Each of the others costs a trip for a few square decimetres of floor. A survey robot needs them, and a vacuum robot does not. How much time the threshold saves varies from run to run. Here it is 21 s. On seeds 1 to 5 it ranges from nothing (seeds 4 and 5, where no small frontier was left over for the end) to half a minute. It never made a run slower or the coverage larger.
Predict: Ignore every frontier under 20 cells. What happens to the time and the coverage?
- Faster, or the same when no small frontier is left over; at most a sliver less of the floor seen
- Slower: the small frontiers were the near ones
- More of the floor seen: the trips go to the big frontiers instead
Answer: 0

## Try: Explore with unknown as lethal
cfg: {"sim":true,"level":3,"set":{"mis":"explore","unknownAs":"lethal"},"tab":"per"}
Setup: Explore under the cautious policy (Perceive → Unknown cells → lethal), with which the planners refuse to plan through unseen space. Perceive tab.
See: The robot still explores. It sees 100 % of the floor in 171 s and 127 m, against 123 s and 94 m with unknown as free. The first pick waits for the first scan (0.5 s). Every goal sits a lethal radius back from the frontier, on seen floor. The plans go through seen space only, so each leg is a little longer. There are two collisions, at 50 s and 60 s.
Shows: Under the cautious policy, a goal in unknown space is forbidden. A hand-placed goal in an unseen room is therefore approached through a stand-in goal at the edge of the seen floor (chapter 4 §5). A frontier goal is on seen floor by construction, so it needs no stand-in. Plans never cut through a room the robot has not looked into. That costs distance, and it is what the policy is meant to do. How much it costs varies from run to run. On seeds 1 to 5 the cautious run is between 3 s faster and 77 s slower than with unknown as free. It always reaches 100 %, with up to six collisions where the free run has at most one.
Predict: Treat unknown space as lethal. Can the robot explore at all?
- No: every frontier is next to the unknown, which is forbidden
- Yes: the goals stay on seen floor and the plans go only through it
- Only the first room: every door leads into unknown space
Answer: 1

## Try: Explore with DWA
cfg: {"sim":true,"level":3,"set":{"mis":"explore","ctl":"dwa"},"tab":"mis"}
Setup: Explore, with the dynamic window tracker (DWA) in place of pure pursuit.
See: DWA gets stuck in doorways and gives up on four frontiers: three where it got stuck, and one it could no longer plan a path to. At 38 s the only frontier left is one that failed, so the mission tries the failed ones once more from where the robot now stands. This time the doorway at (10.0, 5.5) works. The robot sees 100 % of the floor in 187 s, with no collision.
Shows: The exploration layer only chooses goals. Getting there is the job of the planner and the tracker. A frontier in a doorway is the hardest kind of goal, because it is a narrow passage with unknown space behind it. The retry pass costs little and recovers goals: a goal that failed from across the building is often easy from the next room. RRT* does worse on this level. Its paths hug the corners, and the robot wedges itself in one, after which no frontier is reachable.
Predict: Swap pure pursuit for DWA. What changes?
- Nothing: the goals are the same
- It gets stuck in doorways, gives up on some frontiers, and needs the retry pass to finish
- It is faster: DWA cuts the corners
Answer: 1

## Code: frontiers
snippet: frontiers
focus: if (lo[k] < -0.05 && (unk(k - 1) || unk(k + 1) || unk(k - GW) || unk(k + GW)) && !nearWall(i, j)) isF[k] = 1;
focus: out.push({cells, size: cells.length
Note: The first marked line defines a frontier cell: known free, an unknown 4-neighbour, and no seen wall within the lethal radius. The clustering between the two marked lines is a flood fill. The second marked line records each cluster with its goal cell. The scoring is in exploreNext, a few lines further on in the module.

## Think about
Q: Why score a frontier by size divided by distance, rather than go to the nearest or the largest?
A: Nearest-first makes the robot nibble at the rim of what it knows and criss-cross the building, because the nearest frontier is usually a sliver left behind. Largest-first sends it across the building to a big frontier while a reasonable one is next door. What matters is the new floor seen per metre driven, and size per metre is the crudest estimate of that. The versions in research estimate the information gain of each frontier and the cost of getting there, and divide one by the other.
Q: Thirteen of the fourteen goals were dropped before the robot arrived. Is that a failure of the goal selection?
A: No, the method is working as intended. A frontier is a place from which the robot expects to see something new, and most of the time it sees it on the way. The goal's whole cluster then stops bordering unknown space, and driving on to it would waste metres. A real stack makes the same check against the live map, a few times a second.
Q: With RRT* the exploration stalls at 86 % with seven frontiers that cannot be reached. What would a real stack do?
A: First find the cause. If the goal is unreachable, mark it and move on, as the lab does. If the planner is unreliable, change the planner: a sampling planner that fails in doorways is the wrong tool for a building. If the robot is physically wedged, recovery behaviours (back up, rotate, clear the costmap) come before any of this. Exploration only chooses where to go, and every layer below it still has to work.

## Check yourself
Q: A frontier of 300 cells lies 5 m away and scores $300 / (1 + 5) = 50$. At most how far away may a frontier of 80 cells be to beat it?
Answer: 0.6
Tolerance: 0.02
Unit: m
How: $80 / (1 + d) > 50 \Rightarrow 1 + d < 1.6 \Rightarrow d < 0.6$ m: the small one wins only when it is almost at the robot's feet
