group: loc
title: Dead reckoning drifts, and knows it

<p><b>Why this matters.</b> Every wheeled robot has odometry: encoders on the wheels report how far each one turned, and from that the robot computes its own motion. Between external fixes, which can be a landmark every few seconds or a GPS fix lost for a minute in a tunnel, odometry is all there is. How fast it drifts decides how often the vehicle needs an outside reference. Whether it <i>knows</i> how far it has drifted decides something more important: whether the rest of the stack can act on the uncertainty, slow down, widen its safety margins, or refuse to plan at all. This lesson is about that second question. The first experiment shows a filter whose uncertainty is wrong; the second shows one whose uncertainty is right and useless.</p>
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
<p><b>Reading the result.</b> A filter is called consistent when its covariance matches its real errors: the true error should fall inside the 2σ band about 95 % of the time, and NEES, the squared error measured in units of the filter's own covariance, should average about 3 for three states. The status strip reports NEES over the last 20 s and flags the filter as overconfident above 7.8, the 95 % point of χ² with three degrees of freedom. The Position error plot draws the error against the 2σ band. The band is the filter's honesty, not its accuracy: a consistent filter can be metres off and still be telling the truth about it.</p>

## Try: Dead reckoning on noisy odometry
cfg: {"sim":true,"level":2,"set":{"loc":"dr"},"tab":"loc","plot":"pos"}
Setup: Loads L3 with odometry noise ×1 and calibration bias ×1, sets localization to dead reckoning, opens the Localize tab and the Position error plot, and runs. The map shows the true robot (solid) and the estimate (blue ring) with its 95 % ellipse.
See: The two separate within seconds. After 10 s the estimate is about 1 m off while the band claims 0.6 m; by 40 s it is 2.4 m off against a 1.2 m σ. Over a two-minute run the error is inside the 2σ band only about 60 % of the time, and NEES sits near 10, so the status strip flags the filter as overconfident almost throughout. The ellipse is long across the direction of travel. The consequences are visible on the map: the robot clips shelves it believes are elsewhere, and the mission skips goal after goal because the planner is planning from a pose that does not exist.
Shows: The noise model is right about the noise and silent about the bias. Random noise does partly average and is covered by Σ; the 2 % speed bias and the turn-rate offset accumulate in one direction every tick, and nothing in the covariance accounts for them. A filter that models noise but not bias is overconfident by construction. On a real vehicle this is the wheel-radius calibration, tyre pressure, and the load in the back, all of which change the effective wheel size without telling the software.
Predict: After 40 s of dead reckoning with noise ×1 and bias ×1, how will the true error compare with the filter's 2σ band?
- Outside the band much of the time: the filter is overconfident
- Inside the band almost always: the noise model covers it
- Far inside the band: the filter is underconfident
Answer: 0

## Try: Noise ×3
cfg: {"sim":true,"level":2,"set":{"loc":"dr","odoK":3},"tab":"loc","plot":"pos"}
Setup: The same run with the odometry noise slider at ×3 (Localize tab, Odometry). The filter's assumed noise follows the slider, so its Σ grows three times faster in standard deviation; the bias is unchanged.
See: The band is now wide: σ is about 1.7 m at 10 s, 6 m by a minute and 10 m by two minutes, about the width of the warehouse. The actual error is similar to the first run, 1 to 2.5 m, because the bias is the same and extra random noise mostly averages. The error now lies inside the band 100 % of the time and NEES falls below 1 by the end: the filter has become underconfident.
Shows: Consistency is a ratio, and either side of it can be adjusted. Raising the assumed noise is the cheapest way to make a filter honest, and this run is honest: it really could be anywhere within 10 m. But that honesty buys the planner nothing; a pose known to ±10 m cannot steer down a 2 m aisle. The useful fixes are the ones that shrink the error, not the ones that widen the band: an external measurement (next lesson), or putting the bias into the state so the filter can learn it, which only works once there is a measurement to learn it from.
Predict: With the odometry noise slider at ×3, what happens to the actual position error compared with the ×1 run?
- About three times larger
- Smaller, because the filter widens its band
- About the same, 1 to 2.5 m
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
