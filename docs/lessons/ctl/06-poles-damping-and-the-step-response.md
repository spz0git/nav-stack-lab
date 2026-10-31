group: ctl
title: Poles, damping and the step response

<p><b>Why this matters.</b> Margins say how far a loop is from instability, and poles say how it responds. The dominant closed-loop poles set the overshoot, the settling time and the frequency of any ringing. For a tracker, those are what a passenger feels, and a lane-keeping specification is written in them. Rear-wheel feedback has two gains that map directly onto the two pole parameters, so it is the easiest controller to learn this on.</p>
<p><b>The idea.</b> The closed-loop poles are where $1 + L(s) = 0$, and the pair closest to the imaginary axis dominates the response. For a complex pair at $-\zeta\omega_n \pm j\omega_n\sqrt{1 - \zeta^2}$, the damping ratio $\zeta$ sets the overshoot and $\zeta\omega_n$ sets the settling rate. If you ignore the small delay, rear-wheel feedback on the diff-drive is a mass-spring-damper. The lateral gain is the spring and the heading gain is the damper, so $\omega_n = v_0\sqrt{k_e}$ and $\zeta = k_\theta/(2\sqrt{k_e})$. If you keep $k_e$ and change $k_\theta$, only the damping changes.</p>
$$\text{overshoot} \approx \exp\!\left(-\frac{\pi\zeta}{\sqrt{1 - \zeta^2}}\right) \qquad\qquad t_s(2\,\%) \approx \frac{4}{\zeta\,\omega_n}$$
$$s^2 + v_0 k_\theta\,s + v_0^2 k_e = 0 \quad\longrightarrow\quad \omega_n = v_0\sqrt{k_e}, \qquad \zeta = \frac{k_\theta}{2\sqrt{k_e}}$$
<p><b>Where it comes from.</b> Putting the law $\omega = v\,(-k_\theta\theta_e - k_e e)$ into the two integrators gives $\ddot e + v k_\theta\,\dot e + v^2 k_e\,e = 0$, the standard second-order form. The overshoot and settling formulas come from its step response, evaluated at the first peak and at the 2 % envelope. <a class="chref" href="#notes=ch5/3-rear-wheel-feedback">The law and its Lyapunov argument: chapter 5 §3</a> · <a class="chref" href="#notes=ch6/5-poles-damping-and-the-shape-of-the-response">poles and the response: chapter 6 §5</a></p>
<p><b>What the lab does.</b> The poles come from the exact 20 Hz loop. Each discrete pole $z$ maps to $s = \ln z/T$, so the delay is included in them. The blue dots are the root locus, which shows where the poles go if the controller's output is scaled from ×0.06 to ×16. The scale factor at which the locus enters the shaded right half plane is the gain margin. The step plot computes the response from the exact loop instead of from the formulas, which the delay makes approximate. The step test then measures the response in the simulator.</p>

## Try: k_θ = 1: light damping
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":1},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: Rear-wheel feedback with $k_e = 6$ and $k_\theta = 1$ at 0.8 m/s, with a 0.2 m step test.
See: The formulas give $\omega_n = 0.8\sqrt6 = 1.96$ rad/s and $\zeta = 1/(2\sqrt6) = 0.20$. The exact poles have $\zeta = 0.18$, and the delay accounts for the difference. The predicted overshoot is 56 % and the measured one 55 %, and the response settles in 10 s. The phase margin is 20° and $M_s = 2.9$.
Shows: This is a spring with almost no damper. The response rings at about 2 rad/s for ten seconds. With $M_s$ near 3, a small error in the model would make it ring for ever. The poles chip and the Bode plot both describe this, and the step plot shows it as a shape.
Predict: $k_e = 6$ with $k_\theta = 1$: what overshoot will the step show?
- Around 10 %
- None: a low heading gain gives a slow, overdamped loop
- Around 55 %, ringing for about ten seconds
Answer: 2

## Try: k_θ = 3
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":3},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The same spring with the damper tripled.
See: The poles have $\zeta = 0.61$, and the formula gives $3/(2\sqrt6) = 0.61$. The predicted overshoot is 9.1 % and the measured one 8.9 %, and the response settles in 3 s. The phase margin is 56° and $M_s = 1.1$. The dominant poles have moved left along an arc of roughly constant $\omega_n$.
Shows: The bandwidth is the same, and the damping is now where it should be. Most trackers end up near this setting, with 5 to 10 % overshoot and phase margins in the 50s. The natural frequency $\omega_n$ did not change, because $k_e$ and the speed set it. The settling time improved because $\zeta$ improved, and the loop is no faster than before.
Predict: Tripling the damper from $k_\theta = 1$ to 3: what changes in the step?
- Overshoot drops under 10 %; $\omega_n$ barely moves
- The loop gets faster: $\omega_n$ rises with $k_\theta$
- Overshoot unchanged; only the ringing frequency drops
Answer: 0

## Try: k_θ = 6: heavy damping
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":6},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The damper is doubled again.
See: The formula gives $\zeta = 1.22$, which is overdamped. The exact poles are a real pair, shown as $\zeta = 1$ by convention. The step shows no overshoot, but the rise is slow, 2.3 s, and the settling time of 4.2 s is longer than at $k_\theta = 3$. The phase margin is 74°. The crossover is up to 4.9 rad/s, because the heading feedback is now the loop's main term.
Shows: Past critical damping the response stops overshooting and starts to drag. One of the two real poles moves towards the origin and becomes the slow one. The crossover also rose, and with it the delay budget fell from 0.35 s to 0.26 s, so the extra damping cost margin as well. Settling is fastest near $\zeta \approx 0.7$, which is where pure pursuit sits because of its geometry.
Predict: Doubling the damper again to $k_\theta = 6$: what happens to the settling time?
- It keeps improving: more damping, faster settling
- No overshoot, but settling is longer than at $k_\theta = 3$
- The loop goes unstable from too much heading gain
Answer: 1

## Code: stepMetrics
snippet: step-metrics
focus: return {overshoot: Math.max(0, -mn) * 100, rise: t10 != null && t90 != null ? t10 - t90 : null, settle: ts, final: fin};
example: ctl/rwf
Note: The code reads overshoot, rise and settling time off the response as the lesson defines them. Overshoot is how far the error goes past zero, at its deepest. Rise is the time from 90 % to 10 % of the offset. Settling is the last moment the error was outside 2 % of the offset. Edit and run loads the rear-wheel-feedback example with the design row's gains.

## Think about
Q: The formula says $\zeta = 1.22$ at $k_\theta = 6$ but the chip says 1.0. Which is right?
A: Both are right, about different things. The formula is for the second-order model without delay, where $\zeta > 1$ means two distinct real poles. The exact discrete loop has those two real poles plus the delay's own dynamics. The chip reports the dominant pole and shows any real pole as $\zeta = 1$. Both say the loop is overdamped. A value above 1 adds nothing that the shape of the response could show, since there is no overshoot left to describe.
Q: Why does the root locus use a gain scale of ×0.06 to ×16 rather than the gains themselves?
A: The locus shows how the poles move if the whole controller is scaled. An unknown plant gain, from the tyres or a different speed, has the same effect. The point where the locus crosses into the right half plane gives the gain margin as a factor. Scaling $k_e$ and $k_\theta$ separately would need two loci, each answering a different question.
Q: On the car, what plays the role of $v_0^2 k_e$?
A: The same spring, multiplied by the plant gain $g = v_0/L$, so $\omega_n = v_0\sqrt{g\,k_e}$. The car's loop stiffens with speed faster than the diff-drive's. The gain-scheduling lesson deals with that, and chapter 1 covers the other ways speed changes the vehicle.

## Check yourself
Q: Rear-wheel feedback runs on the diff-drive at $v_0 = 1$ m/s with $k_e = 4$ and $k_\theta = 2$. What is the 2 % settling time $t_s \approx 4/(\zeta\,\omega_n)$, in seconds?
Answer: 4
Tolerance: 0.1
Unit: s
How: $\omega_n = v_0\sqrt{k_e} = 1 \times 2 = 2$ rad/s; $\zeta = k_\theta/(2\sqrt{k_e}) = 2/4 = 0.5$; $t_s = 4/(0.5 \times 2) = 4$ s.
