group: ctl
title: Curves: does the straight-line analysis hold?
extra: true

<p><b>Why this matters.</b> Every lesson so far linearized about a straight path. Paths have curves, and on a curve the controller works around a nonzero steering command, some trackers settle beside the path rather than on it, and the car runs into its steering-rate limit. The question is whether the Bode and Nyquist plots still mean anything there, and the answer, which this lesson checks experimentally, is yes, provided the gains are read about the right operating point.</p>
<p><b>The idea.</b> On a circle of radius <i>R</i> the robot must hold a steady turn rate <i>v</i>₀/<i>R</i>, and the deviations about that steady state are still two integrators: θ̇<sub>e</sub> = <i>g</i>(<i>u</i> − <i>u</i>₀), ė = <i>v</i>₀θ<sub>e</sub>. So the same Bode and Nyquist plots apply, with the gains read by finite differences about the settled state on the circle instead of on the straight. Pure pursuit measures its lookahead along the path, so it follows a circle exactly and its gains barely move. Rear-wheel feedback carries the curvature as feedforward and settles on the path too. Stanley and PID have no curvature feedforward; Stanley needs a standing cross-track error to hold the steady steering angle, and the Offset chip reports where it settles. The car on a 4 m circle also runs into its steering-rate limit during the step, which the message under the experiments reports.</p>
<div class="eq">θ̇_e = g·(u − u₀),   ė = v₀·θ_e     about the settled point on the circle</div>
<p><b>Where it comes from.</b> The Frenet equations with κ ≠ 0: θ̇<sub>e</sub> = ω − <i>v</i>κ cos θ<sub>e</sub>/(1 − κ<i>e</i>). At the settled point the controller's steady output cancels the curvature term; linearizing the remainder about that point gives the same two integrators with <i>u</i>₀ subtracted. <a class="chref" href="#notes=ch5/7-curves-the-operating-point-moves">Which trackers settle where: chapter 5 §7</a> · <a class="chref" href="#notes=ch6/1-the-vehicle-in-path-coordinates">the operating point in the loop model: chapter 6 §1</a></p>
<p><b>What the lab does.</b> The Curve R 4 m and Curve R 2 m buttons in the Analyze view change the operating point to a circle. The loop is settled on the circle before the gains are read, the Offset chip reports the steady lateral offset (positive inside the turn), and the step test is measured about that offset.</p>

## Try: Pure pursuit, R = 2 m
cfg: {"level":0,"set":{"ctl":"pp"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: Pure pursuit on the diff-drive, operating point a 2 m circle, 0.2 m step test.
See: Offset chip 0.0 cm. The gains read on the circle, K_e = 1.81 and K_θ = 1.75, are within 10 % of the straight-line 1.98 and 1.78; phase margin 63.8°, crossover 1.91 rad/s, essentially the straight-line loop. The step overshoots 5.2 % measured against 3.6 % predicted and settles in 4.6 s.
Shows: Pure pursuit on a circle is pure pursuit: the carrot is measured along the path, so the circle through it is the path's own circle and there is no standing error. The gains shift slightly because the geometry of the chord changes on a curve, and the analysis caught that by reading them where the loop actually sits.
Predict: Pure pursuit settled on a 2 m circle: what offset and gains will the analysis read?
- Zero offset, gains within about 10 % of the straight line
- A standing offset inside the turn and gains halved
- Zero offset, but the loop is much slower on the curve
Answer: 0

## Try: PID, R = 2 m
cfg: {"level":0,"set":{"ctl":"pid"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: PID on the bearing to the carrot (k_p = 2, k_d = 0.15, no integral), on the 2 m circle.
See: Phase margin 74°, crossover 2.2 rad/s, ζ = 0.75; the step overshoots 3.0 % measured against 2.9 % predicted and settles in 4.3 s. The offset chip reads zero: the standing steering comes from a standing bearing error to the carrot, which on a circle is inside the turn, not from a lateral offset.
Shows: A controller with no curvature feedforward can still sit on the path if its error signal itself encodes the curve, as the bearing to a carrot measured along the path does. The straight-line analysis holds here too, once the gains are read on the circle.
Predict: PID on the bearing, no curvature feedforward, on the circle: where will it settle?
- With a standing lateral offset, like Stanley
- On the path: the bearing to the carrot encodes the curve
- It cannot settle without an integrator
Answer: 1

## Try: Car, Stanley, R = 4 m
cfg: {"level":5,"set":{"ctl":"stanley"},"curveR":4,"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The car with Stanley on a 4 m circle.
See: The offset chip reads 4.5 cm inside the turn: Stanley holds the steady steering angle with a standing front-axle error. The loop about that point has 73° of phase margin and real dominant poles, no overshoot, rise 3.2 s, settling 5.8 s measured against 5.7 s predicted; the message reports the steering-rate limit active for about half a second at the start of the step.
Shows: A tracker without feedforward pays for the curve in offset, and the analysis still works about that offset. The slow, overdamped response is Stanley's character on this car at 0.6 m/s (k_soft dominates the denominator), and the saturation note is the one piece the linear model misses: a 0.2 m step on a 4 m circle asks for a steering rate the car does not have for the first half second.
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
Note: The path curvature 0.2 m ahead enters as feedforward, so on a curve the feedback terms only correct the residual; without that term the lesson's straight-line analysis would be all the controller has. Edit and run: the rear-wheel-feedback example; set k to 0 and drive L2's curves.

## Think about
Q: Why read the gains on the circle rather than reuse the straight-line ones?
A: Because the controller's law is nonlinear in the errors and the derivatives differ between operating points: pure pursuit's chord geometry, Stanley's arctangent, PID's bearing all have different local slopes on a curve. Finite differences at the settled point give the loop the controller actually closes there; the straight-line gains would be a guess that is 10 % off for pure pursuit and worse for the others.
Q: Which trackers would show an offset on a curve, and how big?
A: Any law whose steady steering must come from a standing error: Stanley (front-axle error), a pure lateral PD on e and θ_e without feedforward. The size is the steady steering angle divided by the lateral gain, δ₀/K_e in the car's units; rear-wheel feedback's feedforward and pure pursuit's carrot geometry supply δ₀ without an error, and an integrator would remove it slowly.
Q: The car saturated its steering rate on the 4 m circle. What does that imply for the planner?
A: That the planned curvature should leave steering authority in reserve, which is the 85 % rule in Hybrid A*: a path at the lock leaves nothing for the step, and a step is what every disturbance looks like to the tracker. Planning and control meet in the steering budget.

## Check yourself
Q: The diff-drive at v₀ = 1.2 m/s settles on a circle of radius R = 3 m. What steady turn rate u₀ = v₀/R must it hold, in rad/s?
Answer: 0.4
Tolerance: 0.01
Unit: rad/s
How: u₀ = v₀/R = 1.2/3 = 0.4 rad/s.
