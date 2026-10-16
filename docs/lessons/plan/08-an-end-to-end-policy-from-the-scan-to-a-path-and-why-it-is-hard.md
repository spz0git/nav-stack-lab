group: plan
title: An end-to-end policy: from the scan to a path, and why it is hard

<p><b>Why this matters.</b> Everything in the planning group so far is a search over a map. The other idea, the one a lot of current robotics runs on, is to skip the map and the search and learn the whole thing: a network that takes the raw scan, the odometry and where the goal is, and outputs where to drive. This lesson builds that policy the honest way, by imitation of the classical stack on the lab's own levels, runs it in the page as a planner the ordinary tracker follows, and measures it. It works where the demonstrations were easy and fails where they were not, and the three standard remedies, noise injection, DAgger and a classical subgoal, each move the result a little. The point is not that end-to-end does not work; it is to see with numbers what it costs to make it work, next to a learned detector that took an afternoon.</p>
<p><b>The idea.</b> Behaviour cloning: run the expert, record what it sees and what it does, fit a function from the one to the other. What it sees is 139 numbers: the 120 ranges, the nearest range in each of 12 sectors of 30°, the goal in the robot frame, the speed and the turn rate. What it does is the route ahead: eight points 0.4 m apart along the A* path, in the robot frame. The function is a multilayer perceptron with two hidden layers of 256, 106 000 parameters, trained by least squares. In the page the policy is a planner: every half second its eight points become the path the tracker follows, and a safety layer moves any point that lands in an inflated obstacle to the nearest free cell. Compounding error is the catch: a 10 cm mistake takes the robot to a state the expert never showed, where the next mistake is larger. Noise injection widens the demonstrations around the expert's path; DAgger lets the policy drive and asks the expert what it should have done there; a subgoal from a classical global planner takes the long-range part of the problem away.</p>
<div class="eq">x = [r₁…r₁₂₀/8, min r per sector /8, g_x/10, g_y/10, |g|/10, cos β, sin β, v/1.5, ω/2]        139 inputs
y = [(p_k)_x, (p_k)_y]_{k=1..8} / 4 m   the A* route ahead at 0.4 m steps, robot frame        f: 139 → 256 → 256 → 16, ReLU
loss = mean |f(x) − y|²  over 36 500 expert moments (16 runs, commands perturbed) + 23 400 DAgger moments (the policy's own states, expert-labelled)
in the loop: pts = e ⊕ 4·f(x),  lethal points snapped to the nearest free cell,  replanned every 0.5 s,  the tracker follows</div>
<p><b>Where it comes from.</b> Pomerleau's ALVINN (1989) is the first of these; the compounding-error argument and DAgger are Ross, Gordon and Bagnell (2011); noise injection as DART is Laskey et al. (2017). The data pipeline is the lab's: a Node collector over the headless core, PyTorch, weights as JSON, a forward pass in plain JavaScript. <a class="chref" href="#notes=ch4/10-an-end-to-end-policy">The features, the three remedies, the safety layer and the measured table: chapter 4 §10</a></p>
<p><b>What the lab does.</b> Plan → Learned policy (end-to-end). The Plan tab says what the policy is, counts the waypoints the safety layer moved and the paths it cut, and offers the subgoal mode, where the policy is pointed at a point 3 m along the A* route instead of the goal. The policy ships trained on L1, L2 and L4 with random goals, scripted and perturbed; L3 and L5 it never saw. All numbers below are at seed 7 against A* on the same run.</p>

## Try: The open floor, where it works
cfg: {"sim":true,"level":0,"set":{"plan":"policy"},"tab":"plan"}
Setup: L1, the open floor the policy was trained on, with the level's four goals. Plan tab.
See: All four goals in 44.9 m, the same as A*, no collision, and a path on the map that bends around the pillars the way A*'s did. The Plan tab counts a few waypoints moved out of inflated obstacles over the run.
Shows: Where the demonstrations cover the situations, imitation works, and the map is a learned function of the scan: no grid, no search, a tenth of a millisecond per plan. Watch the eight points refresh every half second.
Predict: The busy floor, L5, which the policy never saw, with the speed planner handling the people. Goals?
- Four of five: open aisles look like the training levels, and the people are not its problem
- None: a level it has not seen is out of the question
- All five, faster than A*: it learned to cut corners
Answer: 0

## Try: A floor it never saw
cfg: {"sim":true,"level":4,"set":{"plan":"policy","spd":"st"},"tab":"plan"}
Setup: L5 with the speed planner, the policy as the global planner.
See: Four of five goals, 79 m, one contact with a person and two brushes with shelves; A* with the same speed planner reaches five with two contacts. The fourth goal is given up after the policy pins the robot against a shelf end.
Shows: Generalization to a new floor of the same kind. The scan features are local, and wide aisles with shelves look like what it learned from, so it mostly drives; the failure is the one it has everywhere, a corner clipped by 30 or 50 cm. The people it leaves to the speed planner, which is the modular design: the learned block does one job.
Predict: L2, the warehouse aisles it was trained on. Goals out of four?
- Four: it was trained there
- None or one: the narrow aisles are where a corner clipped is a collision
- Two: half the aisles are easier than the other half
Answer: 1

## Try: The warehouse aisles, where it fails
cfg: {"sim":true,"level":1,"set":{"plan":"policy"},"tab":"plan"}
Setup: L2, a training level, the policy as the planner.
See: At 4 s the robot collides with the first shelf's end: the policy's path cuts the corner the expert went around, the safety layer moves the points out of the inflation but the robot is already pinned, and the tracker pushes forward against the shelf until the goal is given up as stuck at 20 s. No goal of four, three collisions; A* takes all four in 59 m.
Shows: Compounding error in one picture. The policy's open-loop error on held-out expert moments is 9 cm at the first point and 66 cm at the eighth; at an aisle's entrance 9 cm is enough to touch, and after the touch the robot is in a state no demonstration showed, where the policy keeps asking for forward. The expert never collided, so the data has no example of backing out.
Predict: Point the policy at a subgoal 3 m along the A* route instead of the goal. Does it get through the aisles?
- No better: the failure is the first metre of the corner, not the long-range direction
- Yes: with the global part taken away the policy only has to avoid
- Worse: two planners fight
Answer: 0

## Try: A classical subgoal
cfg: {"sim":true,"level":1,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}
Setup: L2 with the hybrid: A* finds the route, the policy is pointed at the point 3 m along it and drives.
See: One goal of four, two collisions: the same corner, the same pin. The subgoal lies around the shelf end, the policy still cuts the corner on the way to it.
Shows: The hybrid fixes a different failure, the long-range one, where a reactive policy drives at a goal behind a wall. The failure here is local: the imprecision of an imitated path at a corner, and that needs more data near corners, a better network, or a safety layer that understands recovery, not a better goal.
Predict: L4, the building with rooms and doors, with the policy pointed at the goal. Goals?
- One or none: doors are corners twice over, and a goal behind a wall points the policy at the wall
- Three or four: doors are wider than aisles
- All four: it was trained there
Answer: 0

## Try: The building
cfg: {"sim":true,"level":3,"set":{"plan":"policy"},"tab":"plan"}
Setup: L4 with lidar mapping, the policy as the planner.
See: One goal of four, one collision, the rest given up as stuck at doorways; A* takes four in 50 m. With the subgoal: none of four.
Shows: Rooms are the hardest case for a local policy: the goal is behind a wall, the way out is a door not visible in the goal direction, and the demonstrations through doors are a small share of the data. This is where the field adds memory (recurrent policies, maps as inputs), far more data, and reinforcement learning on top of imitation; the lab stops here and says so.

## Code: policyPlan, the forward pass and the safety layer
snippet: policy
focus: const y = mlpForward(M, policyFeatures(S.scan, e, target, S.odo)),
focus: const f = k >= 0 ? nearestFree(k) : -1;
example: plan/astar
Note: policyFeatures builds the 139 inputs (the collector calls the same function, so training and page agree by construction), mlpForward is three dense layers in nn.js, and the loop after the marked line is the safety layer: a point in the inflation band moves to the nearest free cell, counted on the Plan tab. The subgoal mode above it runs A* and takes the point 3 m along. Edit and run: the A* example is the expert the policy was cloned from.

## Think about
Q: The open-loop error on held-out expert moments is 9 cm at the first waypoint, and the closed-loop result on L2 is a collision at 4 s. Why does a small test error not predict the drive?
A: Because the test set is the expert's states and the drive visits the policy's. Each small error moves the robot a little off the demonstrated path; the next input is slightly out of distribution, the next error larger, and the errors compound along the trajectory instead of averaging out. DAgger exists for exactly this; in the lab two rounds of it doubled the held-out error on expert moments (the data now holds harder states too) without rescuing the aisles, which says the network, not the data, is the limit.
Q: What did the learned detector of the perception group have that this policy does not?
A: A local, well-posed target: whether a beam's hit is on a person depends on a few neighbouring beams and nothing else, so a small convolution learns it from twenty thousand scans. A path depends on the whole scan, the goal and the room beyond the scan, and the training signal is an average over demonstrations that could have gone either way around an obstacle, which pulls the imitation into the obstacle. Modular learning picks targets like the first; end-to-end takes the second as it comes.
Q: The safety layer moves waypoints out of inflated obstacles. Is that still end-to-end?
A: No, and no deployed learned planner is: there is always a classical shield, a velocity limit, a collision check, a stop. The honest description of the lab's policy is a learned proposal inside classical bounds, and the measured result is what the proposal is worth. The question for any learned stack is where the shield ends and the learning begins.

## Check yourself
Q: The policy's two hidden layers have 256 units, the input 139 numbers and the output 16. How many parameters do the three dense layers hold, weights and biases?
Answer: 105744
Tolerance: 0
Unit: parameters
How: 139 × 256 + 256 = 35 840; 256 × 256 + 256 = 65 792; 256 × 16 + 16 = 4 112; in all 105 744
