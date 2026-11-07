group: ctl
title: Placing the poles on purpose: pole placement and LQR
level: 3
extra: true

<p><b>Why this matters.</b> Every control lesson so far tuned the loop by turning a knob and reading the chips. That works when there is one knob. Rear-wheel feedback has two, and with two gains the two-integrator loop can be given any pole pair at all. The engineering question is then which pair to choose, and why. There are two textbook answers. In pole placement you name the pair and solve for the gains. In the linear-quadratic regulator (LQR) you name a cost, tracking error against steering effort, and the pair follows from it. Here both have closed-form solutions, and each is one click under the pole plot. Both ignore the delays, and this lab lets you see what that costs.</p>
<p><b>The idea.</b> The characteristic equation of the delay-free loop with the two gains is $s^2 + gK_\theta s + g v_0 K_e = 0$. It is a second-order polynomial, and each gain sets one of its two coefficients directly. Ask for a damping $\zeta$ and a natural frequency $\omega_n$, and matching coefficients gives the gains. That is pole placement, and it is exact. LQR instead minimizes a quadratic cost made of the offset, the heading error and the steering, each with a weight. For this plant the Riccati equation it leads to has a closed-form solution, and the gains come out as square roots of the weight ratios. Two of the results may be unexpected. With no weight on the heading error, LQR lands on $\zeta = 1/\sqrt2$ whatever the other weights, the same value pure pursuit always has. And making control cheaper raises the speed of the loop only as the fourth root of the weight ratio.</p>
<!-- math -->
<p>Pole placement:</p>
$$K_e = \frac{\omega_n^2}{g v_0}, \qquad K_\theta = \frac{2\zeta\omega_n}{g}$$
<p>LQR with $J = \int (q_e e^2 + q_\theta \theta_e^2 + r u^2)\,dt$:</p>
$$K_e = \sqrt{q_e/r}, \qquad K_\theta = \sqrt{\frac{q_\theta}{r} + \frac{2v_0\sqrt{q_e/r}}{g}}$$
<p>Then $\omega_n = \sqrt{g v_0 K_e}$ and $\zeta = gK_\theta/(2\omega_n)$. With $q_\theta = 0$, $\zeta = 1/\sqrt2$.</p>
<p><b>Where it comes from.</b> Placement matches coefficients against $s^2 + 2\zeta\omega_n s + \omega_n^2$. For LQR, the $2 \times 2$ algebraic Riccati equation is written out as three scalar equations, which can be solved one after the other. <a class="chref" href="#notes=ch6/8-placing-the-poles-on-purpose-pole-placement-and-lqr">Derivation: chapter 6 §8</a></p>
<!-- /math -->
<p><b>What the lab does.</b> The design row under the pole plot takes either $(\zeta, \omega_n)$ or $(q_e, q_\theta, r)$ and shows the result as a what-if. It gives the pair you asked for, the textbook gains that ignore the delays, and the gains the full loop (hold, latency, lag) actually needs to put the pair there. The plot and the response show the loop with those last gains. Apply writes them as rear-wheel feedback's $k_e$ and $k_\theta$. The buttons below open L1 with rear-wheel feedback at 0.8 m/s. Its own tuning gives $\zeta$ 0.61, $\omega_n$ about 2 rad/s, 9 % overshoot and a 353 ms delay margin.</p>

## Try: Place the pair at ζ 0.7, ω_n 1.5 rad/s
cfg: {"level":0,"set":{"ctl":"rwf"},"place":{"zeta":0.7,"wn":1.5}}
Setup: L1 with rear-wheel feedback, and a placement at $\zeta$ 0.7, $\omega_n$ 1.5 rad/s. This asks for a gentle loop, slightly slower than the default.
See: The textbook gains are $K_e$ 2.81 and $K_\theta$ 2.10. With the delays in the loop, the same pair needs $K_e$ 2.67 and $K_\theta$ 2.05, within 6 %, and lands at $-1.05 \pm 1.07j$ as asked. The response overshoots by 4.6 % (the caption rounds it to 5 %) and settles in 4.0 s, which is 3.2 m of travel. Apply would set $k_e$ 3.3 and $k_\theta$ 2.6.
Shows: At this speed the delays are a small correction. With a 1.5 rad/s loop, 25 ms of hold costs a few percent of gain. Placement works as the textbook says, as long as the pair is slow compared with the delay.
Predict: A gentle pair, $\zeta$ 0.7, $\omega_n$ 1.5 rad/s: how will the gains the full loop needs compare with the textbook ones?
- Within a few percent: at this speed the delays are a small correction
- Far larger, beyond what the Control sliders reach
- About twice as large: the delays double the gain
Answer: 0

## Try: Place a fast pair, ζ 1, ω_n 4 rad/s
cfg: {"level":0,"set":{"ctl":"rwf"},"place":{"zeta":1,"wn":4}}
Setup: The same loop with a placement at $\zeta$ 1, $\omega_n$ 4 rad/s. This is a critically damped pair, twice as fast as the default's.
See: The textbook gains are $K_e$ 20 and $K_\theta$ 8. With the delays, the pair needs $K_e$ 33.6 and $K_\theta$ 10.4, a 68 % increase on the offset gain. These are beyond the ends of the sliders (12 and 6), so Apply writes the ends. The what-if itself lands the pair at −4 as asked, with no overshoot and a 1.15 s settling time (0.9 m of travel).
Shows: The faster the pair, the more the delays move it, and the more gain it takes to hold it there. At 4 rad/s a 25 ms hold already costs 6° of phase. This is the limit from the delay-margin lesson, seen in the pole plot. Beyond some speed, placement asks for gains that the plant's delays do not allow, and the margins show it.
Predict: A fast critically damped pair, $\zeta$ 1, $\omega_n$ 4 rad/s: how do the gains the loop needs compare with the textbook ones?
- Within a few percent again: placement is exact
- Far larger, beyond what the Control sliders reach
- Smaller: a faster loop needs less gain
Answer: 1

## Try: LQR with q_e 1, q_θ 0.5, r 0.1
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0.5,"r":0.1}}
Setup: LQR with weights 1 on the offset, 0.5 on the heading error and 0.1 on the steering command.
See: The gains are $K_e = \sqrt{1/0.1} = 3.16$ and $K_\theta$ 3.17, which give a pair at $\zeta$ 1.00, $\omega_n$ 1.59 rad/s. With the delays the loop needs $K_e$ 3.02 and $K_\theta$ 3.03, and the pair lands at $-1.61 \pm 0.17j$. There is no overshoot, and the loop settles in 3.6 s (2.9 m of travel). Apply writes $k_e$ 3.8 and $k_\theta$ 3.8.
Shows: A weight on the heading error adds damping, and the pair comes out critically damped at about the default's speed. You did not choose the poles here. You chose how much steering is worth against how much error, and LQR gave the poles that follow from that.
Predict: LQR with $q_e = 1$, $q_\theta = 0.5$, $r = 0.1$. What damping does it choose?
- About 0.7, like pure pursuit
- About 1: critically damped
- Below 0.5: it trades damping for speed
Answer: 1

## Try: LQR with no weight on the heading error
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0,"r":0.1}}
Setup: The same LQR with $q_\theta = 0$, so the cost sees only the offset and the command.
See: The gain $K_e$ is 3.16 as before and $K_\theta$ is 2.25, which puts the pair at $\zeta$ 0.71, $\omega_n$ 1.59 rad/s. With the delays it lands at $-1.13 \pm 1.13j$ with 4.3 % overshoot. These are almost the pure-pursuit numbers.
Shows: For a double integrator with cheap control, the optimal damping is $1/\sqrt2$. Pure pursuit's geometry fixes its $\zeta$ at 0.71, so it is closer to optimal than its single knob suggests. Within LQR, only the heading weight adds damping beyond that.
Predict: Set the heading weight to zero, $q_\theta = 0$. What happens to the damping?
- It stays near 1: the offset weight already damps the loop
- It drops to $1/\sqrt2$ whatever the other weights
- The loop goes unstable without a heading term
Answer: 1

## Try: LQR with cheap control, r 0.005
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0.5,"r":0.005}}
Setup: The weights 1, 0.5 and $r = 0.005$, so steering is twenty times cheaper than in the third experiment.
See: The textbook gains are $K_e$ 14.1 and $K_\theta$ 11.1. They give an overdamped pair with $\zeta$ 1.65 and $\omega_n$ 3.4 rad/s, that is, real poles at −1.1 and −9.9. The what-if targets the pair at $-\zeta\omega_n \approx -5.5$. Holding a pole there with the delays in the loop takes $K_e$ 68.6 and $K_\theta$ 14.8, far beyond the sliders. The what-if plot shows that target, but Apply cannot reach it.
Shows: Cheaper control raises the loop's speed only as $(q_e/r)^{1/4}$. A command twenty times cheaper gave a pair about twice as fast. LQR knows nothing about the delays, and they make even that pair expensive. The 60° phase margin that LQR guarantees holds for the delay-free plant. Trust the margins in the chips instead.
Predict: Make the control cheap, $r = 0.005$, with $q_\theta$ back at 0.5. What does LQR ask for?
- A pair about twice as fast, which the loop can still hold
- A pair the delays make unreachable: gains far beyond the sliders
- The same pair: only the ratio $q_e/q_\theta$ matters
Answer: 1

## Code: placeGains and lqrGains
snippet: lqr
focus: Ke = Math.sqrt(qe / r), … zeta = (g * Kth) / (2 * wn);
example: ctl/rwf
Note: Pole placement takes two lines of algebra. LQR for this plant takes four, which solve the Riccati equation in closed form. Edit and run loads the rear-wheel-feedback example with ke and kth set to the design's gains. Because of the delays the design ignores, the loop then needs the larger pair of gains that the caption reports.

## Think about
Q: Pole placement and LQR give the same kind of answer, two gains. What does LQR add that placement does not?
A: It adds a reason for the pair, stated in units you can argue about: how much offset is worth how much steering. Placement puts the pair anywhere you ask, including places that need absurd gains. LQR's poles come from a trade-off, and a team can discuss its weights.
Q: Both methods ignore the hold, the latency and the actuator lag. Where do the delays show up in the lab, and how would a designer account for them?
A: They show in the gap between the textbook gains and the gains the what-if needs, which grows with the pair's speed. They also show in the margins the chips compute. A designer can keep the pair slow compared with the delay; a rule of thumb is $\omega_n$ below about a fifth of $1/T_\text{delay}$. Or the designer can put the delay in the model, with a Padé approximation or a discrete-time design, and place the poles or optimize with the delay included.
Q: Rear-wheel feedback's defaults sit at $\zeta$ 0.61 with 9 % overshoot. Which of the designs here would you apply, and what would you check before trusting it?
A: The first LQR design ($\zeta$ 1, no overshoot, settled in 3.6 s, $k_e$ 3.8, $k_\theta$ 3.8) is a reasonable choice for a straight path. Before trusting it, check the step test in the simulator, the delay margin in the chips, a curve (lesson 13) and a higher speed (lesson 10). None of these is in the two-integrator model the design came from.

## Check yourself
Q: LQR on the diff-drive at $v_0 = 0.8$ m/s ($g = 1$) with $q_e = 1$, $q_\theta = 0.5$, $r = 0.1$. What is $K_\theta = \sqrt{q_\theta/r + 2v_0\sqrt{q_e/r}/g}$?
Answer: 3.17
Tolerance: 0.03
Unit: 1/s
How: $q_\theta/r = 5$; $\sqrt{q_e/r} = \sqrt{10} = 3.162$; $2 \times 0.8 \times 3.162 = 5.06$; $K_\theta = \sqrt{5 + 5.06} = \sqrt{10.06} = 3.17$
