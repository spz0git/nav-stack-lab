group: ctl
title: Linear versus nonlinear

<p><b>Why this matters.</b> Everything in the Analyze view is linear. The gains are read at one operating point, and the responses scale with the input. The vehicle is not linear. It has steering locks, steering-rate limits and limits on turn rate and acceleration, and a large enough error asks for more than the actuator can give. You need to know where the linear picture stops being true, because the failures that matter on a real vehicle happen there. Two examples are a swerve that saturates the steering and a limit cycle after a big disturbance.</p>
<p><b>The idea.</b> For small signals the response is proportional to the input. In the linear model a 0.05 m step and a 1 m step therefore have the same shape, and the Bode plot describes both. A large step asks the controller for a large command, and the actuator clips it. The response then stops scaling with the input. It is slower and overshoots less than the linear model predicts, because the clipped actuator acts like a smaller gain. The same happens in the frequency domain. A large injected sine runs into the vehicle's limits and rules, and the measured points leave the model curve. The rate limit is a slew limit, a limit on how fast the actuator can move. It only matters at high frequency, where a sine of amplitude $A$ needs a rate $A\omega$.</p>
$$\text{saturation: } u = \operatorname{clamp}(u_\text{cmd}, -u_\text{max}, u_\text{max}) \qquad\qquad \text{rate limit: } |u_k - u_{k-1}| \le r_\text{max}\,\Delta t$$
<p>The default limits are $|\delta| \le 32°$ and $|\dot\delta| \le 1.5$ rad/s on the car, and $|\omega| \le 1.8$ rad/s and $|\dot\omega| \le 3\ \text{rad/s}^2$ on the diff-drive with acceleration limits on. The describing function of saturation replaces the clipped actuator with a gain that depends on the amplitude of the sine going in. For a sine of amplitude $A > u_\text{max}$ it is as below, and $N = 1$ for $A \le u_\text{max}$:</p>
$$N(A) = \frac{2}{\pi}\left[\arcsin\frac{u_\text{max}}{A} + \frac{u_\text{max}}{A}\sqrt{1 - \left(\frac{u_\text{max}}{A}\right)^2}\,\right]$$
<p><b>Where it comes from.</b> Saturation is a static nonlinearity. Its describing function is a gain that falls with amplitude, from 1 for small signals towards zero for large ones. For sinusoidal inputs, a loop with a saturating actuator behaves like the linear loop with that reduced gain. So measurements at large amplitude fall below the model, and the step response slows. <a class="chref" href="#notes=ch6/7-where-the-model-stops">Where the model stops: chapter 6 §7</a> · <a class="chref" href="#notes=ch1/6-the-limits-and-where-the-kinematic-model-stops">the vehicle's limits: chapter 1 §6</a></p>
<p><b>What the lab does.</b> The car's steering moves at most 1.5 rad/s and locks at 32° (both set in the Vehicle tab). The diff-drive's turn rate and acceleration are limited too. The car's trackers also hold their speed back while the wheels are more than 0.1 rad from the angle they asked for. This is the dry-steering rule, which lets a car turn its wheels at a cusp before it moves. The step test takes amplitudes from 0.05 to 1 m, and the injection has a small and a large setting. The message under the step test reports whether the steering-rate limit (car) or the turn-rate limit (diff-drive) was active, and for how long.</p>

## Try: Car, 0.05 m step test
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"offset","stepAmp":0.05,"test":"step"}
Setup: The car with rear-wheel feedback and a 5 cm path offset.
See: The measured overshoot is 9.0 %, against 9.0 % predicted. The response rises in 1.25 s and settles in 4.05 s, and the dashed measurement lies on the solid prediction. The message reports the steering-rate limit for only 0.10 s, too short a time to change the response.
Shows: This is a small signal, and the linear model matches the measurement to the width of the line. Every chip in the Analyze view describes this regime.
Predict: A 5 cm step on the car: how will the measurement compare with the prediction?
- On it, to the width of the line; a limit barely touches it
- Slower, with the steering-rate limit active
- Faster: small steps are easier than the model says
Answer: 0

## Try: Car, 1.0 m step test
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"offset","stepAmp":1,"test":"step"}
Setup: The same loop with a 1 m offset, twenty times larger.
See: The measured response is slower, with a rise of 2.0 s instead of 1.25, and it overshoots less, 5.3 % instead of 9 %. The plot is normalized per metre, so you can compare the shapes directly, and they differ. The message reports the steering-rate limit as active for 0.85 s, but that limit does not shape the response. The steering sits at its 32° lock for 1.3 s, and the heading error grows to 54°.
Shows: The controller asked for more steering than the lock allows. The heading error also went far past the small angles the model assumes ($\sin 54°$ is 0.81, while the model uses 0.94 rad). Both make the loop effectively softer, so the response is slower and overshoots less. If you raise the steering rate to its 4 rad/s maximum in the Vehicle tab, the response barely changes (5.2 %, rise 2.0 s). So the limit the message names is not the one that matters. If you also raise the lock to its 45° maximum, the rise shortens only to 1.8 s (5.5 %), and the steering reaches even that lock. A saturated loop is slower and, up to a point, better damped. The danger comes when the loop also has delay. A saturated loop with delay rings, and that is the limit cycle of the delay-margin lesson.
Predict: Twenty times the step, 1 m: how will the normalized response differ?
- Same shape: the response scales with the input
- Faster rise and more overshoot: the steering hits its lock
- Slower rise and less overshoot: the steering hits its lock
Answer: 2

## Try: Car, large-sine L(jω)
cfg: {"level":5,"set":{"ctl":"rwf"},"injAmp":"large","test":"inj"}
Setup: The injection experiment with a large sine amplitude.
See: Every measured point sits 2 to 3.5 dB below the magnitude curve, including the lowest frequency (−3.5 dB at 0.35 rad/s). The points are 5° to 14° ahead of the phase curve, except the top point at 12.5 rad/s, which is 22° behind. With the small sine, the same car's points land within about 0.2 dB. The limit time in the message comes from the step test and not from the injection.
Shows: Two nonlinearities act at once. The large sine is 0.2 rad of steering, more than the 0.1 rad gap that trips the dry-steering rule. So the car slows down in time with the sine, and a slower car has a smaller plant gain at every frequency. The small sine, 0.02 rad, never trips the rule. The rate limit acts as well. A sine of amplitude $A$ at frequency $\omega$ needs a rate $A\omega$, which exceeds 1.5 rad/s only above 7.5 rad/s. So the rate limit bends only the top point, where it costs about 30° of phase. If you raise the steering rate to its 4 rad/s maximum, that point moves back to 10° ahead and the others stay where they are. The measured gain is a describing-function gain and depends on the amplitude. On a real vehicle, this test finds the amplitude beyond which the Bode plot stops applying, and which part of the stack is responsible.
Predict: Injecting a large sine on the car: where will the measured points leave the model curves?
- Only at high frequency, where the rate limit bites
- At every frequency: the magnitude falls 2 to 3.5 dB throughout
- Nowhere: the injection amplitude does not matter
Answer: 1

## Code: benchTick, the nonlinear bench
snippet: bench-tick
focus: if (inj) { … } // the injected rate enters the command integrator
example: ctl/pp
Note: The bench runs the real controller and vehicle model tick by tick. The injection is added to the controller's command (to its rate, for the MPC), so the measured response includes every nonlinearity that the linear model leaves out. Edit and run loads the pure-pursuit example, which drives the same loop. The Analyze view cannot linearize your code, so for your own controller you get the measurements of Linear versus nonlinear and no linear model.

## Think about
Q: Why does saturation reduce overshoot here but cause limit cycles elsewhere?
A: Saturation lowers the effective gain. In a loop with plenty of phase margin, a lower gain gives more damping and so less overshoot. In a loop past its delay margin, the lower gain brings the loop back to the stability boundary but not across it. The oscillation then neither grows nor dies out, and that is a limit cycle. The mechanism is the same in both loops, and only the margin they start with differs.
Q: The 1 m response is normalized per metre and looks "better". Is a saturated loop safer?
A: No. It is slower, so on a curve it strays further before the correction catches up. While it is saturated, the controller also has no steering left for anything else that happens. A planner that leaves the tracker some steering margin, such as Hybrid A* with its 85 % rule, keeps the tracker in the linear regime.
Q: What does a describing function assume, and when does it fail?
A: It assumes that the loop filters out the harmonics the nonlinearity creates, so that only the fundamental frequency matters. It fails when the loop passes harmonics, which is rare for these low-pass vehicle loops. It also says nothing about behaviour that is not sinusoidal, such as the first swerve after a step. The time-domain simulation shows that directly.

## Check yourself
Q: An actuator saturates at $u_\text{max} = 1$ and is driven by a sine of amplitude $A = 2$. What is the describing-function gain $N(A)$ of the saturation?
Answer: 0.609
Tolerance: 0.012
Unit: 
How: $u_\text{max}/A = 0.5$; $N = \frac{2}{\pi}\bigl[\arcsin 0.5 + 0.5\sqrt{1 - 0.25}\bigr] = \frac{2}{\pi}(0.5236 + 0.4330) = 0.609$.
