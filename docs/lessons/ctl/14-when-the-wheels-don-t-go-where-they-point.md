group: ctl
title: When the wheels don't go where they point
extra: true

<p><b>Why this matters.</b> Every model in this lab so far assumes the car goes exactly where its front wheel points: the turn rate is $v\tan\delta/L$, and nothing else. At walking pace that is true. A real car corners because its tyres push sideways, and a tyre pushes sideways only by slipping, so at speed the wheels do not go where they point. Planners, trackers and the MPC here are all built on the kinematic model; this lesson puts a car under them that does not obey it, and shows what the mismatch costs.</p>
<p><b>The idea.</b> Tyre slip: each tyre moves at a small angle to where it points, its slip angle, and pushes sideways in proportion, with a cornering stiffness per axle. In a steady turn the front tyres of most cars slip more than the rears, so the car turns less than the geometry says: it understeers. How much less grows with the square of the speed, through the understeer gradient. The rear slides too, so the centre of mass moves at a sideslip angle $\beta$ to the heading, and the car's odometry, which works the turn rate out from the steering angle, reads a turn the car did not make.</p>
$$\alpha_f = \delta - \frac{v_y + l_f r}{v_x} \qquad \alpha_r = -\frac{v_y - l_r r}{v_x} \qquad F_y = C\alpha, \quad |F_y| \le \mu F_z$$
<p>In a steady turn:</p>
$$\frac{r}{\delta} = \frac{v}{L + K_{us} v^2} \qquad K_{us} = \frac{m}{L}\Bigl(\frac{l_r}{C_f} - \frac{l_f}{C_r}\Bigr) \qquad v_{ch} = \sqrt{L/K_{us}}$$
<p>On the slippery floor ($m$ 10 kg, $C_f$ 40, $C_r$ 90 N/rad, $\mu$ 0.25), $K_{us} = 0.0875$ rad/(m/s²) and $v_{ch} = 2.62$ m/s: at 1.5 m/s the car turns at 75 % of $v\tan\delta/L$, at 2 m/s at 63 %.</p>
<p><b>Where it comes from.</b> Newton's law sideways and the moment balance about the centre of mass, with the slip angles above and linear tyres, give a linear model in the lateral velocity $v_y$ and the yaw rate $r$. Set its derivatives to zero and the steady yaw rate per unit of steering is the formula above; with stiff tyres ($C \to \infty$) it is the kinematic $v/L$. <a class="chref" href="#notes=ch1/4-the-dynamic-bicycle-model">The dynamic bicycle model: chapter 1 §4</a> · <a class="chref" href="#notes=ch1/5-understeer-the-characteristic-speed-and-stability">understeer and the characteristic speed: §5</a></p>
<p><b>What the lab does.</b> Vehicle → <b>Car (dynamic: tyre slip)</b> runs the dynamic bicycle model under the same longitudinal chain (command, lag, acceleration and steering-rate limits): states $v_y$ and $r$ at the centre of mass, the pose still at the rear axle, tyres clipped at $\mu$ times their load. The <b>Slippery floor</b> preset makes the lab car's characteristic speed 2.6 m/s instead of a passenger car's 27, so the effects show at lab speeds; <b>Grippy</b> is kinematic to within 3 % below 2 m/s. The map's Sideslip layer draws the velocity of the centre of mass against the heading. The odometry reports $v\tan\delta/L$ unless the yaw-rate gyro is on (Sensors tab). These runs lift the curve cap $a_\text{lat}$ to 1.5 m/s² so the car takes its turns at speed. All numbers below are at seed 7, each over one run of the four goals.</p>

## Try: Kinematic car at 1.5 m/s
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"car","vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte","layers":{"slip":true}}
Setup: L1's four goals on the empty floor (Mission → Map → Empty floor: only the outer walls, so a car that leaves its path has room to show it), the kinematic car at 1.5 m/s with pure pursuit and Hybrid A*, curve cap 1.5 m/s².
See: All 4 goals in 40.8 s, cross-track error 4.2 cm RMS (13 cm at most).
Shows: The reference: the car the trackers were designed for, at the same speed as the next run.
Predict: The kinematic car at 1.5 m/s with the curve cap raised to 1.5 m/s²: how will it track?
- Within a few cm RMS, all goals reached
- It loses the path in the turns at this cap
- It slides: 1.5 m/s² is past the grip
Answer: 0

## Try: Slippery floor, same speed
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte","panes":[["yawr","yawk"],["beta"]],"layers":{"slip":true}}
Setup: The same run with the car with tyre slip on the slippery floor. Plots: the yaw rate $r$ against the kinematic $v\tan\delta/L$, and the sideslip $\beta$.
See: All 4 goals in 42.0 s, but the cross-track error is 12.1 cm RMS (37 cm at most), three times the kinematic car's. In every turn the yaw rate sits below $v\tan\delta/L$, on average at 0.76 of it; $\beta$ reaches 12° and the arrow on the map points visibly off the heading; the steering sits at its lock 7 % of the time.
Shows: The tracker asks for a curvature through the kinematic model and gets three quarters of it, so it lags into every turn and steers harder to catch up. Nothing in its code knows why: the plant changed under it.
Predict: The same run on the slippery floor: how will the yaw rate compare with $v\tan\delta/L$ in the turns?
- About equal: the tracker corrects the slip
- Above it: the rear slides and the car over-rotates
- About three quarters of it, and the error triples
Answer: 2

## Try: Dead reckoning on the sliding car
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5,"loc":"dr"},"plot":"cte","panes":[["yawr","yawk"]],"layers":{"slip":true,"trail":true}}
Setup: The slippery run steered by dead reckoning: the estimate integrates the odometry, which takes the turn rate from the steering encoder, $v\tan\delta/L$. On this level the odometry has no noise and no bias.
See: With the kinematic car this estimate is exact. Here it goes wrong in the first turns: in every turn the odometry reports more turning than the car did (the car turns at 0.77 of $v\tan\delta/L$), and the heading error grows turn by turn (8° by the second goal, 37° when it hits the wall). The car reaches the first two goals by its estimate; at 22.6 s it runs into the east wall 3.3 m from where the estimate puts it, gets stuck and skips the last two goals. (On L1 with its pillars the same run met the box after 5 s, when the estimate had drifted only 0.6 m.)
Shows: Slip is an odometry error that no calibration removes: the encoders measure exactly what the wheels did, and the wheels did not move the car the way the kinematic model says. A filter that trusts this odometry is biased in every turn.
Predict: Dead reckoning from the steering encoder on the sliding car, noise-free odometry: what will the estimate do?
- Stay exact: the odometry has no noise and no bias
- Report more turning than happened and drift off
- Report less turning than happened
Answer: 1

## Try: Same, with a yaw-rate gyro
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5,"loc":"dr","gyro":true},"plot":"cte","layers":{"slip":true,"trail":true}}
Setup: The same, with the yaw-rate gyro on: the odometry reports the true yaw rate.
See: All 4 goals in 41.2 s. At the end the heading estimate is 1.1° off the truth, but the position has drifted 0.21 m.
Shows: A gyro fixes the heading, which is why every real car has one. The sideways slide of the rear axle, $v_y - l_r r$, is in neither the encoders nor the gyro, so position still needs an outside reference: beacons, lidar against the map, GPS.
Predict: Adding the yaw-rate gyro: what does it fix and what remains?
- Heading and position both stay exact
- Heading fixed; position still drifts from the sideways slide
- Nothing: the gyro measures the same turn as the encoder
Answer: 1

## Code: dynF, the tyre forces
snippet: tyre-model
focus: af = sg * (G.td - (vy + G.lf * yr) / vx), … Fr = clamp(P.Cr * ar, -G.fr, G.fr),
Note: The slip angles of the front and rear tyres, and the lateral forces as stiffness times slip, clamped at the friction limit. The controller slot sees none of this directly; it sees the pose, and the slip as the difference between where it steered and where the car went.

## Think about
Q: Why does the car turn less than its steering says, rather than more?
A: Because this car understeers: $K_{us} > 0$, which needs $l_r/C_f > l_f/C_r$. With the centre of mass slightly forward and softer front tyres, the fronts must slip more than the rears to carry their share of the turn, and the extra front slip is steering that does not turn the car. Swap the stiffnesses ($C_f$ 90, $C_r$ 40) and $K_{us}$ turns negative: the car turns more than geometry says, and above a critical speed its yaw motion is unstable.
Q: The Grippy preset is kinematic to within 3 % below 2 m/s. When would the lab car need the dynamic model with realistic tyres?
A: When $K_{us}v^2$ is no longer small against $L$: with $K_{us} = 0.0046$ rad/(m/s²) the gain falls 10 % at about 3.8 m/s, and the characteristic speed is 11.5 m/s. Small, slow robots on good floors are kinematic; road cars, racing robots and anything on a slippery surface are not.
Q: The tracker steers harder in a turn to make up for the slip. Why does it still lag?
A: Because it only reacts to the error the slip has already caused. A feedforward that knew the car understeers would add $K_{us}a_y$ of steering in advance, as production lane-keeping controllers do; the trackers here feed forward the path curvature through the kinematic $L/R$ and nothing else.

## Check yourself
Q: A car with $m = 1500$ kg, $L = 2.7$ m, $l_f = 1.2$ m, $l_r = 1.5$ m, $C_f = 80\,000$ N/rad, $C_r = 100\,000$ N/rad: what is its characteristic speed $v_{ch} = \sqrt{L/K_{us}}$, in m/s?
Answer: 26.83
Tolerance: 0.5
Unit: m/s
How: $K_{us} = (m/L)(l_r/C_f - l_f/C_r) = 555.6 \times (1.875 \times 10^{-5} - 1.2 \times 10^{-5}) = 0.00375$ rad/(m/s²); $v_{ch} = \sqrt{2.7/0.00375} = \sqrt{720} = 26.8$ m/s.
