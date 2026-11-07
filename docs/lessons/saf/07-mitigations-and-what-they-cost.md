group: saf
title: Mitigations, and what they cost

<p><b>Why this matters.</b> The lessons so far found hazards: a person turning back, fog that hides people and makes up others, a lidar that dies. The next step is to change the system so that they do less harm, and every change has a price. A brake that reacts to things that are not there stops the robot for nothing. A robot that drives slower takes longer, and it meets different people at different moments. So you judge a mitigation by what it removes and by what it costs, measured on the same scenarios. Sometimes the measurement shows that it makes things worse. ISO 21448 asks for this step once its analysis has found an insufficiency. You change the robot, with a better sensor, a lower speed, a smaller domain or a stop when it is unsure. Then you test the changed robot again, because a fix can bring a hazard of its own. There is more on the standard in <a class="chref" href="#notes=ch8/1-the-four-standards-in-the-lab-s-words">chapter 8 §1</a>.</p>
<p><b>The idea.</b> Every mitigation here reduces a hazard and costs some availability, the share of the time the robot gets on with its work. Count the benefit as the contacts it removes, with their severity. Count the cost as the time the robot spends stopped or slowed, and the stops that were for nothing. A brake that reacts to an echo at range $d$, closing at speed $v_c$, stops when the time to contact falls below its threshold,</p>
$$\frac{d - \ell_f}{v_c} < T_{brake},$$
<p>with $\ell_f$ the distance from the radar to the front of the body. A larger $T_{brake}$ stops earlier and for more things; a smaller one stops later and for fewer. Whatever sensor the brake reads, it cannot tell a person from a ghost or a scatter of clutter, so it will always make some false stops. They come with the design. A mitigation that changes the robot's speed or path also changes which encounters happen at all. So it has to be judged on a set of scenarios, and the scenario that motivated it is only one of them.</p>
<!-- math -->
<p><b>Where it comes from.</b> The brake, the stops by what triggered them, and the measured table of every mitigation at six seeds are in <a class="chref" href="#notes=ch8/9-mitigations-and-their-price">chapter 8 §9</a>.</p>
<!-- /math -->
<p><b>What the lab does.</b> Control → <i>Radar emergency brake</i> (off by default) reads the radar (Sensors → Radar) one scan at a time, after every controller. It looks for an echo ahead that is closing and lies within half the body's width plus 0.2 m of the arc the robot is turning on. If that echo's time to contact is under the threshold (1 s by default), the brake holds the robot at a stop for 0.5 s. The event log says "Emergency brake". The <button type="button" class="linkbtn" data-met="Emergency brake">Metrics list</button> counts the stops and, from what the simulator knows, how many were for a ghost, for clutter or for a wall. Control → <i>Lidar safety stop</i> is the one from lesson 3. The Metrics list's <button type="button" class="linkbtn" data-met="Contacts by speed"><i>Contacts by speed</i></button> gives each contact and its class. A contact while the robot stands still is a person walking into it, and the lab does not count that as the robot's impact. The numbers quoted are for seed 7, checked at seeds 1 to 5.</p>

## Try: Fog, as lesson 3 left it
cfg: {"sim":true,"level":4,"set":{"weather":"fog"},"tab":"ctl","layers":{"agents":true,"lidar":true}}
Setup: The busy floor in fog, with nothing added. The lidar sees about 4 m, the tracker follows people the fog makes up, and the speed planner yields to them.
See: There is a strike at 1.45 m/s at 101 s. On seeds 2 to 5 every run has at least one strike, with three on seeds 2, 3 and 5. On seed 1 the particle filter keeps losing the robot (lesson 3), and the run has no contact with a person.
Shows: This is the scenario set on which the lesson judges its mitigations. It is one condition on six seeds, and five of the six runs have a strike.
Predict: Fog with nothing added, on six seeds. How many runs have a strike?
- Most of them
- One or two
- None: the speed planner yields more in fog
Answer: 0

## Try: Fog, with the radar emergency brake
cfg: {"sim":true,"level":4,"set":{"weather":"fog","radar":true,"radBrake":true},"tab":"ctl","layers":{"agents":true,"radar":true}}
Setup: The same fog, with the radar on and the emergency brake. Fog barely affects the radar, and the brake reads the radar alone, without the lidar's tracks.
See: There is no contact at all, and the mission takes 125 s instead of 121. The brake stops the robot for 7.3 s in all. Of its 11 stops, 6 were for a person, 4 for clutter and 1 for a rack.
| Run | Brake stops | Of them for clutter | Strikes |
|---|---|---|---|
| this run | 11 | 4 | none |
| seeds 2 to 5 | 5 to 10 a run | about two in five | none |
Look at the last column. No seed has a strike. What remains on seeds 2 to 5 is one bump on two of the runs, and people walking into the stopped robot on three.
Shows: The brake removes the strikes because it reads a sensor that the triggering condition does not reach. The fog blinds the lidar but not the radar. The price is the time spent stopped, the stops for nothing, and a new kind of contact: a robot that stops in a person's path gets walked into. The severity falls, but some contacts remain.
Predict: The radar brake in fog, on six seeds. Strikes?
- None on any seed
- About as many as without it: the brake reads the same fog
- More: the stops put the robot in people's way
Answer: 0

## Try: Fog, with the lidar safety stop instead
cfg: {"sim":true,"level":4,"set":{"weather":"fog","guard":true},"tab":"ctl","layers":{"agents":true,"lidar":true}}
Setup: Fog again, without the radar, and with the lidar safety stop. The stop sweeps the robot's body along the commanded arc, checks it against the current scan, and caps the speed at one from which the robot can stop in time.
See: There is no strike, and there are three bumps, at 51.5, 57.4 and 85.3 s. The stop capped the speed for 6.2 s. On seeds 2 to 5 every run has a contact, and two of the runs have a strike. On seed 1 the stop holds the robot for 53 s, and the robot reaches one goal of five.
Shows: The safety stop reads the lidar, and the lidar is what the fog degrades. The stop brakes for what the lidar still sees, which is closer and later than in clear air. So the impacts are slower, but most of the contacts stay. A mitigation that reads a sensor is limited by what that sensor can see.
Predict: The lidar safety stop instead of the radar brake, in the same fog. Contacts with people?
- Some remain
- None, as with the radar brake
- Strikes on every run, as with nothing added
Answer: 0

## Try: The radar brake in clear air
cfg: {"sim":true,"level":4,"set":{"radar":true,"radBrake":true},"tab":"ctl","layers":{"agents":true,"radar":true}}
Setup: The brake on the busy floor in clear air, where lesson 3's person turns back at 51 s.
See: At 52.1 s the person walks into the stopped robot instead of being bumped at 51.6 s.
| Run | Brake stops | Of them for clutter | The contact at 51 s |
|---|---|---|---|
| this run | 6 | 3 | walked into, at 52.1 s |
| seeds 2 to 5 | 3 to 9 | two to six | a bump, 0.35 to 0.88 m/s |
Look at the last column. In clear air the brake changes the contact on this run, and on the other seeds the contact is still there.
Shows: Clear air is not the condition the brake was added for, and here it brings mostly costs. It stops for clutter, and it does not prevent the one contact that clear air has. If the brake is on everywhere, its cost is paid everywhere. If it were switched on only when a monitor sees fog (lesson 6), the cost would be paid only in fog.
Predict: In clear air, does the radar brake remove the contact at 51 s on most seeds?
- No: the contact stays, and the brake stops for clutter
- Yes: it stops before every contact
- It removes it and never stops for nothing
Answer: 0

## Try: Slower: a cruise speed of 0.5 m/s
cfg: {"sim":true,"level":4,"set":{"vcruise":0.5},"tab":"ctl","layers":{"agents":true}}
Setup: This time the function is restricted instead of added to. The cruise speed is cut from 0.8 to 0.5 m/s, in clear air.
See: The 51 s contact is gone, and two new ones appear: a strike at 1.11 m/s at 126.1 s, and a bump at 131.6 s. The mission takes 178 s instead of 121. Seeds 2 to 5 give the same, with a strike near 126 s and a bump near 133 s on every run. At 0.8 m/s only seeds 1 and 3 had a strike.
Shows: Driving slower made this robot less safe on this floor. A slower robot reaches every aisle later and meets different people there. The strike's 1.11 m/s is more than twice the robot's speed, so most of it comes from the person's own walking. A restriction changes the whole run, so it has to be checked on the set like any other change. Here it fails the check.
Predict: Cut the cruise speed from 0.8 to 0.5 m/s. Strikes, over the six seeds?
- More than before: a strike on most seeds
- None: a slow robot cannot strike anyone
- The same as before
Answer: 0

## Think about
Q: The radar brake stopped for clutter in about a third of its stops. Why not raise its threshold until it never does?
A: Clutter appears anywhere in the field of view with random radial speeds, so some of it will always look like something closing in the robot's path. A threshold that never stops for clutter would never stop for anything. What you can change is the width of the corridor the brake watches, or you can wait for a second scan to confirm the first, or for a second sensor to agree. Each of these also delays the stop for a real person. The false stops are what the brake pays for reacting quickly, from a single scan.
Q: People walked into the robot stopped by the brake. Is that the robot's fault?
A: The lab does not count it as the robot's impact, and a standard would not either if the robot was stationary and visible. It is still a contact that the robot's behaviour made possible, because the robot stopped in a person's path. A better reaction would stop earlier where it can, or back off. The hazard analysis (lesson 2) has to list "stops where a person walks into it" as a hazard of its own.
Q: How would you decide whether to ship the radar brake?
A: Rerun the scenario set with it (lesson 5). In each part of the domain, count the contacts it removes and the ones it adds, with their classes, the time spent stopped, and the stops for nothing. In fog it removes every strike, for a few seconds of stops a run. In clear air it costs time and does little. The numbers support shipping it with a monitor that switches it on in fog, and saying so in the safety case. They do not support having it on all the time, or leaving it out.

## Check yourself
Q: A brake reads an echo 2.3 m ahead closing at 2.0 m/s; the body's front is 0.3 m ahead of the radar. What is the time to contact, in seconds?
Answer: 1
Tolerance: 0.01
Unit: s
How: $(2.3 - 0.3) / 2.0 = 1.0$ s. With a threshold of 1 s the brake is right at the edge, and it stops on the next scan if the echo keeps closing.
