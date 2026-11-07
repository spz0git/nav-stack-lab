group: plan
title: An end-to-end policy: from the scan to a path, and why it is hard
level: 3

<p><b>Why this matters.</b> Every planner in this group so far searches a map. Much of current robotics takes another approach: skip the map and the search, and learn the whole job. A network takes the raw scan, the odometry and the position of the goal, and outputs where to drive. This lesson builds such a policy by imitation of the classical stack on the lab's own levels. It runs the policy in the page as a planner that the ordinary tracker follows, and measures it. The policy works where the demonstrations were easy and fails where they were not. The standard remedies each change the result: noise injection, DAgger, a classical subgoal, and several candidate paths instead of one. End-to-end learning can be made to work, and this lesson measures what that takes, next to the learned detector of the perception group, which took an afternoon.</p>
<p><b>The idea.</b> The method is behaviour cloning. You run the expert, record what it sees and what it does, and fit a function from the one to the other. What it sees is 139 numbers: the 120 ranges, the nearest range in each of 12 sectors of 30°, the goal in the robot frame, the speed and the turn rate. What it does is the route ahead: eight points 0.4 m apart along the A* path, in the robot frame. In some places the expert went round a shelf on one side, and from almost the same state on the other side. A single path fitted by least squares is then the average of the two, which goes through the shelf. So the network proposes four candidate paths, each with a score. It is trained like the people predictor, by the likelihood of a mixture. Each candidate is pulled towards the routes it explains best, and each score towards how often its candidate does. The function is a multilayer perceptron with two hidden layers of 256 units and 119 000 parameters. In the page the policy is a planner. Every half second, the tracker is given the best-scoring candidate whose points and segments stay 10 cm clear of the inflated obstacles. The path is held from one refresh to the next unless another candidate is much more likely. When no candidate is clear, a classical safety layer takes over. It moves the best candidate's points clear, reroutes its segments with short A* detours, and gives a pinned robot 1.5 m of the A* route. The main difficulty is compounding error. A 10 cm mistake takes the robot to a state the expert never showed, where the next mistake is larger. Three remedies address it. Noise injection perturbs the expert's commands while recording, so the demonstrations also cover states around the expert's path. DAgger lets the policy drive and asks the expert what it should have done in each state the policy reached. A subgoal from a classical global planner takes the long-range part of the problem away.</p>
$$x = \Bigl[\frac{r_1 \ldots r_{120}}{8},\ \frac{\min r \text{ per sector}}{8},\ \frac{g_x}{10},\ \frac{g_y}{10},\ \frac{|g|}{10},\ \cos\beta,\ \sin\beta,\ \frac{v}{1.5},\ \frac{\omega}{2}\Bigr] \qquad \text{139 inputs}$$
$$f(x) = \bigl[s_1 \ldots s_4,\ \mu_1 \ldots \mu_4\bigr],\quad \mu_k = \bigl[(p_{k,i})_x,\ (p_{k,i})_y\bigr]_{i = 1 \ldots 8} \,/\, 4\ \text{m} \qquad f: 139 \to 256 \to 256 \to 68,\ \text{ReLU}$$
<p>with $y$ the A* route ahead at 0.4 m steps, in the robot frame, and $\pi = \operatorname{softmax}(s)$. The loss is</p>
$$\text{loss} = \operatorname{mean}\Bigl(-\log \sum_{k=1}^{4} \pi_k \, e^{-|y - \mu_k|^2 / 2\sigma^2}\Bigr), \qquad \sigma = 0.05 \ (0.2\ \text{m})$$
<p>over 36 500 expert moments (16 runs, with the commands perturbed) and 23 400 DAgger moments (states the policy reached itself, labelled by the expert). In the loop the candidates are $e \oplus 4\,\mu_k$: each candidate's points, scaled back to metres and carried from the robot frame into the map at the estimate $e$. They are tried in the order of $\pi_k$. The policy is replanned every 0.5 s, and the tracker follows the result.</p>
<p><b>Where it comes from.</b> Pomerleau's ALVINN (1989) was the first of these policies. The compounding-error argument is from Ross and Bagnell (2010), and DAgger from Ross, Gordon and Bagnell (2011). Noise injection appears as DART in Laskey et al. (2017). Several scored trajectories instead of one come from the multiple-trajectory prediction of Cui et al. (2019) and from the mixture density network of Bishop (1994). The data pipeline is the lab's own. A Node collector runs the headless core, PyTorch trains the network, the weights are stored as JSON, and the page runs the forward pass in plain JavaScript. <a class="chref" href="#notes=ch4/11-an-end-to-end-policy">The features, the remedies, the safety layer and the measured table: chapter 4 §11</a></p>
<p><b>What the lab does.</b> Plan → Learned policy (end-to-end) turns it on. The candidates the robot does not take are drawn faint on the map, in rose where they run into the inflation. The Plan tab describes the policy and counts how many times a lower-scored candidate was taken. It also counts what the safety layer did: waypoints moved, segments rerouted, paths cut and fallbacks to A*. It offers the subgoal mode, in which the policy is pointed at a point 3 m along the A* route instead of at the goal. The policy that ships with the page was trained on L1, L2 and L4, with random goals, scripted and perturbed. It never saw L3 or L5. Tools → Train trains another policy in the page, on the levels, on maps of your own or on random obstacles, with DAgger rounds in which the policy drives. Policy model in this tab selects it. All numbers below are at seed 7, against A* on the same run.</p>

## Try: The open floor, where it works
cfg: {"sim":true,"level":0,"set":{"plan":"policy"},"tab":"plan"}
Setup: L1, the open floor the policy was trained on, with the level's four goals. Plan tab.
See: The robot reaches all four goals in 44.8 m, the same as A*, with no collision. The path on the map bends around the pillars as A*'s did. A lower-scored candidate is taken once, and the safety layer never acts. The faint lines are the other three candidates, mostly near copies of the one taken.
Shows: Where the demonstrations cover the situations the robot meets, imitation works. The path is a learned function of the scan, with no grid and no search, and each plan takes a tenth of a millisecond. Watch the eight points refresh every half second.
Predict: The policy on the open floor it was trained on, four goals among the pillars. Goals out of four?
- All four, no collision, in about the distance A* drives
- Two or three: it cuts a pillar now and then
- None: a function of the scan, with no map and no search, cannot find its way to a goal
Answer: 0

## Try: A floor it never saw
cfg: {"sim":true,"level":4,"set":{"plan":"policy","spd":"st"},"tab":"plan"}
Setup: L5 with the speed planner, and the policy as the global planner.
See: The robot reaches all five goals in 84 m and 124 s, with no collision with a shelf. There is one contact with a person while moving, and A* with the same speed planner has one too on this run (five goals, 84 m). A lower-scored candidate is taken 24 times, because the best one runs into a shelf's inflation, and twice the robot falls back to A*. The earlier single-path policy, which had neither, clipped two shelves here and gave up a goal.
Shows: The policy generalizes to a new floor of the same kind. The scan features are local, and wide aisles with shelves look like the floors it learned from, so it drives. At the corners the single-path policy used to clip, a second candidate, going the other way round the shelf end, is taken instead. The policy leaves the people to the speed planner. In this modular design the learned block does one job. The results vary from run to run. On seeds 2 to 5 the same experiment reaches all five goals without touching a shelf. On seed 1 the particle filter loses the robot and the run reaches one goal in 150 s. That is a localization failure, and it costs A* goals on that seed too.
Predict: The busy floor, L5, which the policy never saw, with the speed planner handling the people. Goals?
- All five, like A*: its aisles look like the training levels, and the people are the speed planner's job
- None: a level it has not seen is out of the question
- Two or three: it clips a shelf corner in most aisles
Answer: 0

## Try: The warehouse aisles
cfg: {"sim":true,"level":1,"set":{"plan":"policy"},"tab":"plan"}
Setup: L2, one of the training levels, with the policy as the planner.
See: The robot passes the first shelf end at 4 s and reaches the first goal at 20 s. On the way to goal 2 it touches a shelf at 43 s and again at 57 s, and goal 2 is given up at 76 s. Goals 3 and 4 follow at 106 s and 143 s. That is three goals of four in 80 m, with two collisions; A* reaches all four in 59 m. The Plan tab counts 58 lower-scored candidates taken, 82 waypoints moved, 6 segments rerouted, 43 paths cut and 38 fallbacks to A*. Around goal 2, no candidate is clear for long stretches, and the classical layer drives.
Shows: This run shows the failure the policy used to have, and the fix. From some states the demonstrations went left of a shelf end, and from almost the same states they went right. A single least-squares path is their average, which goes through the shelf. The old single-path policy collided at the first shelf end at 4 s, every time, and reached no goal. With four candidates, the two sides stay two separate answers. The score says which side the expert took more often, and the costmap check takes the other side when the first is blocked. One case remains that no candidate covers. When the robot is in the inflation and every candidate points into the shelf, a policy without memory keeps asking for the same thing. The A* fallback gets the robot out, and then the policy points it back. The counts show how often that happens.
Predict: L2, the warehouse aisles it was trained on. Goals out of four?
- Three or four: the aisles need a side picked at every shelf end, which the candidates can do
- None or one: the narrow aisles are where a corner clipped is a collision
- All four, as directly as A*
Answer: 0

## Try: A classical subgoal
cfg: {"sim":true,"level":1,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}
Setup: L2 with the hybrid. A* finds the route, and the policy drives towards the point 3 m along it.
See: The robot reaches all four goals in 58 m with no collision, as short as A*'s 59. A lower-scored candidate is taken eleven times, and the safety layer acts once. The single-path policy reached one goal here and collided twice, because its averaged path still cut the shelf end on the way to the subgoal.
Shows: The two remedies fix different failures, and here both are needed. The subgoal fixes the long-range failure, where a goal behind a shelf points a reactive policy at the shelf. The candidates fix the local failure, the averaged corner. With either alone, the robot gets pinned somewhere. With both, it drives the aisles as well as the classical stack. On seeds 1 to 5 the result is the same, four of four with no collision.
Predict: Point the policy at a subgoal 3 m along the A* route instead of the goal. Goals?
- All four, cleanly: with the long-range part taken away, the candidates only have to pick a side of each shelf
- Hardly: one goal at most; the failure is the first metre of each corner, not the long-range direction
- Worse: two planners fight
Answer: 0

## Try: The building
cfg: {"sim":true,"level":3,"set":{"plan":"policy"},"tab":"plan"}
Setup: L4 with lidar mapping, and the policy as the planner.
See: The robot reaches one goal of four, at 17 s, and collides once, at 39 s. The other goals are given up after it gets stuck at doorways. A* reaches four in 50 m. The Plan tab's counts climb to 125 waypoints moved, 50 paths cut and 12 fallbacks to A*, as the safety layer works against a wall that all the candidates point at.
Shows: Rooms are the hardest case for a local policy. The goal is behind a wall, the way out is a door that cannot be seen in the direction of the goal, and passages through doors are a small share of the data. All four candidates point at the wall, because the scan does not say which door leads to the goal. At this point research adds memory (recurrent policies, or maps as inputs), far more data, and reinforcement learning on top of imitation. The lab adds the cheapest fix, a route from a planner that has the map.
Predict: L4, the building with rooms and doors, with the policy pointed at the goal. Goals?
- One or none: a goal behind a wall points the policy at the wall, and more candidates do not change where the goal is
- Three or four: doors are wider than aisles
- All four: it was trained there
Answer: 0

## Try: The building with a subgoal
cfg: {"sim":true,"level":3,"set":{"plan":"policy","policyGoal":"subgoal"},"tab":"plan"}
Setup: L4 with lidar mapping and the hybrid. A* finds the route through the doors, and the policy drives towards the point 3 m along it.
See: The robot reaches all four goals in 51 m and 73 s with no collision, as A* does. The single-path policy reached none here and collided four times. On seeds 1 to 5 the result is the same, four of four with no collision.
Shows: Learned navigation stacks usually divide the work this way. A classical planner over a map decides where to go, a learned local policy decides how to drive there, and a classical check surrounds the learned part. On this floor the policy alone reaches one goal, and the hybrid reaches all of them.
Predict: Point the policy at the subgoal here. Goals?
- All four: the route through the doors is the planner's, and the candidates only have to drive it
- One or none, as before: doors are corners twice over
- Two: the near rooms only
Answer: 0

## Code: policyPlan, the forward pass, the candidates and the safety layer
snippet: policy
focus: const y = mlpForward(M, policyFeatures(S.scan, e, target, S.odo)),
focus: pick = held && clear[0].p <= 2 * held.p ? held : clear[0];
focus: const f = k >= 0 ? nearestFree(k, POLICY_CLEAR) : -1;
example: plan/astar
Note: policyFeatures builds the 139 inputs. The collector calls the same function, so training and page always compute the same features. mlpForward is three dense layers in nn.js, and the candidates come out of its one output vector: four scores, then four paths. The second marked line chooses among the candidates whose points and segments clear the costmap by POLICY_CLEAR. It takes the best-scoring one, or the one nearest the path being driven unless the best is more than twice as likely. The loop at the last marked line is the safety layer for when no candidate is clear. policyShield, below it, holds the segment check and the A* fallback. The subgoal mode, above them, runs A* and takes the point 3 m along the route. In Edit and run, the A* example is the expert the policy was cloned from.

## Think about
Q: Offline, on a held-out run, the best-scoring candidate's eighth point is 1.64 m from the expert's route. That is no better than the single least-squares path's 1.68 m. The best of the four candidates is 0.51 m off. Yet the four candidates take L2 from no goal to three. Why does the offline error not predict the drive?
A: Least squares gives the best single guess on average, and the mixture does not try to. Where the expert went either way, the average is off by half the gap every time, and it drives into the shelf. The best-scoring candidate is right when the expert took its side and fully wrong when the expert took the other, which gives a similar mean error. What decides the drive is whether some candidate lies on a side the robot can take. The best-of-four error, 0.51 m, says that one usually does, and the costmap check picks it. The test set also holds only the expert's states. The drive visits the policy's own states, where each small error moves the robot to a state no demonstration showed. DAgger is meant for that, but in the lab two rounds of it did not rescue the aisles. The limit was the averaged target, not the data.
Q: What did the learned detector of the perception group have that this policy does not?
A: It had a local, well-posed target, one that its inputs determine. Whether a beam's hit is on a person depends on a few neighbouring beams and on how well the map explains them, so a small convolution learns it from forty thousand scans. A path depends on the whole scan, on the goal and on the room beyond the scan, and the demonstrations could have gone either way around an obstacle. The mixture loss makes the path target well-posed in one respect, because two sides become two answers. The room beyond the scan is still unknown, so the building still needs the subgoal. Modular learning chooses targets like the detector's. End-to-end learning has to take the path target as it comes.
Q: The page takes a candidate that clears the costmap, and when none does, moves waypoints, reroutes segments with A* and hands a pinned robot to A*. Is that still end-to-end?
A: No, and no learned planner in service is end-to-end in that sense. There is always a classical shield: a velocity limit, a collision check, a stop. With several candidates, the shield can choose between them instead of only vetoing one, and so it helps far more. The lab's policy is best described as a learned proposal inside classical bounds. The measured result is what the proposals and the bounds achieve together, and the Plan tab's counts show how often the bounds had to act. For any learned stack, ask where the shield ends and the learning begins.

## Check yourself
Q: The policy's two hidden layers have 256 units, the input 139 numbers, and the output four scores and four paths of eight points. How many parameters do the three dense layers hold, weights and biases?
Answer: 119108
Tolerance: 0
Unit: parameters
How: The output is $4 + 4 \times 16 = 68$ numbers. $139 \times 256 + 256 = 35\,840$; $256 \times 256 + 256 = 65\,792$; $256 \times 68 + 68 = 17\,476$; in all $119\,108$
