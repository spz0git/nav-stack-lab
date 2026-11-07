group: intro
title: Following the line: pure pursuit and the lookahead
level: 1

<p><b>Why this matters.</b> A planned path is only a line on a map. Something has to turn it into wheel commands, tick after tick, so that the robot actually drives along it. That is the controller's job, and it is called path tracking. Pure pursuit is the simplest good path tracker and probably the most used. It has one setting, and choosing it is the first tuning decision on almost any mobile robot.</p>
<p><b>The idea.</b> Pick a point on the path a fixed distance ahead of the robot, the <i>carrot</i>. Steer along the circle that leaves the robot in the direction it is heading and passes through the carrot. Next tick the robot has moved, so pick a new carrot and a new circle. The robot keeps chasing a point it never reaches, and that pulls it onto the path. The fixed distance is the <i>lookahead</i>. A short lookahead puts the carrot close: any sideways error looks like a big angle, the robot turns hard to correct it, and it follows the line tightly, corners included. A long lookahead puts the carrot far away: the same error looks small, the robot turns gently, and at a sharp corner it starts the turn late and swings wide.</p>
<p><b>What the lab does.</b> L1 with the true pose, straight paths and sharp corners at the goals. The Control tab has the Lookahead <i>L</i><sub>0</sub> slider and a gain <i>k</i> that lengthens the lookahead with speed; both experiments set <i>k</i> to 0, so <i>L</i><sub>0</sub> is the lookahead. The lookahead layer draws the carrot. The Cross-track plot shows the cross-track error, the robot's distance from its path, and the Metrics list its RMS.</p>
<p><b>Where it comes from.</b> With $L_d$ the lookahead and $\alpha$ the angle between the robot's heading and the direction to the carrot, the circle through the carrot has curvature (one over its radius)</p>
$$\kappa = \frac{2\sin\alpha}{L_d}$$
<p>and the robot turns at $\omega = v\kappa$. A short $L_d$ makes the same angle into a tight circle. Go deeper: <a class="lsref" href="#lesson=ctl:2">Pure pursuit is a PD controller</a> · <a class="chref" href="#notes=ch5/2-pure-pursuit">the geometry: chapter 5 §2</a></p>

## Try: Short lookahead, 0.2 m
cfg: {"sim":true,"level":0,"set":{"ppL0":0.2,"ppK":0},"tab":"ctl","plot":"cte"}
Setup: L1, pure pursuit with a 0.2 m lookahead. The Control tab and the Cross-track plot open.
See: The robot sits on the line. At each goal it turns sharply onto the new leg. The cross-track error never goes above 0.11 m, and the Cross-track RMS ends at 0.018 m. The mission completes at 58.2 s.
Shows: A short lookahead gives a stiff, accurate tracker. With a perfect pose and no delays, as here, that is all upside. The next lesson adds a delay, and then the short lookahead pays for its stiffness.
Predict: With a 0.2 m lookahead, what does the Cross-track plot show at the corners?
- Small bumps, about a tenth of a metre
- Large swings of a metre or more
- Nothing: the error is exactly zero everywhere
Answer: 0

## Try: Long lookahead, 2 m
cfg: {"sim":true,"level":0,"set":{"ppL0":2,"ppK":0},"tab":"ctl","plot":"cte"}
Setup: The same with a 2 m lookahead.
See: On the straights the robot is on the line. At each goal it keeps going, turns late and swings out in a wide loop before it settles onto the new leg. The Cross-track plot spikes to about 1 m after the corners, and twice the robot is so far off that the event log reports “Replan (off path)”, at 31 and 41 s. The Cross-track RMS ends at 0.257 m, fourteen times the short lookahead's. The mission still completes at 58.1 s.
Shows: The long lookahead is calm, with no hard turns, but it cannot follow a sharp corner. Real tuning sits between the two. Lookahead is a trade between accuracy and smoothness, and, as the next lesson shows, robustness to delay.
Predict: With a 2 m lookahead, what happens at the corners?
- The robot weaves left and right along the new leg
- The robot swings out wide and comes back slowly, up to about a metre off the path
- The robot stops and turns on the spot
Answer: 1

## Think about
Q: Why does the robot with the long lookahead follow the straight legs just as well as the short one?
A: On a straight path the carrot lies on the same line as the robot, so the angle to it is zero and the robot drives straight. The lookahead only matters when there is something to correct: an error, or a bend in the path. Then it sets how hard the robot turns.

## Check yourself
Q: In the second experiment (2 m lookahead), what does Cross-track RMS read in the Metrics list when the mission completes?
Answer: 0.257
Tolerance: 0.02
Unit: m
How: 0.257 m, against 0.018 m with the 0.2 m lookahead. Almost all of it comes from the wide swings after the corners.
