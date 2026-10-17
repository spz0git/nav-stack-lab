group: loc
title: Dead reckoning drifts, and knows it

<p><b>Why this matters.</b> Every wheeled robot has odometry: encoders on the wheels report how far each one turned, and from that the robot computes its own motion. Between external fixes, which can be a landmark every few seconds or a GPS fix lost for a minute in a tunnel, odometry is all there is. How fast it drifts decides how often the vehicle needs an outside reference. Whether it <i>knows</i> how far it has drifted decides something more important: whether the rest of the stack can act on the uncertainty, slow down, widen its safety margins, or refuse to plan at all. This lesson is about that second question. The first experiment shows a filter whose uncertainty is wrong, the second what makes it wrong, and the third a filter whose uncertainty is right and useless.</p>
<p><b>The idea.</b> Dead reckoning integrates the odometry through a motion model. Each tick, 50 ms here, the arc model takes the current pose and the odometry input <i>u</i>, the measured speed <i>v</i> and turn rate ω, and moves the pose along a circular arc. Two kinds of error enter. <i>Noise</i> is random from tick to tick: a slightly high reading now, a slightly low one next, partly averaging out but never completely, so the error does a random walk. <i>Bias</i> is systematic: a wheel 2 % larger than the model believes makes the robot overestimate every metre it drives, and no averaging removes that. Nothing in dead reckoning ever corrects either; there is no measurement to compare against.</p>
<p>Heading error is the expensive kind. A speed error of 2 % puts the robot 2 cm off per metre, along the direction of travel. A heading error of 2° puts it 3.5 cm off per metre, sideways, and the sideways error keeps growing with every metre driven after the heading went wrong. That is why the uncertainty ellipse stretches across the direction of travel rather than along it, and why heading sensors (a gyro, a compass) buy so much in practice.</p>
<p><b>The math.</b> Dead reckoning is the prediction half of a Kalman filter run on its own. The state is the pose μ = [<i>x</i>, <i>y</i>, θ] and its covariance Σ, a 3 × 3 matrix whose diagonal holds the variances and whose off-diagonal entries record how the errors move together.</p>
<div class="eq">μ' = g(μ, u)            Σ' = G Σ Gᵀ + V M Vᵀ
σ_x² grows ∝ t from speed noise; a heading error θ turns into position error ∝ v·t·θ, so the ellipse stretches across the direction of travel</div>
<p><b>Where it comes from.</b> Linearize the motion model about the estimate: a small pose error δ becomes <i>G</i>δ after the step, and the covariance of a linearly transformed error is <i>G</i>Σ<i>G</i>ᵀ; the same argument on the odometry noise gives <i>V</i><i>M</i><i>V</i>ᵀ. <a class="chref" href="#notes=ch2/2-the-motion-model-and-its-jacobians">Derivation: chapter 2 §2</a></p>
<p>The first line moves the estimate. The second moves its uncertainty, in two parts. <i>G</i> Σ <i>G</i>ᵀ carries the uncertainty already there through the motion: <i>G</i> is the Jacobian of the motion model with respect to the pose, and its entries −<i>v</i>Δ<i>t</i> sin θ and <i>v</i>Δ<i>t</i> cos θ are exactly the mechanism above, a heading variance turning into position variance sideways. <i>V</i> <i>M</i> <i>V</i>ᵀ adds this tick's odometry noise, with <i>M</i> = diag(σ<sub>v</sub>², σ<sub>ω</sub>²) and <i>V</i> the Jacobian with respect to the odometry input. Every tick adds, nothing subtracts: Σ grows without bound. In this lab the odometry noise is σ<sub>v</sub> = 0.1 |<i>v</i>| + 0.02 m/s and σ<sub>ω</sub> = 0.2 |ω| + 0.1 |<i>v</i>| + 0.02 rad/s, times the <b>odometry noise</b> slider; the bias is a 2 % speed scale and a turn-rate offset of 0.01 rad/s per m/s, times the <b>calibration bias</b> slider. The filter's <i>M</i> is built from the same noise formula times the <b>assumed motion noise</b> slider. It knows nothing about the bias.</p>
<p>Written out, <i>g</i> is the arc model: it holds <i>v</i> and ω constant for one tick Δ<i>t</i> = 0.05 s, so the pose moves along a circle of radius <i>v</i>/ω, and below |ω| = 10⁻⁶ rad/s the code takes the straight-line limit. The simulator moves the true robot with the same function and the applied (<i>v</i>, ω), with ω = <i>v</i> tan δ/<i>L</i> for the car; the filter feeds it the measured odometry. <i>G</i> and <i>V</i> are the derivatives of the straight-line step, which the filter uses on arcs too: over 50 ms the difference is second order in ωΔ<i>t</i>.</p>
<div class="eq">x' = x + (v/ω)(sin(θ + ωΔt) − sin θ)      ω → 0:  x' = x + vΔt cos θ
y' = y − (v/ω)(cos(θ + ωΔt) − cos θ)              y' = y + vΔt sin θ
θ' = θ + ωΔt
G = [1  0  −vΔt sin θ;  0  1  vΔt cos θ;  0  0  1]     V = [Δt cos θ  0;  Δt sin θ  0;  0  Δt]     M = diag(σ_v², σ_ω²)</div>
<p><b>Reading the result.</b> A filter is called consistent when its covariance matches its real errors: the true error should fall inside the 2σ band about 95 % of the time, and NEES, the squared error measured in units of the filter's own covariance, should average about 3 for three states. The status strip reports NEES over the last 20 s and flags the filter as overconfident above 7.8, the 95 % point of χ² with three degrees of freedom. The Position error plot draws the error against the 2σ band, and the θ error plot does the same for the heading. The band is the filter's honesty, not its accuracy: a consistent filter can be metres off and still be telling the truth about it.</p>
<p><b>Where it drives.</b> The experiments run on an empty floor (Mission tab, Map → Empty floor: only the outer walls) and the robot laps an 8 × 5 m rectangle in the middle of it, the goals repeating until you stop it. Nothing gets in the way, so the drift is all there is to see, for as long as you let it run. On a closed lap a heading error does not carry the robot away: it turns the true lap about the lap's centre, so the position error rises and falls as the robot goes round while the heading error keeps growing.</p>

## Try: Dead reckoning on noisy odometry
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"eth"}
Setup: Loads L3 with odometry noise ×1 and calibration bias ×1, empties the floor, sets localization to dead reckoning and the mission to repeat a lap of four goals in the middle, opens the Localize tab and the θ error plot, and runs. The map shows the true robot (solid) and the estimate (blue ring) with its 95 % ellipse; the trails show the lap the robot believes it drives and the one it really drives.
See: The two separate within seconds. The believed lap stays a rectangle; the true one turns about the middle of the floor, a little further every lap, and the robot never touches a wall (three laps in the first two minutes, none of them near a wall, and five minutes without a contact). The heading error is 20° at 40 s against a 2σ band of 27°, then leaves it: 49° at 90 s against 42°, and over two minutes it is inside the band only 73 % of the time. NEES, averaged over 20 s, is flagged as overconfident a sixth of the time. The position error comes and goes with the lap, 0.8 m at 40 s, 4.9 m at 90 s, 2.3 m at two minutes, and stays inside its own band, which has grown to ±5 m, 98 % of the time.
Shows: The noise model is right about the noise and silent about the bias. The turn-rate offset adds the same few hundredths of a radian per second every tick, so the heading error grows steadily in one direction, and nothing in Σ accounts for it: the filter is overconfident about where it points. The position band survives here only because a closed lap undoes much of what a heading error does to position; on a route that does not come back, the same heading error carries the robot away. On a real vehicle the bias is the wheel-radius calibration, tyre pressure, and the load in the back, all of which change the effective wheel geometry without telling the software.
Predict: After two minutes of laps on dead reckoning with noise ×1 and bias ×1, which error spends much of its time outside the filter's 2σ band?
- The heading error: the filter is overconfident about where the robot points
- The position error: the robot is metres away from where the filter says
- Neither: the noise model covers both
Answer: 0

## Try: Calibrated wheels
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true,"odoB":0},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"eth"}
Setup: The same laps with the calibration bias slider at ×0 (Localize tab, Odometry): the odometry is as noisy as before, and now the noise is all there is.
See: The true lap still wanders, but slowly: the heading error is 9° at 40 s and 13° at two minutes, against a 2σ band of 27° and then 47°. It is inside the band 99 % of the time and NEES is never flagged. The position error over the two minutes is 1.5 m RMS, against 2.2 m with the bias.
Shows: Take the bias away and the same filter is honest. The error is still there and still grows, since random noise does a random walk, but Σ grows with it, because Σ is built from exactly this noise. Overconfidence is not a property of dead reckoning; it is the gap between the errors a filter models and the errors the vehicle makes.
Predict: With the bias at ×0 and the same noise, what does the heading error do against its band?
- Still leaves the band: dead reckoning is always overconfident
- Stays inside the band: what is left is the noise the filter models
- Shrinks to zero: without a bias there is nothing to drift
Answer: 1

## Try: Noise ×3
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true,"odoK":3},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"pos"}
Setup: The laps of the first experiment with the odometry noise slider at ×3 (Localize tab, Odometry). The filter's assumed noise follows the slider, so its Σ grows three times faster in standard deviation; the bias is unchanged. The plot is back on Position error.
See: The band is now wide: σ is about 2 m at 10 s, 8 m by a minute, and the 2σ band is ±17 m at two minutes, wider than the floor. The actual error grows less than the band: 4.0 m RMS over the two minutes against 2.2 m at ×1, about twice, not three times. The error lies inside the position band 100 % of the time, the heading error inside its band too, and NEES, after a stretch above 7.8 between 12 and 33 s, falls to about 1 by the end: the filter has become underconfident.
Shows: Consistency is a ratio, and either side of it can be adjusted. Raising the assumed noise is the cheapest way to make a filter honest, and this run is honest: it really could be anywhere on the floor. But that honesty buys the planner nothing; a pose known to ±17 m cannot steer down a 2 m aisle. The useful fixes are the ones that shrink the error, not the ones that widen the band: an external measurement (next lesson), or putting the bias into the state so the filter can learn it, which only works once there is a measurement to learn it from.
Predict: With the odometry noise slider at ×3, what happens to the actual position error compared with the ×1 run?
- About three times larger
- Smaller, because the filter widens its band
- Larger, but well short of three times: about twice
Answer: 2

## Code: locPredict, the prediction step
snippet: ekf-predict
focus: const n = integ(e.x, e.y, th, v, w, DT); … for (let i = 0; i < 9; i++) Pn[i] += VMV[i];
example: loc/dr
Note: The arc is integ; the lines after it are the lesson's covariance growth, G Σ Gᵀ + V M Vᵀ, with sigV and sigW the assumed noise. Dead reckoning runs these lines and nothing else, so Σ only ever grows. Edit and run: the dead-reckoning example, which is the arc alone; replace the arc by a straight step of v·dt and see how little changes at 50 ms.

## Think about
Q: Why does the ellipse stretch across the direction of travel rather than along it?
A: Speed noise and speed bias act along the heading, and their effect on position grows with distance driven. Heading noise acts across the heading, and its effect grows with distance driven <i>times</i> the heading error, which itself keeps growing. The sideways term wins after the first few metres, and the <i>G</i> Σ <i>G</i>ᵀ step carries it forward every tick.
Q: On L1 the odometry is exact (noise 0, bias 0). What does Σ do there?
A: It still grows. The filter's assumed noise is the slider value with a floor of ×0.25, because a filter cannot know that its odometry is perfect, and a Σ that stopped growing would leave no room for a correction later. Exact odometry with a growing Σ is underconfident, which is the safe direction to be wrong in.
Q: What would you add to the state so the filter could learn the 2 % bias?
A: A scale factor on the speed (and one on the turn rate), with a small process noise so it can drift slowly. Dead reckoning alone cannot estimate it, since nothing distinguishes a biased wheel from a longer trip, but with beacons in the loop the innovations are consistently one-signed and the filter can attribute that to the scale state. Most deployed vehicle filters carry exactly these states.

## Check yourself
Q: The heading estimate is 2° off and the robot drives 25 m straight at that heading. Using sideways error ≈ distance × heading error (in radians), how far off sideways is the estimate, in metres?
Answer: 0.873
Tolerance: 0.02
Unit: m
How: 2° = 0.0349 rad; 25 m × 0.0349 = 0.87 m sideways, the 3.5 cm per metre of the lesson
