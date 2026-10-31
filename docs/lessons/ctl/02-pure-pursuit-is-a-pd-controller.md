group: ctl
title: Pure pursuit is a PD controller

<p><b>Why this matters.</b> Pure pursuit is the most used path tracker in mobile robotics. It has one parameter, and its geometry is easy to draw. The drawing does not show that pure pursuit is a PD controller (proportional-derivative) with a fixed damping ratio. Its one parameter, the lookahead, sets the bandwidth of the loop and nothing else. With that in view, a tuning rule for pure pursuit such as "lengthen the lookahead if it oscillates" becomes a statement about crossover frequency and delay. You can also predict where the method stops working.</p>
<p><b>The idea.</b> Pure pursuit steers towards a point on the path a set distance ahead, called the carrot. For a carrot $L_d$ ahead and small errors, the bearing to it is $\alpha \approx -e/L_d - \theta_e$. That is the lateral error seen from a distance $L_d$, plus the heading error. Pure pursuit commands the curvature $2\sin\alpha/L_d$. Linearized, this is feedback on both errors with gains set by the geometry, so the ratio of the two gains is fixed as well. Put into the two-integrator plant, it gives a second-order loop whose damping ratio is $1/\sqrt2$ at any lookahead and any speed. Without delay the phase margin would always be 65.5°. The lookahead changes the crossover, which is $2.2\,v_0/L_d$. Delay then costs $\omega_c T_d$ radians of that margin. A short lookahead gives a fast loop, and a fast loop loses more margin to the same delay.</p>
$$\begin{aligned} \omega &= -\frac{2v_0}{L_d^2}\,e - \frac{2v_0}{L_d}\,\theta_e \\ L(s) &= \frac{2v_0^2}{L_d^2} \cdot \frac{1 + s\,L_d/v_0}{s^2} \cdot e^{-sT_d} \end{aligned}$$
<p><b>Where it comes from.</b> The circle that is tangent to the heading and passes through the carrot has curvature $2\sin\alpha/L$, by the inscribed-angle theorem. Linearizing $\alpha$ gives the gains. Solving $|L(j\omega)| = 1$ for the loop without delay gives $\omega_c = 2.2\,v_0/L_d$ and the phase at crossover, $180° - 65.5°$. <a class="chref" href="#notes=ch5/2-pure-pursuit">Geometry and gains: chapter 5 §2</a> · <a class="chref" href="#notes=ch6/2-pure-pursuit-is-a-pd-controller-in-disguise">the loop and its crossover: chapter 6 §2</a></p>
<p><b>What the lab does.</b> The lookahead is $L_d = L_0 + k\,v$, set by two sliders in the Control tab. The buttons here set $k = 0$, so that $L_0$ alone is the lookahead. On the car, $\delta \approx 2L\alpha/L_d$ with $g = v_0/L$ gives the same loop. The step test shifts the path sideways by 0.2 m in the full simulator and draws the measured response over the linear prediction.</p>

## Try: L<sub>0</sub> = 1.5 m (slow, calm)
cfg: {"level":0,"set":{"ctl":"pp","ppL0":1.5,"ppK":0}}
Setup: The lookahead is fixed at 1.5 m, and the diff-drive robot drives at 0.8 m/s.
See: The crossover is 1.17 rad/s ($2.2 \times 0.8/1.5 = 1.17$), the phase margin 63.9° and the delay margin 0.95 s, with $M_s = 1.03$ and $\zeta = 0.71$. The Bode magnitude crosses 0 dB at a low frequency, where the phase is still far from −180°.
Shows: A long lookahead makes a slow loop. It takes about 8 s to settle a step (7.8 s predicted, 7.85 s in the simulator), and it corrects errors gently, so it cuts corners on a curvy path. It also tolerates nearly a second of extra delay. The damping is 0.71, as it is at every lookahead.
Predict: Lengthening the lookahead to 1.5 m: what happens to the crossover and the delay margin?
- Crossover falls; delay margin grows to nearly a second
- Crossover rises; delay margin shrinks
- Crossover unchanged; only the damping changes
Answer: 0

## Try: L<sub>0</sub> = 0.1 m (fast)
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0}}
Setup: The lookahead is fixed at 0.1 m, so the carrot is almost under the robot.
See: The crossover is 17.6 rad/s, fifteen times higher, and the delay has used up much of the margin. The phase margin is 40.4°, the gain margin 11 dB and the delay margin 0.04 s, with $M_s = 1.65$. The predicted overshoot is still only 4.6 %, because the dominant poles still have $\zeta \approx 0.7$. What has changed is how close the loop is to its limit.
Shows: At this crossover the 25 ms hold delay costs $\omega_c T_d = 17.6 \times 0.025 = 0.44$ rad, or 25° of phase. In the slow loop it cost 1.7° ($1.17 \times 0.025 = 0.029$ rad). The controller, the vehicle and the designed damping are the same as before, and yet another 40 ms of delay would make this loop unstable. The lookahead sets the loop's bandwidth, and a higher bandwidth leaves less room for delay.
Predict: With the carrot 0.1 m ahead, what will the phase margin and the damping do?
- PM stays near 63° and $\zeta$ 0.71: lookahead only sets speed
- PM drops to about 40°, $\zeta$ still near 0.7
- The loop goes unstable from the hold delay alone
Answer: 1

## Try: Fast loop, step test
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0},"test":"step","stepKind":"offset","stepAmp":0.2}
Setup: The step test on the fast loop, with the 0.1 m lookahead. The path shifts 0.2 m sideways, and the full simulator runs the response.
See: The measured response (dashed amber) is much slower than the linear prediction. It rises in 0.55 s against 0.15 s, settles in 1.2 s against 0.45 s, and overshoots by 2 % against 4.6 %. The message under the plot reads "The turn-rate limit was active for 0.30 s of the test."
Shows: The gain is 160 rad/s of turn rate per metre of offset, so a 0.2 m step asks for 32 rad/s. The robot can turn at 1.8 rad/s. For the first 0.3 s the command stays at the limit, and the error closes only as fast as the limit allows, which is slower than the model assumes. The linear model describes the simulator for small signals, and how small they must be depends on the gains. The same 0.2 m step with L1's default lookahead lands on its prediction (rise 1.65 s against 1.7 s), while this loop saturates even at 5 cm. A fast loop has a small linear range as well as a small delay budget. The linear-versus-nonlinear lesson takes this further.
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
Note: The marked lines are the lookahead distance, the angle $\alpha$ to the carrot and the one-line pure-pursuit law, $\kappa = 2\sin\alpha / L$. Edit and run loads the pure-pursuit example. Set L (its lookahead) to 0.4 and then 1.6, and compare the runs. The Analyze view cannot linearize your code. To watch the lesson's PD gains change, set the built-in pure pursuit's $L_0$ to the same values in the Control tab, with $k = 0$.

## Think about
Q: Pure pursuit has $\zeta = 0.71$ regardless of settings. Where does that number come from?
A: It comes from the ratio of the two geometric gains, $K_\theta/K_e = L_d$, which gives $\zeta = \dfrac{K_\theta}{2\sqrt{K_e v}} = \dfrac{2v/L_d}{2\sqrt{2v^2/L_d^2}} = \dfrac{1}{\sqrt2}$. The lookahead cancels. Rear-wheel feedback has two gains, so you can set its damping and its bandwidth separately. Pure pursuit has one parameter, and it sets the bandwidth.
Q: Why is the phase margin without delay always 65.5°?
A: The loop $L(j\omega) = K\,(1 + j\omega L_d/v)/(j\omega)^2$ has phase $-180° + \operatorname{atan}(\omega L_d/v)$. At this loop's crossover, $\omega L_d/v = 2.2$ for every setting, which gives $\operatorname{atan}(2.2) = 65.5°$. The margin comes from the fixed ratio of the gains and does not depend on the vehicle.
Q: A real vehicle drives at 15 m/s with a 10 m lookahead. What are its crossover and its delay budget?
A: The crossover is $\omega_c \approx 2.2 \times 15/10 = 3.3$ rad/s, and the margin without delay is 65.5°. A typical 100 ms of latency from sensing to actuation costs 0.33 rad = 19°, so about 46° remain, which is a delay margin near 0.25 s. It is the same arithmetic as for the fast loop here, at a larger scale.

## Check yourself
Q: Pure pursuit runs at $v_0 = 12$ m/s with a lookahead $L_d = 8$ m. What is the crossover frequency $\omega_c \approx 2.2\,v_0/L_d$, in rad/s?
Answer: 3.3
Tolerance: 0.07
Unit: rad/s
How: $\omega_c = 2.2 \times 12/8 = 3.3$ rad/s.
