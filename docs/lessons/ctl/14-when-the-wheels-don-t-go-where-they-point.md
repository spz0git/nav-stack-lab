group: ctl
title: When the wheels don't go where they point
extra: true

<p><b>Why this matters.</b> Every model in this lab so far assumes the car goes where its front wheel points, so that its turn rate is $v\tan\delta/L$. At walking pace that is true. A real car corners because its tyres push sideways, and a tyre pushes sideways only by slipping. At speed, then, the wheels do not go where they point. The planners, the trackers and the MPC here are all built on the kinematic model. In this lesson you put a car under them that does not follow it, and see what the mismatch costs.</p>
<p><b>The idea.</b> Tyre slip works as follows. Each tyre moves at a small angle to the direction it points in. This angle is its slip angle, and the tyre pushes sideways in proportion to it. The constant of proportion is the cornering stiffness, one for each axle. In a steady turn the front tyres of most cars slip more than the rears, so the car turns less than the geometry says; it understeers. The shortfall grows with the square of the speed, through the understeer gradient. The rear slides too, so the centre of mass moves at a sideslip angle $\beta$ to the heading. The car's odometry works the turn rate out from the steering angle, so it reads a turn that the car did not make.</p>
$$\alpha_f = \delta - \frac{v_y + l_f r}{v_x} \qquad \alpha_r = -\frac{v_y - l_r r}{v_x} \qquad F_y = C\alpha, \quad |F_y| \le \mu F_z$$
<p>In a steady turn:</p>
$$\frac{r}{\delta} = \frac{v}{L + K_{us} v^2} \qquad K_{us} = \frac{m}{L}\Bigl(\frac{l_r}{C_f} - \frac{l_f}{C_r}\Bigr) \qquad v_{ch} = \sqrt{L/K_{us}}$$
<p>On the slippery floor ($m$ 10 kg, $C_f$ 40, $C_r$ 90 N/rad, $\mu$ 0.25), $K_{us} = 0.0875$ rad/(m/s²) and $v_{ch} = 2.62$ m/s. At 1.5 m/s the car turns at 75 % of $v\tan\delta/L$, and at 2 m/s at 63 %.</p>
<p><b>Where it comes from.</b> Write Newton's law sideways and the moment balance about the centre of mass, with the slip angles above and linear tyres. This gives a linear model in the lateral velocity $v_y$ and the yaw rate $r$. Set its derivatives to zero, and the steady yaw rate per unit of steering is the formula above. With stiff tyres ($C \to \infty$) it becomes the kinematic $v/L$. <a class="chref" href="#notes=ch1/4-the-dynamic-bicycle-model">The dynamic bicycle model: chapter 1 §4</a> · <a class="chref" href="#notes=ch1/5-understeer-the-characteristic-speed-and-stability">understeer and the characteristic speed: §5</a></p>
<p><b>What the lab does.</b> Vehicle → <b>Car (dynamic: tyre slip)</b> runs the dynamic bicycle model under the same longitudinal chain (command, lag, acceleration and steering-rate limits). Its states are $v_y$ and $r$ at the centre of mass. The pose is still at the rear axle, and each tyre's force is clipped at $\mu$ times its load. The <b>Slippery floor</b> preset gives the lab car a characteristic speed of 2.6 m/s, against a passenger car's 27, so the effects show at lab speeds. <b>Grippy</b> is kinematic to within 3 % below 2 m/s. The map's Sideslip layer draws the velocity of the centre of mass against the heading. The odometry reports $v\tan\delta/L$ unless the yaw-rate gyro is on (Sensors tab). These runs raise the curve cap $a_\text{lat}$ to 1.5 m/s², so the car takes its turns at speed. All numbers below are at seed 7, each over one run of the four goals.</p>

## Try: Kinematic car at 1.5 m/s
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"car","vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte","layers":{"slip":true}}
Setup: L1's four goals on the empty floor (Mission → Map → Empty floor). It has only the outer walls, so a car that leaves its path has room to show it. The kinematic car drives at 1.5 m/s with pure pursuit and Hybrid A*, and the curve cap is 1.5 m/s².
See: The car reaches all 4 goals in 40.8 s, with a cross-track error of 4.2 cm RMS (13 cm at most).
Shows: This is the reference run. It uses the car the trackers were designed for, at the same speed as the next run.
Predict: The kinematic car at 1.5 m/s with the curve cap raised to 1.5 m/s²: how will it track?
- Within a few cm RMS, all goals reached
- It loses the path in the turns at this cap
- It slides: 1.5 m/s² is past the grip
Answer: 0

## Try: Slippery floor, same speed
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5},"plot":"cte","panes":[["yawr","yawk"],["beta"]],"layers":{"slip":true}}
Setup: The same run, with the car with tyre slip on the slippery floor. The plots show the yaw rate $r$ against the kinematic $v\tan\delta/L$, and the sideslip $\beta$.
See: The car reaches all 4 goals in 42.0 s, but the cross-track error is 12.1 cm RMS (37 cm at most), three times the kinematic car's. In every turn the yaw rate stays below $v\tan\delta/L$, at 0.76 of it on average. The sideslip $\beta$ reaches 12°, and the arrow on the map points visibly away from the heading. The steering is at its lock 7 % of the time.
Shows: The tracker asks for a curvature through the kinematic model and gets three quarters of it. It lags into every turn and steers harder to catch up. Nothing in its code knows why, because what changed is the plant underneath it.
Predict: The same run on the slippery floor: how will the yaw rate compare with $v\tan\delta/L$ in the turns?
- About equal: the tracker corrects the slip
- Above it: the rear slides and the car over-rotates
- About three quarters of it, and the error triples
Answer: 2

## Try: Dead reckoning on the sliding car
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5,"loc":"dr"},"plot":"cte","panes":[["yawr","yawk"]],"layers":{"slip":true,"trail":true}}
Setup: The slippery run, steered by dead reckoning. The estimate integrates the odometry, which takes the turn rate from the steering encoder as $v\tan\delta/L$. On this level the odometry has no noise and no bias.
See: With the kinematic car this estimate is exact. Here it goes wrong in the first turns. In every turn the odometry reports more turning than the car did (the car turns at 0.77 of $v\tan\delta/L$), and the heading error grows turn by turn. It is 8° by the second goal and 37° when the car hits the wall. The car reaches the first two goals by its estimate. At 22.6 s it runs into the east wall 3.3 m from where the estimate puts it, gets stuck, and skips the last two goals. (On L1, with its pillars, the same run met the box after 5 s, when the estimate had drifted only 0.6 m.)
Shows: Slip causes an odometry error that calibration cannot remove. The encoders measure correctly what the wheels did, but the wheels did not move the car the way the kinematic model says. A filter that trusts this odometry is biased in every turn.
Predict: Dead reckoning from the steering encoder on the sliding car, noise-free odometry: what will the estimate do?
- Stay exact: the odometry has no noise and no bias
- Report more turning than happened and drift off
- Report less turning than happened
Answer: 1

## Try: Same, with a yaw-rate gyro
cfg: {"sim":true,"level":0,"set":{"map":"empty","veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"vmax":2,"vcruise":1.5,"alat":1.5,"loc":"dr","gyro":true},"plot":"cte","layers":{"slip":true,"trail":true}}
Setup: The same run, with the yaw-rate gyro on, so the odometry reports the true yaw rate.
See: The car reaches all 4 goals in 41.2 s. At the end the heading estimate is 1.1° off the truth, but the position has drifted 0.21 m.
Shows: A gyro fixes the heading, and every real car has one for this reason. The sideways slide of the rear axle, $v_y - l_r r$, shows in neither the encoders nor the gyro. The position therefore still needs an outside reference, such as beacons, lidar matched against the map, or GPS.
Predict: Adding the yaw-rate gyro: what does it fix and what remains?
- Heading and position both stay exact
- Heading fixed; position still drifts from the sideways slide
- Nothing: the gyro measures the same turn as the encoder
Answer: 1

## Code: dynF, the tyre forces
snippet: tyre-model
focus: af = sg * (G.td - (vy + G.lf * yr) / vx), … Fr = clamp(P.Cr * ar, -G.fr, G.fr),
Note: These lines compute the slip angles of the front and rear tyres, then the lateral forces as stiffness times slip, clamped at the friction limit. The controller slot sees none of this directly. It sees the pose, and it sees the slip only as the difference between where it steered and where the car went.

## Think about
Q: Why does the car turn less than its steering says, rather than more?
A: Because this car understeers, with $K_{us} > 0$, which needs $l_r/C_f > l_f/C_r$. Its centre of mass is slightly forward and its front tyres are softer. The fronts must therefore slip more than the rears to carry their share of the turn, and the extra front slip is steering that does not turn the car. Swap the stiffnesses ($C_f$ 90, $C_r$ 40) and $K_{us}$ becomes negative. The car then turns more than the geometry says, and above a critical speed its yaw motion is unstable.
Q: The Grippy preset is kinematic to within 3 % below 2 m/s. When would the lab car need the dynamic model with realistic tyres?
A: When $K_{us}v^2$ is no longer small against $L$. With $K_{us} = 0.0046$ rad/(m/s²) the gain falls by 10 % at about 3.8 m/s, and the characteristic speed is 11.5 m/s. The kinematic model serves small, slow robots on good floors. Road cars, racing robots and anything on a slippery surface need the dynamic one.
Q: The tracker steers harder in a turn to make up for the slip. Why does it still lag?
A: It only reacts to the error that the slip has already caused. A feedforward that knew the car understeers would add $K_{us}a_y$ of steering in advance, as production lane-keeping controllers do. The trackers here feed forward only the path curvature, through the kinematic $L/R$.

## Check yourself
Q: A car with $m = 1500$ kg, $L = 2.7$ m, $l_f = 1.2$ m, $l_r = 1.5$ m, $C_f = 80\,000$ N/rad, $C_r = 100\,000$ N/rad: what is its characteristic speed $v_{ch} = \sqrt{L/K_{us}}$, in m/s?
Answer: 26.83
Tolerance: 0.5
Unit: m/s
How: $K_{us} = (m/L)(l_r/C_f - l_f/C_r) = 555.6 \times (1.875 \times 10^{-5} - 1.2 \times 10^{-5}) = 0.00375$ rad/(m/s²), so $v_{ch} = \sqrt{2.7/0.00375} = \sqrt{720} = 26.8$ m/s.
