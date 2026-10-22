group: per
title: A learned predictor: three futures for each person

<p><b>Why this matters.</b> The speed planner, space-time A*, DWA and MPC all plan against where people will be, and so far "will be" has meant constant velocity: the track's position plus its velocity times the time ahead, with a radius that grows. It is wrong in two ways people notice. It is wrong in its mean: a walker at the end of an aisle turns back, a person who reacts steps aside, and the tracker's velocity is itself noisy, so the extrapolated point drifts off. And it is wrong in its shape: a person who may walk on or may turn back has two likely futures, and a single line through the middle of them is a place nobody goes. Learned predictors are what real stacks use for both, and this lesson trains one on the simulator's own walkers, runs it in the page next to constant velocity, and measures where it helps, where it does not, and where it is worse.</p>
<p><b>The idea.</b> A small network reads one tracked person at a time, in that person's own frame (origin where they are now, $x$ along the way they have walked over the last second), so that a walker in an aisle looks the same whichever way the aisle runs. It sees the track's last second (five past positions and the velocity), where the robot is and how it moves (reacting people react to it), and how much free space there is around the person along eight rays of the robot's map. It answers with $K = 3$ futures, each six points from 0.5 s to 3 s ahead, and a probability for each. Each future is written as a correction to constant velocity, so a network that outputs zeros is constant velocity, and what it learns is how people deviate from it.</p>
$$\begin{aligned} &\text{input} && x \in \mathbb{R}^{24}:\ \text{5 past positions},\ v,\ \text{robot position}/4,\ \text{robot velocity},\ \text{8 rays}/4 \\ &\text{layers} && 24 \to 64\ \text{ReLU} \to 64\ \text{ReLU} \to 39 \\ &\text{output} && z_1, z_2, z_3 \ (\pi = \operatorname{softmax} z), \quad \mu_k(t_j) = v\,t_j + \Delta_{kj}, \ \ t_j = 0.5, 1, \dots, 3\ \text{s} \\ &\text{loss} && L = -\log \sum_{k=1}^{3} \pi_k \exp\!\Big(-\frac{\lVert y - \mu_k \rVert^2}{2\sigma^2}\Big), \quad \sigma = 0.3\ \text{m} \end{aligned}$$
<p>Here $y$ is where the person really went (twelve numbers: six points), and the loss is the negative log-likelihood of a mixture of three Gaussians. Its gradient pulls each future towards the outcomes it explains best (its responsibility), and each probability towards how often that future is the one that explains them, so the futures can split into "walks on", "slows" and "turns back" instead of averaging them. The network has 8 295 parameters.</p>
<p><b>Where it comes from.</b> This is a mixture density network over trajectories, the shape of most learned pedestrian and vehicle predictors (several futures and their probabilities, scored by the best of them and by the most probable). The person-centred frame and the correction to constant velocity are the two standard ways of making a small network's job easy. The training set is 84 760 samples (one tracked person at one scan) from 48 headless runs on the two levels with people, scripted and reacting, the robot yielding to them in some runs and driving through in others, each labelled with where that person really went, seen through the robot's pose estimate of the moment so that a localization error is not taught as motion. Seeds 21 to 44; every run in this lesson is one it has not seen. <a class="chref" href="#notes=ch3/10-a-learned-predictor">The features, the loss and its gradient, the choice of σ, what the planners take from three futures, and the measured tables: chapter 3 §10</a></p>
<p><b>What the lab does.</b> Perceive → Prediction → Learned (network). Each confirmed track gets its three futures every scan, drawn on the map with the probable ones bold and their probabilities at the ends, next to constant velocity as a thin grey dashed line. The planners avoid the most probable future, with the same growing radius constant velocity gets, so that only the centre differs; <i>Plan against</i> switches to every future at least 20 % probable. The metrics show both predictors' prediction error at 1 s and 2 s, against where the people really went, all through the run and whichever predictor drives (the one not in use is scored on what it would have said); with the learned predictor on, the status strip shows the two at 2 s. The score stops when the mission is complete. Tools → Train retrains it: collect on any level with people, train this shape or another, compare, and pick it under Predictor model. The numbers below are L5 at seed 7, read when the log says Mission complete.</p>

## Try: Constant velocity, scripted people
cfg: {"sim":true,"level":4,"set":{"agPred":"cv"},"tab":"per","layers":{"agents":true}}
Setup: L5 as it comes: the lidar tracker, constant-velocity prediction, the speed planner, scripted people who walk their aisles back and forth. Perceive tab; the metrics are under the map.
See: Mission complete at 121 s, one contact. Prediction error 1 s · 2 s in the metrics: constant velocity 0.24 · 0.45 m; learned 0.15 · 0.26 m, the network scored on what it would have said while constant velocity drove.
Shows: Constant velocity is wrong by almost half a metre two seconds ahead, more than a person's radius. Some of that is the people (a scripted walker turns back at the end of the aisle without slowing), much is the tracker: a velocity estimated from lidar clusters wobbles, and every wobble is multiplied by the time ahead. The network smooths the wobble from the last second of positions and knows that a walker running out of free space ahead is about to turn.
Predict: Constant velocity assumes each person walks on in a straight line at the velocity the tracker estimates. How far off is it two seconds ahead (Prediction error 1 s · 2 s, under the map)?
- A few centimetres: the people walk straight lines
- Several tenths of a metre, a person's width or more
- Several metres: the people turn all the time
Answer: 1

## Try: Learned, scripted people
cfg: {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: The same run, Prediction → Learned. Watch a walker near the end of an aisle: the bold future still goes straight, and a thinner one bends back.
See: Mission complete at 119 s, one contact. Learned 0.18 · 0.34 m, constant velocity 0.24 · 0.46 m, on the tracks of this run. Over seeds 1 to 12 the learned error at 2 s is lower on every seed (0.23 to 0.73 m against 0.40 to 0.96 m), but the contacts are 11 against 14 in all and the mean time to Mission complete 135 s against 131 s: five seeds without a contact against two, and the rest the same or worse.
Shows: A better prediction is not automatically safer driving. The speed planner already keeps a margin and a growing radius around every prediction, which absorbs most of constant velocity's error. The contacts that remain are a scripted walker reaching the robot from the side or the front while it has already slowed for them: the speed planner can only change the robot's speed along its path, and when a walker who never yields crosses the place where the robot stands, slowing down is no escape. The network moves the contact to another encounter; it does not remove the kind. Prediction error is the number a predictor is trained on; contacts and time are what a robot is judged on, and the link between them is weak.
Predict: Switch Prediction to Learned. The planners now avoid the network's most probable future, which is 40 % closer to the truth at 2 s. What happens to the contacts and to the time to Mission complete?
- About the same: a contact or none, and a few seconds either way
- No contacts at all, and the mission is done sooner
- Far slower: the robot brakes for turns that do not happen
Answer: 0

## Try: Constant velocity, reacting people
cfg: {"sim":true,"level":4,"set":{"agPred":"cv","people":"reactive"},"tab":"per","layers":{"agents":true}}
Setup: L5 with reacting people (Vehicle → People → Reactive), constant velocity.
See: Mission complete at 122 s, no contact, closest to a person 0.18 m. Constant velocity 0.27 · 0.55 m, learned 0.22 · 0.42 m: a quarter better at 2 s, against 40 % with scripted people. Over seeds 1 to 12 the margin is smaller with reacting people on ten seeds.
Shows: People who react are harder for both, and the network's edge shrinks. It knows where the robot is and how fast it moves now, so it can learn "people step away from a robot coming at them", but not where the robot will be in two seconds, which is what the person is really reacting to. A prediction that ignores the robot's plan, and a plan that takes the prediction as given, is the coupling problem of chapter 4: each side treats the other as fixed.
Predict: Now make the people react: they step around the robot (social forces). Will the network still beat constant velocity at 2 s?
- Yes, by a smaller margin: reacting people depend on what the robot will do next, which the network does not know
- Yes, by a larger margin: it saw the robot's position, constant velocity did not
- No: it was trained mostly on scripted people
Answer: 0

## Try: Learned, reacting people
cfg: {"sim":true,"level":4,"set":{"agPred":"learned","people":"reactive"},"tab":"per","layers":{"agents":true}}
Setup: Reacting people, the learned predictor.
See: Mission complete at 124 s, no contact, closest to a person 0.46 m against 0.18 m. Learned 0.20 · 0.36 m, constant velocity 0.23 · 0.45 m. Over seeds 1 to 12: one contact in all with constant velocity, none with the network; the closest approach larger on ten seeds; the times about the same (seeds 1 and 6 are long with both).
Shows: The gain shows up as distance, not as goals or seconds: the robot meets the people where they will be rather than where a straight line says, and passes them wider. With people who move out of its way, that is the most a better prediction can buy.
Predict: Switch to Learned. What does Closest to a person in the metrics do?
- It grows: the robot keeps more distance from people
- It stays the same: there were no contacts anyway
- It shrinks: the network predicts people stepping away, so the robot cuts closer
Answer: 0

## Try: Plan against every likely future
cfg: {"sim":true,"level":4,"set":{"agPred":"learned","predModes":"all"},"tab":"per","layers":{"agents":true}}
Setup: Scripted people, the learned predictor, Perceive → Plan against → Every future ≥ 20 %. Each likely future is now an obstacle of its own for the speed planner, space-time A*, DWA and MPC.
See: Mission complete at 121 s, no contact at seed 7. Over seeds 1 to 12: 8 contacts against 11 with the most probable future only, but the mean time 147 s against 135 s: 15 to 25 s slower on seeds 9, 10 and 12, where the robot waits in front of people whose second future crosses its path.
Shows: Multimodal predictions raise a question constant velocity never asked: which future does the planner believe? All of them is cautious and slow (the freezing robot: every gap is blocked by somebody's unlikely turn); the most probable alone is quick and occasionally wrong. Planners that weigh each future by its probability and replan as it resolves are how real stacks answer it; this lab offers the two ends.
Predict: Plan against every future at least 20 % probable instead of the most probable one. What does it cost?
- Time on some seeds: the robot also waits for the turns that do not happen
- Nothing: the extra futures are thin and far away
- Contacts: the planner cannot find a gap
Answer: 0

## Try: Where the network is wrong: perfect tracks
cfg: {"sim":true,"level":4,"set":{"agPred":"learned","agents":"truth"},"tab":"per","layers":{"agents":true}}
Setup: Agent tracking → Ground truth, the learned predictor. Nothing else changes.
See: Constant velocity 0.03 · 0.13 m, learned 0.18 · 0.32 m: more than twice the error at 2 s, on every seed from 1 to 12. Mission complete at 127 s, no contact.
Shows: The network learned the noise of the lidar tracker as much as the people. Most of its advantage on real tracks was undoing the tracker's wobble; given clean tracks it keeps "correcting" a wobble that is not there. This is distribution shift in a form that is easy to miss: the people did not change, the sensor did. A learned block is trained for one stage upstream of it, and an improvement upstream (a better tracker, the per-target scan matching of lesson 7) can make it worse.
Predict: Switch Agent tracking to Ground truth: the tracks now carry the people's exact positions and velocities. Which predictor has the smaller error at 2 s?
- Constant velocity, by far: a scripted walker on a straight line is exactly constant velocity, and the network was trained to correct a noisy tracker
- The network: it predicts the turns at the ends of the aisles
- They are equal: with exact velocities there is nothing to correct
Answer: 0

## Try: People who pause: the futures split
cfg: {"sim":true,"level":5,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: L6, the car, people who pause before they turn back; the learned predictor. Pause when a person slows near the end of their walk and look at their futures.
See: Near the end of a walk a second future of 20 % or more shows about half the time, and the bold one is less sure (75 % on average); in mid-walk one future carries 85 %, and a second one shows one time in five (seeds 2, 3 and 7). Learned 0.21 · 0.34 m, constant velocity 0.25 · 0.46 m. Mission complete at 162 s against 148 s with constant velocity, no contact either way; over seeds 1 to 12 the car is slower with the network on seven seeds (168 s against 164 s on average), with 2 contacts against 4.
Shows: The futures are a picture of what the network is unsure about, and it is unsure exactly where people decide. It cannot know when a pause ends; it learned how often a pause ends in each way. The slower car is the price of the predicted pauses: a person predicted to stand in the lane for two seconds keeps the car waiting where constant velocity would have let it go, sometimes rightly.
Predict: The parking lot (L6): people walk to their cars, pause for a few seconds and walk back. Where on the map do the network's three futures split most?
- At the ends of a person's walk, where they slow and pause: walk on, stop or turn back
- In the middle of a walk, where they move fastest
- Nowhere: the three futures are always the same line
Answer: 0

## Code: predDecode, three futures from 39 numbers
snippet: pred-decode
focus: for (let k = 0; k < PRED_K; k++) z += e[k] = Math.exp(out[k] - mx);
focus: qx = vx * tt + out[o],
focus: return [fr.x + fr.c * qx - fr.s * qy, fr.y + fr.s * qx + fr.c * qy];
Note: The network's output is decoded in three steps: a softmax over the first three numbers gives the probabilities; each future's points are constant velocity (the tracked velocity times the time ahead, in the person's frame) plus the network's correction; and the frame turns them back into the map. predFeatures, just above it in core/predict.js, builds the 24 inputs, and mixLoss in core/nn-train.js is the loss and its gradient, the same lines the Train tab trains with; training/predictor/train.py is the Python twin. The planners read a future through agPred, the same function constant velocity goes through, so nothing downstream knows which predictor it is using.

## Think about
Q: Why predict a correction to constant velocity instead of the positions themselves?
A: Because constant velocity is most of the answer, and a network that has to rediscover "position plus velocity times time" from data spends its capacity, and its training data, on the obvious. As a correction, an untrained network is already constant velocity, small weights mean small deviations from it, and everything it learns is about how people differ from a straight line. The cost is that it inherits constant velocity's input: when the track's velocity is wrong the network starts from a wrong line, and when it is exactly right (ground truth) the network's learned corrections are pure harm.
Q: The loss uses a fixed σ of 0.3 m. What happens as σ goes to zero, and why not learn σ too?
A: As σ shrinks, the responsibilities become all-or-nothing: only the future nearest the outcome gets a gradient, and the probabilities learn to pick it. That is winner-takes-all, which gives the most distinct futures (best of three at 2 s: 0.21 m at σ = 0.2 against 0.22 at 0.5) and the least accurate most probable one (0.35 m against 0.31). Learning σ per future is the full mixture density network and gives calibrated spreads, but it is less stable to train and the planners here would not use it: they take a radius that grows like constant velocity's, so that the comparison isolates the centre.
Q: The rays read free space in the robot's map, and the network was trained on two levels. What would it do on a floor it has never seen?
A: The rays are what let it anticipate a turn at the end of an aisle, and an aisle elsewhere looks the same to them, so some of it should carry over; but where the walkers' paths end has nothing to do with the walls on these levels' open floors, and on another map the network may have learned that "an open floor ahead" means "keep walking" from places where it happened to. The lab has not measured it on other maps: Tools → Train can collect on a painted map and test the built-in model there, which is the experiment to run before trusting it.
Q: What would it take to predict people who react to the robot's plan, not only to its current position?
A: Give the predictor the robot's intended path (the planned trajectory for the next seconds) as an input, and train it on runs where that path varies; then the planner and the predictor depend on each other, and either they are iterated (plan, predict given the plan, replan) or planned jointly. That coupling is where interactive prediction and game-theoretic planning start, and it is outside what this lab models.

## Check yourself
Q: The first layer maps 24 inputs to 64 hidden units. How many parameters does it have, weights and biases?
Answer: 1600
How: 64 × 24 = 1 536 weights and 64 biases: 1 600.
