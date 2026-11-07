group: saf
title: Something breaks: detect it, react, in time

<p><b>Why this matters.</b> In the last lesson nothing was broken. In this one you break things on purpose, in the middle of a mission: a sensor dies, the beacons go dark, or a motor gets weaker. A fault does not hurt anyone straight away. There is a time window between the moment something fails and the moment someone is hurt, and functional safety is about using that window. The robot has to notice the fault and then get into a state where the fault can do no harm, before the window closes. This lesson measures the window, the detection and the reaction on the busy floor. It also finds a fault that the stack never notices at all.</p>
<p><b>In the standards.</b> Faults are what ISO 26262 deals with. For each way a part can fail, it asks for a safety mechanism that notices the failure and brings the robot to a safe state while the window is still open. It calls that window the fault tolerant time interval. It also asks for the failures to be listed before anything is built. A failure-mode analysis (FMEA) goes through the parts one by one, and a fault tree works back from each harm. The aim is to find a fault like the last one in this lesson, which nothing notices, on paper first. There is more on ISO 26262 and the other three standards in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> Three moments matter. The fault happens at $t_f$, and the stack detects it at $t_d$. If nothing reacted, the fault would cause harm at $t_h$. The fault tolerant time interval is $t_h - t_f$. The stack is safe against the fault if the detection and the reaction that removes the danger both fit inside the interval:</p>
<!-- math -->
$$\underbrace{(t_d - t_f)}_{\text{detection}} + \underbrace{T_{react}}_{\text{reaction}} \;<\; \underbrace{(t_h - t_f)}_{\text{fault tolerant time interval}}$$
<!-- /math -->
<p>The interval depends on the situation as well as on the robot. The same lidar failure is harmless in an empty corridor and urgent in a crowded aisle. A fault that is never detected has $t_d = \infty$. No safety mechanism covers it, and only a change to the design can make it safe.</p>
<!-- math -->
<p><b>Where it comes from.</b> The three moments, the measured windows, and the failure-mode table built from the Sensors switchboard are in <a class="chref" href="#notes=ch8/6-faults-detection-and-the-time-budget">chapter 8 §6</a>.</p>
<!-- /math -->
<p><b>What the lab does.</b> The fault schedule (a setting, <code>sched</code>) changes a setting at a given time. The Try buttons use it 30 s into L5's mission, to switch the lidar off, to turn every beacon off, or to bias one motor, and the event log records the moment. The health lights are the stack's detection, and a light turning amber or red is marked on the timeline. The <button type="button" class="linkbtn" data-met="">Metrics list</button> beside the event log has the <button type="button" class="linkbtn" data-met="Contacts by speed">contacts by speed</button>. The numbers quoted are for seed 7. With people on L5, the mission takes about two minutes.</p>

## Try: The lidar fails at 30 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"lidar":false}}]},"tab":"per","layers":{"agents":true,"lidar":true}}
Setup: L5 as it is until 30 s, then the lidar is switched off. With no scans, no people are detected, the map is not updated, and the particle filter has no lidar.
See: The Perceive light turns amber at 30.5 s, with "lidar off: no people detection". The robot drives on. It can no longer see the people, but it still knows where it is. It strikes a person at 51.3 s at 1.36 m/s, then two more at 54.7 and 79.3 s, and it reaches all five goals in 106 s. Seeds 2, 3 and 5 give the same. On seed 4 the particle filter, without the lidar, loses the robot at 42.5 s, and the robot holds where it is and never reaches the people.
Shows: Detection took half a second, and the harm came 21 s after the fault, so the window was wide. The stack noticed the fault and reported it, but did nothing about it. A safety mechanism needs a detection and a reaction, and for this fault the stack has only the detection.
Predict: The lidar dies at 30 s. When does a health light say so?
- Within a second
- Only at the first contact, about 20 s later
- Never: the lights watch the estimate, not the sensors
Answer: 0

## Try: A reaction in time: slow down at 31 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"lidar":false}},{"t":31,"set":{"vcruise":0.3}}]},"tab":"per","layers":{"agents":true}}
Setup: The same fault, with a reaction one second after it. The cruise speed is cut from 0.8 to 0.3 m/s, as a degraded mode for a robot that can no longer see people.
See: There is no contact at all. The mission pays for it: the robot reaches one goal of five in 300 s, and without the lidar the particle filter loses the robot at 61.5 s. On seeds 2 to 5 no run has a strike. Two runs have no contact at all, and the other two have bumps below 1 m/s, most of them people walking into the slow robot.
Shows: A reaction inside the window removes the strikes, because at 0.3 m/s the robot adds little to the speed of any contact. The safe state has a cost. The robot crawls, then gets lost, and people walk into it. Choosing a safe state means weighing the harm it prevents against the work it gives up. For that reason a real robot in a safe state usually also calls for help.
Predict: Slow to 0.3 m/s one second after the lidar fails. How many strikes, contacts above 1 m/s?
- None
- The same three
- One, the first, which comes too soon
Answer: 0

## Try: The same reaction, too late: slow down at 52 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"lidar":false}},{"t":52,"set":{"vcruise":0.3}}]},"tab":"per","layers":{"agents":true}}
Setup: The same fault and the same reaction, 22 s after the fault instead of one.
See: The strike at 51.3 s, at 1.36 m/s, happens just as it did with no reaction. After it come a bump at 56 s and people walking into the slowed robot. The robot reaches two goals of five in 300 s.
Shows: The reaction came after the window had closed, so it did nothing for the first person. The window here was 21.3 s, and any reaction later than that is too late for that person, whatever the reaction is. So the time to detect and the time to react are written as requirements with numbers in them. "The system shall react" is not enough.
Predict: The reaction comes at 52 s. How fast is the first contact, compared with no reaction?
- The same: the reaction comes after it
- Slower: the reaction catches up
- There is none: any reaction prevents it
Answer: 0

## Try: The beacons go dark at 30 s
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"bOff":"all"}}]},"tab":"loc","layers":{"belief":true}}
Setup: Every beacon goes off at 30 s. The particle filter still has the odometry and the lidar, which it matches against the map.
See: At first no light changes, because the filter coasts. At 40.5 s the Localize light turns red, as the position σ passes 1 m. The lost guard then holds the robot until it relocalizes, and it does so 64 times. The five goals take 158 s instead of 121, and there is one strike, at 120.5 s. On seeds 2 to 5 the light turns red between 37.5 and 46.5 s.
Shows: This fault is detected late, but in time for this mission. The uncertainty has to grow before the lost guard sees it, and that takes about ten seconds here. The lost guard is the only reaction to a fault that the stack has built in. Its safe state is holding still, which costs time in the same way the crawl did.
Predict: Every beacon goes dark at 30 s. When does the Localize light turn red?
- About ten seconds later, when the uncertainty has grown past 1 m
- At once: the light watches the beacon readings
- Never: the lidar alone keeps the robot localized
Answer: 0

## Try: A fault no light sees: one motor weaker
cfg: {"sim":true,"level":4,"set":{"sched":[{"t":30,"set":{"biasW":0.3}}]},"tab":"ctl"}
Setup: From 30 s one wheel's motor delivers less than it is told to, so the robot turns 0.3 rad/s more than commanded. The tracker corrects as much of this as it can see in the estimate.
See: After 30 s no light changes until a person is within 0.3 m, at 51.5 s. Then come five contacts, four of them strikes; without the fault there is one bump. The wall clearance falls to 0.10 m. On seeds 2 to 5, too, no light changes before the first contact.
Shows: No safety mechanism covers this fault. The robot drives worse and no check notices, because no check compares what the motors were told with what the robot did. Detecting it needs a monitor built for this fault. Here the monitor would compare the commanded turn rate with the measured one, which the gyro could provide. A failure-mode analysis is done to find faults like this one, which have a real effect and which no part of the design is meant to detect.
Predict: One motor goes weak at 30 s. Does any health light warn before the first contact?
- No: nothing compares the motors' commands with the motion
- Yes: Control turns amber at once
- Yes: Localize turns amber as the estimate drifts
Answer: 0

## Think about
Q: Write the failure-mode rows for the three faults: what fails, the effect, how it is detected, the reaction.
A: Lidar: people and new obstacles go unseen and the map stops updating; the Perceive light detects it in 0.5 s; there is no reaction built in (the slow-down of the second experiment would be one). Beacons: the estimate drifts; it is detected when σ passes 1 m, after about 10 s; the lost guard holds and relocalizes. Motor: the robot turns more than commanded; it is not detected, and there is no reaction. Each empty cell is a design task. Writing the table is how those tasks are found before someone is hurt.
Q: The fault tolerant time interval was 21 s for the lidar on this route. Is it 21 s for this robot?
A: No. It is the time from this fault, at this moment, to this harm. If the lidar fails at 48 s, the window is three seconds. If it fails on an empty floor, there may be no harm at all. A design has to allow for the worst case it can find over the domain, and finding that worst case is one reason for the search in the next lesson.
Q: The crawl removed the strikes and then got the robot lost. What would a better safe state be?
A: It could stop where it is and call for help, if stopping there blocks nobody. Or it could first crawl to the nearest place out of the aisles. What counts as a safe state depends on the situation, so a robot that may need one should know where its safe places are.

## Check yourself
Q: The lidar fails at 30.0 s and the first contact would come at 51.3 s. Detection takes 0.5 s, and slowing from 0.8 to 0.3 m/s at 0.5 m/s² takes the rest of the reaction. How many seconds of the window are left?
Answer: 19.8
Tolerance: 0.1
Unit: s
How: The window is $51.3 - 30.0 = 21.3$ s. Detection uses 0.5 s, and slowing takes $(0.8 - 0.3)/0.5 = 1$ s. That leaves $21.3 - 0.5 - 1 = 19.8$ s.
