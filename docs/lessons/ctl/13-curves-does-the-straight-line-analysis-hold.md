group: ctl
title: Curves: does the straight-line analysis hold?
level: 3
extra: true

<p><b>Why this matters.</b> Every lesson so far linearized about a straight path. Paths have curves, and on a curve three things change. The controller works around a nonzero steering command, some trackers settle beside the path instead of on it, and the car runs into its steering-rate limit. This lesson checks by experiment whether the Bode and Nyquist plots still mean anything on a curve. They do, as long as the gains are read about the right operating point.</p>
<p><b>The idea.</b> On a circle of radius $R$ the robot must hold a steady turn rate $v_0/R$. The deviations about that steady state are still two integrators, $\dot\theta_e = g\,(u - u_0)$ and $\dot e = v_0\theta_e$. The same Bode and Nyquist plots therefore apply. The gains are read by finite differences about the settled state on the circle, instead of on the straight. Pure pursuit measures its lookahead along the path, so it follows a circle exactly and its gains barely move. Rear-wheel feedback carries the curvature as feedforward and also settles on the path. Stanley and PID have no curvature feedforward. Stanley needs a standing cross-track error to hold the steady steering angle, and the Offset chip reports where it settles. The car on a 4 m circle also runs into its steering-rate limit during the step, and the message under the experiments reports it.</p>
$$\dot\theta_e = g\,(u - u_0), \qquad \dot e = v_0\,\theta_e \qquad \text{about the settled point on the circle}$$
<p><b>Where it comes from.</b> Start from the Frenet equations with $\kappa \ne 0$, where $\dot\theta_e = \omega - v\kappa\cos\theta_e/(1 - \kappa e)$. At the settled point the controller's steady output cancels the curvature term. Linearizing what remains about that point gives the same two integrators, with $u_0$ subtracted. <a class="chref" href="#notes=ch5/7-curves-the-operating-point-moves">Which trackers settle where: chapter 5 §7</a> · <a class="chref" href="#notes=ch6/1-the-vehicle-in-path-coordinates">the operating point in the loop model: chapter 6 §1</a></p>
<p><b>What the lab does.</b> The Curve R 4 m and Curve R 2 m buttons in the Analyze view change the operating point to a circle. The loop settles on the circle before the gains are read. The Offset chip reports the steady lateral offset (positive inside the turn), and the step test is measured about that offset.</p>

## Try: Pure pursuit, R = 2 m
cfg: {"level":0,"set":{"ctl":"pp"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: Pure pursuit on the diff-drive, with a 2 m circle as the operating point and a 0.2 m step test.
See: The Offset chip reads 0.0 cm. The gains read on the circle, $K_e = 1.81$ and $K_\theta = 1.75$, are within 10 % of the straight-line values 1.98 and 1.78. The phase margin is 63.8° and the crossover 1.91 rad/s, which is nearly the straight-line loop. The step overshoots by 5.2 %, against 3.6 % predicted, and settles in 4.6 s.
Shows: Pure pursuit behaves on a circle as it does on a straight. Its carrot (the lookahead point) is measured along the path, so the circle through it is the path's own circle, and there is no standing error. The gains shift slightly because the geometry of the chord changes on a curve. The analysis catches that because it reads them where the loop actually sits.
Predict: Pure pursuit settled on a 2 m circle: what offset and gains will the analysis read?
- Zero offset, gains within about 10 % of the straight line
- A standing offset inside the turn and gains halved
- Zero offset, but the loop is much slower on the curve
Answer: 0

## Try: PID, R = 2 m
cfg: {"level":0,"set":{"ctl":"pid"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: PID on the bearing to the carrot ($k_p = 2$, $k_d = 0.15$, no integral), on the 2 m circle.
See: The phase margin is 74°, the crossover 2.2 rad/s and $\zeta = 0.75$. The step overshoots by 3.0 %, against 2.9 % predicted, and settles in 4.3 s. The Offset chip reads zero. The standing steering comes from a standing bearing error to the carrot, which on a circle lies inside the turn. It does not come from a lateral offset.
Shows: A controller with no curvature feedforward can still sit on the path if its error signal carries the curve in it. The bearing to a carrot measured along the path does. The straight-line analysis holds here too, once the gains are read on the circle.
Predict: PID on the bearing, no curvature feedforward, on the circle: where will it settle?
- With a standing lateral offset, like Stanley
- On the path: the bearing to the carrot encodes the curve
- It cannot settle without an integrator
Answer: 1

## Try: Car, Stanley, R = 4 m
cfg: {"level":5,"set":{"ctl":"stanley"},"curveR":4,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The car with Stanley on a 4 m circle.
See: The Offset chip reads 4.5 cm inside the turn, because Stanley holds the steady steering angle with a standing front-axle error. The loop about that point has 73° of phase margin and real dominant poles. There is no overshoot, the rise takes 3.2 s, and settling takes 5.8 s against 5.7 s predicted. The message reports that the steering-rate limit was active for about half a second at the start of the step.
Shows: A tracker without feedforward holds a curve with an offset, and the analysis still works about that offset. The slow, overdamped response is how Stanley behaves on this car at 0.6 m/s, because $k_\text{soft}$ dominates the denominator. The linear model misses only the saturation note. For the first half second, a 0.2 m step on a 4 m circle asks for a faster steering rate than the car has.
Predict: Stanley on the 4 m circle: what will the Offset chip and the step show?
- Zero offset and a quick, underdamped step
- An offset outside the turn and ringing from the rate limit
- A few cm of offset inside the turn and a slow, overdamped step
Answer: 2

## Code: ctlRWF, the curvature feedforward
snippet: rwf
focus: const k = clamp(kapAt(pr.s + 0.2), -kmax, kmax); // fixed preview covers steering-rate lag
focus: const kc = (k * Math.cos(the)) / Math.max(0.3, 1 - k * el) - P.rwKth * the - P.rwKe * sinc * el;
example: ctl/rwf
Note: The path curvature 0.2 m ahead enters as feedforward, so on a curve the feedback terms only correct what is left. Without that term the controller would have only the feedback that the straight-line analysis describes. Edit and run loads the rear-wheel-feedback example. Set k to 0 and drive L2's curves.

## Think about
Q: Why read the gains on the circle rather than reuse the straight-line ones?
A: The controller's law is nonlinear in the errors, so its derivatives differ from one operating point to another. Pure pursuit's chord geometry, Stanley's arctangent and PID's bearing all have different local slopes on a curve. Finite differences at the settled point give the loop that the controller actually closes there. The straight-line gains would be 10 % off for pure pursuit and further off for the others.
Q: Which trackers would show an offset on a curve, and how big?
A: Any law whose steady steering has to come from a standing error. Stanley does (through the front-axle error), and so does a pure lateral PD on $e$ and $\theta_e$ without feedforward. The offset is the steady steering angle divided by the lateral gain, $\delta_0/K_e$ in the car's units. Rear-wheel feedback's feedforward and pure pursuit's carrot geometry supply $\delta_0$ without an error. An integrator would remove the offset slowly.
Q: The car saturated its steering rate on the 4 m circle. What does that imply for the planner?
A: The planned curvature should leave some steering in reserve, which is what the 85 % rule in Hybrid A* does. A path planned at full lock leaves nothing for a step, and to the tracker every disturbance looks like a step.

## Check yourself
Q: The diff-drive at $v_0 = 1.2$ m/s settles on a circle of radius $R = 3$ m. What steady turn rate $u_0 = v_0/R$ must it hold, in rad/s?
Answer: 0.4
Tolerance: 0.01
Unit: rad/s
How: $u_0 = v_0/R = 1.2/3 = 0.4$ rad/s.
