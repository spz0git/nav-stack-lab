group: ctl
title: Running out of grip
extra: true

<p><b>Why this matters.</b> Every vehicle has a grip limit. The tyres can push sideways with at most $\mu$ times their load, so the car can corner at most at $\mu g$ of lateral acceleration; ask for a tighter turn at that speed and physics declines. Planners respect the limit through a lateral-acceleration cap on the speed profile, a number that stands for the tyres. This lesson sets the cap above what the floor can give and watches what an understeering car does when it runs out.</p>
<p><b>The idea.</b> The front tyres of an understeering car reach their limit first. From then on more steering adds slip angle but no force: the car follows the tightest circle the grip allows, $v^2/\mu g$, and pushes wide of the path. The tracker sees the cross-track error grow and steers harder, up to the lock, and nothing happens. Only slowing down helps, and the trackers here slow down only for the curvature the speed profile planned for, not for the error.</p>
$$a_y = v^2\kappa \le \mu g \qquad \text{slippery floor: } \mu g = 0.25 \times 9.81 = 2.45\ \text{m/s}^2$$
<p>The tightest turn the grip allows at speed $v$ is $R = v^2/(\mu g)$, 1.63 m at 2 m/s (the steering could do 0.96 m). The speed profile keeps $v \le \sqrt{a_\text{lat}/\kappa}$ (Control tab; $a_\text{lat}$ is the planner's model of the grip).</p>
<p><b>Where it comes from.</b> Each axle's sideways force is clipped at $\mu$ times its static load, $\mu m g\,l_r/L$ at the front and $\mu m g\,l_f/L$ at the rear, and in a steady turn each axle carries the same share of $m a_y$, so both reach their limit at $a_y = \mu g$. Turning in also needs yaw torque from the front tyres, so they saturate a little before the car as a whole reaches $\mu g$. <a class="chref" href="#notes=ch1/6-the-limits-and-where-the-kinematic-model-stops">The limits: chapter 1 §6</a> · <a class="chref" href="#notes=ch5/1-path-coordinates-and-the-speed-profile">the speed profile: chapter 5 §1</a></p>
<p><b>What the lab does.</b> The car with tyre slip on the slippery floor at a cruise speed of 2 m/s on L1, with three settings of the curve cap $a_\text{lat}$. The Control health light turns amber when $a_y$ passes $0.8\,\mu g$, the Sideslip arrow turns amber with it, and the plots show $a_y$ against $\mu g$ and the cross-track error.</p>

## Try: Cap below the grip: a_lat 0.6
cfg: {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2.5,"vcruise":2,"alat":0.6},"plot":"cte","panes":[["ay","mug"]],"layers":{"slip":true,"trail":true}}
Setup: Slippery floor, cruise 2 m/s, the lab's default cap of 0.6 m/s², a quarter of $\mu g$.
See: All 4 goals in 39.5 s, cross-track error 5.8 cm RMS; $a_y$ peaks at 0.94 m/s², 38 % of $\mu g$.
Shows: With the speed profile honest about the grip the car is slower in the turns and stays near the path, even though its yaw gain is a third below kinematic at this speed.
Predict: Cruise 2 m/s with the cap at a quarter of $\mu g$: how will the car track?
- Near the path, a few cm RMS, slower in the turns
- Wide of every turn: it is above $v_{ch}$
- It spins: the rear lets go first
Answer: 0

## Try: Cap at 0.8 μg: a_lat 2
cfg: {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2.5,"vcruise":2,"alat":2},"plot":"cte","panes":[["ay","mug"]],"layers":{"slip":true,"trail":true}}
Setup: The cap raised to 2 m/s², just below the $0.8\,\mu g$ at which the health light warns.
See: All 4 goals in 36.1 s, faster, but the cross-track error is 18 cm RMS and 54 cm at most; $a_y$ peaks at 1.49 m/s² (61 % of $\mu g$) because the car never quite gets round the turns it was planned through.
Shows: Below the limit the tyres are still linear, but they need large slip angles, and the understeer makes the car run wide of every planned turn. Speed bought with grip margin is paid for in tracking error.
Predict: The cap at 2 m/s², just under $0.8\,\mu g$: what happens to time and error?
- Faster with about the same error: the tyres are still linear
- Slower: the car has to steer more
- Faster, but the error triples as the car runs wide
Answer: 2

## Try: Cap above the grip: a_lat 6
cfg: {"sim":true,"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2.5,"vcruise":2,"alat":6},"plot":"cte","panes":[["ay","mug"]],"layers":{"slip":true,"trail":true}}
Setup: The cap at 6 m/s², more than twice what the floor can give: the speed profile no longer slows for the turns.
See: The car pushes wide at the first sharp turn: off-path replan at 10.5 s, at 25.7 s its nose in the outer wall below the third goal, and a goal skipped after the car is stuck; 3 of 4 goals. The cross-track error reaches 1.0 m; $a_y$ peaks at 2.13 m/s², 87 % of $\mu g$; the front tyres reach their limit (6 % of the run), the steering sits at its lock for 23 % of it, and the Control light is amber in the turns.
Shows: At the limit, steering is no longer a control input: the tracker can turn the wheels to the lock and the car does not turn any tighter. The only remedy is speed, and it has to come before the turn, which is the speed profile's job, so its $a_\text{lat}$ has to be the grip the floor really has.
Predict: The cap above the grip, 6 m/s²: what will the car do at the first sharp turn?
- Steer to the lock and push wide, off the path
- Spin and stop
- Follow the path: the tracker steers harder to compensate
Answer: 0

## Try: Kinematic car, same cap
cfg: {"sim":true,"level":0,"set":{"veh":"car","vmax":2.5,"vcruise":2,"alat":6},"plot":"cte","layers":{"trail":true}}
Setup: The kinematic car with the cap at 6 m/s².
See: All 4 goals in 34.6 s, cross-track error 5.7 cm RMS.
Shows: The kinematic car has no grip limit, so nothing in the simulation would ever tell a planner tuned on it that 6 m/s² is impossible. That is why the cap exists, and why it is a number about the tyres, not about the controller.
Predict: The kinematic car with the impossible 6 m/s² cap: how will it do?
- It pushes wide like the dynamic car
- It tracks fine: it has no grip limit
- It saturates its steering rate and rings
Answer: 1

## Code: dynStep, the friction limit
snippet: dyn-step
focus: G.ff = (P.mu * G.m * GRAV * G.lr) / G.L; … G.fr = (P.mu * G.m * GRAV * G.lf) / G.L;
Note: The two lines set how much lateral force each axle can give: $\mu$ times the weight on that axle. Everything in the lesson about running out of grip is these two clamps being reached in dynF.

## Think about
Q: Why does the understeering car push wide rather than spin?
A: Its front tyres reach their limit first: they carry a larger share of the slip, so they saturate while the rears still have grip. The front then slides and the car turns less (pushes wide); the rear holds, so the yaw motion stays stable. An oversteering car saturates the rear first, the tail steps out, and the yaw motion can diverge, which is why road cars are tuned to understeer.
Q: The tracker steered to the lock and gained nothing. What would have helped?
A: Braking before the turn, so that $v^2\kappa$ fits under $\mu g$, and in the turn easing off the steering to the angle at which the front tyres give their most force. The trackers here do neither, because their model has no grip limit; a speed profile with the real $\mu g$ does the first. The MPC with the tyre model (Control → Tyre model in the prediction) knows the limit and stops asking for steering that earns nothing, but it holds the reference speed, so the braking still has to come from the speed profile (<a class="lsref" href="#lesson=ctl:17">The moose test</a>).
Q: The health light warns at $0.8\,\mu g$. Why not at $\mu g$?
A: Because the lateral acceleration the car reaches is a lagging signal: by the time it reads $\mu g$ the front tyres are already saturated. A margin of 20 % leaves room for the yaw torque of turning in, for a gust of disturbance, and for a $\mu$ that is lower than assumed, the last of which is the usual cause on real roads.

## Check yourself
Q: On a road with $\mu = 0.6$ ($g = 9.81$ m/s²) a car travels at 20 m/s. What is the tightest turn radius the grip allows, $R = v^2/(\mu g)$, in metres?
Answer: 67.96
Tolerance: 1.4
Unit: m
How: $\mu g = 0.6 \times 9.81 = 5.886$ m/s²; $R = 20^2/5.886 = 400/5.886 = 68.0$ m.
