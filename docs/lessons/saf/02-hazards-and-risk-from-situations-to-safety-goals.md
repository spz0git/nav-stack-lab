group: saf
title: Hazards and risk: from situations to safety goals

<p><b>Why this matters.</b> A robot that has never touched anyone in testing is not thereby safe, and one that touches people now and then is not thereby unacceptable: it depends on how badly, how often, and whether the person could have stepped aside. Hazard analysis and risk assessment turns that judgement into a procedure. List the situations the robot meets, the harm it could do in each, rate each on severity, exposure and controllability, and state, for the ones that matter, a goal the design must meet. This lesson does it for the busy floor and the parking lot, with every rating measured rather than guessed.</p>
<p><b>The standards.</b> The procedure is ISO 26262's concept-phase analysis (part 3, clause 6: the classification in 6.4.3, the integrity level in 6.4.4, the safety goals in 6.4.5); ISO 21448 applies the same analysis to hazards that come from the function itself rather than from a failure (clause 6, with the acceptance criteria for what risk remains in 6.5), and UL 4600 (clause 6) asks for a hazard log the safety case refers to, built without relying on a fixed checklist. The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition (2023)) and have not been checked against the texts.</p>
<p><b>The idea.</b> A hazard is something the robot can do that could hurt someone; in a given operational situation it becomes a hazardous event. Each is rated three ways. Severity: how badly it could hurt. The lab has no injuries to rate, so it uses the relative speed at contact: a touch below 0.3 m/s, a bump up to 1 m/s, a strike above. Exposure: the share of the operating time spent in the situation. Controllability: whether the situation can still be brought under control so that the harm is avoided. In a car the standard rates the driver's reaction. This robot has no driver, so the lab rates controllability from the robot's side: can something on the robot that still works when the hazard occurs, an independent safety stop for instance, detect the person and stop or turn away in time? The people stepping aside earn no credit; that is an assumption, not a control.</p>
$$v_{rel} = \lVert \mathbf v_r - \mathbf v_p \rVert \qquad E_s = \frac{T_s}{T_{op}}$$
<p>Here $\mathbf v_r$ is the robot's true velocity and $\mathbf v_p$ the person's (zero for a rack), in m/s at the first tick of the contact, and $\lVert \cdot \rVert$ is the length of a vector, so $v_{rel}$ is the speed at which the two meet. $T_s$ is the time spent in situation $s$ (on the busy floor, a person within 2 m of the robot) and $T_{op}$ the operating time, the time the mission runs, so the exposure $E_s$ is a share between 0 and 1: 0.17 means the situation takes about a sixth of the run.</p>
<p><b>The three scales.</b> ISO 26262 rates each scale in numbered classes. The meanings below paraphrase the standard; the third column is how the lab measures each class.</p>
<div class="exptab hara"><table><thead><tr><th>Severity</th><th>Meaning</th><th>The lab's scale: relative speed at contact</th><th>In this lesson</th></tr></thead><tbody>
<tr><td>S0</td><td>no injuries</td><td>no contact, or a touch below 0.3 m/s</td><td>the speed planner with people who step aside</td></tr>
<tr><td>S1</td><td>light to moderate injuries</td><td>a bump, 0.3 to 1 m/s</td><td>the speed planner's one contact, 0.73 m/s</td></tr>
<tr><td>S2</td><td>severe injuries, survival likely</td><td>a strike, 1 to 2 m/s</td><td>ignoring the people: 1.36 to 1.60 m/s</td></tr>
<tr><td>S3</td><td>life-threatening or fatal injuries</td><td>a strike above 2 m/s</td><td>a robot near its 2 m/s limit meeting a walker head on</td></tr>
</tbody></table></div>
<div class="exptab hara"><table><thead><tr><th>Exposure</th><th>Meaning</th><th>Share of the operating time</th><th>In this lesson</th></tr></thead><tbody>
<tr><td>E0</td><td>incredible</td><td>never in practice</td><td></td></tr>
<tr><td>E1</td><td>very low</td><td>rare: rated by how seldom it happens, not for how long</td><td></td></tr>
<tr><td>E2</td><td>low</td><td>under 1 %</td><td></td></tr>
<tr><td>E3</td><td>medium</td><td>1 to 10 %</td><td></td></tr>
<tr><td>E4</td><td>high</td><td>over 10 %</td><td>a person within 2 m: 17 % to 30 % of the run; reversing in the parking lot: about 21 %</td></tr>
</tbody></table></div>
<div class="exptab hara"><table><thead><tr><th>Controllability</th><th>Meaning</th><th>From the robot's side</th><th>In this lesson</th></tr></thead><tbody>
<tr><td>C0</td><td>controllable in general</td><td>nothing to react to: the event harms no one</td><td></td></tr>
<tr><td>C1</td><td>simply controllable</td><td>an independent measure on the robot avoids the harm in 99 % of cases or more</td><td>the lidar safety stop, if it is on and shown to stop in time</td></tr>
<tr><td>C2</td><td>normally controllable</td><td>it avoids the harm in 90 % of cases or more</td><td></td></tr>
<tr><td>C3</td><td>difficult or uncontrollable</td><td>less than 90 %, or nothing independent is left to react</td><td>L5 as it is: the safety stop is off, and the people's own avoidance earns no credit</td></tr>
</tbody></table></div>
<p>The shares in the exposure and controllability rows are the guidance usually quoted for the standard (the controllability shares are the ones it gives for drivers); the lab applies them to the robot. A class 0 on any scale needs no integrity level.</p>
<p><b>The integrity level.</b> ISO 26262 combines the three classes into an integrity level from QM (ordinary quality management, no extra rigour) through A up to D (the most rigour in development and testing). The table below is built from one rule: add the three class numbers, and 10 gives D, 9 gives C, 8 gives B, 7 gives A, anything lower QM. So each step down on any one scale lowers the level by one step.</p>
<div class="exptab hara asil"><table><thead><tr><th>Severity</th><th>Exposure</th><th>C1</th><th>C2</th><th>C3</th></tr></thead><tbody><tr><td>S1</td><td>E1</td><td>QM</td><td>QM</td><td>QM</td></tr><tr><td></td><td>E2</td><td>QM</td><td>QM</td><td>QM</td></tr><tr><td></td><td>E3</td><td>QM</td><td>QM</td><td>A</td></tr><tr><td></td><td>E4</td><td>QM</td><td>A</td><td>B</td></tr><tr><td>S2</td><td>E1</td><td>QM</td><td>QM</td><td>QM</td></tr><tr><td></td><td>E2</td><td>QM</td><td>QM</td><td>A</td></tr><tr><td></td><td>E3</td><td>QM</td><td>A</td><td>B</td></tr><tr><td></td><td>E4</td><td>A</td><td>B</td><td>C</td></tr><tr><td>S3</td><td>E1</td><td>QM</td><td>QM</td><td>A</td></tr><tr><td></td><td>E2</td><td>QM</td><td>A</td><td>B</td></tr><tr><td></td><td>E3</td><td>A</td><td>B</td><td>C</td></tr><tr><td></td><td>E4</td><td>B</td><td>C</td><td>D</td></tr></tbody></table></div>
<p><b>Rated in the lab.</b> Driving into a person in an aisle on the busy floor, if the response to people fails: severity S2 (the first Try's strikes at 1.36 to 1.60 m/s), exposure E4 (a person within 2 m for 17 % of the run), controllability C3 (the safety stop is off, so nothing independent slows the robot). That is 2 + 4 + 3 = 9, level C. With the lidar safety stop on, and shown to stop in time in 99 % of cases, it would be C1: 2 + 4 + 1 = 7, level A. The lab's safety goal for the busy floor: no contact with a person above 0.3 m/s while the robot drives, nothing worse than a touch.</p>
<p><b>Where it comes from.</b> The relative speed is the robot's true velocity minus the person's at the first tick of the contact; exposure is counted only while the mission runs. <a class="chref" href="#notes=ch8/3-hazard-analysis-and-risk-assessment">The three scales, the integrity-level rule, and the measured table: chapter 8 §3</a></p>
<p><b>What the lab does.</b> Every contact is recorded with its speed and class: Metrics → Contacts by speed, beside the event log. Person within 2 m counts the seconds, out of the seconds driving, that a person is within 2 m of the robot, the exposure of the busy floor's main situation; on the car, Reversing counts the seconds in reverse. People react under Vehicle → People. The numbers are seed 7, counted up to Mission complete.</p>

## Try: Ignore the people
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: L5, the busy floor, with the trackers ignoring the people: the robot drives its path at cruise speed through scripted people who never step aside.
See: A person is within 2 m for 18.5 of the 106 s. The contacts:
| Run | Contacts with a person | Speeds (m/s) |
|---|---|---|
| this run | 3, at 51, 54 and 79 s | 1.36, 1.40 and 1.60 |
| seeds 2 to 5 | the same three | the same |
Look at the speeds: three strikes, on every seed, because scripted people and an unreacting robot meet the same way every time.
Shows: The worst row of the hazard log, rated. The relative speed is the robot's cruise and the person's walk added, since they meet head on or at an angle: the severity is set by the speeds the domain allows, not by luck. Exposure is low, 17 % of the time, because a robot that never waits passes people quickly.
Predict: The robot ignores the people, and the people ignore the robot. At what relative speed do the contacts happen?
- Above 1 m/s: strikes, the robot's speed and the person's together
- Below 0.3 m/s: touches, since the robot brushes past
- Between: bumps, one walking speed
Answer: 0

## Try: People who step aside
cfg: {"sim":true,"level":4,"set":{"spd":"none","people":"reactive"},"tab":"ctl"}
Setup: The same robot, still ignoring the people, but the people now react: they steer round the robot with social forces.
See: The contacts:
| Run | Contacts with a person | Speeds (m/s) |
|---|---|---|
| this run | 2, at 55 and 80 s | 0.61 and 0.87 |
| seeds 2 to 5 | two or three | 0.56 to 0.91 |
Look at the speeds: every contact is a bump, and none is a strike.
Shows: What the people's own avoidance is worth, measured: they avert some of the harm. Not by avoiding the robot entirely, since it drives straight at them, but by turning a head-on strike into a glancing bump. A hazard analysis that took credit for this would assume every person is looking and able to step aside; a person carrying a box is not. That is why the lab rates controllability from the robot's side and gives the people no credit, as analyses of driverless systems usually do.
Predict: Same robot, but the people now step aside. What changes?
- The contacts are slower: bumps instead of strikes
- There are no contacts at all
- Nothing: the robot still drives into them at the same speed
Answer: 0

## Try: The speed planner
cfg: {"sim":true,"level":4,"tab":"ctl"}
Setup: L5 as it is: the speed planner slows the robot along its path for the tracked people, and the people are scripted again.
See: The contacts:
| Run | Contacts with a person | Speeds (m/s) |
|---|---|---|
| this run | 1, at 51.6 s, a bump | 0.73 |
| seeds 2 to 5 | 1 on every run | 0.71 to 1.12 |
Now look at the exposure: a person is within 2 m for 33.4 of the 121 s.
Shows: The design lowers the severity, from three strikes to one bump, and raises the exposure, from 17 % to 28 %: a robot that waits for people spends more time near them. Exposure is not a fact about the floor; it depends on the robot's own behaviour, which is why the lab measures it rather than assuming it. The one remaining contact, the same on every seed, is the subject of lesson 3.
Predict: With the speed planner, how long is a person within 2 m of the robot, compared with the 18.5 s when it ignored them?
- Longer: it slows and waits near people
- Shorter: it keeps away from them
- About the same: the people walk the same routes
Answer: 0

## Try: The speed planner, people who step aside
cfg: {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"ctl"}
Setup: The speed planner, and people who react.
See: No contact with a person; the closest approach is 0.18 m, and a person is within 2 m for 37 of the 122 s. On seeds 2 to 5 no run touches a person, though two of the four touch a rack while making room.
Shows: The only configuration here that meets the safety goal, nothing above a touch, on every seed, and it meets it only with credit for the people's own avoidance. The hazard log has to say so, as an assumption the safety case will have to defend or drop. The rack contacts are a reminder that a fix for one hazard can feed another.
Predict: The speed planner with people who react. How many contacts with a person?
- None
- One, as with scripted people
- Two or three, as when the robot ignores them
Answer: 0

## Try: Reversing in the parking lot
cfg: {"sim":true,"level":5,"tab":"ctl"}
Setup: L6, the car parking in four bays, with people crossing the lanes and pausing at the ends of their walks. Another operational situation: reversing, where the car's rear is its front.
See: The car has a person within 2 m for 58 s of this run.
| Run | Reversing (s) | Contacts with a person |
|---|---|---|
| this run | 31 of 148 | none (closest 0.32 m) |
| seeds 2 to 5 | 30 to 39 | one bump, 0.43 m/s |
Look at the last column: one run of the four other seeds bumps a person, and no run has a strike.
Shows: A situation with high exposure (a fifth of the time in reverse, two fifths near a person) and, here, low severity: slow manoeuvres keep any contact to a bump. The rating is per situation, which is why the hazard log lists situations, not just hazards.

## Think about
Q: Ignoring the people gave three strikes on every seed; the speed planner one bump on every seed. Which is the larger risk reduction, the severity or the count?
A: The severity: strikes at 1.4 to 1.6 m/s became a bump at about 0.7 m/s, half the speed and one class down, while the count went from three to one. The energy of an impact grows with the square of its speed, so halving the speed takes three quarters of it away; a hazard analysis rates severity first for that reason.
Q: Why does the speed planner's exposure go up while its severity goes down?
A: It achieves the lower speeds by waiting near people: slowing behind a walker, holding at an aisle end while someone crosses. Each wait is time within 2 m. A design that drove round people at a distance would lower both, which is what the route-level answers of the planning lessons try to do, at the cost of longer routes.
Q: The integrity level falls one step for each step down on any scale. If a hazardous event is rated at the top of all three scales, what single change gives the largest reduction?
A: Any one step down gives one level; but severity and controllability are usually what a design can change, since exposure is set by the domain and the mission. Lowering the speed limit near people moves severity; an independent stop that halts the robot in time, such as the lidar safety stop, moves controllability. A warning light that makes people look helps them step aside, which the lab does not credit.

## Check yourself
Q: On the busy floor with the speed planner, a person was within 2 m for 33.4 s of the 121.1 s the mission ran. What is the exposure to that situation, in percent?
Answer: 27.6
Tolerance: 0.3
Unit: %
How: $E = T_s / T_{op} = 33.4 / 121.1 = 0.276$, 27.6 %.
