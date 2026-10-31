group: ctl
title: Nyquist and the −1 point

<p><b>Why this matters.</b> The Bode plot shows the margins, and the Nyquist plot shows what they measure: how far the loop is from the one point in the plane that makes it unstable. It also gives a stability test that still works when the open loop is itself unstable, or when the phase crosses −180° more than once, as it does with delay. On this plot you can watch a little more latency rotate the curve onto that point.</p>
<p><b>The idea.</b> The closed loop has a pole wherever $1 + L(s) = 0$, so the curve must stay away from −1. The plot traces $L(j\omega)$ in the complex plane as $\omega$ runs from 0 to $\infty$ (solid), and its mirror image for negative frequencies (dashed). The Nyquist criterion counts the clockwise encirclements $N$ of −1, the number of times the curve goes round −1 clockwise. The number of unstable closed-loop poles is then $Z = N + P$, where $P$ is the number of unstable open-loop poles. Here there are none. The pink segment marks the curve's closest approach to −1, and its length is $1/M_s$. A delay $T_d$ multiplies $L$ by $e^{-j\omega T_d}$. That rotates each point clockwise by $\omega T_d$ radians, which is more at higher frequency, so the outer part of the curve swings towards −1.</p>
<p><b>Where it comes from.</b> The criterion follows from the argument principle. As $s$ goes round a contour that encloses the right half plane, the image of $1 + L(s)$ winds round the origin $Z - P$ times. Shifted by one, these are encirclements of −1 by $L$. The two integrators put a double pole on the contour, so the plot's path goes round the origin on a small indent. For display, the plot draws the radius as $\log_2(1 + |L|)$. This keeps −1 and the unit circle where they are, and brings the low-frequency part of the curve onto the page, where it would otherwise not fit. <a class="chref" href="#notes=ch6/4-reading-the-margins">Derivation: chapter 6 §4</a></p>
<p><b>What the lab does.</b> The chips report $N$, $P$ and $Z$. The lab computes them by integrating the argument along the contour, and checks $Z$ against the eigenvalues of the discrete closed loop. The compressed/linear switch changes the radius scale. The three buttons here start from the fast pure-pursuit loop and add latency in whole 50 ms ticks, as the simulator does.</p>

## Try: Short lookahead, no latency
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0}}
Setup: The fast loop again, with a 0.1 m lookahead, a crossover of 17.6 rad/s and only the 25 ms hold delay.
See: The curve passes to the right of −1, and at its closest it is $1/1.65 = 0.6$ away. The chips show $N = 0$, $P = 0$ and $Z = 0$, so the loop is stable, with a phase margin of 40° and a delay margin of 0.04 s. The hold delay has already rotated the outer arc, the high-frequency part, well clockwise.
Shows: The loop is stable with little room: 40° of phase at 17.6 rad/s is 0.04 s of delay. On the Nyquist plot you can see this budget as an angle. An extra delay $\Delta T$ rotates each point at frequency $\omega$ by $\omega\,\Delta T$, and the point near crossover has to turn only 0.7 rad to reach −1.
Predict: The fast loop with only the 25 ms hold delay: what will the Nyquist count say?
- $N = 0$, stable, but the curve passes only about 0.6 from −1
- $N = 2$: already unstable
- $N = 0$, and the curve stays well clear of −1, more than 1 away
Answer: 0

## Try: Short lookahead, 0.05 s latency
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0.05}}
Setup: The same fast loop with one tick of control latency, 50 ms, which is more than the 40 ms delay margin.
See: The curve rotates through −1. $N = 2$, so there are $Z = 2$ unstable closed-loop poles. The phase margin is −10° and $M_s = 6.9$. The chips turn red, and the poles chip shows a complex pair in the right half plane with $\zeta = -0.09$.
Shows: The delay margin predicted this. A latency of 50 ms is more than the 40 ms margin, and the loop is unstable. The count is $N = 2$ and not 1, because the two poles of a complex pair cross together. The linear model now predicts an oscillation that grows without bound. In the next lesson the simulator shows what the turn-rate limit does to it.
Predict: One tick of latency, 50 ms, against a delay margin of 40 ms: what will $N$ be?
- $N = 0$: one tick is small enough to absorb
- $N = 1$: one real pole crosses
- $N = 2$: a complex pair crosses together
Answer: 2

## Try: Short lookahead, 0.10 s latency
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0.1}}
Setup: The same fast loop with two ticks of latency.
See: The count is still $N = 2$, $Z = 2$, and the phase margin is −60°. The curve has rotated far past −1, and the unstable poles have moved further right ($\zeta = -0.35$). $M_s$ no longer means anything.
Shows: Here the extra delay adds no unstable poles. It makes the same pair grow faster and swing more slowly. At one tick the pair sits at $1.5 \pm 16.7j$, and the oscillation grows about 1.8 times per cycle. At two ticks it sits at $4.4 \pm 11.8j$ and grows about tenfold per cycle ($e^{2\pi \cdot 4.4/11.8}$), at 11.8 rad/s instead of 16.7. The Nyquist count tells you whether the loop is unstable, and the pole positions tell you how fast it diverges.
Predict: Doubling the latency to two ticks: what changes in the count and the poles?
- $N$ rises to 4: two more unstable poles
- The curve rotates right round and $N$ returns to 0
- $N$ stays 2; the unstable pair moves further right
Answer: 2

## Code: anFreq, the encirclements
snippet: an-freq
focus: Ncw = Math.round(-dTot / (2 * Math.PI)),
focus: if (Ncw + Pol !== 0 && gmN != null) { … w180 = w180N;
Note: The code counts the clockwise encirclements of −1 from the total phase change of $1 + L$ along the Nyquist path, and $Z = N + P$ decides stability. When the loop is unstable, the gain margin it reports is the cut in gain that would make the loop stable again.

## Think about
Q: The curve encircles −1 twice and the chips say $Z = 2$. What would a count of one mean?
A: It would mean that a single real pole had crossed into the right half plane. The loop would then diverge without oscillating. That happens with a sign error, or with a gain so large that a real pole goes unstable. An oscillating instability, the common case with delay, always comes from a complex pair and counts two.
Q: Why is the low-frequency part of the curve compressed?
A: Two integrators make $|L|$ infinite as $\omega \to 0$, so the true curve runs off to infinity along the negative real axis. The display maps the radius through $\log_2(1 + |L|)$. That leaves the unit circle and −1 in place and brings the tail back onto the screen. The linear switch shows the raw curve for comparison.
Q: Delay rotates the curve but leaves the magnitude alone. Why can it still make $M_s$ huge?
A: $M_s$ is one over the smallest distance to −1. A rotation moves each point of the curve along a circle of fixed radius $|L|$. If that circle passes through −1, enough rotation brings the distance to zero while the magnitude stays the same. In vehicle loops, delay is therefore a bigger robustness problem than gain.

## Check yourself
Q: An extra delay of 0.08 s is added to a loop. By how many degrees does the Nyquist point at $\omega = 6$ rad/s rotate clockwise?
Answer: 27.5
Tolerance: 0.6
Unit: °
How: $\omega\,\Delta T = 6 \times 0.08 = 0.48$ rad $= 0.48 \times 180/\pi = 27.5°$.
