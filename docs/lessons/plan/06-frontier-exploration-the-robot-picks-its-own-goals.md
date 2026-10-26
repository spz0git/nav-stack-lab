group: plan
title: Frontier exploration: the robot picks its own goals

<p><b>Why this matters.</b> Every mission so far was given its goals. A robot that has to map a building it has never seen cannot be: nobody knows yet where the rooms are. Exploration is the mission layer choosing goals for itself, and the classic way to do it, frontier exploration, is almost embarrassingly simple: drive to the edge of what you know. It is what a vacuum robot does on its first run and what a survey robot does in a mine, and it is the first time in these lessons that the goal is a means and not an end.</p>
<p><b>The idea.</b> A frontier cell is a known-free cell with an unknown neighbour: standing there, the lidar would see something new. Group the frontier cells into connected clusters, drop the tiny ones, and you have a short list of candidate goals. Pick one, drive there, let the map grow, pick again, and stop when the list is empty: the building is mapped. The only decisions are which frontier to go to (the lab scores each by its size divided by its distance, so a big one nearby wins over a bigger one far away) and when to give up on a goal (the moment none of its cells borders unknown space any more, which usually happens before the robot arrives, because the way there reveals what was behind it).</p>
<p>In the map's log-odds $l$, a frontier cell is known free ($l < -0.05$) with an unknown 4-neighbour ($|l| < 0.05$) and no seen wall within the lethal radius. A frontier is an 8-connected cluster of at least $N_{\min}$ cells, and its goal is the known-free cell nearest its centroid, a margin beyond the inflation. Each frontier is scored</p>
$$\text{score} = \frac{\text{size}}{1 + d}, \qquad d = \text{distance from the estimate}$$
<p>and the highest score is the next goal. Exploration is done when no frontier is left, or none that has not failed.</p>
<p><b>Where it comes from.</b> Yamauchi's 1997 paper, which named the method; the score is one of the simplest utility functions, and the derivation of a better one, expected information gain per metre, is where the research went next. <a class="chref" href="#notes=ch4/7-frontier-exploration-the-robot-picks-its-own-goals">The definitions, the goal cell and the measured runs: chapter 4 §7</a></p>
<p><b>What the lab does.</b> Mission → Goal order → Explore turns it on, on any level with lidar mapping (Perceive → Map source). The level's goals are ignored; the Frontiers layer paints every frontier amber and the chosen one brighter; the status strip and the Mission tab show the floor seen, the share of the true free floor whose cells are known. The event log carries each pick with its size, the number of frontiers and the floor seen, and every goal dropped as "seen on the way". All numbers below are from L4 at seed 7.</p>

## Try: Explore the building
cfg: {"sim":true,"level":3,"set":{"mis":"explore"},"tab":"mis"}
Setup: L4, the unknown building, lidar mapping, no goals of its own: Explore. Mission tab, Frontiers layer on.
See: The first scan leaves three frontiers, the largest of 1739 cells the whole rim of the visible area, and the robot heads for its middle. By 10 s there are 14 frontiers and 42 % of the floor is seen. Of the 14 frontier goals set in all, 13 are dropped before arrival because the way there revealed what was behind them, and only one is actually reached. 100 % of the floor seen in 123 s and 94 m, with no replan and no collision.
Shows: The plan-drive-replan loop of the previous lesson with the goals now coming from the map itself. Nearly every goal is abandoned early, which is the point: a frontier goal was never a place to be, only a place from which to see. Watch the amber rim shrink room by room.
Predict: Let the robot pick its own goals in the unknown building. How many goals will it set itself, and how many of them will it reach?
- About four, like the level's goals, all of them reached
- Around fifteen, most dropped before arrival because the way there showed what was behind them
- Dozens, one for every corner, each reached in turn
Answer: 1

## Try: The level's own goals, for comparison
cfg: {"sim":true,"level":3,"tab":"mis"}
Setup: The same level with its four hand-placed goals, in order.
See: Four goals in 67 s and 50 m, three "path blocked" replans at the walls, and 96 % of the floor seen when the mission ends: two corners of the building were never looked into.
Shows: Hand-placed goals were placed by someone who knew the building; they are the fastest tour of it, and they still miss the corners nobody thought of. Frontier exploration takes twice the time and the distance and leaves nothing unseen, and it needs no one to know the building first.
Predict: The level's four goals, placed by hand, against the frontiers: which sees more of the floor?
- The goals: they were placed to cover the building
- The frontiers: they stop only when nothing is unknown
- The same: both drive the same corridors
Answer: 1

## Try: Only the big frontiers
cfg: {"sim":true,"level":3,"set":{"mis":"explore","exploreMin":20},"tab":"mis"}
Setup: Explore with the smallest frontier worth a visit raised from 6 to 20 cells.
See: 99 % seen in 102 s and 78 m, 13 goals: the run skips a 14-cell frontier near (11.6, 1.3) that the default run drove 20 s to look at last. With the threshold at 2 cells it is 141 s and 107 m for the same 100 %.
Shows: The threshold is a budget. Small frontiers are slivers seen through doorways and gaps between cells the lidar grazed; most of them are seen on the way to something else, and the few that are not cost a trip each for a few square decimetres of floor. A survey wants them; a vacuum does not. How much the threshold saves varies from run to run: here 21 s, on seeds 1 to 5 from nothing (seeds 4 and 5, where no small frontier was left over for the end) to half a minute. It never made a run slower or the coverage larger.
Predict: Ignore every frontier under 20 cells. What happens to the time and the coverage?
- Faster, or the same when no small frontier is left over; at most a sliver less of the floor seen
- Slower: the small frontiers were the near ones
- More of the floor seen: the trips go to the big frontiers instead
Answer: 0

## Try: Explore with unknown as lethal
cfg: {"sim":true,"level":3,"set":{"mis":"explore","unknownAs":"lethal"},"tab":"per"}
Setup: Explore under the cautious policy, Perceive → Unknown cells → lethal, where the planners refuse to plan through unseen space. Perceive tab.
See: The robot explores, 100 % in 171 s and 127 m against 123 s and 94 m with unknown as free. The first pick waits for the first scan (0.5 s) and every goal sits a lethal radius back from the frontier, on seen floor; the plans go through seen space only, so each leg is a little longer. There are two collisions, at 50 s and 60 s.
Shows: Under the cautious policy a goal in the unknown is forbidden, which is why a hand-placed goal in an unseen room is approached through a stand-in at the edge of the seen floor (chapter 4 §5); a frontier goal is on seen floor by construction and needs none. The price is a plan that never cuts through a room it has not looked into, which is exactly what the policy is for. How much it costs varies from run to run: on seeds 1 to 5 the cautious run is from 3 s faster to 77 s slower than with unknown as free, always to 100 %, with up to six collisions where the free run has at most one.
Predict: Treat unknown space as lethal. Can the robot explore at all?
- No: every frontier is next to the unknown, which is forbidden
- Yes: the goals stay on seen floor and the plans go only through it
- Only the first room: every door leads into unknown space
Answer: 1

## Try: Explore with DWA
cfg: {"sim":true,"level":3,"set":{"mis":"explore","ctl":"dwa"},"tab":"mis"}
Setup: Explore with the dynamic window tracker in place of pure pursuit.
See: DWA gets stuck in doorways and gives up on four frontiers, three where it got stuck and one it could no longer plan to. At 38 s the only frontier left is one it failed, so the mission tries the failed ones once more from where it now stands. This time the doorway at (10.0, 5.5) works. 100 % of the floor in 187 s, no collision.
Shows: The exploration layer only chooses goals; whether the robot gets there is the planner's and the tracker's problem, and a frontier in a doorway is the hardest kind of goal, a narrow passage with unknown space behind it. The retry pass is a cheap piece of robustness: a goal that failed from across the building is often easy from next door. RRT* fares worse on this level: its paths hug the corners and the robot wedges itself in one, after which no frontier is reachable.
Predict: Swap pure pursuit for DWA. What changes?
- Nothing: the goals are the same
- It gets stuck in doorways, gives up on some frontiers, and needs the retry pass to finish
- It is faster: DWA cuts the corners
Answer: 1

## Code: frontiers
snippet: frontiers
focus: if (lo[k] < -0.05 && (unk(k - 1) || unk(k + 1) || unk(k - GW) || unk(k + GW)) && !nearWall(i, j)) isF[k] = 1;
focus: out.push({cells, size: cells.length
Note: One line defines a frontier cell: known free, an unknown 4-neighbour, no seen wall within the lethal radius. The clustering in between is a flood fill; the last marked line records each cluster with its goal cell. The scoring is in exploreNext, a few lines further in the module.

## Think about
Q: Why score a frontier by size divided by distance, rather than go to the nearest or the largest?
A: Nearest-first makes the robot nibble at the rim of what it knows and criss-cross the building, since the nearest frontier is usually a sliver left behind; largest-first sends it across the building for a big one while a decent one is next door. Size per metre is the crudest estimate of what matters, new floor seen per metre driven; the research versions estimate the information gain of each frontier and the cost of getting there, and divide those.
Q: Thirteen of the fourteen goals were dropped before the robot arrived. Is that a failure of the goal selection?
A: No, it is the method working. A frontier is a place from which the robot expects to see something new, and most of the time it sees it on the way: the goal cell's whole cluster stops bordering unknown space, and keeping on driving there would be wasted metres. A real stack checks the same thing, at a few hertz, against the live map.
Q: With RRT* the exploration stalls at 86 % with seven frontiers that cannot be reached. What would a real stack do?
A: Separate the cause. If the goal is unreachable, mark it and move on, as here; if the planner is unreliable, change the planner, since a sampling planner that fails in doorways is the wrong tool for a building; and if the robot is physically wedged, recovery behaviours (back up, rotate, clear the costmap) come before any of this. Exploration only chooses where to go; everything below it still has to work.

## Check yourself
Q: A frontier of 300 cells lies 5 m away and scores $300 / (1 + 5) = 50$. At most how far away may a frontier of 80 cells be to beat it?
Answer: 0.6
Tolerance: 0.02
Unit: m
How: $80 / (1 + d) > 50 \Rightarrow 1 + d < 1.6 \Rightarrow d < 0.6$ m: the small one wins only when it is almost at the robot's feet
