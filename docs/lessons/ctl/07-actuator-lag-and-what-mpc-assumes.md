group: ctl
title: Actuator lag, and what MPC assumes

<p><b>Why this matters.</b> Actuators take time to respond. A steering motor, a hydraulic valve or a motor controller with its own inner loop follows its command with a time constant. Like delay, that lag costs phase, by an amount that depends on the frequency. A model-based controller raises a further question: does its model include the lag? An MPC that believes its steering responds at once plans as if each command took effect immediately, and then reacts to the lagging actuator it measures. That costs robustness first, and tracking error only later. In this lesson you measure, as a margin, how much a controller loses when its model is wrong.</p>
<p><b>The idea.</b> A first-order actuator $1/(\tau s + 1)$ contributes magnitude $1/\sqrt{1 + \omega^2\tau^2}$ and phase $-\operatorname{atan}(\omega\tau)$. At $\omega = 2$ rad/s with $\tau = 0.15$ s, that is 17° of phase, a quarter of a typical margin. Pure pursuit loses that phase and nothing more. The MPC without the lag in its model does worse. Its gains were optimized for a plant that responds instantly, so they are too aggressive for the real one, and the linearized loop shows this. With the lag modeled, the MPC also feeds back its own commanded value (the $K_c$ gain in the block diagram). It can then anticipate what the actuator will do, and the margin comes back.</p>
<!-- math -->
<p>The equations below are as implemented. Here $u$ is the actuator's state (the speed, and the turn rate or the steering angle), and $u_\text{cmd}$ is its command after saturation. The acceleration and steering-rate limits act after the lag. The MPC's inputs are the rates $\dot u = (a,\ \text{rate of steering})$, applied over its 0.1 s step.</p>
$$\tau\,\dot u = u_\text{cmd} - u \quad\longrightarrow\quad \frac{1}{\tau s + 1}: \quad \text{magnitude } \frac{1}{\sqrt{1 + \omega^2\tau^2}}, \quad \text{phase } -\operatorname{atan}(\omega\tau)$$
$$\begin{aligned} &\text{simulator, every 50 ms:} && u \leftarrow u + (u_\text{cmd} - u)\bigl(1 - e^{-\Delta t/\tau}\bigr) \\ &\text{MPC, lag modeled:} && u_{k+1} = u_k + (u_{\text{cmd},k} - u_k)\bigl(1 - e^{-\Delta t/\tau}\bigr), \quad u_{\text{cmd},k+1} = u_{\text{cmd},k} + \dot u_k\,\Delta t \\ &\text{MPC, lag not modeled:} && u_{k+1} = u_k + \dot u_k\,\Delta t \quad \text{(each command takes effect at once)} \end{aligned}$$
<p><b>Where it comes from.</b> The lag is a pole at $s = -1/\tau$ in $L(s)$. The MPC's gains, including $K_c$, are read from the solver by finite differences at the operating point. The lag model adds the commanded steering as a state, which the MPC predicts through a first-order response. <a class="chref" href="#notes=ch7/2-the-prediction-model">The lag model: chapter 7 §2</a> · <a class="chref" href="#notes=ch7/6-what-the-analyze-view-sees">how the MPC becomes gains: §6</a> · <a class="chref" href="#notes=ch6/3-the-open-loop-l-s-with-the-clock-in-it">the lag in L(s): chapter 6 §3</a></p>
<!-- /math -->
<p><b>What the lab does.</b> The actuator lag $\tau$ is a slider in the Vehicle tab, and it applies to both speed and steering (turn rate). The MPC's "Include actuator lag" checkbox in the Control tab adds the lag to its prediction model. Margin and tracking performance are different things. Run L5 ($\tau = 0.15$ s) both ways: with the lag modeled the cross-track RMS does not improve, 8.1 cm against 5.8 cm without it at the default seed. The margin is what improves.</p>

## Try: Pure pursuit, τ = 0.15 s
cfg: {"level":0,"set":{"ctl":"pp","lag":0.15}}
Setup: Pure pursuit on the diff-drive with a 0.15 s actuator time constant.
See: The phase margin is 48.8°, against 62.7° without the lag. At the new crossover of 1.89 rad/s the lag costs $\operatorname{atan}(1.89 \times 0.15) = 15.8°$ of phase. The loop wins back 2° because the crossover slides down from 1.95 rad/s, and that leaves the 14° difference. The delay margin is down from 0.56 to 0.45 s, and $M_s$ is up from 1.05 to 1.32.
Shows: Lag costs phase as delay does, but the cost is bounded: little at low frequency and at most 90° at high frequency. Lag also attenuates, so the gain margin went up while the phase margin went down. A tracker with no model of its actuator just takes the loss, and its lookahead has to be chosen with the lag included.
Predict: A 0.15 s actuator lag on pure pursuit at about 1.9 rad/s: what happens to the two margins?
- Phase margin and gain margin both fall
- Nothing visible: 0.15 s is well below the 0.56 s delay margin
- Phase margin falls about 14°; gain margin rises
Answer: 2

## Try: MPC, τ = 0.15 s, lag not modeled
cfg: {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":false}}
Setup: The MPC on the same lagging vehicle, with a prediction model that assumes the actuator responds at once.
See: The phase margin is 29.7°, $M_s = 2.04$, the delay margin 0.16 s and the gain margin 19.7 dB. That is 19° of phase worse than pure pursuit on the same plant, and past the $M_s = 2$ line that marks a fragile loop.
Shows: The optimizer chose its gains for the wrong plant, a vehicle that steers at once. On a vehicle that takes 0.15 s to steer, the MPC commands, sees nothing happen and commands harder. Then the actuator catches up with all of it at once. In an easy run the tracking error looks fine. The margin says the loop would not survive another 160 ms of latency or a modest error in the model.
Predict: The MPC on the lagging vehicle with no lag in its model: how will its margin compare with pure pursuit on the same plant?
- Better: the optimizer compensates through feedback
- About the same: lag costs every controller the same phase
- Worse, with $M_s$ past 2
Answer: 2

## Try: MPC, τ = 0.15 s, lag modeled
cfg: {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":true}}
Setup: The same MPC with the lag included in its prediction model.
See: The phase margin is 52.8°, $M_s = 1.25$ and the delay margin 0.24 s. The block diagram now shows the $K_c$ feedback from the commanded steering, and the analysis reports a crossover of 3.9 rad/s.
Shows: With the right model the MPC is faster than pure pursuit (3.9 against 1.9 rad/s), and it has far more margin than the version without the lag (phase margin 52.8° against 29.7°, $M_s$ 1.25 against 2.04). The feedback on its own command makes the difference. The controller knows what it has already asked for, so it does not ask again. In model-based control the model is part of the controller, and the margins depend on the model as much as on the gains.
Predict: Adding the lag to the MPC's model: what will the analysis show?
- Margin recovers above 50° and the crossover is above pure pursuit's
- Margin recovers but the loop is slower than pure pursuit
- No change: the gains are the same, only the prediction differs
Answer: 0

## Code: mpcModel, the lag inside the prediction
snippet: mpc-model
focus: if (lag) { … o[6] = sat(x[6] + u[1] * dt);
Note: With the lag modelled, the state holds both the commanded and the actual speed and steering. The prediction moves the actual values towards the commanded ones with the vehicle's own time constant. Without the lag, the model assumes each command acts at once. The MPC has no code slot, because its QP solver is part of the page. The controller slot gets the same obs that the MPC gets.

## Think about
Q: Why does the gain margin improve with the lag while the phase margin worsens?
A: The lag attenuates. Its magnitude $1/\sqrt{1 + \omega^2\tau^2}$ falls at high frequency, so where the phase reaches −180° the magnitude is lower than before, and the gain margin is larger. The loss of phase at crossover is the cost, and the attenuation above crossover is a side benefit. Lag and pure delay differ here, since a delay attenuates nothing.
Q: On L5 the MPC without the lag in its model tracks no worse, 5.8 cm of cross-track RMS against 8.1 cm with it. Why prefer the one with the lag modeled?
A: Tracking error on a known plant in a simulator is the best case. The margin measures what happens on a plant that differs from the model. Every real plant does, through tyre wear, load, temperature and changes in the lag itself. A loop at $M_s = 2$ tracks well until the day the actuator is 30 % slower, and then it rings. A safety case is argued from the margin.
Q: What would the lag model need on a real vehicle?
A: It would need an identified time constant. You can measure one by stepping the command and timing the response, as the speed-loop lesson does. It would also need a check that the time constant stays the same, because hydraulic and electric steering lags change with load and temperature. If it varies, the MPC should model the slow end of the range and the margin analysis the fast end.

## Check yourself
Q: A first-order actuator has $\tau = 0.2$ s. How many degrees of phase does it cost at $\omega = 3$ rad/s?
Answer: 30.96
Tolerance: 0.6
Unit: °
How: phase $= \operatorname{atan}(\omega\tau) = \operatorname{atan}(3 \times 0.2) = \operatorname{atan}(0.6) = 30.96°$.
