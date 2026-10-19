group: per
title: A learned detector: people from the shape and motion of the hits

<p><b>Why this matters.</b> Every detector in this lab so far has been a rule: a hit is a person when the map cannot explain it. That rule is only as good as its premise, that the map is right and the robot knows where it stands on it. Lesson 1 showed a map being built, where everything is unexplained, so everything is a person; a pose estimate that drifts or jumps does the same to a perfect map, because its walls land beside the walls the lidar sees. Real stacks replaced this rule with a learned one, and this lesson shows why. A small network looks at the scan and says, beam by beam, "this hit is on a person", weighing the shape of the hits (a short convex arc, half a metre wide), their motion (walls do not move when the robot's own motion is taken out) and the map's evidence, and it has learned from examples how far to trust each. This lesson trains such a detector on the simulator's own ground truth, runs it in the page, and measures it against the rule in the three situations where the rule's premise breaks, and in the one where it holds.</p>
<p><b>The idea.</b> The 120 beams are a ring of samples. A one-dimensional convolution slides a small filter around that ring, so that each beam's output depends on its neighbours (seven beams wide per layer, three layers deep, about seventeen beams in all), and the ring is closed: beam 119 is next to beam 0. Each beam carries seven numbers: its range, the range the previous scan would show from here if everything stood still (the previous scan moved by the odometry and re-binned by beam), their difference, whether the beam hit anything, the robot's speed and turn rate, and the map evidence $s$: how well the robot's map explains the hit, 1 on a mapped wall, 0 half a metre from anything mapped or on a cell the map has not settled yet. It is the rule's own test kept as a number instead of a verdict, so the network can overrule it. The network outputs one probability per beam; beams above 0.8 are clustered exactly as the rule's unexplained hits were, and a cluster of a person's size becomes a detection the Kalman tracker of lesson 3 consumes. Nothing downstream changes: the learned block is a drop-in for one stage.</p>
$$\begin{aligned} &\text{input} && x \in \mathbb{R}^{120 \times 7}:\ \ r/8,\ \ \tilde r_\text{prev}/8,\ \ \operatorname{clip}(r - \tilde r_\text{prev}, \pm 1),\ \ \text{hit},\ \ v/1.5,\ \ \omega/2,\ \ s \\ &\text{layers} && \operatorname{conv}(7 \to 24, k = 7)\ \text{ReLU} \cdot \operatorname{conv}(24 \to 24, k = 7)\ \text{ReLU} \\ & && \cdot\ \operatorname{conv}(24 \to 24, k = 5)\ \text{ReLU} \cdot \operatorname{conv}(24 \to 1, k = 1)\ \text{sigmoid} \\ &\text{loss} && \text{weighted binary cross-entropy, weight } \sqrt{(1 - \pi)/\pi} \text{ on the 4 \% of person beams} \\ &\text{decision} && p > 0.8, \ \text{clusters of a person's width} \end{aligned}$$
<p>Here $\tilde r_\text{prev}$ is the previous scan reprojected through the odometry; the convolutions pad circularly, and the network has 8 185 parameters. The detections are scored as</p>
$$\text{precision} = \frac{\text{true detections}}{\text{all detections}} \qquad \text{recall} = \frac{\text{true detections}}{\text{detectable people}}$$
<p>a person being detectable when a beam hits it, and a detection being compared with the people in the robot's own frame, so that a wrong pose estimate is not counted against the detector.</p>
<p><b>Where it comes from.</b> The convolution is the standard tool for a signal with local structure and no preferred position on the ring; the circular padding is the ring. The reprojection is the ego-motion compensation every scan-based detector does before it looks for motion. The map evidence is an input and not a mask: a mask (run the rule, let the network see only what is left) would inherit every failure of the rule, while an input is one cue among several. The training set is 43 000 scans from 36 headless runs on the two levels with people, scripted and reacting, labelled from the true poses and discs, under three map conditions in turn: the prior map, the map being built, and the prior map with the pose drifting on dead reckoning. Those last two are what teach the network when not to believe the map. The runs use seeds from 21 up, so every run in this lesson is one it has not seen. <a class="chref" href="#notes=ch3/9-a-learned-detector">The network, the training, the first version without the map and why it lost, the pipeline from simulator to page, and the measured table: chapter 3 §9</a></p>
<p><b>What the lab does.</b> Perceive → Agent tracking → Learned detector + Kalman. The weights ship in the page (69 KB) and the forward pass is a hundred lines of plain JavaScript in the simulation core; the lidar layer colours each hit rose when its probability is above the threshold. Per-target scan matching (the same tab) aligns a track's hits from one scan to the next by ICP and feeds the displacement to the Kalman filter as a velocity measurement; it works with either detector. Tools → Train retrains the detector in the page: collect scans on any level or a map of your own, train this shape or another, compare it with the built-in one on a run it has not seen, and pick it here under Detector model. The numbers below are L5 over 120 s with the speed planner, at seed 7 unless a Try says otherwise, measured per scan against the truth: detection precision and recall, the confirmed tracks Agent tracks shows in the metrics, and the RMS velocity error of the confirmed tracks against the person they sit on.</p>

## Try: The rule, with the prior map
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st"},"tab":"per"}
Setup: L5 with the prior map, the clustering detector of lesson 3 (hits the map cannot explain), the speed planner. Perceive tab.
See: 1 034 detections over the run, precision 0.92, recall 1.00; the tracks' velocity error 0.26 m/s RMS; one contact, four goals by 120 s. Agent tracks in the metrics shows one confirmed track most of the time and six at most, since the shelves hide most people.
Shows: With a good map and a good pose the rule is nearly perfect: a hit either lies on a wall or it does not. This is the standard the learned detector has to be measured against, and it is a high one.
Predict: Switch to lidar mapping, so the robot builds the map as it drives. What does the rule do?
- It drowns: phantom people on the walls the map has not settled yet, for the whole run
- Nothing changes: the walls are seen before any person
- It stops detecting: unknown space explains everything
Answer: 0

## Try: The rule, building its own map
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","per":"mapping"},"tab":"per"}
Setup: The same, with lidar mapping.
See: 8 214 detections, precision 0.07: almost every one is a wall cell the map has not settled yet (a cell counts as static only after enough hits). Recall stays 1.00 because the people are among the detections, but the tracker carries phantom tracks: Agent tracks reads about a dozen confirmed most of the time and up to 36, for four people, and the log's yields name agents numbered in the hundreds. The velocity error rises to 0.35 m/s and the speed planner yields to walls: three goals by 120 s instead of four.
Shows: The rule's weakness is its premise. "Unexplained by the map" means "not yet in the map" while the map is being built, and on a level the robot explores for the first time that is most of the level. No tuning of the settling threshold fixes this; it only moves the phantoms in time.
Predict: Now the learned detector, same run, lidar mapping. How many confirmed tracks will Agent tracks show most of the time?
- One or none, as with the rule and a good map: an unsettled cell is weak evidence, and the network falls back on the shape and motion of the hits
- About a dozen, as with the rule here: it reads the same unsettled map
- None: without a settled map it cannot call anything a person
Answer: 0

## Try: The learned detector, building its own map
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","per":"mapping"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: Perceive → Agent tracking → Learned detector, lidar mapping on. Lidar layer on: hits in rose are beams the network calls a person.
See: 966 detections, precision 0.74, recall 0.88, velocity error 0.31 m/s, four goals by 120 s, no contact; Agent tracks reads one confirmed most of the time, nine at most. Over seeds 2 to 5 precision is 0.51 to 0.82 and recall 0.88 to 0.93, against the rule's 0.04 to 0.07. Watch the colours: a person's arc of hits turns rose as they walk, a shelf end stays amber even before the map knows it; the misses are people seen edge-on at the far end of an aisle, a beam or two.
Shows: Ten times the precision of the rule on the same unsettled map. The network was trained on runs where the map was still being built, so it learned that a low evidence value means "not known yet", not "not a wall", and that the shape and motion decide then.
Predict: Back to the prior map, but the robot now localizes by dead reckoning: the wheels' noisy, biased odometry alone, so its pose estimate drifts by half a metre and more within a minute or two. What does the rule show?
- A crowd of phantom people on the walls, more than a dozen confirmed tracks, growing as the pose drifts
- The same as with a good pose: the map is still correct
- Fewer detections: a drifting robot drives more slowly
Answer: 0

## Try: The rule, the pose drifting
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","loc":"dr"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: L5 with the prior map and the rule, localization by dead reckoning (Localize → Dead reckoning).
See: 10 026 detections, precision 0.06, recall 1.00; Agent tracks reads 13 confirmed most of the time and 21 at most, for four people, and the speed planner keeps yielding to them. Over seeds 2 to 5 it is 15 to 18 confirmed most of the time, up to 32, precision 0.05 to 0.07. (No goal is reached by 120 s with either detector: dead reckoning loses the goals themselves; this Try is about what the detector sees.)
Shows: The map is perfect and the rule still drowns. The test "is there a wall within 0.25 m of this hit" is done at the estimated pose, and once that is off by more than 0.25 m every wall the lidar sees is beside the wall the map has. The rule cannot tell a person from a wall seen from the wrong place, because it never looks at the hits themselves.
Predict: The learned detector, the same drifting pose. How many confirmed tracks most of the time?
- One or none: a long straight run of hits that does not move is a wall wherever the map puts it
- More than a dozen, as with the rule: it reads the same misplaced map
- None at all, people included
Answer: 0

## Try: The learned detector, the pose drifting
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","loc":"dr"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The same drift, the learned detector. Lidar layer on.
See: 563 detections, precision 0.71, recall 0.65; Agent tracks reads none confirmed most of the time and three at most. Over seeds 2 to 5: precision 0.50 to 0.83, recall 0.82 to 0.86, one confirmed track most of the time and five at most, against the rule's 15 to 18. The walls stay amber while the robot's estimate slides away from them on the map.
Shows: Over ten times the precision of the rule. The map evidence says "unexplained" along every wall; the shape (long, straight, wider than a person) and the motion (none, once the robot's own is taken out) say "wall", and the network learned in the drift runs that the second pair wins when they disagree. That is the case for learned perception in one picture: the rule has one cue and fails when it fails; the network weighs several and degrades gently.
Predict: Back to the good pose, seed 12: the same level and settings as the first Try, at another seed. In this run the particle filter's estimate jumps by one to three metres for a few scans at a time (unlabelled beacons and clutter mislead it), and then recovers. What does the rule do during the jumps?
- Flashes of phantom tracks along the walls, a dozen or more at the worst moments
- Nothing: a few scans are too short to matter
- It loses the real people, but adds no phantoms
Answer: 0

## Try: The rule, when the particle filter slips
cfg: {"sim":true,"level":4,"seed":12,"set":{"agents":"lidar","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: L5 at seed 12, the level's own localization (a particle filter with unlabelled beacons), the prior map, the rule. Nothing is switched off: this is a natural failure.
See: 1 948 detections, precision 0.33, recall 0.99, velocity error 0.40 m/s; Agent tracks reads one confirmed most of the time but up to 18 during the jumps. Four goals by 120 s, all five at 161 s.
Shows: A localization glitch of a second is enough. This is the failure the rule meets on real robots more often than a missing map: the map is right, the estimate is briefly wrong, and every wall becomes a person for as long as it is wrong.
Predict: The learned detector on the same run. What changes?
- Far fewer phantoms: at most a handful of confirmed tracks during the jumps
- Nothing: both use the same pose and map
- It misses everyone during the jumps
Answer: 0

## Try: The learned detector, when the particle filter slips
cfg: {"sim":true,"level":4,"seed":12,"set":{"agents":"learned","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The same run, the learned detector.
See: 614 detections, precision 0.81, recall 0.85, velocity error 0.43 m/s; Agent tracks reads none confirmed most of the time and four at most. Four goals by 120 s, all five at 155 s.
Shows: The same robustness as under drift, now on a failure nobody staged. The network never saw seed 12; it saw drift and unsettled maps in training, and a jumping estimate looks to it like a short drift.
Predict: Back to seed 7, with a good map and a good pose, where the rule had precision 0.92 and recall 1.00. How does the learned detector compare there?
- About level: both are close to perfect when the rule's premise holds
- Far better: ten times the precision, as under mapping
- Far worse: it has to learn what the rule knows for free
Answer: 0

## Try: The learned detector, with the prior map
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The learned detector with the prior map and the level's localization, seed 7.
See: 907 detections, precision 0.96, recall 0.96, velocity error 0.27 m/s; one confirmed track most of the time, five at most; one contact, four goals by 120 s. Over seeds 2 to 5 the two are level: precision 0.87 to 0.97 against the rule's 0.93 to 0.96, recall 0.95 to 0.97 against 1.00.
Shows: Where the map and the pose are right the rule is already nearly perfect and the network matches it, a little more precise at some seeds and a little less complete; there is nothing left to win. The gain is all in the conditions above, which are the everyday ones on a real robot: maps that are being built or are out of date, and estimates that drift or slip.
Predict: Turn per-target scan matching on under lidar mapping. What does it give each track's Kalman filter that it did not have?
- A velocity measurement: the displacement of the person's hits from one scan to the next
- A second position measurement, from the aligned hits
- Nothing: the Kalman filter already estimates velocity
Answer: 0

## Try: Per-target scan matching
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","per":"mapping","agICP":true},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The learned detector under lidar mapping, with each track's hits aligned to its previous hits by ICP every scan.
See: Velocity error 0.30 m/s against 0.31 without; precision 0.84, recall 0.89, all five goals at 118 s. Over seeds 2 to 5 matching gives 0.28 to 0.34 m/s against 0.29 to 0.41 without: lower on two seeds, higher on two, and the mean over the five seeds 0.31 against 0.34. With the rule and the prior map the same switch brings 0.26 to 0.25 m/s here.
Shows: The tracker of lesson 3 infers velocity from positions, which takes about a second of consistent detections; the match measures the displacement between two scans directly and the filter fuses it with its own gain. The gain is small and lost in the run-to-run variation: a person is a handful of points, and ICP on a handful of points is only trusted when most of them pair within 30 cm and the residual is small.

## Code: agDetectLearned, the beams to detections
snippet: ag-learned
focus: if (P.per === 'oracle') {
focus: const p = nnForward(M, f, NBEAM);
focus: if (R[k] >= LMAX - 1e-3 || p[k] < thr) continue;
focus: agCluster(pts, M.minBeams
Note: The seven features are filled beam by beam (detFeatures, which the data collectors call too); detStatic is the map evidence, the rule's test kept as a number from the prior map or the built one. The forward pass (nnForward, in nn.js above: one circular convolution per layer, plain loops) returns a probability per beam, the threshold picks the person beams, and the same clustering the rule uses turns them into detections. A model trained before the map evidence has six inputs and still runs: the features follow its first layer. The reprojection scanReproject is just above; training/detector/train.py is the other half, in Python. No slot runs a detector; the predictor slot receives what this one found.

## Think about
Q: Why give the network the map evidence as an input rather than masking out the hits the map explains and letting it look at the rest?
A: A mask is the rule in front of the network, and it inherits the rule's failures: while the map is unsettled nothing is masked, a person standing within 0.25 m of a wall is masked away and can never be found, and under drift the misplaced walls pass the mask. As an input, the evidence is one cue the network weighs against the shape and the motion, and the training runs where the map was unsettled or misplaced taught it when the cue lies. The first version of this detector had no map input at all and lost to the rule wherever a map existed (0.73 against 0.92 here), with its false positives on the walls; the version with the input matches the rule there and beats it everywhere else.
Q: The training labels come from the simulator's ground truth. What would you need on a real robot?
A: Labelled scans, which are expensive: someone draws boxes around people in thousands of scans, or a second sensor (a camera with a person detector) labels the lidar automatically, or the scans are labelled by the rule in the conditions where it works (a good map, a good pose, checked by hand) and the network is trained on the same scans with the map and the pose degraded on purpose. The last is what this lesson's drift runs amount to, and it is a common pattern: use the classical stack where it works to teach a learned block to work where it does not.
Q: The network was trained on L5 and L6 and tested on other seeds of the same levels. What would it do in a building it has never seen, or with a lidar of 360 beams?
A: Different walls would not matter much, since it learned local shape, motion and evidence, not the building; a different beam count would break it outright, because the filter widths are in beams and a person is half as many beams at double the resolution. Distribution shift is the central risk of a learned block, and so is a failure mode it never saw: if the pose estimate failed in a way unlike drift, the network has no example of it. The lab can only show the mild kind of shift, a new seed and the other level; a real deployment tests on data from the actual sensor and site.
Q: The learned detector has 8 185 parameters and the rule has one threshold. Which is easier to trust, and why does that matter here?
A: The rule, because its failure modes are known (an unsettled map, a wrong pose) and visible; the network's failures are patterns in its weights that nobody reads. That is why the industry moved to learned perception anyway only with the rest of the pipeline kept inspectable: the learned stage's mistakes show up as detections on the map and health lights with reasons, and the tracker and planner downstream are unchanged. The end-to-end track of the next lessons has only an outcome.

## Check yourself
Q: The first layer has 7 input channels, 24 output channels and a kernel of 7 beams. How many parameters does it have, weights and biases?
Answer: 1200
How: Each of the 24 filters has 7 × 7 = 49 weights and one bias: 24 × 50 = 1 200.
