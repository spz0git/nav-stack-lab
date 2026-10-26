group: loc
title: Pose-graph SLAM: the map that closes the loop

<p><b>Why this matters.</b> Lesson 5 put the map into the filter's state and lesson 7 matched scans against a map somebody had made. The realistic case has neither: a robot in a building it has never seen, no beacons, wheel odometry that drifts, and a lidar. It must build the map and localize in it at the same time, and the map it builds is only as good as the poses it was built from. Every modern lidar SLAM (Cartographer, SLAM Toolbox, the LOAM family) is a pose graph: a chain of keyframe poses, each carrying a scan, joined by what the odometry said and by what the scans say when the robot comes back to a place it has seen. Optimizing the graph moves every past pose at once, and the map, rebuilt from them, snaps into shape. This lesson builds that machine in the lab and measures where the accuracy actually comes from.</p>
<p><b>The idea.</b> Two levels. Locally, every half metre a <i>keyframe</i> is born: the pose, its scan, and an edge to the previous keyframe carrying the relative motion. Before the edge is written, the scan is aligned to the map the keyframes have built so far (the Gauss–Newton matcher of lesson 7, against a hit map of the earlier scans) and fused with the odometry, so the edge carries the matched motion rather than the raw one. Globally, when a keyframe lands near one at least ten back, their two scans are aligned by ICP, and a good fit becomes a <i>loop closure</i>: an edge saying "these two poses are 1.3 m apart, not the 2 m the chain claims". Then the whole chain is re-optimized: the first pose is held, every other one moves to make all the edges as consistent as they can be, and the occupancy grid is rebuilt from the scans at the new poses.</p>
<p>The nodes are the keyframe poses $x_i = (x, y, \theta)_i$. An edge $(i, j, z, \Omega)$ says "$j$ seen from $i$ is at $z$"; its error and the cost of the whole graph are</p>
$$e_{ij} = z^{-1} \oplus (x_i^{-1} \oplus x_j) \qquad\qquad F(x) = \sum e_{ij}^\top \Omega_{ij}\, e_{ij}$$
<p>and Gauss–Newton solves for all the poses at once, with $x_0$ fixed:</p>
$$H\delta = -b, \qquad H = \sum J_{ij}^\top \Omega_{ij} J_{ij}, \qquad b = \sum J_{ij}^\top \Omega_{ij}\, e_{ij}$$
<p>An ICP step pairs each point with its nearest, then solves for the rotation and the translation in closed form:</p>
$$\theta = \operatorname{atan2}(M_{10} - M_{01},\ M_{00} + M_{11}), \qquad M = \sum (q - \bar q)(p - \bar p)^\top, \qquad t = \bar q - R\,\bar p$$
<p>The current pose is $x_\text{last} \oplus$ (odometry since); its covariance is the last keyframe's marginal, a block of $H^{-1}$, plus the odometry's.</p>
<p><b>Where it comes from.</b> The error of an edge is the mismatch between the relative pose the chain implies and the one the edge measured; its Jacobians to the two poses are those of the relative-pose function, and the normal equations sum each edge's contribution into the $3 \times 3$ blocks of the two poses it joins. The first pose has to be fixed because a map can slide and turn as a whole without changing any edge. The ICP step is the closed form of the best rigid alignment of paired points. <a class="chref" href="#notes=ch2/11-pose-graph-slam-the-map-as-a-set-of-constraints">The Jacobians, the sparse structure, the gauge, the marginal covariance and the measured runs: chapter 2 §11</a></p>
<p><b>What the lab does.</b> Localize → Pose-graph SLAM, lidar only (the beacons are ignored). The Pose graph layer draws the keyframes, their chain and the loop closures in the accent colour; the Localize tab counts keyframes, matched ones and closures, and reports the last closure and optimization; Signals has the loop closures and the map agreement, the share of known cells that agree with the true map. Two switches isolate the levels: scan-to-map matching at every keyframe, and loop closures. The experiments drive L4's four goals and back, 7 goals and about 100 m, at seed 7 over 200 s, with the Try's own goal list.</p>

## Try: Dead reckoning builds a smeared map
cfg: {"sim":true,"level":3,"set":{"loc":"dr"},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}
Setup: L4, lidar mapping with dead reckoning on its noisy, biased wheel odometry, the out-and-back tour.
See: The error is 2.5 m by 50 s and 3.7 m at the far end; the map, built in the drifting frame, agrees with the building on 86 % of its known cells and the second pass draws the same walls a few metres from the first. Five of the seven goals are skipped as unreachable in the smeared map; two are reached.
Shows: Mapping is only as good as localization, and with wheels alone neither holds up for a hundred metres. Everything that follows is about getting the poses right so that the map is. The details change with the seed (on seeds 1 to 5 the error peaks between 5 and 9 m and two to four goals are skipped), the smeared map does not: it agrees on 87 to 89 % every time.
Predict: Dead reckoning on the wheel odometry builds the map from its own drifting poses. What does the 100 m tour leave behind?
- A clean map: the lidar sees the walls, whatever the pose
- A smeared map with walls drawn twice, and goals skipped as unreachable
- No map at all: mapping needs SLAM
Answer: 1

## Try: Pose-graph SLAM on wheel odometry
cfg: {"sim":true,"level":3,"set":{"loc":"pgslam"},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}
Setup: The same tour with pose-graph SLAM, both levels on. Pose graph layer on.
See: 199 keyframes, 187 of them placed by a scan-to-map match, 85 loop closures. The pose error along the tour:
| Where the robot is | Time | Error (m) |
|---|---|---|
| the far end, in rooms it has never seen | 75 s | 0.6 |
| on the way back, closing loops onto the outbound keyframes | around 110 s | about 0.1 |
| back at the start, after the last stretch | the end | 0.33 |
Look at the drop on the way back: 54 of the 85 closures join keyframes more than 40 apart, and on the last stretch to the start the error rises again. The run reaches all seven goals with one contact, at 93 s, and the map agrees on 93 %. Pose RMS 0.33 m against 1.97 m for dead reckoning. The biggest optimization, 199 poses, takes about a tenth of a second.
Shows: The pattern of every SLAM run: error grows in new territory and collapses on a revisit. What the closures fix is the past: the optimization moves the far-end keyframes by the drift they carried, and the map rebuilt from them stops showing double walls. What they cannot fix is the offset of the whole far region relative to the start, which no edge measures; only the return constrains it. How large the far-end error gets changes from run to run: on seeds 1 to 5 it peaks between 0.3 and 3.5 m, and on seed 3 a contact strands the robot before the return, so there is no revisit to correct it.
Predict: Switch to pose-graph SLAM on the same odometry. Where does the error peak?
- At the far end of the tour, before the way back closes any loop onto the outbound keyframes
- At the very end: the closures accumulate error
- Nowhere: the lidar removes it as it goes
Answer: 0

## Try: Loop closures alone
cfg: {"sim":true,"level":3,"set":{"loc":"pgslam","pgMatch":false},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}
Setup: Odometry edges straight from the wheels, loop closures by ICP only, no scan-to-map matching: the textbook pose graph.
See: The error is 0.9 m at 20 s, 2.3 m at 60 s and 2.8 m from 64 s on. The graph finds 13 closures: twelve between 19 and 27 s, while the robot drives back past keyframes it laid down ten seconds earlier and the drift is still under a metre, and one more near the far end at 69 s. With the estimate almost 3 m off, the robot hits an obstacle at 70 s near the far end and never gets clear of it, backing off and replanning six times from a pose 2.6 m off. It skips the three goals of the way back: it never drives the return, so no outbound keyframe is ever revisited. Four goals, three skipped, one contact, map 89 %.
Shows: A loop closure needs a place to come back to and an initial guess within the matcher's reach. Here the closures come only where the drift is still small; by the far end wheel odometry alone has drifted almost 3 m, which is well past ICP's half metre, and in this run that drift also drives the robot into an obstacle before the return could test it. A closure that is not found cannot correct anything. The graph is the global half of lidar SLAM; it needs a local half that keeps the drift small between revisits, which is the scan-to-map matching, or a better odometry. How far the drift gets before the closures stop changes from run to run: on seed 2 it stays small and the closures hold the whole tour (63 of them, 0.25 m RMS), on seeds 1, 3 and 4 a contact strands the robot early, and on seed 5 the error reaches 3.6 m on the way back.
Predict: Turn scan-to-map matching off and keep only the odometry edges and the loop closures. Can the closures alone keep the error small on wheel odometry?
- Always: the closures find every revisit, whatever the drift
- Only while the drift stays within ICP's reach; past that no closure is found and the error grows
- Never: a closure does not change the estimate
Answer: 1

## Try: Loop closures alone, with the gyro
cfg: {"sim":true,"level":3,"set":{"loc":"pgslam","pgMatch":false,"gyro":true},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}
Setup: Odometry edges from wheels and gyro, loop closures only.
See: 82 closures, error 0.10 to 0.27 m for the whole run, RMS 0.19 m, all seven goals, map 94 %. Dead reckoning with the gyro and no SLAM at all: RMS 0.23 m, map 93.5 %.
Shows: With odometry good enough for the closures to be found, the textbook graph works, and it holds the error at the level of the odometry drift between revisits. The gyro alone already does nearly as well on this tour, which is the honest finding: the closures add consistency of the past poses, not much accuracy of the present one.
Predict: Now give the same loop-closure-only graph the gyro's odometry. What does the error do?
- Stays within a few tenths of a metre: the drift stays inside ICP's reach and the closures hold it
- Still metres off: closures do not depend on the odometry
- Grows: the gyro's bias is fused twice
Answer: 0

## Try: Both levels, with the gyro
cfg: {"sim":true,"level":3,"set":{"loc":"pgslam","gyro":true},"goals":[[5,13],[13.5,14],[21,13],[22.5,5.5],[21,13],[13.5,14],[5,13]],"tab":"loc","plot":"pos"}
Setup: Scan-to-map matching and loop closures, wheels and gyro.
See: Pose RMS 0.12 m, never worse than 0.22 m, 84 closures, map agreement 95 % at the end (96 to 97 % on the way out): within a point of the 96 % the EKF with its beacons builds, with no beacons at all. Scan-to-map matching without any loop closures (Localize → switch them off) does as well: RMS 0.12 m, map 96 %.
Shows: This is a working lidar SLAM: a gyro-grade odometry to stay inside the matcher's reach, scan-to-map matching to remove the drift at every keyframe, loop closures to make the past consistent. On a building this size the matcher does all the work these numbers can see: with the closures switched off neither the pose RMS nor the map gets worse. The graph earns its keep on longer excursions, where the matcher's own reference has drifted (the last question below). The pose RMS on seeds 1 to 5 runs from 0.07 to 0.20 m, below the closures-only graph's wherever the robot drives the whole tour.
Predict: Turn scan-to-map matching back on, with the gyro. How does the pose RMS compare with the closures-only run?
- Lower: the matcher removes most of the drift between closures
- The same: the matcher cannot beat the gyro
- Higher: two corrections fight
Answer: 0

## Try: Explore and map, with nobody steering
cfg: {"sim":true,"level":3,"set":{"loc":"pgslam","gyro":true,"mis":"explore"},"tab":"loc","plot":"pos"}
Setup: Frontier exploration (lesson 6 of planning) with pose-graph SLAM and the gyro: the robot picks its own goals and builds its own map.
See: 192 keyframes, 181 matched, 37 closures, pose RMS 0.10 m, map agreement 96 % when the exploration ends at 119 s with the whole floor seen. One contact at 101 s, on the way to the last frontier.
Shows: The whole classical stack, end to end, with no map, no beacons and no goals given: perception builds the map, SLAM keeps it consistent, exploration decides where to look, planning and tracking get there. What the modern stacks add on top of this is a smoother that keeps the graph small, place recognition for closures the odometry cannot guess, and a map representation richer than a grid.
Predict: Let frontier exploration pick the goals with this SLAM. How good is the map it builds by itself?
- About as good: 96 % agreement, with no goal given
- Worse: exploration drives into unknown rooms, where there is nothing to match
- It fails: the explorer and the SLAM fight over the map
Answer: 0

## Code: pgOptimize, the normal equations of a graph
snippet: pg-optimize
focus: const A = [-RzRi[0], -RzRi[1], cz * dRx + sz * dRy, -RzRi[2], -RzRi[3], -sz * dRx + cz * dRy, 0, 0, -1], … B = [RzRi[0], RzRi[1], 0, RzRi[2], RzRi[3], 0, 0, 0, 1];
focus: for (let r = 0; r < 3; r++) H[r * n + r] += 1e6; // the first pose is the anchor
Note: $A$ and $B$ are an edge's Jacobians to its two poses; the loop after them adds $A^\top\Omega A$, $A^\top\Omega B$, $B^\top\Omega B$ and $A^\top\Omega e$, $B^\top\Omega e$ into the blocks of $H$ and $b$ that belong to those poses, which is why $H$ is sparse. The anchor line is the gauge. The ICP step is icp2d above it, the keyframes and closures pgLidar, the marginal covariance pgMarginal; no slot runs a pose graph.

## Think about
Q: The first pose is held with a huge prior. What goes wrong without it?
A: $H$ is singular: moving every pose by the same shift and turn changes no edge, so three directions of $\delta$ have zero cost and the solve has no answer. Any one pose can be the anchor; the map is then expressed in that pose's frame, which is why SLAM maps are consistent but not aligned to anything outside them unless a known pose or a GPS fix is added as another edge.
Q: Loop closures alone on wheel odometry found thirteen closures, twelve of them in the first half-minute, and then almost none. Why?
A: Candidates are chosen by the chain's own estimate of where the keyframes are, and ICP converges only from a guess within half a metre or so. Early on the robot drives back past keyframes it laid down seconds before: close in the chain and in the world, with the drift still under a metre, so the guess is good. After that it is in rooms it has not seen, where there is nothing to close onto, and by the far end the chain is almost 3 m off; a return would have had to find the outbound keyframes from a guess that far wrong. Real systems add place recognition that proposes closures from the scan's appearance regardless of the pose estimate.
Q: Scan-to-map matching without any loop closure did as well as the full method on this tour. When would the graph matter more?
A: When the robot is away from mapped space for long enough that the matcher's reference is itself drifted: a long corridor out to a far wing and back, where the return finds the outbound map rotated by the drift. The matcher then aligns to a wrong reference, consistently; only a closure, which compares two scans directly, exposes the inconsistency, and only the optimization fixes the past poses and the map built from them.

## Check yourself
Q: A graph of 199 keyframes has three unknowns per pose. With the first pose fixed, how many unknowns does the optimization solve for?
Answer: 594
Tolerance: 0
Unit: unknowns
How: $3 \times 199 = 597$ in all; fixing the first pose removes its three, leaving 594 (the lab keeps them and adds a huge prior instead, which comes to the same)
