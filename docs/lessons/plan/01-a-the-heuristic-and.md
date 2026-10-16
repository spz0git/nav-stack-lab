group: plan
title: A*: the heuristic and ε

<p><b>Why this matters.</b> Graph search is the workhorse of robot planning: a costmap is a graph, a route is a path through it, and A* finds the cheapest one with a guarantee. The guarantee is the point. A planner that is usually fine and occasionally sends the robot the long way round is hard to certify; one with a bound on how far from optimal it can be, even a loose bound, can be reasoned about. The heuristic weight ε is the single knob that trades that bound for speed, and understanding exactly what it buys and costs is the difference between tuning and guessing.</p>
<p><b>The idea.</b> A* keeps a queue of cells, each a node of the graph, ordered by <i>f</i> = <i>g</i> + <i>h</i>: the cost already paid to reach the cell plus an estimate of the cost still to go. It always expands the cell that looks cheapest in total, so it heads toward the goal without ignoring cheaper detours. If the estimate <i>h</i> never exceeds the true remaining cost (it is admissible), the first path to reach the goal is optimal: any cheaper path would have had a cell in the queue with a smaller <i>f</i>, which would have been expanded first. On an 8-connected grid the octile distance is the exact free-space cost, so it is admissible and as tight as a free-space heuristic can be.</p>
<div class="eq">f = g + ε·h,   ε = 1: optimal;   ε > 1: cost ≤ ε · optimal, far fewer expansions
h = (max(Δi, Δj) + (√2 − 1)·min(Δi, Δj)) · 0.1 m     Δi, Δj: cells to the goal in x and y
g += length · (1 + 3 · penalty of the cell entered),   length 0.1 m or 0.1√2 m</div>
<p><b>Where it comes from.</b> Run the optimality argument with <i>g</i> + ε<i>h</i>: any cell on the optimal path still in the queue has <i>f</i> ≤ ε·<i>C</i>*, and the goal was popped with <i>f</i> no larger than that, so the path found costs at most ε times the optimum. The bound is tight only in adversarial mazes; on a floor with aisles the greedy direction is usually right and the path is within a few percent. <a class="chref" href="#notes=ch4/2-a-best-first-search-with-a-promise">Derivation: chapter 4 §2</a> · the graph and its costs: <a class="chref" href="#notes=ch4/1-the-costmap-as-a-graph">§1</a></p>
<p><b>What the lab does.</b> Cells are 0.1 m, moves go to eight neighbours (no cutting between two touching obstacles), and the cost of a move is its length times (1 + 3 × inflation penalty) of the cell it enters, so the planner minimizes cost, not distance. The cell sequence is reduced to turning points and shortcut with straight segments that keep 0.5 m from obstacles. The search layer shows the closed set, the cells A* expanded, and the event log reports path length, expansions and planning time for every plan.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses: the chip under the map plays the search one expansion at a time (◀ ▶ step, ▷ plays, the slider scrubs), with the newest node in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: A*, ε = 1
cfg: {"sim":true,"level":1,"set":{"eps":1},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L2, the warehouse with a known map, A* with ε = 1 and the search layer on. Plan tab.
See: Four legs: 8.6, 13.0, 12.9 and 26.1 m, expanding 1 258, 3 199, 1 105 and 8 615 cells in 1 to 14 ms each; the mission completes in 78 s. The expansion cloud fills the aisles around the direct route and spills into side aisles that might have been shorter, which is what proving optimality costs.
Shows: Optimal here means cheapest in the costmap's currency, which charges extra inside the inflation band. The 13.0 m second leg is the cheapest path, not the shortest; the next experiment finds a shorter one that costs more. Every cell expanded outside the final path is the price of the guarantee: A* has to rule out every alternative that could have been cheaper.
Predict: A* with ε = 1 on the 26 m leg: how much of the search layer will be filled with expanded cells?
- A thin corridor along the final path
- The aisles around the route, spilling into side aisles
- Nearly the whole map: optimality needs every cell
Answer: 1

## Try: A*, ε = 3
cfg: {"sim":true,"level":1,"set":{"eps":3},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The same level with the heuristic weighted by 3: the search is greedy toward the goal.
See: The same four goals in 78 s, with legs of 8.5, 12.5, 12.9 and 26.1 m: within a few percent of the ε = 1 paths and one of them shorter in metres. The expansion counts fall to 1 117, 1 139, 118 and 626, up to 14 times fewer on the longer legs, and the cloud narrows to a corridor along the route.
Shows: On a floor with aisles the greedy direction is almost always right, so weighted A* loses almost nothing. The bound says the path could be three times longer; the measurement says a few percent. The bound matters in mazes, where the direction the heuristic likes is a dead end, and there weighted A* really does find bad paths fast. Know which kind of map you have.
Predict: Weighting the heuristic by 3: how much longer will the paths be than at ε = 1?
- Up to three times longer, as the bound allows
- About 30 % longer
- Within a few percent, one even shorter in metres
Answer: 2

## Try: Straight line (no planner)
cfg: {"sim":true,"level":1,"set":{"plan":"straight"},"tab":"plan"}
Setup: The planner replaced by a straight segment from the estimate to the goal, which ignores the costmap entirely.
See: The robot drives into the first shelf within a few seconds, is reported stuck three times at five-second intervals, skips the goal, and repeats for the next: three goals skipped in 50 s, one collision, 9 m of driving. The tracker is doing its job perfectly on a path that goes through a wall.
Shows: What the planner is for, stated by its absence. Every layer below the planner assumes the path is feasible; the tracker has no way to know it is heading into a shelf and no authority to do anything about it if it did. The mission layer eventually gives up on each goal, which is the only thing that keeps the run from lasting forever.
Predict: Replace the planner by a straight line to the goal. What happens on the first leg?
- The robot hits the first shelf within seconds and is declared stuck
- The tracker steers around the shelves on its own
- The speed planner stops it before the shelf and it waits
Answer: 0

## Think about
Q: The octile heuristic ignores the inflation penalty. Is it still admissible?
A: Yes. The penalty only adds to the true cost of a move, so the free-space distance is a lower bound on the costmap cost as well. Ignoring it makes the heuristic looser, which costs expansions, not optimality. A heuristic that tried to include the penalty would have to know the path to compute it.
Q: Why does ε = 3 sometimes return a path shorter in metres than ε = 1?
A: Because ε = 1 minimizes cost, and cost includes the inflation surcharge. The 12.5 m path at ε = 3 passes through the band where the 13.0 m path at ε = 1 goes around it; the shorter path costs more in the costmap's terms. "Optimal" is always with respect to the cost you defined, and the inflation band is part of that definition.
Q: A* expands 8 615 cells on the 26 m leg. The grid has 38 400. When would it expand all of them?
A: When the goal is unreachable: A* has to exhaust every reachable cell before it can say there is no path. On an unknown map with unknown-as-lethal, that is what happens three times per goal in the costmap lesson. Real stacks bound the search or check reachability first.

## Check yourself
Q: The goal is 30 cells away in x and 10 cells in y on the 0.1 m grid. What is the octile heuristic h, in metres?
Answer: 3.414
Tolerance: 0.05
Unit: m
How: h = (max(30, 10) + (√2 − 1) × min(30, 10)) × 0.1 = (30 + 4.14) × 0.1 = 3.41 m
