group: ctl
title: The estimator in the loop
extra: true

<p><b>Why this matters.</b> The analysis assumes the controller knows where the robot is. In the simulator, as on a real vehicle, it knows only the estimate, and the estimate has its own dynamics: an EKF between beacon readings integrates odometry, so most of the time it follows the true motion smoothly, and at each reading it jumps. The loop sees those jumps as disturbances and the noise as extra phase scatter. This lesson closes the gap between the control chapters and the localization ones: the estimator is part of the loop, and its errors are the loop's disturbances.</p>
<p><b>The idea.</b> The controller's input is <i>e</i><sub>est</sub> = <i>e</i> + (estimation error). The model's <i>L</i>(jω) describes the path from the true error to the command; the injection experiment measures the whole chain, estimator included, because it drives the actuator and watches what the controller does with the estimate. Where the estimator is smooth, near the crossover, the measured points still follow the model; where it is noisy, at high frequency, they scatter. A step test through the estimator shows the extra overshoot the jumps cause.</p>
<div class="eq">controller input:  e_est = e + (estimation error)
the model's L(jω) describes e → u; the injection measures the whole chain, estimator included</div>
<p><b>Where it comes from.</b> An additive estimation error at the controller input is, in the block diagram, a disturbance entering at the measurement, which the loop filters through the sensitivity function: low-frequency estimate errors are tracked (the robot follows them as if they were path offsets), high-frequency ones are attenuated by the loop's roll-off. <a class="chref" href="#notes=ch6/7-where-the-model-stops">Where the model stops: chapter 6 §7</a> · <a class="chref" href="#notes=ch2/4-the-kalman-update-derived">what the EKF does between and at readings: chapter 2 §4</a></p>
<p><b>What the lab does.</b> The "experiments use the estimator" checkbox in the Analyze view makes the step test and the injection run through the selected localizer instead of ground truth; the model still assumes a known pose. The buttons set the EKF with odometry noise ×1, or dead reckoning with noise ×2.</p>

## Try: EKF in the loop, step test
cfg: {"level":0,"set":{"ctl":"pp","loc":"ekf","odoK":1},"useEst":true,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: Pure pursuit on the diff-drive, the EKF with beacons as the localizer, a 0.2 m step test run through the estimate.
See: The model predicts 4.3 % overshoot and settling in 4.7 s; the measured true error overshoots 12.8 % and takes 6.6 s to settle within 2 %, ending about 9 % off, where the estimate happens to sit when the window closes. The response is visibly jerkier than the ground-truth version.
Shows: The loop is doing exactly what it should with the information it has. Every beacon update moves the estimate a few centimetres, the controller treats each move as a path error and corrects it, and the true position follows the estimate's jumps. The extra overshoot is not a controller problem; it is the estimator's noise passing through the loop's sensitivity function, and the cure is a better estimate or a less aggressive loop, not a different tracker.
Predict: The step test through the EKF estimate: how will the measured true error compare with the model?
- On the model: the EKF is accurate to centimetres
- Lower overshoot: the estimate smooths the error
- Higher overshoot, jerkier, longer to settle
Answer: 2

## Try: EKF, measure L(jω)
cfg: {"level":0,"set":{"ctl":"pp","loc":"ekf","odoK":1},"useEst":true,"test":"inj"}
Setup: The injection experiment through the EKF.
See: The nine measured points still follow the model near the crossover, which is why the straight-line analysis is still useful, and scatter at the upper frequencies, where the response is small and the estimate's jumps are a large fraction of it.
Shows: The model of e → u is right; the measurement includes an extra term the model does not have, and at high frequency that term wins. This is what identification on a real vehicle looks like: the model holds where the loop has gain, and the scatter above crossover is the sensor, not the plant.
Predict: The injection through the EKF: where will the measured points scatter?
- At the upper frequencies; near crossover they still fit
- Everywhere equally: the noise is white
- Near crossover, where the loop is most sensitive
Answer: 0

## Try: Dead reckoning in the loop
cfg: {"level":0,"set":{"ctl":"pp","loc":"dr","odoK":2},"useEst":true,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The same step test with dead reckoning on odometry noise ×2 as the localizer.
See: The measured true error overshoots 21 % and never settles: by the end of the window it is 2.5 times the step and still drifting. The controller is tracking the path perfectly in its own estimated frame.
Shows: A loop closed on a drifting estimate drives the robot wherever the estimate drifts, with full confidence. Nothing in the controller can detect it, because from the controller's side the error is zero. This is the formal reason the localization chapters come first: the loop regulates e_est, and e_est is only as good as chapter 2 makes it.
Predict: A step test with dead reckoning on noisy odometry: what will the true error do?
- Settle with a larger overshoot, like the EKF
- Overshoot, then drift without settling
- Settle exactly: no beacon jumps to disturb it
Answer: 1

## Code: ekfUpdate, the correction the loop sees
snippet: ekf-update
focus: S.est = {x: e.x + K[0]
example: loc/ekf
Note: This line is where the estimator enters the loop: the controller's error is measured from S.est, and every correction here is a step the tracker then reacts to. Edit and run: the EKF example as the localizer with pure pursuit on; raise its assumed range noise and the steps grow smaller and slower.

## Think about
Q: Why does the measured overshoot go up with the estimator but the model's margins do not change?
A: The margins describe the loop from true error to command, which the estimator does not alter. The estimator adds an input, its error, at the measurement; the loop's response to that input is the sensitivity function, which is large near the crossover. Same loop, extra disturbance, more motion.
Q: Could the controller be tuned to be less sensitive to the estimate's jumps?
A: A lower crossover filters more of the high-frequency estimate noise, at the price of slower tracking; that is the usual trade on a real vehicle, where the lateral loop bandwidth is often limited by localization noise rather than by delay. The better fix is upstream: smoother estimates (a filter that spreads a beacon correction over several ticks) or a better sensor.
Q: With dead reckoning the true error grows while the estimated error stays zero. Which one should a safety monitor watch?
A: Neither is available on a real vehicle, which is the problem: the truth is unknown and the estimated error is zero by construction. A monitor watches the estimator's own consistency, NEES or innovation statistics, and the loop's commands; a loop that holds a steady steering angle on a path it believes is straight is a sign that the estimate and the world have parted.

## Check yourself
Q: Pure pursuit tracks a straight path through an estimator whose lateral estimate carries a constant +3 cm bias (e_est = e + 3 cm). Once the loop has settled, how far is the true vehicle from the path, in cm?
Answer: 3
Tolerance: 0.1
Unit: cm
How: A constant (zero-frequency) estimate error is tracked: the loop drives e_est = e + 3 cm to zero, so e = −3 cm, 3 cm off the path.
