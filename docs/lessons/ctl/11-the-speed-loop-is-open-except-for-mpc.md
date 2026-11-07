group: ctl
title: The speed loop is open, except for MPC
level: 3
extra: true

<p><b>Why this matters.</b> The lessons so far were about the lateral loop. Speed is the other axis, and in most of this lab there is no speed loop. The trackers command a speed from a profile, and nothing measures the actual speed to correct the command. This is common on small robots, where a motor controller underneath closes the loop. The open chain is still worth looking at, because its actuator chain (latency, lag and acceleration limit) is the same one the lateral loop drives through. MPC is the exception. Its model has speed as a state, so it closes a speed loop of its own, with its own margins.</p>
<p><b>The idea.</b> Every path tracker here commands speed from a profile. The profile starts at the cruise speed, slows down in curves to stay under the lateral-acceleration cap, and ramps down towards the goal. The Speed plot shows the actuator chain following it. The chain is a delay $T_\text{lat}$, then a first-order lag $1/(\tau s + 1)$, then the acceleration limit. The lag has a bandwidth of about $1/\tau$ and a 10–90 % rise time of $2.2\tau$. The MPC works differently. It penalizes $(v - v_\text{ref})^2$ in its cost and commands an acceleration, so its speed loop has gains the analysis can read. These are $K_v$ on the speed error, $K_{vc}$ on the commanded speed when the lag is modelled, and $K_u$ on its previous acceleration. The analysis gives this loop a crossover, margins and a step response, as it does the lateral loop.</p>
$$G(s) = \frac{e^{-sT_\text{lat}}}{\tau s + 1} \qquad \text{bandwidth} \approx 1/\tau, \quad \text{10–90\,\% rise} \approx 2.2\,\tau$$
<p>The MPC closes a loop through its rate input:</p>
$$a = -K_v\,(v - v_\text{ref}) - K_{vc}\,(v_\text{cmd} - v_\text{ref}) + K_u\,a_\text{prev}$$
<p>The speed profile is as follows, with $\kappa$ the curvature just ahead (for pure pursuit, its own):</p>
$$v_\text{ref} = \min\Bigl(v_\text{cruise},\ v_{\max},\ \sqrt{a_\text{lat}/|\kappa|},\ \sqrt{2a\,(d_\text{goal} - 0.08\ \text{m})}\Bigr)$$
<p><b>Where it comes from.</b> The first-order lag's step response is $1 - e^{-t/\tau}$. It reaches 10 % at $0.105\tau$ and 90 % at $2.3\tau$, so the rise between them takes $2.2\tau$. Its magnitude falls to $1/\sqrt2$ at $\omega = 1/\tau$. <a class="chref" href="#notes=ch5/1-path-coordinates-and-the-speed-profile">The speed profile: chapter 5 §1</a> · <a class="chref" href="#notes=ch7/8-the-speed-loop">the MPC's speed loop: chapter 7 §8</a></p>
<p><b>What the lab does.</b> Switch the loop selector in the Analyze view to Speed. For pure pursuit, the chips report the plant's bandwidth and time constant, and the step test lands on the open-chain prediction. For MPC the loop has margins of its own, and the step test shows how much its acceleration bound slows a large step. The speed step test raises the cruise speed by 0.2 m/s in the full simulator.</p>

## Try: Pure pursuit, τ = 0.3 s
cfg: {"level":0,"set":{"ctl":"pp","lag":0.3},"loop":"spd","test":"spdstep"}
Setup: Pure pursuit with a 0.3 s actuator lag, shown in the Speed loop view with a 0.2 m/s speed step.
See: The chips report an open chain with a bandwidth of 3.38 rad/s, about the inverse of $\tau$. There are no margins, because there is no loop. The step rises from 10 to 90 % in 0.65 s ($2.2 \times 0.3 = 0.66$) and settles in 1.2 s with no overshoot. The measured response lies on the prediction.
Shows: An open chain does what the actuator does, which is an exponential approach with the actuator's own time constant. Nothing can make it faster than $\tau$ allows, and nothing corrects it if the actuator is slow or biased. The same test also measures $\tau$. You step the command and time the response, and that gives the lag for the MPC's model.
Predict: A speed step through an open chain with $\tau = 0.3$ s: what will the chips and the step show?
- Margins like the lateral loop, and some overshoot
- No margins; a 10–90 % rise of about 0.65 s, no overshoot
- A rise of about 0.3 s, the time constant
Answer: 1

## Try: MPC with the lag modeled
cfg: {"level":0,"set":{"ctl":"mpc","lag":0.3,"mpcLag":true},"loop":"spd","test":"spdstep"}
Setup: The MPC on the same lagging actuator, with the lag in its model, in the Speed loop view with a 0.2 m/s step.
See: Now there are margins. The crossover is 3.1 rad/s, the phase margin 71°, the delay margin 0.40 s and $M_s = 1.15$. The model's step rises in the same 0.65 s, overshoots by 1 % and settles in 1.1 s. The simulator's step is a little slower, with 0.80 s to rise and 1.4 s to settle, and has no overshoot.
Shows: A closed loop around the same actuator reaches the reference in the same time, because the actuator still sets the pace. The difference is that a biased or slow actuator would now be corrected. In return the loop has margins that must be kept. The MPC's speed gains come from the same cost weights as its lateral gains, and this loop is tuned with $Q_v$.
Predict: The MPC closing a speed loop around the same actuator: how fast will the step rise compared with the open chain?
- Much faster: feedback beats the lag
- About the same, and now there are margins
- Much slower: the loop adds phase lag
Answer: 1

## Try: Latency 0.2 s
cfg: {"level":0,"set":{"ctl":"pp","lag":0.3,"latency":0.2},"loop":"spd","test":"spdstep"}
Setup: Pure pursuit with the lag and 0.2 s of control latency.
See: The same exponential, shifted right by 0.2 s. The rise still takes 0.65 s, and settling takes 1.4 s instead of 1.2. There are no margin chips, because an open chain has nothing to destabilize.
Shows: In an open chain, latency only makes the response late. The same 0.2 s in the lateral loop would cost $0.2\,\omega_c$ radians of phase and could destabilize it. Here it costs only time, because there is no feedback for the delay to act on.
Predict: Adding 0.2 s of latency to the open speed chain: what happens?
- The response shifts right by 0.2 s and nothing else
- It overshoots, as delay in a loop does
- The 10–90 % rise time grows by 0.2 s
Answer: 0

## Code: spdParts, the speed loop
snippet: spd-parts
focus: const L = Cx.mul(pre, Cx.add(Cx.scale(zi, K.vc), Cx.scale(Cx.mul(G, zi), K.v))); // the controller sees v and its own command one tick later
Note: Only the MPC closes the speed loop. For every other controller the function returns the plant alone, with no loop around it. The MPC's loop reads its own last command and the measured speed one tick late, and these are the two $z^{-1}$ factors.

## Think about
Q: Why do most small robots run speed open-loop at this level?
A: The motor controller underneath already closes fast current and velocity loops at kilohertz rates. Seen from the navigation stack, the actuator is then a well-behaved first-order lag. The open chain here models that. What the navigation layer sees is the response of the inner loop, not of the motor itself.
Q: The MPC's speed loop and the open chain reach the reference in the same time. What did the loop buy?
A: It bought two things. The first is disturbance rejection. A slope, a load or a weak battery would slow the open chain, and the loop would make up for it. The second is consistency between speed and steering. The MPC plans both together, so the speed it predicts is the speed its lateral plan assumes. The step response alone shows neither; you would need a disturbance to see them.
Q: How would you identify $\tau$ on a real vehicle?
A: As in the first experiment. Command a small speed step, log the measured speed, and fit $1 - e^{-t/\tau}$. For a quick estimate, divide the 10–90 % rise time by 2.2. Repeat this at several speeds and loads. If $\tau$ varies, give the MPC's model the slowest value and use the fastest in the margin analysis.

## Check yourself
Q: The speed actuator is a first-order lag with $\tau = 0.45$ s and no delay. What is the 10–90 % rise time of its step response, in seconds?
Answer: 0.99
Tolerance: 0.02
Unit: s
How: Rise time $\approx 2.2\tau = 2.2 \times 0.45 = 0.99$ s.
