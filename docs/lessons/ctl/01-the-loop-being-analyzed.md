group: ctl
title: The loop being analyzed

<p><b>Why this matters.</b> Every tracker in this lab closes the same loop, and so does every lane-keeping controller on a real vehicle. It measures how far the vehicle is from the path and steers, and the steering changes that error. How fast the loop corrects, how much it overshoots and how much delay it tolerates all follow from one small linear model. Once you can read that model, you can work out what a change to a controller will do before you try it. The Analyze view computes the model live for the controller and vehicle you have set.</p>
<p><b>The idea.</b> Near a straight path at a steady speed, with small errors, the vehicle behaves as two integrators in series. The steering command sets the rate of change of the heading error, and the heading error sets the rate of change of the lateral error. So the lateral error is the double integral of what the controller commands. A controller that fed back only the lateral error would oscillate for ever, because a double integrator with proportional feedback is a spring with no damper. Every tracker therefore also feeds back the heading error. On a straight path the heading error is the lateral error's rate of change divided by the speed, so this second term is derivative action. Pure pursuit, rear-wheel feedback, Stanley, PID and even MPC near the path all reduce to two gains on these two errors.</p>
$$\begin{aligned} \dot\theta_e &= g\,u && u = \omega,\ g = 1 \ \text{(diff-drive)} \qquad u = \delta,\ g = v_0/L \ \text{(car)} \\ \dot e &= v_0\,\theta_e \\ u &= -K_e\,e - K_\theta\,\theta_e && \text{every tracker near the path, each with its own } K_e \text{ and } K_\theta \end{aligned}$$
<p><b>Where it comes from.</b> The Frenet equations $\dot e = v\sin\theta_e$, $\dot\theta_e = \omega - v\kappa\cos\theta_e/(1 - \kappa e)$ hold for any vehicle whose velocity points along its heading. On a straight path ($\kappa = 0$) and with small $\theta_e$ they reduce to the two lines above. For the car, $\omega = v\tan\delta/L \approx (v/L)\,\delta$ gives the plant gain $g$. <a class="chref" href="#notes=ch6/1-the-vehicle-in-path-coordinates">Derivation: chapter 6 §1</a> · the Frenet equations and the trackers' gains: <a class="chref" href="#notes=ch5/1-path-coordinates-and-the-speed-profile">chapter 5 §1</a></p>
<p><b>What the lab does.</b> The analysis does not take the gains from formulas. It reads them from the controller's own code at the operating point, by finite differences: it nudges $e$ by a millimetre and $\theta_e$ by a milliradian and records the change in the command. (The PID's loop is built from its three gains instead.) It then adds what the formulas leave out. The first is the 25 ms hold delay of the 50 ms tick. A sampled controller holds each command for a tick, which delays it by half a tick on average. The others are any control latency and the actuator lag. The chips at the top of the Analyze view summarize the result: crossover, phase margin, gain margin, delay margin, $M_s$ and the dominant poles. They update as you move the sliders in the Control and Vehicle tabs. <b>A</b> switches between the analysis and the map.</p>
<p><b>The chips, one line each.</b> The next lessons cover each of them properly. Here is what each one measures. <i>Crossover</i> $\omega_c$ is the frequency at which the loop's gain is 1. It sets how fast the loop corrects: a higher crossover is a faster loop. <i>Phase margin</i> is how far the loop is from oscillating at crossover, in degrees. Above about 45° is comfortable, and below 30° the loop rings. <i>Gain margin</i> is how much the gain could grow before the loop goes unstable, in dB. <i>Delay margin</i> is the extra delay, in seconds, that the loop can take before it goes unstable. It is the phase margin divided by the crossover. $M_s$ is the largest factor by which the loop amplifies a disturbance, at any frequency. A value near 1 is calm, and above 2 the loop is nervous. The <i>dominant poles</i> describe the slowest way the error dies out, as a damping ratio $\zeta$ and a natural frequency. A damping ratio of 0.7 gives a gentle return, and 0.3 overshoots. Lessons 3 to 6 take them one at a time.</p>

## Try: Open the analysis (diff-drive, pure pursuit)
cfg: {"level":0,"set":{"ctl":"pp"}}
Setup: L1 as it starts: the diff-drive robot at 0.8 m/s with pure pursuit and a lookahead of $0.5 + 0.5\,v = 0.9$ m. The button opens the Analyze view on the lateral loop.
See: The gains read from the code are $K_e = 1.98$ and $K_\theta = 1.78$, and chapter 5 §2 predicts $2v/L_d^2 = 1.98$ and $2v/L_d = 1.78$. The crossover is 1.95 rad/s, the phase margin 62.7°, the gain margin 31 dB and the delay margin 0.56 s. The loop has $M_s = 1.05$, and the dominant poles have $\zeta = 0.71$ and a predicted overshoot of 4.3 %. On the Bode plot, the two integrators' slope of −40 dB/decade bends to −20 at the controller's zero.
Shows: This is a comfortable loop. It can take half a second of extra delay, it barely amplifies disturbances, and its poles are damped at $\zeta = 0.71$, which gives a 4.3 % overshoot. Each of these numbers moves in the lessons that follow. The lookahead sets the crossover, and the vehicle and its delays decide how much margin is left at that crossover.
Predict: How much extra delay will this loop absorb before it goes unstable?
- About one 50 ms tick
- About half a second
- Several seconds
Answer: 1

## Try: Same loop on the car
cfg: {"level":5,"set":{"ctl":"pp"}}
Setup: L6: the car at 0.6 m/s with pure pursuit and the level's shorter lookahead of $0.4 + 0.3\,v = 0.58$ m. The command is the steering angle, and the plant gain is $v_0/L = 1.0$.
See: The numbers are close to the diff-drive's: crossover 2.27 rad/s, phase margin 62.3°, delay margin 0.48 s and $\zeta = 0.71$. The steady error that a bias causes is different, 0.28 against 0.51 per unit of bias, because the car's command is an angle and the diff-drive's is a rate.
Shows: As long as the vehicle behaves as the two integrators, the loop changes little from one vehicle to the other. The vehicle changes the plant gain, which for the car is speed over wheelbase. It changes the actuator, which on the car is a steering angle with a rate limit instead of a turn rate. It also decides where the model stops being true. For the car, chapter 1 shows that this happens at speeds where the tyres decide the turn instead of the geometry.
Predict: Switching from the diff-drive to the car with the same pure pursuit: what happens to crossover and damping?
- Both change a lot: the car is a different plant
- Damping drops because the command is an angle, not a rate
- Roughly the same crossover and the same $\zeta \approx 0.71$
Answer: 2

## Code: Lparts, the loop in factors
snippet: loop-parts
focus: lat = Cx.exp(Cx.scale(s, -M.nL * M.T)); // hold delay T/2 on vehicle paths; latency on everything through the actuator
focus: const lag = M.tau > 0 ? Cx.div([M.aL, 0], Cx.sub(one, Cx.scale(zi, 1 - M.aL))) : one;
example: ctl/rwf
Note: Each block of the lesson's diagram is one factor here. The hold is $e^{-sT/2}$, the latency is $e^{-snT}$ and the actuator lag is a first-order discrete filter. These are multiplied with the plant and the controller's gains. Edit and run loads the rear-wheel-feedback example, which is the controller this loop is built on.

## Think about
Q: Why does feedback on $e$ alone oscillate for ever?
A: Two integrators with a proportional gain give $\ddot e = -K_e v\,e$, the equation of a mass on a spring with no damper. Its solution is a sinusoid that never decays. Feedback on $\theta_e = \dot e/v$ adds the damper. Every tracker has this term. In pure pursuit it comes from the geometry of the carrot, the lookahead point the robot steers towards.
Q: The hold delay is half a tick, 25 ms. Why half and not a whole tick?
A: A zero-order hold applies each command for the whole tick, so while it acts the command is on average 25 ms old. In the frequency domain that is a phase lag of $\omega T/2$, and the analysis uses that. The full tick shows up elsewhere. The controller sees a measurement that is already up to one tick old, which the latency slider adds on top.
Q: The gains are read by finite differences rather than from formulas. What does that buy?
A: It works the same way for every built-in tracker, including MPC and Stanley's arctangent. (A controller of your own from the Code tab runs as a black box in a worker, and the Analyze view does not linearize it.) It also reads the gains the code really has, saturations included, at the operating point the robot is at, which may be on a curve. The formulas in the chapters help you understand the loop. The chips report what the code does.

## Check yourself
Q: On a straight path at $v_0 = 10$ m/s the heading error is $\theta_e = 2°$ (use the small-angle model $\dot e = v_0\,\theta_e$ with $\theta_e$ in radians). How fast is the lateral error growing, in m/s?
Answer: 0.349
Tolerance: 0.01
Unit: m/s
How: $\theta_e = 2° = 0.0349$ rad; $\dot e = v_0\,\theta_e = 10 \times 0.0349 = 0.349$ m/s.
