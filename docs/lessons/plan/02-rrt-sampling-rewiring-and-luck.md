group: plan
title: RRT*: sampling, rewiring, and luck

<p><b>Why this matters.</b> Grids stop working when the state has more than a few dimensions: a 7-joint arm, a car with heading and speed, a drone. Sampling-based planners replaced them there, and RRT* is the one with a proof: it is asymptotically optimal, meaning that as the number of samples grows without limit its path converges to the optimum. What the proof does not say, and what this lesson shows, is how far from the optimum a finite budget leaves you, and how much of the answer is luck.</p>
<p><b>The idea.</b> Grow a tree from the start. Each iteration draws a random point (the goal itself one time in ten), steps 0.6 m from the nearest tree node toward it, and, if the step is collision-free, connects the new node to the cheapest nearby parent rather than simply the nearest. Then it rewires: any neighbour that would be cheaper to reach through the new node is re-parented to it. The neighbourhood shrinks as the tree grows, so the work per iteration stays logarithmic while the tree keeps improving. After the budget is spent, the best node within a metre of the goal is connected to it and the path is read back through the parents.</p>
$$r = \min\Bigl(8\sqrt{\frac{\log n}{n}},\ 1.5\ \text{m}\Bigr)$$
<p><b>Where it comes from.</b> The proof of asymptotic optimality needs the neighbourhood radius to shrink no faster than $\gamma\sqrt{\log n / n}$ with $\gamma$ above a constant set by the free area; then the expected number of neighbours grows like $\log n$, enough for rewiring to keep finding improvements, and the cost converges to the optimum with probability one. The lab's $\gamma = 8$ is below the theoretical constant for this floor (about 22), which is common practice: the condition is sufficient, not necessary, and a theoretical $\gamma$ would make every iteration examine most of the tree. <a class="chref" href="#notes=ch4/3-rrt-planning-by-sampling">Derivation: chapter 4 §3</a></p>
<p><b>What the lab does.</b> The sample budget is the Plan tab's RRT* samples slider (300 to 4000, 1500 by default). Segments are checked against the costmap at 0.45 m clearance (lethal plus 0.05). The search layer draws the tree; the event log reports the path length, the number of nodes that made it into the tree (rejected samples do not), and the time. The random stream is seeded, so the same seed gives the same tree, and the Next seed button advances it.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses: the chip under the map plays the search one expansion at a time (◀ ▶ step, ▷ plays, the slider scrubs), with the newest node in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: RRT*
cfg: {"sim":true,"level":1,"set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L2 with RRT* at 1500 samples and the default seed; search layer on.
See: A tree of about 870 nodes fans out over the floor in about 10 ms or less, and the first leg comes out at 8.3 m, next to A*'s 8.6 m. The later legs are 12.7, 17.7 and 25.5 m against A*'s 13.0, 12.9 and 26.1; the third leg is 37 % longer because the tree committed to the far aisle. The mission completes in 81 s against 78 s for A*.
Shows: Sampling found the near-optimal route three times out of four and a clearly worse one once, in the same run, with the same settings. The path through the tree is only as good as the samples that happened to fall in the right aisle early; rewiring improves connections inside the radius, but it cannot move a subtree to a different aisle once the tree has grown past it.
Predict: RRT* with 1500 samples on the warehouse: how will its four legs compare with A*'s?
- All four within a few percent of A*
- All noticeably longer: sampling never matches a grid
- Most near A*, but at least one leg clearly longer
Answer: 2

## Try: RRT*, next seed
cfg: {"sim":true,"level":1,"seed":"next","set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The same planner and budget with the next random seed.
See: The first leg is 8.8 m, the second 19.8 m (A*: 13.0), the third 18.8 m (A*: 12.9), and the mission takes 90 s instead of 81. Across ten seeds the first leg alone ranges from 8.3 to 15.3 m: half the seeds find the near aisle, half take the long way round.
Shows: This is the variance the grid planner does not have. Two runs that differ only in a random seed differ by 9 s of mission time and by 50 % on individual legs. Benchmarking a sampling planner on one seed measures the seed; the honest number is a distribution over seeds, which the Experiments tab can produce.
Predict: Same planner and budget, next random seed. How different will the mission be?
- Identical: the budget, not the seed, decides the path
- Within a second: the seed only moves the tree's details
- Noticeably different: some legs change by half
Answer: 2

## Try: RRT*, 4000 samples
cfg: {"sim":true,"level":1,"set":{"plan":"rrtstar","rrtIt":4000},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The budget raised to 4000 samples (about 2300 tree nodes), default seed.
See: The tree is denser and the legs are 14.9, 13.0, 12.7 and 25.5 m, mission 87 s. The long third leg is gone: 12.7 m against A*'s 12.9. But the first leg, 8.3 m at 1500 samples, now takes the long way round, and the mission is 6 s slower than at 1500. Across ten seeds the first leg finds the short route six times instead of five; at 300 samples it finds no connection to the goal at all four times in ten.
Shows: A larger budget grows a different tree, not a refined copy of the old one: the samples that decide which aisle each leg takes all change, so one leg converges while another loses the aisle it had. More samples shift the distribution, slowly: convergence is in the limit, and the limit is far. The cost per iteration grows with the tree, so 4000 samples take about three times as long as 1500 for a modest gain in reliability. On a 2-D floor with a known map, a grid planner is simply the better tool; RRT* earns its place where no grid is possible, and the variance comes with it.
Predict: Raise the budget from 1500 to 4000 samples on the same seed. What happens to the four legs?
- All four improve or stay: more samples can only refine the tree
- The long third leg converges to A*'s length, but another leg now takes the long way round
- Nothing changes: the seed, not the budget, decides the tree
Answer: 1

## Code: rrtstar, near nodes and rewiring
snippet: rrtstar
focus: rad = Math.min(gam * Math.sqrt(Math.log(n + 1) / (n + 1)), 1.5), … r2 = rad * rad;
focus: for (const i of near) { … Pa[i] = n;
example: plan/rrtstar
Note: The radius shrinks as the tree grows (the $\log n / n$ of the paper); the first loop over the near nodes picks the cheapest parent, the second rewires them through the new node. Edit and run: the RRT* example; delete the rewiring loop and you have plain RRT, and the path length shows it.

## Think about
Q: Why does the planner choose the cheapest parent in a radius rather than the nearest node?
A: Connecting to the nearest node is RRT, which converges to a feasible path but not to the optimal one; its paths wander. Choosing the parent that gives the lowest cost-to-come, and then rewiring the neighbours, is what makes RRT* improve the tree as it grows. Without the rewiring step the tree never corrects an early bad connection.
Q: The radius formula shrinks with n. What goes wrong if it is held fixed at 1.5 m?
A: Nothing in the limit, but every iteration then has to examine every node within 1.5 m, which grows linearly with the tree, so the cost per iteration grows with $n$ instead of with $\log n$. The shrinking radius is the compromise that keeps enough neighbours to converge and few enough to stay fast.
Q: Ten seeds give first legs between 8.3 and 15.3 m. What single number would you report?
A: Not the mean. The median and the fraction of seeds within 10 % of the grid optimum say what a user will experience; the worst case says what a safety argument needs. Any one of them is better than the number from the seed you happened to run.

## Check yourself
Q: The tree holds $n = 800$ nodes. What is the rewiring radius $r = \min\bigl(8\sqrt{\ln n / n},\ 1.5\ \text{m}\bigr)$?
Answer: 0.731
Tolerance: 0.015
Unit: m
How: $\ln 800 = 6.685$; $6.685/800 = 0.008356$; $\sqrt{0.008356} = 0.0914$; $\times\, 8 = 0.73$ m, below the 1.5 m cap
