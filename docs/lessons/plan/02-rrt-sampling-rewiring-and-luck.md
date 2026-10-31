group: plan
title: RRT*: sampling, rewiring, and luck

<p><b>Why this matters.</b> A grid stops being practical when the state has more than a few dimensions, as for an arm with 7 joints, a car whose state includes its heading and speed, or a drone. The grid then has far too many cells to search. Sampling-based planners took over for these problems. RRT* is one with a proof: it is asymptotically optimal, which means that its path converges to the optimum as the number of samples grows without limit. The proof does not say how far from the optimum a finite budget of samples leaves you, or how much of the result depends on luck. This lesson measures both.</p>
<p><b>The idea.</b> RRT* grows a tree from the start. Each iteration draws a random point, and one time in ten the point is the goal itself. The planner takes the tree node nearest to that point and steps 0.6 m from it towards the point. If the step is free of collisions, a new node goes at its end. The new node is connected to the nearby parent that gives it the cheapest path from the start, which need not be the nearest node. Then the planner rewires: any neighbour that would be cheaper to reach through the new node gets the new node as its parent. The neighbourhood shrinks as the tree grows, so the work per iteration grows only with the logarithm of the tree's size, and the tree keeps improving. When the budget is spent, the best node within a metre of the goal is connected to it, and the path is read back through the parents.</p>
$$r = \min\Bigl(8\sqrt{\frac{\log n}{n}},\ 1.5\ \text{m}\Bigr)$$
<p><b>Where it comes from.</b> The proof of asymptotic optimality needs the neighbourhood radius to shrink no faster than $\gamma\sqrt{\log n / n}$, with $\gamma$ above a constant set by the free area. The expected number of neighbours then grows like $\log n$. That is enough for rewiring to keep finding improvements, and the cost converges to the optimum with probability one. The lab's $\gamma = 8$ is below the theoretical constant for this floor, which is about 22. Planners commonly do this. The condition is sufficient but not necessary, and with the theoretical $\gamma$ every iteration would examine most of the tree. <a class="chref" href="#notes=ch4/3-rrt-planning-by-sampling">Derivation: chapter 4 §3</a></p>
<p><b>What the lab does.</b> The sample budget is set by the RRT* samples slider in the Plan tab (300 to 4000, 1500 by default). Each segment is checked against the costmap for 0.45 m of clearance, which is 0.05 m more than the lethal distance. The search layer draws the tree. The event log reports the path length, the time, and the number of nodes in the tree, which leaves out the samples that were rejected. The random numbers come from a seeded stream, so the same seed gives the same tree. The Next seed button moves on to the next seed.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses. The chip under the map then plays the search one expansion at a time: ◀ and ▶ step, ▷ plays, and the slider scrubs. The newest node is drawn in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: RRT*
cfg: {"sim":true,"level":1,"set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L2 with RRT* at 1500 samples and the default seed, and the search layer on.
See: A tree of about 870 nodes spreads over the floor in about 10 ms or less. The first leg comes out at 8.3 m, against 8.6 m for A*. The later legs are 12.7, 17.7 and 25.5 m, against A*'s 13.0, 12.9 and 26.1. The third leg is 37 % longer, because the tree reached the goal through the far aisle. The mission completes in 81 s, against 78 s for A*.
Shows: In one run with one set of settings, sampling found a near-optimal route on three legs and a clearly worse one on the fourth. The path is only as good as the samples that happened to fall early in the right aisle. Rewiring improves the connections inside the radius. It cannot move a whole branch of the tree to a different aisle once the tree has grown past it.
Predict: RRT* with 1500 samples on the warehouse: how will its four legs compare with A*'s?
- All four within a few percent of A*
- All noticeably longer: sampling never matches a grid
- Most near A*, but at least one leg clearly longer
Answer: 2

## Try: RRT*, next seed
cfg: {"sim":true,"level":1,"seed":"next","set":{"plan":"rrtstar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The same planner and budget, with the next random seed.
See: The first leg is 8.8 m, the second 19.8 m (A*: 13.0), the third 18.8 m (A*: 12.9), and the mission takes 90 s instead of 81. Over ten seeds, the first leg alone ranges from 8.3 to 15.3 m. Half the seeds find the near aisle, and the other half take the long way round.
Shows: The grid planner has no such variance. Two runs that differ only in the random seed differ by 9 s in mission time and by 50 % on single legs. A benchmark of a sampling planner on one seed tells you about that seed. To describe the planner, report the distribution over many seeds, which the Experiments tab can produce.
Predict: Same planner and budget, next random seed. How different will the mission be?
- Identical: the budget, not the seed, decides the path
- Within a second: the seed only moves the tree's details
- Noticeably different: some legs change by half
Answer: 2

## Try: RRT*, 4000 samples
cfg: {"sim":true,"level":1,"set":{"plan":"rrtstar","rrtIt":4000},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: The budget is raised to 4000 samples (about 2300 tree nodes), at the default seed.
See: The tree is denser. The legs are 14.9, 13.0, 12.7 and 25.5 m, and the mission takes 87 s. The long third leg is gone, at 12.7 m against A*'s 12.9. But the first leg, 8.3 m at 1500 samples, now takes the long way round, and the mission is 6 s slower than at 1500. Over ten seeds, the first leg finds the short route six times instead of five. At 300 samples, the first leg finds no connection to the goal at all on four seeds in ten.
Shows: A larger budget grows a different tree; it does not refine the old one. The samples that decide which aisle each leg takes are all different, so one leg converges while another loses the aisle it had. More samples move the spread of path lengths towards the optimum, but slowly, because convergence is only promised in the limit. The cost per iteration grows with the tree, so 4000 samples take about three times as long as 1500, for a modest gain in reliability. On a 2-D floor with a known map, a grid planner is the better tool. RRT* is worth using where no grid is possible, and there you have to live with the variance.
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
Note: The radius shrinks as the tree grows (the $\log n / n$ of the paper). The first loop over the near nodes picks the cheapest parent. The second loop rewires the near nodes through the new node. In Edit and run, open the RRT* example and delete the rewiring loop. What is left is plain RRT, and the path length in the event log shows the difference.

## Think about
Q: Why does the planner choose the cheapest parent in a radius rather than the nearest node?
A: Connecting to the nearest node is plain RRT. It finds a feasible path but does not converge to the optimal one, and its paths wander. RRT* picks the parent that gives the lowest cost-to-come (the cost of the path from the start), and then rewires the neighbours. These two steps let it improve the tree as it grows. Without the rewiring step, the tree never corrects a bad connection made early.
Q: The radius formula shrinks with n. What goes wrong if it is held fixed at 1.5 m?
A: Nothing in the limit. But every iteration then has to examine every node within 1.5 m, and the number of those nodes grows linearly with the tree. The cost per iteration then grows with $n$ instead of with $\log n$. The shrinking radius keeps enough neighbours for the path to converge, and few enough for the planner to stay fast.
Q: Ten seeds give first legs between 8.3 and 15.3 m. What single number would you report?
A: Not the mean. The median, and the share of seeds within 10 % of the grid optimum, tell you what a user will experience. The worst case is what a safety argument needs. Any of these is better than the number from whichever seed you happened to run.

## Check yourself
Q: The tree holds $n = 800$ nodes. What is the rewiring radius $r = \min\bigl(8\sqrt{\ln n / n},\ 1.5\ \text{m}\bigr)$?
Answer: 0.731
Tolerance: 0.015
Unit: m
How: $\ln 800 = 6.685$; $6.685/800 = 0.008356$; $\sqrt{0.008356} = 0.0914$; $\times\, 8 = 0.73$ m, below the 1.5 m cap
