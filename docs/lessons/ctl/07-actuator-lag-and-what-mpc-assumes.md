group: ctl
title: Actuator lag, and what MPC assumes

<p><b>Why this matters.</b> Actuators are not instantaneous. A steering motor, a hydraulic valve, a motor controller with its own inner loop: each follows its command with a time constant, and that lag costs phase exactly like delay does, frequency by frequency. For a model-based controller the question is sharper: does the controller's model include the lag? An MPC that believes its steering is instantaneous plans as if its commands took effect at once and then reacts to the lagging actuator it measures, and the cost is paid in robustness before it is paid in tracking error. This lesson is the first place in the lab where "the controller is only as good as its model" is a number.</p>
<p><b>The idea.</b> A first-order actuator 1/(τ<i>s</i> + 1) contributes magnitude 1/√(1 + ω²τ²) and phase −atan(ωτ): at ω = 2 rad/s with τ = 0.15 s that is 17° of phase, a quarter of a typical margin. Pure pursuit simply loses that phase. The MPC without the lag in its model does worse than losing phase: its gains were optimized for a plant that responds instantly, so they are too aggressive for the real one, and the linearized loop shows it. With the lag modeled the MPC also feeds back its own commanded value (the <i>K</i><sub>c</sub> gain in the block diagram), anticipating what the actuator will do, and the margin comes back.</p>
<p>As implemented, with <i>u</i> the actuator's state (the speed, and the turn rate or the steering angle) and <i>u</i><sub>cmd</sub> its command after saturation; the acceleration and steering-rate limits act after the lag. The MPC's inputs are the rates <i>u̇</i> = (<i>a</i>, rate of steering), applied over its 0.1 s step.</p>
<div class="eq">τ·u̇ = u_cmd − u   →   1/(τs + 1):   magnitude 1/√(1 + ω²τ²),   phase −atan(ωτ)
simulator, every 50 ms:  u ← u + (u_cmd − u)·(1 − e^(−Δt/τ))
MPC, lag modeled:        u_{k+1} = u_k + (u_cmd,k − u_k)·(1 − e^(−Δt/τ)),   u_cmd,k+1 = u_cmd,k + u̇_k·Δt
MPC, lag not modeled:    u_{k+1} = u_k + u̇_k·Δt   (each command takes effect at once)</div>
<p><b>Where it comes from.</b> The lag is a pole at <i>s</i> = −1/τ in <i>L</i>(<i>s</i>); the MPC's gains, including <i>K</i><sub>c</sub>, are read from the solver by finite differences at the operating point, and the lag model adds the commanded steering as a state the MPC predicts through a first-order response. <a class="chref" href="#notes=ch7/2-the-prediction-model">The lag model: chapter 7 §2</a> · <a class="chref" href="#notes=ch7/6-what-the-analyze-view-sees">how the MPC becomes gains: §6</a> · <a class="chref" href="#notes=ch6/3-the-open-loop-l-s-with-the-clock-in-it">the lag in L(s): chapter 6 §3</a></p>
<p><b>What the lab does.</b> The actuator lag τ is a Vehicle-tab slider and applies to both speed and steering (turn rate). The MPC's "Include actuator lag" checkbox in the Control tab adds the lag to its prediction model. Margin and tracking performance are different things: run L5 both ways and the cross-track RMS barely changes; what changes is the margin.</p>

## Try: Pure pursuit, τ = 0.15 s
cfg: {"level":0,"set":{"ctl":"pp","lag":0.15}}
Setup: Pure pursuit on the diff-drive with a 0.15 s actuator time constant.
See: Phase margin 48.8° against 62.7° without the lag: the 14° difference is the lag's phase at the crossover, atan(1.89 × 0.15) = 15.8° at 1.89 rad/s, less the 2° the loop wins back because the crossover slides down from 1.95 rad/s. Delay margin down from 0.56 to 0.45 s, M_s up from 1.05 to 1.32.
Shows: Lag is delay-like but frequency dependent: it costs little at low frequency and up to 90° at high, and it also attenuates, which is why the gain margin went up while the phase margin went down. A tracker with no model of its actuator simply absorbs the loss, and the lookahead has to be chosen with the lag included.
Predict: A 0.15 s actuator lag on pure pursuit at about 1.9 rad/s: what happens to the two margins?
- Phase margin and gain margin both fall
- Nothing visible: 0.15 s is well below the 0.56 s delay margin
- Phase margin falls about 14°; gain margin rises
Answer: 2

## Try: MPC, τ = 0.15 s, lag not modeled
cfg: {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":false}}
Setup: The MPC on the same lagging vehicle, with its prediction model assuming an instantaneous actuator.
See: Phase margin 29.7°, M_s = 2.04, delay margin 0.16 s, gain margin 19.7 dB. Worse than pure pursuit on the same plant by 19° of phase, and past the M_s = 2 line that marks a fragile loop.
Shows: The optimizer did its job on the wrong plant. It chose gains for a vehicle that steers at once, which on a vehicle that steers over 0.15 s means it commands, sees nothing happen, commands harder, and then the actuator catches up with everything at once. The tracking error in a benign run looks fine; the margin says it would not survive an extra 160 ms of latency or a modest model error.
Predict: The MPC on the lagging vehicle with no lag in its model: how will its margin compare with pure pursuit on the same plant?
- Better: the optimizer compensates through feedback
- About the same: lag costs every controller the same phase
- Worse, with M_s past 2
Answer: 2

## Try: MPC, τ = 0.15 s, lag modeled
cfg: {"level":0,"set":{"ctl":"mpc","lag":0.15,"mpcLag":true}}
Setup: The same MPC with the lag included in its prediction model.
See: Phase margin 52.8°, M_s = 1.25, delay margin 0.24 s. The block diagram now shows the K_c feedback from the commanded steering, and the analysis reports a crossover of 3.9 rad/s.
Shows: With the right model the MPC is both faster than pure pursuit (3.9 against 1.9 rad/s) and better damped than the unmodeled version. The feedback on its own command is the mechanism: the controller knows what it has already asked for and does not ask again. This is the general lesson of model-based control: the model is part of the controller, and the margins measure the model as much as the gains.
Predict: Adding the lag to the MPC's model: what will the analysis show?
- Margin recovers above 50° and the crossover is above pure pursuit's
- Margin recovers but the loop is slower than pure pursuit
- No change: the gains are the same, only the prediction differs
Answer: 0

## Think about
Q: Why does the gain margin improve with the lag while the phase margin worsens?
A: The lag attenuates: its magnitude 1/√(1 + ω²τ²) falls at high frequency, so where the phase reaches −180° the magnitude is lower than before, which is a larger gain margin. The phase loss at crossover is the cost; the attenuation above crossover is a side benefit. Lag and pure delay differ exactly here, since delay attenuates nothing.
Q: The cross-track error barely changes between the two MPC runs. Why worry?
A: Because tracking error on a known plant in a simulator is the best case. Margin measures what happens on a plant that differs from the model, which every real plant does, by tyre wear, load, temperature and the lag itself changing. A loop at M_s = 2 tracks fine until the day the actuator is 30 % slower, and then it rings. Margin is what a safety case is written in.
Q: What would the lag model need on a real vehicle?
A: An identified time constant, which can be measured by stepping the command and timing the response (the speed-loop lesson does exactly this), and a check that it is constant: hydraulic and electric steering lags change with load and temperature. If it varies, the MPC should model the slow end and the margin analysis the fast one.

## Check yourself
Q: A first-order actuator with τ = 0.2 s: how many degrees of phase does it cost at ω = 3 rad/s?
Answer: 30.96
Tolerance: 0.6
Unit: °
How: phase = atan(ωτ) = atan(3 × 0.2) = atan(0.6) = 30.96°.
