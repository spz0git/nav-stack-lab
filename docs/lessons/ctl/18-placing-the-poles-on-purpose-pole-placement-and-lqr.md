group: ctl
title: Placing the poles on purpose: pole placement and LQR
extra: true

<p><b>Why this matters.</b> Every control lesson so far tuned by turning a knob and reading the chips. That works for one knob. Rear-wheel feedback has two, and with two gains the two-integrator loop can be given any pole pair at all, which raises the real engineering question: which pair, and why. The two textbook answers are pole placement, where you name the pair and solve for the gains, and the linear-quadratic regulator, where you name a cost, tracking error against steering effort, and the pair follows. Both solve in closed form here, both are one click under the pole plot, and both ignore the delays, which is the point of trying them in this lab.</p>
<p><b>The idea.</b> The delay-free loop with the two gains is <i>s</i>² + <i>gK</i><sub>θ</sub><i>s</i> + <i>gv</i>₀<i>K</i><sub>e</sub> = 0, a second-order polynomial whose two coefficients the two gains set directly. Ask for damping ζ and natural frequency ω<sub>n</sub> and the gains fall out by matching coefficients; that is pole placement, exact and instant. LQR instead minimizes a quadratic cost: how much offset, how much heading error, how much steering, each with a weight. For this plant the Riccati equation it leads to has a closed-form solution, and the gains come out as square roots of the weight ratios. The surprise is what LQR does with the damping: with no weight on the heading error it lands on ζ = 1/√2 whatever else you ask for, the same number pure pursuit is stuck with, and making control cheap raises the speed of the loop only like the fourth root of the weight ratio.</p>
<div class="eq">placement:  K_e = ω_n²/(g v₀),   K_θ = 2ζω_n/g
LQR with J = ∫ q_e e² + q_θ θ_e² + r u² dt:   K_e = √(q_e/r),   K_θ = √(q_θ/r + 2v₀√(q_e/r)/g)
then ω_n = √(g v₀ K_e),  ζ = gK_θ/(2ω_n);   with q_θ = 0:  ζ = 1/√2</div>
<p><b>Where it comes from.</b> Placement is coefficient matching against <i>s</i>² + 2ζω<sub>n</sub><i>s</i> + ω<sub>n</sub>²; LQR is the 2 × 2 algebraic Riccati equation written out as three scalar equations, which solve one after the other. <a class="chref" href="#notes=ch6/8-placing-the-poles-on-purpose-pole-placement-and-lqr">Derivation: chapter 6 §8</a></p>
<p><b>What the lab does.</b> The design row under the pole plot takes either (ζ, ω<sub>n</sub>) or (<i>q</i><sub>e</sub>, <i>q</i><sub>θ</sub>, <i>r</i>) and shows the result as a what-if: the pair you asked for, the textbook gains that ignore the delays, and the gains the full loop (hold, latency, lag) actually needs to put the pair there, which the plot and the response show. Apply writes those gains as rear-wheel feedback's <i>k</i><sub>e</sub> and <i>k</i><sub>θ</sub>. The buttons below open L1 with rear-wheel feedback at 0.8 m/s, whose own tuning sits at ζ 0.61, ω<sub>n</sub> about 2 rad/s, 9 % overshoot and a 353 ms delay margin.</p>

## Try: Place the pair at ζ 0.7, ω_n 1.5 rad/s
cfg: {"level":0,"set":{"ctl":"rwf"},"place":{"zeta":0.7,"wn":1.5}}
Setup: L1, rear-wheel feedback, and a placement at ζ 0.7, ω_n 1.5 rad/s: a gentle, slightly slower loop than the default.
See: The textbook gains are K_e 2.81, K_θ 2.10; with the delays in the loop the same pair needs K_e 2.67, K_θ 2.05, within 6 %, and lands at −1.05 ± 1.07j as asked. The response overshoots 4.6 % and settles in 4.0 s; Apply would set k_e 3.3, k_θ 2.6.
Shows: At this speed the delays are a small correction: 25 ms of hold against a 1.5 rad/s loop costs a few percent of gain. Placement works as the textbook says, as long as the pair is slow compared with the delay.
Predict: Ask for ζ 1, ω_n 4 rad/s, a fast critically damped pair. How do the gains the loop needs compare with the textbook ones?
- Within a few percent again: placement is exact
- Far larger, beyond what the Control sliders reach
- Smaller: a faster loop needs less gain
Answer: 1

## Try: Place a fast pair, ζ 1, ω_n 4 rad/s
cfg: {"level":0,"set":{"ctl":"rwf"},"place":{"zeta":1,"wn":4}}
Setup: The same loop with a placement at ζ 1, ω_n 4 rad/s: a critically damped pair twice as fast as the default's.
See: Textbook gains K_e 20, K_θ 8; with the delays the pair needs K_e 33.6, K_θ 10.4, a 68 % increase on the offset gain, and those are beyond the sliders' ends (12 and 6), so Apply writes the ends. The what-if itself lands the pair at −4 as asked, with no overshoot and a 1.15 s settling time.
Shows: The faster the pair, the more the delays move it, and the more gain it takes to hold it there; at 4 rad/s a 25 ms hold is already 6° of phase. This is the delay-margin lesson seen from the pole plot: beyond some speed, placement asks for gains the plant's delays will not honour, and the margins say so.
Predict: LQR with q_e = 1, q_θ = 0.5, r = 0.1. What damping does it choose?
- About 0.7, like pure pursuit
- About 1: critically damped
- Below 0.5: it trades damping for speed
Answer: 1

## Try: LQR with q_e 1, q_θ 0.5, r 0.1
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0.5,"r":0.1}}
Setup: LQR with weights 1 on the offset, 0.5 on the heading error and 0.1 on the steering command.
See: K_e √(1/0.1) = 3.16 and K_θ 3.17, a pair at ζ 1.00, ω_n 1.59 rad/s; with the delays the loop needs K_e 3.02, K_θ 3.03 and the pair lands at −1.61 ± 0.17j. No overshoot, settled in 3.6 s; Apply writes k_e 3.8, k_θ 3.8.
Shows: A weight on the heading error buys damping: the pair comes out critically damped at about the default's speed. LQR did not choose the poles; it chose how much steering is worth against how much error, and the poles followed.
Predict: Set the heading weight to zero, q_θ = 0. What happens to the damping?
- It stays near 1: the offset weight already damps the loop
- It drops to 1/√2 whatever the other weights
- The loop goes unstable without a heading term
Answer: 1

## Try: LQR with no weight on the heading error
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0,"r":0.1}}
Setup: The same LQR with q_θ = 0: the cost sees only the offset and the command.
See: K_e 3.16 as before, K_θ 2.25, and the pair at ζ 0.71, ω_n 1.59 rad/s; with the delays it lands at −1.13 ± 1.13j with 4.3 % overshoot, the pure-pursuit numbers almost exactly.
Shows: The optimal damping of a double integrator with cheap control is 1/√2, which is why pure pursuit, whose geometry fixes ζ at 0.71, is closer to optimal than its one knob suggests. The heading weight is the only way LQR adds damping beyond that.
Predict: Make the control cheap, r = 0.005, with q_θ back at 0.5. What does LQR ask for?
- A pair about twice as fast, which the loop can still hold
- A pair the delays make unreachable: gains far beyond the sliders
- The same pair: only the ratio q_e/q_θ matters
Answer: 1

## Try: LQR with cheap control, r 0.005
cfg: {"level":0,"set":{"ctl":"rwf"},"lqr":{"qe":1,"qth":0.5,"r":0.005}}
Setup: The weights 1, 0.5 and r = 0.005: steering is twenty times cheaper than in the third experiment.
See: Textbook gains K_e 14.1, K_θ 11.1 and an overdamped pair (ζ 1.65, ω_n 3.4 rad/s, two real poles near −5.5); with the delays in the loop holding that pair takes K_e 68.6, K_θ 14.8, far beyond the sliders. The what-if plot shows the pair where asked; Apply cannot follow.
Shows: Cheap control raises the loop's speed only like (q_e/r)^¼, so a twentyfold cheaper command bought a pair about twice as fast, and the delays, which LQR knows nothing about, make even that expensive. The 60° phase margin LQR guarantees is for the delay-free plant; the margins in the chips are the ones to believe.

## Think about
Q: Pole placement and LQR give the same kind of answer, two gains. What does LQR add that placement does not?
A: A reason for the pair, stated in units you can argue about: how much offset is worth how much steering. Placement will put the pair anywhere you ask, including places that cost absurd gains; LQR's poles come from a trade-off, and its weights are the thing a team can discuss.
Q: Both methods ignore the hold, the latency and the actuator lag. Where do the delays show up in the lab, and how would a designer account for them?
A: In the gap between the textbook gains and the gains the what-if needs, which grows with the pair's speed, and in the margins the chips compute. A designer either keeps the pair slow compared with the delay (a rule of thumb: ω_n below about a fifth of 1/T_delay), or puts the delay in the model, a Padé approximation or a discrete-time design, and places or optimizes with it there.
Q: Rear-wheel feedback's defaults sit at ζ 0.61 with 9 % overshoot. Which of the designs here would you apply, and what would you check before trusting it?
A: The first LQR design (ζ 1, no overshoot, settled in 3.6 s, k_e 3.8, k_θ 3.8) is a reasonable choice for a straight path. Before trusting it: the step test in the simulator, the delay margin in the chips, a curve (lesson 13) and a higher speed (lesson 10), because none of those are in the two-integrator model the design came from.

## Check yourself
Q: LQR on the diff-drive at v₀ = 0.8 m/s (g = 1) with q_e = 1, q_θ = 0.5, r = 0.1. What is K_θ = √(q_θ/r + 2 v₀ √(q_e/r) / g)?
Answer: 3.17
Tolerance: 0.03
Unit: 1/s
How: q_θ/r = 5; √(q_e/r) = √10 = 3.162; 2 × 0.8 × 3.162 = 5.06; K_θ = √(5 + 5.06) = √10.06 = 3.17
