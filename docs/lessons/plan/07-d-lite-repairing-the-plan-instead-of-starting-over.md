group: plan
title: D* Lite: repairing the plan instead of starting over

<p><b>Why this matters.</b> Every replan in this lab so far has thrown the previous search away and run A* again from scratch, three times a second if the periodic replan is on. On a 38 000-cell grid that costs a couple of milliseconds, and the behaviour layer never notices. On a planetary rover's map, or a 10-million-cell costmap at 20 Hz, it does, and the answer the field found in the 1990s is to keep the search alive: when the map changes a little or the robot moves a little, repair the parts of the search the change touched and leave the rest. D* Lite is the clean version of that idea, and this lesson puts it next to A* on the same costmap, with the same paths, to measure what the repair saves and what it costs.</p>
<p><b>The idea.</b> Run the search backwards, from the goal toward the robot, so that the robot's motion only moves the search's end point and the values already computed stay valid. Every cell keeps two numbers: $g$, its current cost-to-goal, and $\mathit{rhs}$, a one-step lookahead, the best cost through any neighbour. Where the two agree the cell is settled; where they disagree it is inconsistent and sits in a priority queue, keyed by the smaller of the two plus the heuristic to the robot. The main loop pops the most urgent inconsistent cell, settles it, and re-examines its neighbours, until the robot's cell is consistent and nothing cheaper is queued. When an edge cost changes, only the cells whose $\mathit{rhs}$ depends on it become inconsistent; when the robot moves, a single offset $k_m$ added to every future key keeps the old keys comparable. A replan is then whatever the queue has to say, which after a small change is a handful of cells.</p>
$$\mathit{rhs}(u) = \min_{v \in \operatorname{succ}(u)} \bigl(c(u, v) + g(v)\bigr), \qquad \mathit{rhs}(\text{goal}) = 0$$
<p>A cell is consistent when $g(u) = \mathit{rhs}(u)$. The queue orders by the first component of the key and breaks ties by the second:</p>
$$\operatorname{key}(u) = \bigl[\min(g, \mathit{rhs}) + h(\text{start}, u) + k_m,\ \min(g, \mathit{rhs})\bigr]$$
<p>When the robot moves from $s_{\text{old}}$ to $s_{\text{new}}$, the offset grows so that old keys stay comparable to new ones:</p>
$$k_m \leftarrow k_m + h(s_{\text{old}}, s_{\text{new}})$$
<p>When an edge $(u, v)$ changes, update $\mathit{rhs}(u)$ and queue $u$ if it is inconsistent; then pop until $\operatorname{key}(\text{start}) \le$ the queue's top and start is consistent.</p>
<p><b>Where it comes from.</b> Koenig and Likhachev's D* Lite (2002) is Lifelong Planning A* run backwards with the moving-start trick; its correctness rests on the same consistency argument as A*'s, applied to the two-valued cells. The cost model, the heuristic and the corner-cutting rule are exactly the lab's A*, so the two planners return paths of the same cost; where two routes cost the same they may break the tie differently, so the logged lengths can differ by up to 0.2 m, and the only thing that differs is the work. <a class="chref" href="#notes=ch4/8-d-lite-the-search-kept-alive">The two values, the keys, the repair loop and the measured runs: chapter 4 §8</a></p>
<p><b>What the lab does.</b> Plan → D* Lite. The search lives in the state as long as the goal, the planner and $\varepsilon$ do not change; each (re)plan logs its vertex updates (the counterpart of A*'s expansions) and, after a map change, how many cells changed. The Plan tab's info line keeps the running count, and Step through the last search plays the last repair, which on a static map is a patch rather than a flood. The numbers below are at seed 7; a Try that switches planners shows the level's default planner's first plan before D* Lite takes over.</p>

## Try: A* with a periodic replan
cfg: {"sim":true,"level":1,"set":{"replan":1},"tab":"plan"}
Setup: L2, the warehouse with its prior map, a replan every second from the current estimate: the map never changes, only the robot moves. Plan tab.
See: 76 plans in the 81 s mission, 152 500 expansions, 72 ms of planning in all: every replan is a fresh flood of one or two thousand cells for a path that is almost the same as the last one. Four goals in 81 s.
Shows: A* has no memory. Each replan pays the full price of the search even when the answer did not change, which on this grid is a millisecond nobody notices, and on a large one is the budget.
Predict: Switch the planner to D* Lite with the same periodic replan. The expansions over the run?
- About six times fewer: a replan that only moved the start costs a few hundred vertex updates
- The same: a replan is a replan
- More: D* Lite expands twice per cell
Answer: 0

## Try: D* Lite with a periodic replan
cfg: {"sim":true,"level":1,"set":{"replan":1,"plan":"dstar"},"tab":"plan"}
Setup: The same mission with D* Lite.
See: 78 plans, 24 100 vertex updates, 59 ms in all, the same four goals and paths of the same cost: planned from the same pose, the two costs agree to a ten-thousandth, and where two routes tie D* Lite picks a different one, up to 0.2 m longer (13.2 m against A*'s 13.0 on the second leg). The three fresh searches, one per new goal, cost 2 600, 900 and 13 400 updates; the seventy periodic replans between them cost a few hundred each, the cells along the metre the robot moved and the ones whose keys that motion touched. Step through the last search: a patch around the robot, not a flood.
Shows: What the repair saves: a replan after the robot moved a metre touches the cells along the metre and little else. What it costs is also visible: the fresh search for the 26 m goal took 13 400 updates and 28 ms where A* took 8 600 and 4 ms, because settling one cell means recomputing the lookahead of all eight neighbours, each over its eight neighbours, where A* relaxes eight edges.
Predict: Now L4, where the lidar is building the map and every scan changes the costmap's inflation band. What does D* Lite do at a "path blocked" replan?
- Repairs a few cells: only the new wall matters
- Repairs thousands: the inflation band around every newly seen wall moved
- Fails: it cannot handle cost increases
Answer: 1

## Try: Lidar mapping, A*
cfg: {"sim":true,"level":3,"tab":"plan"}
Setup: L4, mapping as it drives, the three "path blocked" replans of the replanning lesson. Plan tab.
See: Seven plans, 13 900 expansions, 9 ms in all; the replan at 13 s, when a wall appears 2 m ahead, costs 60 expansions.
Shows: The reference. A* does not care how many cells changed; it cares how far the goal is.
Predict: The same run with D* Lite. The replan at 13 s?
- About 60 updates as well
- Thousands of updates: over four thousand cells changed since the last plan
- Zero: the path was not touched by the new wall
Answer: 1

## Try: Lidar mapping, D* Lite
cfg: {"sim":true,"level":3,"set":{"plan":"dstar"},"tab":"plan"}
Setup: L4 with D* Lite.
See: Eight plans, 49 700 vertex updates, 85 ms: 3.6 times A*'s expansions and nine times its time, for paths of the same cost (two legs differ by 0.1 m in length, a tie broken the other way). The replan at 13 s repairs 3 860 vertices after 4 379 cells changed; the ones at 4 s and 31 s repair 12 600 and 11 900. The fresh plan for the 20 m goal costs 13 500 updates against A*'s 6 400.
Shows: D* Lite's bargain holds when changes are sparse. Lidar mapping is the opposite: every scan reveals wall cells, each new wall cell moves the inflation band's penalties over a hundred cells around it, and the lab already ignores penalty changes under 0.1 to keep the band's breathing out of it. With thousands of cells changing between plans the repair is a flood with extra bookkeeping. Real stacks that use D* Lite feed it binary occupancy with sparse updates, not an inflated cost field that shifts with every scan.
Predict: L5, the busy floor, where the two "agent blocking" replans stamp the people's predicted positions into the costmap as lethal. What will D* Lite's log line say at those two replans?
- A few dozen cells changed: only the people's discs were stamped
- Over a thousand cells changed, and thousands of vertex updates to repair them
- No cells changed: the stamps are cleared again after the plan
Answer: 1

## Try: Agent-blocking replans, D* Lite
cfg: {"sim":true,"level":4,"set":{"plan":"dstar"},"tab":"plan"}
Setup: L5 with D* Lite; the speed planner escalates twice to a replan with the people stamped into the costmap.
See: The two escalations change 1 696 and 1 253 cells and cost 7 400 and 4 400 vertex updates, against 1 700 and 4 600 A* expansions. Over the run: 29 100 updates in 78 ms against A*'s 77 700 expansions in 42 ms, fewer expansions, more time, five goals either way. The paths are within a few tenths of a metre of A*'s until the second escalation, which comes at 102 s instead of 99 s because the two runs have drifted apart by then.
Shows: Fewer expansions and more milliseconds at the same time: each D* Lite update is about eight A* relaxations, so the break-even is roughly an eight-fold saving in expansions, which the periodic replan on a static map reaches and a costmap under constant change does not. The right tool depends on what changes, how often, and how big the grid is.

## Code: the repair loop
snippet: dstar
focus: const updateVertex = u => {
focus: D.km += h(D.sLast, s);
focus: while (H.size && (H.k[0] < key(s) || D.rhs[s] !== D.g[s])) {
Note: Three marked lines are the whole algorithm: updateVertex recomputes a cell's lookahead and queues it when it disagrees with $g$; the $k_m$ line absorbs the robot's motion into the keys; the while line is computeShortestPath's stopping rule. Everything above them is the same cost model as gridSearch, which is why the path costs agree. The planner slot gets a fresh costmap each call, but mem survives between calls: a D* Lite of your own would keep its $g$ and $\mathit{rhs}$ there (the A* example is the place to start).
example: plan/astar

## Think about
Q: Why does the search run from the goal and not from the robot?
A: Because the robot moves and the goal does not. Costs-to-goal stay valid when the robot moves; costs-from-start would all change. Running backwards makes the robot's motion a change of where the search stops, handled by the $k_m$ offset, instead of a change of everything computed.
Q: The lab ignores penalty changes under 0.1 for D* Lite. What does that do to the paths?
A: They can be slightly off the A* optimum where the inflation band shifted a little: a cell whose penalty went from 0.30 to 0.38 keeps its old cost in D* Lite's graph until it changes by more. On the lidar-mapping run, planned from the same pose, D* Lite's path costs still matched A*'s to a ten-thousandth, because a path's turning points are decided by walls and big penalty steps; the tolerance is a knob between repair cost and strict optimality.
Q: When would you choose D* Lite on a real robot, and when plain A*?
A: D* Lite on a large grid with sparse, binary changes: a rover's map growing cell by cell, a warehouse map where a pallet appears now and then, any case where the search takes longer than the control cycle. A* on a grid small enough to search in a millisecond, or on a cost field that changes everywhere every cycle, where there is nothing to keep. Most indoor stacks today run A* or its lattice cousins at a few hertz and repair nothing, because the grid is small; the 2D costmap in ROS 2's Nav2 is planned from scratch.

## Check yourself
Q: Over the periodic-replan run D* Lite made 24 100 vertex updates and A* 152 500 expansions. If one update costs as much as eight expansions, what is A*'s work as a fraction of D* Lite's, to one decimal?
Answer: 0.8
Tolerance: 0.05
Unit: ×
How: $152\,500 / (24\,100 \times 8) = 152\,500 / 192\,800 = 0.79$: D* Lite makes six times fewer updates than A* makes expansions, but does slightly more work in all, which is why the two times, 72 and 59 ms, are close
