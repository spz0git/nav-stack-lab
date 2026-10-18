group: plan
title: Hybrid A*: planning for a car

<p><b>Why this matters.</b> A car cannot move sideways and cannot turn in place. Its heading is part of its state, and from any heading only poses along arcs of at least the minimum turning radius are reachable. A grid path, with its sharp corners and no heading, is not a route a car can follow, and parking, which is nothing but arriving at a heading, is impossible on one. Hybrid A* is the planner that made automated parking and low-speed manoeuvring practical, and it does so by keeping the search discrete while making every edge a real car motion.</p>
<p><b>The idea.</b> Search over cells as before, but let each node carry an exact pose, and let each edge be a short arc the car can drive: forward or in reverse, at one of five steering angles. Two cells count as the same node only if their headings also match to within 5°, so the search can hold several headings per place. Two heuristics guide it, and the search uses whichever is larger: a grid distance from the goal that knows about obstacles but not about turning, and the Reeds–Shepp length to the goal pose that knows about turning but not about obstacles. Near the goal the planner stops searching and tries to shoot straight to the goal pose with a Reeds–Shepp curve; if the shot is collision-free, the plan is done.</p>
<p>The cells are 0.2 m × 5°, and each node expands into 5 steering angles × {forward, reverse}, arcs of 0.4 m. The heuristic is</p>
$$h = \varepsilon \cdot \max\bigl(\text{2D Dijkstra with obstacles},\ \text{Reeds–Shepp without obstacles}\bigr)$$
<p>and the analytic expansion tries a Reeds–Shepp shot to the goal and accepts it if it is collision-free.</p>
<p><b>Where it comes from.</b> Each heuristic underestimates the true cost, so each is admissible, and the maximum of two admissible heuristics is admissible and tighter than either. Reeds and Shepp proved that the shortest obstacle-free path for a car that can reverse is one of 48 words of arcs and straights; by symmetry that is 12 families, which the lab evaluates in closed form for every query. The three-circle footprint over-approximates the car's rectangle by about 0.14 m at the corners, on the safe side. <a class="chref" href="#notes=ch4/4-planning-for-a-car">Derivation: chapter 4 §4</a></p>
<p><b>The primitives.</b> Each edge is the kinematic bicycle, pose at the rear axle and $\dot\theta = v\tan\delta / L$, driven for a signed distance $s = \pm 0.4$ m at a fixed steering angle, which is an arc of curvature $\kappa = \tan\delta / L$. It is integrated exactly in four 0.1 m steps, with the footprint checked after each; $\delta_p$ is the largest angle the planner uses, 85 % of the lock, and the edge cost writes out the preferences described below.</p>
$$x' = x + \frac{\sin(\theta + \kappa s) - \sin\theta}{\kappa} \qquad y' = y - \frac{\cos(\theta + \kappa s) - \cos\theta}{\kappa} \qquad \theta' = \theta + \kappa s \qquad (\kappa = 0:\ \text{straight})$$
$$\kappa = \frac{\tan\delta}{L}, \qquad \delta \in \{-\delta_p,\ -\delta_p/2,\ 0,\ \delta_p/2,\ \delta_p\}, \qquad s = +0.4\ \text{m forward},\ -0.4\ \text{m reverse}$$
$$\begin{aligned} \text{edge cost} &= 0.4\,(\times 2 \text{ in reverse}) + 0.05\,\frac{|\delta|}{\delta_p} + 0.1\,\frac{|\delta - \delta_{\text{prev}}|}{\delta_p} + 2 \text{ per gear change} + 0.8\,\text{prox}^2 \\ \text{prox} &= \max\Bigl(0,\ \frac{0.4 - \text{clearance}}{0.4}\Bigr) \end{aligned}$$
<p><b>What the lab does.</b> L6 is the parking lot with four goals, the first three posed (a position and a heading), the last a plain point. Wheelbase 0.6 m and a steering limit of 32°, so the car's true minimum radius is 0.96 m; the planner keeps 15 % in reserve and plans at 85 % of the lock, a 1.17 m radius, so the tracker has steering authority left to correct with. Reverse costs double, a gear change costs 2, and a proximity term keeps the car off walls. The budget is 60 000 expansions. The event log reports length, expansions, cusps (gear changes) and whether a Reeds–Shepp shot finished the plan.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses: the chip under the map plays the search one expansion at a time (◀ ▶ step, ▷ plays, the slider scrubs), with the newest node in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: Hybrid A*
cfg: {"sim":true,"level":5,"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L6 defaults: Hybrid A* with both heuristics, 85 % of the lock, reverse allowed. Search layer on.
See: Four goals in 148 s, no collisions, the three posed bays each reached within 0.1 m and 5°, the last, unposed goal at 0.2 m. The four plans take 6 950, 10 230, 30 and 162 expansions (about 60 to 70 ms for each of the first two and 10 ms for each of the last two here; the times depend on the machine); three end with a Reeds–Shepp shot. The third plan is the one to watch: 30 expansions, then a shot that parks the car with two cusps. The search layer shows the expanded poses as a scatter that fills the lot for the long plans and barely exists for the short ones.
Shows: The analytic expansion is what makes the planner fast: the search only has to get the car into a room from which a shot is clear, and the closed-form curve does the parking. The 85 % margin is invisible here because it works; the third experiment removes it. The heading tolerance at arrival is 0.2 rad (11°); these plans arrive within 5°, under half of it, because the Reeds–Shepp shot is continuous and fixes the last few degrees that 5° heading cells cannot represent. The next experiment takes that help away.
Predict: Hybrid A* drives the car to the four goals. How will the expansion counts of the four plans compare?
- All similar, a few thousand each
- All near the 60 000 budget: heading cells make the search large
- Wildly different, from tens to ten thousand
Answer: 2

## Try: 2D heuristic only
cfg: {"sim":true,"level":5,"set":{"hybH":"2d"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The Reeds–Shepp term removed from the heuristic; the search is guided by grid distance alone.
See: The first plan is found faster (1 515 expansions, 17.1 m) but arrives 11° off instead of 5°: the grid distance says nothing about heading, so the search settles the heading in the last metre and takes whatever it can get. The run then meets the lot's pedestrians differently, with four agent-blocking replans and four contacts (one a person walking into the stopped car), and finishes the four goals in 183 s.
Shows: A heuristic that is blind to part of the state is admissible and still misleading: it steers the search to the right place at the wrong heading, and a car cannot fix its heading on the spot. The contacts in this run are the lot's people crossing a different route, not the heuristic's fault directly, which is a reminder that a single run compares everything that changed, not only the thing you meant to change.
Predict: Remove the Reeds–Shepp term and guide the search by grid distance alone. What changes in the first plan?
- It fails: without a heading heuristic no shot ever lands
- It is found faster but arrives farther off the goal heading
- It is slower and more accurate: the grid distance is tighter
Answer: 1

## Try: Planner at 100 % steering
cfg: {"sim":true,"level":5,"set":{"planPct":100},"tab":"plan"}
Setup: The planner allowed the full 32° lock, turning radius 0.96 m instead of 1.17 m.
See: The plans are tighter and slightly shorter (17.0 m against 18.0 m for the first), and the car scrapes an obstacle twice, at 33 s and 121 s, both times after two seconds at full lock. Each time it stops making progress, and the stuck trigger replans from a standstill at 40 s and 126 s. The four goals are still reached, in 165 s against 148 s with the reserve, and the three bays 9°, 7° and 5° off the goal heading instead of 5°, 4° and 3°.
Shows: A path planned at the vehicle's limit cannot be tracked. On a full-lock arc the tracker's correction is to steer more, and there is no more; any error, from a 5° heading cell or a wheel slipping, is uncorrectable until the arc ends. The 15 % reserve is the planner leaving the tracker something to work with, and it is the first place planning and control meet.
Predict: Let the planner use the full 32° lock instead of 85 % of it. What happens when the car drives the plan?
- Shorter plans, driven cleanly: the car can steer that far
- The planner fails: tighter arcs do not fit the heading cells
- It gets stuck on full-lock arcs and scrapes obstacles
Answer: 2

## Try: Plain A* on the car
cfg: {"sim":true,"level":5,"set":{"plan":"astar"},"tab":"plan"}
Setup: The grid planner on the car: a path of straight segments and sharp corners, with no heading at the goal.
See: The car follows the first segment, swings wide at the first corner, and is stuck within 35 s. Each goal is skipped after three stuck replans; all four are skipped by 91 s with 15 m driven and one collision. Nothing was parked.
Shows: The grid path is not wrong, it is unreachable: no sequence of arcs of radius 1.17 m follows a 90° corner of radius zero, and the bays require a heading the path does not carry. Everything Hybrid A* adds, the heading in the state, the arc primitives, the Reeds–Shepp shot, exists to make the path something this vehicle can actually execute.
Predict: Give the car the grid planner's path of sharp corners. What happens?
- It is stuck at the first corner and every bay is skipped
- It drives the corners wide but reaches every bay
- It parks, but ignores the goal headings
Answer: 0

## Code: hybridAstar, the primitives
snippet: hybrid
focus: const steers = [-dm, -dm / 2, 0, dm / 2, dm], … dirs = P.revOK ? [1, -1] : [1];
focus: // analytic expansion: try a Reeds–Shepp shot to the goal
Note: Five steering angles times one or two directions are the motion primitives every node expands into; the analytic expansion tries to finish with an exact Reeds–Shepp curve whenever a node is close. The planner slot can return reverse legs as segs, so a car planner of your own is possible; the A* example plans for the unicycle only.

## Think about
Q: Why is the maximum of the two heuristics admissible, and why not their sum?
A: Each heuristic is a lower bound on the true cost, so the larger one is still a lower bound and the search is still optimal. The sum would double-count: a path that is long because of obstacles and long because of turning is not twice as long. The sum would be inadmissible and could make the search skip the optimal path.
Q: The search closes poses in 0.2 m × 5° cells. What does a finer heading resolution buy and cost?
A: Finer cells let the search represent more headings per place, so arrival headings are more accurate and fewer feasible routes are discarded as duplicates; the cost is a larger state space (72 headings now, 360 at 1°) and a larger closed set to search before the shot lands. The analytic expansion is what makes 5° enough: the shot is continuous and fixes the last few degrees.
Q: Reverse costs double and a gear change costs 2. What would change if reverse were free?
A: The planner would reverse whenever it saved a few centimetres, producing plans with many cusps, each a stop and a gear change that the tracker executes slowly and the passengers dislike. The penalties encode a preference for forward, smooth motion; set them to zero and the search still finds feasible paths, just unpleasant ones.

## Check yourself
Q: Wheelbase $L = 0.6$ m, steering lock 32°, and the planner uses 85 % of the lock. What turning radius $1/\kappa = L / \tan\delta$ does it plan with, in metres?
Answer: 1.167
Tolerance: 0.025
Unit: m
How: $\delta_p = 0.85 \times 32^\circ = 27.2^\circ$; $\tan 27.2^\circ = 0.514$; $0.6 / 0.514 = 1.17$ m
