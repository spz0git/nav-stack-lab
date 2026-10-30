group: saf
title: Hazards and risk: from situations to safety goals

<p><b>Why this matters.</b> A robot that has never touched anyone in testing may still be unsafe. A robot that touches people now and then may still be acceptable. The answer depends on how hard the contacts are, how often the robot is in the situations where they happen, and whether the person could have stepped aside. Hazard analysis and risk assessment turns that judgement into a procedure. You list the situations the robot meets and the harm it could do in each. You rate each one on severity, exposure and controllability. For the ones that rate high enough, you write down a goal the design must meet. This lesson does that for the busy floor and the parking lot, and it measures the ratings in the lab wherever it can.</p>
<p><b>In the standards.</b> The four steps below are ISO 26262's hazard analysis. It is done before any design, because the integrity level it gives each hazardous event sets how much care the rest of the development must take. ISO 21448 applies the same analysis to harm from a stack that works as built, such as a robot that drives into a person it predicted would walk on. UL 4600 asks for the hazards to be found by studying the actual floor, rather than taken from a fixed checklist. What each standard is for is in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> A hazard is something the robot can do that could hurt someone. A hazard in a given operational situation is a hazardous event. Each hazardous event is rated in three ways. Severity is how badly it could hurt. There are no injuries to rate in the lab, so it uses its own scale, the relative speed at contact: a touch below 0.3 m/s, a bump up to 1 m/s, and a strike above that. Exposure is the share of the operating time spent in the situation. Controllability is whether the people involved can avoid the harm by reacting in time. In a car that includes the driver, but the standard counts everyone exposed: passengers, pedestrians and anyone nearby. This robot has no driver, so the people involved are the people around it. The robot's own reaction is left out on purpose. The analysis rates what happens when the robot's behaviour goes wrong. The planner, the brakes and the monitors are what the integrity level then requires to be good enough, so counting them here as well would give credit for the same protection twice.</p>
$$v_{rel} = \lVert \mathbf v_r - \mathbf v_p \rVert \qquad E_s = \frac{T_s}{T_{op}}$$
<p>Here $\mathbf v_r$ and $\mathbf v_p$ are the true velocities of the robot and the person, as vectors, at the moment they touch. The relative speed $v_{rel}$ is the length of their difference; for a rack or a wall, $\mathbf v_p = 0$. $T_s$ is the time spent in the situation $s$, for example with a person within 2 m. $T_{op}$ is the operating time, the time the mission runs. The exposure $E_s$ is their ratio, the share of the operating time spent in the situation.</p>
<p><b>The analysis in four steps.</b> (1) List the operational situations the robot works in. (2) For each situation, ask what the robot could do there that would hurt someone. Each pairing of a situation with a hazard is a hazardous event. (3) Rate each event on severity, exposure and controllability, using the classes below, and read off its integrity level. (4) Write a safety goal for each event that gets a level. When several events share a goal, the goal takes the highest of their levels. The list of events, with their ratings and goals, is the hazard log. The busy floor's hazard log is worked out below the tables.</p>
<p><b>Severity, in the standard's classes.</b> ISO 26262 rates severity in four classes, S0 to S3, by the injuries that are likely. The lab has speeds but no injuries, so it lets each of its speed classes stand for one of the standard's. This mapping is an assumption made for teaching, and nothing in the lab measures it:</p>
<div class="exptab txt"><table><thead><tr><th>Lab class</th><th>Relative speed at contact</th><th>Stands for</th><th>The standard's class, in short</th></tr></thead><tbody>
<tr><td>touch</td><td>below 0.3 m/s</td><td>S0</td><td>no injuries</td></tr>
<tr><td>bump</td><td>0.3 to 1 m/s</td><td>S1</td><td>light or moderate injuries</td></tr>
<tr><td>strike</td><td>above 1 m/s</td><td>S2</td><td>severe injuries, survival likely</td></tr>
<tr><td>(none)</td><td>not used by the lab</td><td>S3</td><td>life-threatening or fatal injuries</td></tr>
</tbody></table></div>
<p><b>The integrity level.</b> Exposure is rated E0 to E4: E2 for a situation that takes up under 1 % of the operating time, E3 for 1 to 10 %, E4 for more than 10 %. Controllability is rated C0 to C3: C1 when nearly everyone involved (99 % or more) would avoid the harm, C2 when most would (90 % or more), C3 when fewer would. ISO 26262 combines the three classes into an integrity level, from QM up to D. The lab does not reproduce the standard's table. The rule behind the table is short: add the three class numbers, and read the level from the sum.</p>
<div class="exptab txt"><table><thead><tr><th>S + E + C</th><th>Integrity level</th></tr></thead><tbody>
<tr><td>10 (S3, E4, C3: the worst on every scale)</td><td>D, the most rigorous</td></tr>
<tr><td>9</td><td>C</td></tr>
<tr><td>8</td><td>B</td></tr>
<tr><td>7</td><td>A</td></tr>
<tr><td>6 or less, or any class 0</td><td>QM: ordinary quality management, no integrity level</td></tr>
</tbody></table></div>
<p><b>The robot's side: its avoidance margin.</b> What the robot itself can still do about a person ahead is a separate question. The lab gives it a name of its own, so that it does not get mixed into controllability. The robot can avoid a contact as long as the time to contact is longer than the time it needs to stop:</p>
$$t_{stop} = t_{react} + \frac{v}{a_{max}} \qquad m = TTC - t_{stop}$$
<p>Here $TTC$ is the time to contact: the gap to the person divided by the speed at which the two are closing. $v$ is the robot's speed, $a_{max}$ its braking limit and $t_{react}$ the time before braking starts. $m$ is the margin, in seconds. On L5 the robot drives at 0.8 m/s with a 0.8 m/s² braking limit, one 50 ms control tick and a 0.15 s actuator lag. That makes $t_{stop}$ about 1.2 s. With a time to contact under about 1 s the margin is negative, and the robot can no longer stop in time. <button type="button" class="linkbtn" data-met="Time to contact">Metrics → Time to contact</button> shows the smallest value in the run and the seconds spent under 1 s. The margin is evidence of how well a design meets the safety goal. It does not change the rating, because the rating assumes that the robot's own avoidance has failed.</p>
<p><b>The hazard log for L5, the busy floor.</b> On L5 the robot drives from goal to goal along aisles lined with racks, and people walk the same aisles on routes of their own. The analysis starts with the situations. You ask where the robot spends its time and who is around it there. Four situations cover the busy floor. In OS1 the robot drives down an aisle that a person is walking in. In OS2 it passes the end of a rack, where a person can come out from behind the rack before the lidar has seen them. In OS3 it stands still in an aisle, waiting for a person to pass or stopped at a goal. In OS4 it drives close along a rack. Next you ask what the robot could do that would cause harm. There are three hazards: it drives into a person, it stops where a person walks into it, and it drives into a rack. Each hazard is paired with the situations where it can happen. Driving into a person belongs with OS1 and OS2, being walked into with OS3, and driving into a rack with OS4. OS2 has the same hazard as OS1. It is listed on its own because the person appears with almost no warning and the situation takes up much less of the time, so its ratings come out differently. The pairs give four hazardous events:</p>
<div class="exptab txt"><table><thead><tr><th>Event</th><th>Situation and hazard</th><th>S</th><th>E</th><th>C</th><th>Level</th></tr></thead><tbody>
<tr><td>HE1</td><td>OS1: the robot drives into a person walking in the aisle</td><td>S2</td><td>E4</td><td>C3</td><td>C</td></tr>
<tr><td>HE2</td><td>OS2: the robot drives into a person stepping out from behind a rack</td><td>S2</td><td>E3</td><td>C3</td><td>B</td></tr>
<tr><td>HE3</td><td>OS3: a person walks into the robot standing still</td><td>S1</td><td>E4</td><td>C1</td><td>QM</td></tr>
<tr><td>HE4</td><td>OS4: the robot drives into a rack</td><td>S0</td><td>E4</td><td>C3</td><td>QM</td></tr>
</tbody></table></div>
<p><b>HE1.</b> The robot drives into a person walking in the aisle. For severity, the analysis asks how hard the contact would be if nothing prevented it. In the first Try the robot ignores the people, and it strikes them at 1.36 to 1.60 m/s. That is above 1 m/s, a strike, so the class is S2. For exposure, it asks how much of the time the robot spends in the situation. In the Try runs a person is within 2 m of the robot for 17 to 30 % of the time. That is more than 10 %, so the class is E4. For controllability, it asks whether the person would get out of the way in time. A person carrying a box or looking at a phone would not, so the analysis takes no credit for people stepping aside. It takes none for the robot's own braking either, because the robot's behaviour is what is being rated. That gives C3. The sum is 2 + 4 + 3 = 9, and the level is C. If the analysis gave the people credit for stepping aside, C2, the sum would be 8 and the level B. The second Try shows what that credit assumes.</p>
<p><b>HE2.</b> The harm is the same as in HE1, but the situation is different. The person is behind a rack, and the lidar cannot see them until they are a metre or two away. The robot would meet them at the same speeds, so the severity is S2 again. Neither the person nor the robot has time to react, so the controllability is C3 again. The exposure is lower. The robot passes a rack end with a person just behind it for a few percent of the time, between 1 and 10 %, so the class is E3. This exposure class is a judgement: the lab does not measure the time spent in this situation. The sum is 2 + 3 + 3 = 8, and the level is B.</p>
<p><b>HE3.</b> A person who is not looking walks into the robot while it waits. The robot is not moving, so the contact happens at the person's walking speed, which is below 1 m/s and so a bump at most: S1. The robot that waits for people spends 28 % of its time near them (the third Try). That is more than 10 %, so the exposure is E4. A robot standing still is easy to see and easy to walk round, and nearly everyone would do so, so the controllability is C1. The sum is 1 + 4 + 1 = 6, which gives QM.</p>
<p><b>HE4.</b> The robot drives close to racks for much of the time, E4, and a rack cannot move out of the way, C3. But a rack contact hurts no one in this lab, so the severity is S0, and any class 0 gives QM. The contact is damage to property. It stays on the log and is handled by ordinary quality management. A load falling off a struck rack would be a separate hazard to people, and the lab does not model it. HE4 still matters here. In the fourth Try, at two of the other seeds, the robot touches a rack while it makes room for people. The change that removes the person contacts makes rack contacts more likely.</p>
<p><b>The safety goal.</b> HE1 and HE2 share one goal: while the robot drives, no contact with a person above 0.3 m/s, so nothing worse than a touch. The goal takes the higher of their two levels, C. HE3 and HE4 get no safety goal, but they stay on the log, because a design change can move their ratings. The speed planner, for example, raises HE3's exposure. The Try buttons below measure how close each design comes to the goal.</p>
<p><b>Where it comes from.</b> The relative speed is computed from the robot's and the person's true velocities at the first tick of the contact. Exposure is counted only while the mission runs. <a class="chref" href="#notes=ch8/3-hazard-analysis-and-risk-assessment">The three scales, the integrity-level rule, and the measured table: chapter 8 §3</a></p>
<p><b>What the lab does.</b> The lab records every contact with its speed and class, in <button type="button" class="linkbtn" data-met="Contacts by speed">Metrics → Contacts by speed</button>, beside the event log. <button type="button" class="linkbtn" data-met="Person within 2 m">Person within 2 m</button> counts the seconds of driving during which a person is within 2 m of the robot. That is the exposure of the busy floor's main situation. On the car, Reversing counts the seconds spent in reverse. You make the people react under Vehicle → People. The numbers quoted are for seed 7, counted up to Mission complete.</p>

## Try: Ignore the people
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: L5, the busy floor, with the trackers set to ignore the people. The robot drives its path at cruise speed through scripted people who never step aside.
See: A person is within 2 m of the robot for 18.5 of the 106 s. The contacts:
| Run | Contacts with a person | Speeds (m/s) |
|---|---|---|
| this run | 3, at 51, 54 and 79 s | 1.36, 1.40 and 1.60 |
| seeds 2 to 5 | the same three | the same |
Look at the speeds. All three contacts are strikes, on every seed, because scripted people and a robot that does not react meet in the same way every time.
Shows: This run rates the worst row of the hazard log, HE1. The robot and the person meet head on or at an angle, so the relative speed is up to the robot's cruise speed plus the person's walking speed. The severity follows from the speeds the domain allows, and it comes out the same on every seed. The exposure is low, 17 % of the time, because a robot that never waits passes people quickly.
Predict: The robot ignores the people, and the people ignore the robot. At what relative speed do the contacts happen?
- Above 1 m/s: strikes, the robot's speed and the person's together
- Below 0.3 m/s: touches, since the robot brushes past
- Between: bumps, one walking speed
Answer: 0

## Try: People who step aside
cfg: {"sim":true,"level":4,"set":{"spd":"none","people":"reactive"},"tab":"ctl"}
Setup: The same robot, still ignoring the people. The people now react, and steer round the robot with social forces.
See: The contacts:
| Run | Contacts with a person | Speeds (m/s) |
|---|---|---|
| this run | 2, at 55 and 80 s | 0.61 and 0.87 |
| seeds 2 to 5 | two or three | 0.56 to 0.91 |
Look at the speeds. Every contact is a bump, and none is a strike.
Shows: This run measures controllability. The people avoid some of the harm. They cannot keep clear of the robot entirely, since it drives straight at them, but they turn a head-on strike into a glancing bump. A hazard analysis that takes credit for this assumes that every person is looking and able to step aside, and a person carrying a box is not. For this reason, analyses of driverless systems usually take no credit for it.
Predict: Same robot, but the people now step aside. What changes?
- The contacts are slower: bumps instead of strikes
- There are no contacts at all
- Nothing: the robot still drives into them at the same speed
Answer: 0

## Try: The speed planner
cfg: {"sim":true,"level":4,"tab":"ctl"}
Setup: L5 as it is. The speed planner slows the robot along its path for the people it tracks, and the people are scripted again.
See: The contacts:
| Run | Contacts with a person | Speeds (m/s) |
|---|---|---|
| this run | 1, at 51.6 s, a bump | 0.73 |
| seeds 2 to 5 | 1 on every run | 0.71 to 1.12 |
Now look at the exposure. A person is within 2 m of the robot for 33.4 of the 121 s.
Shows: The speed planner lowers the severity, from three strikes to one bump, and raises the exposure, from 17 % to 28 %. A robot that waits for people spends more time near them. So exposure depends on the robot's own behaviour as well as on the floor, and the lab measures it for each design instead of assuming one value. Lesson 3 looks at the one contact that remains, which is the same on every seed.
Predict: With the speed planner, how long is a person within 2 m of the robot, compared with the 18.5 s when it ignored them?
- Longer: it slows and waits near people
- Shorter: it keeps away from them
- About the same: the people walk the same routes
Answer: 0

## Try: The speed planner, people who step aside
cfg: {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"ctl"}
Setup: The speed planner, with people who react.
See: The robot does not touch a person. The closest approach is 0.18 m, and a person is within 2 m for 37 of the 122 s. On seeds 2 to 5 no run touches a person, but in two of the four runs the robot touches a rack while it makes room.
Shows: This is the only configuration in the lesson that meets the safety goal, nothing above a touch, on every seed. It meets it only because the people move out of the way as well. The hazard log has to record that as an assumption, which the safety case will later have to defend or drop. The rack contacts show that the change which removed the person contacts made HE4 happen more often.
Predict: The speed planner with people who react. How many contacts with a person?
- None
- One, as with scripted people
- Two or three, as when the robot ignores them
Answer: 0

## Try: Reversing in the parking lot
cfg: {"sim":true,"level":5,"tab":"ctl"}
Setup: L6, the car parking in four bays, with people crossing the lanes and pausing at the ends of their walks. Reversing is a new operational situation, in which the car's rear becomes its front.
See: The car has a person within 2 m for 58 s of this run.
| Run | Reversing (s) | Contacts with a person |
|---|---|---|
| this run | 31 of 148 | none (closest 0.32 m) |
| seeds 2 to 5 | 30 to 39 | one bump, 0.43 m/s |
Look at the last column. One of the runs on the four other seeds bumps a person, and no run has a strike.
Shows: Reversing has a high exposure: the car spends a fifth of the time in reverse, and two fifths with a person near. Its severity is low here, because the car manoeuvres slowly and any contact stays a bump. Each situation gets its own rating, so the hazard log lists the situations as well as the hazards.

## Think about
Q: Ignoring the people gave three strikes on every seed; the speed planner one bump on every seed. Which is the larger risk reduction, the severity or the count?
A: The severity. Strikes at 1.4 to 1.6 m/s became a bump at about 0.7 m/s, which is half the speed and one class down, while the count went from three to one. The energy of an impact grows with the square of its speed, so halving the speed removes three quarters of the energy. A hazard analysis rates severity first for this reason.
Q: Why does the speed planner's exposure go up while its severity goes down?
A: It gets the lower speeds by waiting near people. It slows behind a walker, or holds at an aisle end while someone crosses, and each wait is time within 2 m. A design that drove round people at a distance would lower both. The planning lessons try this with answers at the level of the route, and the routes get longer.
Q: The integrity level falls one step for each step down on any scale. If a hazardous event is rated at the top of all three scales, what single change gives the largest reduction?
A: Any one step down on any scale lowers the level by one, so on paper no single change does more than another. In practice a design can usually change severity and controllability, while exposure is set mostly by the domain and the mission. Lowering the speed limit near people moves severity. A warning light or sound that makes people look up moves controllability.

## Check yourself
Q: On the busy floor with the speed planner, a person was within 2 m for 33.4 s of the 121.1 s the mission ran. What is the exposure to that situation, in percent?
Answer: 27.6
Tolerance: 0.3
Unit: %
How: $E = T_s / T_{op} = 33.4 / 121.1 = 0.276$, which is 27.6 %.
