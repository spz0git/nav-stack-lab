group: ctl
title: Pure pursuit is a PD controller

<p><b>Why this matters.</b> Pure pursuit is the most used path tracker in mobile robotics because it has one parameter and a geometric picture anyone can draw. What the picture hides is that it is a PD controller, proportional-derivative, with a fixed damping ratio, and that its one parameter, the lookahead, sets the bandwidth of the loop and nothing else. Once that is visible, every pure-pursuit tuning rule ("lengthen the lookahead if it oscillates") becomes a statement about crossover frequency and delay, and the limits of the method become predictable.</p>
<p><b>The idea.</b> The bearing to a carrot <i>L</i><sub>d</sub> ahead on the path is, for small errors, α ≈ −<i>e</i>/<i>L</i><sub>d</sub> − θ<sub>e</sub>: the lateral error seen from a distance <i>L</i><sub>d</sub>, plus the heading error. Pure pursuit commands the curvature 2 sin α/<i>L</i><sub>d</sub>, so linearized it is feedback on both errors with gains fixed by geometry, and the ratio of the two gains is fixed too. Substituting into the two-integrator plant gives a second-order loop whose damping ratio is 1/√2 for any lookahead and any speed. Without delay the phase margin would be 65.5° always; what the lookahead changes is the crossover, 2.2 <i>v</i>₀/<i>L</i><sub>d</sub>, and what delay then costs is ω<sub>c</sub>·<i>T</i><sub>d</sub> radians of that margin, so a short lookahead, a fast loop, loses more to the same delay.</p>
<div class="eq">ω = −(2v₀/L_d²)·e − (2v₀/L_d)·θₑ
L(s) = (2v₀²/L_d²) · (1 + s·L_d/v₀) / s² · e^(−sT_d)</div>
<p><b>Where it comes from.</b> The circle tangent to the heading through the carrot has curvature 2 sin α/<i>L</i> by the inscribed-angle theorem; the linearization of α gives the gains; solving |<i>L</i>(jω)| = 1 for the undelayed loop gives ω<sub>c</sub> = 2.2 <i>v</i>₀/<i>L</i><sub>d</sub> and the phase at crossover, 180° − 65.5°. <a class="chref" href="#notes=ch5/2-pure-pursuit">Geometry and gains: chapter 5 §2</a> · <a class="chref" href="#notes=ch6/2-pure-pursuit-is-a-pd-controller-in-disguise">the loop and its crossover: chapter 6 §2</a></p>
<p><b>What the lab does.</b> The lookahead is <i>L</i><sub>d</sub> = <i>L</i>₀ + <i>k</i>·<i>v</i>, two sliders in the Control tab; the buttons here set <i>k</i> = 0 so that <i>L</i>₀ alone is the lookahead. The car's δ ≈ 2<i>L</i>α/<i>L</i><sub>d</sub> with <i>g</i> = <i>v</i>₀/<i>L</i> gives the same loop. The step test shifts the path sideways by 0.2 m in the full simulator and overlays the measured response on the linear prediction.</p>

## Try: L<sub>0</sub> = 1.5 m (slow, calm)
cfg: {"level":0,"set":{"ctl":"pp","ppL0":1.5,"ppK":0}}
Setup: Lookahead fixed at 1.5 m, diff-drive at 0.8 m/s.
See: Crossover 1.17 rad/s (2.2 × 0.8/1.5 = 1.17), phase margin 63.9°, delay margin 0.95 s, M_s = 1.03, ζ = 0.71. The Bode magnitude crosses 0 dB low and the phase is still far from −180° there.
Shows: A long lookahead is a slow loop: it would take about 4 s to settle a step, and it corrects errors gently, cutting corners on a curvy path. In exchange it tolerates nearly a second of extra delay. The damping is the same 0.71 it always is.
Predict: Lengthening the lookahead to 1.5 m: what happens to the crossover and the delay margin?
- Crossover falls; delay margin grows to nearly a second
- Crossover rises; delay margin shrinks
- Crossover unchanged; only the damping changes
Answer: 0

## Try: L<sub>0</sub> = 0.1 m (fast)
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0}}
Setup: Lookahead fixed at 0.1 m: the carrot is almost under the robot.
See: Crossover 17.6 rad/s, fifteen times higher, and the delay has eaten the margin: phase margin 40.4°, gain margin 11 dB, delay margin 0.04 s, M_s = 1.65. The predicted overshoot is still only 4.6 % because the dominant poles still have ζ ≈ 0.7; what has changed is how close the loop is to its limit.
Shows: The 25 ms hold delay costs ω_c·T_d = 17.6 × 0.025 rad = 25° of phase at this crossover, against 1.7° in the slow loop (1.17 × 0.025 rad). The same controller, the same vehicle, the same damping by design, and a loop that any further 40 ms of delay would push unstable. Lookahead is not a comfort setting; it is the loop's bandwidth, and bandwidth is paid for in delay tolerance.
Predict: With the carrot 0.1 m ahead, what will the phase margin and the damping do?
- PM stays near 63° and ζ 0.71: lookahead only sets speed
- PM drops to about 40°, ζ still near 0.7
- The loop goes unstable from the hold delay alone
Answer: 1

## Try: Fast loop, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The step test on the fast loop (0.1 m lookahead): a 0.2 m sideways shift of the path, run in the full simulator.
See: The dashed amber measured response lands on the linear prediction: 2 % overshoot measured against 4.6 % predicted, rise 0.55 s, settled in 1.2 s. The two curves differ only where the turn-rate limit briefly clips the first command.
Shows: The linear model is a good model of the simulator for small signals, which is the whole justification for analyzing a nonlinear robot with Bode plots. The small-signal limit is tested in the linear-versus-nonlinear lesson; here, 0.2 m is small.
Predict: The 0.2 m step on the fast loop in the full simulator: how will the measured response compare with the prediction?
- It rings: the simulator has delays the model lacks
- Much slower: the turn-rate limit dominates
- It lands on the prediction, with a few per cent overshoot
Answer: 2

## Think about
Q: Pure pursuit has ζ = 0.71 regardless of settings. Where does that number come from?
A: From the ratio of the two geometric gains: K_θ/K_e = L_d, so ζ = K_θ/(2√(K_e v)) = (2v/L_d)/(2√(2v²/L_d²)) = 1/√2. The lookahead cancels. Rear-wheel feedback has two gains and so two knobs; pure pursuit has one and spends it on bandwidth.
Q: Why does the undelayed phase margin come out as exactly 65.5°?
A: Because L(jω) = K(1 + jωL_d/v)/(jω)² has phase −180° + atan(ωL_d/v), and at the crossover of this particular loop ωL_d/v = 2.2 for every setting, giving atan(2.2) = 65.5°. It is a property of the fixed gain ratio, not of the vehicle.
Q: A real vehicle at 15 m/s with a 10 m lookahead: what crossover and what delay budget?
A: ω_c ≈ 2.2 × 15/10 = 3.3 rad/s. With the undelayed margin of 65.5° and a typical 100 ms of sensing-to-actuation latency costing 0.33 rad = 19°, about 46° remain, a delay margin near 0.25 s. The same arithmetic as the fast loop here, at a different scale.

## Check yourself
Q: Pure pursuit at v₀ = 12 m/s with a lookahead L_d = 8 m: what is the crossover frequency ω_c ≈ 2.2 v₀/L_d, in rad/s?
Answer: 3.3
Tolerance: 0.07
Unit: rad/s
How: ω_c = 2.2 × 12/8 = 3.3 rad/s.
