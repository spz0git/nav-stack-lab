group: intro
title: A fix from outside: beacons and the Kalman filter
level: 1

<p><b>Why this matters.</b> The last lesson showed that a robot counting its wheel turns gets lost slowly but surely. Every practical robot therefore also measures something outside itself: a satellite signal, a known landmark, the shape of a wall. The question is how to combine the two. Wheels give a smooth position that drifts, landmarks give a position that does not drift but arrives only now and then and is noisy. The Kalman filter is the standard answer, and almost every robot and vehicle runs one.</p>
<p><b>The idea.</b> The filter keeps two things: its best guess of the position, and how uncertain that guess is. Between landmark readings it moves the guess with the odometry, exactly as dead reckoning does, and the uncertainty grows. When a beacon reading arrives, the filter predicts what the reading should have been from its guess, and compares. The difference pulls the guess towards the reading. How hard it pulls depends on who is more uncertain: if the guess is shaky and the beacon is precise, the reading wins; if the guess is good and the beacon noisy, the guess barely moves. After the reading the uncertainty shrinks again. The version for robots, which handles the curved geometry of range and bearing, is the extended Kalman filter, or EKF.</p>
<p><b>What the lab does.</b> The same empty floor and laps as the last lesson, with the same noisy, biased odometry. Twelve beacons stand on the floor, drawn as teal diamonds. Each one within reach (7 m by default) reports its distance and direction from the robot five times a second, with a little noise. The beam layer draws a line to every beacon the robot is measuring. Localization is switched to the EKF. Watch the Position error plot again, and compare it with the dead-reckoning run of the last lesson.</p>
<p><b>Where it comes from.</b> In one dimension the update is a weighted average of the prediction $x_\text{pred}$ and what the reading says, $z$:</p>
$$\hat x = x_\text{pred} + K\,(z - x_\text{pred}), \qquad K = \frac{\sigma_\text{pred}^2}{\sigma_\text{pred}^2 + \sigma_z^2}$$
<p>The gain $K$ is between 0 and 1. A very uncertain prediction gives $K$ near 1 (trust the reading); a very noisy reading gives $K$ near 0 (trust the prediction). The robot's filter does the same with matrices, for position and heading together. Go deeper: <a class="lsref" href="#lesson=loc:2">The Kalman update, and NEES as a lie detector</a> · <a class="chref" href="#notes=ch2/4-the-kalman-update-derived">the update derived: chapter 2 §4</a></p>

## Try: EKF with beacons
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"pos"}
Setup: The laps of the last lesson, with the same odometry noise and bias, and the EKF using the beacons.
See: The two trails lie on top of each other. The Position error curve stays near the bottom of the plot: over the first two minutes its largest value is 0.10 m, and its RMS is 0.03 m. Dead reckoning on the same laps reached 5.5 m. Lines from the robot to the nearby beacons flicker on and off as it drives.
Shows: The odometry is just as bad as before, but every fifth of a second a beacon reading pulls the estimate back. The error can only grow for a moment before the next correction, so it stays bounded instead of drifting. On seeds 1 to 4 the largest error in two minutes is 0.07 to 0.12 m.
Predict: The odometry is as noisy and biased as before. Over two minutes with beacons, what does the Position error curve do?
- It grows like dead reckoning, only more slowly
- It stays near zero, at most about ten centimetres
- It jumps by metres each time a beacon is seen
Answer: 1

## Try: Beacon reach 3 m
cfg: {"sim":true,"level":2,"set":{"loc":"ekf","map":"empty","misLoop":true,"lmRange":3},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"pos"}
Setup: The same, with the beacon sensor's reach cut from 7 m to 3 m (Sensors tab, Beacons; the Sensors tab is in Advanced). On parts of the lap no beacon is in reach.
See: The error now rises in stretches and falls back when a beacon comes into reach. Over two minutes it peaks at 1.1 m, with an RMS of 0.26 m. On seeds 1 to 4 the peak is 0.4 to 1.1 m: worse than with 7 m of reach, but far from the metres of dead reckoning.
Shows: Between readings the filter is dead reckoning, and it drifts like dead reckoning. The reading is what stops the drift. How far the robot drifts depends on how long it goes without one, which is why a real robot's designers count landmarks along its route.
Predict: With a 3 m reach, what does the error do?
- It grows without bound, as with no beacons at all
- It rises while no beacon is in reach and falls when one is seen again
- It stays as small as with a 7 m reach
Answer: 1

## Think about
Q: Why not use only the beacons and ignore the wheels?
A: A beacon reading arrives five times a second and is noisy, and on parts of the floor there may be none. The odometry arrives every tick and is smooth over short distances. The filter uses each where it is good: the wheels for the short term, the beacons to stop the long-term drift.

## Check yourself
Q: In the first experiment, what is the largest position error on the plot in the first two minutes, in centimetres?
Answer: 10
Tolerance: 3
Unit: cm
How: The curve stays under about 0.10 m = 10 cm. With dead reckoning on the same laps it reached 5.5 m, more than fifty times as much.
