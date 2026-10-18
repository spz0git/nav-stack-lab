group: ctl
title: Pure pursuit is a PD controller

<p><b>Why this matters.</b> Pure pursuit is the most used path tracker in mobile robotics because it has one parameter and a geometric picture anyone can draw. What the picture hides is that it is a PD controller, proportional-derivative, with a fixed damping ratio, and that its one parameter, the lookahead, sets the bandwidth of the loop and nothing else. Once that is visible, every pure-pursuit tuning rule ("lengthen the lookahead if it oscillates") becomes a statement about crossover frequency and delay, and the limits of the method become predictable.</p>
<p><b>The idea.</b> The bearing to a carrot $L_d$ ahead on the path is, for small errors, $\alpha \approx -e/L_d - \theta_e$: the lateral error seen from a distance $L_d$, plus the heading error. Pure pursuit commands the curvature $2\sin\alpha/L_d$, so linearized it is feedback on both errors with gains fixed by geometry, and the ratio of the two gains is fixed too. Substituting into the two-integrator plant gives a second-order loop whose damping ratio is $1/\sqrt2$ for any lookahead and any speed. Without delay the phase margin would be 65.5° always; what the lookahead changes is the crossover, $2.2\,v_0/L_d$, and what delay then costs is $\omega_c T_d$ radians of that margin, so a short lookahead, a fast loop, loses more to the same delay.</p>
$$\begin{aligned} \omega &= -\frac{2v_0}{L_d^2}\,e - \frac{2v_0}{L_d}\,\theta_e \\ L(s) &= \frac{2v_0^2}{L_d^2} \cdot \frac{1 + s\,L_d/v_0}{s^2} \cdot e^{-sT_d} \end{aligned}$$
<p><b>Where it comes from.</b> The circle tangent to the heading through the carrot has curvature $2\sin\alpha/L$ by the inscribed-angle theorem; the linearization of $\alpha$ gives the gains; solving $|L(j\omega)| = 1$ for the undelayed loop gives $\omega_c = 2.2\,v_0/L_d$ and the phase at crossover, $180° - 65.5°$. <a class="chref" href="#notes=ch5/2-pure-pursuit">Geometry and gains: chapter 5 §2</a> · <a class="chref" href="#notes=ch6/2-pure-pursuit-is-a-pd-controller-in-disguise">the loop and its crossover: chapter 6 §2</a></p>
<p><b>What the lab does.</b> The lookahead is $L_d = L_0 + k\,v$, two sliders in the Control tab; the buttons here set $k = 0$ so that $L_0$ alone is the lookahead. The car's $\delta \approx 2L\alpha/L_d$ with $g = v_0/L$ gives the same loop. The step test shifts the path sideways by 0.2 m in the full simulator and overlays the measured response on the linear prediction.</p>

## Try: L<sub>0</sub> = 1.5 m (slow, calm)
cfg: {"level":0,"set":{"ctl":"pp","ppL0":1.5,"ppK":0}}
Setup: Lookahead fixed at 1.5 m, diff-drive at 0.8 m/s.
See: Crossover 1.17 rad/s ($2.2 \times 0.8/1.5 = 1.17$), phase margin 63.9°, delay margin 0.95 s, $M_s = 1.03$, $\zeta = 0.71$. The Bode magnitude crosses 0 dB low and the phase is still far from −180° there.
Shows: A long lookahead is a slow loop: it takes about 8 s to settle a step (7.8 s predicted, 7.85 s in the simulator), and it corrects errors gently, cutting corners on a curvy path. In exchange it tolerates nearly a second of extra delay. The damping is the same 0.71 it always is.
Predict: Lengthening the lookahead to 1.5 m: what happens to the crossover and the delay margin?
- Crossover falls; delay margin grows to nearly a second
- Crossover rises; delay margin shrinks
- Crossover unchanged; only the damping changes
Answer: 0

## Try: L<sub>0</sub> = 0.1 m (fast)
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0}}
Setup: Lookahead fixed at 0.1 m: the carrot is almost under the robot.
See: Crossover 17.6 rad/s, fifteen times higher, and the delay has eaten the margin: phase margin 40.4°, gain margin 11 dB, delay margin 0.04 s, $M_s = 1.65$. The predicted overshoot is still only 4.6 % because the dominant poles still have $\zeta \approx 0.7$; what has changed is how close the loop is to its limit.
Shows: The 25 ms hold delay costs $\omega_c T_d = 17.6 \times 0.025 = 0.44$ rad, 25° of phase, at this crossover, against 1.7° in the slow loop ($1.17 \times 0.025 = 0.029$ rad). The same controller, the same vehicle, the same damping by design, and a loop that any further 40 ms of delay would push unstable. Lookahead is not a comfort setting; it is the loop's bandwidth, and bandwidth is paid for in delay tolerance.
Predict: With the carrot 0.1 m ahead, what will the phase margin and the damping do?
- PM stays near 63° and $\zeta$ 0.71: lookahead only sets speed
- PM drops to about 40°, $\zeta$ still near 0.7
- The loop goes unstable from the hold delay alone
Answer: 1

## Try: Fast loop, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The step test on the fast loop (0.1 m lookahead): a 0.2 m sideways shift of the path, run in the full simulator.
See: The dashed amber measured response is much slower than the linear prediction: rise 0.55 s against 0.15 s, settled in 1.2 s against 0.45 s, 2 % overshoot against 4.6 %. The message under the plot reads "The turn-rate limit was active for 0.30 s of the test."
Shows: At 160 rad/s of turn rate per metre of offset, a 0.2 m step asks for 32 rad/s, and the robot can turn at 1.8: for the first 0.3 s the command is pinned at the limit and the error closes at the rate the limit allows, not the rate the model assumes. The linear model is a model of the simulator for small signals, and "small" depends on the gains: the same 0.2 m step on the L1 default lookahead lands on its prediction (rise 1.65 s against 1.7 s), while this loop saturates even at 5 cm. A fast loop has a small linear range as well as a small delay budget. The linear-versus-nonlinear lesson takes this further.
Predict: The 0.2 m step on the fast loop in the full simulator: how will the measured response compare with the prediction?
- It rings: the simulator has delays the model lacks
- Much slower: the turn-rate limit dominates
- It lands on the prediction, with a few per cent overshoot
Answer: 1

## Code: ctlPP, the carrot and the curvature
snippet: pp
focus: const Ld = Math.max(0.1, P.ppL0 + P.ppK * Math.abs(S.odo.v)); … alpha = wrap(Math.atan2(dy, dx) - thv);
focus: const kap = (2 * Math.sin(alpha)) / L;
example: ctl/pp
Note: The look-ahead distance, the angle $\alpha$ to the carrot and the one-line pure-pursuit law, $\kappa = 2\sin\alpha / L$. Edit and run: the pure-pursuit example; make L (its look-ahead) 0.4 and then 1.6 and compare the runs. The Analyze view cannot linearize your code; to watch the PD gains of the lesson change, set the built-in pure pursuit's $L_0$ to the same values, with $k = 0$, in the Control tab.

## Think about
Q: Pure pursuit has $\zeta = 0.71$ regardless of settings. Where does that number come from?
A: From the ratio of the two geometric gains: $K_\theta/K_e = L_d$, so $\zeta = \dfrac{K_\theta}{2\sqrt{K_e v}} = \dfrac{2v/L_d}{2\sqrt{2v^2/L_d^2}} = \dfrac{1}{\sqrt2}$. The lookahead cancels. Rear-wheel feedback has two gains and so two knobs; pure pursuit has one and spends it on bandwidth.
Q: Why does the undelayed phase margin come out as exactly 65.5°?
A: Because $L(j\omega) = K\,(1 + j\omega L_d/v)/(j\omega)^2$ has phase $-180° + \operatorname{atan}(\omega L_d/v)$, and at the crossover of this particular loop $\omega L_d/v = 2.2$ for every setting, giving $\operatorname{atan}(2.2) = 65.5°$. It is a property of the fixed gain ratio, not of the vehicle.
Q: A real vehicle at 15 m/s with a 10 m lookahead: what crossover and what delay budget?
A: $\omega_c \approx 2.2 \times 15/10 = 3.3$ rad/s. With the undelayed margin of 65.5° and a typical 100 ms of sensing-to-actuation latency costing 0.33 rad = 19°, about 46° remain, a delay margin near 0.25 s. The same arithmetic as the fast loop here, at a different scale.

## Check yourself
Q: Pure pursuit at $v_0 = 12$ m/s with a lookahead $L_d = 8$ m: what is the crossover frequency $\omega_c \approx 2.2\,v_0/L_d$, in rad/s?
Answer: 3.3
Tolerance: 0.07
Unit: rad/s
How: $\omega_c = 2.2 \times 12/8 = 3.3$ rad/s.
