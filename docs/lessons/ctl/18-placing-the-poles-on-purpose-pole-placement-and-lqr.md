group: ctl
title: Placing the poles on purpose: pole placement and LQR
extra: true

<p><b>Why this matters.</b> Every control lesson so far tuned by turning a knob and reading the chips. That works for one knob. Rear-wheel feedback has two, and with two gains the two-integrator loop can be given any pole pair at all, which raises the real engineering question: which pair, and why. The two textbook answers are pole placement, where you name the pair and solve for the gains, and the linear-quadratic regulator, where you name a cost, tracking error against steering effort, and the pair follows. Both solve in closed form here, both are one click under the pole plot, and both ignore the delays, which is the point of trying them in this lab.</p>
<p><b>The idea.</b> The delay-free loop with the two gains is $s^2 + gK_\theta s + g v_0 K_e = 0$, a second-order polynomial whose two coefficients the two gains set directly. Ask for damping $\zeta$ and natural frequency $\omega_n$ and the gains fall out by matching coefficients; that is pole placement, exact and instant. LQR instead minimizes a quadratic cost: how much offset, how much heading error, how much steering, each with a weight. For this plant the Riccati equation it leads to has a closed-form solution, and the gains come out as square roots of the weight ratios. The surprise is what LQR does with the damping: with no weight on the heading error it lands on $\zeta = 1/\sqrt2$ whatever else you ask for, the same number pure pursuit is stuck with, and making control cheap raises the speed of the loop only like the fourth root of the weight ratio.</p>
<p>Pole placement:</p>
$$K_e = \frac{\omega_n^2}{g v_0}, \qquad K_\theta = \frac{2\zeta\omega_n}{g}$$
<p>LQR with $J = \int (q_e e^2 + q_\theta \theta_e^2 + r u^2)\,dt$:</p>
$$K_e = \sqrt{q_e/r}, \qquad K_\theta = \sqrt{\frac{q_\theta}{r} + \frac{2v_0\sqrt{q_e/r}}{g}}$$
<p>Then $\omega_n = \sqrt{g v_0 K_e}$ and $\zeta = gK_\theta/(2\omega_n)$; with $q_\theta = 0$, $\zeta = 1/\sqrt2$.</p>
<p><b>Where it comes from.</b> Placement is coefficient matching against $s^2 + 2\zeta\omega_n s + \omega_n^2$; LQR is the $2 \times 2$ algebraic Riccati equation written out as three scalar equations, which solve one after the other. <a class="chref" href="#notes=ch6/8-placing-the-poles-on-purpose-pole-placement-and-lqr">Derivation: chapter 6 §8</a></p>
<p><b>What the lab does.</b> The design row under the pole plot takes either $(\zeta, \omega_n)$ or $(q_e, q_\theta, r)$ and shows the result as a what-if: the pair you asked for, the textbook gains that ignore the delays, and the gains the full loop (hold, latency, lag) actually needs to put the pair there, which the plot and the response show. Apply writes those gains as rear-wheel feedback's $k_e$ and $k_\theta$. The buttons below open L1 with rear-wheel feedback at 0.8 m/s, whose own tuning sits at $\zeta$ 0.61, $\omega_n$ about 2 rad/s, 9 % overshoot and a 353 ms delay margin.</p>

## Try: Place the pair at ζ 0.7, ω_n 1.5 rad/s
cfg: {"level":0,"set":{"ctl":"rwf"},"place":{"zeta":0.7,"wn":1.5}}
Setup: L1, rear-wheel feedback, and a placement at $\zeta$ 0.7, $\omega_n$ 1.5 rad/s: a gentle, slightly slower loop than the default.
See: The textbook gains are $K_e$ 2.81, $K_\theta$ 2.10; with the delays in the loop the same pair needs $K_e$ 2.67, $K_\theta$ 2.05, within 6 %, and lands at $-1.05 \pm 1.07j$ as asked. The response overshoots 4.6 % (the caption rounds it to 5 %) and settles in 4.0 s, 3.2 m of travel; Apply would set $k_e$ 3.3, $k_\theta$ 2.6.
Shows: At this speed the delays are a small correction: 25 ms of hold against a 1.5 rad/s loop costs a few percent of gain. Placement works as the textbook says, as long as the pair is slow compared with the delay.
Predict: A gentle pair, $\zeta$ 0.7, $\omega_n$ 1.5 rad/s: how will the gains the full loop needs compare with the textbook ones?
- Within a few percent: at this speed the delays are a small correction
- Far larger, beyond what the Control sliders reach
- About twice as large: the delays double the gain
Answer: 0

## Try: Place a fast pair, ζ 1, ω_n 4 rad/s
cfg: {"level":0,"set":{"ctl":"rwf"},"place":{"zeta":1,"wn":4}}
Setup: The same loop with a placement at $\zeta$ 1, $\omega_n$ 4 rad/s: a critically damped pair twice as fast as the default's.
See: Textbook gains $K_e$ 20, $K_\theta$ 8; with the delays the pair needs $K_e$ 33.6, $K_\theta$ 10.4, a 68 % increase on the offset gain, and those are beyond the sliders' ends (12 and 6), so Apply writes the ends. The what-if itself lands the pair at −4 as asked, with no overshoot and a 1.15 s settling time (0.9 m of travel).
Shows: The faster the pair, the more the delays move it, and the more gain it takes to hold it there; at 4 rad/s a 25 ms hold is already 6° of phase. This is the delay-margin lesson seen from the pole plot: beyond some speed, placement asks for gains the plant's delays will not honour, and the margins say so.
Predict: A fast critically damped pair, $\zeta$ 1, $\omega_n$ 4 rad/s: how do the gains the loop needs compare with the textbook ones?
- Within a few percent again: placement is exact
- Far larger, beyond what the Control sliders reach
- Smaller: a faster loop needs less gain
Answer: 1

## Try: LQR with q_e 1, q_θ 0.5, r 0.1
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0.5,"r":0.1}}
Setup: LQR with weights 1 on the offset, 0.5 on the heading error and 0.1 on the steering command.
See: $K_e = \sqrt{1/0.1} = 3.16$ and $K_\theta$ 3.17, a pair at $\zeta$ 1.00, $\omega_n$ 1.59 rad/s; with the delays the loop needs $K_e$ 3.02, $K_\theta$ 3.03 and the pair lands at $-1.61 \pm 0.17j$. No overshoot, settled in 3.6 s (2.9 m of travel); Apply writes $k_e$ 3.8, $k_\theta$ 3.8.
Shows: A weight on the heading error buys damping: the pair comes out critically damped at about the default's speed. LQR did not choose the poles; it chose how much steering is worth against how much error, and the poles followed.
Predict: LQR with $q_e = 1$, $q_\theta = 0.5$, $r = 0.1$. What damping does it choose?
- About 0.7, like pure pursuit
- About 1: critically damped
- Below 0.5: it trades damping for speed
Answer: 1

## Try: LQR with no weight on the heading error
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0,"r":0.1}}
Setup: The same LQR with $q_\theta = 0$: the cost sees only the offset and the command.
See: $K_e$ 3.16 as before, $K_\theta$ 2.25, and the pair at $\zeta$ 0.71, $\omega_n$ 1.59 rad/s; with the delays it lands at $-1.13 \pm 1.13j$ with 4.3 % overshoot, the pure-pursuit numbers almost exactly.
Shows: The optimal damping of a double integrator with cheap control is $1/\sqrt2$, which is why pure pursuit, whose geometry fixes $\zeta$ at 0.71, is closer to optimal than its one knob suggests. The heading weight is the only way LQR adds damping beyond that.
Predict: Set the heading weight to zero, $q_\theta = 0$. What happens to the damping?
- It stays near 1: the offset weight already damps the loop
- It drops to $1/\sqrt2$ whatever the other weights
- The loop goes unstable without a heading term
Answer: 1

## Try: LQR with cheap control, r 0.005
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0.5,"r":0.005}}
Setup: The weights 1, 0.5 and $r = 0.005$: steering is twenty times cheaper than in the third experiment.
See: Textbook gains $K_e$ 14.1, $K_\theta$ 11.1 and an overdamped pair ($\zeta$ 1.65, $\omega_n$ 3.4 rad/s: real poles at −1.1 and −9.9), which the what-if targets at $-\zeta\omega_n \approx -5.5$; holding a pole there with the delays in the loop takes $K_e$ 68.6, $K_\theta$ 14.8, far beyond the sliders. The what-if plot shows that target; Apply cannot follow.
Shows: Cheap control raises the loop's speed only like $(q_e/r)^{1/4}$, so a twentyfold cheaper command bought a pair about twice as fast, and the delays, which LQR knows nothing about, make even that expensive. The 60° phase margin LQR guarantees is for the delay-free plant; the margins in the chips are the ones to believe.
Predict: Make the control cheap, $r = 0.005$, with $q_\theta$ back at 0.5. What does LQR ask for?
- A pair about twice as fast, which the loop can still hold
- A pair the delays make unreachable: gains far beyond the sliders
- The same pair: only the ratio $q_e/q_\theta$ matters
Answer: 1

## Code: placeGains and lqrGains
snippet: lqr
focus: Ke = Math.sqrt(qe / r), … zeta = (g * Kth) / (2 * wn);
example: ctl/rwf
Note: Pole placement is two lines of algebra; LQR for this plant is four, the Riccati equation solved in closed form. Edit and run: the rear-wheel-feedback example with ke and kth set to the design's gains; the loop then needs the larger pair the caption reports, because of the delays the design ignores.

## Think about
Q: Pole placement and LQR give the same kind of answer, two gains. What does LQR add that placement does not?
A: A reason for the pair, stated in units you can argue about: how much offset is worth how much steering. Placement will put the pair anywhere you ask, including places that cost absurd gains; LQR's poles come from a trade-off, and its weights are the thing a team can discuss.
Q: Both methods ignore the hold, the latency and the actuator lag. Where do the delays show up in the lab, and how would a designer account for them?
A: In the gap between the textbook gains and the gains the what-if needs, which grows with the pair's speed, and in the margins the chips compute. A designer either keeps the pair slow compared with the delay (a rule of thumb: $\omega_n$ below about a fifth of $1/T_\text{delay}$), or puts the delay in the model, a Padé approximation or a discrete-time design, and places or optimizes with it there.
Q: Rear-wheel feedback's defaults sit at $\zeta$ 0.61 with 9 % overshoot. Which of the designs here would you apply, and what would you check before trusting it?
A: The first LQR design ($\zeta$ 1, no overshoot, settled in 3.6 s, $k_e$ 3.8, $k_\theta$ 3.8) is a reasonable choice for a straight path. Before trusting it: the step test in the simulator, the delay margin in the chips, a curve (lesson 13) and a higher speed (lesson 10), because none of those are in the two-integrator model the design came from.

## Check yourself
Q: LQR on the diff-drive at $v_0 = 0.8$ m/s ($g = 1$) with $q_e = 1$, $q_\theta = 0.5$, $r = 0.1$. What is $K_\theta = \sqrt{q_\theta/r + 2v_0\sqrt{q_e/r}/g}$?
Answer: 3.17
Tolerance: 0.03
Unit: 1/s
How: $q_\theta/r = 5$; $\sqrt{q_e/r} = \sqrt{10} = 3.162$; $2 \times 0.8 \times 3.162 = 5.06$; $K_\theta = \sqrt{5 + 5.06} = \sqrt{10.06} = 3.17$
