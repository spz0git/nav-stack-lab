group: ctl
title: The speed loop is open, except for MPC
extra: true

<p><b>Why this matters.</b> Everything so far was the lateral loop. Speed is the other axis, and in most of this lab it is not a loop at all: the trackers command a speed from a profile and nothing measures the actual speed and corrects the command. That is common on small robots, where a motor controller does the closing underneath, and it is worth seeing what the open chain looks like, because the actuator chain, latency, lag and acceleration limit, is the same one the lateral loop drives through. MPC is the exception: its model has speed as a state, so it closes a speed loop of its own, with margins of its own.</p>
<p><b>The idea.</b> Every path tracker here commands speed from a profile: cruise speed, slowed in curves by the lateral-acceleration cap, and ramped down toward the goal. The Speed plot shows the actuator chain following it: a delay $T_\text{lat}$, then a first-order lag $1/(\tau s + 1)$ with bandwidth about $1/\tau$ and a 10–90 % rise time of $2.2\tau$, then the acceleration limit. The MPC instead penalizes $(v - v_\text{ref})^2$ in its cost and commands acceleration, so the speed loop has gains the analysis can read, $K_v$ on the speed error, $K_{vc}$ on the commanded speed when the lag is modeled, $K_u$ on its previous acceleration, and the same crossover, margins and step response as the lateral loop.</p>
$$G(s) = \frac{e^{-sT_\text{lat}}}{\tau s + 1} \qquad \text{bandwidth} \approx 1/\tau, \quad \text{10–90\,\% rise} \approx 2.2\,\tau$$
<p>The MPC closes a loop through its rate input:</p>
$$a = -K_v\,(v - v_\text{ref}) - K_{vc}\,(v_\text{cmd} - v_\text{ref}) + K_u\,a_\text{prev}$$
<p>The speed profile, with $\kappa$ the curvature just ahead (for pure pursuit, its own):</p>
$$v_\text{ref} = \min\Bigl(v_\text{cruise},\ v_{\max},\ \sqrt{a_\text{lat}/|\kappa|},\ \sqrt{2a\,(d_\text{goal} - 0.08\ \text{m})}\Bigr)$$
<p><b>Where it comes from.</b> The first-order lag's step response is $1 - e^{-t/\tau}$; it reaches 10 % at $0.105\tau$ and 90 % at $2.3\tau$, hence $2.2\tau$ between them, and its magnitude falls to $1/\sqrt2$ at $\omega = 1/\tau$. <a class="chref" href="#notes=ch5/1-path-coordinates-and-the-speed-profile">The speed profile: chapter 5 §1</a> · <a class="chref" href="#notes=ch7/8-the-speed-loop">the MPC's speed loop: chapter 7 §8</a></p>
<p><b>What the lab does.</b> Switch the loop selector in the Analyze view to Speed. For pure pursuit the chips report the plant's bandwidth and time constant and the step test lands on the open-chain prediction. For MPC the loop has margins of its own, and the step test shows what its acceleration bound costs when the step is large. The speed step test raises the cruise speed by 0.2 m/s in the full simulator.</p>

## Try: Pure pursuit, τ = 0.3 s
cfg: {"level":0,"set":{"ctl":"pp","lag":0.3},"loop":"spd","test":"spdstep"}
Setup: Pure pursuit with a 0.3 s actuator lag; the Speed loop view and a 0.2 m/s speed step.
See: The chips report an open chain with bandwidth 3.38 rad/s, about the inverse of $\tau$, and no margins, because there is no loop. The step rises from 10 to 90 % in 0.65 s ($2.2 \times 0.3 = 0.66$) and settles in 1.2 s with no overshoot; the measured response lies on the prediction.
Shows: An open chain does what the actuator does: an exponential approach with the actuator's own time constant. Nothing can make it faster than $\tau$ allows, and nothing corrects it if the actuator is slow or biased. This is also a measurement of $\tau$: step the command, time the response, and the lag model for the MPC is identified.
Predict: A speed step through an open chain with $\tau = 0.3$ s: what will the chips and the step show?
- Margins like the lateral loop, and some overshoot
- No margins; a 10–90 % rise of about 0.65 s, no overshoot
- A rise of about 0.3 s, the time constant
Answer: 1

## Try: MPC with the lag modeled
cfg: {"level":0,"set":{"ctl":"mpc","lag":0.3,"mpcLag":true},"loop":"spd","test":"spdstep"}
Setup: The MPC on the same lagging actuator, lag in its model, Speed loop view, 0.2 m/s step.
See: Now there are margins: crossover 3.1 rad/s, phase margin 71°, delay margin 0.40 s, $M_s = 1.15$. The model's step rises in the same 0.65 s, overshoots 1 % and settles in 1.1 s; the simulator's is a little slower, 0.80 s to rise and 1.4 s to settle, with no overshoot.
Shows: A closed loop around the same actuator reaches the reference in the same time, because the actuator still sets the pace, but it is now a loop: a biased or slow actuator would be corrected, and the price is the usual one, margins to keep. The MPC's speed gains come from the same cost weights as its lateral gains, so $Q_v$ is where this loop is tuned.
Predict: The MPC closing a speed loop around the same actuator: how fast will the step rise compared with the open chain?
- Much faster: feedback beats the lag
- About the same, and now there are margins
- Much slower: the loop adds phase lag
Answer: 1

## Try: Latency 0.2 s
cfg: {"level":0,"set":{"ctl":"pp","lag":0.3,"latency":0.2},"loop":"spd","test":"spdstep"}
Setup: Pure pursuit with the lag and 0.2 s of control latency.
See: The same exponential, shifted right by 0.2 s: rise still 0.65 s, settling 1.4 s instead of 1.2. No margin chips, because an open chain has nothing to destabilize.
Shows: Latency in an open chain is just lateness. The same 0.2 s in the lateral loop would cost $0.2\,\omega_c$ radians of phase and could destabilize it; here it costs nothing but time. The difference is the feedback: delay is only dangerous inside a loop.
Predict: Adding 0.2 s of latency to the open speed chain: what happens?
- The response shifts right by 0.2 s and nothing else
- It overshoots, as delay in a loop does
- The 10–90 % rise time grows by 0.2 s
Answer: 0

## Code: spdParts, the speed loop
snippet: spd-parts
focus: const L = Cx.mul(pre, Cx.add(Cx.scale(zi, K.vc), Cx.scale(Cx.mul(G, zi), K.v))); // the controller sees v and its own command one tick later
Note: Only the MPC closes the speed loop; for every other controller the function returns the plant alone, which is the lesson. The MPC's loop reads its own last command and the measured speed one tick late, the two $z^{-1}$ factors.

## Think about
Q: Why do most small robots run speed open-loop at this level?
A: Because the motor controller underneath already closes a fast current and velocity loop at kilohertz rates, so from the navigation stack's point of view the actuator is a well-behaved first-order lag. The open chain here models that: what the navigation layer sees is the inner loop's response, not the motor.
Q: The MPC's speed loop and the open chain reach the reference in the same time. What did the loop buy?
A: Rejection: a slope, a load, a weak battery would slow the open chain and the loop would compensate; and consistency between speed and steering, since the MPC plans both together and the speed it predicts is the speed its lateral plan assumes. The step response alone does not show either; a disturbance would.
Q: How would you identify $\tau$ on a real vehicle?
A: Exactly as the first experiment: command a small speed step, log the measured speed, and fit $1 - e^{-t/\tau}$; the 10–90 % rise time divided by 2.2 is a quick estimate. Do it at several speeds and loads; if $\tau$ varies, the MPC model should carry the slowest value and the margin analysis the fastest.

## Check yourself
Q: The speed actuator is a first-order lag with $\tau = 0.45$ s and no delay. What is the 10–90 % rise time of its step response, in seconds?
Answer: 0.99
Tolerance: 0.02
Unit: s
How: rise $\approx 2.2\tau = 2.2 \times 0.45 = 0.99$ s.
