group: plan
title: Hybrid A*: planning for a car

<p><b>Why this matters.</b> A car cannot move sideways and cannot turn in place. Its heading is part of its state, and from any heading only poses along arcs of at least the minimum turning radius are reachable. A grid path, with its sharp corners and no heading, is not a route a car can follow, and parking, which is nothing but arriving at a heading, is impossible on one. Hybrid A* is the planner that made automated parking and low-speed manoeuvring practical, and it does so by keeping the search discrete while making every edge a real car motion.</p>
<p><b>The idea.</b> Search over cells as before, but let each node carry an exact pose, and let each edge be a short arc the car can drive: forward or in reverse, at one of five steering angles. Two cells count as the same node only if their headings also match to within 5°, so the search can hold several headings per place. Two heuristics guide it, and the search uses whichever is larger: a grid distance from the goal that knows about obstacles but not about turning, and the Reeds–Shepp length to the goal pose that knows about turning but not about obstacles. Near the goal the planner stops searching and tries to shoot straight to the goal pose with a Reeds–Shepp curve; if the shot is collision-free, the plan is done.</p>
<div class="eq">cells 0.2 m × 5°,  5 steering angles × {forward, reverse}, 0.4 m arcs
h = ε · max(2D Dijkstra with obstacles, Reeds–Shepp without obstacles)
analytic expansion: try a Reeds–Shepp shot to the goal, accept it if collision-free</div>
<p><b>Where it comes from.</b> Each heuristic underestimates the true cost, so each is admissible, and the maximum of two admissible heuristics is admissible and tighter than either. Reeds and Shepp proved that the shortest obstacle-free path for a car that can reverse is one of 48 words of arcs and straights; by symmetry that is 12 families, which the lab evaluates in closed form for every query. The three-circle footprint over-approximates the car's rectangle by about 0.14 m at the corners, on the safe side. <a class="chref" href="#notes=ch4/4-planning-for-a-car">Derivation: chapter 4 §4</a></p>
<p><b>The primitives.</b> Each edge is the kinematic bicycle, pose at the rear axle and θ̇ = <i>v</i> tan δ/<i>L</i>, driven for a signed distance <i>s</i> = ±0.4 m at a fixed steering angle, which is an arc of curvature κ = tan δ/<i>L</i>. It is integrated exactly in four 0.1 m steps, with the footprint checked after each; δ<sub>p</sub> is the largest angle the planner uses, 85 % of the lock, and the edge cost writes out the preferences described below.</p>
<div class="eq">x' = x + (sin(θ + κs) − sin θ)/κ,   y' = y − (cos(θ + κs) − cos θ)/κ,   θ' = θ + κs     (κ = 0: straight)
κ = tan δ / L,   δ ∈ {−δ_p, −δ_p/2, 0, δ_p/2, δ_p},   s = +0.4 m forward, −0.4 m reverse
edge cost = 0.4 (× 2 in reverse) + 0.05|δ|/δ_p + 0.1|δ − δ_prev|/δ_p + 2 per gear change + 0.8·prox²
prox = max(0, (0.4 − clearance)/0.4)</div>
<p><b>What the lab does.</b> L6 is the parking lot with four posed goals. Wheelbase 0.6 m and a steering limit of 32°, so the car's true minimum radius is 0.96 m; the planner keeps 15 % in reserve and plans at 85 % of the lock, a 1.17 m radius, so the tracker has steering authority left to correct with. Reverse costs double, a gear change costs 2, and a proximity term keeps the car off walls. The budget is 60 000 expansions. The event log reports length, expansions, cusps (gear changes) and whether a Reeds–Shepp shot finished the plan.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses: the chip under the map plays the search one expansion at a time (◀ ▶ step, ▷ plays, the slider scrubs), with the newest node in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: Hybrid A*
cfg: {"sim":true,"level":5,"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L6 defaults: Hybrid A* with both heuristics, 85 % of the lock, reverse allowed. Search layer on.
See: Four bays in 150 s, no collisions, each arrival within 0.1 m and 5° of the posed goal. The four plans take 6 950, 10 230, 30 and 162 expansions (185, 156, 24 and 23 ms); three end with a Reeds–Shepp shot. The third plan is the one to watch: 30 expansions, then a shot that parks the car with two cusps. The search layer shows the expanded poses as a scatter that fills the lot for the long plans and barely exists for the short ones.
Shows: The analytic expansion is what makes the planner fast: the search only has to get the car into a room from which a shot is clear, and the closed-form curve does the parking. The 85 % margin is invisible here because it works; the third experiment removes it. The heading tolerance at arrival is 0.2 rad, and the plans use most of it, because 5° heading cells cannot represent anything finer.
Predict: Hybrid A* parks the car in four bays. How will the expansion counts of the four plans compare?
- All similar, a few thousand each
- All near the 60 000 budget: heading cells make the search large
- Wildly different, from tens to ten thousand
Answer: 2

## Try: 2D heuristic only
cfg: {"sim":true,"level":5,"set":{"hybH":"2d"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The Reeds–Shepp term removed from the heuristic; the search is guided by grid distance alone.
See: The first plan is found faster (1 515 expansions, 17.1 m) but arrives 11° off instead of 5°: the grid distance says nothing about heading, so the search settles the heading in the last metre and takes whatever it can get. The run then meets the lot's pedestrians differently, with three agent-blocking replans and four contacts, and finishes the four bays in 180 s.
Shows: A heuristic that is blind to part of the state is admissible and still misleading: it steers the search to the right place at the wrong heading, and a car cannot fix its heading on the spot. The contacts in this run are the lot's people crossing a different route, not the heuristic's fault directly, which is a reminder that a single run compares everything that changed, not only the thing you meant to change.
Predict: Remove the Reeds–Shepp term and guide the search by grid distance alone. What changes in the first plan?
- It fails: without a heading heuristic no shot ever lands
- It is found faster but arrives farther off the goal heading
- It is slower and more accurate: the grid distance is tighter
Answer: 1

## Try: Planner at 100 % steering
cfg: {"sim":true,"level":5,"set":{"planPct":100},"tab":"plan"}
Setup: The planner allowed the full 32° lock, turning radius 0.96 m instead of 1.17 m.
See: The plans are shorter and tighter, and the car gets stuck twice: at 40 s and 125 s it stops making progress on a full-lock arc, the mission replans from a standstill, and it scrapes an obstacle twice on the way (two collisions, closest clearance 0.12 m). The four bays are still reached, in 135 s.
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
Q: Wheelbase L = 0.6 m, steering lock 32°, and the planner uses 85 % of the lock. What turning radius 1/κ = L / tan δ does it plan with, in metres?
Answer: 1.167
Tolerance: 0.025
Unit: m
How: δ_p = 0.85 × 32° = 27.2°; tan 27.2° = 0.514; 0.6 / 0.514 = 1.17 m
