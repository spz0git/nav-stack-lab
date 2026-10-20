group: plan
title: An end-to-end policy: from the scan to a path, and why it is hard

<p><b>Why this matters.</b> Everything in the planning group so far is a search over a map. The other idea, the one a lot of current robotics runs on, is to skip the map and the search and learn the whole thing: a network that takes the raw scan, the odometry and where the goal is, and outputs where to drive. This lesson builds that policy the honest way, by imitation of the classical stack on the lab's own levels, runs it in the page as a planner the ordinary tracker follows, and measures it. It works where the demonstrations were easy and fails where they were not, and the three standard remedies, noise injection, DAgger and a classical subgoal, each move the result a little. The point is not that end-to-end does not work; it is to see with numbers what it costs to make it work, next to a learned detector that took an afternoon.</p>
<p><b>The idea.</b> Behaviour cloning: run the expert, record what it sees and what it does, fit a function from the one to the other. What it sees is 139 numbers: the 120 ranges, the nearest range in each of 12 sectors of 30°, the goal in the robot frame, the speed and the turn rate. What it does is the route ahead: eight points 0.4 m apart along the A* path, in the robot frame. The function is a multilayer perceptron with two hidden layers of 256, 106 000 parameters, trained by least squares. In the page the policy is a planner: every half second its eight points become the path the tracker follows, through a safety layer that keeps the points and the lines between them 10 cm clear of the inflated obstacles, with A* to reroute a line that is not and to take over for 1.5 m when the robot is pinned. Compounding error is the catch: a 10 cm mistake takes the robot to a state the expert never showed, where the next mistake is larger. Noise injection widens the demonstrations around the expert's path; DAgger lets the policy drive and asks the expert what it should have done there; a subgoal from a classical global planner takes the long-range part of the problem away.</p>
$$x = \Bigl[\frac{r_1 \ldots r_{120}}{8},\ \frac{\min r \text{ per sector}}{8},\ \frac{g_x}{10},\ \frac{g_y}{10},\ \frac{|g|}{10},\ \cos\beta,\ \sin\beta,\ \frac{v}{1.5},\ \frac{\omega}{2}\Bigr] \qquad \text{139 inputs}$$
$$y = \bigl[(p_k)_x,\ (p_k)_y\bigr]_{k = 1 \ldots 8} \,/\, 4\ \text{m} \qquad\qquad f: 139 \to 256 \to 256 \to 16,\ \text{ReLU}$$
<p>with $y$ the A* route ahead at 0.4 m steps, in the robot frame. The loss is</p>
$$\text{loss} = \operatorname{mean} |f(x) - y|^2$$
<p>over 36 500 expert moments (16 runs, commands perturbed) and 23 400 DAgger moments (the policy's own states, expert-labelled). In the loop the points are $\text{pts} = e \oplus 4\,f(x)$, with $e$ the estimate; points closer than 0.5 m to an obstacle cell move to the nearest cell that clear, segments that come that close become short A* detours, the policy is replanned every 0.5 s, and the tracker follows.</p>
<p><b>Where it comes from.</b> Pomerleau's ALVINN (1989) is the first of these; the compounding-error argument and DAgger are Ross, Gordon and Bagnell (2011); noise injection as DART is Laskey et al. (2017). The data pipeline is the lab's: a Node collector over the headless core, PyTorch, weights as JSON, a forward pass in plain JavaScript. <a class="chref" href="#notes=ch4/10-an-end-to-end-policy">The features, the three remedies, the safety layer and the measured table: chapter 4 §10</a></p>
<p><b>What the lab does.</b> Plan → Learned policy (end-to-end). The Plan tab says what the policy is, counts what the safety layer did (waypoints moved, segments rerouted, paths cut, fallbacks to A*), and offers the subgoal mode, where the policy is pointed at a point 3 m along the A* route instead of the goal. The policy ships trained on L1, L2 and L4 with random goals, scripted and perturbed; L3 and L5 it never saw. Tools → Train trains another in the page, on the levels, maps of your own or random obstacles, with DAgger rounds where the policy drives; Policy model in this tab picks it. All numbers below are at seed 7 against A* on the same run.</p>

## Try: The open floor, where it works
cfg: {"sim":true,"level":0,"set":{"plan":"policy"},"tab":"plan"}
Setup: L1, the open floor the policy was trained on, with the level's four goals. Plan tab.
See: All four goals in 44.9 m, the same as A*, no collision, and a path on the map that bends around the pillars the way A*'s did. The safety layer never has to move a waypoint on this floor, so the Plan tab shows no count.
Shows: Where the demonstrations cover the situations, imitation works, and the map is a learned function of the scan: no grid, no search, a tenth of a millisecond per plan. Watch the eight points refresh every half second.
Predict: The busy floor, L5, which the policy never saw, with the speed planner handling the people. Goals?
- All five or nearly, with the safety layer at work: open aisles look like the training levels, and the people are not its problem
- None: a level it has not seen is out of the question
- One or two: every shelf end is a corner it never saw
Answer: 0

## Try: A floor it never saw
cfg: {"sim":true,"level":4,"set":{"plan":"policy","spd":"st"},"tab":"plan"}
Setup: L5 with the speed planner, the policy as the global planner.
See: All five goals in 120 s and 83 m, no shelf touched, and three contacts with people while moving; A* with the same speed planner takes all five in 121 s and 84 m with one. The Plan tab counts 41 waypoints moved, 15 segments rerouted and 5 paths cut.
Shows: Generalization to a new floor of the same kind. The scan features are local, and wide aisles with shelves look like what it learned from, so it mostly drives; the failure it has everywhere, a corner cut by 30 or 50 cm, is what the counts show the safety layer catching. The people it leaves to the speed planner, which is the modular design: the learned block does one job; it does it less smoothly than A*, and the speed planner has more to do around a path that keeps changing. The count varies from run to run: on seeds 2 to 5 the same experiment reaches 4, 4, 5 and 5 goals with at most one shelf touched, and on seed 1 the particle filter loses the robot and the run gets nowhere, a localization failure that slows A* on that seed too.
Predict: L2, the warehouse aisles it was trained on. Goals out of four?
- Four, as cleanly as A*: it was trained there
- None or one: the narrow aisles are where a corner clipped is a collision
- Three, with the Plan tab's counts climbing: the safety layer catches most of the corners the policy cuts, not every one
Answer: 2

## Try: The warehouse aisles, where the safety layer works hardest
cfg: {"sim":true,"level":1,"set":{"plan":"policy"},"tab":"plan"}
Setup: L2, a training level, the policy as the planner.
See: Goals 1 and 2 by 28 s. On the way to goal 3 the robot turns into the side of a shelf at 56 s and the goal is given up as stuck at 74 s; goal 4 at 106 s. Three of four, one collision, 58 m; A* takes all four in 60 m and 78 s. Watch the Plan tab: 157 waypoints moved, 33 segments rerouted, 46 paths cut and 35 fallbacks to A* by the end.
Shows: Compounding error, and what it costs to contain. The policy's open-loop error on held-out expert moments is 9 cm at the first point and 66 cm at the eighth; at an aisle's entrance its path cuts the shelf end the expert went around, and after a touch the robot is in a state no demonstration showed, where the policy keeps asking for forward (the expert never collided, so the data has no example of backing out). With only its points checked the robot hit the first shelf at 4 s and stayed there: no goal, three collisions. Checking the lines between the points, 10 cm clear, turns the cut corner into an A* detour, and 1.5 m of A* gets a pinned robot free. The counts are the honest part: 35 times the network had nothing drivable to offer.
Predict: Point the policy at a subgoal 3 m along the A* route instead of the goal. Does it get through the aisles?
- Hardly: one goal at most; the failure is the first metre of each corner, not the long-range direction
- Yes, all four: the safety layer guards the corners, and the subgoal supplies the long-range direction
- Worse: two planners fight
Answer: 1

## Try: A classical subgoal
cfg: {"sim":true,"level":1,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}
Setup: L2 with the hybrid: A* finds the route, the policy is pointed at the point 3 m along it and drives.
See: All four goals in 82 s and 57 m, no collision, and the counts fall: 41 waypoints moved, 27 segments rerouted, one path cut, two fallbacks to A*. Seeds 1 to 3 give the same.
Shows: The two failures are separate, and each has its fix. The subgoal fixes the long-range one, a reactive policy driving at a goal it cannot reach in a straight line; the safety layer contains the local one, the imprecision of an imitated path at a corner. Before the segment check the same experiment reached one goal: the subgoal cleared the first corner and the robot pinned at the next, a local failure no goal could fix. Together they drive the aisles like A*, and the counts say how much of that is A*.
Predict: L4, the building with rooms and doors, with the policy pointed at the goal. Goals?
- One or none: doors are corners twice over, and a goal behind a wall points the policy at the wall
- Three or four: doors are wider than aisles
- All four: it was trained there
Answer: 0

## Try: The building
cfg: {"sim":true,"level":3,"set":{"plan":"policy"},"tab":"plan"}
Setup: L4 with lidar mapping, the policy as the planner.
See: One goal of four, at 17 s; the other three given up as stuck at doorways, the last at 163 s, without touching a wall. A* takes four in 50 m. With Plan → What the policy is pointed at → A subgoal: all four in 71 s, no collision.
Shows: Rooms are the hardest case for a local policy: the goal is behind a wall, the way out is a door not visible in the goal direction, and the demonstrations through doors are a small share of the data. The safety layer keeps it off the walls but cannot find the door; the subgoal, which sits in the door, can. This is where the field adds memory (recurrent policies, maps as inputs), far more data, and reinforcement learning on top of imitation; the lab stops here and says so.

## Code: policyPlan, the forward pass and the safety layer
snippet: policy
focus: const y = mlpForward(M, policyFeatures(S.scan, e, target, S.odo)),
focus: const f = k >= 0 ? nearestFree(k, POLICY_CLEAR) : -1;
focus: if (segClear(ax, ay, bx, by, POLICY_CLEAR, i === 1)) continue;
example: plan/astar
Note: policyFeatures builds the 139 inputs (the collector calls the same function, so training and page agree by construction), mlpForward is three dense layers in nn.js, and the loop at the second marked line is the safety layer's first part: a point closer than POLICY_CLEAR to an obstacle moves to the nearest cell that clear. policyShield, below, is the rest: each segment checked with segClear (the third marked line), an A* detour where one comes too close, and 1.5 m of the A* route when what is left is too short to drive. Each is counted on the Plan tab. The subgoal mode above it runs A* and takes the point 3 m along. Edit and run: the A* example is the expert the policy was cloned from.

## Think about
Q: The open-loop error on held-out expert moments is 9 cm at the first waypoint, and with only the waypoints checked the closed-loop result on L2 was a collision at 4 s. Why does a small test error not predict the drive?
A: Because the test set is the expert's states and the drive visits the policy's. Each small error moves the robot a little off the demonstrated path; the next input is slightly out of distribution, the next error larger, and the errors compound along the trajectory instead of averaging out. DAgger exists for exactly this; in the lab two rounds of it doubled the held-out error on expert moments (the data now holds harder states too) without rescuing the aisles, which says the network, not the data, is the limit.
Q: What did the learned detector of the perception group have that this policy does not?
A: A local, well-posed target: whether a beam's hit is on a person depends on a few neighbouring beams and how well the map explains them, so a small convolution learns it from forty thousand scans. A path depends on the whole scan, the goal and the room beyond the scan, and the training signal is an average over demonstrations that could have gone either way around an obstacle, which pulls the imitation into the obstacle. Modular learning picks targets like the first; end-to-end takes the second as it comes.
Q: The safety layer moves waypoints, reroutes segments with A* and hands a pinned robot to A*. Is that still end-to-end?
A: No, and no deployed learned planner is: there is always a classical shield, a velocity limit, a collision check, a stop. The honest description of the lab's policy is a learned proposal inside classical bounds, and the measured result is what the proposal and the bounds are worth together; the Plan tab's counts say how often the bounds had to act. On the aisles, with the subgoal, the shield turns one goal into four. The question for any learned stack is where the shield ends and the learning begins, and a shield that does this much of the work is a reason to improve the proposal, not to stop measuring it.

## Check yourself
Q: The policy's two hidden layers have 256 units, the input 139 numbers and the output 16. How many parameters do the three dense layers hold, weights and biases?
Answer: 105744
Tolerance: 0
Unit: parameters
How: $139 \times 256 + 256 = 35\,840$; $256 \times 256 + 256 = 65\,792$; $256 \times 16 + 16 = 4\,112$; in all $105\,744$
