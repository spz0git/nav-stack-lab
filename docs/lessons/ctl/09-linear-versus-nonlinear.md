group: ctl
title: Linear versus nonlinear

<p><b>Why this matters.</b> Everything in the Analyze view is linear: gains read at one operating point, responses that scale with the input. The vehicle is not. Steering locks, steering-rate limits, turn-rate and acceleration limits all exist, and a large enough error asks for more than the actuator can give. Knowing where the linear picture stops being true is as important as the picture itself, because the failures that matter on a real vehicle, a swerve that saturates the steering, a limit cycle after a big disturbance, live exactly there.</p>
<p><b>The idea.</b> For small signals the response is proportional to the input, so a 0.05 m step and a 1 m step have the same shape and the Bode plot describes both. A large step asks the controller for a large command, the actuator clips it, and the response stops scaling: it is slower and less overshooting than the linear model predicts, because the clipped actuator is effectively a smaller gain. The same happens in the frequency domain: a large injected sine saturates the rate limit at high frequency, and the measured points bend away from the model curve where the saturation bites.</p>
<div class="eq">saturation:  u = clamp(u_cmd, −u_max, u_max)        rate limit:  |u_k − u_{k−1}| ≤ r_max·Δt
car: |δ| ≤ 32°, |δ̇| ≤ 1.5 rad/s;   diff-drive: |ω| ≤ 1.8 rad/s, |ω̇| ≤ 3 rad/s² with acceleration limits on   (defaults)
describing function of saturation, for a sine of amplitude A > u_max:
   N(A) = (2/π)·[asin(u_max/A) + (u_max/A)·√(1 − (u_max/A)²)]      (N = 1 for A ≤ u_max)</div>
<p><b>Where it comes from.</b> Saturation is a static nonlinearity; its describing function is a gain that falls with amplitude, from 1 for small signals toward zero for large ones. A loop with a saturating actuator behaves, for sinusoidal inputs, like the linear loop with that reduced gain, which is why large-amplitude measurements fall below the model and why the step response slows. <a class="chref" href="#notes=ch6/7-where-the-model-stops">Where the model stops: chapter 6 §7</a> · <a class="chref" href="#notes=ch1/6-the-limits-and-where-the-kinematic-model-stops">the vehicle's limits: chapter 1 §6</a></p>
<p><b>What the lab does.</b> The car's steering moves at most 1.5 rad/s and locks at 32° (Vehicle tab); the diff-drive's turn rate and acceleration are limited too. The step test accepts amplitudes from 0.05 to 1 m and the injection has a small and a large setting; the message under the experiments reports when a limit was active and for how long.</p>

## Try: Car, 0.05 m step test
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"offset","stepAmp":0.05,"test":"step"}
Setup: The car with rear-wheel feedback and a 5 cm path offset.
See: Measured overshoot 9.0 % against 9.0 % predicted, rise 1.25 s, settled in 4.05 s; the dashed measurement lies on the solid prediction. No limit reported.
Shows: Small signal: the linear model is exact to the width of the line. This is the regime every chip in the Analyze view describes.
Predict: A 5 cm step on the car: how will the measurement compare with the prediction?
- On it, to the width of the line, no limit active
- Slower, with the steering-rate limit active
- Faster: small steps are easier than the model says
Answer: 0

## Try: Car, 1.0 m step test
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"offset","stepAmp":1,"test":"step"}
Setup: The same loop with a 1 m offset, twenty times larger.
See: The measured response is slower, rise 2.0 s instead of 1.25, and overshoots less, 5.3 % instead of 9 %; the plot is normalized per metre, so the shapes can be compared directly, and they differ. The message reports the steering-rate limit active during the first part of the response.
Shows: The controller asked for a steering angle it could not get fast enough; the steering ramped at 1.5 rad/s while the error waited, and by the time it caught up the error was smaller than the linear loop would have had it, so the overshoot is smaller. A saturated loop is slower and, up to a point, better damped. The danger is the other direction: a saturated loop with delay rings, and that is the limit cycle of the delay-margin lesson.
Predict: Twenty times the step, 1 m: how will the normalized response differ?
- Same shape: the response scales with the input
- Faster rise and more overshoot, rate limit active
- Slower rise and less overshoot, rate limit active
Answer: 2

## Try: Car, large-sine L(jω)
cfg: {"level":5,"set":{"ctl":"rwf"},"injAmp":"large","test":"inj"}
Setup: The injection experiment with a large sine amplitude.
See: At low frequency the measured points still sit on the model. From a few rad/s up they fall below the magnitude curve and the phase scatters, and the message reports the steering-rate limit active at those frequencies.
Shows: The rate limit is a slew limit: a sine of amplitude A at frequency ω needs a rate Aω, so the same amplitude saturates at high frequency and not at low. The measured magnitude is the describing-function gain, falling where Aω exceeds 1.5 rad/s. On a real vehicle this is how you find the amplitude beyond which the Bode plot stops applying.
Predict: Injecting a large sine: where will the measured points leave the model curves?
- At low frequency, where the excursion is largest
- At high frequency, where the rate limit bites
- Nowhere: the injection amplitude does not matter
Answer: 1

## Think about
Q: Why does saturation reduce overshoot here but cause limit cycles elsewhere?
A: Saturation lowers the effective gain. In a loop with plenty of phase margin a lower gain is more damped, hence less overshoot. In a loop past its delay margin the lower gain brings the loop back toward the stability boundary rather than through it, so the oscillation neither grows nor dies: a limit cycle. Same mechanism, different starting margin.
Q: The 1 m response is normalized per metre and looks "better". Is a saturated loop safer?
A: No. It is slower, which on a curve means a larger excursion before the correction catches up, and the saturation means the controller has no authority left for anything else that happens during the ramp. A planner that leaves the tracker steering margin (the Hybrid A* 85 % rule) exists so that the tracker stays in the linear regime.
Q: What does a describing function assume, and when does it fail?
A: That the loop filters out the harmonics the nonlinearity generates, so only the fundamental matters. It fails when the loop passes harmonics, which is rare for these low-pass vehicle loops, and it cannot predict anything about non-sinusoidal behaviour such as the first swerve after a step, which the time-domain simulation shows directly.

## Check yourself
Q: An actuator saturates at u_max = 1 and is driven by a sine of amplitude A = 2. What is the describing-function gain N(A) of the saturation?
Answer: 0.609
Tolerance: 0.012
Unit: 
How: u_max/A = 0.5; N = (2/π)[asin(0.5) + 0.5·√(1 − 0.25)] = (2/π)(0.5236 + 0.4330) = 0.609.
