group: ctl
title: The moose test: an MPC that knows the tyres
extra: true

<p><b>Why this matters.</b> Collision avoidance at speed is where the vehicle model stops being a detail. In the moose test (ISO 3888-2) a car at speed swerves round an obstacle into the other lane and back. A planner can draw the swerve; whether the car follows it is decided by the tyres. A controller that predicts with the kinematic model believes every steering angle is a turn it gets at once, and on the slippery floor above the characteristic speed that belief is off by a factor of three.</p>
<p><b>The idea.</b> An MPC is only as good as its prediction model. Put the dynamic bicycle model in it and the prediction knows two things the kinematic one does not: the car turns at $v/(L + K_{us}v^2)$ per unit of steering, a third of $v/L$ here, and the yaw rate builds up through the car's own yaw mode instead of appearing with the steering angle. So the optimizer starts the swerve earlier and steers further for the same path. It also knows the tyre forces stop at $\mu F_z$, so steering past the grip earns nothing in its prediction. The kinematic MPC learns all of this only through feedback, after the error has appeared, and at 3.5 m/s there is not enough road for that.</p>
$$\mathbf{x} = [x,\ y,\ \theta,\ v,\ \delta,\ v_y,\ r] \qquad \mathbf{u} = [a,\ \dot\delta]$$
<p>The kinematic MPC has $\mathbf{x} = [x,\ y,\ \theta,\ v,\ \delta]$. The two extra states follow</p>
$$\dot v_y = \frac{F_f\cos\delta + F_r}{m} - v\,r \qquad \dot r = \frac{l_f F_f\cos\delta - l_r F_r}{I_z} \qquad F = \operatorname{clamp}(C\alpha,\ \pm\mu F_z)$$
<p>On the slippery floor at 3.5 m/s, $r/\delta = v/(L + K_{us}v^2) = 0.36\,v/L$, and the yaw mode is at $-3.9 \pm 4.2j$ 1/s. The prediction takes 5 substeps per 0.1 s prediction step (linearly implicit Euler); with stiff tyres it is the kinematic model.</p>
<p><b>Where it comes from.</b> The lateral equations are chapter 1's dynamic bicycle model, the one the simulator runs; the MPC integrates them inside each prediction step and moves the rear axle with the resulting velocities, so its Jacobians, sensitivities and constraints work unchanged on the larger state. <a class="chref" href="#notes=ch7/10-the-tyre-model-in-the-prediction">The tyre model in the prediction: chapter 7 §10</a> · <a class="chref" href="#notes=ch1/4-the-dynamic-bicycle-model">the dynamic bicycle model: chapter 1 §4</a></p>
<p><b>What the lab does.</b> L7, the moose test: a 3.2 m road between barriers, a box in the right lane at 8 m and one in the left lane at 15 m. The car with tyre slip on the slippery floor ($v_{ch}$ 2.6 m/s) enters at 3.5 m/s; the curve cap $a_\text{lat}$ is 8 m/s², so the reference holds the speed through the slalom. Hybrid A* plans the slalom once on the known map and the MPC tracks it with obstacle constraints from the lidar. Control → <b>Tyre model in the prediction</b> switches the MPC's model; it reads $v_y$ and $r$ from the simulator, as a gyro and a sideslip estimator would give them. The Analyze view reads the MPC's two extra gains, on $v_y$ and $r$, and puts them in the loop. The runs below are at seed 7, one pass of the slalom each; the step tests are the Analyze view's linear model and its simulator check.</p>

## Try: Kinematic MPC at 3.5 m/s
cfg: {"sim":true,"level":6,"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}
Setup: L7 as it loads: the MPC with its kinematic prediction model. Plots: the yaw rate $r$ against $v\tan\delta/L$, and the cross-track error.
See: The MPC starts the swerve at 1.35 s, when $v\tan\delta/L$, the steering expressed as a turn rate, passes 0.5 rad/s, and steers up to 15°. The yaw rate reaches about a third of $v\tan\delta/L$ (0.51 against 1.50 rad/s at 1.8 s); the car slides about 0.65 m right of its path and hits the first box at 2.4 s. It stays there: this level does not reverse.
Shows: The kinematic MPC is not a bad controller of this car; it is a good controller of a different car. Its feedback sees the error grow and steers harder, but the car answers late and at a third of the expected rate, and the box is two seconds away.
Predict: The kinematic MPC entering the moose test at 3.5 m/s on the slippery floor: what happens?
- It passes, with a large but recoverable error
- It hits the first box: the car turns at a third of the expected rate
- It spins out between the boxes
Answer: 1

## Try: Tyre model in the MPC
cfg: {"sim":true,"level":6,"set":{"mpcDyn":true},"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}
Setup: The same run with Control → Tyre model in the prediction ticked.
See: The swerve starts half a second earlier: $v\tan\delta/L$ passes 0.5 rad/s at 0.85 s instead of 1.35 s. The steering peaks at 13.5° in the first swerve, no more than the kinematic MPC's late 15°, and at 21° on the swerve back. The yaw rate still averages 41 % of $v\tan\delta/L$ in the turns, but the car passes both boxes and reaches the goal in 10.5 s: cross-track error 9.9 cm RMS and 0.40 m at worst, sideslip up to 3.3°, $a_y$ up to 92 % of $\mu g$. Each solve takes about 0.2 ms longer.
Shows: The tyres did not change; the prediction did. Knowing that the car turns late and weakly, the optimizer begins while there is still room, and the steering it plans is the one that gets the body round the box. With stiff tyres the two models drive the same line to within a centimetre, so nothing else about the controller changed.
Predict: With the tyre model in the prediction, how does the MPC change its steering?
- It starts the swerve about half a second earlier; the car gets through
- It starts at the same moment but steers harder; the car gets through
- Same steering; the car still hits the box
Answer: 0

## Try: Analyze: the kinematic MPC on this car
cfg: {"level":6,"test":"step","stepKind":"offset","stepAmp":0.05}
Setup: The lateral loop at 3.5 m/s with the kinematic MPC, and a 5 cm offset step in the simulator.
See: Phase margin 69°, $M_s$ 1.24: by its margins a comfortable loop. But the dominant closed-loop poles sit at 1.5 rad/s with $\zeta$ 0.22: the step overshoots 50 % (50.1 % in the simulator) and takes 11.5 s to settle.
Shows: The margins are read where $|L|$ crosses 1 (7.5 rad/s here) and the sensitivity peak; the slow, lightly damped pair that the tyres add shows in neither, only in the poles and the step. Read the poles as well as the margins when the plant has dynamics the controller was not designed for.
Predict: The kinematic MPC's lateral loop at 3.5 m/s on this car: what will the margins and the poles say?
- Low margins and low damping, both agreeing
- Comfortable margins, but a lightly damped slow pair and 50 % overshoot
- Comfortable margins and $\zeta \approx 0.7$
Answer: 1

## Try: Analyze: with the tyre model
cfg: {"level":6,"set":{"mpcDyn":true},"test":"step","stepKind":"offset","stepAmp":0.05}
Setup: The same with the tyre model in the prediction.
See: Phase margin 50°, $M_s$ 1.30, crossover 6.6 rad/s; the dominant poles have $\zeta$ 0.70, and the step overshoots 4.1 % (4.1 % in the simulator) and settles in 2.7 s. The kinematic MPC on the kinematic car at the same speed: $\zeta$ 0.73, 3.2 %, 2.0 s.
Shows: With the tyres in its model the MPC gets back the loop it has on the kinematic car, without a change to a single weight. Its two extra gains, on $v_y$ and $r$, are yaw-rate and sideslip feedback that the optimizer derived from the model; a hand-built controller would need them designed.
Predict: With the tyre model, what happens to the dominant poles and the step?
- $\zeta$ back to about 0.7, overshoot a few per cent
- Margins improve but the step still overshoots 50 %
- The loop slows to stay under the yaw mode; settling in 10 s
Answer: 0

## Try: Grippy tyres at 4 m/s
cfg: {"sim":true,"level":6,"set":{"Cf":500,"Cr":700,"mu":0.9,"vcruise":4},"panes":[["yawr","yawk"],["cte"]],"layers":{"slip":true}}
Setup: L7 with the grippy tyres ($v_{ch}$ 11.5 m/s) at 4 m/s, the kinematic MPC.
See: It passes in 10.0 s, 0.24 m off its path at worst; in the turns the yaw rate is 89 % of $v\tan\delta/L$.
Shows: Realistic tyres keep a small car nearly kinematic at lab speeds. The tyre model matters where $K_{us}v^2$ is not small against $L$: high speed, soft tyres, low grip. That is why it is standard in road-vehicle MPC and rare in warehouse robots.
Predict: Grippy tyres ($v_{ch}$ 11.5 m/s) at 4 m/s with the kinematic MPC: how will it do?
- Hits a box: 4 m/s is faster than the failed run
- Passes: the yaw rate is near 90 % of kinematic
- Passes only because it slows down
Answer: 1

## Code: mpcDynPose, the tyre model inside the MPC
snippet: mpc-dyn-pose
Note: The prediction model of the tyre-aware MPC: the same slip and force equations as the vehicle, stepped inside the horizon, so the controller knows the moose test's limit before it gets there.

## Think about
Q: The tyre model got through without braking. Would it brake for a swerve it cannot make?
A: Not in this lab. At $\mu$ 0.1 it hits the first box at 3.5 m/s, as the kinematic MPC does. Its cost holds the speed to the reference, and with the front tyres saturated, slowing down pays off in its prediction only late in the two-second horizon, through a lateral error the Gauss–Newton step does not trade for a speed error. The speed has to come from upstream: a reference speed that respects the grip, $v \le \sqrt{\mu g/\kappa}$, which is the curve cap $a_\text{lat}$ set to the real $\mu g$.
Q: The MPC reads $v_y$ and $r$ from the simulator. What would a real car use?
A: The yaw rate from a gyro, which every car with stability control has. The lateral velocity is not measured directly: it is estimated from the gyro, a lateral accelerometer and the wheel speeds through a model like this one (a sideslip observer), or from a dual-antenna GNSS. Its error enters the MPC as model error, so production controllers often lean on r and weight the sideslip state loosely.
Q: Hybrid A* plans the slalom with arcs down to 1.17 m. Is that plan feasible at 3.5 m/s?
A: No tyre could follow those arcs at that speed: $3.5^2/1.17 = 10.5$ m/s², more than four times $\mu g$ here. The MPC survives because it does not follow the plan exactly; it cuts the arcs within the obstacle constraints. A planner for speed needs a curvature limit from the grip, $\kappa \le \mu g/v^2$, or a search over the dynamic model; the MPC can only make the best of the plan it is given.

## Check yourself
Q: The slippery-floor car ($L = 0.6$ m, $K_{us} = 0.0875$ rad/(m/s²)) at 3.5 m/s holds a steady steering angle of 10°. What yaw rate $r = \delta\,v/(L + K_{us}v^2)$ results, in rad/s?
Answer: 0.365
Tolerance: 0.01
Unit: rad/s
How: $L + K_{us}v^2 = 0.6 + 0.0875 \times 12.25 = 1.672$ m; $r/\delta = 3.5/1.672 = 2.093$ 1/s; $\delta = 10° = 0.1745$ rad; $r = 2.093 \times 0.1745 = 0.365$ rad/s.
