group: saf
title: Something breaks: detect it, react, in time

<p><b>Why this matters.</b> The last lesson's failures had nothing broken. This one breaks things, mid-mission, on purpose: a sensor that dies, beacons that go dark, a motor that weakens. A fault is not yet harm. Between the moment something fails and the moment someone is hurt there is a time window, and functional safety is about using it: notice the fault, then put the robot into a state where the fault can do no harm, before the window closes. This lesson measures the window, the detection and the reaction on the busy floor, and finds a fault the stack never notices at all.</p>
<p><b>The standards.</b> ISO 26262 defines the fault tolerant time interval (part 1, clause 3), asks for safety mechanisms that detect faults and reach a safe state within it (part 4, clause 6), and for the inductive and deductive analyses that find the faults to begin with, FMEA and fault-tree analysis (part 9, clause 8). The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition (2023)) and have not been checked against the texts.</p>
<p><b>The idea.</b> Three moments: the fault at $t_f$, its detection at $t_d$, and the harm it would cause if nothing reacted, at $t_h$. The fault tolerant time interval is $t_h - t_f$; the stack is safe against the fault if detection plus the reaction that removes the danger fit inside it:</p>
$$\underbrace{(t_d - t_f)}_{\text{detection}} + \underbrace{T_{react}}_{\text{reaction}} \;<\; \underbrace{(t_h - t_f)}_{\text{fault tolerant time interval}}$$
<p>The interval is a property of the situation as much as of the robot: the same lidar failure is harmless in an empty corridor and urgent in a crowded aisle. A fault that is never detected has $t_d = \infty$: no safety mechanism covers it, and nothing short of the design can make it safe.</p>
<p><b>Where it comes from.</b> The three moments, the measured windows, and the failure-mode table built from the Sensors switchboard: <a class="chref" href="#notes=ch8/6-faults-detection-and-the-time-budget">chapter 8 §6</a>.</p>
<p><b>What the lab does.</b> The fault schedule (a setting, <code>sched</code>) changes a setting at a set time: the Try buttons switch the lidar off, turn every beacon off, or bias one motor, 30 s into L5's mission, and the event log says when. The health lights are the stack's detection; a light turning amber or red marks the timeline. The Metrics list beside the event log has the contacts by speed. Numbers are seed 7; with people on L5 the mission is about two minutes.</p>

## Try: The lidar fails at 30 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"lidar":false}}]},"tab":"per","layers":{"agents":true}}
Setup: L5 as it is until 30 s, then the lidar switched off: no scans, so no people detected, no map updates, no lidar for the particle filter.
See: The Perceive light turns amber at 30.5 s: "lidar off: no people detection". The robot drives on: it has lost the people but not its way, and it strikes a person at 51.3 s at 1.36 m/s, then two more at 54.7 and 79.3 s, all five goals in 106 s. On seeds 2, 3 and 5 the same; on seed 4 the particle filter loses itself at 42.5 s without the lidar, and the robot holds where it is and never reaches the people.
Shows: Detection took half a second; the harm came 21 s after the fault. The window was wide, and the stack wasted it: it noticed and reported the fault but did nothing about it. A safety mechanism is detection and a reaction; this stack has only the first half for this fault.
Predict: The lidar dies at 30 s. When does a health light say so?
- Within a second
- Only at the first contact, about 20 s later
- Never: the lights watch the estimate, not the sensors
Answer: 0

## Try: A reaction in time: slow down at 31 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"lidar":false}},{"t":31,"set":{"vcruise":0.3}}]},"tab":"per","layers":{"agents":true}}
Setup: The same fault, and a reaction one second after it: cruise speed cut from 0.8 to 0.3 m/s, a degraded mode for a robot that can no longer see people.
See: No contact at all. The price is the mission: one goal of five in 300 s, and without the lidar the particle filter loses the robot at 61.5 s. On seeds 2 to 5 no run has a strike: two have no contact at all, and the other two have bumps below 1 m/s, most of them people walking into the slow robot.
Shows: A reaction inside the window removes the strikes: at 0.3 m/s the robot's part of any contact is small. A safe state is not a useful state: the robot crawls and then gets lost, and people walk into it. Choosing a safe state is a trade between the harm it prevents and the job it gives up, which is why a real robot pairs it with a call for help.
Predict: Slow to 0.3 m/s one second after the lidar fails. How many strikes, contacts above 1 m/s?
- None
- The same three
- One, the first, which comes too soon
Answer: 0

## Try: The same reaction, too late: slow down at 52 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"lidar":false}},{"t":52,"set":{"vcruise":0.3}}]},"tab":"per","layers":{"agents":true}}
Setup: The same fault and the same reaction, 22 s after the fault instead of one.
See: The strike at 51.3 s, at 1.36 m/s, as with no reaction at all; then a bump at 56 s, and people walking into the slowed robot. Two goals of five in 300 s.
Shows: The same reaction, outside the window, is no reaction for the harm it was meant to prevent. The window here was 21.3 s; any reaction later than that is too late for the first person, whatever it does. That is why the time to detect and the time to react are requirements, with numbers, and not just "the system shall react".
Predict: The reaction comes at 52 s. How fast is the first contact, compared with no reaction?
- The same: the reaction comes after it
- Slower: the reaction catches up
- There is none: any reaction prevents it
Answer: 0

## Try: The beacons go dark at 30 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"bOff":"all"}}]},"tab":"loc","layers":{"belief":true}}
Setup: Every beacon off at 30 s. The particle filter keeps the lidar against the map and the odometry.
See: No light at first: the filter coasts. At 40.5 s the Localize light turns red, position σ above 1 m, and the lost guard holds the robot until it relocalizes; it does so 64 times, and the five goals take 158 s instead of 121, with one strike at 120.5 s. On seeds 2 to 5 the light turns red between 37.5 and 46.5 s.
Shows: A fault detected late but in time for this mission: the uncertainty has to grow before the lost guard sees it, about ten seconds here. The lost guard is the stack's one built-in reaction to a fault, and its safe state, holding still, is the same trade as the crawl: safe and slow.
Predict: Every beacon goes dark at 30 s. When does the Localize light turn red?
- About ten seconds later, when the uncertainty has grown past 1 m
- At once: the light watches the beacon readings
- Never: the lidar alone keeps the robot localized
Answer: 0

## Try: A fault no light sees: one motor weaker
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"biasW":0.3}}]},"tab":"ctl"}
Setup: From 30 s one wheel's motor delivers less than it is told, so the robot turns 0.3 rad/s more than commanded. The tracker corrects what it sees of it, through the estimate.
See: No light changes after 30 s until a person is within 0.3 m at 51.5 s. Then five contacts, four of them strikes, against one bump without the fault; the wall clearance falls to 0.10 m. On seeds 2 to 5 the same silence until the first contact.
Shows: A fault no safety mechanism covers: it degrades the robot without any check noticing, because no check compares what the motors were told with what the robot did. Detection needs a monitor built for the fault, here the commanded against the measured turn rate, which the gyro could give. A failure-mode analysis exists to find exactly these: faults whose effect is real and whose detection is nobody's job.
Predict: One motor goes weak at 30 s. Does any health light warn before the first contact?
- No: nothing compares the motors' commands with the motion
- Yes: Control turns amber at once
- Yes: Localize turns amber as the estimate drifts
Answer: 0

## Think about
Q: Write the failure-mode rows for the three faults: what fails, the effect, how it is detected, the reaction.
A: Lidar: people and new obstacles unseen, the map frozen; detected by the Perceive light in 0.5 s; no reaction built in (the slow-down of the second experiment would be one). Beacons: the estimate drifts; detected when σ passes 1 m, about 10 s; the lost guard holds and relocalizes. Motor: the robot turns more than commanded; not detected; no reaction. Each empty cell is a design task, and the table is how they are found before a person finds them.
Q: The fault tolerant time interval was 21 s for the lidar on this route. Is it 21 s for this robot?
A: No: it is the time from this fault, at this moment, to this harm. Fail the lidar at 48 s and the window is three seconds; fail it on an empty floor and there may be no harm at all. A design takes the worst case it can find over the domain, which is one reason the search of the next lesson matters.
Q: The crawl removed the strikes and then got the robot lost. What would a better safe state be?
A: Stop where it is and call for help, if stopping there blocks nobody; or crawl to the nearest place out of the aisles first. A safe state is defined for the situation, and a robot that needs one should know where its safe places are.

## Check yourself
Q: The lidar fails at 30.0 s and the first contact would come at 51.3 s. Detection takes 0.5 s, and slowing from 0.8 to 0.3 m/s at 0.5 m/s² takes the rest of the reaction. How many seconds of the window are left?
Answer: 19.8
Tolerance: 0.1
Unit: s
How: The window is $51.3 - 30.0 = 21.3$ s; detection uses 0.5 s and slowing $(0.8 - 0.3)/0.5 = 1$ s, so $21.3 - 0.5 - 1 = 19.8$ s remain.
