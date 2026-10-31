group: per
title: Velocity obstacles: steering around people in velocity space

<p><b>Why this matters.</b> The speed planner of lesson 3 avoids people by slowing down along the path. The behaviour layer avoids them by replanning around where they will be. Neither of them steers. Velocity obstacles do steer. They are the idea behind RVO and ORCA, which steer crowds in games and robots in warehouses. The method asks which velocities (speed and heading together) lead to a collision with a person who keeps walking as they are, and picks the nearest velocity that does not. The test is one line of geometry per person, it runs every tick, and it makes the robot step aside instead of braking. This lesson adds velocity obstacles as a fourth response to agents. It measures where they beat the speed planner, where they fail, and what they assume about the people without saying so.</p>
<p><b>The idea.</b> Take one person at relative position $d$, walking at velocity $v_a$, and let $R$ be the sum of the two radii. If the robot moves at velocity $u$, the relative motion is $u - v_a$. The robot collides within the horizon $\tau$ when the ray $t\,(u - v_a)$ hits the disc of radius $R$ around $d$ for some $t \le \tau$. The set of all such $u$ is a cone in velocity space with its apex at $v_a$, cut off near the apex by the horizon. This cone is the velocity obstacle. The tracker's command is a velocity. If it lies inside any person's cone, the lab samples other velocities: speeds down to a quarter of the command, headings up to 90° to either side, and one slow reverse straight back. It keeps the samples that are outside every cone and takes the one nearest the command. If none is free, the robot stops. The chosen heading becomes a turn over half a second, added to the tracker's own.</p>
$$w = u - v_a \qquad \text{collision within } \tau \iff \exists\, t \in (0, \tau]:\ |d - t\,w| \le R \qquad t = \frac{d\cdot w - \sqrt{(d\cdot w)^2 - |w|^2\bigl(|d|^2 - R^2\bigr)}}{|w|^2}$$
<p>$\mathrm{VO}_a = \{\, u : \text{the ray hits within } \tau \,\}$ is a cone with apex $v_a$ tangent to the disc of radius $R$ at $d$, cut off by the disc of radius $R/\tau$ at $d/\tau$. The robot then chooses:</p>
$$u^* = \operatorname*{arg\,min}\, |u - u_\text{cmd}|^2 \ \text{ over the samples outside every } \mathrm{VO}_a \qquad \text{none free} \to \text{stop}$$
<p><b>Where it comes from.</b> Velocity obstacles are from Fiorini and Shiller (1998). The quadratic is the intersection of the ray with the disc, written out, and the cone is what the quadratic gives when you solve it for every $u$. Reciprocal velocity obstacles (van den Berg et al. 2008) split the avoidance between two parties that both run the method. The lab's people do not run it, and the last experiments show what that means. <a class="chref" href="#notes=ch4/9-velocity-obstacles-avoiding-people-in-velocity-space">The cone, the quadratic, the sampling and the measured runs: chapter 4 §9</a></p>
<p><b>What the lab does.</b> Choose Control → Response to agents → Velocity obstacles; it works with the path trackers. The Velocity obstacles layer draws each person's cone in world coordinates, scaled by $\tau$. It draws the tracker's command as an arrow, red when it lies in a cone, and the chosen velocity in the accent colour. The Control tab counts the interventions and the stops. The horizon $\tau$ and the clearance added to the radii are sliders. The numbers below are for L5, the busy floor, at seed 7, with pure pursuit and lidar tracking. "Contacts" is the number of times the robot and a person overlap, counted up to Mission complete. A scripted person who later walks into the parked robot is left out.</p>

## Try: Ignore the people, for reference
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: L5 with the trackers ignoring the agents. The mission is the five goals, 83 m, with people walking their fixed segments through the aisles.
See: There are three contacts, at 51, 54 and 79 s, and all five goals are reached in 106 s. With the speed planner the same run has one contact and four yields.
Shows: This run is the reference. The people are scripted, and they walk through the robot as if it were not there. None of the contacts comes without warning. Each person had been in view of the lidar, and tracked, for four to eight seconds before the robot drove into them.
Predict: The robot drives its path at cruise speed as if the floor were empty, and these people never step aside. How many contacts over the run?
- A few, two to four, wherever a walk crosses the path as the robot passes
- None: the aisles are wide enough for the two to miss
- A dozen or more: one for every person it passes
Answer: 0

## Try: Velocity obstacles, 3 s horizon
cfg: {"sim":true,"level":4,"set":{"spd":"vo"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: The same run with velocity obstacles, $\tau = 3$ s and 0.2 m of clearance. The Velocity obstacles layer is on.
See: Over the run there are 145 interventions and 31 stops, and two contacts instead of three. The robot drives the same 84 m and reaches all five goals. Watch an encounter in an aisle. The command arrow turns red as it enters a cone, the chosen velocity swings 30 or 40° to the side, and the robot slides past the person instead of braking behind them.
Shows: Steering around people works where there is room to steer. The two contacts that remain, at 55 and 81 s, are scripted people walking along a corridor straight at the robot, at 0.6 and 0.8 m/s. Every forward and sideways velocity collides. The robot brakes, and the person walks into it before it has quite stopped. Backing away at 0.3 m/s would not escape either. Only leaving the corridor would, and velocity obstacles know nothing about the shelves.
Predict: Turn velocity obstacles on, horizon 3 s. How many contacts?
- One or two, about the speed planner's: people walking straight at the robot in a corridor remain
- None: a cone per person is a complete answer
- More: the detours walk into other people
Answer: 0

## Try: Velocity obstacles, 2 s horizon
cfg: {"sim":true,"level":4,"set":{"spd":"vo","voT":2},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: As before, with $\tau = 2$ s.
See: There are 116 interventions, 17 stops and one contact, over 84 m and five goals. The detours start later and swing less. The contact at 81 s in the 3 s run does not happen. The one at 55 s remains: the person walking straight at the robot along the top corridor.
Shows: The horizon is a bet on how long the person keeps their velocity. With a long $\tau$ the robot reacts to collisions that would never happen, because the person turns first. It also reacts early, and in an aisle that can mean committing to the wrong side. With a short one it reacts only to what is about to happen. For walking people the crowd-simulation literature settled on two to three seconds. The interventions fall on every seed: 107 to 132 against 125 to 138 over seeds 2 to 5. The contacts do not separate the two horizons, with one or two at 2 s against two at 3 s. So the contact saved in this run is as much one run's luck as the effect of the horizon.
Predict: Shorten the horizon to 2 s. What happens to the number of interventions the Control tab counts?
- Fewer: each cone ends sooner, so fewer commands fall inside one
- More: the robot reacts later and has to correct more often
- The same: the horizon only changes how far ahead the cone is drawn
Answer: 0

## Try: People who react
cfg: {"sim":true,"level":4,"set":{"spd":"vo","people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: The reactive people of lesson 5, who steer around the robot while it steers around them, with $\tau = 3$ s.
See: There is no contact in the whole run. The closest approach is 0.30 m, there are 133 interventions and two stops, and all five goals are reached in 84 m. With the same people, ignoring them gives two contacts. The reactive stop gives none, but a closest approach of 6 cm. The speed planner gives none, a closest approach of 0.18 m and three agent-blocking replans.
Shows: Velocity obstacles assume the other party keeps its velocity. When the other party is avoiding too, each detour alone would have been enough, so together they are more than enough. The well-known dance of two VO agents, which both swerve and then both swerve back, is a mild form of this. Reciprocal velocity obstacles fix it by having each party take half of the avoidance. The lab's people take their share with social forces, which has the same effect.
Predict: Make the people react (social forces, lesson 5), keep $\tau = 3$ s. Contacts?
- None: two parties avoiding each other is what the cone assumes, and more
- The same one or two: the cones do not know the people react
- More: both swerve the same way and dance
Answer: 0

## Try: Into the shelf: what the cones do not know
cfg: {"sim":true,"level":4,"set":{"spd":"vo","voT":2,"people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: Reacting people, $\tau = 2$ s, and the lidar safety stop off, which is this level's default.
See: There is no contact with a person, and there are two collisions with shelves. Each time, a late, sharp detour chose a velocity pointing into the shelf beside the aisle, which no cone forbids. With the safety stop on (Control → lidar safety stop) the shelves are not hit. But the stop halts the robot in front of them, and goals are given up as stuck: two of five are reached with $\tau = 2$ s, and four of five with $\tau = 3$ s. Which run hits a shelf changes with the seed. At seed 7 the 3 s run is clean, but over seeds 2 to 5 the 3 s horizon hits a shelf on three runs and the 2 s horizon on one. With reacting people, no run touched a person.
Shows: Each velocity obstacle describes one moving thing and nothing else. A complete local planner puts the static map into the same set of velocities. DWA does this when it scores its rollouts against the costmap and the people together. Stacks built on ORCA do it by adding the walls as linear constraints. Adding a safety stop on top of velocity obstacles prevents the collision, but it stops the mission as well.
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
Note: voHits is the quadratic of the lesson. The discriminant says whether the ray meets the disc, and the root says when. agVO builds one cone per tracked person and tests the command. The marked cost line makes the decision. It prefers the sample nearest the command, with a small penalty for turning and a small penalty for moving away from the heading chosen at the last tick. In Edit and run, the pure-pursuit example is the tracker that velocity obstacles correct. Add the cone test to it; the slot gets obs.agents with positions and velocities.

## Think about
Q: The cone's apex sits at the person's velocity, not at the robot. Why?
A: What matters is the relative velocity. A robot that moves at the same velocity as the person never changes its distance to them, so that velocity cannot lead to a collision, and it is the apex. Every velocity whose difference from the apex points into the disc does lead to one. To draw the cones in the world, as the layer does, the apex is placed where the robot would be after $\tau$ if it moved with the person.
Q: With scripted people the contacts went from three to one or two; with reacting people to zero. What does a real robot's crowd look like?
A: Mostly reacting, since people do not walk into robots. A planner that assumes they keep their velocity is too pessimistic, in a way that makes it swerve too much and then swerve back. For this reason the field moved from VO to reciprocal VO and ORCA, which assume the other party does half the work. Some stacks now learn that share from data.
Q: The lab samples 77 velocities (76 forward, one slow reverse); ORCA solves a small linear program instead. What is the difference in practice?
A: ORCA turns each cone into a half-plane constraint and finds the nearest allowed velocity exactly, in microseconds, for hundreds of neighbours. Sampling finds the nearest of a few dozen guesses, and it can miss a narrow gap between two cones. Sampling is easier to read and easier to combine with other costs, so DWA samples. With many neighbours you run the linear program.

## Check yourself
Q: A person 3 m ahead walks across at 1.2 m/s, the radii add to 0.75 m, the robot drives at 0.8 m/s straight at where they are now. The relative velocity has magnitude $\sqrt{0.8^2 + 1.2^2}$ and the ray passes at closest approach $3 \times 1.2 / \sqrt{0.8^2 + 1.2^2}$ m from the disc centre. Is the robot's velocity inside the cone? Answer with the closest approach in metres.
Answer: 2.5
Tolerance: 0.05
Unit: m
How: $|w| = \sqrt{0.64 + 1.44} = 1.44$ m/s. The closest approach of the ray to the centre is $|d| \sin(\text{angle between } d \text{ and } w) = 3 \times (1.2 / 1.44) = 2.5$ m, more than $R = 0.75$. The person will have crossed before the robot arrives, so the velocity is outside the cone.
