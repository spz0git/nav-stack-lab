group: ctl
title: Delay margin: the latency budget

<p><b>Why this matters.</b> Of all the margins, the delay margin is the one a vehicle engineer uses most. Latency is the thing most likely to change after the controller is tuned, for example with a new camera, a busier CPU or a different message bus. The delay margin turns the phase margin into a time, and a time can be shared out as a budget between sensing, estimation, planning and actuation. This lesson shows the conversion, what the loop does when the latency goes over the budget, and why a slower loop has a bigger budget.</p>
<p><b>The idea.</b> Phase margin is measured at the crossover frequency. An extra delay $\Delta T$ costs $\omega_c\,\Delta T$ radians of phase there, so the loop can absorb</p>
$$\text{DM} = \frac{\text{PM}}{\omega_c} \qquad (\text{PM in radians})$$
<p>of additional latency before the phase at crossover reaches −180° and the loop goes unstable. Fast loops have small budgets, because the same milliseconds are a larger fraction of a shorter period. Past the budget, the linear model says the oscillation grows without bound. In the simulator the turn-rate limit caps the command, so the effective gain drops and the growth stops. An unstable loop on a real vehicle usually looks like this: a ringing that does not die out, called a limit cycle.</p>
<p><b>Where it comes from.</b> $e^{-j\omega\Delta T}$ has unit magnitude and phase $-\omega\Delta T$. At $\omega = \omega_c$ the magnitude is still 1, and the phase margin becomes $\text{PM} - \omega_c\Delta T$. It reaches zero at $\Delta T = \text{PM}/\omega_c$. The delay margin is a first-order statement, because the crossover itself does not move with delay. <a class="chref" href="#notes=ch6/4-reading-the-margins">Derivation: chapter 6 §4</a></p>
<p><b>What the lab does.</b> The simulator adds latency in whole 50 ms ticks, and the delay-margin chip tells you at which setting the loop becomes unstable. The step test runs the full nonlinear simulator with a path offset of 0.2 m (or 0.1 m) and draws the measured response over the linear prediction. You can then compare an unstable prediction with a bounded measurement on the same plot.</p>

## Try: Fast loop (L<sub>0</sub> 0.1 m): small budget
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0}}
Setup: Pure pursuit with a 0.1 m lookahead and no latency.
See: The phase margin is 40.4° at 17.6 rad/s, which gives $0.705\ \text{rad} / 17.6\ \text{rad/s} = 0.040$ s of delay margin. The chip reads 40 ms.
Shows: The budget is smaller than one control tick. Any sensor or network link that adds 50 ms breaks this loop, and almost every one does. A real stack would not run a lateral loop at 17 rad/s for this reason. Its designers would lengthen the lookahead until the budget covered the measured latency with room to spare.
Predict: Phase margin 40° at 17.6 rad/s: roughly how much extra delay does that buy?
- About 40 ms, less than one tick
- About 0.4 s, several ticks
- About 2 s
Answer: 0

## Try: Fast loop + 0.05 s latency, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0.05},"test":"step","stepKind":"offset","stepAmp":0.1}
Setup: The same loop with one tick of latency, which is past its 40 ms budget, and a 0.1 m step test.
See: The linear prediction (solid) grows without bound, because its poles are unstable. The measured response (dashed amber) swings 8 % past the path. It then settles into a steady weave of ±3.6 % of the step (±3.6 mm), with one cycle about every 0.43 s (about 15 rad/s). The weave does not die out before the plot ends. The message under the plot reads "The turn-rate limit was active for 0.60 s of the test, so the response departs from the linear prediction."
Shows: Saturation keeps the unstable loop from growing without bound. When the command hits the turn-rate limit, the loop's effective gain falls and the oscillation stops growing. It does not decay either. The amplitude settles where the clipped loop is on the edge of stability, and the result is a limit cycle. The linear analysis says that the loop is unstable, and the nonlinear vehicle shows how badly. On a real vehicle, a limit cycle at the actuator limit is the symptom to recognize.
Predict: Past its delay budget by 10 ms, how will the simulated step respond?
- It grows without bound, as the linear model says
- It rings, then the turn-rate limit holds it in a steady weave that does not die out
- Normally: 10 ms over budget is within rounding
Answer: 1

## Try: Slow loop (L<sub>0</sub> 1.2 m), 0.3 s, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":1.2,"ppK":0,"latency":0.3},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: A 1.2 m lookahead with 0.3 s of latency (six ticks) and a 0.2 m step test.
See: The crossover is 1.46 rad/s and the phase margin 38°. After absorbing 0.3 s, the loop still has 0.46 s of delay margin left. The measured step overshoots 4.6 %, rises in 1.65 s and settles in 5 s, and it lies on top of the prediction.
Shows: The slow loop carries 0.3 s of latency, seven times the fast loop's whole budget, and is still comfortably stable, because its crossover is twelve times lower. Delay tolerance and bandwidth trade one for one. A vehicle stack's end-to-end latency budget is set by this arithmetic. You measure the latency, choose the crossover that the margin allows, and tune the tracker to that crossover.
Predict: A 1.2 m lookahead carrying 0.3 s of latency, six ticks: what will the step show?
- Unstable: 0.3 s is seven times the fast loop's whole budget
- A limit cycle at the turn-rate limit
- A clean, slow step with a few per cent overshoot and margin to spare
Answer: 2

## Code: anFreq, the delay margin
snippet: an-freq
focus: const dm = pm != null && wc ? (pm * Math.PI) / 180 / wc : null;
example: ctl/rwf
Note: The marked line divides the phase margin in radians by the crossover frequency, which gives the delay the loop can absorb. Edit and run loads the rear-wheel-feedback example as your controller. Add latency in the Vehicle tab until the loop breaks. The Analyze view cannot linearize your code. On the built-in rear-wheel feedback, halving both gains raises the delay margin from 0.35 to 0.46 s.

## Think about
Q: Why does the simulator's unstable response stop growing?
A: The turn-rate limit clips the command. A describing-function argument, which treats the saturation as a gain that depends on the amplitude, explains the rest. A saturated actuator acts like a gain that falls as the amplitude grows. So the amplitude rises until the effective gain brings the loop to the edge of stability, and there it stays. That is a limit cycle, here ±3.6 mm at about 15 rad/s. Run for 20 s instead of the plot's 3.75 s, it is still ±3.6 mm at the end. Saturation keeps a linearly unstable loop bounded, but the loop is still not safe.
Q: A stack measures 120 ms from camera exposure to steering command. What crossover can it afford with 45° of margin?
A: The loop must keep at least 45° after the delay. Without delay, pure pursuit has 65°, so 20° = 0.35 rad may go to delay, and $\omega_c \le 0.35/0.12 \approx 2.9$ rad/s. At 15 m/s with $\omega_c = 2.2\,v/L_d$, that means a lookahead of at least 11 m. The measured latency sets the shortest lookahead the stack can use.
Q: The delay margin chip is computed from the phase margin at one frequency. When is that misleading?
A: It misleads when the phase crosses −180° at several frequencies, or when the magnitude stays near 0 dB over a range of frequencies. Then the first crossing is not the only one that matters, and a delay can bring a different part of the curve onto −1 first. $M_s$ catches those cases. Use the delay margin as the quick estimate and $M_s$ as the check.

## Check yourself
Q: A loop has 36° of phase margin at a crossover of 4 rad/s. What is its delay margin, in seconds?
Answer: 0.157
Tolerance: 0.01
Unit: s
How: $\text{PM} = 36° = 0.628$ rad; $\text{DM} = \text{PM}/\omega_c = 0.628/4 = 0.157$ s.
