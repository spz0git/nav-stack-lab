group: plan
title: Hybrid A*: planning for a car

<p><b>Why this matters.</b> A car cannot move sideways or turn on the spot. Its heading is part of its state, and from any heading it can reach only poses along arcs of at least the minimum turning radius. A grid path has sharp corners and no heading, so a car cannot follow it. Parking means arriving at a given heading, and a grid path has no way to express that. Hybrid A* made automated parking and low-speed manoeuvring practical. Its search is discrete, as in A*, but every edge in it is a motion the car can drive.</p>
<p><b>The idea.</b> The search runs over cells as before, but each node carries an exact pose. Each edge is a short arc the car can drive, forward or in reverse, at one of five steering angles. Two poses count as the same node only if they are in the same cell and their headings also match to within 5°, so the search can hold several headings for one place. Two heuristics guide the search, and it uses whichever is larger. One is a grid distance from the goal, which knows about obstacles but not about turning. The other is the Reeds–Shepp length to the goal pose, which knows about turning but not about obstacles. A Reeds–Shepp curve is the shortest path between two poses for a car that can reverse, when nothing is in the way. Near the goal, the planner stops searching and tries a shot: a Reeds–Shepp curve straight to the goal pose. If the shot is free of collisions, the plan is done.</p>
<p>The cells are 0.2 m × 5°. Each node expands into 5 steering angles × {forward, reverse}, each an arc of 0.4 m. The heuristic is</p>
$$h = \varepsilon \cdot \max\bigl(\text{2D Dijkstra with obstacles},\ \text{Reeds–Shepp without obstacles}\bigr)$$
<p>and the analytic expansion tries a Reeds–Shepp shot to the goal and accepts it if it is collision-free.</p>
<p><b>Where it comes from.</b> Each heuristic underestimates the true cost, so each is admissible. The maximum of two admissible heuristics is also admissible, and it is at least as close to the true cost as either of them. Reeds and Shepp proved that the shortest obstacle-free path for a car that can reverse is one of 48 sequences ("words") of arcs and straight lines. By symmetry these reduce to 12 families, and the lab evaluates them in closed form for every query. The footprint used for collision checks is three circles. They over-approximate the car's rectangle by about 0.14 m at the corners, so the error is on the safe side. <a class="chref" href="#notes=ch4/4-planning-for-a-car">Derivation: chapter 4 §4</a></p>
<p><b>The primitives.</b> Each edge is a motion of the kinematic bicycle model, with the pose at the rear axle, L the wheelbase and $\dot\theta = v\tan\delta / L$. The model is driven for a signed distance $s = \pm 0.4$ m at a fixed steering angle, which gives an arc of curvature $\kappa = \tan\delta / L$. The arc is integrated in closed form, in four 0.1 m steps, and the footprint is checked after each step. The angle $\delta_p$ is the largest one the planner uses, 85 % of the lock. The edge cost puts numbers on the preferences described below.</p>
$$x' = x + \frac{\sin(\theta + \kappa s) - \sin\theta}{\kappa} \qquad y' = y - \frac{\cos(\theta + \kappa s) - \cos\theta}{\kappa} \qquad \theta' = \theta + \kappa s \qquad (\kappa = 0:\ \text{straight})$$
$$\kappa = \frac{\tan\delta}{L}, \qquad \delta \in \{-\delta_p,\ -\delta_p/2,\ 0,\ \delta_p/2,\ \delta_p\}, \qquad s = +0.4\ \text{m forward},\ -0.4\ \text{m reverse}$$
$$\begin{aligned} \text{edge cost} &= 0.4\,(\times 2 \text{ in reverse}) + 0.05\,\frac{|\delta|}{\delta_p} + 0.1\,\frac{|\delta - \delta_{\text{prev}}|}{\delta_p} + 2 \text{ per gear change} + 0.8\,\text{prox}^2 \\ \text{prox} &= \max\Bigl(0,\ \frac{0.4 - \text{clearance}}{0.4}\Bigr) \end{aligned}$$
<p><b>What the lab does.</b> L6 is the parking lot, with four goals. The first three are posed, which means each has a position and a heading. The last is a plain point. The car has a wheelbase of 0.6 m and a steering limit of 32°, so its true minimum radius is 0.96 m. The planner keeps 15 % in reserve and plans at 85 % of the lock (the largest steering angle), which gives a 1.17 m radius. The tracker then has steering left over to make corrections with. Reverse costs double, a gear change costs 2, and a proximity term keeps the car away from walls. The budget is 60 000 expansions. The event log reports the length, the expansions, the cusps (gear changes) and whether a Reeds–Shepp shot finished the plan. All numbers below are at seed 7, over one mission of two to three minutes.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses. The chip under the map then plays the search one expansion at a time: ◀ and ▶ step, ▷ plays, and the slider scrubs. The newest node is drawn in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: Hybrid A*
cfg: {"sim":true,"level":5,"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L6 with its defaults: Hybrid A* with both heuristics, 85 % of the lock and reverse allowed. The search layer is on.
See: The car reaches the four goals in 148 s with no collisions. It reaches each of the three posed bays within 0.1 m and 5°, and the last goal, which has no heading, within 0.2 m. The four plans take 6 950, 10 230, 30 and 162 expansions. Here the first two took about 60 to 70 ms each and the last two 10 ms each, but the times depend on the machine. Three of the plans end with a Reeds–Shepp shot. Watch the third plan: 30 expansions, then a shot that parks the car with two cusps. The search layer shows the expanded poses as scattered points. They fill the lot for the long plans and are hard to see for the short ones.
Shows: The analytic expansion makes the planner fast. The search only has to bring the car to a pose from which a shot is clear, and the closed-form curve does the parking. You cannot see the 85 % margin at work here, because nothing goes wrong; the third experiment removes it. The car may arrive up to 0.2 rad (11°) off the goal heading. These plans arrive within 5°, under half of that. The Reeds–Shepp shot is continuous, so it fixes the last few degrees that 5° heading cells cannot represent. The next experiment takes that help away.
Predict: Hybrid A* drives the car to the four goals. How will the expansion counts of the four plans compare?
- All similar, a few thousand each
- All near the 60 000 budget: heading cells make the search large
- Wildly different, from tens to ten thousand
Answer: 2

## Try: 2D heuristic only
cfg: {"sim":true,"level":5,"set":{"hybH":"2d"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The Reeds–Shepp term is removed from the heuristic, so the search is guided by grid distance alone.
See: The first plan is found faster (1 515 expansions, 17.1 m), but the car arrives 11° off the goal heading instead of 5°. The grid distance says nothing about heading, so the search deals with the heading only in the last metre and takes whatever it can get. From then on the run meets the lot's pedestrians at different times and places. There are four replans because a person blocks the path, and four contacts, one of them a person walking into the stopped car. The car finishes the four goals in 183 s.
Shows: A heuristic that ignores part of the state can be admissible and still mislead the search. This one steers the search to the right place at the wrong heading, and a car cannot fix its heading on the spot. The contacts in this run come from the lot's people crossing a different route, so the heuristic causes them only indirectly. When you compare two single runs, you compare everything that changed between them, including what you did not mean to change.
Predict: Remove the Reeds–Shepp term and guide the search by grid distance alone. What changes in the first plan?
- It fails: without a heading heuristic no shot ever lands
- It is found faster but arrives farther off the goal heading
- It is slower and more accurate: the grid distance is tighter
Answer: 1

## Try: Planner at 100 % steering
cfg: {"sim":true,"level":5,"set":{"planPct":100},"tab":"plan"}
Setup: The planner is allowed the full 32° lock, a turning radius of 0.96 m instead of 1.17 m.
See: The plans are tighter and slightly shorter (17.0 m against 18.0 m for the first). The car scrapes an obstacle twice, at 33 s and 121 s, both times after two seconds at full lock. Each time it stops making progress, and the stuck trigger replans from a standstill, at 40 s and 126 s. The four goals are still reached, in 165 s against 148 s with the reserve. The car arrives in the three bays 9°, 7° and 5° off the goal heading, instead of 5°, 4° and 3°.
Shows: A path planned at the limit of the steering cannot be tracked. On a full-lock arc, the tracker would correct by steering harder, and the wheels are already at the stop. Any error, from a 5° heading cell or a slipping wheel, stays uncorrected until the arc ends. The 15 % reserve leaves the tracker room to correct. This is the first place in the stack where the planner has to allow for the controller.
Predict: Let the planner use the full 32° lock instead of 85 % of it. What happens when the car drives the plan?
- Shorter plans, driven cleanly: the car can steer that far
- The planner fails: tighter arcs do not fit the heading cells
- It gets stuck on full-lock arcs and scrapes obstacles
Answer: 2

## Try: Plain A* on the car
cfg: {"sim":true,"level":5,"set":{"plan":"astar"},"tab":"plan"}
Setup: The grid planner plans for the car. Its path is straight segments and sharp corners, with no heading at the goal.
See: The car follows the first segment, swings wide at the first corner, and is stuck within 35 s. Each goal is skipped after three replans for being stuck. By 91 s all four have been skipped, with 15 m driven and one collision. The car parks in none of the bays.
Shows: The grid path is free of collisions, but the car cannot drive it. No sequence of arcs of radius 1.17 m follows a 90° corner of radius zero, and the bays need a heading that the path does not carry. Hybrid A* adds the heading to the state, arcs as the edges and the Reeds–Shepp shot. Each of these is there so that the planner returns a path this car can drive.
Predict: Give the car the grid planner's path of sharp corners. What happens?
- It is stuck at the first corner and every bay is skipped
- It drives the corners wide but reaches every bay
- It parks, but ignores the goal headings
Answer: 0

## Code: hybridAstar, the primitives
snippet: hybrid
focus: const steers = [-dm, -dm / 2, 0, dm / 2, dm], … dirs = P.revOK ? [1, -1] : [1];
focus: // analytic expansion: try a Reeds–Shepp shot to the goal
Note: Every node expands into the motion primitives: five steering angles, each driven forward and, when reverse is allowed, backward. Whenever a node is close to the goal, the analytic expansion tries to finish with an exact Reeds–Shepp curve. The planner slot can return reverse legs as segs, so you can write a car planner of your own. The A* example plans for the unicycle only.

## Think about
Q: Why is the maximum of the two heuristics admissible, and why not their sum?
A: Each heuristic is a lower bound on the true cost, so the larger of the two is still a lower bound, and the search is still optimal. The sum would count the same metres twice. A path that is long because of obstacles and also long because of turning is not twice as long. The sum would therefore be inadmissible, and the search could skip the optimal path.
Q: The search closes poses in 0.2 m × 5° cells. What does a finer heading resolution buy and cost?
A: Finer cells let the search hold more headings for each place. Arrival headings are then more accurate, and fewer feasible routes are thrown away as duplicates. The cost is a larger state space (72 headings now, 360 at 1°) and a larger closed set to search before the shot lands. Cells of 5° are enough here because of the analytic expansion: the shot is continuous and fixes the last few degrees.
Q: Reverse costs double and a gear change costs 2. What would change if reverse were free?
A: The planner would reverse whenever that saved a few centimetres, and its plans would have many cusps. Each cusp is a stop and a gear change, which the tracker executes slowly and passengers dislike. The penalties state a preference for smooth forward motion. With them set to zero, the search still finds feasible paths, but unpleasant ones.

## Check yourself
Q: Wheelbase $L = 0.6$ m, steering lock 32°, and the planner uses 85 % of the lock. What turning radius $1/\kappa = L / \tan\delta$ does it plan with, in metres?
Answer: 1.167
Tolerance: 0.025
Unit: m
How: $\delta_p = 0.85 \times 32^\circ = 27.2^\circ$; $\tan 27.2^\circ = 0.514$; $0.6 / 0.514 = 1.17$ m
