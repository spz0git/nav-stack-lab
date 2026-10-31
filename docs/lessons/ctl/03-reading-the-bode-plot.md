group: ctl
title: Reading the Bode plot

<p><b>Why this matters.</b> The Bode plot is a pair of curves. They show, frequency by frequency, how much the open loop amplifies a signal and how much it delays it, and you can read the stability margins off them by eye. The lessons that follow use it all the time. This lesson shows how to read it: what the slopes mean, where the margins are, and what the closed-loop curves add.</p>
<p><b>The idea.</b> The top panel is $|L(j\omega)|$ in decibels against frequency on a log axis, and the bottom panel is its phase. Two integrators give a slope of −40 dB/decade and a phase of −180°. A sinusoidal steering input at any frequency comes out as a lateral error half a cycle behind it, and the error's size falls with the square of the frequency. The controller's zero at $s = -K_e v_0/K_\theta$ bends the slope to −20 dB/decade above that frequency and lifts the phase towards −90°. The margin comes from that lift. Delay subtracts phase in proportion to frequency, $\omega T_d$, and leaves the magnitude alone. The crossover $\omega_c$ is where $|L| = 0$ dB, and it is roughly the closed-loop bandwidth. The phase margin is how far the phase is above −180° at the crossover. The gain margin is how far the magnitude is below 0 dB at the frequency where the phase reaches −180°. For second-order loops with a phase margin below about 70°, a rule of thumb is $\zeta \approx \text{PM}/100$.</p>
<p><b>Where it comes from.</b> $|L|$ and $\arg L$ are the magnitude and angle of the complex number $L(j\omega)$. The closed loop $1/(1 + L)$ becomes infinite where $L = -1$, which on this plot is 0 dB and −180°. The margins measure the distance from that point along each axis. <a class="chref" href="#notes=ch6/3-the-open-loop-l-s-with-the-clock-in-it">The open loop with the clock in it: chapter 6 §3</a> · <a class="chref" href="#notes=ch6/4-reading-the-margins">reading the margins: §4</a></p>
<p><b>What the lab does.</b> With "+ closed loop" on, two more curves appear. The green one is $|T| = |L/(1 + L)|$, which says how closely the robot follows a path offset at each frequency. The pink one is $|S| = |1/(1 + L)|$, which says how much a disturbance at each frequency is amplified or suppressed. The peak of $|S|$ is $M_s$, a single number that covers both margins. The dotted line at $\pi/T = 62.8$ rad/s is the Nyquist frequency of the 20 Hz loop. A sampled controller cannot represent any frequency above it. The injection experiment adds a small sine at the actuator at nine frequencies, and plots the measured $|L|$ and phase as points over the model curves.</p>

## Try: Rear-wheel feedback, k_e = 2
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":2,"rwKth":3}}
Setup: Rear-wheel feedback with a soft lateral gain, $k_e = 2$, and $k_\theta = 3$.
See: The crossover is 2.46 rad/s and the phase margin 74°, with $M_s = 1.06$. The dominant poles are real, with $\zeta = 1$ and no overshoot. On the Bode plot the zero sits low ($K_e v/K_\theta \approx 0.5$ rad/s). By the crossover the slope has been −20 dB/decade for a while, and the phase is near −105°.
Shows: On the Bode plot, a heavily damped loop shows as a wide gap between the phase curve and −180° at crossover. The gain margin is 28 dB, shown as ×26 on the chip, so the gain could rise 26-fold before the loop goes unstable. This loop is far from its limit.
Predict: With a soft lateral gain $k_e = 2$ and $k_\theta = 3$, what will the dominant poles look like?
- Complex, $\zeta \approx 0.4$, visible overshoot
- Real: $\zeta = 1$, no overshoot, phase margin above 70°
- Marginal: the soft gain cannot hold the path
Answer: 1

## Try: k_e = 12
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":12,"rwKth":3}}
Setup: The lateral gain is raised to 12, and the heading gain stays the same.
See: The magnitude curve moves up and the crossover rises to 3.33 rad/s. The zero moves up with it ($K_e v/K_\theta \approx 3.2$ rad/s), so by the crossover the phase has lifted less. The phase margin is 41°, $\zeta = 0.41$, the predicted overshoot 24 % and $M_s = 1.42$. The pink $|S|$ curve now peaks clearly above 0 dB near the crossover.
Shows: Raising the lateral gain stiffens the spring and leaves the damper as it was. The loop is faster and underdamped. On the Bode plot the crossover has climbed towards the frequency where the phase is still falling. The rule of thumb $\zeta \approx \text{PM}/100$ gives 0.41, the same as the damping of the poles. Where $|S|$ peaks above 0 dB, disturbances near that frequency are amplified instead of rejected.
Predict: Raising $k_e$ from 2 to 12 with $k_\theta$ fixed: what happens to the phase margin and the $|S|$ peak?
- PM rises with the gain; $|S|$ stays below 0 dB
- No change in PM: the heading gain sets the damping
- PM falls to about 40° and $|S|$ peaks above 0 dB
Answer: 2

## Try: Measure L(jω) in the simulator
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":12,"rwKth":3},"test":"inj","injAmp":"small"}
Setup: The button injects a small sinusoid at the actuator in the full simulator, at nine frequencies one at a time, and measures the loop's response at each. The loop is the one from the previous button: rear-wheel feedback with $k_e = 12$ and $k_\theta = 3$.
See: The nine measured points land on the model's magnitude and phase curves. At the lower frequencies they are within about 0.1 dB and 1°. They scatter a little at the top frequencies, where the response is small and one tick is a large fraction of a period.
Shows: The measurement confirms that the model describes what the simulator does. A real vehicle's loop is identified in the same way: you inject a signal, measure the response and fit a model to it. If the points left the curves, the model would be missing something. The latency and lag lessons set up that case on purpose.
Predict: Where will the nine measured points land relative to the model curves?
- On the curves, scattering a little at the top frequencies
- Below the magnitude curve everywhere: the simulator loses gain
- On the magnitude curve but about 25° off in phase
Answer: 0

## Code: anFreq, the crossover
snippet: an-freq
focus: if (pm == null || m < pm) { … wc = w;
example: ctl/rwf
Note: The Bode points are computed a few lines above. The marked lines find the gain crossover, the frequency where $|L| = 1$, and record the phase margin there. Edit and run loads the rear-wheel-feedback example as your controller. The Analyze view cannot linearize your code. To see the crossover move left on the plot, halve both gains of the built-in rear-wheel feedback in the Control tab. Taking $k_e$ from 6 to 3 and $k_\theta$ from 3 to 1.5 moves the crossover from 2.77 to 1.67 rad/s.

## Think about
Q: Why do two integrators give −40 dB per decade and −180°?
A: Each $1/s$ has magnitude $1/\omega$ and phase −90°. The magnitude falls by a factor of 10, which is −20 dB, per decade of frequency. Two in series multiply the magnitudes and add the phases.
Q: What does the zero do, physically?
A: The zero comes from the heading feedback. The controller responds to $\dot e$ as well as to $e$, and at high frequency the $\dot e$ term dominates, so the controller's output leads the error. That lead adds phase, and extra phase at crossover is extra margin. Without the zero the phase would stay at −180° with the delay's lag on top, and no gain could stabilize the loop.
Q: $M_s = 1.42$ at $k_e = 12$. What does that number promise?
A: It means the loop's Nyquist curve comes no closer to −1 than $1/1.42 = 0.70$. So the gain margin is at least $1/(1 - 0.70) = 3.4$ (10.5 dB) and the phase margin at least $2\arcsin(0.70/2) = 41°$, in whichever direction the model is wrong. $M_s$ sums up the loop's robustness in one number, and above 2 the loop is fragile.

## Check yourself
Q: A tracker has $K_e = 4$ and $K_\theta = 2.5$ at $v_0 = 1.2$ m/s. At what frequency is the controller's zero, $K_e v_0/K_\theta$, in rad/s?
Answer: 1.92
Tolerance: 0.04
Unit: rad/s
How: $K_e v_0/K_\theta = 4 \times 1.2/2.5 = 1.92$ rad/s.
