group: per
title: Velocity obstacles: steering around people in velocity space

<p><b>Why this matters.</b> The speed planner of lesson 3 avoids people by slowing down along the path, and the behaviour layer by replanning around where they will be. Neither turns the wheel. Velocity obstacles, the idea behind RVO and ORCA that steers the crowds in games and the robots in warehouses, do: they ask which velocities, speed and heading together, lead to a collision with a person who keeps walking as they are, and pick the nearest velocity that does not. It is a one-line geometric test per person, it runs every tick, and it makes the robot step aside instead of braking. This lesson adds it as a fourth response to agents and measures where it beats the speed planner, where it fails, and what it quietly assumes about the people.</p>
<p><b>The idea.</b> Take one person at relative position $d$, walking at velocity $v_a$, and let $R$ be the two radii added. If the robot moves at velocity $u$, the relative motion is $u - v_a$, and the robot collides within the horizon $\tau$ exactly when the ray $t\,(u - v_a)$ hits the disc of radius $R$ around $d$ for some $t \le \tau$. The set of such $u$ is a cone in velocity space with its apex at $v_a$, truncated near the apex by the horizon: the velocity obstacle. The tracker's command is a velocity. If it lies inside any person's cone, the lab samples speeds down to a quarter of the command and headings up to 90° either side, plus one slow reverse straight back, keeps the samples outside every cone, and takes the one nearest the command; if none is free it stops. The chosen heading becomes a turn over half a second added to the tracker's own.</p>
$$w = u - v_a \qquad \text{collision within } \tau \iff \exists\, t \in (0, \tau]:\ |d - t\,w| \le R \qquad t = \frac{d\cdot w - \sqrt{(d\cdot w)^2 - |w|^2\bigl(|d|^2 - R^2\bigr)}}{|w|^2}$$
<p>$\mathrm{VO}_a = \{\, u : \text{the ray hits within } \tau \,\}$ is a cone with apex $v_a$ tangent to the disc of radius $R$ at $d$, cut by the disc of radius $R/\tau$ at $d/\tau$. The choice:</p>
$$u^* = \operatorname*{arg\,min}\, |u - u_\text{cmd}|^2 \ \text{ over the samples outside every } \mathrm{VO}_a \qquad \text{none free} \to \text{stop}$$
<p><b>Where it comes from.</b> Fiorini and Shiller's velocity obstacles (1998); the quadratic is the ray-disc intersection written out, and the cone is what that quadratic says over all $u$. Reciprocal velocity obstacles (van den Berg et al. 2008) split the avoidance between two parties that both run the method; the lab's people do not run it, which is the point of the last experiments. <a class="chref" href="#notes=ch4/9-velocity-obstacles-avoiding-people-in-velocity-space">The cone, the quadratic, the sampling and the measured runs: chapter 4 §9</a></p>
<p><b>What the lab does.</b> Control → Response to agents → Velocity obstacles, for the path trackers. The Velocity obstacles layer draws each person's cone in world coordinates scaled by $\tau$, the tracker's command as an arrow (red when it lies in a cone) and the chosen velocity in the accent colour; the Control tab counts the interventions and the stops. The horizon $\tau$ and the clearance added to the radii are sliders. The numbers below are L5, the busy floor, at seed 7 with pure pursuit and lidar tracking; "contacts" is the number of times the robot and a person overlap, counted up to Mission complete (a scripted person who later walks into the parked robot is left out).</p>

## Try: Ignore the people, for reference
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: L5 with the trackers ignoring the agents: the five goals, 83 m, with people walking their fixed segments through the aisles.
See: Three contacts, at 51, 54 and 79 s, all five goals in 106 s. The speed planner on the same run: one contact, four yields.
Shows: The reference, and the kind of people: scripted ones, who walk through the robot as if it were not there. None of the contacts is a surprise: each person had been in view of the lidar, and tracked, for four to eight seconds before the robot drove into them.
Predict: The robot drives its path at cruise speed as if the floor were empty, and these people never step aside. How many contacts over the run?
- A few, two to four, wherever a walk crosses the path as the robot passes
- None: the aisles are wide enough for the two to miss
- A dozen or more: one for every person it passes
Answer: 0

## Try: Velocity obstacles, 3 s horizon
cfg: {"sim":true,"level":4,"set":{"spd":"vo"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: The same run with velocity obstacles, $\tau = 3$ s, 0.2 m of clearance. Velocity obstacles layer on.
See: 145 interventions and 31 stops over the run, two contacts instead of three, the same 84 m and all five goals. Watch an aisle encounter: the command arrow turns red as it enters a cone, the chosen velocity swings 30 or 40° to the side, and the robot slides past the person rather than braking behind them.
Shows: Steering around works where there is room to steer. The two contacts that remain, at 55 and 81 s, are scripted people walking along a corridor straight at the robot, at 0.6 and 0.8 m/s: every forward and sideways velocity collides, the robot brakes, and the person walks into it before it has quite stopped. Backing away at 0.3 m/s would not escape either; nothing short of leaving the corridor would, and velocity obstacles know nothing about the shelves.
Predict: Turn velocity obstacles on, horizon 3 s. How many contacts?
- One or two, about the speed planner's: people walking straight at the robot in a corridor remain
- None: a cone per person is a complete answer
- More: the detours walk into other people
Answer: 0

## Try: Velocity obstacles, 2 s horizon
cfg: {"sim":true,"level":4,"set":{"spd":"vo","voT":2},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: $\tau = 2$ s.
See: 116 interventions, 17 stops, one contact, 84 m, five goals. The detours start later and swing less, and the 3 s run's contact at 81 s does not happen; the one at 55 s, the person walking straight at the robot along the top corridor, remains.
Shows: The horizon is a bet on how long the person keeps their velocity. A long $\tau$ reacts to collisions that would never happen because the person turns first, and reacts early, which in an aisle can mean committing to the wrong side; a short one reacts to what is about to happen. Two to three seconds is what the crowd-simulation literature settled on for walking people. The interventions fall on every seed (107 to 132 against 125 to 138 over seeds 2 to 5); the contacts do not separate the two horizons: one or two with 2 s against two with 3 s, so the contact this run saves is one run's luck as much as the horizon's.
Predict: Shorten the horizon to 2 s. What happens to the number of interventions the Control tab counts?
- Fewer: each cone ends sooner, so fewer commands fall inside one
- More: the robot reacts later and has to correct more often
- The same: the horizon only changes how far ahead the cone is drawn
Answer: 0

## Try: People who react
cfg: {"sim":true,"level":4,"set":{"spd":"vo","people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: The reactive people of lesson 5, who steer around the robot as it steers around them, $\tau = 3$ s.
See: No contact in the whole run, closest approach 0.30 m, 133 interventions and two stops, five goals in 84 m. Ignoring the same people: two contacts; the reactive stop: none, but with a closest approach of 6 cm; the speed planner: none, closest 0.18 m, three agent-blocking replans.
Shows: Velocity obstacles assume the other party keeps their velocity, and when the other party is also avoiding, each one's detour is more than enough: the famous dance of two VO agents that both swerve, then both swerve back, is the mild version of this. Reciprocal velocity obstacles fix it by having each party take half the avoidance; the lab's people take theirs with social forces, which comes to the same.
Predict: Make the people react (social forces, lesson 5), keep $\tau = 3$ s. Contacts?
- None: two parties avoiding each other is what the cone assumes, and more
- The same one or two: the cones do not know the people react
- More: both swerve the same way and dance
Answer: 0

## Try: Into the shelf: what the cones do not know
cfg: {"sim":true,"level":4,"set":{"spd":"vo","voT":2,"people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: Reacting people, $\tau = 2$ s, and the lidar safety stop off, as on this level by default.
See: No contact with a person, and two collisions with shelves: a late, sharp detour chose a velocity pointing into the shelf beside the aisle, which no cone forbids. With the safety stop on (Control → lidar safety stop) the shelves are not hit, but the stop halts the robot in front of them and goals are given up as stuck: two of five reached with $\tau = 2$ s, four of five with $\tau = 3$ s. Which run hits a shelf changes with the seed: at seed 7 the 3 s run is clean, but over seeds 2 to 5 the 3 s horizon hits a shelf on three runs and the 2 s horizon on one; with reacting people no run touched a person.
Shows: A velocity obstacle is only ever about one moving thing. A complete local planner puts the static map into the same velocity set, which is exactly what DWA does when it scores its rollouts against the costmap and the people together, and what ORCA-based stacks do by adding the walls as linear constraints. Bolting a safety stop onto VO stops the collision and the mission with it.
Predict: Reacting people again, now $\tau = 2$ s. What can the cones not prevent, whatever the horizon?
- A collision with a shelf: the cones know nothing about walls
- A contact with a person who reacts
- Nothing: with people who react, the cones are enough
Answer: 0

## Code: agVO, the cone test and the choice
snippet: vo
focus: const disc = dw * dw - ww * (dd - R * R);
focus: const t = (dw - Math.sqrt(disc)) / ww;
focus: const cost = (ux - ux0) ** 2 + (uy - uy0) ** 2 + 0.03 * Math.abs(dth) + 0.02 * Math.abs(dth - last);
example: ctl/pp
Note: voHits is the quadratic of the lesson: the discriminant says whether the ray meets the disc, the root when. agVO builds one cone per tracked person, tests the command, and the marked cost line is the whole decision: nearest to the command, a little against turning, a little for the heading chosen last tick. Edit and run: the pure-pursuit example is the tracker VO corrects; add the cone test to it and the slot gets obs.agents with positions and velocities.

## Think about
Q: The cone's apex sits at the person's velocity, not at the robot. Why?
A: Because what matters is the relative velocity. A robot that moves exactly like the person never changes its distance to them, so that velocity is the one that cannot collide, the apex; every velocity whose difference from it points into the disc does. Drawing the cones in the world, as the layer does, means placing the apex where the robot would be in $\tau$ if it moved with the person.
Q: With scripted people the contacts went from three to one or two; with reacting people to zero. What does a real robot's crowd look like?
A: Mostly reacting: people do not walk into robots, and a planner that assumes they keep their velocity is pessimistic in exactly the way that makes it swerve too much, then swerve back. That is why the field moved from VO to reciprocal VO and ORCA, which assume the other party does half the work, and why some stacks now learn the share from data.
Q: The lab samples 77 velocities (76 forward, one slow reverse); ORCA solves a small linear program instead. What is the difference in practice?
A: ORCA turns each cone into a half-plane constraint and finds the nearest allowed velocity exactly, in microseconds, for hundreds of neighbours; sampling finds the nearest of a few dozen guesses and can miss a narrow gap between two cones. Sampling is easier to read and to combine with other costs, which is why DWA samples; the LP is what you run at scale.

## Check yourself
Q: A person 3 m ahead walks across at 1.2 m/s, the radii add to 0.75 m, the robot drives at 0.8 m/s straight at where they are now. The relative velocity has magnitude $\sqrt{0.8^2 + 1.2^2}$ and the ray passes at closest approach $3 \times 1.2 / \sqrt{0.8^2 + 1.2^2}$ m from the disc centre. Is the robot's velocity inside the cone? Answer with the closest approach in metres.
Answer: 2.5
Tolerance: 0.05
Unit: m
How: $|w| = \sqrt{0.64 + 1.44} = 1.44$ m/s; the closest approach of the ray to the centre is $|d| \sin(\text{angle between } d \text{ and } w) = 3 \times (1.2 / 1.44) = 2.5$ m, more than $R = 0.75$: the person will have crossed before the robot arrives, so the velocity is outside the cone
