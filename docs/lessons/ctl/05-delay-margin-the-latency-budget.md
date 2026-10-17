group: ctl
title: Delay margin: the latency budget

<p><b>Why this matters.</b> Of all the margins, the delay margin is the one a vehicle engineer uses most, because latency is the thing most likely to change after the controller is tuned: a new camera, a busier CPU, a different message bus. It converts phase margin into a time, and a time can be budgeted across sensors, estimation, planning and actuation. This lesson shows the conversion, what the loop does when the budget is exceeded, and why a slower loop has a bigger one.</p>
<p><b>The idea.</b> Phase margin is measured at the crossover frequency. An extra delay ΔT costs ω<sub>c</sub>·ΔT radians of phase there, so the loop can absorb</p>
<div class="eq">DM = PM / ω_c   (PM in radians)</div>
<p>of additional latency before the phase at crossover reaches −180° and the loop goes unstable. Fast loops have small budgets, because the same milliseconds are a larger fraction of a shorter period. Past the budget the linear model says the oscillation grows without bound; in the simulator the turn-rate limit caps the command, the effective gain drops, and the growth is bounded, which is what an unstable loop usually looks like on a real vehicle: a ringing that will not die, or a limit cycle.</p>
<p><b>Where it comes from.</b> e<sup>−jωΔ<i>T</i></sup> has unit magnitude and phase −ωΔ<i>T</i>; at ω = ω<sub>c</sub> the magnitude is still 1 and the phase margin becomes PM − ω<sub>c</sub>Δ<i>T</i>; it reaches zero at Δ<i>T</i> = PM/ω<sub>c</sub>. The delay margin is a first-order statement, because the crossover itself does not move with delay. <a class="chref" href="#notes=ch6/4-reading-the-margins">Derivation: chapter 6 §4</a></p>
<p><b>What the lab does.</b> The simulator adds latency in whole 50 ms ticks, so the delay-margin chip tells you which setting tips the loop over. The step test runs the full nonlinear simulator with a 0.2 m (or 0.1 m) path offset and overlays the measured response on the linear prediction, so an unstable prediction and a bounded measurement can be compared directly.</p>

## Try: Fast loop (L<sub>0</sub> 0.1 m): small budget
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0}}
Setup: Pure pursuit with a 0.1 m lookahead, no latency.
See: Phase margin 40.4° at 17.6 rad/s: 0.705 rad / 17.6 rad/s = 0.040 s of delay margin. The chip reads 40 ms.
Shows: The budget is smaller than one control tick. Any sensor or network that adds 50 ms, which almost anything does, breaks this loop. A real stack would never run a lateral loop at 17 rad/s for exactly this reason; the lookahead would be lengthened until the budget covered the measured latency with room to spare.
Predict: Phase margin 40° at 17.6 rad/s: roughly how much extra delay does that buy?
- About 40 ms, less than one tick
- About 0.4 s, several ticks
- About 2 s
Answer: 0

## Try: Fast loop + 0.05 s latency, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0.05},"test":"step","stepKind":"offset","stepAmp":0.1}
Setup: The same loop with one tick of latency, past its 40 ms budget, and a 0.1 m step test.
See: The linear prediction (solid) grows without bound: unstable poles. The measured response (dashed amber) swings 8 % past the path and then settles into a steady weave of ±3.6 % of the step (±3.6 mm), one cycle about every 0.45 s (14 rad/s), that does not die out before the plot ends. The message under the plot reads "The turn-rate limit was active for 0.60 s of the test, so the response departs from the linear prediction."
Shows: Saturation is what separates "unstable" from "destroyed". When the command hits the turn-rate limit the loop gain effectively falls and the oscillation stops growing, but it does not decay either: the amplitude settles where the clipped loop sits on the edge of stability, a limit cycle. A linear analysis says the loop is unstable; the nonlinear vehicle shows how badly, and a limit cycle at the actuator limit is the symptom to recognize on a real vehicle.
Predict: Past its delay budget by 10 ms, how will the simulated step respond?
- It grows without bound, as the linear model says
- It rings, then the turn-rate limit holds it in a steady weave that does not die out
- Normally: 10 ms over budget is within rounding
Answer: 1

## Try: Slow loop (L<sub>0</sub> 1.2 m), 0.3 s, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":1.2,"ppK":0,"latency":0.3},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: A 1.2 m lookahead with 0.3 s of latency, six ticks, and a 0.2 m step test.
See: Crossover 1.46 rad/s, phase margin 38°, and after absorbing 0.3 s the loop still has 0.46 s of delay margin left. The measured step overshoots 4.6 %, rises in 1.65 s and settles in 5 s, on top of the prediction.
Shows: The slow loop carries 0.3 s of latency, seven times the fast loop's entire budget, and is still comfortably stable, because its crossover is twelve times lower. Delay tolerance and bandwidth trade one for one. The end-to-end latency budget of a vehicle stack is set by this arithmetic: measure the latency, choose the crossover the margin allows, and tune the tracker to it.
Predict: A 1.2 m lookahead carrying 0.3 s of latency, six ticks: what will the step show?
- Unstable: 0.3 s is seven times the fast loop's whole budget
- A limit cycle at the turn-rate limit
- A clean, slow step with a few per cent overshoot and margin to spare
Answer: 2

## Code: anFreq, the delay margin
snippet: an-freq
focus: const dm = pm != null && wc ? (pm * Math.PI) / 180 / wc : null;
example: ctl/rwf
Note: One line: the phase margin in radians divided by the crossover frequency is the delay the loop can absorb. Edit and run: the rear-wheel-feedback example as your controller; add latency in the Vehicle tab until it breaks. The Analyze view cannot linearize your code; on the built-in rear-wheel feedback, halving both gains raises the delay margin from 0.35 to 0.46 s.

## Think about
Q: Why does the simulator's unstable response stop growing?
A: Because the turn-rate limit clips the command. Describing-function reasoning: a saturated actuator acts like a gain that falls as the amplitude grows, so the amplitude rises until the effective gain brings the loop to the edge of stability, and there it stays: a limit cycle, here ±3.6 mm at about 14 rad/s, still going 15 s after the step. Linear instability plus saturation is bounded, not safe.
Q: A stack measures 120 ms from camera exposure to steering command. What crossover can it afford with 45° of margin?
A: Keep at least 45° after the delay: if the undelayed loop has 65° (pure pursuit), 20° = 0.35 rad may go to delay, so ω_c ≤ 0.35/0.12 ≈ 2.9 rad/s. At 15 m/s with ω_c = 2.2 v/L_d, that is a lookahead of at least 11 m. Latency sets the lookahead.
Q: The delay margin chip is computed from the phase margin at one frequency. When is that misleading?
A: When the phase crosses −180° at several frequencies, or when the magnitude is near 0 dB over a range of frequencies, the first crossing is not the only one that matters and a delay can bring a different part of the curve onto −1 first. M_s catches those cases; the delay margin is the quick estimate and M_s the check.

## Check yourself
Q: A loop has 36° of phase margin at a crossover of 4 rad/s. What is its delay margin, in seconds?
Answer: 0.157
Tolerance: 0.01
Unit: s
How: PM = 36° = 0.628 rad; DM = PM/ω_c = 0.628/4 = 0.157 s.
