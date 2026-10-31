group: plan
title: A*: the heuristic and ε

<p><b>Why this matters.</b> Most robot planners are built on graph search. A costmap is a graph, a route is a path through it, and A* finds the cheapest path with a guarantee. The guarantee matters. A planner that is usually fine but now and then sends the robot the long way round is hard to certify. A planner with a bound on how far from optimal its path can be, even a loose bound, can be reasoned about. One setting, the heuristic weight $\varepsilon$, trades that bound for speed. In this lesson you measure what a larger weight saves and what it costs, so that you can set it from numbers.</p>
<p><b>The idea.</b> A* keeps a queue of cells, each a node of the graph, ordered by $f = g + h$: the cost already paid to reach the cell plus an estimate of the cost still to go. It always expands the cell that looks cheapest in total. So it heads towards the goal, but it still tries cheaper detours. If the estimate $h$ never exceeds the true remaining cost, the heuristic is called admissible, and the first path to reach the goal is optimal. Any cheaper path would have had a cell in the queue with a smaller $f$, and that cell would have been expanded first. On an 8-connected grid (moves to the four sides and the four diagonals), the octile distance is the true cost to the goal when nothing is in the way. It is therefore admissible, and no free-space heuristic comes closer to the true cost.</p>
$$f = g + \varepsilon h \qquad \varepsilon = 1:\ \text{optimal} \qquad \varepsilon > 1:\ \text{cost} \le \varepsilon \cdot \text{optimal, far fewer expansions}$$
$$h = \bigl(\max(\Delta i, \Delta j) + (\sqrt{2} - 1)\min(\Delta i, \Delta j)\bigr) \cdot 0.1\ \text{m}$$
<p>where $\Delta i$ and $\Delta j$ are the number of cells to the goal in $x$ and $y$. Each move adds its length $\ell$, weighted by the penalty of the cell it enters:</p>
$$g \mathrel{+}= \ell\,\bigl(1 + 3\cdot\text{penalty of the cell entered}\bigr), \qquad \ell = 0.1\ \text{m or}\ 0.1\sqrt{2}\ \text{m}$$
<p><b>Where it comes from.</b> Run the same argument with $g + \varepsilon h$. Any cell on the optimal path that is still in the queue has $f \le \varepsilon C^*$, that is, at most ε times the cost of the optimal path. The goal was popped with an $f$ no larger than that, so the path found costs at most $\varepsilon$ times the optimum. A path comes near the bound only in mazes built to mislead the heuristic. On a floor with aisles, the direction towards the goal is usually the right one, and the path is within a few percent of optimal. <a class="chref" href="#notes=ch4/2-a-best-first-search-with-a-promise">Derivation: chapter 4 §2</a> · the graph and its costs: <a class="chref" href="#notes=ch4/1-the-costmap-as-a-graph">§1</a></p>
<p><b>What the lab does.</b> Cells are 0.1 m. Each move goes to one of the eight neighbours, and a diagonal move may not cut between two obstacles that touch. The cost of a move is its length times $(1 + 3p)$, where $p$ is the inflation penalty of the cell it enters. The planner therefore finds the cheapest path, which is not always the shortest. The cell sequence is then reduced to its turning points and shortened with straight segments that keep 0.5 m from obstacles. The search layer shows the closed set, which is the set of cells A* expanded. For every plan, the event log reports the path length, the number of expansions and the planning time. All numbers below are at seed 7, over one mission of about 80 s.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses. The chip under the map then plays the search one expansion at a time: ◀ and ▶ step, ▷ plays, and the slider scrubs. The newest node is drawn in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: A*, ε = 1
cfg: {"sim":true,"level":1,"set":{"eps":1},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L2, the warehouse with a known map, A* with $\varepsilon = 1$ and the search layer on. Plan tab.
See: The mission has four legs, of 8.6, 13.0, 12.9 and 26.1 m. A* expands 1 258, 3 199, 1 105 and 8 615 cells for them, in a few milliseconds each, and the mission completes in 78 s. The expanded cells fill the aisles around the direct route and spill into side aisles that might have been shorter. A* has to look into those side aisles to prove that its path is optimal.
Shows: Optimal here means cheapest by the costmap's cost, which charges extra inside the inflation band. The second leg, 13.0 m, is the cheapest path but not the shortest, and the next experiment finds a shorter one that costs more. Each cell expanded outside the final path is work done for the guarantee, because A* has to rule out every alternative that could have been cheaper.
Predict: A* with $\varepsilon = 1$ on the 26 m leg: how much of the search layer will be filled with expanded cells?
- A thin corridor along the final path
- The aisles around the route, spilling into side aisles
- Nearly the whole map: optimality needs every cell
Answer: 1

## Try: A*, ε = 3
cfg: {"sim":true,"level":1,"set":{"eps":3},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The same level, with the heuristic weighted by 3. The search now favours cells near the goal over cells that are cheap to reach.
See: The same four goals are reached in 78 s, with legs of 8.5, 12.5, 12.9 and 26.1 m. These are within a few percent of the $\varepsilon = 1$ paths, and one of them is shorter in metres. The expansion counts fall to 1 117, 1 139, 118 and 626, up to 14 times fewer on the longer legs. The expanded cells now form a narrow corridor along the route.
Shows: On a floor with aisles, heading for the goal is almost always the right direction, so weighted A* loses almost nothing. The bound allows a path three times as costly as the optimum, and the measured paths are within a few percent. The bound matters in mazes, where the direction the heuristic favours leads into a dead end. There weighted A* does find bad paths, and finds them fast. Before you raise the weight, check which kind of map the robot works in.
Predict: Weighting the heuristic by 3: how much longer will the paths be than at $\varepsilon = 1$?
- Up to three times longer, as the bound allows
- About 30 % longer
- Within a few percent, one even shorter in metres
Answer: 2

## Try: Straight line (no planner)
cfg: {"sim":true,"level":1,"set":{"plan":"straight"},"tab":"plan"}
Setup: The planner is replaced by a straight segment from the estimated pose to the goal. The segment ignores the costmap.
See: Within a few seconds the robot drives into the first shelf. It is reported stuck three times, five seconds apart, and then skips the goal. The same happens on the next legs. By 50 s three goals have been skipped, with one collision and under 3 m of driving. Only the fourth goal has a clear straight line to it, and the robot reaches it at 74 s. The tracker follows the path correctly the whole time, but the path goes through a wall.
Shows: Without a planner you see what the planner is for. Every layer below it assumes the path is feasible. The tracker cannot tell that it is heading into a shelf, and if it could, it has no authority to change the path. In the end the mission layer gives up on each goal, and only that stops the run from going on forever.
Predict: Replace the planner by a straight line to the goal. What happens on the first leg?
- The robot hits the first shelf within seconds and is declared stuck
- The tracker steers around the shelves on its own
- The speed planner stops it before the shelf and it waits
Answer: 0

## Code: gridSearch, the heuristic
snippet: astar
focus: return (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) * RES * eps;
example: plan/astar
Note: The marked line is the octile distance, scaled by $\varepsilon$. With $\varepsilon = 1$ it never overestimates, and A* is optimal. With $\varepsilon > 1$ the search leans towards the goal and expands fewer cells. In Edit and run, the A* example has the same heuristic. Multiply it by 2, or set it to 0 with the Dijkstra example, and compare the expansions in the event log.

## Think about
Q: The octile heuristic ignores the inflation penalty. Is it still admissible?
A: Yes. The penalty only adds to the true cost of a move, so the free-space distance is still a lower bound on the costmap cost. Ignoring the penalty makes the heuristic looser. A looser heuristic means more expansions, and the path is still optimal. To include the penalty, a heuristic would have to know the path, and finding the path is the search's job.
Q: Why does $\varepsilon = 3$ sometimes return a path shorter in metres than $\varepsilon = 1$?
A: $\varepsilon = 1$ minimizes cost, and the cost includes the surcharge in the inflation band. The 12.5 m path at $\varepsilon = 3$ passes through the band, where the 13.0 m path at $\varepsilon = 1$ goes around it. So the shorter path costs more by the costmap's measure. A path is optimal only with respect to the cost you defined, and the inflation band is part of that definition.
Q: A* expands 8 615 cells on the 26 m leg. The grid has 38 400. When would it expand all of them?
A: When the goal is unreachable. A* has to expand every reachable cell before it can report that there is no path. In the costmap lesson, with an unknown map and unknown cells treated as lethal, this happens three times per goal. Real stacks put a limit on the search, or check first that the goal can be reached.

## Check yourself
Q: The goal is 30 cells away in x and 10 cells in y on the 0.1 m grid. What is the octile heuristic $h$, in metres?
Answer: 3.414
Tolerance: 0.05
Unit: m
How: $h = \bigl(\max(30, 10) + (\sqrt{2} - 1)\min(30, 10)\bigr) \times 0.1 = (30 + 4.14) \times 0.1 = 3.41$ m
