id: ch4
num: 4
sys: plan
summary: The derivations behind the Planning lessons: the costmap as a graph, A* optimality and the weighted-A* bound, RRT* and why its radius shrinks. Then Reeds–Shepp paths and Hybrid A* for a car, the mission state machine and goal ordering, and space-time A* against predicted people.

# Planning: search, sampling, cars and time

A planner turns the costmap of chapter 3 into a route. This chapter derives the four planners in the lab and the layer that decides when to run them, in the order of the Planning lessons. They are A* and its heuristic (lesson 1), RRT* (lesson 2), Hybrid A* for the car (lesson 3), the mission state machine (lesson 4) and space-time A* (lesson 5). The blue numbers follow your settings: the heuristic weight is ε = {{live:eps}}, and RRT* gets {{live:rrtIt}} samples. The car planner uses {{live:planPct}} % of the steering lock (turning radius {{live:Rplan}} m against {{live:Rmin}} m at full lock), and the prediction horizon is {{live:agT}} s.

## 1. The costmap as a graph

Every grid planner here searches the same graph. The nodes are the 38 400 cells of the 0.1 m grid, minus the lethal ones. Each cell connects to its eight neighbours. A diagonal move is allowed only if both cells it cuts between are free, so a path cannot slip between two obstacles that touch at a corner. The cost of a move is its length times the inflation surcharge of the cell it enters:

$$
c(u \to v) = \ell_{uv}\,\big(1 + 3\,\text{penalty}(v)\big), \qquad \ell_{uv} \in \{0.1,\ 0.1\sqrt2\}\ \text{m}
$$

Two things follow from this. First, the planner minimizes cost rather than distance. When the shortest route hugs a shelf, the "optimal" route can be a few centimetres longer. In lesson 1 the ε = 1 path on the second leg is 13.0 m and the ε = 3 path 12.5 m, and the ε = 1 path still costs less. Second, the graph changes only when the costmap is rebuilt. On a map that is still being built, a plan is therefore valid for 0.5 s at most. Keeping the plan up to date is the job of the mission layer in §5.

## 2. A*: best-first search with a promise

**The algorithm.** A* keeps a priority queue of cells ordered by $f = g + h$. Here $g$ is the cost of the best path found so far from the start, and $h$ is a heuristic estimate of the cost from the cell to the goal. At each step A* pops the cell with the smallest $f$ and expands its neighbours, updating any neighbour whose $g$ has improved. It stops when the goal is popped. The path is read back through the parent pointers.

**Why the first path it finds is optimal.** Call $h$ admissible if it never overestimates the true cost to go, $h(n) \le h^*(n)$. Suppose A* pops the goal with cost $g(\text{goal}) = f(\text{goal})$ while a cheaper path of cost $C^* < f(\text{goal})$ exists. Take the first cell $n$ on that cheaper path that has not been expanded. Its predecessor was expanded with the right cost, so the cell is in the queue with its optimal $g(n)$. Then $f(n) = g(n) + h(n) \le g(n) + h^*(n) = C^* < f(\text{goal})$, so $n$ would have been popped before the goal. This contradicts the assumption, so the first path to the goal is optimal. A consistent heuristic, one with $h(u) \le c(u \to v) + h(v)$ for every move, gives a stronger result. Each cell's $g$ is then already optimal when the cell is first expanded, so every cell is expanded at most once. For this reason the lab can close a cell for good once it has been expanded.

**The octile heuristic.** On an 8-connected grid with no obstacles, the cheapest path from $(dx, dy)$ to the goal takes $\min(dx, dy)$ diagonal steps and $|dx - dy|$ straight ones:

$$
h = \big(\max(dx, dy) + (\sqrt2 - 1)\min(dx, dy)\big) \times 0.1\ \text{m}
$$

This is the exact cost in free space. It leaves out the inflation surcharge, which can only make the true cost larger, so it never overestimates. It is therefore admissible, and it is consistent as well. No heuristic that ignores obstacles can be tighter. With it, A* on the warehouse expands 1 000 to 9 000 cells per leg rather than all 38 400.

**Weighted A*.** Multiplying the heuristic by ε > 1 makes the search greedier. Cells that look close to the goal are expanded first, and cells in the wrong direction are left waiting in the queue. The path is no longer optimal, but its cost is bounded. To see the bound, repeat the argument above with $f = g + \varepsilon h$. When the goal is popped, every cell $n$ on the optimal path still in the queue satisfies $f(n) = g(n) + \varepsilon h(n) \le g(n) + \varepsilon h^*(n) \le \varepsilon C^*$. The goal was popped with $f(\text{goal}) = g(\text{goal}) \le f(n)$, so

$$
\text{cost of the path found} \le \varepsilon\, C^*
$$

In practice the paths are much better than the bound. In lesson 1, ε = 3 returns paths within a few percent of optimal and expands up to 14 times fewer cells on the longer legs. On a floor with aisles the greedy direction is usually the right one. The bound matters in mazes, where the greedy direction leads into a dead end.

**From cells to a path.** The search returns a sequence of cells. The lab reduces it to its turning points and then shortcuts it. From each point, the next waypoint is the farthest later point that a straight segment can reach while staying 0.5 m from obstacles (the lethal distance plus 0.1 m). The result is a polyline the tracker can follow, and it is the path the Try buttons draw.

[try: A*, ε = 1 | {"sim":true,"level":1,"set":{"eps":1},"tab":"plan","layers":{"search":true},"searchStep":true}] [try: A*, ε = 3 | {"sim":true,"level":1,"set":{"eps":3},"tab":"plan","layers":{"search":true},"searchStep":true}]

## 3. RRT*: planning by sampling

**The algorithm.** RRT* grows a tree from the start. Each iteration draws a random point (the goal itself with probability 0.1), finds the nearest tree node, and steps 0.6 m from it towards the sample. If the new point is free, every node within a radius $r_n$ is a candidate parent. The one that gives the lowest cost-to-come along a collision-free segment is chosen, and the new node is added. Then the tree is rewired. For each neighbour, if reaching it through the new node is cheaper and collision-free, the new node becomes its parent. After $N$ iterations the best node within 1 m of the goal is connected to the goal, and the path is read back.

**Why the radius shrinks.** The lab uses

$$
r_n = \min\!\left(8\sqrt{\frac{\ln n}{n}},\ 1.5\right)
$$

with $n$ the current number of nodes. The form comes from the proof that RRT* is asymptotically optimal (Karaman and Frazzoli, 2011). Suppose the radius shrinks no faster than $\gamma\sqrt{\ln n / n}$, with $\gamma$ above a constant set by the free area. In two dimensions that condition reads

$$
\gamma > 2\sqrt{\tfrac{3}{2}\,\frac{\mu(X_{\text{free}})}{\pi}}
$$

Then the expected number of nodes inside the radius grows like $\ln n$. That gives the rewiring enough neighbours to keep finding improvements, while the cost per iteration stays $O(\ln n)$. The path cost then converges to the optimum with probability one as $n \to \infty$. A fixed radius would also converge, but each iteration would cost $O(n)$. With a radius that shrinks faster, the path cost would no longer converge. For the warehouse's 260 m² of free floor the constant works out to about 22. The lab's γ = 8, with a 1.5 m cap, is well below it, as is common in practice. The condition is sufficient but not necessary, and on a floor this small a γ that met it would make every iteration examine most of the tree.

**What a finite budget buys.** Convergence only says what happens as $n \to \infty$. At $n$ = 1500 on the warehouse, the first leg of lesson 2 comes out between 8.3 and 15.3 m depending on the seed, against 8.6 m for A*. Half the seeds find the short way through the near aisle. The other half commit early to the long way round and never rewire out of it, because rewiring only improves connections inside $r_n$ and cannot move a subtree to a different aisle. With 4000 samples, six seeds in ten find the short route. With 300, four in ten find no connection to the goal at all. Sampling needs no grid, so it scales to high-dimensional spaces where a grid would be far too large. In exchange, its result varies from seed to seed, and a grid search's does not.

[try: RRT* | {"sim":true,"level":1,"set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}] [try: Next seed | {"sim":true,"level":1,"seed":"next","set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}]

## 4. Planning for a car

**Why a grid path fails.** A car cannot move sideways or turn in place. Its heading is part of its state, and from a heading θ it can only move along arcs with a radius of at least $R_{\min}$. With wheelbase $L$ and maximum steering angle $\delta_{\max}$,

$$
\dot\theta = \frac{v \tan\delta}{L}, \qquad R_{\min} = \frac{L}{\tan \delta_{\max}} = \text{{{live:Rmin}} m}
$$

A grid path has corners of zero radius and says nothing about heading. A car following it swings wide at every corner, and it cannot park at all. In lesson 3's last experiment, plain A* on the car reaches none of the four goals. The car planners that work keep a margin on the steering lock. They plan with {{live:planPct}} % of δ<sub>max</sub>, a turning radius of {{live:Rplan}} m, so that the tracker has steering left to correct errors with. At 100 % every planned turn is at full lock and the tracker has nothing in reserve. Lesson 3 has an experiment with that setting, and in it the car gets stuck twice.

**Reeds–Shepp paths.** Between two poses with no obstacles, the shortest path for a car that can reverse is made of at most five pieces. Each piece is an arc at minimum radius (L or R) or a straight (S), and the car may change direction between pieces. A path is written as a word of these letters, such as LSR. Reeds and Shepp (1990) showed that 48 such words are enough. By symmetry (reflecting, reversing time, swapping L and R) they reduce to 12 families. For each query the lab evaluates all 12 families with their four symmetry images. It checks each candidate by integrating it to the end pose, and keeps the shortest one that lands there. With the problem scaled so that $R = 1$, the formulas for each family are a few lines of trigonometry. The lab uses these paths in two places. They are a planner of their own (the Reeds–Shepp option, which ignores obstacles), and Hybrid A* uses them twice, in its heuristic and in its analytic expansion (both below).

**Hybrid A*.** Hybrid A* keeps A*'s discrete search, but every node carries a continuous pose $(x, y, \theta)$ and every edge is a motion the car can make. The lab's version follows Dolgov et al. (2010) and has these parts.

- The grid is 0.2 m × 0.2 m × 5° (72 headings). It is used only to decide which poses count as "the same" when a cell is closed. The pose stored in a cell is the exact pose that reached it first.
- From each node the search tries ten primitives (short fixed motions), forward or reverse at five steering angles $\{-\delta, -\delta/2, 0, \delta/2, \delta\}$. Each is a 0.4 m arc, integrated in 0.1 m steps with the footprint checked at every step. The footprint is three circles along the body. They cover the rectangle and stick out beyond it by about 0.14 m at the corners.
- The cost of a primitive is its length, times 2 in reverse. Small terms are added for steering and for changing the steering. Changing gear adds a penalty of 2, and a quadratic proximity term keeps the car from scraping past obstacles. These terms are preferences. They make the search favour smooth forward paths without reversals, but they do not forbid the others.
- There are two heuristics, and the search uses the larger of the two. One is an 8-connected Dijkstra search from the goal on the 0.1 m grid, which knows about obstacles but not about turning. The other is the Reeds–Shepp length to the goal pose, which knows about turning but not about obstacles. Each underestimates the true cost, so each is admissible. The larger of two admissible heuristics is also admissible, and it is at least as tight as either. With only the 2D heuristic, the search has no information about the heading it must arrive with, and it sorts the heading out in the last metre. This causes the heading error you see in lesson 3's second experiment.
- The analytic expansion tries the Reeds–Shepp paths from the current node straight to the goal pose (the "shots") and accepts the first one that is collision-free. It does this within 2.5 m of the goal, and on every tenth expansion elsewhere. Most plans are finished this way. The search gets the car into the right room, and the shot parks it. In the lesson's first run, three of the four plans end in a shot. The third finds one after only 30 expansions. The first two needed 7 000 to 10 000, because they had to search most of the way before a shot was collision-free.
- The search has a budget of 60 000 expansions. After that the planner reports failure, so that it cannot hang the loop.

[try: Hybrid A*, L6 | {"sim":true,"level":5,"tab":"plan","layers":{"search":true},"searchStep":true}] [try: Plain A* on the car | {"sim":true,"level":5,"set":{"plan":"astar"},"tab":"plan"}]

## 5. The mission layer

**Ordering the goals.** When several goals are open, the mission can visit them in the given order, greedily (always the nearest next, by costmap distance), or in the optimal order. The distances come from one Dijkstra search per goal on the costmap (A* with $h$ = 0 and no target), so they take the walls into account. Finding the optimal order is a travelling-salesman problem. With at most eight goals the lab solves it exactly, by depth-first enumeration with branch-and-bound. Any partial order whose cost already exceeds the best complete one is pruned. Eight goals give at most 40 320 orders, which takes no time to search. Eighty goals would not, and real missions use heuristics for this step.

**The state machine.** A plan takes milliseconds, so the mission replans whenever an assumption behind the current plan stops holding. The table lists the transitions, and the Mission tab draws the state machine live.

| From | Trigger | To |
| --- | --- | --- |
| PLAN | planner returned a path | DRIVE |
| PLAN | planner failed | NO_PATH (retry after 2 s; skip the goal after 3 failures) |
| DRIVE | a lethal cell on the path within 6 m, checked every 0.5 s | PLAN ("path blocked") |
| DRIVE | the estimate more than 1 m from the path | PLAN ("off path") |
| DRIVE | less than 0.15 m of progress in 5 s | PLAN ("stuck"; at an obstacle, after backing off; the goal is skipped after 3) |
| DRIVE | heading for the edge of the seen floor (below), every 1 s | PLAN ("periodic", not logged) |
| DRIVE | the periodic timer, if set | PLAN ("periodic", not logged) |
| DRIVE | the speed planner cannot resolve a person by slowing | PLAN ("agent blocking") |
| DRIVE | position σ above 1 m, with the lost guard on | LOST (hold and turn until σ < 0.4 m) |
| DRIVE | within 0.25 m of the goal (0.2 m and 0.2 rad for a posed car goal) | next goal, or DONE |

Two of the triggers need more explanation. The "off path" rule lets the mission recover from a kidnapping (chapter 2 §6), where the robot is moved without being told. As soon as the estimate jumps, the plan is rebuilt from where the robot now believes it is. That helps only if the new estimate is right. The "agent blocking" rule is used when the speed planner, in the trajectory layer, cannot resolve a person by slowing down and hands the problem up to the planner. For that one plan, the predicted positions of the people over the next 2 s are stamped into the costmap as obstacles, so the new route goes around where they will be. Afterwards the costmap is rebuilt without them.

The "stuck" rule has an extra step when the robot is next to an obstacle. A replan from inside the lethal band starts at the nearest free cell, a few centimetres away at the band's edge. The tracker looks past that cell, along the wall, and pushes the robot back into the band. After three such replans the goal is skipped. So the ground robot first backs off in a straight line to the nearest cell 0.2 m clear of the band, and replans from there. If it faces the wall, it first turns in place, which it can do while in contact. The car does not back off, because its plans have reverse legs of their own. The back-off is also not used with the straight-line planner, which ignores the map, or with the learned policy, which has its own fallback (§10). After the replan, both of those would drive straight back into the obstacle.

[try: Discover the building | {"sim":true,"level":3,"tab":"mis"}] [try: Agent-blocking replans | {"sim":true,"level":4,"tab":"mis"}]

**A goal in unseen space.** The cautious policy of chapter 3 §3 treats unknown cells as lethal. Under it there is no path to a goal in space the robot has not seen, and a robot that does not move sees nothing new. So the mission layer gives the planner a stand-in goal at the edge of the floor it can plan through. The candidates are the reachable cells that lie 0.2 to 0.35 m beyond the lethal band (the margin a frontier goal keeps, §7). Their nearest obstruction must be unknown space rather than a wall the robot has seen. The stand-in is the candidate with the least
$$
c(u) = g(u) + \lVert u - \text{goal} \rVert,
$$
that is, the route cost $g$ from the robot plus the straight line on to the goal, with the unknown space beyond taken as free. This is A*'s own $f = g + h$, cut off at the edge of what is known. The stand-in is recomputed with every plan, which is once a second while the map grows. As soon as the goal itself is on seen floor, the planner gets the real goal. If the best edge cell is the one under the robot, the robot makes no progress. The goal then has no plan, as before, and is skipped after three tries. The method is frontier exploration (§7) with the goal added to the score. It makes the mission slower, but the goals are still reached. On L4 the cautious run takes all four goals in 83 s and 51 m, against 67 s and 50 m with the optimistic policy. On seeds 1 to 5 it takes all four every time, in 71 to 98 s, with up to two touches.

[try: Unknown = lethal | {"sim":true,"level":3,"set":{"unknownAs":"lethal"},"tab":"per"}]

## 6. Space-time A*: time as a coordinate

A* on a map decides which way to go, but not when. Adding time to the state makes waiting a move of its own, so a plan can pause in a doorway while someone passes.

**The state and the moves.** The state is $(i, j, k)$, a cell on a coarser 0.2 m grid plus a time index. Time is quantized by the time to cross one cell at the reference speed, $\Delta t = 0.2\,\text{m} / v_0$ = {{live:dtc}} s. A straight move takes one step and a diagonal move two. Waiting in place takes one step and costs 1.2 times as much as a straight move, so the planner waits only when it must. The horizon is {{live:agT}} s, or {{live:nt}} steps. Beyond it all times share one state. There are no predictions to respect there, so the search becomes plain A* on the static map.

**What is blocked.** Cell $(i, j)$ is blocked at step $k$ if its centre lies inside any person's predicted disc at that time. The disc is the one from chapter 3 §6, grown by the robot's radius and a clearance margin of {{live:stMarg}} m:

$$
\text{blocked}(i, j, k) \iff \exists a:\ \|c_{ij} - p_a(k\Delta t)\| < r_a(k\Delta t) + r_{\text{robot}} + \text{margin}
$$

A diagonal move is also checked at the intermediate step, so the robot cannot cut through a person in the middle of a two-step move. Static lethal cells block at every time.

**Heuristic and budget.** The heuristic is the octile distance to the goal in time units. It assumes free space and no waiting, so it is admissible. The search is capped at 60 000 expansions. If the horizon is too crowded to cross, the planner reports "no space-time route within the horizon" and the mission retries 2 s later. That happened once in lesson 5's first run. The output is a path with the waits folded in. The speed planner of the Control tab still enforces the timing, and it reacts when the predictions turn out wrong. The planner picks the route in space-time, and the speed planner keeps to the schedule.

**What it costs and buys.** The time dimension multiplies the number of states, and the coarser grid pays for it. Space-time A* even expands fewer cells than plain A* on the same legs (200 to 3 500 against 1 400 to 5 900 in lesson 5). What it gains depends on the people. Against scripted people on the busy floor it makes one contact. A* with the agent layer also makes one, though in a different encounter. Such a contact comes from a person who moves away from the prediction within the planner's reaction time. Against reactive people it makes none. On this floor the speed planner (the trajectory layer) does most of the work. Space-time planning matters where the route itself must change, in doorways and narrow aisles.

[try: Space-time A* | {"sim":true,"level":4,"set":{"plan":"stastar"},"tab":"plan","layers":{"search":true},"searchStep":true}] [try: A* with the agent layer | {"sim":true,"level":4,"set":{"plan":"astar"},"tab":"plan","layers":{"search":true},"searchStep":true}]

## 7. Frontier exploration: the robot picks its own goals

**The frontier.** With lidar mapping, each cell of the grid holds the log-odds that it is occupied. That gives three kinds of cell: known free ($l < -0.05$), known occupied ($l > 0.5$) and unknown ($|l| < 0.05$, where nothing has been seen). A *frontier cell* is a known-free cell with an unknown 4-neighbour, so from there the lidar would see into the unknown. The lab also drops frontier cells within the lethal radius of a seen wall, because the robot could not stand on them. This test counts seen walls only. If it also counted the unknown, the cautious policy below would rule out every frontier. The frontier cells form 8-connected clusters, called the *frontiers*. Clusters smaller than $N_{\min}$ cells (the Mission tab's "smallest frontier worth a visit", 6 by default) are ignored, because a sliver seen through a doorway is almost always seen on the way to something else.

**The goal cell.** Each frontier is represented by its member cell nearest its centroid. The goal handed to the planner is the known-free cell nearest to that one that keeps a margin of 0.2 m beyond the inflated obstacles. In a corridor too narrow for the margin, it is the nearest known-free cell that is not lethal. For a sliver where every known cell is lethal, it is the nearest cell that is not lethal at all. Under the optimistic policy that is unknown space just past the door, which is where the robot should head. A frontier with no such cell within 2 m counts as unreachable and is left out.

**The choice.** Each frontier is scored by its size divided by its distance from the estimated pose,
$$
u_i = \frac{|F_i|}{1 + d_i},
$$
and the frontier with the highest score becomes the next goal. Exploration wants as much new floor per metre driven as it can get, and size per metre is the crudest estimate of that. Research versions estimate the same ratio more carefully, as expected information gain against path cost. A goal is dropped as soon as none of its cluster's cells borders unknown space any more. This is checked once a second while driving. The drive there usually reveals what was behind the frontier, and 13 of the 14 goals in the run below end this way. A goal that the planner fails to reach three times, or that the robot gets stuck on three times, goes on a failed list and is skipped. When only failed frontiers are left, each is tried once more from wherever the robot now stands. Exploration ends when no frontier is left, or none that has not failed twice.

**The floor seen.** The lab reports the share of the true free floor whose cells are known, as a signal and in the status strip. The true floor comes from the level's map, which the robot does not have. Exploration tries to maximize this share, but a real robot cannot compute it, because it has no true map.

**Measured** on L4 at seed 7, with the default planner and tracker unless stated:

| Run | Floor seen | Time | Distance | Frontier goals | Dropped on the way |
| --- | --- | --- | --- | --- | --- |
| Explore | 100 % | 123 s | 94 m | 14 | 13 |
| The level's four goals | 96 % | 67 s | 50 m | – | – |
| $N_{\min}$ = 20 | 99 % | 102 s | 78 m | 13 | 12 |
| $N_{\min}$ = 2 | 100 % | 141 s | 107 m | 15 | 14 |
| Unknown as lethal | 100 % | 171 s | 127 m | 19 | 16 |
| DWA tracker | 100 % | 187 s | 86 m | 17 | 11, four given up, one retried |

Over six seeds the default run takes 111 to 147 s and 80 to 108 m. It always reaches 100 %, with at most one brush against a shelf. The cautious policy does not block exploration, because a frontier goal always lies on seen floor. (§5 explains how a hand-placed goal in an unseen room is reached under it.) The policy only stops plans from cutting through rooms that have not been looked into yet. Here that costs about two fifths more time, and on seeds 1 to 5 it costs between nothing and a minute and a quarter.

[try: Explore the building | {"sim":true,"level":3,"set":{"mis":"explore"},"tab":"mis"}] [try: Explore with unknown as lethal | {"sim":true,"level":3,"set":{"mis":"explore","unknownAs":"lethal"},"tab":"per"}]

## 8. D* Lite: the search kept alive

**Two values per cell.** Lifelong Planning A* and its moving-start form D* Lite (Koenig & Likhachev 2002) keep, for every cell $u$, the current cost-to-goal $g(u)$ and a one-step lookahead
$$
rhs(u) = \min_{v \in succ(u)} \big(c(u, v) + g(v)\big), \qquad rhs(goal) = 0 .
$$
A cell is *consistent* when $g = rhs$, *overconsistent* when $g > rhs$ (a cheaper way appeared) and *underconsistent* when $g < rhs$ (a way got dearer). Inconsistent cells sit in a priority queue keyed by
$$
k(u) = \big[\min(g, rhs) + h(s, u) + k_m,\ \min(g, rhs)\big],
$$
compared lexicographically (by the first component, and by the second on a tie). Here $h$ is the octile heuristic to the robot's cell $s$, since the search runs from the goal towards the robot, and $k_m$ is an offset explained below. The lab packs the two components into one number, $k_1 + 10^{-6}k_2$, for its binary heap.

**The repair loop.** `computeShortestPath` keeps popping the smallest key while that key is below $k(s)$ or $s$ is inconsistent. An overconsistent cell is settled, $g \leftarrow rhs$, and its predecessors' $rhs$ values are recomputed. An underconsistent cell is reset, $g \leftarrow \infty$, and recomputed together with its predecessors. Each recomputation looks at all eight neighbours, so one vertex update costs about eight A* relaxations (a relaxation checks one edge for a cheaper path). That is the cost of the extra bookkeeping. On a fresh search D* Lite is A* run in reverse, with roughly twice the expansions and seven times the milliseconds. It pays off only on the replans that follow.

**Changes.** When an edge cost changes, the cells whose $rhs$ used that edge are recomputed, and queued if they have become inconsistent. For a changed cell, recomputing its own $rhs$ and those of its eight neighbours covers every edge that touches it. When the robot moves from $s_{old}$ to $s_{new}$, the heuristic term of every key is stale by at most $h(s_{old}, s_{new})$. Adding that amount to $k_m$ once keeps the old keys comparable with new ones, without touching the queue. The lab compares the costmap with the one used for the previous plan. It counts a cell as changed when its lethal flag flips or its penalty moves by more than 0.1. The threshold ignores the small shifts of the inflation band that come with every scan. The lab drops the search and starts again when the goal, the planner or ε changes. The path is read from the robot's cell by always stepping to the successor with the smallest $c + g$. The cost model, the corner-cutting rule and the heuristic are those of §2, so A* and D* Lite return paths of the same cost. From the same pose the costs agree to a ten-thousandth. Where two routes cost the same, the two read-outs can pick different ones, so the smoothed lengths differ by up to 0.2 m.

**Measured** at seed 7, the whole run, plans counted with their expansions (A*) or vertex updates (D* Lite) and the planner's milliseconds:

| Level and trigger | A* | D* Lite | Paths |
| --- | --- | --- | --- |
| L2, prior map, replan every 1 s (76–78 plans) | 152 500 expansions, 72 ms | 24 100 updates, 59 ms | same cost, lengths within 0.2 m |
| L4, lidar mapping, 3 "path blocked" replans (7–8 plans) | 13 900, 9 ms | 49 700, 85 ms (3 600–4 600 cells changed per replan) | same cost, lengths within 0.1 m |
| L5, people, 2 "agent blocking" replans (61–63 plans) | 77 700, 42 ms | 29 100, 78 ms (1 250–1 700 cells stamped) | within 0.3 m until the runs drift apart |

D* Lite pays off where the map is static and only the robot moves. With a prior map and a replan every second, it needs six times fewer expansions than A*. It loses where the costmap changes over large areas between plans, and a cost field inflated from a growing lidar map does that with every scan. D* Lite can need fewer expansions and still take more milliseconds, because each update costs about eight relaxations. It breaks even when it saves a factor of eight in expansions. In real deployments D* Lite runs on large grids of binary occupancy, where each update changes only a few cells.

[try: D* Lite with a periodic replan | {"sim":true,"level":1,"set":{"replan":1,"plan":"dstar"},"tab":"plan"}] [try: Lidar mapping, D* Lite | {"sim":true,"level":3,"set":{"plan":"dstar"},"tab":"plan"}]

## 9. Velocity obstacles: avoiding people in velocity space

**One person, one cone.** Let the person be at relative position $d$, walking at $v_a$, and let $R$ be the robot's and the person's radii added (plus a clearance). If the robot moves at $u$, the relative velocity is $w = u - v_a$ and the robot meets the person at the first $t > 0$ with $|d - t\,w| = R$:
$$
|w|^2 t^2 - 2 (d\cdot w)\, t + |d|^2 - R^2 = 0, \qquad t = \frac{d\cdot w - \sqrt{(d\cdot w)^2 - |w|^2(|d|^2 - R^2)}}{|w|^2}.
$$
If there is no real root, or the root is negative, the two do not collide. If the root lies within the horizon $\tau$, the velocity $u$ is in the person's *velocity obstacle* $VO_a$. Over all $u$, this set is a cone with its apex at $v_a$ (the velocity that keeps the distance fixed), tangent to the disc of radius $R$ at $d$. Near the apex the cone is cut off by the disc of radius $R/\tau$ at $d/\tau$, because a small relative velocity reaches the person only after the horizon. If the two already overlap ($|d| \le R$), the robot is blocked unless $w$ points away from the person.

**The choice.** The tracker's command, a speed along a heading, is a velocity. If it lies in any cone, the lab samples 76 candidates. They are speeds of 1, 0.75, 0.5 and 0.25 times the command, at headings up to 90° either side in 10° steps, plus a slow straight reverse. The lab keeps the candidates outside every cone and takes the one with the smallest $|u - u_{cmd}|^2 + 0.03\,|\Delta\theta| + 0.02\,|\Delta\theta - \Delta\theta_{last}|$. The last term stops it from switching back and forth between two equally good detours. If no candidate is free, the robot stops. The chosen speed replaces the commanded one. The heading change becomes a turn rate, spread over half a second and added to the tracker's own. On the car it becomes a steering increment. The drawing on the map scales velocities by $\tau$. The apex sits where the robot would be after $\tau$ if it moved with the person, and the disc sits at the person's predicted position.

**What it assumes.** The method assumes that every person keeps their velocity for $\tau$, that the robot is the only one avoiding, and that nothing else is in the way. Each assumption shows up in the measurements below. Scripted people who walk straight at the robot along a corridor cause contacts that no velocity can avoid. People who react make the method look better than it is, because they do part of the avoiding. Reciprocal velocity obstacles split the avoidance between the two parties and model this properly. A detour chosen without the map can lead into a shelf. DWA (the dynamic-window tracker) avoids that by scoring the costmap and the people together, and ORCA (optimal reciprocal collision avoidance) by adding the walls as constraints.

**Measured** on L5 at seed 7, pure pursuit, lidar tracking unless stated, contacts counted up to Mission complete (a scripted person walking into the parked robot afterwards is left out):

| People | Response | Contacts | Closest | Notes |
| --- | --- | --- | --- | --- |
| scripted | ignore | 3 | – | 83 m, five goals in 106 s |
| scripted | reactive stop | 3 | – | |
| scripted | speed planning (ST) | 1 | – | four yields |
| scripted | velocity obstacles, τ 3 s | 2 | – | 145 interventions, 31 stops |
| scripted | velocity obstacles, τ 2 s | 1 | – | 116 interventions, 17 stops |
| scripted, truth tracking | velocity obstacles, τ 2 / 3 / 5 s | 1 / 2 / 2 | – | the same as with lidar tracking: every person contacted had been in view for four seconds or more |
| reacting | ignore | 2 | −0.18 m | |
| reacting | reactive stop | 0 | 0.06 m | |
| reacting | speed planning (ST) | 0 | 0.18 m | three agent-blocking replans |
| reacting | velocity obstacles, τ 3 s | 0 | 0.30 m | two stops |
| reacting | velocity obstacles, τ 2 s | 0 | 0.32 m | two collisions with shelves |
| reacting | the same with the lidar safety stop | 0 | 0.33 m | no collision, three of five goals given up as stuck |

[try: Velocity obstacles, 3 s horizon | {"sim":true,"level":4,"set":{"spd":"vo"},"tab":"ctl","layers":{"vo":true,"agents":true}}] [try: People who react | {"sim":true,"level":4,"set":{"spd":"vo","people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}]

## 10. An end-to-end policy

**The setup.** Behaviour cloning fits a function from what the expert sees to what it does. The lab's expert is its own classical stack (A*, the speed planner, pure pursuit). What it sees is the policy's input, $x \in \mathbb{R}^{139}$. The input holds the 120 lidar ranges and the nearest range in each of 12 sectors of 30°, because a flat network reads an obstacle more easily from those than from 120 raw beams. It also holds the goal in the robot frame as $(g_x/10, g_y/10, |g|/10, \cos\beta, \sin\beta)$, and the odometry's $v/1.5$ and $\omega/2$. What the expert does is the output $y \in \mathbb{R}^{16}$, the A* route ahead resampled to eight points 0.4 m apart in the robot frame, in units of 4 m. The first policy was a network $f: 139 \to 256 \to 256 \to 16$ with ReLU activations and 105 744 parameters. It was fitted by least squares with Adam for a hundred epochs. In the page, `policyPlan` turned $4 f(x)$ into world points every half second and handed the path to the tracker. On the way it moved any point inside an inflated obstacle to the nearest free cell. The policy's error is about 20 cm, and the expert keeps a clearance of 40 cm.

**Compounding error.** With $T$ steps and a per-step error $\epsilon$ on the expert's states, the imitator's cost grows like $T^2\epsilon$ rather than $T\epsilon$ (Ross & Bagnell 2010). Each mistake takes the robot to a state the expert never showed, where the next mistake is larger. The lab has three remedies for this. *Noise injection* (DART) lets the expert drive with its executed commands perturbed by $\sigma_\omega = 0.4$ rad/s and by 10 % on speed. The labels stay the expert's route from wherever the robot is, so the data covers a tube around the demonstrations. *DAgger* (Ross, Gordon and Bagnell 2011) lets the trained policy drive while the expert labels the states it reaches. The policy is then retrained on all the data. The *classical subgoal* points the policy at a point 3 m along the A* route instead of at the goal, which removes the long-range part of the problem.

**Several candidates.** Least squares fits the conditional mean, $f(x) = \mathbb{E}[y \mid x]$. From nearly the same scan, the demonstrations sometimes went left of a shelf end and sometimes right of it. The mean of those two routes goes through the shelf end. At the first contact on L2 (seed 7, 4.3 s), four of the eight raw waypoints lay inside the shelf. The fix is the one used for the people predictor (chapter 3 §10). The network outputs $K = 4$ candidate paths $\mu_k$, each with a score $s_k$, so it becomes $f: 139 \to 256 \to 256 \to 4 + 4 \cdot 16$ with 119 108 parameters. It is fitted as a mixture of Gaussians with a fixed $\sigma$, by its likelihood,

$$L = -\log \sum_{k=1}^{K} \pi_k \exp\Bigl(-\frac{|y - \mu_k|^2}{2\sigma^2}\Bigr), \qquad \pi = \operatorname{softmax}(s), \quad \sigma = 0.05\ (0.2\ \text{m}).$$

The gradient pulls each candidate towards the routes it explains best, $\partial L / \partial \mu_k = \gamma_k (\mu_k - y) / \sigma^2$. Here $\gamma_k$ is the responsibility, the probability that the label came from that candidate. It pulls each score towards how often its candidate explains the label, $\partial L / \partial s_k = \pi_k - \gamma_k$. At this small $\sigma$ the fit is nearly winner-takes-all, so the two sides of a shelf end become two candidates instead of one average. In the page the candidates are tried in the order of $\pi_k$. A candidate drives if its waypoints and the segments between them stay 10 cm clear of the lethal band (`segClear` at `POLICY_CLEAR`). The band's edge itself is touching distance, since an obstacle's cells are marked by their centres. Often two candidates both clear, one on each side of a shelf end. Their scores can swap between two refreshes half a second apart, and the tracker then reverses into the shelf. So the pick is held. Of the clear candidates, the lab takes the one nearest the path being driven, unless the best-scoring clear one is more than twice as likely. Without that hold, the four candidates on top of the safety layer below had 11 collisions on L2 over seeds 1 to 5, where the candidates alone or the safety layer alone had 3 or 4.

**The safety layer.** When no candidate clears, the best-scoring one goes through the classical shield. A waypoint less than 10 cm outside the lethal band is moved to the nearest cell with that much clearance. A segment that comes too close is replaced by a short A* detour, or the path is cut there. Sometimes what is left is too short to drive, with the robot pinned and the policy still pushing into the shelf. The robot then follows 1.5 m of the A* route instead. The Plan tab counts each of these events: candidates other than the best taken, waypoints moved, segments rerouted, paths cut, and fallbacks to A*. With $K = 3$ the closed loop was less steady across training seeds. On L2 with the subgoal, those models reached 11 to 20 goals of 20 over seeds 1 to 5, against 20 of 20 for every $K = 4$ model. $K = 2$ helped least.

**Measured** at seed 7, goals reached of the level's own, and collisions with shelves and walls, against A* on the same run:

| Stage | L1 open floor | L2 aisles | L4 building | L5 busy floor (unseen) |
| --- | --- | --- | --- | --- |
| driven trajectories as labels, clean demonstrations | 2 of 4 | 1 of 4, 1 collision | 0 of 4, 1 | 4 of 5, 3 |
| + noise injection, expert-route labels | 4 of 4 | 1 of 4, 3 | 0 of 4, 4 | 4 of 5, 1 |
| + sector features, two DAgger rounds, points moved out of obstacles | 4 of 4 | 0 of 4, 3 | 1 of 4, 1 | 4 of 5, 2 |
| the same, pointed at a classical subgoal | 4 of 4 | 1 of 4, 2 | 0 of 4, 4 | – |
| + segments checked with a 10 cm margin, A* when pinned (one path) | 4 of 4 | 3 of 4, 1 | 1 of 4, 0 | 5 of 5, 0 |
| the same, pointed at a classical subgoal | 4 of 4 | 4 of 4, 0 | 4 of 4, 0 | – |
| + four candidate paths (mixture loss), the best clear one, held | 4 of 4 | 3 of 4, 2 | 1 of 4, 1 | 5 of 5, 0 |
| the same, pointed at a classical subgoal | 4 of 4 | 4 of 4, 0 | 4 of 4, 0 | – |
| A* | 4 of 4 | 4 of 4 | 4 of 4 | 5 of 5 |

Seed 7 hardly tells the last stages apart, but seeds 1 to 5 do. This table gives the goals and collisions summed over them.

| | L2 aisles | L2, subgoal | L4 building | L4, subgoal | L5 busy floor |
| --- | --- | --- | --- | --- | --- |
| one path, points moved out of obstacles | 6, 9 | 5, 10 | 2, 9 | 0, 16 | 16, 11 |
| one path, the segment check and A* when pinned | 16, 4 | 20, 0 | 5, 9 | 20, 3 | 19, 3 |
| four candidates, best clear one, no segment check | 18, 3 | 20, 0 | 5, 8 | 20, 2 | 23, 5 |
| four candidates, held, with the segment check | 16, 5 | 20, 0 | 5, 4 | 20, 0 | 21, 1 |

Either fix alone gives most of the gain, and the two overlap. Both act at the shelf end where the single path cut the corner. The candidates offer the other side of it, and the segment check detours around it. Together they have the fewest collisions on the building and the busy floor. On the aisles they have one collision more than the segment check alone. On L5 the misses and most collisions are on seed 1, where the particle filter loses the robot. The clearance check on the candidates does not explain their gain by itself. The single-path model run through the same check (as one candidate) reaches 7 of 20 on L2, and 5 of 20 with the subgoal. The shipped model is the best of three training seeds. The other two reach 15 and 18 of 20 on L2 without the segment check.

Open-loop means the policy's output is compared with the expert's labels on a recorded run, without the policy driving. On the held-out expert run, the policy trained on expert data alone is 9 cm off at the first waypoint and 66 cm off at the eighth. After the DAgger data is added, it is 22 cm and 1.68 m off on a held-out DAgger run. The error is larger because the held-out moments are now judged by a policy that also had to fit the harder states. On that run the four-candidate policy's best-scoring candidate is 26 cm and 1.64 m off, which is no better. The best of its four candidates is 7 cm and 51 cm off. Only the closed loop, with the policy driving, shows whether it works. With one path the policy did well on the open floor, and mostly well on a floor of the same kind that it had never seen. On the aisles it collided at the first shelf corner, every time. There the averaged path pins the robot, and no demonstration showed how to back out. The subgoal hardly helped (one goal instead of none), because the failure was local. With the segment check, the candidates, or both, the robot mostly gets through the aisles, and with the subgoal it completes both the aisles and the building. The remedies fix different failures. The check and the candidates fix the averaged corner. The subgoal fixes the goal behind a wall, which would otherwise point a reactive policy at the wall. Pointed at the goal itself, the policy still fails in the building, because no candidate knows which door leads there. The failure left in the aisles is a robot that ends up inside the inflation band with every candidate pointing into the shelf. A policy without memory then keeps proposing the same thing.

**What it would take.** A better policy would need more data near corners and doors, a convolutional encoder over the beams instead of a flat layer, and a recurrent memory or the map as an input. It would also need a recovery behaviour it learns itself instead of borrowing A*'s, and reinforcement learning on top of the imitation. These are all standard techniques, and each takes real work. Compare the learned detector in §9 of chapter 3. It had a local, well-posed target, was trained in an afternoon, and beat the rule where the rule had no map. The learned planner has a global target, and least squares averages it. It did not work until its output could hold more than one answer and a classical check picked among them. It was the modular stack around the policy that kept the robot out of the shelves.

[try: The open floor, where it works | {"sim":true,"level":0,"set":{"plan":"policy"},"tab":"plan"}] [try: The warehouse aisles | {"sim":true,"level":1,"set":{"plan":"policy"},"tab":"plan"}] [try: A classical subgoal | {"sim":true,"level":1,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}] [try: The building with a subgoal | {"sim":true,"level":3,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}]

## 11. What to carry into the next chapters

Every planner here produces a path, and the tracker has to follow it. Chapter 5 is about the trackers. The first link between the two chapters is the margin Hybrid A* leaves on the steering lock. A path planned at the vehicle's limit cannot be tracked, because the tracker needs steering in reserve to correct errors. The second link is time. The space-time plan and the speed planner both rely on the predictions of chapter 3. The delay margin of chapter 6 is a related idea one layer down. It measures how much delay a loop can take before it fails.
