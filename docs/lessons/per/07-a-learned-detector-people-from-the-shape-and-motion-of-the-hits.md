group: per
title: A learned detector: people from the shape and motion of the hits

<p><b>Why this matters.</b> Every detector in this lab so far has been a rule: a hit is a person when the map cannot explain it. That rule needs a map, and lesson 1 showed what a map looks like while the robot is still building it: everything is unexplained, so everything is a person, and the tracker drowns. Real stacks replaced this rule with a learned one a decade ago. A small network looks at the scan and says, beam by beam, "this hit is on a person", from the shape of the hits (a short convex arc, half a metre wide) and their motion (walls do not move when the robot's own motion is taken out). This lesson trains such a detector on the simulator's own ground truth, runs it in the page, and measures it against the rule it replaces: where it is worse, where it is better, and what it learned.</p>
<p><b>The idea.</b> The 120 beams are a ring of samples. A one-dimensional convolution slides a small filter around that ring, so that each beam's output depends on its neighbours (seven beams wide per layer, three layers deep, about seventeen beams in all), and the ring is closed: beam 119 is next to beam 0. Each beam carries six numbers: its range, the range the previous scan would show from here if everything stood still (the previous scan moved by the odometry and re-binned by beam), their difference, whether the beam hit anything, and the robot's speed and turn rate. The network outputs one probability per beam; beams above 0.6 are clustered exactly as the rule's unexplained hits were, and a cluster of a person's size, two beams or more, becomes a detection the Kalman tracker of lesson 3 consumes. Nothing downstream changes: the learned block is a drop-in for one stage.</p>
<div class="eq">input   x ∈ ℝ^{120 × 6}:  r/8,  r̃_prev/8,  clip(r − r̃_prev, ±1),  hit,  v/1.5,  ω/2        r̃_prev: the previous scan reprojected through the odometry
layers  conv(6 → 24, k = 7) ReLU · conv(24 → 24, k = 7) ReLU · conv(24 → 24, k = 5) ReLU · conv(24 → 1, k = 1) sigmoid        circular padding, 8 017 parameters
loss    weighted binary cross-entropy, weight √((1 − π)/π) on the 3 % of person beams;   decision  p > 0.6, clusters of ≥ 2 beams
precision = true detections / all detections,   recall = true detections / detectable people        a person is detectable when a beam hits it</div>
<p><b>Where it comes from.</b> The convolution is the standard tool for a signal with local structure and no preferred position on the ring; the circular padding is the ring. The reprojection is the ego-motion compensation every scan-based detector does before it looks for motion. The training set is 18 000 scans from sixteen headless runs on the two levels with people, scripted and reacting, labelled from the true poses and discs; one run is held out to report the numbers. <a class="chref" href="#notes=ch3/9-a-learned-detector">The network, the training, the pipeline from simulator to page, and the measured table: chapter 3 §9</a></p>
<p><b>What the lab does.</b> Perceive → Agent tracking → Learned detector + Kalman. The weights ship in the page (66 KB) and the forward pass is a hundred lines of plain JavaScript in the simulation core; the lidar layer colours each hit by its probability, rose above 0.6. Per-target scan matching (the same tab) aligns a track's hits from one scan to the next by ICP and feeds the displacement to the Kalman filter as a velocity measurement; it works with either detector. The numbers below are L5 at seed 7 over 120 s with the speed planner, measured per scan against the truth: detection precision and recall, and the RMS velocity error of the confirmed tracks against the person they sit on.</p>

## Try: The rule, with the prior map
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st"},"tab":"per"}
Setup: L5 with the prior map, the clustering detector of lesson 3 (hits the map cannot explain), the speed planner. Perceive tab.
See: 1 034 detections over the run, precision 0.92, recall 1.00; the tracks' velocity error 0.26 m/s RMS; one contact.
Shows: With a good map the rule is nearly perfect: a hit either lies on a wall or it does not. This is the standard the learned detector has to be measured against, and it is a high one.
Predict: Switch to lidar mapping, so the robot builds the map as it drives. What does the rule do?
- It drowns: thousands of false detections from walls the map has not settled yet, for the whole run
- Nothing changes: the walls are seen before any person
- It stops detecting: unknown space explains everything
Answer: 0

## Try: The rule, building its own map
cfg: {"sim":true,"level":4,"set":{"agents":"lidar","spd":"st","per":"mapping"},"tab":"per"}
Setup: The same, with lidar mapping.
See: 8 214 detections, precision 0.07: almost every one is a wall cell the map has not settled yet (a cell counts as static only after enough hits). Recall stays 1.00 because the people are among the detections, but the tracker carries dozens of phantom tracks, the velocity error rises to 0.35 m/s and the speed planner yields to walls; three goals instead of four.
Shows: The rule's weakness is its premise. "Unexplained by the map" means "not yet in the map" while the map is being built, and on a level the robot explores for the first time that is most of the level. No tuning of the settling threshold fixes this; it only moves the phantoms in time.
Predict: Now the learned detector, same run, lidar mapping. Precision?
- About 0.7: it recognizes people from their shape and motion, with no map at all
- About 0.07 as well: it was trained on the same hits
- Above 0.9: it is better than the rule with a map
Answer: 0

## Try: The learned detector, building its own map
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","per":"mapping"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: Perceive → Agent tracking → Learned detector, lidar mapping on. Lidar layer on: hits in rose are beams the network calls a person.
See: 1 017 detections, precision 0.66, recall 0.70, velocity error 0.40 m/s, four goals, one contact. Watch the colours: a person's arc of hits turns rose as they walk, a shelf end stays amber even before the map knows it; the misses are people seen edge-on at the far end of an aisle, two or three beams.
Shows: Ten times the precision of the rule without a map, at the cost of some recall. What the network learned is visible in the colours: a short convex arc whose range changes when the robot's own motion is taken out. It knows nothing about this building; it was trained on simulated scans with the true labels, and it transfers to a run it never saw.
Predict: Give the learned detector the prior map. Does it get better?
- A little: 0.73 precision, but it does not use the map, so not much
- Much better, to the rule's 0.92: the map removes the walls
- Worse: the map's walls confuse it
Answer: 0

## Try: The learned detector, with the prior map
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st"},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The learned detector with the prior map available (it does not read it).
See: 1 146 detections, precision 0.73, recall 0.88, velocity error 0.25 m/s: about the same as without the map, because the network never sees the map. Against the rule's 0.92 with the map: the learned detector is the better one only where there is no map.
Shows: A map is strong prior knowledge, and a rule that uses it beats a network that does not. The honest comparison is not "learned against classical" but "what information each one has": the rule needs the map and the network needs the training set. On the parking lot (L6, cars and people) under lidar mapping the same pair reads 0.29 against 0.69.
Predict: Turn per-target scan matching on under lidar mapping. The tracks' velocity error?
- Falls from 0.40 to about 0.25 m/s: the displacement is measured, not inferred from positions over a second
- Rises: ICP on five points slides along the person
- Unchanged: the Kalman filter already estimates velocity
Answer: 0

## Try: Per-target scan matching
cfg: {"sim":true,"level":4,"set":{"agents":"learned","spd":"st","per":"mapping","agICP":true},"tab":"per","layers":{"lidar":true,"agents":true}}
Setup: The learned detector under lidar mapping, with each track's hits aligned to its previous hits by ICP every scan.
See: Velocity error 0.25 m/s against 0.40 without; precision 0.67, recall 0.84, four goals, no contact. With the rule and the prior map the same switch brings 0.26 to 0.24 m/s.
Shows: The tracker of lesson 3 infers velocity from positions, which takes about a second of consistent detections; the match measures the displacement between two scans directly and the filter fuses it with its own gain. It helps most where the detections are noisiest, which is the learned detector without a map. ICP on a handful of points is only trusted when most of them pair within 30 cm and the residual is small.

## Code: agDetectLearned, the beams to detections
snippet: ag-learned
focus: const p = nnForward(M, f, NBEAM);
focus: if (R[k] >= LMAX - 1e-3 || p[k] < 0.6) continue;
focus: agCluster(pts, true);
Note: The six features are filled beam by beam, the forward pass (nnForward, in nn.js above: one circular convolution per layer, plain loops) returns a probability per beam, the threshold picks the person beams, and the same clustering the rule uses turns them into detections. The reprojection scanReproject is just above; training/detector/train.py is the other half, in Python. No slot runs a detector; the predictor slot receives what this one found.

## Think about
Q: The training labels come from the simulator's ground truth. What would you need on a real robot?
A: Labelled scans, which are expensive: someone draws boxes around people in thousands of scans, or a second sensor (a camera with a person detector) labels the lidar automatically, or the scans are labelled by the rule with a good map and the network learns to do without the map. The last is what this lesson's setup amounts to, and it is a common pattern: use the classical stack where it works to teach a learned block to work where it does not.
Q: The network was trained on L5 and L6 and tested on a held-out run of L6. What would it do in a building it has never seen, or with a lidar of 360 beams?
A: Different walls would not matter much, since it learned local shape and motion, not the building; a different beam count would break it outright, because the filter widths are in beams and a person is half as many beams at double the resolution. Distribution shift is the central risk of a learned block, and the lab can only show the mild kind, a new seed and the other level; a real deployment tests on data from the actual sensor and site.
Q: The learned detector has 8 017 parameters and the rule has one threshold. Which is easier to trust, and why does that matter here?
A: The rule, because its one failure mode is known (an unsettled map) and visible; the network's failures are patterns in its weights that nobody reads. The modular track keeps the rest of the pipeline inspectable, so a learned stage's mistakes show up as detections on the map and health lights with reasons; the end-to-end track of the next lessons has only an outcome.

## Check yourself
Q: The first layer has 6 input channels, 24 output channels and a kernel of 7 beams. How many parameters does it have, weights and biases?
Answer: 1032
Tolerance: 0
Unit: parameters
How: 6 × 24 × 7 = 1 008 weights plus 24 biases = 1 032; the whole network is 1 032 + 4 056 + 2 904 + 25 = 8 017
