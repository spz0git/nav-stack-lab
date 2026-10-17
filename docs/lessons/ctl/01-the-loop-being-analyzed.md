group: ctl
title: The loop being analyzed

<p><b>Why this matters.</b> Every tracker in this lab, and every lane-keeping controller on a real vehicle, closes the same loop: measure how far the vehicle is from the path, steer, and the steering changes the error. Everything about how that loop behaves, how fast it corrects, how much it overshoots, how much delay it tolerates, follows from one small linear model. Learning to read that model is what turns tuning from trial and error into engineering, and it is what the Analyze view computes live for whatever controller and vehicle you have set.</p>
<p><b>The idea.</b> Near a straight path at a steady speed, with small errors, the vehicle is two integrators in series: the steering command sets the rate of the heading error, and the heading error sets the rate of the lateral error. The lateral error is therefore the double integral of what the controller commands. A controller that fed back only the lateral error would oscillate for ever (a double integrator with proportional feedback is an undamped spring), so every tracker also feeds back the heading error, and since on a straight path the heading error is the lateral error's rate of change divided by speed, that second term is derivative action. The whole family of trackers, pure pursuit, rear-wheel feedback, Stanley, PID, even MPC near the path, reduces to two gains on these two errors.</p>
<div class="eq">θ̇ₑ = g·u      u = ω, g = 1 (diff-drive)     u = δ, g = v₀/L (car)
ė  = v₀·θₑ
u  = −K_e·e − K_θ·θₑ     every tracker near the path, each with its own K_e and K_θ</div>
<p><b>Where it comes from.</b> The Frenet equations ė = <i>v</i> sin θ<sub>e</sub>, θ̇<sub>e</sub> = ω − <i>v</i>κ cos θ<sub>e</sub>/(1 − κ<i>e</i>) hold for any vehicle whose velocity points along its heading; on a straight path (κ = 0) with small θ<sub>e</sub> they are the two lines above. For the car, ω = <i>v</i> tan δ/<i>L</i> ≈ (<i>v</i>/<i>L</i>)δ gives the plant gain <i>g</i>. <a class="chref" href="#notes=ch6/1-the-vehicle-in-path-coordinates">Derivation: chapter 6 §1</a> · the Frenet equations and the trackers' gains: <a class="chref" href="#notes=ch5/1-path-coordinates-and-the-speed-profile">chapter 5 §1</a></p>
<p><b>What the lab does.</b> The analysis does not trust formulas for the gains; it reads them from the controller's own code at the operating point by finite differences, nudging <i>e</i> and θ<sub>e</sub> by a millimetre and a milliradian and recording the change in the command (the PID's loop is built from its three gains instead). It then adds what the formulas leave out: the 25 ms hold delay of the 50 ms tick (a sampled controller holds each command for a tick, which on average delays it by half of one), any control latency, and actuator lag. The chips at the top of the Analyze view summarize the result: crossover, phase margin, gain margin, delay margin, <i>M</i><sub>s</sub>, the dominant poles. Everything updates as you move sliders in the Control and Vehicle tabs; <b>A</b> switches between the analysis and the map.</p>
<p><b>The chips, one line each.</b> You will meet all of them properly in the next lessons; for now, what each one measures. <i>Crossover</i> ω<sub>c</sub>: the frequency where the loop's gain is 1, which is how fast the loop corrects (a higher crossover is a faster loop). <i>Phase margin</i>: how far the loop is from oscillating at crossover, in degrees; above about 45° is comfortable, below 30° rings. <i>Gain margin</i>: how much the gain could grow before the loop goes unstable, in dB. <i>Delay margin</i>: the extra delay, in seconds, the loop can take before it goes unstable; it is the phase margin divided by the crossover. <i>M</i><sub>s</sub>: the worst amplification of a disturbance anywhere in frequency; near 1 is calm, above 2 is nervous. <i>Dominant poles</i>: the slowest way the error dies out, read as a damping ratio ζ (0.7 is a gentle return, 0.3 overshoots) and a natural frequency. Lessons 3 to 6 take them one at a time.</p>

## Try: Open the analysis (diff-drive, pure pursuit)
cfg: {"level":0,"set":{"ctl":"pp"}}
Setup: L1 defaults: the diff-drive robot at 0.8 m/s with pure pursuit (lookahead 0.5 + 0.5·v = 0.9 m). Opens the Analyze view on the lateral loop.
See: Gains read from the code: K_e = 1.98, K_θ = 1.78 (chapter 5 §2 predicts 2v/L_d² = 1.98 and 2v/L_d = 1.78). Crossover 1.95 rad/s, phase margin 62.7°, gain margin 31 dB, delay margin 0.56 s, M_s = 1.05, dominant poles with ζ = 0.71 and 4.3 % predicted overshoot. The Bode plot shows the −40 dB/decade slope of the two integrators bending to −20 at the controller's zero.
Shows: This is a comfortable loop: half a second of delay budget, almost no disturbance amplification, critically-damped-ish poles. Every number here will move in the lessons that follow, and the first thing to learn is which slider moves which: the lookahead sets the crossover, the vehicle and its delays set what the margins cost.
Predict: How much extra delay will this loop absorb before it goes unstable?
- About one 50 ms tick
- About half a second
- Several seconds
Answer: 1

## Try: Same loop on the car
cfg: {"level":5,"set":{"ctl":"pp"}}
Setup: L6, the car at 0.6 m/s with pure pursuit; the steering angle is the command and the plant gain is v₀/L = 1.0.
See: Nearly the same picture: crossover 2.27 rad/s, phase margin 62.3°, delay margin 0.48 s, ζ = 0.71. The steady error to a bias is different, 0.28 against 0.51 per unit of bias, because the car's command is an angle and the diff-drive's a rate.
Shows: The loop does not care much which vehicle closes it, as long as the model is the two integrators. What the vehicle changes is the plant gain (speed over wheelbase for the car), the actuator (an angle with a rate limit instead of a turn rate), and, in chapter 1, where the model stops being true: at speeds where the tyres, not the geometry, decide the turn.
Predict: Switching from the diff-drive to the car with the same pure pursuit: what happens to crossover and damping?
- Both change a lot: the car is a different plant
- Damping drops because the command is an angle, not a rate
- Roughly the same crossover and the same ζ ≈ 0.71
Answer: 2

## Code: Lparts, the loop in factors
snippet: loop-parts
focus: lat = Cx.exp(Cx.scale(s, -M.nL * M.T)); // hold delay T/2 on vehicle paths; latency on everything through the actuator
focus: const lag = M.tau > 0 ? Cx.div([M.aL, 0], Cx.sub(one, Cx.scale(zi, 1 - M.aL))) : one;
example: ctl/rwf
Note: Every block of the lesson's diagram is one factor here: the hold as e^{−sT/2}, the latency as e^{−s n T}, the actuator lag as a first-order discrete filter, then the plant and the controller's gains multiplied together. Edit and run: the rear-wheel-feedback example is the controller this loop is built on.

## Think about
Q: Why does feedback on e alone oscillate for ever?
A: Two integrators with a proportional gain give ë = −K_e v e: a mass on a spring with no damper. The solution is a sinusoid that never decays. Feedback on θ_e = ė/v is the damper. Every tracker has one; pure pursuit hides it in the geometry of the carrot.
Q: The hold delay is half a tick, 25 ms. Why half and not a whole tick?
A: A zero-order hold applies a command for the whole tick, so the command is on average 25 ms old while it acts; in the frequency domain that is a phase lag of ωT/2, which is what the analysis uses. The full tick shows up elsewhere: the controller sees a measurement that is already up to one tick old, which the latency slider adds on top.
Q: The gains are read by finite differences rather than from formulas. What does that buy?
A: It works for every built-in tracker the same way, including MPC and Stanley's arctangent (a controller of your own from the Code tab runs as a black box in a worker, and the Analyze view does not linearize it), and it reads the gains the code actually has, saturations and all, at the actual operating point, on a curve included. The formulas in the chapters are for understanding; the chips are for truth.

## Check yourself
Q: On a straight path at v₀ = 10 m/s the heading error is θ_e = 2° (use the small-angle model ė = v₀·θ_e with θ_e in radians). How fast is the lateral error growing, in m/s?
Answer: 0.349
Tolerance: 0.01
Unit: m/s
How: θ_e = 2° = 0.0349 rad; ė = v₀·θ_e = 10 × 0.0349 = 0.349 m/s.
