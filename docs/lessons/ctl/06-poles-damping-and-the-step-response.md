group: ctl
title: Poles, damping and the step response

<p><b>Why this matters.</b> Margins say how far a loop is from instability; poles say what it does on the way there. The dominant closed-loop poles determine the overshoot, the settling time and the frequency of any ringing, and for a tracker those are what a passenger feels and what a lane-keeping specification is written in. Rear-wheel feedback has two gains that map directly onto the two pole parameters, which makes it the cleanest controller to learn this on.</p>
<p><b>The idea.</b> The closed-loop poles are where 1 + <i>L</i>(<i>s</i>) = 0, and the pair closest to the imaginary axis dominates the response. For a complex pair at −ζω<sub>n</sub> ± jω<sub>n</sub>√(1 − ζ²), the damping ratio ζ sets the overshoot and ζω<sub>n</sub> the settling rate. Rear-wheel feedback on the diff-drive, ignoring the small delay, is a mass-spring-damper: the lateral gain is the spring and the heading gain is the damper, so ω<sub>n</sub> = <i>v</i>₀√<i>k</i><sub>e</sub> and ζ = <i>k</i><sub>θ</sub>/(2√<i>k</i><sub>e</sub>). Keep <i>k</i><sub>e</sub> and turn <i>k</i><sub>θ</sub> and only the damping changes.</p>
<div class="eq">overshoot ≈ exp(−πζ / √(1−ζ²))       t_s(2%) ≈ 4 / (ζ·ω_n)
s² + v₀k_θ·s + v₀²k_e = 0   →   ω_n = v₀√k_e,   ζ = k_θ / (2√k_e)</div>
<p><b>Where it comes from.</b> Substituting the law ω = <i>v</i>(−<i>k</i><sub>θ</sub>θ<sub>e</sub> − <i>k</i><sub>e</sub><i>e</i>) into the two integrators gives ë + <i>v</i><i>k</i><sub>θ</sub>ė + <i>v</i>²<i>k</i><sub>e</sub><i>e</i> = 0, the standard second-order form; the overshoot and settling formulas are its step response evaluated at the first peak and at the 2 % envelope. <a class="chref" href="#notes=ch5/3-rear-wheel-feedback">The law and its Lyapunov argument: chapter 5 §3</a> · <a class="chref" href="#notes=ch6/5-poles-damping-and-the-shape-of-the-response">poles and the response: chapter 6 §5</a></p>
<p><b>What the lab does.</b> The poles come from the exact 20 Hz loop: each discrete pole <i>z</i> maps to <i>s</i> = ln <i>z</i>/<i>T</i>, so the delay is in them. The blue dots are the root locus, where the poles go if the controller's output is scaled from ×0.06 to ×16; where the locus enters the shaded right half plane, that scale factor is the gain margin. The step plot computes the response exactly rather than from the formulas, which the delay makes approximate; the step test then measures it in the simulator.</p>

## Try: k_θ = 1: light damping
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":1},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: Rear-wheel feedback with k_e = 6 and k_θ = 1 at 0.8 m/s, with a 0.2 m step test.
See: The formulas give ω_n = 0.8√6 = 1.96 rad/s and ζ = 1/(2√6) = 0.20; the exact poles have ζ = 0.18, the delay costing the rest. Predicted overshoot 56 %, measured 55 %; settling 10 s. Phase margin 20°, M_s = 2.9.
Shows: A spring with almost no damper. The response rings at about 2 rad/s for ten seconds, and M_s near 3 says a small model error would make it ring for ever. The poles chip and the Bode plot describe the same fact; the step plot makes it visible as a shape.
Predict: k_e = 6 with k_θ = 1: what overshoot will the step show?
- Around 10 %
- None: a low heading gain gives a slow, overdamped loop
- Around 55 %, ringing for about ten seconds
Answer: 2

## Try: k_θ = 3
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":3},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The same spring with the damper tripled.
See: ζ = 0.61 (formula: 3/(2√6) = 0.61), predicted overshoot 9.1 %, measured 8.9 %, settling 3 s. Phase margin 56°, M_s = 1.1. The dominant poles have moved left along an arc of roughly constant ω_n.
Shows: The same bandwidth with the damping where it should be. This is the setting most trackers end up near: 5 to 10 % overshoot, margins in the 50s. Note what did not change: ω_n is set by k_e and the speed, so the settling time improved because ζ did, not because the loop got faster.
Predict: Tripling the damper from k_θ = 1 to 3: what changes in the step?
- Overshoot drops under 10 %; ω_n barely moves
- The loop gets faster: ω_n rises with k_θ
- Overshoot unchanged; only the ringing frequency drops
Answer: 0

## Try: k_θ = 6: heavy damping
cfg: {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":6},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The damper doubled again.
See: The formula gives ζ = 1.22, overdamped; the exact poles are a real pair, ζ = 1 by convention, no overshoot measured, but the rise is slow, 2.3 s, and the settling 4.2 s is longer than at k_θ = 3. Phase margin 74°, crossover up to 4.9 rad/s because the heading feedback is now the loop's main term.
Shows: Past critical damping the response stops overshooting and starts dragging: one of the two real poles moves toward the origin and becomes the slow one. More damping is not more stability without limit; the crossover also rose, and with it the delay budget fell from 0.35 s to 0.26 s. The best settling is near ζ ≈ 0.7, which is where pure pursuit lives by construction.
Predict: Doubling the damper again to k_θ = 6: what happens to the settling time?
- It keeps improving: more damping, faster settling
- No overshoot, but settling is longer than at k_θ = 3
- The loop goes unstable from too much heading gain
Answer: 1

## Code: stepMetrics
snippet: step-metrics
focus: return {overshoot: Math.max(0, -mn) * 100, rise: t10 != null && t90 != null ? t10 - t90 : null, settle: ts, final: fin};
example: ctl/rwf
Note: Overshoot, rise and settling time are read off the response exactly as the lesson defines them: the deepest undershoot past zero, the time from 90 % to 10 % of the offset, the last moment the error was outside 2 cm. Edit and run: the rear-wheel-feedback example with the design row's gains.

## Think about
Q: The formula says ζ = 1.22 at k_θ = 6 but the chip says 1.0. Which is right?
A: Both, about different things. The formula is for the delay-free second-order model, where ζ > 1 means two distinct real poles. The exact discrete loop has those two real poles plus the delay's own dynamics; the chip reports the dominant pole and calls any real pole ζ = 1. Overdamped is overdamped either way; the number past 1 has no shape to describe.
Q: Why does the root locus use a gain scale of ×0.06 to ×16 rather than the gains themselves?
A: The locus asks one question: how do the poles move if the whole controller is scaled, which is what an unknown plant gain (tyres, a different speed) effectively does. Where the locus crosses into the right half plane is the gain margin as a factor. Scaling k_e and k_θ separately would be two loci and two questions.
Q: On the car, what plays the role of v₀²k_e?
A: The same spring, multiplied by the plant gain g = v₀/L: ω_n = v₀√(g k_e). The car's loop stiffens with speed faster than the diff-drive's, which is the subject of the gain-scheduling lesson and of chapter 1, where speed also changes the vehicle.

## Check yourself
Q: Rear-wheel feedback on the diff-drive at v₀ = 1 m/s with k_e = 4 and k_θ = 2: what is the 2 % settling time t_s ≈ 4/(ζ·ω_n), in seconds?
Answer: 4
Tolerance: 0.1
Unit: s
How: ω_n = v₀√k_e = 1 × 2 = 2 rad/s; ζ = k_θ/(2√k_e) = 2/4 = 0.5; t_s = 4/(0.5 × 2) = 4 s.
