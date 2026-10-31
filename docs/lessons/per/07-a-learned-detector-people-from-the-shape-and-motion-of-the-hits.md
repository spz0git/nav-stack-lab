group: per
title: A learned detector: people from the shape and motion of the hits

<p><b>Why this matters.</b> Every detector in this lab so far has been a rule: a hit is a person when the map cannot explain it. The rule works only if the map is right and the robot knows where it stands on the map. Lesson 1 showed a map being built. While it is being built, nothing in it explains the hits yet, so the rule calls everything a person. A pose estimate that drifts or jumps does the same with a perfect map, because the map's walls land beside the walls the lidar sees. Real stacks replaced this rule with a learned one, and this lesson shows why. A small network looks at the scan and says, beam by beam, whether the hit is on a person. It weighs three cues: the shape of the hits (a person is a short convex arc, half a metre wide), their motion (walls do not move once the robot's own motion is taken out) and the map's evidence. It has learned from examples how far to trust each one. The detector here was trained on the simulator's own ground truth and runs in the page. The lesson measures it against the rule in three situations where the rule's assumption breaks, and in one where it holds.</p>
<p><b>The idea.</b> The 120 beams form a ring of samples. A one-dimensional convolution slides a small filter around that ring, so that each beam's output depends on its neighbours. Each layer looks seven beams wide, and through three such layers each output sees about seventeen beams. The ring is closed, so beam 119 is next to beam 0. Each beam carries seven numbers: its range; the range the previous scan would show from here if everything stood still (the previous scan moved by the odometry and sorted again by beam); the difference of the two; whether the beam hit anything; the robot's speed; its turn rate; and the map evidence $s$. The map evidence says how well the robot's map explains the hit. It is 1 on a mapped wall, and 0 half a metre from anything mapped or on a cell the map has not settled yet. It is the rule's own test kept as a number instead of a yes or no, so the network can overrule it. The network outputs one probability per beam. Beams above 0.8 are clustered in the same way as the rule's unexplained hits, and a cluster of a person's size becomes a detection for the Kalman tracker of lesson 3. Nothing downstream changes, because the learned block replaces one stage and hands on the same kind of detections.</p>
$$\begin{aligned} &\text{input} && x \in \mathbb{R}^{120 \times 7}:\ \ r/8,\ \ \tilde r_\text{prev}/8,\ \ \operatorname{clip}(r - \tilde r_\text{prev}, \pm 1),\ \ \text{hit},\ \ v/1.5,\ \ \omega/2,\ \ s \\ &\text{layers} && \operatorname{conv}(7 \to 24, k = 7)\ \text{ReLU} \cdot \operatorname{conv}(24 \to 24, k = 7)\ \text{ReLU} \\ & && \cdot\ \operatorname{conv}(24 \to 24, k = 5)\ \text{ReLU} \cdot \operatorname{conv}(24 \to 1, k = 1)\ \text{sigmoid} \\ &\text{loss} && \text{weighted binary cross-entropy, weight } \sqrt{(1 - \pi)/\pi} \text{ on the 4 \% of person beams} \\ &\text{decision} && p > 0.8, \ \text{clusters of a person's width} \end{aligned}$$
<p>Here $\tilde r_\text{prev}$ is the previous scan reprojected through the odometry. The convolutions pad circularly, and the network has 8 185 parameters. The detections are scored as</p>
$$\text{precision} = \frac{\text{true detections}}{\text{all detections}} \qquad \text{recall} = \frac{\text{true detections}}{\text{detectable people}}$$
<p>where a person is detectable when a beam hits them. Detections are compared with the people in the robot's own frame, so that a wrong pose estimate is not counted against the detector.</p>
<p><b>Where it comes from.</b> A convolution is the standard tool for a signal with local structure and no preferred position, and the circular padding closes the ring. The reprojection is the ego-motion compensation that every scan-based detector does before it looks for motion. The map evidence is an input and not a mask. A mask would run the rule first and let the network see only what is left, so it would inherit every failure of the rule. An input is one cue among several. The training set is 43 000 scans from 36 headless runs on the two levels with people, with scripted and with reacting people. The labels come from the people's true poses and discs. The runs take three map conditions in turn: the prior map, the map being built, and the prior map with the pose drifting on dead reckoning. The last two teach the network when not to believe the map. The training runs use seeds from 21 up, so the network has not seen any of the runs in this lesson. <a class="chref" href="#notes=ch3/9-a-learned-detector">The network, the training, the first version without the map and why it lost, the pipeline from simulator to page, and the measured table: chapter 3 §9</a></p>
<p><b>What the lab does.</b> Choose Perceive → Agent tracking → Learned detector + Kalman. The weights ship in the page (69 KB), and the forward pass is a hundred lines of plain JavaScript in the simulation core. The lidar layer colours a hit rose when its probability is above the threshold. Per-target scan matching, in the same tab, aligns a track's hits from one scan to the next by ICP and feeds the displacement to the Kalman filter as a velocity measurement. It works with either detector. Tools → Train retrains the detector in the page. You collect scans on any level or on a map of your own, train this shape of network or another, and compare it with the built-in one on a run it has not seen. You can then pick it here under Detector model. The numbers below are for L5 over 120 s with the speed planner, at seed 7 unless a Try says otherwise. They are measured per scan against the truth: detection precision and recall, the confirmed tracks that Agent tracks shows in the metrics, and the RMS velocity error of each confirmed track against the person it follows.</p>

## Try: The rule, with the prior map
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st"},"tab":"per"}
Setup: L5 with the prior map, the clustering detector of lesson 3 (hits the map cannot explain) and the speed planner. The Perceive tab is open.
See: There are 1 034 detections over the run, with precision 0.92 and recall 1.00. The tracks' velocity error is 0.26 m/s RMS. There is one contact, and four goals are reached by 120 s. Agent tracks in the metrics shows one confirmed track most of the time and six at most, because the shelves hide most people.
Shows: With a good map and a good pose the rule is nearly perfect, because a hit either lies on a wall or it does not. The learned detector is measured against this, and it is a high standard.
Predict: The rule with the prior map and a good pose, four people on the floor. How many confirmed tracks will Agent tracks in the metrics show most of the time?
- One, a few at most: the shelves hide most of the people, and the map explains every wall hit
- Four, one per person, all the time: the lidar sees across the aisles
- A dozen or more: every shelf end looks like a person
Answer: 0

## Try: The rule, building its own map
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","per":"mapping"},"tab":"per"}
Setup: The same run, with lidar mapping.
See: There are 8 214 detections, with precision 0.07. Almost every detection is a wall cell the map has not settled yet (a cell counts as static only after enough hits). Recall stays 1.00, because the people are among the detections. But the tracker carries phantom tracks. Agent tracks reads about a dozen confirmed most of the time and up to 36, for four people, and the yields in the log name agents numbered in the hundreds. The velocity error rises to 0.35 m/s. The speed planner yields to walls, and three goals are reached by 120 s instead of four.
Shows: The rule fails because its assumption fails. While the map is being built, "unexplained by the map" means "not in the map yet", and on a level the robot explores for the first time that is most of the level. Tuning the settling threshold does not fix this. It only moves the phantoms to a different time.
Predict: Switch to lidar mapping, so the robot builds the map as it drives. What does the rule do?
- It drowns: phantom people on the walls the map has not settled yet, for the whole run
- Nothing changes: the walls are seen before any person
- It stops detecting: unknown space explains everything
Answer: 0

## Try: The learned detector, building its own map
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","per":"mapping"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: Perceive → Agent tracking → Learned detector, with lidar mapping on. The lidar layer is on, and hits in rose are beams the network calls a person.
See: There are 966 detections, and the velocity error is 0.31 m/s. Four goals are reached by 120 s, with no contact. Agent tracks reads one confirmed track most of the time and nine at most. Precision and recall under lidar mapping:
| Detector | Precision | Recall |
|---|---|---|
| learned, this run | 0.74 | 0.88 |
| learned, seeds 2 to 5 | 0.51 to 0.82 | 0.88 to 0.93 |
| rule, seeds 2 to 5 | 0.04 to 0.07 | — |
Watch the colours. A person's arc of hits turns rose as they walk, and a shelf end stays amber even before the map knows it. The misses are people seen edge-on at the far end of an aisle, who show up as a beam or two.
Shows: On the same unsettled map, the learned detector has ten times the precision of the rule. The network was trained on runs where the map was still being built. It learned that a low evidence value there means "not known yet" and not "not a wall", and that the shape and motion of the hits then decide.
Predict: Now the learned detector, same run, lidar mapping. How many confirmed tracks will Agent tracks show most of the time?
- One or none, as with the rule and a good map: an unsettled cell is weak evidence, and the network falls back on the shape and motion of the hits
- About a dozen, as with the rule here: it reads the same unsettled map
- None: without a settled map it cannot call anything a person
Answer: 0

## Try: The rule, the pose drifting
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","loc":"dr"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: L5 with the prior map and the rule, and localization by dead reckoning (Localize → Dead reckoning).
See: There are 10 026 detections, for four people. The tracks in the table are the confirmed tracks that Agent tracks reads:
| Run | Precision | Recall | Tracks, most of the time | Tracks, at most |
|---|---|---|---|---|
| this run | 0.06 | 1.00 | 13 | 21 |
| seeds 2 to 5 | 0.05 to 0.07 | — | 15 to 18 | 32 |
Watch Agent tracks, and the speed planner, which keeps yielding to these tracks. No goal is reached by 120 s with either detector, because with dead reckoning the robot cannot find the goals themselves. This Try is about what the detector sees.
Shows: The map is perfect, and the rule still drowns in phantoms. The test "is there a wall within 0.25 m of this hit" is done at the estimated pose. Once the pose is off by more than 0.25 m, every wall the lidar sees lies beside the wall in the map. The rule cannot tell a person from a wall seen from the wrong place, because it never looks at the shape or motion of the hits themselves.
Predict: Back to the prior map, but the robot now localizes by dead reckoning: the wheels' noisy, biased odometry alone, so its pose estimate drifts by half a metre and more within a minute or two. What does the rule show?
- A crowd of phantom people on the walls, more than a dozen confirmed tracks, growing as the pose drifts
- The same as with a good pose: the map is still correct
- Fewer detections: a drifting robot drives more slowly
Answer: 0

## Try: The learned detector, the pose drifting
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","loc":"dr"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The same drift, with the learned detector and the lidar layer on.
See: There are 563 detections. The tracks are again the confirmed tracks that Agent tracks reads:
| Run | Precision | Recall | Tracks, most of the time | Tracks, at most |
|---|---|---|---|---|
| this run | 0.71 | 0.65 | none | 3 |
| seeds 2 to 5 | 0.50 to 0.83 | 0.82 to 0.86 | 1 | 5 |
Compare the track counts with the rule's 15 to 18 most of the time. The walls stay amber while the robot's estimate slides away from them on the map.
Shows: The learned detector has over ten times the precision of the rule. Along every wall the map evidence says "unexplained". The shape of the hits (long, straight, wider than a person) and their motion (none, once the robot's own motion is taken out) say "wall". In the drift runs the network learned that shape and motion win when they disagree with the map. This run shows the argument for learned perception. The rule has one cue, and it fails when that cue fails. The network weighs several cues, so it gets worse only gradually when one of them goes wrong.
Predict: The learned detector, the same drifting pose. How many confirmed tracks most of the time?
- One or none: a long straight run of hits that does not move is a wall wherever the map puts it
- More than a dozen, as with the rule: it reads the same misplaced map
- None at all, people included
Answer: 0

## Try: The rule, when the particle filter slips
cfg: {"sim":true,"level":4,"seed":12,"set":{"agents":"lidar","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: L5 at seed 12, with the level's own localization (a particle filter with unlabelled beacons), the prior map and the rule. Nothing is switched off; this failure happens on its own.
See: There are 1 948 detections, with precision 0.33, recall 0.99 and a velocity error of 0.40 m/s. Agent tracks reads one confirmed track most of the time, but up to 18 during the jumps. Four goals are reached by 120 s, and all five at 161 s.
Shows: A localization error that lasts a second is enough. On real robots the rule meets this failure more often than a missing map. The map is right, the estimate is wrong for a moment, and every wall becomes a person for as long as the estimate is wrong.
Predict: Back to the good pose, seed 12: the same level and settings as the first Try, at another seed. In this run the particle filter's estimate jumps by one to three metres for a few scans at a time (unlabelled beacons and clutter mislead it), and then recovers. What does the rule do during the jumps?
- Flashes of phantom tracks along the walls, a dozen or more at the worst moments
- Nothing: a few scans are too short to matter
- It loses the real people, but adds no phantoms
Answer: 0

## Try: The learned detector, when the particle filter slips
cfg: {"sim":true,"level":4,"seed":12,"set":{"agents":"learned","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The same run, with the learned detector.
See: There are 614 detections, with precision 0.81, recall 0.85 and a velocity error of 0.43 m/s. Agent tracks reads no confirmed track most of the time and four at most. Four goals are reached by 120 s, and all five at 155 s.
Shows: The detector holds up as it did under drift, this time on a failure nobody set up. The network never saw seed 12. It saw drift and unsettled maps in training, and to the network a jumping estimate looks like a short drift.
Predict: The learned detector on the same run. What changes?
- Far fewer phantoms: at most a handful of confirmed tracks during the jumps
- Nothing: both use the same pose and map
- It misses everyone during the jumps
Answer: 0

## Try: The learned detector, with the prior map
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The learned detector with the prior map and the level's localization, seed 7.
See: There are 907 detections, and the velocity error is 0.27 m/s. There is one confirmed track most of the time and five at most. There is one contact, and four goals are reached by 120 s. Over seeds 2 to 5 the two detectors are level:
| Detector | Precision | Recall |
|---|---|---|
| learned, this run | 0.96 | 0.96 |
| learned, seeds 2 to 5 | 0.87 to 0.97 | 0.95 to 0.97 |
| rule, seeds 2 to 5 | 0.93 to 0.96 | 1.00 |
Compare the last two rows. The precision ranges overlap, and the rule keeps its recall of 1.00.
Shows: Where the map and the pose are right, the rule is already nearly perfect and the network matches it. The network is a little more precise at some seeds and misses a few more people, so there is nothing left to gain here. All the gain is in the conditions above, which are everyday conditions on a real robot: maps that are being built or are out of date, and estimates that drift or slip.
Predict: Back to seed 7, with a good map and a good pose, where the rule had precision 0.92 and recall 1.00. How does the learned detector compare there?
- About level: both are close to perfect when the rule's premise holds
- Far better: ten times the precision, as under mapping
- Far worse: it has to learn what the rule knows for free
Answer: 0

## Try: Per-target scan matching
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","per":"mapping","agICP":true},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The learned detector under lidar mapping, with each track's hits aligned to its previous hits by ICP every scan.
See: Precision is 0.84 and recall 0.89, and all five goals are reached at 118 s. The tracks' velocity error:
| Run | With matching (m/s) | Without (m/s) |
|---|---|---|
| this run | 0.30 | 0.31 |
| seeds 2 to 5 | 0.28 to 0.34 | 0.29 to 0.41 |
| mean over the five seeds | 0.31 | 0.34 |
| the rule with the prior map, this run | 0.25 | 0.26 |
Look at seeds 2 to 5. With matching the error is lower on two of them and higher on two.
Shows: The tracker of lesson 3 infers velocity from positions, which takes about a second of consistent detections. The match measures the displacement between two scans directly, and the filter fuses it with its own gain. The improvement is small and is lost in the variation from run to run. A person is a handful of points, and ICP on a handful of points is trusted only when most of them pair up within 30 cm and the residual is small.
Predict: Turn per-target scan matching on under lidar mapping. What does it give each track's Kalman filter that it did not have?
- A velocity measurement: the displacement of the person's hits from one scan to the next
- A second position measurement, from the aligned hits
- Nothing: the Kalman filter already estimates velocity
Answer: 0

## Code: agDetectLearned, the beams to detections
snippet: ag-learned
focus: if (P.per === 'oracle') {
focus: const p = nnForward(M, f, NBEAM);
focus: if (R[k] >= LMAX - 1e-3 || p[k] < thr) continue;
focus: agCluster(pts, M.minBeams
Note: The seven features are filled beam by beam in detFeatures, which the data collectors call too. detStatic is the map evidence: the rule's test kept as a number, from the prior map or the built one. The forward pass (nnForward, in nn.js above, one circular convolution per layer in plain loops) returns a probability per beam. The threshold picks the person beams, and the same clustering the rule uses turns them into detections. A model trained before the map evidence was added has six inputs and still runs, because the features follow the size of its first layer. The reprojection, scanReproject, is just above. The other half is training/detector/train.py, in Python. No slot runs a detector; the predictor slot receives what this one found.

## Think about
Q: Why give the network the map evidence as an input rather than masking out the hits the map explains and letting it look at the rest?
A: A mask puts the rule in front of the network, so it inherits the rule's failures. While the map is unsettled, nothing is masked. A person standing within 0.25 m of a wall is masked away and can never be found. Under drift, the misplaced walls pass the mask. As an input, the evidence is one cue that the network weighs against the shape and the motion. The training runs where the map was unsettled or misplaced taught it when that cue is wrong. The first version of this detector had no map input at all. It lost to the rule wherever a map existed (0.73 against 0.92 here), with its false positives on the walls. The version with the input matches the rule there and beats it everywhere else.
Q: The training labels come from the simulator's ground truth. What would you need on a real robot?
A: You would need labelled scans, and they are expensive. There are three usual ways to get them. Someone draws boxes around people in thousands of scans. Or a second sensor, such as a camera with a person detector, labels the lidar automatically. Or the rule labels the scans in the conditions where it works (a good map and a good pose, checked by hand), and the network is trained on the same scans with the map and the pose degraded on purpose. This lesson's drift runs are the third way. It is a common pattern: the classical stack teaches a learned block, using the conditions where the classical stack works, so that the block works where the stack does not.
Q: The network was trained on L5 and L6 and tested on other seeds of the same levels. What would it do in a building it has never seen, or with a lidar of 360 beams?
A: Different walls would not matter much, because the network learned local shape, motion and evidence, and nothing about the building as a whole. A different beam count would break it outright, because the filter widths are in beams and a person is half as many beams at double the resolution. Distribution shift is the main risk of a learned block. So is a kind of failure it never saw: if the pose estimate failed in a way unlike drift, the network would have no example of it. The lab can show only a mild shift, a new seed and the other level. A real deployment is tested on data from the actual sensor and site.
Q: The learned detector has 8 185 parameters and the rule has one threshold. Which is easier to trust, and why does that matter here?
A: The rule. Its failures are known (an unsettled map, a wrong pose) and you can see them. The network's failures are patterns in its weights that nobody reads. So when the industry moved to learned perception, it kept the rest of the pipeline open to inspection. The learned stage's mistakes show up as detections on the map and as health lights with reasons, and the tracker and planner downstream are unchanged. The end-to-end track of the next lessons shows only an outcome.

## Check yourself
Q: The first layer has 7 input channels, 24 output channels and a kernel of 7 beams. How many parameters does it have, weights and biases?
Answer: 1200
How: Each of the 24 filters has 7 × 7 = 49 weights and one bias, so the layer has 24 × 50 = 1 200.
