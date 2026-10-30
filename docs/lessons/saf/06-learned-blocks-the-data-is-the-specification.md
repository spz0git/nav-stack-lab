group: saf
title: Learned blocks: the data is the specification

<p><b>Why this matters.</b> Three blocks of this stack are learned rather than written by hand. The people detector looks at each lidar scan and marks the beams that hit a person. The people predictor takes a tracked person's last second of movement and guesses where they will be over the next three seconds. The end-to-end policy reads the scan and the goal and draws the short path the robot follows, in place of the planner. Each is a small neural network, trained on recorded runs of the simulator.</p>
<p>A hand-written block does what its code says, and you can read the code to find out what that is. A learned block does what its training data taught it, and nobody wrote that down. In that sense the data is the specification. For the people detector, the specification is the 39 497 scans it was trained on. Where the robot meets inputs like those scans, the block is as good as its tests say. Where it meets something they did not cover, nobody knows what the block will do. The network does not know either. It answers an unfamiliar input with the same confidence as a familiar one, and nothing in its output says that it is guessing.</p>
<p>So this lesson asks two questions of each learned block, the two a safety case has to answer. How well does the block do in each kind of situation it meets? And can the robot tell, while it drives, that it has left the training data behind?</p>
<p>The first question is what ties a hazard to the data. If the robot must not misjudge a person who turns back, the predictor has to be good on people who turn, so the training data has to hold enough of them for that to be learned and then measured. The second question covers the times when the first answer no longer applies. If the robot can tell that it has left the data, it can slow down or stop. If it cannot, the operating domain has to keep it away from inputs the block has never seen.</p>
<p><b>In the standards.</b> ISO/PAS 8800 treats a learned block's training data as part of its specification, and the title of this lesson comes from there. It asks for the block's requirements to be derived from the operating domain, and for the data to be checked, slice by slice, to see whether it covers them. Once the robot is at work, it asks for something to watch for inputs unlike the training data, because a learned block will not say when it is guessing. What ISO/PAS 8800 is, and how the lab uses it, is in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> The first measurement cuts a block's performance by slice. A slice is one kind of situation. For the detector, the slices are people near the robot (under 2.5 m), at mid-range (2.5 to 5 m) and far away (beyond 5 m). For the predictor, they are people who keep walking as they were and people who change course: turn by more than 30°, stop or start. A single average over all situations can hide a weak slice behind the strong ones, and the weak slice is often where the hazard is. A person who suddenly turns back is rare in the data, and that is the person the robot most needs to judge right.</p>
<p>For the detector, every scan is checked against where the people really are. A true positive (TP) is a person the scan hits whom the detector finds, meaning that a detection lies within 0.6 m of them. A false negative (FN) is a person the scan hits whom the detector misses. A false positive (FP) is a detection where there is nobody. People the scan does not hit at all are not counted, since no detector could find them. Counted over all the scans of a run, in each slice $s$:</p>
$$\text{recall}_s = \frac{TP_s}{TP_s + FN_s}, \qquad \text{false detections per scan} = \frac{FP}{\text{number of scans}}$$
<p>Recall is the share of the people the scan hits that the detector finds. The chapter writes the same ratio as found over visible, and the Metrics list shows it in the row "People found".</p>
<p>The second measurement is a monitor that runs while the robot drives. It cannot check the block's answers, because the robot does not know where the people really are. Instead it checks whether the input looks like the inputs the block was trained on. It summarises each input in a few numbers. For the detector's scan there are eight, among them the mean range, the share of beams that return, how much the scan has changed since the last one, and how well the map explains the hits. For each of these numbers the monitor knows the values seen in training, as a mean and a spread. It gives the input a score that is small when every number is close to its training mean and grows as the numbers move away. Written out, with $x_1$ to $x_m$ the $m$ numbers that describe the input, and $\mu_i$ and $\sigma_i$ the mean and the standard deviation of $x_i$ over the training inputs, the score is</p>
$$s = \sqrt{\frac1m \sum_{i=1}^{m} \min\!\Bigl(10, \frac{|x_i - \mu_i|}{\sigma_i}\Bigr)^{2}}, \qquad \text{outside when } s > s_{99}.$$
<p>Each term is the number of standard deviations by which $x_i$ lies from its training mean. It is capped at 10, so that one wild number cannot decide the score on its own. The score $s$ is the root mean square of these terms. The input counts as outside the training data when $s$ is above $s_{99}$, the score that 99 % of the training inputs stay under. For the detector that is 1.91. Inside, the block is on familiar ground. Outside, its outputs are untested, however reasonable they look. The monitor sees only what its few numbers describe. That keeps it simple, but it can miss a change that those numbers do not capture.</p>
<p><b>Where it comes from.</b> The slices, the score and its threshold, how the references were made from the runs each model file lists, and the measured tables at six seeds are in <a class="chref" href="#notes=ch8/8-learned-blocks-slices-and-the-edge-of-the-data">chapter 8 §8</a>.</p>
<p><b>What the lab does.</b> All of these numbers are in the <button type="button" class="linkbtn" data-met="">Metrics list</button> beside the event log while a people tracker is on. The row "People found" gives the recall over all the people the scan hits, then by range (under 2.5 m, 2.5 to 5 m, farther), and at its end the false detections per scan ("false per scan"). The row "Prediction error at 2 s" gives both predictors' error for the people who walk on ("steady") and for those who change course ("changing"). Each learned block in use has a row of its own, "Detector input" or "Policy input". The row shows the score now, the threshold, and the share of the run so far that was outside. If a block's input is outside for more than half of the last 5 s, its subsystem's health light turns amber with the words "Out of distribution". Some Try buttons also open a plot of the detector's or the policy's score.</p>
<p>The experiments first measure the learned detector slice by slice on the floor it was trained on, then on a run where the robot's estimate of its own position is wrong. Then they take it into fog and rain, which it never saw in training, to see when the monitor notices. Last come the predictor by slice and the policy on a floor with people. The detector was trained on the busy floor (L5) and the parking lot (L6), the predictor on the same two, and the policy on the four floors without people (L1 to L4). The numbers are for run seed 7, checked at seeds 1 to 5.</p>

## Try: The learned detector on the floor it was trained on
cfg: {"sim":true,"level":4,"set":{"agents":"learned"},"tab":"per","layers":{"agents":true},"panes":[["oodDet"]]}
Setup: L5 with the learned people detector in place of the stack's default one. The default is a hand-written rule. It keeps the lidar returns that the robot's map does not explain, groups neighbouring ones into clusters, and calls each cluster no wider than 1.2 m a person. In the learned detector, a small network trained on recorded scans marks the beams that hit a person, and those beams are grouped into clusters as before. Most of its training scans came from the busy floor (at other seeds), so this is its home ground.
See: It finds 96 % of the people the scan hits, with 0.03 false detections per scan. By distance:
| People found | Under 2.5 m | 2.5 to 5 m | Farther |
|---|---|---|---|
| learned detector | all | 96 % | 90 % |
| rule | 100 % | 100 % | 100 % |
Look at the last column. On seeds 2 to 5 the learned detector finds 85 to 91 % of the far people, and all of the near ones. The plot the Try opens shows the detector's out-of-distribution score scan by scan; it is the $s$ of The idea. The score stays near 1, below the threshold of 1.91. Only 1 % of the scans go above it, as the Metrics list's "Detector input" row says ("1 % of the run outside"). The Perceive light turns amber only when more than half of the last 5 s were outside, so it stays green throughout.
Shows: A single number would have said 96 %, close to the rule. The slices show where the missing 4 % are. They are people far away, whom a scan hits with only two or three beams, too few for the shape the network learned. If far people matter, as they do for a fast robot that has to see them early, the requirement goes on the far slice. The training data then needs more far people to meet it.
Predict: Which slice does the learned detector find fewest people in?
- Farther than 5 m
- Under 2.5 m
- The same on every slice: it was trained on this floor
Answer: 0

## Try: When the estimate is wrong
cfg: {"sim":true,"level":4,"seed":1,"set":{"agents":"learned"},"tab":"per","layers":{"agents":true,"belief":true}}
Setup: Seed 1, the run in which the particle filter keeps losing the robot in the repeating aisles (lesson 3). The map is placed wherever the estimate says the robot is, so the map is often in the wrong place.
See: The learned detector makes 0.32 false detections per scan and finds 90 % of the people. On the same run the rule makes 2.98 false detections per scan, because to the rule every rack that the misplaced map does not explain looks like a person.
Shows: The detector was trained on three map conditions in turn, and one of them was a map misplaced by drift. It learned not to trust the map too far. A situation that was in the training data is one the block can handle. So the data specifies what the block can do as well as what it cannot.

## Try: Fog: outside the data
cfg: {"sim":true,"level":4,"set":{"agents":"learned","weather":"fog"},"tab":"per","layers":{"agents":true,"lidar":true},"panes":[["oodDet"]]}
Setup: The same detector in fog, which was not in its training data. In fog the returns fade beyond about 4 m, one beam in seven is lost, and some beams return from the fog itself.
See: The Perceive light turns amber at 0.5 s, with "Out of distribution (detector)", and stays amber. 96 % of the scans score above the threshold, at about 2.6 against 1.91. The detector still finds 92 % of the people it can see, but the speed planner yields to its false detections. In clear air the mission took 120 s.
| Run | Light on at (s) | False detections per scan | Mission (s) |
|---|---|---|---|
| this run | 0.5 | 7 | 187 |
| seeds 2 to 5 | 0.5 on every run | 7 | 190 to 234 |
Look at the column "Light on at". The monitor reports within a second on every seed.
Shows: In lesson 3 no light watched for fog. Here one does, although nobody wrote a rule about fog. The scans no longer look like the ones the detector was trained on, and the monitor says so in half a second. It cannot say what is wrong, or whether the block's answers are still good. Here the recall held up, but the false detections went from 0.03 to 7 per scan.
Predict: Fog, which the detector never saw in training. When does a health light say the input is unfamiliar?
- Within a second
- After the first contact
- Never: the detector still finds most people
Answer: 0

## Try: Rain: the grey zone
cfg: {"sim":true,"level":4,"set":{"agents":"learned","weather":"rain"},"tab":"per","layers":{"agents":true,"lidar":true},"panes":[["oodDet"]]}
Setup: Rain instead of fog. The lidar fades beyond about 6 m, loses one beam in sixteen, and now and then gets a return from a drop.
See: The light comes on only when outside scans go on for long enough. In this run the detector makes 2.7 false detections per scan and finds 94 % of the people.
| Run | Scans outside (%) | Light first on at (s) |
|---|---|---|
| this run | 13 | 107.5 |
| seeds 2 to 5 | 10 to 12 | 109.5 to 138.5 |
| seed 1 | — | never |
Look at the last column. The light comes on late on every seed, and on one seed not at all.
Shows: A monitor needs a threshold. Between clearly inside and clearly outside there is a grey zone, where any threshold is wrong some of the time. The rain is a real change, since the false detections go up from 0.03 to 2.7 per scan. The monitor reports it late, and on one seed of six not at all. Raising the threshold makes the monitor quieter in rain and slower in fog. Lowering it does the reverse.
Predict: Rain changes the scans less than fog. What does the light do?
- Comes on late, and not on every seed
- Comes on within a second, as in fog
- Never comes on
Answer: 0

## Try: The learned predictor, by slice
cfg: {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: L5 with the learned people predictor. Both predictors are scored on every prediction, whichever one the planner uses. The <button type="button" class="linkbtn" data-met="Prediction error at 2 s">Metrics list</button> splits their error at 2 s into two slices: people who walk on as they were, and people who change course (turn by more than 30°, stop or start) before the 2 s are up.
See: The error at 2 s, by slice:
| Predictor | Steady walkers (m) | People who change course (m) |
|---|---|---|
| learned, this run | 0.28 | 0.78 |
| constant velocity, this run | 0.36 | 1.61 |
| learned, seeds 2 to 5 | 0.20 to 0.25 | 0.66 to 0.80 |
| constant velocity, seeds 2 to 5 | 0.33 to 0.37 | 1.38 to 1.67 |
Now look at how rare the second column's slice is. Only 54 of the 949 predictions, 6 %, are of people changing course, and 6 to 8 % on seeds 2 to 5.
Shows: The learned predictor does better on both slices, and the gap is widest where the hazard is: the person turning back at the end of their walk (lesson 3). But that slice is only about a twentieth of the data. The average error over all predictions barely shows how much better the network is on that slice, or how much better it would need to be. A requirement written on the average would never look at the slice that matters.
Predict: Where is the learned predictor's advantage over constant velocity largest, in metres?
- On the people who change course
- On the steady walkers
- The same on both
Answer: 0

## Try: The policy among people
cfg: {"sim":true,"level":4,"set":{"plan":"policy"},"tab":"plan","layers":{"agents":true},"panes":[["oodPol"]]}
Setup: The busy floor, driven by the end-to-end policy, which was trained on the four floors without people. The policy's monitor describes each input by numbers from the scan, and by the goal and the motion. From the scan it takes the nearest return in each of 12 sectors, the mean range, the share of beams that return, and the share that return close.
See: The score stays below 1 almost throughout, with 0.4 % of the inputs outside, and the Plan light never mentions it. On seeds 2 to 5 the share outside is 0.4 to 0.5 % on every run. Contacts with people:
| Seed | The policy | The classical stack |
|---|---|---|
| this run | 4 | 1 |
| 2 | 2 | 1 |
| 3 | 4 | 1 |
| 4 | 1 | 1 |
| 5 | 1 | 1 |
Read down the columns. On every seed the policy has as many contacts as the classical stack, or more.
Shows: The people are what is new to the policy, and its monitor cannot see them. A person is a few beams among 120, and the nearest returns per sector in an aisle with a person in it look like those in the aisles the policy trained in. An out-of-distribution score can only notice changes in the numbers it is given. A monitor that stays quiet shows only that those numbers look familiar, and here it misses the one change that matters.
Predict: The policy never saw a person in training. What share of its inputs does its monitor flag as outside?
- Under 1 %: the scans look like its training aisles
- Most of them: everything about the floor is new
- About half
Answer: 0

## Think about
Q: The learned detector finds 96 % of the people on its home floor. Is that good enough?
A: It depends on the slice, and on what the rest of the stack does with a miss. A far person who is missed is found a few scans later as the robot comes closer. So the requirement on the far slice can be loose for a slow robot, and has to be strict for a fast one. A near person who is missed is a hazard at once. The requirement follows from the operating domain and the stopping distance, and the data has to cover the slices it names.
Q: The fog monitor came on in half a second. What should the robot do when it does?
A: Something that does not depend on the block it no longer trusts. It could slow down, switch the people tracker to the radar, or stop at a safe place and call for help. Lesson 7 measures one such mitigation, an emergency brake that uses the radar alone. A monitor without a reaction repeats the lidar fault of lesson 4, where the stack detected the fault and then did nothing.
Q: How would you make the policy's monitor see the people it was never trained with?
A: Describe the input by something that people change. That could be how well the scan agrees with the map (a person is a return the map does not explain), the number of moving returns, or the detector's own output. Each added number lets the monitor see more, and also widens the grey zone around its threshold. The better fix is in the data: runs with people, which the Train tab can collect.

## Check yourself
Q: In one slice the scan hits 182 people, and the detector finds 164 of them. What is its recall on that slice, in percent?
Answer: 90
Tolerance: 0.5
Unit: %
How: Recall is $TP / (TP + FN)$ per slice. Here TP = 164 people found and FN = 182 − 164 = 18 missed, so $164 / 182 = 0.901$, about 90 %. People the scan never hits are in neither count, since no detector could find them.
