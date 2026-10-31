group: loc
title: Dead reckoning drifts, and knows it

<p><b>Why this matters.</b> Every wheeled robot has odometry. Encoders on the wheels report how far each wheel turned, and the robot works out its own motion from that. Between external fixes, odometry is all the robot has. A fix can be a landmark seen every few seconds, or a GPS signal that is lost for a minute in a tunnel. How fast odometry drifts decides how often the vehicle needs an outside reference. Whether the robot <i>knows</i> how far it has drifted matters more. If it knows, the rest of the stack can act on the uncertainty: slow down, widen its safety margins, or refuse to plan at all. This lesson is about that second question. The first experiment shows a filter whose uncertainty is wrong, and the second shows what makes it wrong. The third shows a filter whose uncertainty is right but too large to be of use.</p>
<p><b>The idea.</b> Dead reckoning integrates the odometry through a motion model. Each tick (50 ms here), the arc model takes the current pose and the odometry input $u$, which is the measured speed $v$ and turn rate $\omega$. It moves the pose along a circular arc. Two kinds of error enter. <i>Noise</i> is random from tick to tick. One reading is slightly high and the next slightly low, so the errors partly average out, but never completely, and the total error does a random walk. <i>Bias</i> is systematic. A wheel 2 % smaller than the model believes makes the robot overestimate every metre it drives, and averaging does not remove that. Dead reckoning never corrects either kind of error, because it has no measurement to compare against.</p>
<p>Heading error costs the most. A speed error of 2 % puts the robot 2 cm off per metre, along the direction of travel. A heading error of 2° puts it 3.5 cm off per metre, sideways. The sideways error keeps growing with every metre driven after the heading went wrong. So the uncertainty ellipse stretches across the direction of travel rather than along it, and a heading sensor such as a gyro or a compass helps a great deal in practice.</p>
<p><b>The math.</b> Dead reckoning is the prediction half of a Kalman filter, run on its own. The state is the pose $\mu = [x,\ y,\ \theta]^\top$ and its covariance $\Sigma$, a $3 \times 3$ matrix whose diagonal holds the variances and whose off-diagonal entries record how the errors move together.</p>
$$\mu' = g(\mu, u) \qquad\qquad \Sigma' = G\,\Sigma\,G^\top + V M V^\top$$
<p>Speed noise makes the variance $\sigma_x^2$ grow in proportion to $t$. A heading error $\delta\theta$ turns into a sideways position error of about $v\,t\,\delta\theta$, and this stretches the ellipse across the direction of travel.</p>
<p><b>Where it comes from.</b> Linearize the motion model about the estimate. A small pose error $\delta$ becomes $G\delta$ after the step, and the covariance of a linearly transformed error is $G\Sigma G^\top$. The same argument applied to the odometry noise gives $VMV^\top$. <a class="chref" href="#notes=ch2/2-the-motion-model-and-its-jacobians">Derivation: chapter 2 §2</a></p>
<p>The first line moves the estimate. The second moves its uncertainty, in two parts. $G\Sigma G^\top$ carries the uncertainty that is already there through the motion. $G$ is the Jacobian of the motion model with respect to the pose. Its entries $-v\Delta t\sin\theta$ and $v\Delta t\cos\theta$ are the mechanism described above: they turn a heading variance into a sideways position variance. $VMV^\top$ adds this tick's odometry noise, with $M = \operatorname{diag}(\sigma_v^2, \sigma_\omega^2)$ and $V$ the Jacobian with respect to the odometry input. Each tick adds to the covariance and nothing takes away from it, so $\Sigma$ grows without bound. In this lab the odometry noise is</p>
$$\sigma_v = 0.1\,|v| + 0.02 \ \text{m/s} \qquad \sigma_\omega = 0.2\,|\omega| + 0.1\,|v| + 0.02 \ \text{rad/s}$$
<p>times the <b>odometry noise</b> slider. The bias is a 2 % speed scale and a turn-rate offset of 0.01 rad/s per m/s, times the <b>calibration bias</b> slider. The filter builds its $M$ from the same noise formula, times the <b>assumed motion noise</b> slider. It knows nothing about the bias.</p>
<p>Written out, $g$ is the arc model. It holds $v$ and $\omega$ constant for one tick of $\Delta t = 0.05$ s, so the pose moves along a circle of radius $v/\omega$:</p>
$$\begin{aligned} x' &= x + \frac{v}{\omega}\bigl(\sin(\theta + \omega\Delta t) - \sin\theta\bigr) \\ y' &= y - \frac{v}{\omega}\bigl(\cos(\theta + \omega\Delta t) - \cos\theta\bigr) \\ \theta' &= \theta + \omega\Delta t \end{aligned}$$
<p>Below $|\omega| = 10^{-6}$ rad/s the code takes the straight-line limit, $x' = x + v\Delta t\cos\theta$ and $y' = y + v\Delta t\sin\theta$. The simulator moves the true robot with the same function, fed the applied $(v, \omega)$; for the car, $\omega = v\tan\delta / L$. The filter feeds the same function the measured odometry. $G$ and $V$ are the derivatives of the straight-line step. The filter uses them on arcs too, because over 50 ms the difference is second order in $\omega\Delta t$.</p>
$$G = \begin{bmatrix} 1 & 0 & -v\Delta t\sin\theta \\ 0 & 1 & v\Delta t\cos\theta \\ 0 & 0 & 1 \end{bmatrix} \qquad V = \begin{bmatrix} \Delta t\cos\theta & 0 \\ \Delta t\sin\theta & 0 \\ 0 & \Delta t \end{bmatrix} \qquad M = \begin{bmatrix} \sigma_v^2 & 0 \\ 0 & \sigma_\omega^2 \end{bmatrix}$$
<p><b>Reading the result.</b> A filter is called consistent when its covariance matches its real errors. The true error should then fall inside the 2σ band about 95 % of the time. NEES (the normalized estimation error squared) is the squared error measured in units of the filter's own covariance, $e^\top \Sigma^{-1} e$. For three states it should average about 3. The status strip reports NEES averaged over the last 20 s. It flags the filter as overconfident when NEES is above 7.8, which is the 95 % point of $\chi^2$ with three degrees of freedom. The Position error plot draws the error against the 2σ band, and the θ error plot does the same for the heading. The band tells you whether the filter is consistent, and says nothing about how accurate it is. A consistent filter can be metres off, as long as its band is that wide too.</p>
<p><b>Where it drives.</b> The experiments run on an empty floor with only the outer walls (Mission tab, Map → Empty floor). The robot laps an 8 × 5 m rectangle in the middle of it, and the goals repeat until you stop it. Nothing gets in the way, so you see the drift alone, for as long as you let it run. On a closed lap a heading error does not carry the robot away. It turns the true lap about the lap's centre, so the position error rises and falls as the robot goes round, while the heading error keeps growing.</p>

## Try: Dead reckoning on noisy odometry
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"eth"}
Setup: Loads L3 with odometry noise ×1 and calibration bias ×1, and empties the floor. Localization is set to dead reckoning, and the mission repeats a lap of four goals in the middle. The Localize tab and the θ error plot open, and the run starts. The map shows the true robot (solid) and the estimate (blue ring) with its 95 % ellipse. The trails show the lap the robot believes it drives and the one it really drives.
See: The two separate within seconds. The believed lap stays a rectangle, and the true one turns about the middle of the floor a little further every lap. The robot never touches a wall. It drives three laps in the first two minutes, none of them near a wall, and goes five minutes without a contact. The errors against the filter's 2σ band:
| Time | Heading error (°) | Heading 2σ band (°) | Position error (m) |
|---|---|---|---|
| 40 s | 20 | 27 | 0.8 |
| 90 s | 49 | 42 | 4.9 |
| 2 min | — | — | 2.3 |
Look at the heading at 90 s. The error has left its band, and over two minutes it is inside the band only 73 % of the time. NEES, averaged over 20 s, is flagged as overconfident a sixth of the time. The position error comes and goes with the lap. It stays inside its own band 98 % of the time, and that band has grown to ±5 m.
Shows: The noise model describes the noise correctly and leaves out the bias. The turn-rate offset adds the same few hundredths of a radian per second every tick, so the heading error grows steadily in one direction. Nothing in Σ accounts for it, and the filter is overconfident about where the robot points. The position error stays inside its band here only because a closed lap undoes much of what a heading error does to position. On a route that does not come back, the same heading error carries the robot away. On a real vehicle the bias comes from the wheel-radius calibration, the tyre pressure and the load in the back. Each of these changes the effective wheel geometry without the software knowing. The proportions above are for this run. With another seed the noise can hide the offset for the first two minutes, or it can add to it. On seeds 2, 3 and 8, for instance, the heading stays inside its band 95 % of the time or more. The offset always turns the heading the same way, though, and over ten minutes the heading error is outside its band 30 % to 95 % of the time on seeds 1 to 8.
Predict: Let the laps run for ten minutes on dead reckoning with noise ×1 and bias ×1. Which error spends more of its time outside the filter's 2σ band?
- The heading error: the filter is overconfident about where the robot points
- The position error: the robot is metres away from where the filter says
- Neither: the noise model covers both, and each stays inside its band
Answer: 0

## Try: Calibrated wheels
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true,"odoB":0},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"eth"}
Setup: The same laps with the calibration bias slider at ×0 (Sensors tab, Odometry). The odometry is as noisy as before, but now the noise is the only error.
See: The true lap still wanders, but slowly. The heading error is 9° at 40 s and 13° at two minutes, against a 2σ band of 27° and then 47°. It is inside the band 99 % of the time, and NEES is never flagged. The position error over the two minutes is 1.5 m RMS, against 2.2 m with the bias.
Shows: Without the bias, the same filter is consistent. The error is still there and still grows, because random noise does a random walk. Σ grows with it, since Σ is built from this same noise. So dead reckoning is not overconfident by nature. A filter becomes overconfident when the vehicle makes errors that the filter does not model. The 95 % figure is an average over many runs, and a single run can fall short of it. On seed 8 the heading error spends a third of the first two minutes just outside its band with no bias at all. Over ten minutes, though, it is inside 90 % of the time or more on every seed from 1 to 8.
Predict: With the bias at ×0 and the same noise, what does the heading error do against its band?
- Still leaves the band: dead reckoning is always overconfident
- Stays inside the band: what is left is the noise the filter models
- Shrinks to zero: without a bias there is nothing to drift
Answer: 1

## Try: Noise ×3
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true,"odoK":3},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"pos"}
Setup: The laps of the first experiment with the odometry noise slider at ×3 (Sensors tab, Odometry). The filter's assumed noise follows the slider, so the standard deviations in its Σ grow three times faster. The bias is unchanged. The plot is back on Position error.
See: The band is now wide. σ is about 2 m at 10 s and 8 m by a minute, and the 2σ band is ±17 m at two minutes, wider than the floor. All the way through, that is three to three and a half times the band of the ×1 run. The error itself also grows a lot, but not by any fixed factor:
| Time | Position error, noise ×3 (m) | Position error, noise ×1 (m) |
|---|---|---|
| 10 s | 1.8 | 0.2 |
| 40 s | 3.4 | 0.8 |
| 1 min | 6.1 | 1.6 |
| 90 s | 7.6 | 4.9 |
| RMS over 2 min | 4.0 | 2.2 |
Read down the rows. The ratio starts at nine times at 10 s and then shrinks. The ×3 error is more than three times the ×1 error for only about 40 % of the two minutes. The error lies inside the position band 100 % of the time, and the heading error stays inside its band too. NEES is above 7.8 for a stretch between 12 and 33 s, then falls to about 1 by the end, so the filter has become underconfident.
Shows: The slider scales the band, because Σ is built from the noise model. The error is one random draw. It has two parts: the bias, which the slider leaves alone, and the noise, which the slider triples. The tripled noise sometimes adds to the bias and sometimes cancels it. With another seed the same experiment gives an error anywhere from half to three times the ×1 run's (RMS over two minutes, seeds 1 to 8). So the error ratio on one run says little, while the band ratio holds on every seed. Consistency compares the error with the band, and you can change either side. Raising the assumed noise is the cheapest way to make a filter consistent, and this run is consistent: the robot really could be anywhere on the floor. That does nothing for the planner, though, because a pose known to ±17 m cannot steer down a 2 m aisle. The useful fixes shrink the error instead of widening the band. One is an external measurement (next lesson). Another is to put the bias into the state so the filter can learn it, which only works once there is a measurement to learn it from.
Predict: With the odometry noise slider at ×3, what reliably comes out about three times larger than in the ×1 run?
- The 2σ band: the filter's Σ is built from the noise model, which follows the slider
- The position error: three times the noise means three times the error
- Neither: the bias dominates, so nothing changes much
Answer: 0

## Code: locPredict, the prediction step
snippet: ekf-predict
focus: const n = integ(e.x, e.y, th, v, w, DT); … for (let i = 0; i < 9; i++) Pn[i] += VMV[i];
example: loc/dr
Note: The arc is integ. The lines after it are the lesson's covariance growth, $G\Sigma G^\top + VMV^\top$, with sigV and sigW the assumed noise. Dead reckoning runs these lines and nothing else, so Σ only ever grows. Edit and run loads the dead-reckoning example, which is the arc alone. Replace the arc by a straight step of v·dt and see how little changes at 50 ms.

## Think about
Q: Why does the ellipse stretch across the direction of travel rather than along it?
A: Speed noise and speed bias act along the heading, and their effect on position grows with distance driven. Heading noise acts across the heading, and its effect grows with distance driven <i>times</i> the heading error, which itself keeps growing. The sideways term wins after the first few metres, and the $G\Sigma G^\top$ step carries it forward every tick.
Q: On L1 the odometry is exact (noise 0, bias 0). What does Σ do there?
A: It still grows. The filter's assumed noise is the slider value, but never less than ×0.25. A filter cannot know that its odometry is perfect, and a Σ that stopped growing would leave no room for a correction later. Exact odometry with a growing Σ makes the filter underconfident, and that is the safer way to be wrong.
Q: What would you add to the state so the filter could learn the 2 % bias?
A: A scale factor on the speed, and one on the turn rate, each with a small process noise so it can drift slowly. Dead reckoning alone cannot estimate them, because nothing tells a biased wheel apart from a longer trip. With beacons in the loop, the innovations (the differences between the measured and the predicted beacon readings) keep the same sign, and the filter can put that down to the scale state. Most deployed vehicle filters carry these states.

## Check yourself
Q: The heading estimate is 2° off and the robot drives 25 m straight at that heading. Using sideways error ≈ distance × heading error (in radians), how far off sideways is the estimate, in metres?
Answer: 0.873
Tolerance: 0.02
Unit: m
How: $2° = 0.0349$ rad, and $25\ \text{m} \times 0.0349 = 0.87$ m sideways. That is the lesson's 3.5 cm per metre.
