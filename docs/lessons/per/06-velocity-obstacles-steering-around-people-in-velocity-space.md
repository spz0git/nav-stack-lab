group: per
title: Velocity obstacles: steering around people in velocity space

<p><b>Why this matters.</b> The speed planner of lesson 3 avoids people by slowing down along the path, and the behaviour layer by replanning around where they will be. Neither turns the wheel. Velocity obstacles, the idea behind RVO and ORCA that steers the crowds in games and the robots in warehouses, do: they ask which velocities, speed and heading together, lead to a collision with a person who keeps walking as they are, and pick the nearest velocity that does not. It is a one-line geometric test per person, it runs every tick, and it makes the robot step aside instead of braking. This lesson adds it as a fourth response to agents and measures where it beats the speed planner, where it fails, and what it quietly assumes about the people.</p>
<p><b>The idea.</b> Take one person at relative position <i>d</i>, walking at velocity <i>v</i><sub>a</sub>, and let <i>R</i> be the two radii added. If the robot moves at velocity <i>u</i>, the relative motion is <i>u</i> − <i>v</i><sub>a</sub>, and the robot collides within the horizon τ exactly when the ray <i>t</i>(<i>u</i> − <i>v</i><sub>a</sub>) hits the disc of radius <i>R</i> around <i>d</i> for some <i>t</i> ≤ τ. The set of such <i>u</i> is a cone in velocity space with its apex at <i>v</i><sub>a</sub>, truncated near the apex by the horizon: the velocity obstacle. The tracker's command is a velocity. If it lies inside any person's cone, the lab samples speeds down to a quarter of the command and headings up to 90° either side, keeps the samples outside every cone, and takes the one nearest the command; if none is free it stops. The chosen heading becomes a turn over half a second added to the tracker's own.</p>
<div class="eq">w = u − v_a,   collision within τ  ⇔  ∃ t ∈ (0, τ]: |d − t w| ≤ R        t = (d·w − √((d·w)² − |w|²(|d|² − R²))) / |w|²
VO_a = { u : the ray hits within τ }   a cone with apex v_a tangent to the disc of radius R at d, cut by the disc of radius R/τ at d/τ
u* = argmin |u − u_cmd|² over the samples outside every VO_a;   none free → stop</div>
<p><b>Where it comes from.</b> Fiorini and Shiller's velocity obstacles (1998); the quadratic is the ray-disc intersection written out, and the cone is what that quadratic says over all <i>u</i>. Reciprocal velocity obstacles (van den Berg et al. 2008) split the avoidance between two parties that both run the method; the lab's people do not run it, which is the point of the last experiments. <a class="chref" href="#notes=ch4/9-velocity-obstacles-avoiding-people-in-velocity-space">The cone, the quadratic, the sampling and the measured runs: chapter 4 §9</a></p>
<p><b>What the lab does.</b> Control → Response to agents → Velocity obstacles, for the path trackers. The Velocity obstacles layer draws each person's cone in world coordinates scaled by τ, the tracker's command as an arrow (red when it lies in a cone) and the chosen velocity in the accent colour; the Control tab counts the interventions and the stops. The horizon τ and the clearance added to the radii are sliders. The numbers below are L5, the busy floor, at seed 7 with pure pursuit and lidar tracking; "contacts" is the number of times the robot and a person overlap, counted up to Mission complete (a scripted person who later walks into the parked robot is left out).</p>

## Try: Ignore the people, for reference
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: L5 with the trackers ignoring the agents: the five goals, 83 m, with people walking their fixed segments through the aisles.
See: Three contacts, at 51, 54 and 79 s, all five goals in 106 s. The speed planner on the same run: one contact, four yields.
Shows: The reference, and the kind of people: scripted ones, who walk through the robot as if it were not there. None of the contacts is a surprise: each person had been in view of the lidar, and tracked, for four to eight seconds before the robot drove into them.
Predict: Turn velocity obstacles on, horizon 3 s. How many contacts?
- One or two, about the speed planner's: people walking straight at the robot in a corridor remain
- None: a cone per person is a complete answer
- More: the detours walk into other people
Answer: 0

## Try: Velocity obstacles, 3 s horizon
cfg: {"sim":true,"level":4,"set":{"spd":"vo"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: The same run with velocity obstacles, τ = 3 s, 0.2 m of clearance. Velocity obstacles layer on.
See: 145 interventions and 31 stops over the run, two contacts instead of three, the same 84 m and all five goals. Watch an aisle encounter: the command arrow turns red as it enters a cone, the chosen velocity swings 30 or 40° to the side, and the robot slides past the person rather than braking behind them.
Shows: Steering around works where there is room to steer. The two contacts that remain, at 55 and 81 s, are scripted people walking along a corridor straight at the robot, at 0.6 and 0.8 m/s: every forward and sideways velocity collides, the robot stops, and the person walks into it. Backing away at 0.3 m/s would not escape either; nothing short of leaving the corridor would, and velocity obstacles know nothing about the shelves.
Predict: Shorten the horizon to 2 s. Contacts?
- Fewer: later, sharper detours that the aisle has room for
- More: the robot reacts too late
- The same: the horizon only changes the cone's size, not the outcome
Answer: 0

## Try: Velocity obstacles, 2 s horizon
cfg: {"sim":true,"level":4,"set":{"spd":"vo","voT":2},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: τ = 2 s.
See: 116 interventions, 17 stops, one contact, 84 m, five goals. The detours start later and swing less, and the 3 s run's contact at 81 s does not happen; the one at 55 s, the person walking straight at the robot along the top corridor, remains.
Shows: The horizon is a bet on how long the person keeps their velocity. A long τ reacts to collisions that would never happen because the person turns first, and reacts early, which in an aisle can mean committing to the wrong side; a short one reacts to what is about to happen. Two to three seconds is what the crowd-simulation literature settled on for walking people.
Predict: Make the people react (social forces, lesson 5), keep τ = 3 s. Contacts?
- None: two parties avoiding each other is what the cone assumes, and more
- The same one or two: the cones do not know the people react
- More: both swerve the same way and dance
Answer: 0

## Try: People who react
cfg: {"sim":true,"level":4,"set":{"spd":"vo","people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: The reactive people of lesson 5, who steer around the robot as it steers around them, τ = 3 s.
See: No contact in the whole run, closest approach 0.30 m, 133 interventions and two stops, five goals in 84 m. Ignoring the same people: two contacts; the reactive stop: none, but with a closest approach of 6 cm; the speed planner: none, closest 0.18 m, three agent-blocking replans.
Shows: Velocity obstacles assume the other party keeps their velocity, and when the other party is also avoiding, each one's detour is more than enough: the famous dance of two VO agents that both swerve, then both swerve back, is the mild version of this. Reciprocal velocity obstacles fix it by having each party take half the avoidance; the lab's people take theirs with social forces, which comes to the same.
Predict: Reacting people, τ = 2 s. Any contacts, and anything else?
- No contact with a person, but the robot clips a shelf: the cones know nothing about walls
- No contact and nothing else: shorter is better
- Two contacts: the people react too late for a 2 s horizon
Answer: 0

## Try: Into the shelf: what the cones do not know
cfg: {"sim":true,"level":4,"set":{"spd":"vo","voT":2,"people":"reactive"},"tab":"ctl","layers":{"vo":true,"agents":true}}
Setup: Reacting people, τ = 2 s, and the lidar safety stop off, as on this level by default.
See: No contact with a person, and two collisions with shelves: a late, sharp detour chose a velocity pointing into the shelf beside the aisle, which no cone forbids. With the safety stop on (Control → lidar safety stop) the shelves are not hit, but the stop halts the robot in front of them and goals are given up as stuck: two of five with τ = 2 s, four of five with τ = 3 s.
Shows: A velocity obstacle is only ever about one moving thing. A complete local planner puts the static map into the same velocity set, which is exactly what DWA does when it scores its rollouts against the costmap and the people together, and what ORCA-based stacks do by adding the walls as linear constraints. Bolting a safety stop onto VO stops the collision and the mission with it.

## Code: agVO, the cone test and the choice
snippet: vo
focus: const disc = dw * dw - ww * (dd - R * R);
focus: const t = (dw - Math.sqrt(disc)) / ww;
focus: const cost = (ux - ux0) ** 2 + (uy - uy0) ** 2 + 0.03 * Math.abs(dth) + 0.02 * Math.abs(dth - last);
example: ctl/pp
Note: voHits is the quadratic of the lesson: the discriminant says whether the ray meets the disc, the root when. agVO builds one cone per tracked person, tests the command, and the marked cost line is the whole decision: nearest to the command, a little against turning, a little for the heading chosen last tick. Edit and run: the pure-pursuit example is the tracker VO corrects; add the cone test to it and the slot gets obs.agents with positions and velocities.

## Think about
Q: The cone's apex sits at the person's velocity, not at the robot. Why?
A: Because what matters is the relative velocity. A robot that moves exactly like the person never changes its distance to them, so that velocity is the one that cannot collide, the apex; every velocity whose difference from it points into the disc does. Drawing the cones in the world, as the layer does, means placing the apex where the robot would be in τ if it moved with the person.
Q: With scripted people the contacts went from three to one or two; with reacting people to zero. What does a real robot's crowd look like?
A: Mostly reacting: people do not walk into robots, and a planner that assumes they keep their velocity is pessimistic in exactly the way that makes it swerve too much, then swerve back. That is why the field moved from VO to reciprocal VO and ORCA, which assume the other party does half the work, and why some stacks now learn the share from data.
Q: The lab samples 76 velocities; ORCA solves a small linear program instead. What is the difference in practice?
A: ORCA turns each cone into a half-plane constraint and finds the nearest allowed velocity exactly, in microseconds, for hundreds of neighbours; sampling finds the nearest of a few dozen guesses and can miss a narrow gap between two cones. Sampling is easier to read and to combine with other costs, which is why DWA samples; the LP is what you run at scale.

## Check yourself
Q: A person 3 m ahead walks across at 1.2 m/s, the radii add to 0.75 m, the robot drives at 0.8 m/s straight at where they are now. The relative velocity has magnitude √(0.8² + 1.2²) and the ray passes at closest approach 3 × 1.2 / √(0.8² + 1.2²) m from the disc centre. Is the robot's velocity inside the cone? Answer with the closest approach in metres.
Answer: 2.5
Tolerance: 0.05
Unit: m
How: |w| = √(0.64 + 1.44) = 1.44 m/s; the closest approach of the ray to the centre is |d| sin(angle between d and w) = 3 × (1.2 / 1.44) = 2.5 m, more than R = 0.75: the person will have crossed before the robot arrives, so the velocity is outside the cone
