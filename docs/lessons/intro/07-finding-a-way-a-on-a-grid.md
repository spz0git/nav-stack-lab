group: intro
title: Finding a way: A* on a grid
level: 1

<p><b>Why this matters.</b> Once the floor is a grid of cells with costs, finding a route is a search problem: of all the ways through the grid, which is cheapest? A robot cannot try them all, since there are far too many. A* is the search most robots use, in warehouses, in games and in car navigation. It is fast because it guesses well, and it still guarantees the cheapest path. One setting trades that guarantee for more speed.</p>
<p><b>The idea.</b> A* grows a set of explored cells outward from the start. For every cell at the edge of that set it adds two numbers: the cost already paid to reach the cell, and a guess of the cost still to go. The guess here is the straight-line distance to the goal, moving in the eight grid directions, as if nothing were in the way. It always takes next the cell with the smallest total, explores its neighbours, and repeats until it takes the goal. Because the guess never overestimates (nothing can be shorter than the free-floor distance), the first path to reach the goal is the cheapest one. Each cell it takes is called an <i>expansion</i>; the number of expansions is the work it did.</p>
<p>The guess can be multiplied by a weight ε. With ε = 1 the search is careful and the path is the cheapest. With ε larger than 1 it trusts the guess more, rushes towards the goal and explores far fewer cells. The price is that the path may cost more, at most ε times the cheapest.</p>
<p><b>What the lab does.</b> L2, the warehouse with a known map and the default inflation band. Cells are 0.1 m. The search layer paints every cell A* expanded. Each experiment plans and then pauses: the chip under the map plays the search one expansion at a time (◀ and ▶ step, ▷ plays, the slider scrubs), and <b>Run</b> drives. The Metrics list shows the Last plan and the Search effort, the expansions of the last search. ε is a slider in the Plan tab.</p>
<p><b>Where it comes from.</b> With $g$ the cost so far, $h$ the guess of the cost to go and ε the weight, A* always expands the cell with the smallest</p>
$$f = g + \varepsilon\,h$$
<p>With ε = 1 and an $h$ that never overestimates, any cheaper path would still have a cell in the queue with a smaller $f$, so the search would have taken it first. Go deeper: <a class="lsref" href="#lesson=plan:1">A*: the heuristic and ε</a> · <a class="chref" href="#notes=ch4/2-a-best-first-search-with-a-promise">best-first search with a promise: chapter 4 §2</a></p>

## Try: A*, ε = 1
cfg: {"sim":true,"level":1,"set":{"eps":1},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L2 with A* and ε = 1, the search layer on and the Plan tab open. The search for goal 1 is ready to play.
See: Play the search. The explored cells spread out from the robot, mostly towards the goal, but they also fill the aisles around it and spill into side aisles. The Search effort reads 1 258 expansions for the first path, 8.6 m long. After Run, the four searches expand 1 258, 3 199, 1 105 and 8 615 cells, each in a few milliseconds, and the mission completes at 78.3 s.
Shows: A* has to look into every side aisle that might have been cheaper before it can be sure its path is the cheapest. That checking is what the extra expansions pay for.
Predict: On the long last leg, how much of the map will the search layer fill?
- A thin line along the final path, nothing else
- The aisles around the route, spilling into side aisles
- Every free cell of the map
Answer: 1

## Try: A*, ε = 3
cfg: {"sim":true,"level":1,"set":{"eps":3},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The same floor with the guess weighted by 3.
See: The explored cells now form a narrow strip along the route. The four searches expand 1 117, 1 139, 118 and 626 cells, up to 14 times fewer than with ε = 1. The paths are 8.5, 12.5, 12.9 and 26.1 m, within a few percent of the careful ones, and the mission completes at 77.6 s.
Shows: In a warehouse, heading towards the goal is almost always right, so the greedy search loses almost nothing. In a maze, where the direction of the goal leads into dead ends, the same weight can return a clearly worse path. The guarantee is “at most three times the cheapest”, not “the same”.
Predict: With ε = 3, how many cells will A* expand compared with ε = 1?
- Fewer: it heads for the goal and skips most side aisles
- More: a larger weight means more work
- The same: ε only changes the path, not the search
Answer: 0

## Think about
Q: When would A* expand every reachable cell of the map?
A: When the goal cannot be reached. A* can only say “no path” after it has tried everything it could reach. That is why real planners cap the search or check first that the goal is reachable.

## Check yourself
Q: In the first experiment, before you press Run, what does Search effort read for the first path?
Answer: 1258
Tolerance: 10
Unit: expansions
How: 1 258 expansions for the 8.6 m path to goal 1. With ε = 3 the same path costs 1 117 expansions; the savings are much larger on the long legs.
