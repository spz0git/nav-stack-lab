group: plan
title: An end-to-end policy: from the scan to a path, and why it is hard

<p><b>Why this matters.</b> Everything in the planning group so far is a search over a map. The other idea, the one a lot of current robotics runs on, is to skip the map and the search and learn the whole thing: a network that takes the raw scan, the odometry and where the goal is, and outputs where to drive. This lesson builds that policy the honest way, by imitation of the classical stack on the lab's own levels, runs it in the page as a planner the ordinary tracker follows, and measures it. It works where the demonstrations were easy and fails where they were not, and the standard remedies, noise injection, DAgger, a classical subgoal and several candidate paths instead of one, each move the result. The point is not that end-to-end does not work; it is to see with numbers what it costs to make it work, next to a learned detector that took an afternoon.</p>
<p><b>The idea.</b> Behaviour cloning: run the expert, record what it sees and what it does, fit a function from the one to the other. What it sees is 139 numbers: the 120 ranges, the nearest range in each of 12 sectors of 30°, the goal in the robot frame, the speed and the turn rate. What it does is the route ahead: eight points 0.4 m apart along the A* path, in the robot frame. Where the expert went either way around a shelf, a single path fitted by least squares is the average of the two, a path through the shelf; so the network proposes four candidate paths with a score each, and is trained like the people predictor, by the likelihood of a mixture: each candidate is pulled towards the routes it explains best, each score towards how often it does. The function is a multilayer perceptron with two hidden layers of 256, 119 000 parameters. In the page the policy is a planner: every half second the best-scoring candidate whose points and segments stay 10 cm clear of the inflated obstacles becomes the path the tracker follows (held from one refresh to the next unless another is much likelier); when none does, a classical safety layer moves the best one's points clear, reroutes its segments with short A* detours, and hands a pinned robot 1.5 m of the A* route. Compounding error is the catch: a 10 cm mistake takes the robot to a state the expert never showed, where the next mistake is larger. Noise injection widens the demonstrations around the expert's path; DAgger lets the policy drive and asks the expert what it should have done there; a subgoal from a classical global planner takes the long-range part of the problem away.</p>
$$x = \Bigl[\frac{r_1 \ldots r_{120}}{8},\ \frac{\min r \text{ per sector}}{8},\ \frac{g_x}{10},\ \frac{g_y}{10},\ \frac{|g|}{10},\ \cos\beta,\ \sin\beta,\ \frac{v}{1.5},\ \frac{\omega}{2}\Bigr] \qquad \text{139 inputs}$$
$$f(x) = \bigl[s_1 \ldots s_4,\ \mu_1 \ldots \mu_4\bigr],\quad \mu_k = \bigl[(p_{k,i})_x,\ (p_{k,i})_y\bigr]_{i = 1 \ldots 8} \,/\, 4\ \text{m} \qquad f: 139 \to 256 \to 256 \to 68,\ \text{ReLU}$$
<p>with $y$ the A* route ahead at 0.4 m steps, in the robot frame, and $\pi = \operatorname{softmax}(s)$. The loss is</p>
$$\text{loss} = \operatorname{mean}\Bigl(-\log \sum_{k=1}^{4} \pi_k \, e^{-|y - \mu_k|^2 / 2\sigma^2}\Bigr), \qquad \sigma = 0.05 \ (0.2\ \text{m})$$
<p>over 36 500 expert moments (16 runs, commands perturbed) and 23 400 DAgger moments (the policy's own states, expert-labelled). In the loop the candidates are $e \oplus 4\,\mu_k$, with $e$ the estimate, tried in the order of $\pi_k$; the policy is replanned every 0.5 s, and the tracker follows.</p>
<p><b>Where it comes from.</b> Pomerleau's ALVINN (1989) is the first of these; the compounding-error argument and DAgger are Ross, Gordon and Bagnell (2011); noise injection as DART is Laskey et al. (2017); several scored trajectories instead of one is the multiple-trajectory prediction of Cui et al. (2019) and the mixture density network of Bishop (1994). The data pipeline is the lab's: a Node collector over the headless core, PyTorch, weights as JSON, a forward pass in plain JavaScript. <a class="chref" href="#notes=ch4/10-an-end-to-end-policy">The features, the remedies, the safety layer and the measured table: chapter 4 §10</a></p>
<p><b>What the lab does.</b> Plan → Learned policy (end-to-end). The candidates the robot does not take are drawn faint on the map, rose where they run into the inflation. The Plan tab says what the policy is, counts the times a lower-scored candidate was taken and what the safety layer did (waypoints moved, segments rerouted, paths cut, fallbacks to A*), and offers the subgoal mode, where the policy is pointed at a point 3 m along the A* route instead of the goal. The policy ships trained on L1, L2 and L4 with random goals, scripted and perturbed; L3 and L5 it never saw. Tools → Train trains another in the page, on the levels, maps of your own or random obstacles, with DAgger rounds where the policy drives; Policy model in this tab picks it. All numbers below are at seed 7 against A* on the same run.</p>

## Try: The open floor, where it works
cfg: {"sim":true,"level":0,"set":{"plan":"policy"},"tab":"plan"}
Setup: L1, the open floor the policy was trained on, with the level's four goals. Plan tab.
See: All four goals in 44.8 m, the same as A*, no collision, and a path on the map that bends around the pillars the way A*'s did. A lower-scored candidate is taken once, and the safety layer never acts; the faint lines are the other three, mostly near copies of it.
Shows: Where the demonstrations cover the situations, imitation works, and the map is a learned function of the scan: no grid, no search, a tenth of a millisecond per plan. Watch the eight points refresh every half second.
Predict: The busy floor, L5, which the policy never saw, with the speed planner handling the people. Goals?
- All five, like A*: its aisles look like the training levels, and the people are the speed planner's job
- None: a level it has not seen is out of the question
- Two or three: it clips a shelf corner in most aisles
Answer: 0

## Try: A floor it never saw
cfg: {"sim":true,"level":4,"set":{"plan":"policy","spd":"st"},"tab":"plan"}
Setup: L5 with the speed planner, the policy as the global planner.
See: All five goals in 84 m and 124 s, no collision with a shelf, and one contact with a person while moving, as A* with the same speed planner has on this run (five goals, 84 m). A lower-scored candidate is taken 24 times because the best one runs into a shelf's inflation, and twice the robot falls back to A*; the single-path policy without these clipped two shelves here and gave up a goal.
Shows: Generalization to a new floor of the same kind. The scan features are local, and wide aisles with shelves look like what it learned from, so it drives; the corners it used to clip are where a second candidate, the other way round the shelf end, is taken instead. The people it leaves to the speed planner, which is the modular design: the learned block does one job. The count varies from run to run: on seeds 2 to 5 the same experiment reaches all five goals without touching a shelf, and on seed 1 the particle filter loses the robot and the run reaches one goal in 150 s, a localization failure that costs A* goals on that seed too.
Predict: L2, the warehouse aisles it was trained on. Goals out of four?
- Three or four: the aisles need a side picked at every shelf end, which the candidates can do
- None or one: the narrow aisles are where a corner clipped is a collision
- All four, as directly as A*
Answer: 0

## Try: The warehouse aisles
cfg: {"sim":true,"level":1,"set":{"plan":"policy"},"tab":"plan"}
Setup: L2, a training level, the policy as the planner.
See: The first shelf end goes by at 4 s and the first goal is reached at 20 s. On the way to goal 2 the robot touches a shelf at 43 s and again at 57 s, and goal 2 is given up at 76 s; goals 3 and 4 follow at 106 s and 143 s. Three goals of four in 80 m, two collisions; A* takes all four in 59 m. The Plan tab counts 58 lower-scored candidates taken, 82 waypoints moved, 6 segments rerouted, 43 paths cut and 38 fallbacks to A*: around goal 2 no candidate clears for long stretches, and the classical layer drives.
Shows: The failure this policy had before, in one picture, and the fix. Where the demonstrations went left of a shelf end from some states and right of it from almost the same states, a single least-squares path is their average, through the shelf: the old policy collided at the first shelf end at 4 s, every time, and reached no goal. With four candidates the two sides stay two answers, the score says which the expert took more often, and the costmap check takes the other when the first is blocked. What is left is the case no candidate covers: in the inflation with every proposal pointing into the shelf, a memoryless policy keeps asking for the same thing, and the A* fallback gets it out only for the robot to be pointed back. The counts say how often that happens.
Predict: Point the policy at a subgoal 3 m along the A* route instead of the goal. Goals?
- All four, cleanly: with the long-range part taken away, the candidates only have to pick a side of each shelf
- Hardly: one goal at most; the failure is the first metre of each corner, not the long-range direction
- Worse: two planners fight
Answer: 0

## Try: A classical subgoal
cfg: {"sim":true,"level":1,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}
Setup: L2 with the hybrid: A* finds the route, the policy is pointed at the point 3 m along it and drives.
See: All four goals in 58 m, no collision, as short as A*'s 59; a lower-scored candidate is taken eleven times and the safety layer acts once. The single-path policy reached one goal here and collided twice: its average still cut the shelf end on the way to the subgoal.
Shows: The two remedies fix different failures, and here they need each other. The subgoal fixes the long-range one, a goal behind a shelf that points a reactive policy at the shelf; the candidates fix the local one, the averaged corner. Either alone leaves the robot pinned somewhere; together they drive the aisles like the classical stack. On seeds 1 to 5 the result is the same, four of four with no collision.
Predict: L4, the building with rooms and doors, with the policy pointed at the goal. Goals?
- One or none: a goal behind a wall points the policy at the wall, and more candidates do not change where the goal is
- Three or four: doors are wider than aisles
- All four: it was trained there
Answer: 0

## Try: The building
cfg: {"sim":true,"level":3,"set":{"plan":"policy"},"tab":"plan"}
Setup: L4 with lidar mapping, the policy as the planner.
See: One goal of four, at 17 s, one collision at 39 s, the rest given up as stuck at doorways; A* takes four in 50 m. The Plan tab fills up: 125 waypoints moved, 50 paths cut, 12 fallbacks to A*, as the safety layer works against a wall the candidates all point at.
Shows: Rooms are the hardest case for a local policy: the goal is behind a wall, the way out is a door not visible in the goal direction, and the demonstrations through doors are a small share of the data. All four candidates point at the wall, because the scan does not say which door leads to the goal. This is where the field adds memory (recurrent policies, maps as inputs), far more data, and reinforcement learning on top of imitation; the lab adds the cheapest of them, a route from a planner that has the map.
Predict: Point the policy at the subgoal here. Goals?
- All four: the route through the doors is the planner's, and the candidates only have to drive it
- One or none, as before: doors are corners twice over
- Two: the near rooms only
Answer: 0

## Try: The building with a subgoal
cfg: {"sim":true,"level":3,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}
Setup: L4 with lidar mapping, the hybrid: A* finds the route through the doors, the policy drives towards the point 3 m along it.
See: All four goals in 51 m and 73 s, no collision, as A* does. The single-path policy reached none here and collided four times. On seeds 1 to 5 the result is the same, four of four with no collision.
Shows: The division of labour that learned navigation stacks settle on: a classical planner over a map for where to go, a learned local policy for how to drive there, and a classical check around the learned part. The policy alone on this floor reaches one goal; the hybrid reaches all of them.

## Code: policyPlan, the forward pass, the candidates and the safety layer
snippet: policy
focus: const y = mlpForward(M, policyFeatures(S.scan, e, target, S.odo)),
focus: pick = held && clear[0].p <= 2 * held.p ? held : clear[0];
focus: const f = k >= 0 ? nearestFree(k, POLICY_CLEAR) : -1;
example: plan/astar
Note: policyFeatures builds the 139 inputs (the collector calls the same function, so training and page agree by construction), mlpForward is three dense layers in nn.js, and the candidates come out of the one output vector: four scores, then four paths. The second marked line picks among the candidates whose points and segments clear the costmap by POLICY_CLEAR: the best-scoring one, or the one nearest the path being driven unless the best is more than twice as likely. The loop at the last marked line is the safety layer for when none clears, and policyShield, below, its segment check and A* fallback. The subgoal mode above it runs A* and takes the point 3 m along. Edit and run: the A* example is the expert the policy was cloned from.

## Think about
Q: Offline, on a held-out run, the best-scoring candidate's eighth point is 1.64 m from the expert's route, no better than the single least-squares path's 1.68 m; the best of the four is 0.51 m off. Yet the four candidates take L2 from no goal to three. Why does the offline error not predict the drive?
A: Because least squares is the best single guess on average and the mixture is not trying to be: where the expert went either way, the average is a guess that is off by half the gap in every case and drives into the shelf, while the best-scoring candidate is right on one side and fully wrong on the other, a similar mean error. What decides the drive is whether some candidate is on a side the robot can take, and the best-of-four number, 0.51 m, says one usually is; the costmap check picks it. The test set is also the expert's states and the drive visits the policy's, where each small error moves the robot to a state no demonstration showed; DAgger exists for that, and in the lab two rounds of it did not rescue the aisles: the averaged target, not the data, was the limit.
Q: What did the learned detector of the perception group have that this policy does not?
A: A local, well-posed target: whether a beam's hit is on a person depends on a few neighbouring beams and how well the map explains them, so a small convolution learns it from forty thousand scans. A path depends on the whole scan, the goal and the room beyond the scan, and the demonstrations could have gone either way around an obstacle. The mixture loss makes that second target well-posed in one respect, two sides become two answers, but the room beyond the scan is still unknown, which is why the building needs the subgoal. Modular learning picks targets like the first; end-to-end takes the second as it comes.
Q: The page takes a candidate that clears the costmap, and when none does, moves waypoints, reroutes segments with A* and hands a pinned robot to A*. Is that still end-to-end?
A: No, and no deployed learned planner is: there is always a classical shield, a velocity limit, a collision check, a stop. With several candidates the shield gets a choice instead of only a veto, which is why it helps so much more. The honest description of the lab's policy is a learned proposal inside classical bounds, and the measured result is what the proposals and the bounds are worth together; the Plan tab's counts say how often the bounds had to act. The question for any learned stack is where the shield ends and the learning begins.

## Check yourself
Q: The policy's two hidden layers have 256 units, the input 139 numbers, and the output four scores and four paths of eight points. How many parameters do the three dense layers hold, weights and biases?
Answer: 119108
Tolerance: 0
Unit: parameters
How: The output is $4 + 4 \times 16 = 68$ numbers. $139 \times 256 + 256 = 35\,840$; $256 \times 256 + 256 = 65\,792$; $256 \times 68 + 68 = 17\,476$; in all $119\,108$
