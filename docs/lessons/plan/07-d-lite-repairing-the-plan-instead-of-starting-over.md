group: plan
title: D* Lite: repairing the plan instead of starting over

<p><b>Why this matters.</b> So far, every replan in this lab has thrown the previous search away and run A* again from scratch, three times a second if the periodic replan is on. On a 38 000-cell grid that costs a couple of milliseconds, and the behaviour layer never notices. On a planetary rover's map, or on a costmap of 10 million cells replanned at 20 Hz, the cost matters. The answer found in the 1990s was to keep the search alive. When the map changes a little or the robot moves a little, the planner repairs the parts of the search that the change touched and leaves the rest. D* Lite is a clean version of that idea. This lesson runs it next to A* on the same costmap, with the same paths, and measures what the repair saves and what it costs.</p>
<p><b>The idea.</b> D* Lite runs the search backwards, from the goal towards the robot. The robot's motion then only moves the end point of the search, and the values already computed stay valid. Every cell keeps two numbers. The first, $g$, is its current cost to the goal. The second, $\mathit{rhs}$, is a one-step lookahead: the best cost to the goal through any of the cell's neighbours. Where the two agree, the cell is settled. Where they disagree, the cell is inconsistent and sits in a priority queue. Its key in the queue is the smaller of the two numbers plus the heuristic to the robot. The main loop pops the most urgent inconsistent cell, settles it, and re-examines its neighbours. It stops when the robot's cell is consistent and nothing cheaper is queued. When an edge cost changes, only the cells whose $\mathit{rhs}$ depends on it become inconsistent. When the robot moves, a single offset $k_m$ is added to every future key, so that the old keys can still be compared with the new ones. A replan then only has to work through the queue, and after a small change the queue holds a handful of cells.</p>
$$\mathit{rhs}(u) = \min_{v \in \operatorname{succ}(u)} \bigl(c(u, v) + g(v)\bigr), \qquad \mathit{rhs}(\text{goal}) = 0$$
<p>A cell is consistent when $g(u) = \mathit{rhs}(u)$. The queue orders by the first component of the key and breaks ties by the second:</p>
$$\operatorname{key}(u) = \bigl[\min(g, \mathit{rhs}) + h(\text{start}, u) + k_m,\ \min(g, \mathit{rhs})\bigr]$$
<p>When the robot moves from $s_{\text{old}}$ to $s_{\text{new}}$, the offset grows so that old keys stay comparable to new ones:</p>
$$k_m \leftarrow k_m + h(s_{\text{old}}, s_{\text{new}})$$
<p>When an edge $(u, v)$ changes, update $\mathit{rhs}(u)$, and queue $u$ if it is inconsistent. Then pop cells until $\operatorname{key}(\text{start}) \le$ the queue's top and the start (the robot's cell) is consistent.</p>
<p><b>Where it comes from.</b> Koenig and Likhachev's D* Lite (2002) is Lifelong Planning A* run backwards, with the offset for a moving start. Its correctness rests on the same consistency argument as A*'s, applied to cells with two values. The cost model, the heuristic and the corner-cutting rule are the same as in the lab's A*, so the two planners return paths of the same cost. Where two routes cost the same, the planners may break the tie differently, so the logged lengths can differ by up to 0.2 m. Apart from that, only the work differs. <a class="chref" href="#notes=ch4/8-d-lite-the-search-kept-alive">The two values, the keys, the repair loop and the measured runs: chapter 4 §8</a></p>
<p><b>What the lab does.</b> Plan → D* Lite turns it on. The search is kept in the planner's state as long as the goal, the planner and $\varepsilon$ do not change. Each plan or replan logs its vertex updates, which are D* Lite's counterpart of A*'s expansions. After a map change it also logs how many cells changed. The Plan tab's info line keeps the running count. Step through the last search plays the last repair, which on a static map covers a small patch of cells instead of flooding the grid. The numbers below are at seed 7. A Try that switches planners first shows the first plan of the level's default planner, before D* Lite takes over.</p>

## Try: A* with a periodic replan
cfg: {"sim":true,"level":1,"set":{"replan":1},"tab":"plan"}
Setup: L2, the warehouse with its prior map, with a replan every second from the current estimate. The map never changes; only the robot moves. Plan tab.
See: The 81 s mission runs 76 plans, with 152 500 expansions and 72 ms of planning in all. Every replan is a fresh search of one or two thousand cells, for a path that is almost the same as the last one. The robot reaches four goals in 81 s.
Shows: A* keeps nothing between plans. Each replan costs a full search, even when the answer has not changed. On this grid that is a millisecond nobody notices. On a large grid it can use up the whole time budget for planning.
Predict: A replan every second on a map that never changes. What will Search effort in the status strip read at the periodic replans?
- A fresh search each time: thousands of expansions at the start of a long leg, tens near its end
- Nothing after the first plan: the path has not changed, so there is nothing to search
- The same number every time: each replan searches the whole map
Answer: 0

## Try: D* Lite with a periodic replan
cfg: {"sim":true,"level":1,"set":{"replan":1,"plan":"dstar"},"tab":"plan"}
Setup: The same mission with D* Lite.
See: The robot reaches the same four goals, on paths of the same cost, for a fraction of the search:
| Planner | Plans | Search effort | Planning time, in all (ms) |
|---|---|---|---|
| A* | 76 | 152 500 expansions | 72 |
| D* Lite | 78 | 24 100 vertex updates | 59 |
Look at where the updates go. The three fresh searches, one for each new goal, cost 2 600, 900 and 13 400. Of the seventy periodic replans between them, 65 cost nothing at all, and Search effort shows a dash. The other eight cost from 34 to 2 000. When both planners plan from the same pose, their path costs agree to a ten-thousandth. Where two routes tie, D* Lite picks a different one, up to 0.2 m longer (13.2 m against A*'s 13.0 on the second leg).
Shows: When no cost has changed, a replan after the robot has moved a metre usually has nothing to repair. The values from the last search still hold, and the path is read off them from the new start. The run also shows what the repair costs. The fresh search for the 26 m goal took 13 400 updates and 28 ms, where A* took 8 600 and 4 ms. Settling one cell in D* Lite means recomputing the lookahead of all eight neighbours, each over its own eight neighbours. A* only relaxes eight edges, which means checking whether each neighbour is cheaper to reach through the cell.
Predict: D* Lite with the same replan every second, on a map that never changes. What will Search effort read at the periodic replans?
- A dash most of the time: no cost changed, so the values of the last search still hold and there is nothing to repair
- A few hundred each: the cells along the metre the robot moved
- The same as A*'s: a replan is a replan
Answer: 0

## Try: Lidar mapping, A*
cfg: {"sim":true,"level":3,"tab":"plan"}
Setup: L4, which the robot maps as it drives, with the three "path blocked" replans of the replanning lesson. Plan tab.
See: There are seven plans, with 13 900 expansions and 9 ms of planning in all. The replan at 13 s, when a wall appears 2 m ahead, costs 60 expansions.
Shows: This run is the reference for the next one. The cost of an A* replan depends on how far away the goal is, and not on how many cells changed.
Predict: Near 13 s a wall appears across the path about 2 m short of the first goal, and A* replans ("path blocked" in the log). What does that replan cost?
- A few dozen expansions: A* pays for the distance to the goal, not for how much of the map changed
- Thousands: the map has changed since the last plan, so the search starts over on all of it
- As much as the first plan to that goal, about 1 500: a replan is a fresh search of the same leg
Answer: 0

## Try: Lidar mapping, D* Lite
cfg: {"sim":true,"level":3,"set":{"plan":"dstar"},"tab":"plan"}
Setup: L4 with D* Lite.
See: Against the A* run on the same map:
| Planner | Plans | Search effort | Time, in all (ms) | Replan at 13 s |
|---|---|---|---|---|
| A* | 7 | 13 900 expansions | 9 | 60 expansions |
| D* Lite | 8 | 49 700 updates | 85 | 3 860 repaired |
At 13 s, D* Lite's replan repairs 3 860 vertices after 4 379 cells changed. Over the whole run it makes 3.6 times as many updates as A* makes expansions, and takes nine times as long, for paths of the same cost. (Two legs differ by 0.1 m in length, where a tie was broken the other way.) The replans at 4 s and 31 s repair 12 600 and 11 900 vertices, and the fresh plan for the 20 m goal costs 13 500 updates against A*'s 6 400.
Shows: D* Lite saves work only when few cells change between plans, and lidar mapping changes many. Every scan reveals wall cells, and each new wall cell changes the inflation band's penalties over a hundred cells around it. The lab already ignores penalty changes under 0.1, to keep small shifts of the band out of the repair. With thousands of cells changing between plans, the repair floods the grid like a fresh search, with extra bookkeeping on top. Real stacks that use D* Lite give it a binary occupancy grid with sparse updates, instead of an inflated cost field that shifts with every scan.
Predict: The same run with D* Lite, where every scan of the growing map moves the inflation band around the walls it reveals. What does the "path blocked" replan near 13 s cost, where A* paid a few dozen expansions?
- A few dozen updates as well: only the new wall matters
- Thousands of updates: thousands of cells changed since the last plan
- Zero: the path was not touched by the new wall
Answer: 1

## Try: Agent-blocking replans, D* Lite
cfg: {"sim":true,"level":4,"set":{"plan":"dstar"},"tab":"plan"}
Setup: L5 with D* Lite. The speed planner escalates twice to a replan with the people stamped into the costmap.
See: The two escalations and the whole run, against A*:
| Search | Cells changed | D* Lite vertex updates | A* expansions |
|---|---|---|---|
| first escalation | 1 696 | 7 400 | 1 700 |
| second escalation | 1 253 | 4 400 | 4 600 |
| the whole run | — | 29 100 in 78 ms | 77 700 in 42 ms |
Read the last row. D* Lite does less search and takes more time, and both runs reach five goals. The paths are within a few tenths of a metre of A*'s until the second escalation. That comes at 102 s instead of 99 s, because the two runs have drifted apart by then.
Shows: D* Lite searches fewer cells and still takes more milliseconds, because each of its updates costs about eight A* relaxations. It breaks even at roughly an eight-fold saving in expansions. The periodic replan on a static map gets there, and a costmap that changes all the time does not. Which planner to use depends on what changes, how often, and how big the grid is.
Predict: On the busy floor the speed planner twice escalates to an "agent blocking" replan, which stamps the people's predicted positions into the costmap as lethal. What will D* Lite's log line say at those two replans?
- A few dozen cells changed: only the people's discs were stamped
- Over a thousand cells changed, and thousands of vertex updates to repair them
- No cells changed: the stamps are cleared again after the plan
Answer: 1

## Code: the repair loop
snippet: dstar
focus: const updateVertex = u => {
focus: D.km += h(D.sLast, s);
focus: while (H.size && (H.k[0] < key(s) || D.rhs[s] !== D.g[s])) {
Note: The three marked lines hold the core of the algorithm. updateVertex recomputes a cell's lookahead and queues the cell when the lookahead disagrees with $g$. The $k_m$ line folds the robot's motion into the keys. The while line is the stopping rule of computeShortestPath. Everything above them is the same cost model as in gridSearch, so the path costs agree. The planner slot gets a fresh costmap on each call, but mem survives between calls. A D* Lite of your own would keep its $g$ and $\mathit{rhs}$ there; start from the A* example.
example: plan/astar

## Think about
Q: Why does the search run from the goal and not from the robot?
A: The robot moves and the goal does not. Costs to the goal stay valid when the robot moves, and costs from the start would all change. Run backwards, the robot's motion only changes where the search stops, which the $k_m$ offset handles. Run forwards, it would change everything computed so far.
Q: The lab ignores penalty changes under 0.1 for D* Lite. What does that do to the paths?
A: The paths can be slightly off the A* optimum where the inflation band shifted a little. A cell whose penalty went from 0.30 to 0.38 keeps its old cost in D* Lite's graph until the penalty changes by more. On the lidar-mapping run, planned from the same pose, D* Lite's path costs still matched A*'s to a ten-thousandth. A path's turning points are decided by walls and by large steps in the penalty, and small shifts do not move them. The tolerance trades repair cost against strict optimality.
Q: When would you choose D* Lite on a real robot, and when plain A*?
A: Choose D* Lite on a large grid with sparse, binary changes, such as a rover's map growing cell by cell or a warehouse map where a pallet appears now and then. It also suits any case where a search takes longer than the control cycle. Choose A* on a grid small enough to search in a millisecond, or on a cost field that changes everywhere on every cycle, where there is nothing worth keeping. Most indoor stacks today run A* or one of its lattice variants a few times a second and repair nothing, because the grid is small. Nav2, the navigation stack of ROS 2, plans on its 2D costmap from scratch.

## Check yourself
Q: Over the periodic-replan run D* Lite made 24 100 vertex updates and A* 152 500 expansions. If one update costs as much as eight expansions, what is A*'s work as a fraction of D* Lite's, to one decimal?
Answer: 0.8
Tolerance: 0.05
Unit: ×
How: $152\,500 / (24\,100 \times 8) = 152\,500 / 192\,800 = 0.79$: D* Lite makes six times fewer updates than A* makes expansions, but does slightly more work in all, so the two times, 72 and 59 ms, are close
