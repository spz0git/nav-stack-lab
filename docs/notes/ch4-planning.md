id: ch4
num: 4
sys: plan
summary: The derivations behind the Planning lessons: the costmap as a graph, A* optimality and the weighted-A* bound, RRT* and why its radius shrinks, Reeds–Shepp paths and Hybrid A* for a car, the mission state machine and goal ordering, and space-time A* against predicted people.

# Planning: search, sampling, cars and time

A planner turns the costmap of chapter 3 into a route. This chapter derives the four planners in the lab and the layer that decides when to run them, in the order of the Planning lessons: A* and its heuristic (lesson 1), RRT* (lesson 2), Hybrid A* for the car (lesson 3), the mission state machine (lesson 4) and space-time A* (lesson 5). The blue numbers follow your settings: the heuristic weight is ε = {{live:eps}}, RRT* gets {{live:rrtIt}} samples, the car planner uses {{live:planPct}} % of the steering lock (turning radius {{live:Rplan}} m against {{live:Rmin}} m at full lock), and the prediction horizon is {{live:agT}} s.

## 1. The costmap as a graph

Every grid planner here searches the same graph. The nodes are the 38 400 cells of the 0.1 m grid, minus the lethal ones. Each cell connects to its eight neighbours, with one rule: a diagonal move is allowed only if both cells it cuts between are free, so a path cannot slip between two obstacles that touch at a corner. The cost of a move is its length times the inflation surcharge of the cell it enters:

$$
c(u \to v) = \ell_{uv}\,\big(1 + 3\,\text{penalty}(v)\big), \qquad \ell_{uv} \in \{0.1,\ 0.1\sqrt2\}\ \text{m}
$$

Two things follow. The planner minimizes cost, not distance, so the "optimal" route can be a few centimetres longer than the shortest one when the shortest one hugs a shelf: in lesson 1 the ε = 1 path on the second leg is 13.0 m and the ε = 3 path 12.5 m, and the first is still the cheaper. And the graph is static between costmap rebuilds, so a plan is valid for 0.5 s at most on a map being built, which is what the mission layer of §5 is for.

## 2. A*: best-first search with a promise

**The algorithm.** Keep a priority queue of cells ordered by $f = g + h$, where $g$ is the cost of the best path found so far from the start and $h$ is a heuristic estimate of the cost from the cell to the goal. Pop the smallest $f$, expand its neighbours, update any whose $g$ improved, repeat until the goal is popped. The path is read back through the parent pointers.

**Why the first path it finds is optimal.** Call $h$ admissible if it never overestimates the true cost to go, $h(n) \le h^*(n)$. Suppose A* pops the goal with cost $g(\text{goal}) = f(\text{goal})$ while a cheaper path of cost $C^* < f(\text{goal})$ exists. Some cell $n$ on that cheaper path is in the queue with its optimal $g(n)$ (the first such cell along the path, since its predecessor was expanded with the right cost). Then $f(n) = g(n) + h(n) \le g(n) + h^*(n) = C^* < f(\text{goal})$, so $n$ would have been popped before the goal. Contradiction. With a consistent heuristic, $h(u) \le c(u \to v) + h(v)$, the argument strengthens: every cell is expanded at most once, with its optimal $g$ already final, which is why the lab can close a cell permanently.

**The octile heuristic.** On an 8-connected grid with no obstacles, the cheapest path from $(dx, dy)$ to the goal takes $\min(dx, dy)$ diagonal steps and $|dx - dy|$ straight ones:

$$
h = \big(\max(dx, dy) + (\sqrt2 - 1)\min(dx, dy)\big) \times 0.1\ \text{m}
$$

That is exact in free space, so it is admissible and consistent, and it ignores the inflation surcharge, which only makes true costs larger. It is as tight as a free-space heuristic can be, and it is why A* on the warehouse expands 1 000 to 9 000 cells per leg rather than all 38 400.

**Weighted A*.** Multiply the heuristic by ε > 1 and the search becomes greedier: cells that look close to the goal are expanded first, cells in the wrong direction are starved. The path is no longer optimal, but it is bounded. Repeat the argument above with $f = g + \varepsilon h$: when the goal is popped, every cell $n$ on the optimal path still in the queue satisfies $f(n) = g(n) + \varepsilon h(n) \le g(n) + \varepsilon h^*(n) \le \varepsilon C^*$, and the goal was popped with $f(\text{goal}) = g(\text{goal}) \le f(n)$, so

$$
\text{cost of the path found} \le \varepsilon\, C^*
$$

The bound is loose in practice: in lesson 1 ε = 3 returns paths within a few percent of optimal while expanding up to 14 times fewer cells on the longer legs, because on a floor with aisles the greedy direction is usually the right one. The bound bites in mazes, where the greedy direction is a dead end.

**From cells to a path.** The cell sequence is reduced to its turning points, then shortcut: from each point, the farthest later point reachable by a straight segment that stays 0.5 m from obstacles (lethal plus 0.1 m) becomes the next waypoint. The result is a polyline the tracker can follow, which is what the Try buttons draw.

[try: A*, ε = 1 | {"sim":true,"level":1,"set":{"eps":1},"tab":"plan","layers":{"search":true},"searchStep":true}] [try: A*, ε = 3 | {"sim":true,"level":1,"set":{"eps":3},"tab":"plan","layers":{"search":true},"searchStep":true}]

## 3. RRT*: planning by sampling

**The algorithm.** Grow a tree from the start. Each iteration: draw a random point (the goal itself with probability 0.1); find the nearest tree node; step 0.6 m from it toward the sample; if that point is free, consider every node within a radius $r_n$ as its parent and choose the one giving the lowest cost-to-come along a collision-free segment; add the node; then rewire: for each neighbour, if going through the new node is cheaper and collision-free, make the new node its parent. After $N$ iterations, connect the best node within 1 m of the goal and read the path back.

**Why the radius shrinks.** The lab uses

$$
r_n = \min\!\left(8\sqrt{\frac{\ln n}{n}},\ 1.5\right)
$$

with $n$ the current number of nodes. The form comes from the proof of asymptotic optimality (Karaman and Frazzoli, 2011): if the radius shrinks no faster than $\gamma\sqrt{\ln n / n}$ with $\gamma$ above a constant set by the free area, in two dimensions

$$
\gamma > 2\sqrt{\tfrac{3}{2}\,\frac{\mu(X_{\text{free}})}{\pi}}
$$

then the expected number of nodes inside the radius grows like $\ln n$, enough that the rewiring keeps finding improvements, while the cost per iteration stays $O(\ln n)$, and the path cost converges to the optimum with probability one as $n \to \infty$. A fixed radius would also converge but cost $O(n)$ per iteration; a radius shrinking faster would stop converging. For the warehouse's 260 m² of free floor the constant works out to about 22, and the lab's γ = 8 with a 1.5 m cap is well below it. That is common practice: the condition is sufficient, not necessary, and a theoretical γ would make every iteration examine most of the tree on a floor this small.

**What a finite budget buys.** Convergence is a statement about $n \to \infty$. At $n$ = 1500 on the warehouse, the first leg of lesson 2 comes out between 8.3 and 15.3 m depending on the seed, against 8.6 m for A*: half the seeds find the short way through the near aisle and half commit early to the long way round and never rewire out of it, because rewiring only improves connections inside $r_n$ and cannot move a subtree to a different aisle. With 4000 samples eight seeds in ten find the short route; with 300, four in ten find no connection to the goal at all. That is the trade: sampling needs no grid and scales to high-dimensional spaces where grids are hopeless, and it pays with variance that a grid search does not have.

[try: RRT* | {"sim":true,"level":1,"set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}] [try: Next seed | {"sim":true,"level":1,"seed":"next","set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}]

## 4. Planning for a car

**Why a grid path fails.** A car cannot move sideways and cannot turn in place: its heading is a state, and from a heading θ only poses along arcs of radius at least $R_{\min}$ are reachable. With wheelbase $L$ and maximum steering angle $\delta_{\max}$,

$$
\dot\theta = \frac{v \tan\delta}{L}, \qquad R_{\min} = \frac{L}{\tan \delta_{\max}} = \text{{{live:Rmin}} m}
$$

A grid path has corners of zero radius and no heading, so a car following it swings wide at every corner and cannot park at all: in lesson 3's last experiment plain A* on the car reaches none of the four bays. The planners that work keep a margin on the lock: they plan with {{live:planPct}} % of δ<sub>max</sub>, a turning radius of {{live:Rplan}} m, so that the tracker has steering authority left to correct with. At 100 % every planned turn is at full lock and the tracker has nothing in reserve, which is why that experiment gets stuck twice.

**Reeds–Shepp paths.** Between two poses with no obstacles, the shortest path for a car that can reverse is made of at most five pieces, each an arc at minimum radius (L or R) or a straight (S), with reversals allowed. Reeds and Shepp (1990) showed that 48 such words suffice; by symmetry (reflect, reverse time, swap L and R) they reduce to 12 families, and the lab evaluates all 12 with their four symmetry images for each query, checks each candidate by integrating it to the end pose, and keeps the shortest that lands. Normalizing the problem to $R = 1$ makes the formulas for each family a few lines of trigonometry. Two uses: as a planner on its own (the Reeds–Shepp option, which ignores obstacles) and inside Hybrid A*, twice.

**Hybrid A*.** Keep A*'s discrete search but let every node carry a continuous pose $(x, y, \theta)$ and let every edge be a motion the car can actually make. The lab's version (after Dolgov et al., 2008):

- The grid is 0.2 m × 0.2 m × 5° (72 headings), used only to decide which poses are "the same" for closing; the pose stored in a cell is the exact one that reached it first.
- From each node, ten primitives: forward or reverse, at five steering angles $\{-\delta, -\delta/2, 0, \delta/2, \delta\}$, each a 0.4 m arc integrated in 0.1 m steps with the footprint checked at every step. The footprint is three circles along the body, which over-approximates the rectangle by about 0.14 m at the corners.
- The cost of a primitive is its length, times 2 in reverse, plus small terms for steering, for changing the steering, and a penalty of 2 for changing gear, plus a quadratic proximity term that keeps the car from scraping. These are preferences; they make the search prefer forward, smooth, reversal-free paths without forbidding the others.
- Two heuristics, and the search uses the larger: an 8-connected Dijkstra from the goal on the 0.1 m grid, which knows about obstacles but not about turning, and the Reeds–Shepp length to the goal pose, which knows about turning but not about obstacles. Each underestimates the true cost, so each is admissible, and the maximum of two admissible heuristics is admissible and tighter than either. With only the 2D heuristic the search has no idea which heading to arrive with and settles it in the last metre, which is the heading error you see in lesson 3's second experiment.
- Analytic expansion: near the goal (within 2.5 m, and every tenth expansion elsewhere), try the Reeds–Shepp shots from the current node to the goal pose and accept the first one that is collision-free. This is what finishes most plans: the search gets the car into the right room, the shot parks it. In the lesson's first run three of the four plans end in a shot; the third lands one after only 30 expansions, against 7 000 to 10 000 for the first two, which had to search most of the way before a shot was collision-free.
- A budget of 60 000 expansions, after which the planner reports failure rather than hanging the loop.

[try: Hybrid A*, L6 | {"sim":true,"level":5,"tab":"plan","layers":{"search":true},"searchStep":true}] [try: Plain A* on the car | {"sim":true,"level":5,"set":{"plan":"astar"},"tab":"plan"}]

## 5. The mission layer

**Ordering the goals.** With several goals open, the mission can visit them in the given order, greedily (always the nearest next, by costmap distance), or optimally. The distances come from one Dijkstra per goal on the costmap (A* with $h$ = 0 and no target), so they respect walls. The optimal order is a travelling-salesman problem; with at most eight goals the lab solves it exactly by depth-first enumeration with branch-and-bound, pruning any partial order whose cost already exceeds the best complete one. Eight goals is 40 320 orders at worst, trivial; eighty would not be, which is why real missions use heuristics here.

**The state machine.** Plans are cheap (milliseconds), so the policy is to replan whenever an assumption behind the current plan breaks, and the Mission tab draws the result live:

| From | Trigger | To |
| --- | --- | --- |
| PLAN | planner returned a path | DRIVE |
| PLAN | planner failed | NO_PATH (retry after 2 s; skip the goal after 3 failures) |
| DRIVE | a lethal cell on the path within 6 m, checked every 0.5 s | PLAN ("path blocked") |
| DRIVE | the estimate more than 1 m from the path | PLAN ("off path") |
| DRIVE | less than 0.15 m of progress in 5 s | PLAN ("stuck"; the goal is skipped after 3) |
| DRIVE | the periodic timer, if set | PLAN ("periodic", not logged) |
| DRIVE | the speed planner cannot resolve a person by slowing | PLAN ("agent blocking") |
| DRIVE | position σ above 1 m, with the lost guard on | LOST (hold and turn until σ < 0.4 m) |
| DRIVE | within 0.25 m of the goal (0.2 m and 0.2 rad for a posed car goal) | next goal, or DONE |

Two of the triggers deserve a note. The "off path" rule is what makes a kidnapping (chapter 2 §6) recoverable at the mission level: the moment the estimate jumps, the plan is rebuilt from where the robot now believes it is, which is right if the estimator is and useless if it is not. The "agent blocking" rule is the escalation from the trajectory layer: for that one plan the predicted positions of the people over the next 2 s are stamped into the costmap as obstacles, so the new route goes around where they will be, and the costmap is rebuilt clean afterwards.

[try: Discover the building | {"sim":true,"level":3,"tab":"mis"}] [try: Agent-blocking replans | {"sim":true,"level":4,"tab":"mis"}]

## 6. Space-time A*: time as a coordinate

A* on a map answers "which way"; it cannot answer "when". Adding time to the state makes waiting a move and lets a plan pause in a doorway while someone passes.

**The state and the moves.** The state is $(i, j, k)$: a cell on a coarser 0.2 m grid and a time index. Time is quantized by the time to cross one cell at the reference speed, $\Delta t = 0.2\,\text{m} / v_0$ = {{live:dtc}} s, so a straight move takes one step, a diagonal move two, and waiting in place one (at 1.2 times the cost, so the planner waits only when it must). The horizon is {{live:agT}} s, {{live:nt}} steps; beyond it all times share one state, which turns the search back into plain A* on the static map, since there are no predictions to respect.

**What is blocked.** Cell $(i, j)$ is blocked at step $k$ if its centre lies inside any person's predicted disc at that time, the disc of chapter 3 §6 grown by the robot's radius and a clearance margin of {{live:stMarg}} m:

$$
\text{blocked}(i, j, k) \iff \exists a:\ \|c_{ij} - p_a(k\Delta t)\| < r_a(k\Delta t) + r_{\text{robot}} + \text{margin}
$$

A diagonal move is also checked at the intermediate step, so the robot cannot cut through a person in the middle of a two-step move. Static lethal cells block at every time.

**Heuristic and budget.** The heuristic is the octile distance to the goal in time units, which is admissible because it assumes free space and no waiting. The search is capped at 60 000 expansions; if the horizon is too crowded to cross it reports "no space-time route within the horizon" and the mission retries 2 s later, which happened once in lesson 5's first run. The output is a path with waits folded in; the speed planner of the Control tab still enforces the timing and reacts to prediction error, so the two layers share the work: the planner picks the route in space-time, the speed planner keeps the schedule.

**What it costs and buys.** The coarser grid means fewer expansions than plain A* on the same legs (200 to 3 500 against 1 400 to 5 900 in lesson 5), so the time dimension is paid for by the cell size. What it buys depends on the people: against scripted people on the busy floor it makes the same two contacts as A* with the agent layer, because the contacts come from people stepping out from behind shelves inside the planner's reaction time; against reactive people it makes none. The honest reading is that the trajectory layer, the speed planner, is doing most of the work on this floor, and space-time planning matters where the route itself must change, in doorways and narrow aisles.

[try: Space-time A* | {"sim":true,"level":4,"set":{"plan":"stastar"},"tab":"plan","layers":{"search":true},"searchStep":true}] [try: A* with the agent layer | {"sim":true,"level":4,"set":{"plan":"astar"},"tab":"plan","layers":{"search":true},"searchStep":true}]

## 7. Frontier exploration: the robot picks its own goals

**The frontier.** With lidar mapping the grid holds three kinds of cell: known free ($l < -0.05$), known occupied ($l > 0.5$) and unknown ($|l| < 0.05$, nothing has been seen there). A *frontier cell* is a known-free cell with an unknown 4-neighbour: from there the lidar would see into the unknown. The lab also drops frontier cells within the lethal radius of a seen wall, so a cell the robot could not stand on is not a candidate (the test is against seen walls only, not against the unknown, or the cautious policy below would rule out every frontier). The frontier cells form 8-connected clusters, the *frontiers*; clusters below $N_{\min}$ cells (the Mission tab's "smallest frontier worth a visit", 6 by default) are ignored, since a sliver seen through a doorway is almost always seen on the way to something else.

**The goal cell.** A frontier is summarized by its member cell nearest its centroid. The goal handed to the planner is the nearest known-free cell to that one with a margin of 0.2 m beyond the inflated obstacles; in a corridor too narrow for the margin, the nearest known-free cell that is merely not lethal; and for a sliver where every known cell is lethal, the nearest cell that is not lethal at all, which under the optimistic policy is unknown space just past the door, exactly where the robot should head. A frontier with no such cell within 2 m is unreachable and left out.

**The choice.** Each frontier is scored by its size over its distance from the estimate,
$$
u_i = \frac{|F_i|}{1 + d_i},
$$
and the highest score is the next goal. Size per metre is the crudest estimate of what exploration wants, new floor per metre driven; the research versions (expected information gain against path cost) estimate the same ratio properly. A goal is dropped the moment none of its cluster's cells borders unknown space any more, checked once a second while driving: the way there usually reveals what was behind it, and 13 of the 15 goals of the run below end this way. A goal the planner cannot reach three times, or the robot is stuck on three times, is put on a failed list and skipped; when nothing but failed frontiers is left, each is tried once more from wherever the robot now stands, and the exploration ends when no frontier is left, or none that has not failed twice.

**The floor seen.** The lab reports the share of the true free floor (the level's map, which the robot does not have) whose cells are known, as a signal and in the status strip. It is the quantity exploration maximizes and the one a real robot cannot compute, having no true map.

**Measured** on L4 at seed 7, with the default planner and tracker unless stated:

| Run | Floor seen | Time | Distance | Frontier goals | Dropped on the way |
| --- | --- | --- | --- | --- | --- |
| Explore | 100 % | 123 s | 94 m | 15 | 13 |
| The level's four goals | 96 % | 67 s | 50 m | – | – |
| $N_{\min}$ = 20 | 99 % | 102 s | 78 m | 14 | 12 |
| $N_{\min}$ = 2 | 100 % | 141 s | 107 m | 16 | 14 |
| Unknown as lethal | 100 % | 158 s | 112 m | 17 | 14 |
| DWA tracker | 100 % | 188 s | 86 m | 19 | 11, four given up, one retried |

Over six seeds the default run takes 111 to 147 s and 80 to 108 m, always to 100 %, with at most one brush against a shelf. The cautious policy (§5 explains why a hand-placed goal in an unseen room stalls under it) does not block exploration, because a frontier goal is on seen floor by construction; it only forbids the plans to cut through rooms not yet looked into, which costs about a third more time.

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
compared lexicographically; $h$ is the octile heuristic to the robot's cell $s$, the search running from the goal toward the robot, and $k_m$ an offset explained below. The lab packs the two components into one number, $k_1 + 10^{-6}k_2$, for its binary heap.

**The repair loop.** `computeShortestPath` pops the smallest key while it is below $k(s)$ or $s$ is inconsistent. An overconsistent cell is settled, $g \leftarrow rhs$, and its predecessors' $rhs$ recomputed; an underconsistent one is reset, $g \leftarrow \infty$, and recomputed with its predecessors. Each recomputation looks at all eight neighbours, so one vertex update costs about eight A* relaxations, which is the price of the bookkeeping. On a fresh search this is A* in reverse at roughly twice the expansions and seven times the milliseconds; the gain comes afterwards.

**Changes.** When an edge cost changes, the cells whose $rhs$ used it are recomputed and queued if inconsistent: a cell's own $rhs$ and those of its eight neighbours cover every edge touching it. When the robot moves from $s_{old}$ to $s_{new}$, every key's heuristic term is stale by at most $h(s_{old}, s_{new})$; adding that to $k_m$ once keeps old keys comparable to new ones without touching the queue. The lab compares the costmap with the one of the previous plan, counts a cell as changed when its lethal flag flips or its penalty moves by more than 0.1 (the inflation band breathes with every scan), and drops the search when the goal, the planner or ε changes. The path is read from the robot's cell by always stepping to the successor with the smallest $c + g$; the cost model, the corner-cutting rule and the heuristic are those of §2, so A* and D* Lite return the same paths.

**Measured** at seed 7, the whole run, plans counted with their expansions (A*) or vertex updates (D* Lite) and the planner's milliseconds:

| Level and trigger | A* | D* Lite | Paths |
| --- | --- | --- | --- |
| L2, prior map, replan every 1 s (76–78 plans) | 152 500 expansions, 72 ms | 24 100 updates, 59 ms | identical |
| L4, lidar mapping, 3 "path blocked" replans (7–8 plans) | 13 900, 9 ms | 49 700, 85 ms (3 600–4 600 cells changed per replan) | identical |
| L5, people, 2 "agent blocking" replans (61–63 plans) | 77 700, 42 ms | 29 100, 78 ms (1 250–1 700 cells stamped) | identical |

The reading: D* Lite earns its keep where the map is static and only the robot moves, by a factor six in expansions here, and loses where the costmap changes broadly between plans, which a cost field inflated from a growing lidar map does with every scan. Fewer expansions and more milliseconds can go together, because an update costs eight relaxations; the break-even is an eight-fold saving in expansions. Real deployments feed D* Lite binary occupancy with sparse updates and large grids.

[try: D* Lite with a periodic replan | {"sim":true,"level":1,"set":{"replan":1,"plan":"dstar"},"tab":"plan"}] [try: Lidar mapping, D* Lite | {"sim":true,"level":3,"set":{"plan":"dstar"},"tab":"plan"}]

## 9. What to carry into the next chapters

Every planner here produces a path, and every path is a promise the tracker has to keep. Chapter 5 is about the trackers, and the margin Hybrid A* leaves on the steering lock is the first place the two chapters meet: a path planned at the vehicle's limit cannot be tracked, because tracking needs authority in reserve. The second meeting point is time: the space-time plan and the speed planner both assume the predictions of chapter 3, and the delay margin of chapter 6 is the same idea one layer down, how much lateness a loop can absorb before it fails.
