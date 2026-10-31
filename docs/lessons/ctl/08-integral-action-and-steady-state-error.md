group: ctl
title: Integral action and steady-state error

<p><b>Why this matters.</b> Real actuators are biased. A steering link may sit a degree off centre, one motor may be a little weaker than the other, or a zero may be miscalibrated. A proportional-derivative loop settles where the controller's output cancels such a bias, and producing that output needs a standing error. For a lane-keeping controller, that means a vehicle that drives a few centimetres off the centre line for ever. Integral action removes the error. It costs phase, and the second half of this lesson measures how much. MPC gets the same effect from its structure, but only for a bias it can measure, and that condition is easy to miss.</p>
<p><b>The idea.</b> A constant actuator bias is a step disturbance at the plant input. With only proportional and derivative terms, the loop settles where the controller's output equals minus the bias. The error that produces that output is $e_\text{ss} = d/K_e$, so a larger bias or a softer gain gives a larger standing error. An integrator keeps adding to the command as long as the error is nonzero, so the loop can only come to rest at zero error. In the frequency domain the integrator is $1/s$. Its gain is infinite at zero frequency, and this removes the steady error. It also adds −90° of phase at low frequency, which reduces the margin if the integral gain is large enough to matter near the crossover. The MPC commands a rate and builds each command on the previous one. It therefore integrates its input, and removes any bias it can see.</p>
$$\begin{aligned} & && e_\text{ss} = d/K_e \quad (K_e\text{: command per metre of lateral error}) \\ &\text{PID tracker:} && u = k_p\,\alpha + k_i \textstyle\int \alpha\,dt + k_d\,\dot\alpha, \quad \alpha\text{: bearing to the carrot}, \quad \textstyle\int\alpha\,dt \text{ clamped to } \pm 1 \ \text{rad·s} \\ &\text{MPC:} && u_k = u_{k-1} + \dot u_k\,\Delta t \quad \text{(it commands a rate, so its command is an integral)} \end{aligned}$$
<p><b>Where it comes from.</b> At steady state $\dot e = \dot\theta_e = 0$, so the plant input must be zero. The controller's output plus the bias must then equal 0, and with an output of $-K_e e$ that gives $e = d/K_e$. With an integrator, a constant nonzero $e$ would make the output grow without bound, so a steady state needs $e = 0$. <a class="chref" href="#notes=ch6/5-poles-damping-and-the-shape-of-the-response">The bias response: chapter 6 §5</a> · <a class="chref" href="#notes=ch7/7-why-it-integrates">why the MPC integrates: chapter 7 §7</a> · <a class="chref" href="#notes=ch5/5-pid-on-the-bearing">the PID tracker: chapter 5 §5</a></p>
<p><b>What the lab does.</b> In this lesson the response plot shows the bias case. It plots the lateral error per unit of bias, so a final value of 0.28 means that 28 % of the bias-response unit remains. For normal runs, the Vehicle tab has the same bias as a slider: a steering misalignment in degrees for the car, and a turn-rate offset in rad/s for the diff-drive. The MPC measures the diff-drive's turn rate directly. On the car, the steering encoder reads the angle before the misaligned link, so it does not see the misalignment.</p>

## Try: Car, rear-wheel feedback, 2° bias
cfg: {"level":5,"set":{"ctl":"rwf"},"stepKind":"bias","test":"step"}
Setup: The car with rear-wheel feedback ($k_e = 6$, $k_\theta = 3$) and a 2° steering misalignment, applied as a step.
See: The error rises to a peak of 0.30 and settles in 4 s at 0.28 of the bias unit. This standing offset never goes away. The linear prediction and the measured response agree.
Shows: This is PD control. The loop is stable and well damped, and it stays off the path by $d/K_e$. On a real car this is the drift that a driver corrects by holding the wheel slightly off centre. A controller without integral action makes the same correction, but it needs a standing error to produce it.
Predict: Rear-wheel feedback under a 2° misalignment: where will the error settle?
- At zero, after a transient
- At a standing offset that never goes away
- It drifts away: the bias wins
Answer: 1

## Try: Diff-drive MPC, 0.1 rad/s bias
cfg: {"level":0,"set":{"ctl":"mpc"},"stepKind":"bias","test":"step"}
Setup: The diff-drive with the MPC and a 0.1 rad/s turn-rate bias.
See: In the simulator the error peaks at 0.24 (the linear prediction peaks at 0.12), then returns to within 0.2 % of zero in under 4 s. The phase margin is 53°, and the bias does not change it.
Shows: The MPC's rate input integrates the bias away. The MPC measures the turn rate, so it sees the bias, and it keeps asking for a little more counter-turn until the measured turn rate matches the plan. Nobody tuned an integral gain; the MPC's structure does the integrating. The settling time is close to that of the step response (3.85 s against 3.05 s for a 0.2 m offset), because the integration happens in the command and adds no slow pole.
Predict: The MPC, with no integral gain tuned, under a turn-rate bias: what residual will remain?
- Essentially zero: the rate input integrates it away
- The same $d/K_e$ as a PD loop
- A slow creep lasting tens of seconds
Answer: 0

## Try: Car, PID with k_i = 0
cfg: {"level":5,"set":{"ctl":"pid","kp":2,"ki":0,"kd":0.15},"stepKind":"bias","test":"step"}
Setup: The car with PID on the bearing, using only the proportional and derivative terms, under the same 2° misalignment.
See: The error peaks at 0.30 and settles in 4.3 s at 0.29. That is the same standing error as with rear-wheel feedback, because the proportional gain on the bearing plays the role of $K_e$. The phase margin is 72°.
Shows: With no integral gain, this PID is a PD controller, as rear-wheel feedback is. The 29 % residual is $d/K_e$ for this controller's effective lateral gain. To remove it without changing the gain, you have to add a term that keeps acting for as long as the error remains.
Predict: PID on the bearing with $k_i = 0$ under the same 2° bias: how does its residual compare with rear-wheel feedback?
- Smaller: the bearing already encodes the heading
- Zero: the derivative term handles it
- About the same standing error, near 30 %
Answer: 2

## Try: Car, PID with k_i = 0.4
cfg: {"level":5,"set":{"ctl":"pid","kp":2,"ki":0.4,"kd":0.15},"stepKind":"bias","test":"step"}
Setup: The same PID with $k_i$ raised to 0.4.
See: The residual falls to 0.9 %, but the response now creeps. It peaks at 0.235 and then has a long tail that takes 16 s to settle within 2 %. The phase margin is 66°, a few degrees lower, and a slow real pole has appeared near the origin.
Shows: The integrator removed the offset and added a slow mode. The integral has to wind up to the value that cancels the bias, and at $k_i = 0.4$ that takes a quarter of a minute. A larger $k_i$ winds up faster and costs more phase at crossover. The usual compromise is a slow integral (tens of seconds), with the creep accepted. The other option is the integration built into the MPC's structure, which has no such tail. Integral action only removes a bias it can see. The car's steering misalignment is downstream of the steering encoder, so the MPC on the car settles at 0.71 of the bias unit. That is more than rear-wheel feedback's 0.28, while the diff-drive MPC leaves no error at all.
Predict: Adding $k_i = 0.4$: what happens to the residual and the settling time?
- Residual under 1 %, settling stretches to tens of seconds
- Residual under 1 % at no cost in settling
- Residual halves; the loop rings from the lost phase
Answer: 0

## Code: ctlPID, the integral
snippet: pid
focus: C.I = clamp(C.I + err * DT, -1, 1); … C.prev = err;
example: ctl/pid
Note: The integral adds up the bearing error to the carrot and is clamped so that it cannot wind up without bound. The derivative is the error's change per tick. Edit and run loads the PID example, which ships with Ki = 0. Set Ki to 0.3 and watch the lesson's steady-state error disappear and then overshoot.

## Think about
Q: Why does the MPC on the car not remove the misalignment completely?
A: Its integrator acts on the steering it measures. The encoder reads the angle before the misaligned link, so the measured steering looks correct while the vehicle still turns. The MPC can still act on the pose error through its tracking terms, but those settle with a standing error. In the lab the car's MPC settles in 3.6 s at 0.71 of the bias unit, about 2.5 cm for 2°, more than rear-wheel feedback's 0.28. An integrator removes only the biases it can observe, and where the sensors sit decides which biases those are.
Q: Where does the slow tail at $k_i = 0.4$ come from?
A: The integrator adds a new closed-loop pole near $s \approx -k_i/k_p$, here −0.2. The integral state must reach the value that cancels the bias, and it fills at a rate set by $k_i$ times the error, so a small $k_i$ fills it slowly. The pole is real and slow, so it adds a creep and no ringing.
Q: The car's loop leaves a standing residual of 28 %. How many metres is that for a 2° misalignment at 0.6 m/s?
A: The bias unit is the lateral error per radian of actuator bias, with the loop's gains. A misalignment of 2° is 0.035 rad, so for this car and these gains the standing offset is $0.28 \times 0.035 \approx 0.01$ m, roughly 1 cm. The chip "Left over from a 2° misalignment" reads 1.0 cm. The offset is small, but it never goes away. At highway speed the same misalignment would leave tens of centimetres, so every production lane-keeping loop has integral action or an explicit estimate of the bias.

## Check yourself
Q: A PD tracker with lateral gain $K_e = 2.5$ rad/s per metre faces a constant turn-rate bias $d = 0.1$ rad/s. What standing error does it settle at, in cm?
Answer: 4
Tolerance: 0.1
Unit: cm
How: $e_\text{ss} = d/K_e = 0.1/2.5 = 0.04$ m = 4 cm.
