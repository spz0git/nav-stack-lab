group: saf
title: Hazards and risk: from situations to safety goals

<p><b>Why this matters.</b> A robot that has never touched anyone in testing is not thereby safe, and one that touches people now and then is not thereby unacceptable: it depends on how badly, how often, and whether the person could have stepped aside. Hazard analysis and risk assessment turns that judgement into a procedure. List the situations the robot meets, the harm it could do in each, rate each on severity, exposure and controllability, and state, for the ones that matter, a goal the design must meet. This lesson does it for the busy floor and the parking lot, with every rating measured rather than guessed.</p>
<p><b>The standards.</b> The procedure is ISO 26262's concept-phase analysis (part 3, clause 6: the classification in 6.4.3, the integrity level in 6.4.4, the safety goals in 6.4.5); ISO 21448 applies the same analysis to hazards that come from the function itself rather than from a failure (clause 6, with the acceptance criteria for what risk remains in 6.5), and UL 4600 (clause 6) asks for a hazard log the safety case refers to, built without relying on a fixed checklist. The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition (2023)) and have not been checked against the texts.</p>
<p><b>The idea.</b> A hazard is something the robot can do that could hurt someone; in a given operational situation it becomes a hazardous event. Each is rated three ways. Severity, on the lab's own scale since there are no injuries to rate here: the relative speed at contact, a touch below 0.3 m/s, a bump up to 1 m/s, a strike above. Exposure: the share of the operating time spent in the situation. Controllability: whether the people involved can avoid the harm.</p>
$$v_{rel} = \lVert \mathbf v_r - \mathbf v_p \rVert \qquad E_s = \frac{T_s}{T_{op}}$$
<p>Here $\mathbf v_r$ and $\mathbf v_p$ are the true velocities of the robot and the person, as vectors, at the moment they touch, and $v_{rel}$, the length of their difference, is the relative speed; for a rack or a wall $\mathbf v_p = 0$. $T_s$ is the time spent in the situation $s$ (for example, with a person within 2 m), $T_{op}$ the operating time, the time the mission runs, and $E_s$ the exposure, the share of the one in the other.</p>
<p><b>The analysis in four steps.</b> (1) List the operational situations the robot works in. (2) For each, ask what the robot could do that hurts someone: each pairing of a situation with a hazard is a hazardous event. (3) Rate each event on severity, exposure and controllability, with the classes below, and read off its integrity level. (4) Write a safety goal for each event that gets a level; when several events share a goal, the goal takes the highest of their levels. The result is the hazard log. The busy floor's is worked out below the tables.</p>
<p><b>Severity, in the standard's classes.</b> ISO 26262 rates severity by the injuries likely, in four classes, S0 to S3. The lab has no injuries, only speeds, so it lets each of its speed classes stand for one of the standard's. That mapping is the lab's assumption for teaching, not a measurement:</p>
<div class="exptab txt"><table><thead><tr><th>Lab class</th><th>Relative speed at contact</th><th>Stands for</th><th>The standard's class, in short</th></tr></thead><tbody>
<tr><td>touch</td><td>below 0.3 m/s</td><td>S0</td><td>no injuries</td></tr>
<tr><td>bump</td><td>0.3 to 1 m/s</td><td>S1</td><td>light or moderate injuries</td></tr>
<tr><td>strike</td><td>above 1 m/s</td><td>S2</td><td>severe injuries, survival likely</td></tr>
<tr><td>(none)</td><td>not used by the lab</td><td>S3</td><td>life-threatening or fatal injuries</td></tr>
</tbody></table></div>
<p><b>The integrity level.</b> Exposure is rated E0 to E4: E2 for a situation that takes up under 1 % of the operating time, E3 for 1 to 10 %, E4 for more than 10 %. Controllability is rated C0 to C3: C1 when nearly everyone involved (99 % or more) would avoid the harm, C2 when most would (90 % or more), C3 when fewer would. ISO 26262 combines the three classes into an integrity level from QM up to D. The lab does not reproduce the standard's table, but the rule behind it is short: add the three class numbers.</p>
<div class="exptab txt"><table><thead><tr><th>S + E + C</th><th>Integrity level</th></tr></thead><tbody>
<tr><td>10 (S3, E4, C3: the worst on every scale)</td><td>D, the most rigorous</td></tr>
<tr><td>9</td><td>C</td></tr>
<tr><td>8</td><td>B</td></tr>
<tr><td>7</td><td>A</td></tr>
<tr><td>6 or less, or any class 0</td><td>QM: ordinary quality management, no integrity level</td></tr>
</tbody></table></div>
<p><b>The hazard log for L5, the busy floor.</b> The robot drives between goals along aisles lined with racks while people walk the aisles on their own routes. Its situations: OS1, driving down an aisle a person is walking in; OS2, passing the end of a rack, where a person can come out from behind it unseen; OS3, standing still in an aisle, waiting for a person or at a goal; OS4, driving close along a rack. Its hazards: it drives into a person, it stops where a person walks into it, it drives into a rack. Paired, they give four hazardous events:</p>
<div class="exptab txt"><table><thead><tr><th>Event</th><th>Situation and hazard</th><th>S</th><th>E</th><th>C</th><th>Level</th></tr></thead><tbody>
<tr><td>HE1</td><td>OS1: the robot drives into a person walking in the aisle</td><td>S2</td><td>E4</td><td>C3</td><td>C</td></tr>
<tr><td>HE2</td><td>OS2: the robot drives into a person stepping out from behind a rack</td><td>S2</td><td>E3</td><td>C3</td><td>B</td></tr>
<tr><td>HE3</td><td>OS3: a person walks into the robot standing still</td><td>S1</td><td>E4</td><td>C1</td><td>QM</td></tr>
<tr><td>HE4</td><td>OS4: the robot drives into a rack</td><td>S0</td><td>E4</td><td>C3</td><td>QM</td></tr>
</tbody></table></div>
<p><b>HE1.</b> Severity S2: the robot that ignores people strikes them at 1.36 to 1.60 m/s (the first Try). Exposure E4: a person is within 2 m of the robot for 17 to 30 % of the time (the Try runs). Controllability C3: the analysis takes no credit for people stepping aside, since a person carrying a box or looking at a phone does not. 2 + 4 + 3 = 9: level C. With credit for the people, C2, the sum would be 8 and the level B; the second Try shows what that credit assumes.</p>
<p><b>HE2.</b> The same harm in a different situation: a person the lidar cannot see until they are a metre or two away. S2 and C3 as for HE1; neither the person nor the robot has time to react. Exposure E3: passing a rack end with a person just behind it is a few percent of the time, not most of it. This class is a judgement, not a measurement. 2 + 3 + 3 = 8: level B.</p>
<p><b>HE3.</b> A person who is not looking walks into the robot while it waits. S1: at walking speed, a bump at most. E4: the robot that waits for people spends 28 % of its time near them (the third Try). C1: a robot standing still is easy to walk round. 1 + 4 + 1 = 6: QM.</p>
<p><b>HE4.</b> A rack contact hurts no one in this lab, so S0 and QM: it is damage to property, kept on the log and handled by ordinary quality management. A load falling off a struck rack would be a separate hazard to people, which the lab does not model. It still matters here: at two of the fourth Try's other seeds the robot touches a rack while making room for people, a fix for one hazard feeding another.</p>
<p><b>The safety goal.</b> HE1 and HE2 share one goal: no contact with a person above 0.3 m/s while the robot drives, nothing worse than a touch. It takes the higher of their levels, C. HE3 and HE4 get no safety goal, but they stay on the log: a design change can move them, as the speed planner moves HE3's exposure. The Try buttons below measure how close each design comes to the goal.</p>
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
Shows: Controllability, measured: the people avert some of the harm. Not by avoiding the robot entirely, since it drives straight at them, but by turning a head-on strike into a glancing bump. A hazard analysis that takes credit for this assumes every person is looking and able to step aside; a person carrying a box is not. That is why analyses of driverless systems usually take none.
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
A: Any one step down gives one level; but severity and controllability are usually what a design can change, since exposure is set by the domain and the mission. Lowering the speed limit near people moves severity; a warning light or sound that makes people look moves controllability.

## Check yourself
Q: On the busy floor with the speed planner, a person was within 2 m for 33.4 s of the 121.1 s the mission ran. What is the exposure to that situation, in percent?
Answer: 27.6
Tolerance: 0.3
Unit: %
How: $E = T_s / T_{op} = 33.4 / 121.1 = 0.276$, 27.6 %.
