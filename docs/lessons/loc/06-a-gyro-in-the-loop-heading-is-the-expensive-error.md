group: loc
title: A gyro in the loop: heading is the expensive error

<p><b>Why this matters.</b> The first lesson claimed that heading error costs the most. A heading that is 2° off puts the robot 3.5 cm sideways for every metre it drives, and it keeps doing so. On a real robot the cheapest fix is a yaw-rate gyro, which helps far more than a better wheel encoder would. It is a few grams of silicon that measures how fast the body turns, whatever the wheels do. Every phone has one, and almost every mobile robot in service fuses one. This lesson puts a gyro into the lab's odometry. It shows what the gyro gains you, the bias it brings with it, and how that bias is handled in practice.</p>
<p><b>The idea.</b> Wheel odometry gets the turn rate from the difference of the two wheel speeds. That difference is small, so it is noisy. A wheel slightly larger than the model assumes gives a turn-rate bias that never averages out. A gyro reads the yaw rate directly. It needs no wheel geometry and no calibration of wheel sizes, and its noise is an order of magnitude smaller. The filter does not change at all. The odometry input $u = (v, \omega)$ is the same, except that $\omega$ now comes from the gyro, and the motion-noise matrix $M$ gets the gyro's $\sigma$ in place of the wheels'. The gyro does not measure speed, so the speed bias stays, and so does the along-track error it causes. A gyro also has a bias of its own, which drifts with temperature. Left alone, it is as bad as the wheels. The standard answer is to measure the bias whenever the robot stands still, because the true yaw rate is then zero.</p>
<p><b>The math.</b> With the gyro reading $\omega_g = \omega + b + n$, $n \sim \mathcal{N}(0, \sigma_g^2)$, the prediction step is the arc model of lesson 1 with $\omega_g$ in place of the wheels' $\omega$, and the input noise becomes</p>
$$M = \begin{bmatrix} \sigma_v^2 & 0 \\ 0 & \sigma_g^2 \end{bmatrix}$$
<p>with $\sigma_g = 0.3$°/s here, against $0.1\,|v| + 0.02$ rad/s ≈ 5.7°/s from the wheels at 0.8 m/s. The heading variance after $t$ seconds of random noise grows as a random walk:</p>
$$\sigma_\theta^2(t) = \sigma_g^2\,\Delta t \cdot t$$
<p>A constant bias $b$ makes the heading drift linearly and the sideways position quadratically:</p>
$$\theta_\text{err}(t) = b\,t \qquad e_\perp(t) \approx \frac{v\,b\,t^2}{2}$$
<p>The zero-velocity update uses the fact that the mean reading at rest is the bias. While the robot stands still,</p>
$$\hat b \leftarrow \hat b + \alpha\,(\omega_g - \hat b)$$
<p><b>Where it comes from.</b> The random-walk line is $VMV^\top$ of lesson 1, summed over $t/\Delta t$ ticks. The bias lines integrate $\dot\theta = b$ and $\dot e = v\theta$, once and twice. The zero-velocity update is an exponential average with gain $\alpha = 0.1$. It settles within the 2 s hold at the start of a run, and it brings the noise in the estimate down by a factor of about four. <a class="chref" href="#notes=ch2/9-heading-sensors-a-gyro-in-the-motion-model">Derivation: chapter 2 §9</a></p>
<p><b>What the lab does.</b> Sensors → Yaw-rate gyro switches the turn-rate source for every vehicle. (On the car with tyre slip it also reports the true yaw rate instead of the steering encoder's.) The gyro has its own noise $\sigma_g$ (0.3°/s per 50 ms reading), and a bias slider that the filter is not told about. When the zero-velocity update is on, it holds the robot still for the first 2 s of a run. It averages the gyro into a bias estimate and subtracts that from then on, and it does the same at every later stop. The Localize tab's assumed-noise slider scales the gyro's $\sigma$ in the filter, as it scaled the wheels'. The dead-reckoning experiments run as in lesson 1, with L3's odometry on the empty floor. The robot laps an 8 × 5 m rectangle in the middle, and the goals repeat. Nothing gets in the way, so you see the drift alone. The EKF experiments keep L3's shelves and beacons. All numbers below are at seed 7 over 120 s.</p>

## Try: Dead reckoning, wheels only
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"eth"}
Setup: Dead reckoning on L3's noisy, slightly miscalibrated odometry, lapping the rectangle in the middle of the empty floor. The Sensors tab and the θ error plot are open. This is the reference run of lesson 1.
See: The heading is 10° off by 20 s, 25° by a minute, 54° at 100 s and 42° at two minutes (a random part adds to the steady drift). The true lap turns about the middle of the floor, while the believed one stays a rectangle. As the robot goes round, the position error rises and falls between a few tenths of a metre and 5 m (4.9 m at 90 s). The pose RMS is 2.16 m.
Shows: This is what a turn rate taken from two wheel encoders does over two minutes. The heading error keeps growing, and the position error grows with it.
Predict: Wheels only, no beacons, two minutes of laps. How far off is the heading at the end?
- Within a degree or two: each lap undoes the last
- Ten degrees or more: the turn-rate bias keeps adding up
- About 180°: the robot has turned round
Answer: 1

## Try: Dead reckoning with the gyro
cfg: {"sim":true,"level":2,"set":{"loc":"dr","gyro":true,"map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"eth"}
Setup: The same run with the yaw-rate gyro on ($\sigma_g = 0.3$°/s, no bias). Still no beacons: dead reckoning only.
See: The heading is 0.1° off at a minute and 1.3° at two minutes. The true lap lies on the believed one. The position error stays under about half a metre (mostly 0.25 to 0.5 m), and the pose RMS is 0.35 m against 2.16 m with the wheels.
Shows: Most of the wheels' error was in the heading. With that gone, dead reckoning alone keeps the robot on its lap. The few tens of centimetres that are left lie along the direction of travel. They come from the 2 % speed bias and the speed noise, which no gyro can see.
Predict: Put a gyro in place of the wheels' turn rate, no beacons, two minutes. How far off is the heading at the end?
- Still tens of degrees: dead reckoning drifts whatever the sensor
- Within a couple of degrees for the whole run
- It starts right and drifts after a minute, once the gyro warms up
Answer: 1

## Try: The EKF through long beacon outages, with the gyro
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","gyro":true,"bOut":70,"bOutLen":6},"tab":"sen","plot":"pos"}
Setup: The EKF on L3 with every beacon down 70 % of the time, in outages of about 6 s, and the gyro on. This is the "EKF, long outages" case in L3's own Try list, the hardest beacon case there. Switch the gyro off in Sensors to compare.
See: With the gyro, the error stays mostly under 0.16 m (0.26 m at worst) and the heading within 1° through the outages, with a pose RMS of 0.08 m. With the wheels, the same run's error stays mostly under 0.3 m (0.46 m at worst), with the heading up to 5° off (12° at the worst moment) and an RMS of 0.13 m.
Shows: During an outage the filter is dead reckoning. So everything the previous experiment showed applies to the gaps, scaled by their length, and the gyro lets the filter coast through the missing fixes. With beacons every 0.2 s you could not tell the two runs apart. The gyro makes its difference when the fixes stop. How much it saves depends on where the gaps fall. On seeds 1 to 5 the error with the gyro is a seventh to a half of the error with the wheels (RMS while driving), never more.
Predict: The EKF with beacons that are down 70 % of the time in 6 s outages, wheels against gyro: what changes?
- Nothing visible: the beacons fix the heading whenever they return
- The error during the outages is about half or less with the gyro
- The gyro makes it worse: two noisy turn-rate sources disagree
Answer: 1

## Try: A gyro with a bias the filter is not told about
cfg: {"sim":true,"level":2,"set":{"loc":"dr","gyro":true,"gyroBias":0.5,"map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"eth"}
Setup: Dead reckoning with the gyro, and a gyro bias of 0.5°/s (Sensors → Gyro bias). The filter still assumes a zero-mean 0.3°/s noise.
See: The heading drifts at the rate of the bias: 11° at 20 s, 31° at 60 s and 62° at 120 s. The true lap turns faster than with the wheels. The position error is 1.4 m by 20 s and 3 m by a minute. The 2σ band stays near 1.5 m and never widens, and NEES climbs into the thousands (2400 at two minutes). The filter's $\sigma$ grows as if the only error were 0.3°/s of noise.
Shows: A gyro with a drifting bias brings back the wheel-calibration problem, and makes it worse, because the filter has been told that the turn rate is now precise. On real IMUs (the inertial units that hold the gyro) this bias moves with temperature, so their drivers do not trust the factory value for long.
Predict: Now give the gyro a bias of 0.5°/s the filter is not told about, dead reckoning. What does the heading do?
- Drifts at 0.5°/s: 60° off after two minutes
- Stays within a few degrees: 0.5°/s is below the gyro's noise
- Drifts for a while and then stops, once the bias has averaged out
Answer: 0

## Try: The bias, with the zero-velocity update
cfg: {"sim":true,"level":2,"set":{"loc":"dr","gyro":true,"gyroBias":0.5,"zupt":true,"map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"eth"}
Setup: The same biased gyro with the zero-velocity update on. The robot holds still for 2 s, and the gyro's mean reading becomes the bias estimate, which is subtracted from then on. The Sensors tab's gyro line shows the estimate.
See: The hold learns the bias to within about a tenth of a degree per second (the Sensors tab reads 0.43°/s after the hold, and between 0.40 and 0.54°/s as later stops refresh it). The heading then stays within about 2° for the whole run, as with the unbiased gyro, and the robot keeps to its lap. The position error is 0.15 to 0.5 m, with a pose RMS of 0.31 m, and what remains of it comes from the speed bias.
Shows: At rest the true yaw rate is zero, so the gyro reads its bias plus its noise and nothing else. Two seconds of standing still therefore do more for the heading than any tuning of the filter could. Every stop is a chance to recalibrate, and IMU drivers recalibrate at every stop for this reason. The heading problem is mostly solved, and the speed bias needs a different sensor. Two seconds of noisy readings leave an error of a few hundredths of a degree per second in the estimate, and that error drifts like any bias. On seeds 1 to 5 the heading ends 1° to 9° off after two minutes, against 60° without the update.
Predict: Turn the zero-velocity update on. Besides the 2 s hold at the start, what does the run look like?
- Most of the drift is gone: single degrees after two minutes instead of 60°
- Like the biased gyro: the hold is far too short to learn anything
- The heading is fixed but the position error grows faster than before
Answer: 0

## Try: The EKF with the biased gyro
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","gyro":true,"gyroBias":0.5},"tab":"loc","plot":"pos"}
Setup: The EKF with its beacons, and the gyro on with the 0.5°/s bias and no zero-velocity update. The Localize tab and the Position error plot are open.
See: The pose error stays small, 0.02 to 0.4 m (0.57 m at worst), and all five goals are reached, because the beacons keep correcting the heading. But NEES sits between 200 and 570 for the whole run, and the error is inside the 2σ band only a fifth of the time. The filter claims centimetres while its heading is 2 to 6° off between fixes.
Shows: This looks like the wheel bias in lesson 2, but two orders of magnitude stronger, because the filter was told that the turn rate is now twenty times more precise. A real stack either estimates the gyro bias as a fourth state, so that the beacons can correct it, or calibrates it at every stop. Inflating the assumed noise would only hide the symptom. Neither of the two fixes needs the beacons to be frequent.
Predict: Give the biased gyro to the EKF with the beacons on (no zero-velocity update). What does NEES say?
- About 3: the beacons correct the bias as fast as it accumulates
- Hundreds: the pose is fine but the filter is badly overconfident
- NEES falls below 1: the beacons make the filter underconfident
Answer: 1

## Code: odometry, wheels or gyro
snippet: odometry
focus: if (P.gyro) { … } else wo = w
Note: The turn rate comes from one of two lines. The gyro's line has its own noise and bias, with the bias learnt at rest. The wheels' line has the speed-proportional bias and the larger noise. Both feed the same filter. A localizer in the Code tab sees only obs.odom and cannot tell which line the turn rate came from, so the filter needs no change for the gyro.

## Think about
Q: The gyro's noise, 0.3°/s per 50 ms reading, is about twenty times smaller than the wheels' at 0.8 m/s. Why is the heading drift after a minute not twenty times smaller, but far more?
A: The wheels' turn-rate error is not only noise. The calibration bias of 0.01 rad/s per m/s of speed is a steady 0.46°/s that never averages out, and over a minute it dominates. The gyro removes the bias as well as most of the noise. So you are comparing a random walk of 0.3°/s readings with a drift of 0.46°/s plus a random walk of 5.7°/s readings.
Q: The zero-velocity update averages the gyro while the robot stands still. What goes wrong if the robot is not actually still, say on a slope, or someone pushes it?
A: The estimate takes in whatever yaw rate the body really had, and from then on the odometry carries that as a bias. Before they trust a window as stationary, real drivers check that the accelerometer and the wheel encoders both report rest, and that the gyro's variance over the window is small.
Q: With the biased gyro the EKF reached every goal with a small pose error. Why is that run still a failure?
A: Nothing downstream can tell that the run was lucky. The planner's clearance margins, the lost guard and the replan-on-off-path rule all read the filter's $\sigma$, which is ten times too small. On a level with sparser beacons, the same filter drifts for metres while reporting centimetres, and the first warning is the collision.

## Check yourself
Q: A gyro with a bias of 0.5°/s, no correction. After 60 s of driving straight at 0.8 m/s, how far sideways is the dead-reckoned position off, using $e \approx v\,b\,t^2/2$ with $b$ in radians per second?
Answer: 12.57
Tolerance: 0.3
Unit: m
How: $b = 0.5$°/s $= 0.00873$ rad/s, so $e = 0.8 \times 0.00873 \times 60^2 / 2 = 0.8 \times 0.00873 \times 1800 = 12.6$ m
