group: loc
title: A gyro in the loop: heading is the expensive error

<p><b>Why this matters.</b> The first lesson ended with a claim: heading error is the expensive kind, because a heading that is 2° off puts the robot 3.5 cm sideways for every metre it drives, and keeps doing so. The cheapest fix on a real robot is not a better wheel encoder but a yaw-rate gyro, a few grams of silicon that measures how fast the body turns, independent of what the wheels do. Every phone has one; every serious mobile robot fuses one. This lesson puts a gyro into the lab's odometry and shows what it buys, what it costs (its own bias), and how the bias is handled in practice.</p>
<p><b>The idea.</b> Wheel odometry gets the turn rate from the difference of the two wheel speeds. That difference is small, so it is noisy, and a wheel slightly larger than the model assumes turns into a turn-rate bias that never averages out. A gyro reads the yaw rate directly: no wheel geometry, no calibration of wheel sizes, noise an order of magnitude smaller. The filter does not change at all. The odometry input <i>u</i> = (<i>v</i>, ω) is the same, only ω now comes from the gyro, and the motion-noise matrix <i>M</i> gets the gyro's σ in place of the wheels'. What the gyro cannot give is speed: the speed bias stays, and so does the along-track error it causes. And a gyro has a bias of its own, which drifts with temperature; left alone it is as bad as the wheels, and the standard answer is to measure it whenever the robot stands still, when the true yaw rate is exactly zero.</p>
<p><b>The math.</b> With the gyro reading ω<sub>g</sub> = ω + <i>b</i> + <i>n</i>, <i>n</i> ~ N(0, σ<sub>g</sub>²), the prediction step is the arc model of lesson 1 with ω<sub>g</sub> in place of the wheels' ω, and the input noise becomes</p>
<div class="eq">M = diag(σ_v², σ_g²)        σ_g = 0.3°/s here, against 0.1|v| + 0.02 rad/s ≈ 5.7°/s from the wheels at 0.8 m/s
σ_θ²(t) = σ_g² Δt · t         the heading variance after t seconds of random noise, a random walk
θ_err(t) = b·t,   e_⊥(t) ≈ v·b·t²/2        a constant bias b: heading drifts linearly, sideways position quadratically
b̂ ← b̂ + α(ω_g − b̂)  while standing still        the zero-velocity update: the mean reading at rest is the bias</div>
<p><b>Where it comes from.</b> The random-walk line is <i>V M V</i>ᵀ of lesson 1 summed over <i>t</i>/Δ<i>t</i> ticks; the bias lines integrate θ̇ = <i>b</i> and ė = <i>v</i>θ once and twice. The zero-velocity update is an exponential average with gain α = 0.1, which settles in the 2 s hold at the start of a run and averages the noise about four times down. <a class="chref" href="#notes=ch2/9-heading-sensors-a-gyro-in-the-motion-model">Derivation: chapter 2 §9</a></p>
<p><b>What the lab does.</b> Vehicle → Yaw-rate gyro switches the turn-rate source for every vehicle (on the car with tyre slip it also reports the true yaw rate instead of the steering encoder's). The gyro has its own noise σ (0.3°/s per 50 ms reading) and a bias slider the filter is not told about; the zero-velocity update, when on, holds the robot still for the first 2 s of a run, averages the gyro into a bias estimate, and subtracts it from then on, and does the same at every later stop. The Localize tab's assumed-noise slider scales the gyro's σ in the filter as it scaled the wheels'. The dead-reckoning experiments run as in lesson 1: L3's odometry on the empty floor, the robot lapping an 8 × 5 m rectangle in the middle, the goals repeating, so nothing gets in the way and the drift is all there is to see; the EKF experiments keep L3's shelves and beacons. All numbers below are at seed 7 over 120 s.</p>

## Try: Dead reckoning, wheels only
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"veh","plot":"eth"}
Setup: L3's noisy, slightly miscalibrated odometry on the empty floor, dead reckoning, laps of the rectangle in the middle, the Vehicle tab and the θ error plot. The reference run of lesson 1.
See: The heading is 10° off by 20 s, 25° by a minute, 54° at 100 s and 42° at two minutes (the random part rides on the steady drift), and the true lap turns about the middle of the floor while the believed one stays a rectangle. The position error rises and falls between 1 and 3 m as the robot goes round, pose RMS 2.16 m.
Shows: What the turn rate from two wheel encoders does over two minutes: a heading error that keeps growing, and a position error that grows with it.
Predict: Put a gyro in place of the wheels' turn rate, no beacons, two minutes. How far off is the heading at the end?
- Still tens of degrees: dead reckoning drifts whatever the sensor
- Within a couple of degrees for the whole run
- It starts right and drifts after a minute, once the gyro warms up
Answer: 1

## Try: Dead reckoning with the gyro
cfg: {"sim":true,"level":2,"set":{"loc":"dr","gyro":true,"map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"veh","plot":"eth"}
Setup: The same run with the yaw-rate gyro on (σ 0.3°/s, no bias). Still no beacons: dead reckoning only.
See: The heading is 0.1° off at a minute and 1.3° at two minutes. The true lap lies on the believed one; the position error stays between 0.25 and 0.5 m, pose RMS 0.35 m against 2.16 m with the wheels.
Shows: Heading was the expensive error. Take it away and dead reckoning alone keeps the robot on its lap. What is left, a few tens of centimetres along the direction of travel, is the 2 % speed bias and the speed noise, which no gyro can see.
Predict: The EKF with beacons that are down 70 % of the time in 6 s outages, wheels against gyro: what changes?
- Nothing visible: the beacons fix the heading whenever they return
- The error during the outages roughly halves with the gyro
- The gyro makes it worse: two noisy turn-rate sources disagree
Answer: 1

## Try: The EKF through long beacon outages, with the gyro
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","gyro":true,"bOut":70,"bOutLen":6},"tab":"veh","plot":"pos"}
Setup: The EKF on L3 with every beacon down 70 % of the time in outages of about 6 s (lesson 2's hardest beacon case), and the gyro on. Switch the gyro off in Vehicle to compare.
See: With the gyro the error stays under 0.12 m and the heading within 1° through the outages, pose RMS 0.08 m; with the wheels the same run reaches 0.14 m with the heading 3 to 5° off at the worst moments, RMS 0.13 m.
Shows: During an outage the filter is dead reckoning, so everything the previous experiment showed applies to the gaps, scaled by their length: a gyro is what lets a filter coast through missing fixes. With beacons every 0.2 s the two are indistinguishable; the sensor earns its place when the fixes stop.
Predict: Now give the gyro a bias of 0.5°/s the filter is not told about, dead reckoning. What does the heading do?
- Drifts at 0.5°/s: 60° off after two minutes
- Stays within a few degrees: 0.5°/s is below the gyro's noise
- Drifts for a while and then stops, once the bias has averaged out
Answer: 0

## Try: A gyro with a bias the filter is not told about
cfg: {"sim":true,"level":2,"set":{"loc":"dr","gyro":true,"gyroBias":0.5,"map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"veh","plot":"eth"}
Setup: Dead reckoning with the gyro, and a gyro bias of 0.5°/s (Vehicle → Gyro bias). The filter still assumes a zero-mean 0.3°/s noise.
See: The heading drifts exactly at the bias: 11° at 20 s, 31° at 60 s, 62° at 120 s, and the true lap turns faster than with the wheels. The position error is 1.4 m by 20 s and 3 m by a minute, against a 2σ band of 1.5 m that never widens, and NEES climbs into the thousands (2400 at two minutes): the filter's σ grows as if the only error were 0.3°/s of noise.
Shows: A bias is not noise. A gyro with a drifting bias is the wheel-calibration problem all over again, only worse, because the filter has been told the turn rate is now precise. On real IMUs this bias moves with temperature, which is why no driver trusts the factory value for long.
Predict: Turn the zero-velocity update on. Besides the 2 s hold at the start, what does the run look like?
- Like the unbiased gyro: heading within a degree or two
- Like the biased gyro: the hold is far too short to learn anything
- The heading is fixed but the position error grows faster than before
Answer: 0

## Try: The bias, with the zero-velocity update
cfg: {"sim":true,"level":2,"set":{"loc":"dr","gyro":true,"gyroBias":0.5,"zupt":true,"map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"veh","plot":"eth"}
Setup: The same biased gyro with the zero-velocity update on: the robot holds still for 2 s, the gyro's mean reading becomes the bias estimate, and it is subtracted from then on. The Vehicle tab's gyro line shows the estimate.
See: The hold learns the bias to within about a tenth of a degree per second (the Vehicle tab reads 0.43°/s after the hold, and between 0.40 and 0.51°/s as later stops refresh it). The heading then stays within about 2° for the whole run, as with the unbiased gyro, and the robot keeps to its lap. The position error is 0.35 to 0.5 m, pose RMS 0.31 m; what remains is the speed bias.
Shows: Two seconds of standing still are worth more than any amount of filtering: at rest the true yaw rate is exactly zero, so the gyro reads its bias and nothing else. Every stop is a chance to recalibrate, which is why IMU drivers do this at every stop. The heading problem is solved; the speed bias is a different sensor's problem.
Predict: Give the biased gyro to the EKF with the beacons on (no zero-velocity update). What does NEES say?
- About 3: the beacons correct the bias as fast as it accumulates
- Hundreds: the pose is fine but the filter is badly overconfident
- NEES falls below 1: the beacons make the filter underconfident
Answer: 1

## Try: The EKF with the biased gyro
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","gyro":true,"gyroBias":0.5},"tab":"loc","plot":"pos"}
Setup: The EKF with its beacons, the gyro on with the 0.5°/s bias and no zero-velocity update. Localize tab and the Position error plot.
See: The pose error stays small, 0.02 to 0.3 m, and all five goals are reached: the beacons keep catching the heading. But NEES sits between 200 and 550 for the whole run and the error is inside the 2σ band only a fifth of the time. The filter claims centimetres while its heading is 4 to 5° off between fixes.
Shows: The same signature as the wheel bias in lesson 2, two orders of magnitude stronger, because the filter was told the turn rate is now ten times more precise. A real stack either estimates the gyro bias as a fourth state, so that the beacons can correct it, or calibrates it at every stop. Inflating the assumed noise would hide the symptom; neither of the two fixes needs the beacons to be frequent.

## Code: odometry, wheels or gyro
snippet: odometry
focus: if (P.gyro) { … } else wo = w
Note: The turn rate comes from one of two lines: the gyro's (its own noise and bias, the bias learnt at rest) or the wheels' (the speed-proportional bias and the larger noise). Both feed the same filter. A localizer in the Code tab sees only obs.odom and cannot tell which; that is the point of the lesson.

## Think about
Q: The gyro's noise, 0.3°/s per 50 ms reading, is about twenty times smaller than the wheels' at 0.8 m/s. Why is the heading drift after a minute not twenty times smaller, but far more?
A: Because the wheels' turn-rate error is not only noise: the calibration bias of 0.01 rad/s per m/s of speed is a steady 0.46°/s that never averages, and over a minute it dominates. The gyro removes the bias as well as most of the noise, so the comparison is a random walk of 0.3°/s readings against a drift of 0.46°/s plus a random walk of 5.7°/s readings.
Q: The zero-velocity update averages the gyro while the robot stands still. What goes wrong if the robot is not actually still, say on a slope, or someone pushes it?
A: The estimate absorbs whatever yaw rate the body really had, and from then on the odometry carries that as a bias. Real drivers gate the update on the accelerometer and the wheel encoders both reporting rest, and on the gyro's variance over the window being small, before trusting a stationary window.
Q: With the biased gyro the EKF reached every goal with a small pose error. Why is that run still a failure?
A: Because nothing downstream can tell it is lucky. The planner's clearance margins, the lost-guard and the replan-on-off-path rule all read the filter's σ, which is ten times too small. On a level where the beacons are sparser the same filter drifts for metres while reporting centimetres, and the first warning is the collision.

## Check yourself
Q: A gyro with a bias of 0.5°/s, no correction. After 60 s of driving straight at 0.8 m/s, how far sideways is the dead-reckoned position off, using e ≈ v·b·t²/2 with b in radians per second?
Answer: 12.57
Tolerance: 0.3
Unit: m
How: b = 0.5°/s = 0.00873 rad/s; e = 0.8 × 0.00873 × 60² / 2 = 0.8 × 0.00873 × 1800 = 12.6 m
