group: saf
title: Mitigations, and what they cost

<p><b>Why this matters.</b> The lessons so far found hazards: a person turning back, fog that hides people and invents others, a lidar that dies. Finding them is half the work; the other half is changing the system so they do less harm, and every change has a price. A brake that stops for things that are not there stops the robot for nothing; a robot that drives slower takes longer and meets different people at different moments. A mitigation is judged by what it removes and by what it costs, on the same scenarios, and sometimes the honest answer is that it makes things worse.</p>
<p><b>The standards.</b> ISO 21448 asks that functional insufficiencies found in the analysis be removed or reduced by modifying the function: better sensing, a restricted function or domain, a hand-over, a minimal-risk manoeuvre (clause 8), and that the modified function be verified again. The lab paraphrases the standards and quotes none of them. The clause numbers are the best available from public outlines (ISO 26262:2018, ISO 21448:2022, ISO/PAS 8800:2024, UL 4600 third edition) and have not been checked against the texts.</p>
<p><b>The idea.</b> Every mitigation here trades a hazard for availability. Write the benefit as the contacts and their severity it removes, and the cost as the time the robot spends stopped or slowed and the stops that were for nothing. A brake that reacts to an echo at range $d$ closing at speed $v_c$ stops when the time to contact falls below its threshold,</p>
$$\frac{d - \ell_f}{v_c} < T_{brake},$$
<p>with $\ell_f$ the distance from the radar to the front of the body. A larger $T_{brake}$ stops earlier and for more things; a smaller one later and for fewer. Whatever it reads, it cannot tell a person from a ghost or a scatter of clutter: its false stops are part of its design, not a bug. A mitigation that changes the robot's speed or path also changes which encounters happen at all, so it has to be judged on a set of scenarios, never on the one that motivated it.</p>
<p><b>Where it comes from.</b> The brake, the stops by what triggered them, and the measured table of every mitigation at six seeds: <a class="chref" href="#notes=ch8/9-mitigations-and-their-price">chapter 8 §9</a>.</p>
<p><b>What the lab does.</b> Control → <i>Radar emergency brake</i> (off by default) reads the radar (Sensors → Radar), one scan at a time, after every controller: an echo ahead within half the body's width and 0.2 m of the arc the robot is turning on, closing, under the time to contact (1 s by default), holds the robot at a stop for 0.5 s. The event log says "Emergency brake", and the Metrics list counts the stops and, from the simulator's knowledge, how many were for a ghost, clutter or a wall. Control → <i>Lidar safety stop</i> is lesson 3's. The Metrics list's <i>Contacts by speed</i> gives each contact and its class; a contact with the robot standing still is a person walking into it, which the lab does not count as the robot's impact. Numbers are seed 7, checked at seeds 1 to 5.</p>

## Try: Fog, as lesson 3 left it
cfg: {"sim":true,"level":4,"set":{"weather":"fog"},"tab":"ctl","layers":{"agents":true,"lidar":true}}
Setup: The busy floor in fog with nothing added: the lidar sees about 4 m, the tracker follows people the fog invents, and the speed planner yields to them.
See: A strike at 101 s, 1.45 m/s. On seeds 2 to 5 every run has at least one strike, three on seeds 2, 3 and 5; on seed 1 the particle filter keeps losing itself (lesson 3) and the run has no contact with a person.
Shows: The scenario set for this lesson's mitigations: one condition, six seeds, a strike on five of them.
Predict: Fog with nothing added, on six seeds. How many runs have a strike?
- Most of them
- One or two
- None: the speed planner yields more in fog
Answer: 0

## Try: Fog, with the radar emergency brake
cfg: {"sim":true,"level":4,"set":{"weather":"fog","radar":true,"radBrake":true},"tab":"ctl","layers":{"agents":true,"radar":true}}
Setup: The same fog, the radar on, and the emergency brake: the radar barely notices the fog, and the brake reads it alone, without the lidar's tracks.
See: No contact at all. The brake stops the robot 11 times, 7.3 s in all, and the mission takes 125 s instead of 121. Of the 11 stops, 6 were for a person, 4 for clutter and 1 for a rack. On seeds 2 to 5 no run has a strike; what remains is one bump on two of the runs, and people walking into the stopped robot on three; 5 to 10 stops a run, about two in five of them for clutter.
Shows: A mitigation that removes the strikes because it reads a sensor the triggering condition does not reach: the fog blinds the lidar and not the radar. Its price is time stopped and stops for nothing, and a new kind of contact: a robot that stops in a person's path is walked into. The severity falls; the contacts do not all go away.
Predict: The radar brake in fog, on six seeds. Strikes?
- None on any seed
- About as many as without it: the brake reads the same fog
- More: the stops put the robot in people's way
Answer: 0

## Try: Fog, with the lidar safety stop instead
cfg: {"sim":true,"level":4,"set":{"weather":"fog","guard":true},"tab":"ctl","layers":{"agents":true,"lidar":true}}
Setup: Fog again, without the radar, with the lidar safety stop: it sweeps the body along the commanded arc against this scan and caps the speed at what stops in time.
See: No strike, three bumps, at 51.5, 57.4 and 85.3 s; the stop capped the speed for 6.2 s. On seeds 2 to 5 every run has a contact and two of them a strike; on seed 1 the stop holds the robot for 53 s and it reaches one goal of five.
Shows: The safety stop reads the lidar, which is what the fog degrades: it brakes for what the lidar still sees, closer and later than in clear air, so the impacts fall but most contacts stay. A mitigation inherits the weaknesses of the sensor it reads.
Predict: The lidar safety stop instead of the radar brake, in the same fog. Contacts with people?
- Some remain
- None, as with the radar brake
- Strikes on every run, as with nothing added
Answer: 0

## Try: The radar brake in clear air
cfg: {"sim":true,"level":4,"set":{"radar":true,"radBrake":true},"tab":"ctl","layers":{"agents":true,"radar":true}}
Setup: The brake on the busy floor in clear air, where lesson 3's person turns back at 51 s.
See: The brake stops 6 times, 3 of them for clutter; at 52.1 s the person walks into the stopped robot instead of being bumped at 51.6 s. On seeds 2 to 5 the bump at 51 s stays on every run, at 0.35 to 0.88 m/s, and the brake stops 3 to 9 times, two to six of them for clutter.
Shows: Outside the condition it was added for, the brake mostly costs: it stops for clutter and does not prevent the one contact clear air has. A mitigation switched on everywhere pays its price everywhere; switched on where a monitor sees fog (lesson 6), it would pay only there.
Predict: In clear air, does the radar brake remove the contact at 51 s on most seeds?
- No: the contact stays, and the brake stops for clutter
- Yes: it stops before every contact
- It removes it and never stops for nothing
Answer: 0

## Try: Slower: a cruise speed of 0.5 m/s
cfg: {"sim":true,"level":4,"set":{"vcruise":0.5},"tab":"ctl","layers":{"agents":true}}
Setup: A restricted function instead of a new one: the cruise speed cut from 0.8 to 0.5 m/s, in clear air.
See: The 51 s contact is gone, and two new ones arrive: a strike at 126.1 s, 1.11 m/s, and a bump at 131.6 s. The mission takes 178 s instead of 121. On seeds 2 to 5 the same: a strike near 126 s and a bump near 133 s on every run; at 0.8 m/s only seeds 1 and 3 had a strike.
Shows: Slower is not automatically safer. A slower robot reaches every aisle later and meets different people there; and the strike's 1.11 m/s is more than twice the robot's speed, so most of it is the person's. A restriction changes the whole trajectory, which is why it is verified on the set like any other modification, and here it fails.
Predict: Cut the cruise speed from 0.8 to 0.5 m/s. Strikes, over the six seeds?
- More than before: a strike on most seeds
- None: a slow robot cannot strike anyone
- The same as before
Answer: 0

## Think about
Q: The radar brake stopped for clutter in about a third of its stops. Why not raise its threshold until it never does?
A: Clutter arrives anywhere in the field of view with random radial speeds, so some of it always looks like something closing in the robot's path; the only threshold that never stops for it is one that never stops at all. The real levers are the corridor's width, a second scan confirming the first, or a second sensor agreeing, each of which also delays the stop for a real person. The false stops are the price of the brake's speed.
Q: People walked into the robot stopped by the brake. Is that the robot's fault?
A: The lab does not count it as the robot's impact, and a standard would not either if the robot was stationary and visible. But it is still a contact the robot's behaviour made possible: it stopped in a person's path. A better reaction stops early where possible, or backs off, and the hazard analysis (lesson 2) has to list "stops where a person walks into it" as a hazard of its own.
Q: How would you decide whether to ship the radar brake?
A: Rerun the scenario set with it (lesson 5): count the contacts and their classes it removes and adds, the time stopped and the stops for nothing, in each part of the domain. In fog it removes every strike for a few seconds of stops a run; in clear air it costs and does little. Shipping it with a monitor that switches it on in fog, and saying so in the safety case, is a decision the numbers support; shipping it always, or never, is not.

## Check yourself
Q: A brake reads an echo 2.3 m ahead closing at 2.0 m/s; the body's front is 0.3 m ahead of the radar. What is the time to contact, in seconds?
Answer: 1
Tolerance: 0.01
Unit: s
How: $(2.3 - 0.3) / 2.0 = 1.0$ s. At a threshold of 1 s the brake is at the edge: it stops on the next scan if the echo keeps closing.
