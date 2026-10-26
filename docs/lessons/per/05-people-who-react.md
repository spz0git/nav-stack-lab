group: per
title: People who react

<p><b>Why this matters.</b> A planner is evaluated against a model of the people around it, and the model can flatter it. Scripted pedestrians walk their line whatever the robot does, so every near miss is the robot's fault; real people step aside, slow down, and absorb a good share of a robot's mistakes. A benchmark against people who yield reports fewer contacts than the planner earned. This lesson puts a reactive pedestrian model next to the scripted one so that the difference can be measured, and so that the metrics can be read with the right suspicion.</p>
<p><b>The idea.</b> Social forces treat each person as a particle driven toward their goal and pushed away from everything near. The drive is a relaxation toward the preferred velocity; the pushes are exponentials of the overlap, negligible beyond a few tens of centimetres and overwhelming on contact, so the crowd behaves like a set of soft bodies. The robot is one of the things pushing, with a longer reach than a person, because people give machines room. Walls push along the gradient of the distance field, which the costmap of lesson 2 already provides.</p>
$$\begin{aligned} F &= \frac{v_0 e - v}{\tau} + \sum A \exp\bigl((r_i + r_j - d)/B\bigr)\, n + \text{walls} \qquad \tau = 0.5\ \text{s} \\ \text{robot:}\ \ & A_r \exp\bigl((r_i + r_\text{robot} - d)/B_r\bigr)\, n \qquad\qquad \text{walls:}\ \ A_w \exp\bigl((r_i - D)/B_w\bigr)\, \nabla D \\ v &\leftarrow v + F\,\Delta t, \quad |v| \le 1.3\, v_0 \qquad\qquad p \leftarrow p + v\,\Delta t \quad \text{(every 50 ms tick)} \end{aligned}$$
<p>Here $e$ is the unit vector toward the person's goal, $v$ their velocity, $d$ the distance between centres and $n$ the unit vector from the other body to the person; the robot counts with $r_\text{robot} = 0.3$ m (0.55 m for the car), and $D$ is the distance from the person's centre to the nearest wall, read from the map's distance field.</p>
<p><b>Where it comes from.</b> It is a model, not a derivation: Helbing and Molnár (1995) proposed the drive-plus-repulsion form because it reproduces lane formation and bottleneck behaviour in crowds, and it has been the standard pedestrian model in robotics benchmarks since. The constants here (people $A = 2$, $B = 0.35$ m; robot $A = 3$, $B = 0.5$ m; walls $A = 2.5$, $B = 0.25$ m; speed capped at $1.3\,v_0$) are tuned to look right on this floor, not fitted to data. <a class="chref" href="#notes=ch3/8-people-who-react-the-social-force-model">Derivation: chapter 3 §8</a></p>
<p><b>What the lab does.</b> The People switch is in the Vehicle tab. Scripted people walk back and forth on their segment at 0.6 to 0.9 m/s and turn at each end without stopping. Reactive people have the same segments and speeds but move by the forces above, integrated every tick, and pause for half a second at each end. The Response to agents selector in the Control tab chooses whether the robot plans its speed against the tracked people (the ST planner) or ignores them. Contacts and the closest approach are in the Telemetry metrics (the closest approach reads 0.00 m once the bodies overlap); a contact also pauses the run unless "Pause on contact" is off. The counts below are at seed 7, taken up to Mission complete: once the robot is parked at its last goal, a scripted person can still walk into it, and that is left out.</p>

## Try: Reactive people, speed planning
cfg: {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"veh"}
Setup: L5 with reactive people; the robot tracks them and plans its speed against the predictions.
See: Zero contacts over the run, closest approach 0.18 m, five goals. Watch a person meet the robot in an aisle: they drift sideways a step before the robot has slowed, and the robot's yield is shorter than with scripted people. Four replans, three of them "agent blocking".
Shows: Both sides are avoiding; the result is better than either would manage alone. This run is the flattering benchmark: the zero depends on the people's cooperation as much as on the planner.
Predict: Reactive people and the speed planner on: how many contacts over the run?
- The same one as with scripted people
- More: two parties dodging the same way collide
- None
Answer: 2

## Try: Reactive people, ignore
cfg: {"sim":true,"level":4,"set":{"people":"reactive","spd":"none"},"tab":"ctl"}
Setup: Reactive people again, with the response to agents off: the robot drives its path at cruise speed as if the floor were empty.
See: Two contacts, with the same five goals; the closest approach reads 0.00 m, an overlap (0.18 m deep at most). Most encounters end with the person stepping out of the way; the contacts are the two where they could not: hemmed in by the shelves, the person slows almost to a stop in the robot's path, and the robot, still at cruise speed, drives into them.
Shows: A robot that does nothing about people scores only two contacts on this floor, which looks almost acceptable and is entirely the people's doing. The number measures the crowd's politeness, not the planner.
Predict: Reactive people, and the robot ignores them entirely, driving at cruise speed. How many contacts?
- Many: one per encounter, the robot never slows
- Only a couple: most people step aside in time
- None: people always get out of the way
Answer: 1

## Try: Scripted people, ignore
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: Scripted people, who never deviate, and the response to agents off.
See: Three contacts, and deep ones: the closest approach again reads 0.00 m, but the bodies overlap by up to 0.57 m, three times as deep as with reactive people; on the map the robot drives through people. Seeds 2 to 5 give the same three contacts, against two or three with reactive people. With the speed planner on (the level's default) the same scripted people produce one contact.
Shows: Against people who do not yield, the planner's contribution is visible: three contacts to one. Against people who do, it was two to none. Same planner, same floor; the model of the people moves every count, and an "ignore" score of two looks acceptable only against the polite crowd. Report both, and when only one can be run, run the stricter one.
Predict: Scripted people, who never deviate, and the robot ignoring them: how do the contacts compare with the reactive-ignore run?
- As many or more, and much deeper: nobody steps aside, so the robot drives through them
- The same, just as deep: the robot's behaviour is what counts
- Fewer: scripted people walk predictable lines
Answer: 0

## Code: updatePedsReactive, the forces
snippet: social-force
focus: let fx = (p.v * ex - (p.vx || 0)) / SF.tau, … fy = (p.v * ey - (p.vy || 0)) / SF.tau;
focus: f = SF.A * Math.exp((p.r + q.r - dd) / SF.B);
example: pred/cv
Note: The first marked pair is the goal force, a relaxation toward the preferred velocity; the second is the person-to-person repulsion, exponential in the gap. The robot enters as one more repulsion a few lines down. Edit and run: the predictor example assumes constant velocity, which is exactly what these forces break.

## Think about
Q: Which metric is harder to flatter: contact count or closest approach?
A: Closest approach, slightly: a yielding person who steps aside late still produces a small distance, where the contact count would show nothing. Neither is immune. The honest comparison is the same planner against both people models, and the difference between them is how much the planner relies on cooperation.
Q: The repulsion from the robot has a longer reach ($B = 0.5$ m) than from another person (0.35 m). What does that assumption do to the results?
A: It makes the reactive people give the robot more room than they give each other, which lowers contacts for every planner, including the one that ignores them. Shrink it to 0.35 and the "ignore" run collects more contacts; the ranking of planners is probably unchanged, their absolute scores are not. Any constant in a pedestrian model is also a constant in your benchmark.
Q: Why cap the speed at $1.3\,v_0$?
A: Without a cap the exponential pushes can fling a person at several metres per second when two bodies overlap, which happens at every near miss. The cap keeps the model in the range of a brisk walk, which is what people actually do when they sidestep.

## Check yourself
Q: Two people of radius 0.25 m are 0.6 m apart centre to centre, with $A = 2$ and $B = 0.35$ m. What is the magnitude of the repulsion $A \exp\bigl((r_i + r_j - d)/B\bigr)$ between them?
Answer: 1.503
Tolerance: 0.03
Unit: m/s²
How: $(0.25 + 0.25 - 0.6)/0.35 = -0.286$; $2 \times e^{-0.286} = 2 \times 0.751 = 1.50$
