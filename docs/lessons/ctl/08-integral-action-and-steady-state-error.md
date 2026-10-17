group: ctl
title: Integral action and steady-state error

<p><b>Why this matters.</b> Real actuators are biased: a steering link a degree off centre, one motor a little weaker, a miscalibrated zero. A proportional-derivative loop reacts to such a bias by settling where the controller's output cancels it, which needs a standing error. For a lane-keeping controller that is a vehicle that drives steadily a few centimetres off the centre line, for ever. Integral action removes it, and the price it charges, phase, is the subject of the second half of this lesson. MPC gets the same effect from its structure, with a condition that is easy to miss.</p>
<p><b>The idea.</b> A constant actuator bias is a step disturbance at the plant input. With only proportional and derivative terms the loop settles where the controller output equals minus the bias, and the error that produces that output is <i>e</i><sub>ss</sub> = <i>d</i>/<i>K</i><sub>e</sub>: larger bias or softer gain, larger standing error. An integrator keeps adding to the command as long as the error is nonzero, so the only equilibrium is zero error. In the frequency domain the integrator is 1/<i>s</i>: infinite gain at zero frequency (which is what kills the steady error) and −90° of phase at low frequency, which eats margin if the integral gain is large enough to matter near the crossover. The MPC commands a rate and builds each command on its previous one, so it integrates its input and removes a bias it can see.</p>
<div class="eq">e_ss = d / K_e     (K_e: command per metre of lateral error)
PID tracker:  u = K_p·α + K_i·∫α dt + K_d·α̇,   α: bearing to the carrot,  ∫α dt clamped to ±1 rad·s
MPC:          u_k = u_{k−1} + u̇_k·Δt   (it commands a rate, so its command is an integral)</div>
<p><b>Where it comes from.</b> At steady state ė = θ̇<sub>e</sub> = 0, so the plant input must be zero: controller output + bias = 0, and with output −<i>K</i><sub>e</sub><i>e</i> that is <i>e</i> = <i>d</i>/<i>K</i><sub>e</sub>. With an integrator, a constant nonzero <i>e</i> would make the output grow without bound, so steady state requires <i>e</i> = 0. <a class="chref" href="#notes=ch6/5-poles-damping-and-the-shape-of-the-response">The bias response: chapter 6 §5</a> · <a class="chref" href="#notes=ch7/7-why-it-integrates">why the MPC integrates: chapter 7 §7</a> · <a class="chref" href="#notes=ch5/5-pid-on-the-bearing">the PID tracker: chapter 5 §5</a></p>
<p><b>What the lab does.</b> The response plot switches to the bias case here: the plotted quantity is the lateral error per unit of bias, so a final value of 0.28 means 28 % of the bias-response unit remains. The Vehicle tab has the same bias as a slider for normal runs: a steering misalignment in degrees for the car, a turn-rate offset in rad/s for the diff-drive. The MPC measures the diff-drive's turn rate directly; the car's steering encoder reads the angle before the misaligned link.</p>

## Try: Car, rear-wheel feedback, 2° bias
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"bias","test":"step"}
Setup: The car with rear-wheel feedback (k_e = 6, k_θ = 3) and a 2° steering misalignment, applied as a step.
See: The error rises to a peak of 0.30 and settles in 4 s at 0.28 of the bias unit: a standing offset that never goes away. The linear prediction and the measured response agree.
Shows: PD control at work: the loop is stable, well damped, and permanently off the path by d/K_e. On a real car this is the drift that the driver corrects by holding the wheel slightly off centre; a controller without integral action does the same, with the error instead of the wheel.
Predict: Rear-wheel feedback under a 2° misalignment: where will the error settle?
- At zero, after a transient
- At a standing offset that never goes away
- It drifts away: the bias wins
Answer: 1

## Try: Diff-drive MPC, 0.1 rad/s bias
cfg: {"level":0,"set":{"ctl":"mpc"},"stepKind":"bias","test":"step"}
Setup: The diff-drive with the MPC and a 0.1 rad/s turn-rate bias.
See: A transient peak of 0.24, then the error returns to within 0.2 % of zero in under 4 s. Phase margin 53°, unchanged by the bias.
Shows: The MPC's rate input integrates the bias away: it keeps asking for a little more counter-turn until the measured turn rate matches the plan, and because it measures the turn rate the bias is visible to it. No integral gain was tuned; the structure did it. The settling time is close to the step response's (3.85 s against 3.05 s for a 0.2 m offset), because the integration happens in the command, not through a slow extra pole.
Predict: The MPC, with no integral gain tuned, under a turn-rate bias: what residual will remain?
- Essentially zero: the rate input integrates it away
- The same d/K_e as a PD loop
- A slow creep lasting tens of seconds
Answer: 0

## Try: Car, PID with K_i = 0
cfg: {"level":5,"set":{"ctl":"pid","kp":2,"ki":0,"kd":0.15},"stepKind":"bias","test":"step"}
Setup: The car with PID on the bearing, proportional and derivative only, under the same 2° misalignment.
See: Peak 0.30, settled in 4.3 s at 0.29: the same standing error as rear-wheel feedback, because the proportional gain on the bearing plays the role of K_e. Phase margin 72°.
Shows: PD is PD whatever it is called. The 29 % residual is d/K_e for this controller's effective lateral gain; the only way to remove it without changing the gain is to add a term that keeps acting while the error stands.
Predict: PID on the bearing with K_i = 0 under the same 2° bias: how does its residual compare with rear-wheel feedback?
- Smaller: the bearing already encodes the heading
- Zero: the derivative term handles it
- About the same standing error, near 30 %
Answer: 2

## Try: Car, PID with K_i = 0.4
cfg: {"level":5,"set":{"ctl":"pid","kp":2,"ki":0.4,"kd":0.15},"stepKind":"bias","test":"step"}
Setup: K_i raised to 0.4.
See: The residual falls to 0.9 %, but the response is now a slow creep: peak 0.235, then a long tail that takes 16 s to settle within 2 %. Phase margin 66°, a few degrees lower, and a slow real pole has appeared near the origin.
Shows: The integrator removed the offset and added a slow mode: the integral has to wind up to the value that cancels the bias, and at k_i = 0.4 that takes a quarter of a minute. A larger k_i winds up faster and costs more phase at crossover; the usual compromise is to make the integral slow (tens of seconds) and accept the creep, or to use the MPC's structural integration, which has no such tail. Integral action only fixes what it can see: the car's steering misalignment is downstream of the steering encoder, so the MPC on the car settles at 0.71 of the bias unit, more than rear-wheel feedback's 0.28, where the diff-drive MPC leaves none.
Predict: Adding K_i = 0.4: what happens to the residual and the settling time?
- Residual under 1 %, settling stretches to tens of seconds
- Residual under 1 % at no cost in settling
- Residual halves; the loop rings from the lost phase
Answer: 0

## Code: ctlPID, the integral
snippet: pid
focus: C.I = clamp(C.I + err * DT, -1, 1); … C.prev = err;
example: ctl/pid
Note: The integral accumulates the heading error, clamped so that it cannot wind up without bound; the derivative is the error's change per tick. Edit and run: the PID example with Ki = 0 as shipped; set Ki to 0.3 and watch the steady-state error of the lesson disappear, then overshoot.

## Think about
Q: Why does the MPC on the car not remove the misalignment completely?
A: Its integrator acts on the steering it measures, and the encoder reads the angle before the misaligned link, so the measured steering is correct and the vehicle turns anyway. What it can still act on is the pose error, through its tracking terms, and those settle with a standing error: in the lab the car's MPC settles in 3.6 s at 0.71 of the bias unit, about 2.5 cm for 2°, more than rear-wheel feedback's 0.28. An integrator removes the bias it can observe; sensor placement decides which biases those are.
Q: Where does the slow tail at k_i = 0.4 come from?
A: From a new closed-loop pole near s = −k_i/k_p-ish, introduced by the integrator. The integral state must reach the value that cancels the bias, and it charges at a rate set by k_i times the error; small k_i means a slow charge. The pole is real and slow, so it adds a creep rather than a ring.
Q: A standing 28 % residual: in metres, what is that for a 2° misalignment at 0.6 m/s?
A: The bias unit is the lateral error per unit of actuator bias with the loop's gains; for this car and these gains 2° of steering is 0.28 × 0.035 rad, roughly 1 cm of standing offset (the chip "Left over from a 2° misalignment" reads 1.0 cm). Small, and permanent. At highway speed the same misalignment would be tens of centimetres, which is why every production lane-keeping loop has integral action or an explicit bias estimate.

## Check yourself
Q: A PD tracker with lateral gain K_e = 2.5 rad/s per metre faces a constant turn-rate bias d = 0.1 rad/s. What standing error does it settle at, in cm?
Answer: 4
Tolerance: 0.1
Unit: cm
How: e_ss = d/K_e = 0.1/2.5 = 0.04 m = 4 cm.
