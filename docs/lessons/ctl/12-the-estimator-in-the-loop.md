group: ctl
title: The estimator in the loop
extra: true

<p><b>Why this matters.</b> The analysis assumes the controller knows where the robot is. In the simulator, as on a real vehicle, the controller knows only the estimate, and the estimate has its own dynamics. Between beacon readings an EKF integrates odometry, so most of the time it follows the true motion smoothly. At each reading it jumps. The loop sees those jumps as disturbances, and the noise shows up as extra scatter in the measured phase. This lesson connects the control chapters with the localization ones. The estimator is part of the loop, and its errors are disturbances to the loop.</p>
<p><b>The idea.</b> The controller's input is $e_\text{est} = e + (\text{estimation error})$. The model's $L(j\omega)$ describes the path from the true error to the command. The injection experiment measures the whole chain, estimator included, because it drives the actuator and watches what the controller does with the estimate. Near the crossover the estimator is smooth, and the measured points still follow the model. At high frequency it is noisy, and the points scatter. A step test through the estimator shows the extra overshoot that the jumps cause.</p>
$$e_\text{est} = e + (\text{estimation error})$$
<p>The model's $L(j\omega)$ describes $e \to u$. The injection measures the whole chain, estimator included.</p>
<p><b>Where it comes from.</b> In the block diagram, an estimation error added at the controller input is a disturbance entering at the measurement. The loop filters it through the sensitivity function. Estimate errors at low frequency are tracked, and the robot follows them as if they were offsets from the path. Those at high frequency are attenuated by the loop's roll-off. <a class="chref" href="#notes=ch6/7-where-the-model-stops">Where the model stops: chapter 6 §7</a> · <a class="chref" href="#notes=ch2/4-the-kalman-update-derived">what the EKF does between and at readings: chapter 2 §4</a></p>
<p><b>What the lab does.</b> The "experiments use the estimator" checkbox in the Analyze view runs the step test and the injection through the selected localizer instead of the ground truth. The model still assumes a known pose. The buttons set either the EKF with odometry noise ×1 or dead reckoning with noise ×2.</p>

## Try: EKF in the loop, step test
cfg: {"level":0,"set":{"ctl":"pp","loc":"ekf","odoK":1},"useEst":true,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: Pure pursuit on the diff-drive, with the EKF and beacons as the localizer. A 0.2 m step test runs through the estimate.
See: The model predicts 4.3 % overshoot and settling in 4.7 s. The measured true error overshoots by 12.8 % and has not settled within 2 % when the 6.6 s window closes. It ends about 8 % off, where the estimate happens to sit. The response is visibly jerkier than with ground truth.
Shows: The loop does what it should with the information it has. Every beacon update moves the estimate a few centimetres. The controller treats each move as a path error and corrects it, so the true position follows the estimate's jumps. The extra overshoot is the estimator's noise passing through the loop's sensitivity function, so the controller is not at fault. To reduce the overshoot you need a better estimate or a less aggressive loop; a different tracker would not help.
Predict: The step test through the EKF estimate: how will the measured true error compare with the model?
- On the model: the EKF is accurate to centimetres
- Lower overshoot: the estimate smooths the error
- Higher overshoot, jerkier, longer to settle
Answer: 2

## Try: EKF, measure L(jω)
cfg: {"level":0,"set":{"ctl":"pp","loc":"ekf","odoK":1},"useEst":true,"test":"inj"}
Setup: The injection experiment through the EKF.
See: Near the crossover the nine measured points still follow the model, so the straight-line analysis is still useful there. At the upper frequencies they scatter. The response is small there, and the estimate's jumps are a large fraction of it.
Shows: The model of $e \to u$ is right. The measurement includes an extra term that the model does not have, and at high frequency that term dominates. Identification on a real vehicle looks like this. The model holds where the loop has gain, and the scatter above the crossover comes from the sensor, not from the plant.
Predict: The injection through the EKF: where will the measured points scatter?
- At the upper frequencies; near crossover they still fit
- Everywhere equally: the noise is white
- Near crossover, where the loop is most sensitive
Answer: 0

## Try: Dead reckoning in the loop
cfg: {"level":0,"set":{"ctl":"pp","loc":"dr","odoK":2},"useEst":true,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The same step test with dead reckoning on odometry noise ×2 as the localizer.
See: The measured true error overshoots by 21 % and never settles. By the end of the window it is more than 2.5 times the step (2.9 at the last sample), and still drifting. In its own estimated frame, the controller tracks the path perfectly.
Shows: A loop closed on a drifting estimate drives the robot wherever the estimate drifts. Nothing in the controller can detect this, because from the controller's side the error is zero. The loop regulates $e_\text{est}$, and $e_\text{est}$ is only as good as the localizer of chapter 2 makes it. For that reason the localization chapters come first.
Predict: A step test with dead reckoning on noisy odometry: what will the true error do?
- Settle with a larger overshoot, like the EKF
- Overshoot, then drift without settling
- Settle exactly: no beacon jumps to disturb it
Answer: 1

## Code: ekfUpdate, the correction the loop sees
snippet: ekf-update
focus: S.est = {x: e.x + K[0]
example: loc/ekf
Note: This line is where the estimator enters the loop. The controller measures its error from S.est, so every correction made here is a step that the tracker then reacts to. Edit and run loads the EKF example as the localizer, with pure pursuit on. Raise its assumed range noise, and the steps become smaller and slower.

## Think about
Q: Why does the measured overshoot go up with the estimator but the model's margins do not change?
A: The margins describe the loop from the true error to the command, and the estimator does not change that loop. It adds an input, its own error, at the measurement. The loop's response to that input is the sensitivity function, which is large near the crossover. The loop is the same, but it now has an extra disturbance to respond to, so the robot moves more.
Q: Could the controller be tuned to be less sensitive to the estimate's jumps?
A: Yes. A lower crossover filters out more of the high-frequency noise in the estimate, but tracking becomes slower. This is the usual trade-off on a real vehicle, where the bandwidth of the lateral loop is often limited by localization noise more than by delay. The better fix is upstream, in the estimate. It can be made smoother with a filter that spreads each beacon correction over several ticks, or more accurate with a better sensor.
Q: With dead reckoning the true error grows while the estimated error stays zero. Which one should a safety monitor watch?
A: On a real vehicle it can watch neither. The truth is unknown, and the estimated error is zero by construction. A monitor watches the estimator's own consistency instead, through NEES or the statistics of its innovations (the differences between each reading and what the filter expected). It also watches the loop's commands. If the loop holds a steady steering angle on a path it believes is straight, the estimate and the world have drifted apart.

## Check yourself
Q: Pure pursuit tracks a straight path through an estimator whose lateral estimate carries a constant +3 cm bias ($e_\text{est} = e + 3$ cm). Once the loop has settled, how far is the true vehicle from the path, in cm?
Answer: 3
Tolerance: 0.1
Unit: cm
How: A constant (zero-frequency) estimate error is tracked. The loop drives $e_\text{est} = e + 3$ cm to zero, so $e = -3$ cm, which is 3 cm off the path.
