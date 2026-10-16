group: ctl
title: Reading the Bode plot

<p><b>Why this matters.</b> The Bode plot is the control engineer's X-ray: two curves that show, frequency by frequency, how much the open loop amplifies and how much it delays, and from which the stability margins can be read by eye. The lessons that follow refer to it constantly. This one is about reading it: what the slopes mean, where the margins are, and what the closed-loop curves add.</p>
<p><b>The idea.</b> The top panel is |<i>L</i>(jω)| in decibels against frequency on a log axis, the bottom its phase. Two integrators give a −40 dB/decade slope at −180° of phase: a sinusoidal steering input at any frequency comes out as a lateral error exactly out of phase and shrinking with the square of frequency. The controller's zero at s = −K_e·v₀/K_θ bends the slope to −20 dB/decade above that frequency and lifts the phase toward −90°, which is where the margin comes from. Delay subtracts phase in proportion to frequency, ω<i>T</i><sub>d</sub>, without touching the magnitude. The crossover ω_c, where |L| = 0 dB, is roughly the closed-loop bandwidth; the phase margin is how far above −180° the phase is there; the gain margin is how far below 0 dB the magnitude is where the phase reaches −180°. A rule of thumb for second-order loops: ζ ≈ PM/100 below about 70°.</p>
<p><b>Where it comes from.</b> |<i>L</i>| and arg <i>L</i> are the magnitude and angle of the complex number <i>L</i>(jω), and the closed loop 1/(1 + <i>L</i>) blows up where <i>L</i> = −1, which is 0 dB and −180° on this plot; the margins measure the distance from that point along each axis. <a class="chref" href="#notes=ch6/3-the-open-loop-l-s-with-the-clock-in-it">The open loop with the clock in it: chapter 6 §3</a> · <a class="chref" href="#notes=ch6/4-reading-the-margins">reading the margins: §4</a></p>
<p><b>What the lab does.</b> With "+ closed loop" on, two more curves appear: green is |T| = |L/(1 + L)|, how a path offset at each frequency is followed, and pink is |S| = |1/(1 + L)|, how a disturbance at each frequency is amplified or suppressed; the peak of |<i>S</i>| is <i>M</i><sub>s</sub>, one number that covers both margins. The dotted line at π/T = 62.8 rad/s is the Nyquist frequency of the 20 Hz loop: nothing above it exists in a sampled controller. The injection experiment adds a small sine at the actuator at nine frequencies and plots the measured |<i>L</i>| and phase as points on the model curves.</p>

## Try: Rear-wheel feedback, k_e = 2
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":2,"rwKth":3}}
Setup: Rear-wheel feedback with a soft lateral gain, k_e = 2, and k_θ = 3.
See: Crossover 2.46 rad/s, phase margin 74°, M_s = 1.06, and the dominant poles are real: ζ = 1, no overshoot. On the Bode plot the zero sits low (K_e v/K_θ ≈ 0.5 rad/s), so by the crossover the slope has long been −20 dB/decade and the phase is near −105°.
Shows: A heavily damped loop reads as a wide gap between the phase curve and −180° at crossover. The gain margin of 28 dB says the gain could rise 25-fold before instability, which is another way of saying the loop is nowhere near its limit.
Predict: With a soft lateral gain k_e = 2 and k_θ = 3, what will the dominant poles look like?
- Complex, ζ ≈ 0.4, visible overshoot
- Real: ζ = 1, no overshoot, phase margin above 70°
- Marginal: the soft gain cannot hold the path
Answer: 1

## Try: k_e = 12
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":12,"rwKth":3}}
Setup: The lateral gain raised to 12 with the same heading gain.
See: The magnitude curve moves up, the crossover rises to 3.33 rad/s, and the zero moves up with it (K_e v/K_θ ≈ 3.2 rad/s), so at crossover the phase has lifted less: phase margin 41°, ζ = 0.41, predicted overshoot 24 %, M_s = 1.42. The pink |S| curve now peaks visibly above 0 dB near the crossover.
Shows: Raising the spring without the damper: the loop is faster and underdamped, and the Bode plot shows it as a crossover that has climbed toward the frequency where the phase is still falling. The rule of thumb ζ ≈ PM/100 gives 0.41, which is exactly the pole damping. A |S| peak above 0 dB means disturbances near that frequency are amplified, not rejected.
Predict: Raising k_e from 2 to 12 with k_θ fixed: what happens to the phase margin and the |S| peak?
- PM rises with the gain; |S| stays below 0 dB
- No change in PM: the heading gain sets the damping
- PM falls to about 40° and |S| peaks above 0 dB
Answer: 2

## Try: Measure L(jω) in the simulator
cfg: {"test":"inj","injAmp":"small"}
Setup: Injects a small sinusoid at the actuator at nine frequencies, one at a time, in the full simulator, and measures the loop's response at each.
See: Nine measured points land on the model's magnitude and phase curves, within about 0.1 dB and 1° at the lower frequencies and scattering a little at the top, where the response is small and one tick is a large fraction of a period.
Shows: The model is not an approximation someone chose; it is what the simulator does, measured. This is also how a real vehicle's loop is identified: inject, measure, fit. If the points left the curves, the model would be missing something, which the latency and lag lessons arrange on purpose.
Predict: Where will the nine measured points land relative to the model curves?
- On the curves, scattering a little at the top frequencies
- Below the magnitude curve everywhere: the simulator loses gain
- On the magnitude curve but about 25° off in phase
Answer: 0

## Think about
Q: Why do two integrators give −40 dB per decade and −180°?
A: Each 1/s has magnitude 1/ω, which falls by a factor 10, −20 dB, per decade of frequency, and phase −90°. Two in series multiply the magnitudes and add the phases.
Q: What does the zero do, physically?
A: The zero is the heading feedback: the controller responds to ė as well as e, and at high frequency the ė term dominates, so the controller output leads the error. Lead is phase, and phase at crossover is margin. Without the zero the phase would sit at −180° plus the delay, and the loop could not be stabilized at all.
Q: M_s = 1.42 at k_e = 12. What does that number promise?
A: That the loop's Nyquist curve comes within 1/1.42 = 0.70 of −1, so the gain margin is at least 1/(1 − 0.70) = 3.4 (10.5 dB) and the phase margin at least 2 arcsin(0.70/2) = 41°, whichever direction the model error comes from. M_s is the one-number robustness summary, and above 2 the loop is fragile.

## Check yourself
Q: A tracker with K_e = 4, K_θ = 2.5 at v₀ = 1.2 m/s: at what frequency is the controller's zero, K_e·v₀/K_θ, in rad/s?
Answer: 1.92
Tolerance: 0.04
Unit: rad/s
How: K_e v₀/K_θ = 4 × 1.2/2.5 = 1.92 rad/s.
