group: per
title: A learned predictor: three futures for each person
level: 3

<p><b>Why this matters.</b> The speed planner, space-time A*, DWA and MPC all plan against where people will be. So far that has come from constant velocity: the track's position plus its velocity times the time ahead, with a radius that grows. This prediction is wrong in two ways. First, its centre is off. A walker at the end of an aisle turns back, a person who reacts steps aside, and the tracker's velocity is noisy anyway, so the extrapolated point drifts away from the person. Second, it has the wrong shape. A person who may walk on or may turn back has two likely futures, and a single line through the middle of them points where nobody goes. Real stacks use learned predictors for both problems. The predictor in this lesson was trained on the simulator's own walkers and runs in the page next to constant velocity. The lesson measures where it helps, where it makes no difference and where it is worse.</p>
<p><b>The idea.</b> A small network reads one tracked person at a time, in that person's own frame. The origin is where they are now, and $x$ points along the way they have walked over the last second. A walker in an aisle then looks the same whichever way the aisle runs. The network sees the track's last second (five past positions and the velocity), where the robot is and how it moves (because reacting people react to it), and how much free space there is around the person along eight rays of the robot's map. It answers with $K = 3$ futures, each of six points from 0.5 s to 3 s ahead, and a probability for each. Each future is written as a correction to constant velocity. A network that outputs zeros therefore predicts constant velocity, and what it learns is how people deviate from it.</p>
$$\begin{aligned} &\text{input} && x \in \mathbb{R}^{24}:\ \text{5 past positions},\ v,\ \text{robot position}/4,\ \text{robot velocity},\ \text{8 rays}/4 \\ &\text{layers} && 24 \to 64\ \text{ReLU} \to 64\ \text{ReLU} \to 39 \\ &\text{output} && z_1, z_2, z_3 \ (\pi = \operatorname{softmax} z), \quad \mu_k(t_j) = v\,t_j + \Delta_{kj}, \ \ t_j = 0.5, 1, \dots, 3\ \text{s} \\ &\text{loss} && L = -\log \sum_{k=1}^{3} \pi_k \exp\!\Big(-\frac{\lVert y - \mu_k \rVert^2}{2\sigma^2}\Big), \quad \sigma = 0.3\ \text{m} \end{aligned}$$
<p>Here $y$ is where the person really went (twelve numbers, for six points), and the loss is the negative log-likelihood of a mixture of three Gaussians. Its gradient pulls each future towards the outcomes it explains best; how well a future explains an outcome is called its responsibility. The gradient also pulls each probability towards how often that future is the one that explains the outcome. So the futures can split into "walks on", "slows" and "turns back" instead of averaging them. The network has 8 295 parameters.</p>
<p><b>Where it comes from.</b> This is a mixture density network over trajectories. Most learned predictors for pedestrians and vehicles have this shape: several futures and their probabilities, scored by the best of them and by the most probable one. The person-centred frame and the correction to constant velocity are the two standard ways of making a small network's job easier. The training set is 84 760 samples (one tracked person at one scan) from 48 headless runs on the two levels with people. The people were scripted in some runs and reacting in others, and the robot yielded to them in some runs and drove through them in others. Each sample is labelled with where that person really went, seen through the robot's pose estimate at that moment, so that a localization error is not learned as motion. The runs used seeds 21 to 44, so the network has not seen any of the runs in this lesson. <a class="chref" href="#notes=ch3/10-a-learned-predictor">The features, the loss and its gradient, the choice of σ, what the planners take from three futures, and the measured tables: chapter 3 §10</a></p>
<p><b>What the lab does.</b> Choose Perceive → Prediction → Learned (network). Each confirmed track gets its three futures every scan. They are drawn on the map with the probable ones in bold and their probabilities at the ends, next to constant velocity as a thin grey dashed line. The planners avoid the most probable future, with the same growing radius that constant velocity gets, so that only the centre differs. <i>Plan against</i> switches to every future that is at least 20 % probable. The metrics show the prediction error of both predictors at 1 s and 2 s, against where the people really went. Both are scored all through the run, whichever predictor drives; the one not in use is scored on what it would have said. With the learned predictor on, the status strip shows the two errors at 2 s. Scoring stops when the mission is complete. Tools → Train retrains the network. You collect on any level with people, train this shape or another, compare, and pick the result under Predictor model. The numbers below are for L5 at seed 7, read when the log says Mission complete.</p>

## Try: Constant velocity, scripted people
cfg: {"sim":true,"level":4,"set":{"agPred":"cv"},"tab":"per","layers":{"agents":true}}
Setup: L5 as it comes, with the lidar tracker, constant-velocity prediction, the speed planner and scripted people who walk their aisles back and forth. The Perceive tab is open, and the metrics are under the map.
See: Mission complete comes at 121 s, with one contact. Prediction error 1 s · 2 s in the metrics reads 0.24 · 0.45 m for constant velocity and 0.15 · 0.26 m for the learned predictor. The network is scored on what it would have said while constant velocity drove.
Shows: Two seconds ahead, constant velocity is wrong by almost half a metre, more than a person's radius. Some of that comes from the people: a scripted walker turns back at the end of the aisle without slowing. Much of it comes from the tracker. A velocity estimated from lidar clusters wobbles, and every wobble is multiplied by the time ahead. The network smooths the wobble using the last second of positions, and it has learned that a walker running out of free space ahead is about to turn.
Predict: Constant velocity assumes each person walks on in a straight line at the velocity the tracker estimates. How far off is it two seconds ahead (Prediction error 1 s · 2 s, under the map)?
- A few centimetres: the people walk straight lines
- Several tenths of a metre, a person's width or more
- Several metres: the people turn all the time
Answer: 1

## Try: Learned, scripted people
cfg: {"sim":true,"level":4,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: The same run with Prediction → Learned. Watch a walker near the end of an aisle. The bold future still goes straight, and a thinner one bends back.
See: Mission complete comes at 119 s, with one contact. On the tracks of this run the learned predictor's error is 0.18 · 0.34 m, and constant velocity's 0.24 · 0.46 m. Over seeds 1 to 12 the learned error at 2 s is lower on every seed (0.23 to 0.73 m against 0.40 to 0.96 m). But the contacts total 11 against 14, and the mean time to Mission complete is 135 s against 131 s. Five seeds have no contact, against two with constant velocity, and the rest are the same or worse.
Shows: A better prediction does not by itself make the driving safer. The speed planner already keeps a margin and a growing radius around every prediction, and these absorb most of constant velocity's error. In the contacts that remain, a scripted walker reaches the robot from the side or the front after the robot has already slowed for them. The speed planner can only change the robot's speed along its path. When a walker who never yields crosses the place where the robot stands, slowing down does not help. The network moves the contact to another encounter, but this kind of contact still happens. A predictor is trained on prediction error, a robot is judged on contacts and time, and the link between the two is weak.
Predict: Switch Prediction to Learned. The planners now avoid the network's most probable future, which is 40 % closer to the truth at 2 s. What happens to the contacts and to the time to Mission complete?
- About the same: a contact or none, and a few seconds either way
- No contacts at all, and the mission is done sooner
- Far slower: the robot brakes for turns that do not happen
Answer: 0

## Try: Constant velocity, reacting people
cfg: {"sim":true,"level":4,"set":{"agPred":"cv","people":"reactive"},"tab":"per","layers":{"agents":true}}
Setup: L5 with reacting people (Vehicle → People → Reactive) and constant velocity.
See: Mission complete comes at 122 s, with no contact, and the closest to a person is 0.18 m. Constant velocity's error is 0.27 · 0.55 m and the learned predictor's 0.22 · 0.42 m. At 2 s the network is a quarter better, against 40 % with scripted people. Over seeds 1 to 12 the margin is smaller with reacting people on ten seeds.
Shows: People who react are harder to predict for both predictors, and the network's lead shrinks. The network knows where the robot is and how fast it moves now, so it can learn that people step away from a robot coming at them. It does not know where the robot will be in two seconds, and that is what the person is really reacting to. The prediction ignores the robot's plan, and the plan takes the prediction as given. This is the coupling problem of chapter 4, where each side treats the other as fixed.
Predict: Now make the people react: they step around the robot (social forces). Will the network still beat constant velocity at 2 s?
- Yes, by a smaller margin: reacting people depend on what the robot will do next, which the network does not know
- Yes, by a larger margin: it saw the robot's position, constant velocity did not
- No: it was trained mostly on scripted people
Answer: 0

## Try: Learned, reacting people
cfg: {"sim":true,"level":4,"set":{"agPred":"learned","people":"reactive"},"tab":"per","layers":{"agents":true}}
Setup: Reacting people, with the learned predictor.
See: Mission complete comes at 124 s, with no contact. The closest to a person is 0.46 m, against 0.18 m with constant velocity. The learned error is 0.20 · 0.36 m and constant velocity's 0.23 · 0.45 m. Over seeds 1 to 12 there is one contact in all with constant velocity and none with the network. The closest approach is larger on ten seeds, and the times are about the same (seeds 1 and 6 are long with both).
Shows: The gain shows up as distance, while the goals and times stay about the same. The robot meets the people where they will be, and not where a straight line says they will be, so it passes them with more room. With people who move out of its way, a better prediction cannot give more than that.
Predict: Switch to Learned. What does Closest to a person in the metrics do?
- It grows: the robot keeps more distance from people
- It stays the same: there were no contacts anyway
- It shrinks: the network predicts people stepping away, so the robot cuts closer
Answer: 0

## Try: Plan against every likely future
cfg: {"sim":true,"level":4,"set":{"agPred":"learned","predModes":"all"},"tab":"per","layers":{"agents":true}}
Setup: Scripted people, the learned predictor, and Perceive → Plan against → Every future ≥ 20 %. Each likely future is now an obstacle of its own for the speed planner, space-time A*, DWA and MPC.
See: Mission complete comes at 121 s, with no contact at seed 7. Over seeds 1 to 12 there are 8 contacts, against 11 with the most probable future only. But the mean time is 147 s against 135 s. Seeds 9, 10 and 12 are 15 to 25 s slower, because the robot waits in front of people whose second future crosses its path.
Shows: With multimodal predictions the planner has to decide which future to believe, a choice constant velocity never needed. Believing all of them is cautious and slow. Taken far enough, this gives the freezing robot, where every gap is blocked by somebody's unlikely turn. Believing only the most probable one is quick and occasionally wrong. Real stacks use planners that weigh each future by its probability and replan as the person's choice becomes clear. This lab offers only the two extremes.
Predict: Plan against every future at least 20 % probable instead of the most probable one. What does it cost?
- Time on some seeds: the robot also waits for the turns that do not happen
- Nothing: the extra futures are thin and far away
- Contacts: the planner cannot find a gap
Answer: 0

## Try: Where the network is wrong: perfect tracks
cfg: {"sim":true,"level":4,"set":{"agPred":"learned","agents":"truth"},"tab":"per","layers":{"agents":true}}
Setup: Agent tracking → Ground truth, with the learned predictor. Nothing else changes.
See: Constant velocity's error is 0.03 · 0.13 m and the learned predictor's 0.18 · 0.32 m. At 2 s the network has more than twice the error, on every seed from 1 to 12. Mission complete comes at 127 s, with no contact.
Shows: The network learned the noise of the lidar tracker as much as it learned the people. Most of its advantage on real tracks came from undoing the tracker's wobble. Given clean tracks, it keeps "correcting" a wobble that is not there. This is distribution shift in a form that is easy to miss, because the people stayed the same and the sensor changed. A learned block is trained for the stage just upstream of it. An improvement upstream, such as a better tracker or the per-target scan matching of lesson 7, can make the learned block worse.
Predict: Switch Agent tracking to Ground truth: the tracks now carry the people's exact positions and velocities. Which predictor has the smaller error at 2 s?
- Constant velocity, by far: a scripted walker on a straight line is exactly constant velocity, and the network was trained to correct a noisy tracker
- The network: it predicts the turns at the ends of the aisles
- They are equal: with exact velocities there is nothing to correct
Answer: 0

## Try: People who pause: the futures split
cfg: {"sim":true,"level":5,"set":{"agPred":"learned"},"tab":"per","layers":{"agents":true}}
Setup: L6, the car, with people who pause before they turn back, and the learned predictor. Pause the run when a person slows near the end of their walk, and look at their futures.
See: Near the end of a walk, a second future of 20 % or more shows about half the time, and the bold one is less sure (75 % on average). In mid-walk one future carries 85 %, and a second one shows one time in five (seeds 2, 3 and 7). The learned error is 0.21 · 0.34 m and constant velocity's 0.25 · 0.46 m. Mission complete comes at 162 s, against 148 s with constant velocity, with no contact either way. Over seeds 1 to 12 the car is slower with the network on seven seeds (168 s against 164 s on average), with 2 contacts against 4.
Shows: The futures show what the network is unsure about, and it is unsure at the places where people decide. It cannot know when a pause ends. It learned how often a pause ends each way. The car is slower because of the predicted pauses. A person predicted to stand in the lane for two seconds keeps the car waiting where constant velocity would have let it go, and sometimes the wait is the right decision.
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
Note: The network's output is decoded in three steps. A softmax over the first three numbers gives the probabilities. Each future's points are constant velocity (the tracked velocity times the time ahead, in the person's frame) plus the network's correction. The last step turns the points from the person's frame back into the map. predFeatures, just above it in core/predict.js, builds the 24 inputs. mixLoss in core/nn-train.js is the loss and its gradient, the same lines the Train tab trains with, and training/predictor/train.py does the same in Python. The planners read a future through agPred, the same function constant velocity goes through, so nothing downstream knows which predictor it is using.

## Think about
Q: Why predict a correction to constant velocity instead of the positions themselves?
A: Constant velocity is most of the answer. A network that had to rediscover "position plus velocity times time" from data would spend its capacity, and its training data, on the obvious part. Written as a correction, an untrained network already predicts constant velocity, small weights mean small deviations from it, and everything it learns is about how people differ from a straight line. The cost is that it inherits constant velocity's input. When the track's velocity is wrong, the network starts from a wrong line. When the velocity is right (ground truth), the network's learned corrections only do harm.
Q: The loss uses a fixed σ of 0.3 m. What happens as σ goes to zero, and why not learn σ too?
A: As σ shrinks, the responsibilities become all or nothing. Only the future nearest the outcome gets a gradient, and the probabilities learn to pick it. This is winner-takes-all. It gives the most distinct futures (best of three at 2 s: 0.21 m at σ = 0.2 against 0.22 at 0.5) and the least accurate most probable future (0.35 m against 0.31). Learning σ for each future gives the full mixture density network, with calibrated spreads. But it is less stable to train, and the planners here would not use it. They take a radius that grows like constant velocity's, so that the comparison isolates the centre.
Q: The rays read free space in the robot's map, and the network was trained on two levels. What would it do on a floor it has never seen?
A: The rays let it anticipate a turn at the end of an aisle. An aisle on another floor looks the same to the rays, so some of that should carry over. But on these levels' open floors, where a walker's path ends has nothing to do with the walls. The network may have learned there that "an open floor ahead" means "keep walking" only because that is what happened on these levels, and on another map it need not hold. The lab has not measured this on other maps. Tools → Train can collect data on a painted map and test the built-in model there, and that is the experiment to run before trusting it.
Q: What would it take to predict people who react to the robot's plan, not only to its current position?
A: Give the predictor the robot's intended path (the planned trajectory for the next few seconds) as an input, and train it on runs where that path varies. The planner and the predictor then depend on each other. Either they take turns (plan, predict given the plan, replan) or they are solved together. Interactive prediction and game-theoretic planning start from this coupling, and the lab does not model it.

## Check yourself
Q: The first layer maps 24 inputs to 64 hidden units. How many parameters does it have, weights and biases?
Answer: 1600
How: There are 64 × 24 = 1 536 weights and 64 biases, which makes 1 600.
