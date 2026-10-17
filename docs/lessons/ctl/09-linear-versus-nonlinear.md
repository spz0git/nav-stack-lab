group: ctl
title: Linear versus nonlinear

<p><b>Why this matters.</b> Everything in the Analyze view is linear: gains read at one operating point, responses that scale with the input. The vehicle is not. Steering locks, steering-rate limits, turn-rate and acceleration limits all exist, and a large enough error asks for more than the actuator can give. Knowing where the linear picture stops being true is as important as the picture itself, because the failures that matter on a real vehicle, a swerve that saturates the steering, a limit cycle after a big disturbance, live exactly there.</p>
<p><b>The idea.</b> For small signals the response is proportional to the input, so a 0.05 m step and a 1 m step have the same shape and the Bode plot describes both. A large step asks the controller for a large command, the actuator clips it, and the response stops scaling: it is slower and less overshooting than the linear model predicts, because the clipped actuator is effectively a smaller gain. The same happens in the frequency domain: a large injected sine runs into the vehicle's limits and rules, and the measured points leave the model curve; the rate limit, a slew limit, bites only at high frequency, where a sine of amplitude A needs a rate Aω.</p>
<div class="eq">saturation:  u = clamp(u_cmd, −u_max, u_max)        rate limit:  |u_k − u_{k−1}| ≤ r_max·Δt
car: |δ| ≤ 32°, |δ̇| ≤ 1.5 rad/s;   diff-drive: |ω| ≤ 1.8 rad/s, |ω̇| ≤ 3 rad/s² with acceleration limits on   (defaults)
describing function of saturation, for a sine of amplitude A > u_max:
   N(A) = (2/π)·[asin(u_max/A) + (u_max/A)·√(1 − (u_max/A)²)]      (N = 1 for A ≤ u_max)</div>
<p><b>Where it comes from.</b> Saturation is a static nonlinearity; its describing function is a gain that falls with amplitude, from 1 for small signals toward zero for large ones. A loop with a saturating actuator behaves, for sinusoidal inputs, like the linear loop with that reduced gain, which is why large-amplitude measurements fall below the model and why the step response slows. <a class="chref" href="#notes=ch6/7-where-the-model-stops">Where the model stops: chapter 6 §7</a> · <a class="chref" href="#notes=ch1/6-the-limits-and-where-the-kinematic-model-stops">the vehicle's limits: chapter 1 §6</a></p>
<p><b>What the lab does.</b> The car's steering moves at most 1.5 rad/s and locks at 32° (Vehicle tab); the diff-drive's turn rate and acceleration are limited too. The car's trackers also hold their speed back while the wheels are more than 0.1 rad from the angle they asked for, the dry-steering rule that lets a car turn its wheels at a cusp before it moves. The step test accepts amplitudes from 0.05 to 1 m and the injection has a small and a large setting; the message under the step test reports when the steering-rate (car) or turn-rate (diff-drive) limit was active and for how long.</p>

## Try: Car, 0.05 m step test
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"offset","stepAmp":0.05,"test":"step"}
Setup: The car with rear-wheel feedback and a 5 cm path offset.
See: Measured overshoot 9.0 % against 9.0 % predicted, rise 1.25 s, settled in 4.05 s; the dashed measurement lies on the solid prediction. The message reports the steering-rate limit for only 0.10 s, too briefly to move the response.
Shows: Small signal: the linear model is exact to the width of the line. This is the regime every chip in the Analyze view describes.
Predict: A 5 cm step on the car: how will the measurement compare with the prediction?
- On it, to the width of the line; a limit barely touches it
- Slower, with the steering-rate limit active
- Faster: small steps are easier than the model says
Answer: 0

## Try: Car, 1.0 m step test
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"offset","stepAmp":1,"test":"step"}
Setup: The same loop with a 1 m offset, twenty times larger.
See: The measured response is slower, rise 2.0 s instead of 1.25, and overshoots less, 5.3 % instead of 9 %; the plot is normalized per metre, so the shapes can be compared directly, and they differ. The message reports the steering-rate limit active for 0.85 s, but that is not what shapes the response: the steering sits at its 32° lock for 1.3 s, and the heading error grows to 54°.
Shows: The controller asked for more steering than the lock allows, and the heading error went far past the small angles the model assumes (sin 54° is 0.81, the model uses 0.94 rad); both make the loop effectively softer, so the response is slower and overshoots less. Raise the steering rate to its 4 rad/s maximum in the Vehicle tab and the response barely moves (5.2 %, rise 2.0 s): the limit the message names is not the one that matters. Raise the lock to its 45° maximum as well and the rise shortens only to 1.8 s (5.5 %), with the steering reaching even that lock. A saturated loop is slower and, up to a point, better damped. The danger is the other direction: a saturated loop with delay rings, and that is the limit cycle of the delay-margin lesson.
Predict: Twenty times the step, 1 m: how will the normalized response differ?
- Same shape: the response scales with the input
- Faster rise and more overshoot: the steering hits its lock
- Slower rise and less overshoot: the steering hits its lock
Answer: 2

## Try: Car, large-sine L(jω)
cfg: {"level":5,"set":{"ctl":"rwf"},"injAmp":"large","test":"inj"}
Setup: The injection experiment with a large sine amplitude.
See: Every measured point sits 2 to 3.5 dB below the magnitude curve, the lowest frequency included (−3.5 dB at 0.35 rad/s), and 5° to 14° ahead of the phase curve, except the top point, 12.5 rad/s, which is 22° behind. With the small sine the same car lands within about 0.2 dB. The limit time in the message comes from the step test, not from the injection.
Shows: Two nonlinearities at once. The large sine is 0.2 rad of steering, more than the 0.1 rad gap that trips the dry-steering rule, so the car slows in time with the sine, and a slower car is a smaller plant gain at every frequency; the small sine, 0.02 rad, never trips it. On top of that, the rate limit is a slew limit: a sine of amplitude A at frequency ω needs a rate Aω, which passes 1.5 rad/s only above 7.5 rad/s, so it bends only the top point, where it costs about 30° of phase (raise the steering rate to its 4 rad/s maximum and that point moves back to 10° ahead while the others stay). The measured gain is a describing-function gain and depends on the amplitude; on a real vehicle this is how you find the amplitude beyond which the Bode plot stops applying, and which part of the stack is responsible.
Predict: Injecting a large sine on the car: where will the measured points leave the model curves?
- Only at high frequency, where the rate limit bites
- At every frequency: the magnitude falls 2 to 3.5 dB throughout
- Nowhere: the injection amplitude does not matter
Answer: 1

## Code: benchTick, the nonlinear bench
snippet: bench-tick
focus: if (inj) { … } // the injected rate enters the command integrator
example: ctl/pp
Note: The bench runs the real controller and vehicle model tick by tick; the injection is added to the controller's command (to its rate, for the MPC), so the measured response includes every nonlinearity the linear model leaves out. Edit and run: the pure-pursuit example drives the same loop; the Analyze view cannot linearize your code, so Linear versus nonlinear is what you get.

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
