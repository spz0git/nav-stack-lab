group: per
title: People who react

<p><b>Why this matters.</b> A planner is tested against a model of the people around it, and the model can make the planner look better than it is. Scripted pedestrians walk their line whatever the robot does, so every near miss is the robot's fault. Real people step aside and slow down, and so make up for a good share of a robot's mistakes. A benchmark against people who yield therefore reports fewer contacts than the planner deserves. This lesson puts a model of people who react next to the scripted one, so that you can measure the difference and know how far to trust the metrics.</p>
<p><b>The idea.</b> Social forces treat each person as a particle that is driven toward their goal and pushed away from everything nearby. The drive pulls the person's velocity toward their preferred velocity. Each push grows exponentially with the overlap between two bodies. It is negligible beyond a few tens of centimetres and overwhelming on contact, so the crowd behaves like a set of soft bodies. The robot is one of the things that push, with a longer reach than a person, because people give machines more room. Walls push along the gradient of the distance field, which the costmap of lesson 2 already computes.</p>
$$\begin{aligned} F &= \frac{v_0 e - v}{\tau} + \sum A \exp\bigl((r_i + r_j - d)/B\bigr)\, n + \text{walls} \qquad \tau = 0.5\ \text{s} \\ \text{robot:}\ \ & A_r \exp\bigl((r_i + r_\text{robot} - d)/B_r\bigr)\, n \qquad\qquad \text{walls:}\ \ A_w \exp\bigl((r_i - D)/B_w\bigr)\, \nabla D \\ v &\leftarrow v + F\,\Delta t, \quad |v| \le 1.3\, v_0 \qquad\qquad p \leftarrow p + v\,\Delta t \quad \text{(every 50 ms tick)} \end{aligned}$$
<p>Here $e$ is the unit vector toward the person's goal, $v$ their velocity, $d$ the distance between centres and $n$ the unit vector from the other body to the person. The robot counts with $r_\text{robot} = 0.3$ m (0.55 m for the car). Finally, $D$ is the distance from the person's centre to the nearest wall, read from the map's distance field.</p>
<p><b>Where it comes from.</b> This is a model and is not derived from anything. Helbing and Molnár (1995) proposed the form of a drive plus repulsions because it reproduces how crowds form lanes and how they behave at bottlenecks. It has been the standard pedestrian model in robotics benchmarks since. The constants here (people $A = 2$, $B = 0.35$ m; robot $A = 3$, $B = 0.5$ m; walls $A = 2.5$, $B = 0.25$ m; speed capped at $1.3\,v_0$) were tuned until the people looked right on this floor; they were not fitted to data. <a class="chref" href="#notes=ch3/8-people-who-react-the-social-force-model">Derivation: chapter 3 §8</a></p>
<p><b>What the lab does.</b> The People switch is in the Vehicle tab. Scripted people walk back and forth on their segment at 0.6 to 0.9 m/s and turn at each end without stopping. Reactive people have the same segments and speeds, but they move by the forces above, integrated every tick, and they pause for half a second at each end. The Response to agents selector in the Control tab chooses whether the robot plans its speed against the tracked people (the ST planner) or ignores them. Contacts and the closest approach are in the Telemetry metrics. The closest approach reads 0.00 m once the bodies overlap. A contact also pauses the run unless "Pause on contact" is off. The counts below are for seed 7, counted up to Mission complete. After that the robot is parked at its last goal and a scripted person can still walk into it, so those contacts are left out.</p>

## Try: Reactive people, speed planning
cfg: {"sim":true,"level":4,"set":{"people":"reactive"},"tab":"veh"}
Setup: L5 with reactive people. The robot tracks them and plans its speed against the predictions.
See: There are no contacts over the run, the closest approach is 0.18 m, and all five goals are reached. Watch a person meet the robot in an aisle. The person drifts a step sideways before the robot has slowed, and the robot yields for a shorter time than with scripted people. There are four replans, three of them "agent blocking".
Shows: The robot and the people both avoid each other, and together they do better than either would alone. This is the benchmark that flatters the planner. The zero depends as much on the people's cooperation as on the planner.
Predict: Reactive people and the speed planner on: how many contacts over the run?
- The same one as with scripted people
- More: two parties dodging the same way collide
- None
Answer: 2

## Try: Reactive people, ignore
cfg: {"sim":true,"level":4,"set":{"people":"reactive","spd":"none"},"tab":"ctl"}
Setup: Reactive people again, with the response to agents off. The robot drives its path at cruise speed as if the floor were empty.
See: There are two contacts, and the same five goals are reached. The closest approach reads 0.00 m, which means the bodies overlapped, by 0.18 m at most. Most encounters end with the person stepping out of the way. The two contacts are the encounters where the person could not. Hemmed in by the shelves, the person slows almost to a stop in the robot's path, and the robot, still at cruise speed, drives into them.
Shows: A robot that does nothing about people has only two contacts on this floor. That looks almost acceptable, but it is entirely the people's doing. Here the contact count measures how polite the crowd is, and it says nothing about the planner.
Predict: Reactive people, and the robot ignores them entirely, driving at cruise speed. How many contacts?
- Many: one per encounter, the robot never slows
- Only a couple: most people step aside in time
- None: people always get out of the way
Answer: 1

## Try: Scripted people, ignore
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl"}
Setup: Scripted people, who never deviate from their line, with the response to agents off.
See: There are three contacts, and they are deep. The closest approach again reads 0.00 m, but the bodies overlap by up to 0.57 m, three times as deep as with reactive people. On the map the robot drives through people. Seeds 2 to 5 give the same three contacts, against two or three with reactive people. With the speed planner on, which is the level's default, the same scripted people produce one contact.
Shows: Against people who do not yield, you can see what the planner adds: three contacts without it, one with it. Against people who yield it was two to none. The planner and the floor are the same in both, and the model of the people changes every count. A score of two for ignoring people looks acceptable only against the polite crowd. Report results against both models, and if you can run only one, run the stricter one.
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
Note: The first marked pair is the goal force, which pulls the velocity toward the preferred velocity. The second is the repulsion between two people, exponential in the gap. The robot comes in as one more repulsion a few lines further down. In Edit and run, the predictor example assumes constant velocity, and these forces are what break that assumption.

## Think about
Q: Which metric is harder to flatter: contact count or closest approach?
A: Closest approach, slightly. A person who yields but steps aside late still leaves a small distance in the closest approach, where the contact count shows nothing. Both can be flattered. A fair comparison runs the same planner against both models of people. The difference between the two results is how much the planner relies on people cooperating.
Q: The repulsion from the robot has a longer reach ($B = 0.5$ m) than from another person (0.35 m). What does that assumption do to the results?
A: It makes the reactive people give the robot more room than they give each other, which lowers the contact count for every planner, including the one that ignores them. Shrink it to 0.35 and the "ignore" run collects more contacts. The ranking of the planners probably stays the same, but their scores change. Every constant in a pedestrian model is also a constant in your benchmark.
Q: Why cap the speed at $1.3\,v_0$?
A: When two bodies overlap, which happens at every near miss, the exponential pushes can fling a person away at several metres per second. The cap keeps the speed to a brisk walk, which is how fast people actually move when they sidestep.

## Check yourself
Q: Two people of radius 0.25 m are 0.6 m apart centre to centre, with $A = 2$ and $B = 0.35$ m. What is the magnitude of the repulsion $A \exp\bigl((r_i + r_j - d)/B\bigr)$ between them?
Answer: 1.503
Tolerance: 0.03
Unit: m/s²
How: $(0.25 + 0.25 - 0.6)/0.35 = -0.286$; $2 \times e^{-0.286} = 2 \times 0.751 = 1.50$
