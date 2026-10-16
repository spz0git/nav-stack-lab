group: ctl
title: Nyquist and the −1 point

<p><b>Why this matters.</b> The Bode plot shows margins; the Nyquist plot shows why they are margins, and it gives the one test that works even when the open loop is itself unstable or when the phase crosses −180° more than once, which delay makes happen. It is also the plot on which "a little more latency" becomes visible as a curve rotating into the forbidden point.</p>
<p><b>The idea.</b> The closed loop has a pole wherever 1 + <i>L</i>(<i>s</i>) = 0, so −1 is the point to stay away from. The plot traces <i>L</i>(jω) in the complex plane as ω runs from 0 to ∞ (solid) and its mirror image for negative frequencies (dashed). The Nyquist criterion counts the clockwise encirclements <i>N</i> of −1 by this curve and gives the number of unstable closed-loop poles as <i>Z</i> = <i>N</i> + <i>P</i>, with <i>P</i> the number of unstable open-loop poles, none here. The pink segment is the closest approach to −1; its length is 1/<i>M</i><sub>s</sub>. A delay T_d multiplies <i>L</i> by e<sup>−jωT_d</sup>, which rotates each point clockwise by ω<i>T</i><sub>d</sub> radians, more at higher frequency, so the outer part of the curve sweeps toward −1.</p>
<p><b>Where it comes from.</b> The argument principle: as <i>s</i> traverses a contour enclosing the right half plane, the image of 1 + <i>L</i>(<i>s</i>) winds around the origin <i>Z</i> − <i>P</i> times; shifting by one makes that encirclements of −1 by <i>L</i>. Two integrators put a double pole on the contour, which is why the plot uses an indented path around the origin and, for display, the radius log₂(1 + |<i>L</i>|), which keeps −1 and the unit circle where they are while the curve at low frequency would otherwise be off the page. <a class="chref" href="#notes=ch6/4-reading-the-margins">Derivation: chapter 6 §4</a></p>
<p><b>What the lab does.</b> The chips report <i>N</i>, <i>P</i> and <i>Z</i>, computed by integrating the argument along the contour, and cross-check <i>Z</i> against the eigenvalues of the discrete closed loop. The compressed/linear switch changes the radius scale. The three buttons here start from the fast pure-pursuit loop and add latency in whole 50 ms ticks, which is how the simulator adds it.</p>

## Try: Short lookahead, no latency
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0}}
Setup: The fast loop again: 0.1 m lookahead, crossover 17.6 rad/s, only the 25 ms hold delay.
See: The curve passes to the right of −1 with its closest approach 1/1.65 = 0.6 away: N = 0, P = 0, Z = 0, stable, phase margin 40°, delay margin 0.04 s. The outer arc, the high-frequency part, is already rotated well clockwise by the hold delay.
Shows: Stable with little room: 40° of phase at 17.6 rad/s is 0.04 s of delay. The Nyquist curve makes the budget geometric: each point at frequency ω will rotate by ω × ΔT for an extra delay ΔT, and the point near crossover needs only 0.7 rad to reach −1.
Predict: The fast loop with only the 25 ms hold delay: what will the Nyquist count say?
- N = 0, stable, closest approach well inside the unit circle
- N = 2: already unstable
- N = 0, and the curve stays far from −1
Answer: 0

## Try: Short lookahead, 0.05 s latency
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0.05}}
Setup: The same fast loop with one tick of control latency, 50 ms, which is more than the 40 ms delay margin.
See: The curve rotates through −1: N = 2, so Z = 2 unstable closed-loop poles, phase margin −10°, M_s = 6.9. The chips turn red and the poles chip shows a complex pair in the right half plane with ζ = −0.09.
Shows: Exactly what the delay margin promised: 50 ms is past 40 ms, and the loop is unstable. N = 2 rather than 1 because the pair of complex poles crosses together. The linear model now predicts an oscillation that grows without bound; the simulator, in the next lesson, shows what the turn-rate limit does with that.
Predict: One tick of latency, 50 ms, against a delay margin of 40 ms: what will N be?
- N = 0: one tick is small enough to absorb
- N = 1: one real pole crosses
- N = 2: a complex pair crosses together
Answer: 2

## Try: Short lookahead, 0.10 s latency
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0,"latency":0.1}}
Setup: The same fast loop with two ticks of latency.
See: Still N = 2, Z = 2, phase margin −60°; the curve has rotated far past −1 and the unstable poles have moved further right (ζ = −0.35). M_s is no longer meaningful.
Shows: More delay does not add more unstable poles here, it makes the existing pair grow faster: the oscillation at roughly the crossover frequency doubles in amplitude every cycle instead of every few. The Nyquist count tells you whether; the pole positions tell you how fast.
Predict: Doubling the latency to two ticks: what changes in the count and the poles?
- N rises to 4: two more unstable poles
- The curve rotates right round and N returns to 0
- N stays 2; the unstable pair moves further right
Answer: 2

## Think about
Q: The curve encircles −1 twice and the chips say Z = 2. What would a count of one mean?
A: A single real pole crossing into the right half plane: a loop that diverges without oscillating, which happens with a sign error or a gain so large that a real pole goes unstable. Oscillatory instability, the common case with delay, always comes as a complex pair and counts two.
Q: Why is the low-frequency part of the curve compressed?
A: Two integrators make |L| infinite as ω → 0, so the true curve shoots off to infinity along the negative real axis. The display maps the radius through log₂(1 + |L|), which leaves the unit circle and −1 in place and brings the tail back onto the screen; the linear switch shows the raw curve for comparison.
Q: Delay rotates the curve but leaves the magnitude alone. Why can it still make M_s huge?
A: M_s is the inverse distance to −1, and rotation moves the point nearest −1 along a circle of fixed radius |L|; when that circle passes through −1 the distance goes to zero. Magnitude unchanged, robustness gone: this is why delay is the dominant robustness problem in vehicle loops, not gain.

## Check yourself
Q: An extra delay of 0.08 s is added to a loop. By how many degrees does the Nyquist point at ω = 6 rad/s rotate clockwise?
Answer: 27.5
Tolerance: 0.6
Unit: °
How: ω·ΔT = 6 × 0.08 = 0.48 rad = 0.48 × 180/π = 27.5°.
