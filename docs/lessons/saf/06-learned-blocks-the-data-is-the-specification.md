group: saf
title: Learned blocks: the data is the specification

<p><b>Why this matters.</b> A hand-written block does what its code says, and you can read the code to find out what that is. A learned block does what its training data taught it, and nobody wrote that down: the specification of the people detector is, in effect, the 39 497 scans it was trained on. Where the robot meets the kind of input those scans covered, the block is as good as its tests say; where it meets something they did not cover, nobody knows, the block least of all, because a network answers every input with the same confidence. This lesson measures the stack's three learned blocks the way a safety case has to: not one accuracy number, but how well each does on each slice of the situations it meets, and whether the robot can tell, while it drives, that it has left the data behind.</p>
<p><b>The standards.</b> ISO/PAS 8800 derives a learned component's safety requirements from the operating domain (clause 9), sets requirements on the data and its coverage of that domain (clause 11), verifies and validates the trained component against them (clause 12), and analyses what causes its errors (clause 13); it also asks for measures in operation that watch for inputs the component was not made for (clause 14). The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition (2023)) and have not been checked against the texts.</p>
<p><b>The idea.</b> Two measurements. The first cuts the block's performance by slice: the detector's recall $r_s = \text{found}_s / \text{visible}_s$ for people near, mid-range and far, the predictor's error for people who walk on as they were and people who change course. An average hides a weak slice behind the strong ones, and the weak slice is where the hazard is. The second is a monitor in operation: each built-in model carries the statistics of a short description $x$ of the inputs it was trained on (its mean $\mu_i$ and spread $\sigma_i$ per element), and every input it reads gets a score</p>
$$s = \sqrt{\frac1m \sum_{i=1}^{m} \min\!\Bigl(10, \frac{|x_i - \mu_i|}{\sigma_i}\Bigr)^{2}}, \qquad \text{outside when } s > s_{99},$$
<p>with $s_{99}$ the score that 99 % of the training inputs stay under. Inside, the block is on familiar ground; outside, its outputs are untested, whatever they look like. The score only sees what its description measures, which is its weakness as much as its strength.</p>
<p><b>Where it comes from.</b> The slices, the score and its threshold, how the references were made from the runs each model file lists, and the measured tables at six seeds: <a class="chref" href="#notes=ch8/8-learned-blocks-slices-and-the-edge-of-the-data">chapter 8 §8</a>.</p>
<p><b>What the lab does.</b> The <button type="button" class="linkbtn" data-met="">Metrics list</button> beside the event log has, with a people tracker on, <i>People found</i>: the share of the people the scan really hits that a detection finds, by range (under 2.5 m, 2.5 to 5 m, farther), and the false detections per scan; <i>Prediction error at 2 s</i>, both predictors on the people who walk on and the people who change course; and for each learned block in use, its input's score now and the share of the run outside. A block in use whose input is outside for more than half of the last 5 s turns its subsystem's light amber ("Out of distribution"); the Try buttons plot the detector's or the policy's score. The detector was trained on the busy floor (L5) and the parking lot (L6), the predictor on the same two, the policy on the four floors without people (L1 to L4). Numbers are seed 7, checked at seeds 1 to 5.</p>

## Try: The learned detector on the floor it was trained on
cfg: {"sim":true,"level":4,"set":{"agents":"learned"},"tab":"per","layers":{"agents":true},"panes":[["oodDet"]]}
Setup: L5 with the learned people detector in place of the rule. The busy floor is where most of its training scans came from (other seeds), so this is its home ground.
See: It finds 96 % of the people the scan hits, with 0.03 false detections per scan. By distance:
| People found | Under 2.5 m | 2.5 to 5 m | Farther |
|---|---|---|---|
| learned detector | all | 96 % | 90 % |
| rule | 100 % | 100 % | 100 % |
Look at the last column: on seeds 2 to 5 the learned detector finds 85 to 91 % of the far people, and all of the near ones. The score stays near 1, 1 % of the scans outside, and no light mentions it.
Shows: One number would have said 96 %, close enough to the rule. The slice says where the 4 % goes: people far away, whom a scan hits with two or three beams, too few for the shape the network learned. If a far person matters (a fast robot needs to see them early), the requirement is on that slice, and so is the data that would meet it.
Predict: Which slice does the learned detector find fewest people in?
- Farther than 5 m
- Under 2.5 m
- The same on every slice: it was trained on this floor
Answer: 0

## Try: When the estimate is wrong
cfg: {"sim":true,"level":4,"seed":1,"set":{"agents":"learned"},"tab":"per","layers":{"agents":true,"belief":true}}
Setup: Seed 1, the run where the particle filter keeps losing itself in the repeating aisles (lesson 3). The map is placed wherever the estimate says, so it is often in the wrong place.
See: The learned detector makes 0.32 false detections per scan and finds 90 % of the people. The rule, on the same run, makes 2.98 false detections per scan: every rack the misplaced map does not explain looks like a person.
Shows: The detector was trained on three map conditions in turn, one of them a map misplaced by drift, and it learned not to trust the map's evidence too far. What was in the data, it handles. That is the other side of the lesson's title: the data is the specification of what the block can do, as well as of what it cannot.

## Try: Fog: outside the data
cfg: {"sim":true,"level":4,"set":{"agents":"learned","weather":"fog"},"tab":"per","layers":{"agents":true,"lidar":true},"panes":[["oodDet"]]}
Setup: The same detector in fog. There was no fog in its training data: the returns fade beyond about 4 m, one beam in seven is lost, and some beams return from the fog itself.
See: The Perceive light turns amber at 0.5 s, "Out of distribution (detector)", and stays: 96 % of the scans score above the threshold, at about 2.6 against 1.91. The detector still finds 92 % of the people it can see, but the speed planner yields to its false detections. The mission took 120 s in clear air.
| Run | Light on at (s) | False detections per scan | Mission (s) |
|---|---|---|---|
| this run | 0.5 | 7 | 187 |
| seeds 2 to 5 | 0.5 on every run | 7 | 190 to 234 |
Look at the first column: the monitor speaks within a second on every seed.
Shows: Lesson 3 found that no light watched the fog. Here one does, and not because anyone wrote a rule about fog: the scans no longer look like the ones the detector was trained on, and the monitor says so in half a second. What it cannot say is what is wrong, or whether the block's answers are still good; here recall held and the false detections did not.
Predict: Fog, which the detector never saw in training. When does a health light say the input is unfamiliar?
- Within a second
- After the first contact
- Never: the detector still finds most people
Answer: 0

## Try: Rain: the grey zone
cfg: {"sim":true,"level":4,"set":{"agents":"learned","weather":"rain"},"tab":"per","layers":{"agents":true,"lidar":true},"panes":[["oodDet"]]}
Setup: Rain instead: the lidar fades beyond about 6 m, loses one beam in sixteen, and now and then returns from a drop.
See: The light comes on when a run of outside scans lasts long enough. In this run the detector makes 2.7 false detections per scan and finds 94 % of the people.
| Run | Scans outside (%) | Light first on at (s) |
|---|---|---|
| this run | 13 | 107.5 |
| seeds 2 to 5 | 10 to 12 | 109.5 to 138.5 |
| seed 1 | — | never |
Look at the last column: late on every seed, and on one not at all.
Shows: A monitor needs a threshold, and between clearly inside and clearly outside there is a grey zone where any threshold is wrong some of the time: here the rain is a real change (false detections up from 0.03 to 2.7 per scan) that the monitor reports late, and on one seed of six not at all. Raising the threshold makes it quieter in rain and slower in fog; lowering it, the reverse.
Predict: Rain changes the scans less than fog. What does the light do?
- Comes on late, and not on every seed
- Comes on within a second, as in fog
- Never comes on
Answer: 0

## Try: The learned predictor, by slice
cfg: {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: L5 with the learned people predictor. Both predictors are scored on every prediction whichever one the planner uses; the <button type="button" class="linkbtn" data-met="Prediction error at 2 s">Metrics list</button> splits their error at 2 s into people who walk on as they were and people who change course (turn by more than 30°, stop or start) before the 2 s are up.
See: The error at 2 s, by slice:
| Predictor | Steady walkers (m) | People who change course (m) |
|---|---|---|
| learned, this run | 0.28 | 0.78 |
| constant velocity, this run | 0.36 | 1.61 |
| learned, seeds 2 to 5 | 0.20 to 0.25 | 0.66 to 0.80 |
| constant velocity, seeds 2 to 5 | 0.33 to 0.37 | 1.38 to 1.67 |
Now look at how rare the second column is: only 54 of 949 predictions, 6 %, are of people changing course, and 6 to 8 % on seeds 2 to 5.
Shows: The learned predictor wins on both slices, and the gap is widest exactly where the hazard is: the person turning back at the end of their walk (lesson 3). But that slice is a twentieth of the data, so the average error barely shows how much better the network is there, or how much better it would have to be; a requirement written on the average would never look at the slice that matters.
Predict: Where is the learned predictor's advantage over constant velocity largest, in metres?
- On the people who change course
- On the steady walkers
- The same on both
Answer: 0

## Try: The policy among people
cfg: {"sim":true,"level":4,"set":{"plan":"policy"},"tab":"plan","layers":{"agents":true},"panes":[["oodPol"]]}
Setup: The busy floor driven by the end-to-end policy, which was trained on the four floors without people. Its description for the monitor is its scan (the nearest return in each of 12 sectors, the mean range, the shares that return and return close) and its goal and motion.
See: The score stays below 1 almost throughout, 0.4 % of the inputs outside, and the Plan light never mentions it; on seeds 2 to 5 the share outside is 0.4 to 0.5 % on every run. Contacts with people:
| Seed | The policy | The classical stack |
|---|---|---|
| this run | 4 | 1 |
| 2 | 2 | 1 |
| 3 | 4 | 1 |
| 4 | 1 | 1 |
| 5 | 1 | 1 |
Read down the columns: the policy has as many contacts as the classical stack or more, on every seed.
Shows: The people are the one thing that is new to the policy, and its monitor cannot see them: a person is a few beams among 120, and the sector minima of an aisle with a person in it look like the aisles it trained in. An out-of-distribution score is only as good as its description of the input; a quiet monitor is evidence about what it measures, and nothing else.
Predict: The policy never saw a person in training. What share of its inputs does its monitor flag as outside?
- Under 1 %: the scans look like its training aisles
- Most of them: everything about the floor is new
- About half
Answer: 0

## Think about
Q: The learned detector finds 96 % of the people on its home floor. Is that good enough?
A: It depends on the slice and on what the rest of the stack does with a miss. A missed far person is found a few scans later as the robot approaches, so the requirement for the far slice can be loose for a slow robot and strict for a fast one; a missed near person is a hazard now. The requirement follows from the operating domain and the stopping distance (clause 9), and the data has to cover the slices it names (clause 11).
Q: The fog monitor came on in half a second. What should the robot do when it does?
A: Something that does not depend on the block it no longer trusts: slow down, switch the people tracker to the radar, or stop at a safe place and call for help. Lesson 7 measures one such mitigation, an emergency brake on the radar alone. A monitor without a reaction is the lidar fault of lesson 4 again: detection, then nothing.
Q: How would you make the policy's monitor see the people it was never trained with?
A: Describe the input by something people change: the scan's agreement with the map (a person is a return the map does not explain), the number of moving returns, or the detector's own output. Each addition makes the monitor see more and raises its threshold's grey zone; and the honest fix is the data, runs with people, which the Train tab can collect.

## Check yourself
Q: A detector's slice has 182 visible people, of whom it finds 164. What is its recall on that slice, in percent?
Answer: 90
Tolerance: 0.5
Unit: %
How: $164 / 182 = 0.901$, about 90 %. Recall is found over visible, per slice; the people the scan never hits are not counted, since no detector could find them.
