group: per
title: Tracking people: from lidar hits to tracks

<p><b>Why this matters.</b> Everything that moves has to be found, followed and predicted, because the planner needs where a person will be, not where their hits are now. On a real robot there is no ground truth to compare against, only this chain: detection (which hits are not the map), association (which detection is which person), tracking (a filter per person) and prediction. Each link has a classic failure, and the one that matters most for a speed planner is velocity: it is never measured, only inferred, so it is late and noisy, and the prediction built on it points the wrong way for a second after every change of pace.</p>
<p><b>The idea.</b> A person is a cluster of lidar hits that the static map cannot explain. Each confirmed person gets a constant-velocity Kalman filter: the state is position and velocity, the prediction moves the position by the velocity, and the only measurement is a position. Detections are matched to predicted tracks by Mahalanobis distance inside a gate, nearest first. Three hits confirm a track, and once confirmed it coasts on its prediction for a second when the person is hidden. The prediction handed to the planner extrapolates the velocity and inflates the radius with time, to cover the error in a velocity that was only inferred.</p>
$$\begin{aligned} x &= [p_x,\ p_y,\ v_x,\ v_y]^\top \qquad x' = F x \qquad R \text{ from white acceleration } \sigma_a \\ d^2 &< 9.21 \ \text{(the gate)} \qquad p(t) = p + v\,t \qquad r(t) = r + g\,t \ \text{(the prediction)} \end{aligned}$$
$$F = \begin{bmatrix} I & \Delta t\,I \\ 0 & I \end{bmatrix} \qquad R = \sigma_a^2 \begin{bmatrix} \tfrac{\Delta t^4}{4} I & \tfrac{\Delta t^3}{2} I \\ \tfrac{\Delta t^3}{2} I & \Delta t^2 I \end{bmatrix} \qquad z = p + \text{noise} \qquad H = \begin{bmatrix} I & 0 \end{bmatrix} \qquad Q = \sigma_z^2 I$$
$$d^2 = \frac{\lVert z - \hat p \rVert^2}{P_{pp} + \sigma_z^2} \qquad k_p = \frac{P_{pp}}{P_{pp} + \sigma_z^2} \qquad k_v = \frac{P_{pv}}{P_{pp} + \sigma_z^2}$$
<p>Here $\Delta t$ is the time since the last scan (0.1 s), $z$ the centre of a detection, $\hat p$ the track's predicted position, and $P_{pp}$, $P_{pv}$ the position variance and position–velocity covariance, which both axes share; the update adds $k_p(z - \hat p)$ to the position and $k_v(z - \hat p)$ to the velocity.</p>
<p><b>Where it comes from.</b> Integrating a random acceleration $a$ over $\Delta t$ adds $\tfrac{\Delta t^2}{2} a$ to position and $\Delta t\,a$ to velocity, so $R$ is $\sigma_a^2$ times the outer product of $[\Delta t^2/2,\ \Delta t]$. With position-only measurements the Kalman gain settles to the $\alpha$–$\beta$ filter's steady state, set by one number, the tracking index $\lambda = \sigma_a \Delta t^2 / \sigma_z$ (0.08 here): about a third of each innovation goes into position and the velocity error decays with a time constant of about 0.5 s. <a class="chref" href="#notes=ch3/5-tracking-a-constant-velocity-kalman-filter">Derivation: chapter 3 §5</a> · detection: <a class="chref" href="#notes=ch3/4-finding-people-in-a-scan">§4</a> · prediction: <a class="chref" href="#notes=ch3/6-prediction-and-why-the-radius-grows">§6</a></p>
<p><b>What the lab does.</b> Hits are unexplained when the known map has nothing within 0.25 m (or, on a built map, no well-seen occupied cell next to them). Clusters are grown over consecutive beams (0.45 m jump, one beam gap), discarded when wider than 1.2 m, and the centroid is pushed away from the robot because lidar only sees the near side. The tracker runs at the lidar rate, 10 Hz, with $\sigma_z = 0.1$ m and the process noise slider $\sigma_a$ (0.8 m/s² by default). Prediction uses a 4 s horizon and inflates the radius by 0.1 m/s. The ST graph in the plot area shows the speed planner's view of the predictions along the path.</p>

## Try: Lidar tracker
cfg: {"sim":true,"level":4,"tab":"per"}
Setup: L5, the busy floor: four people at 0.6 to 0.9 m/s, unlabeled beacons, the lidar tracker feeding the speed planner. Perceive tab.
See: Confirmed tracks appear as solid rings with a line to their predicted position and dashed, fading circles one per second ahead; tentative tracks are dotted. For most of the run the metrics' Agent tracks line shows two confirmed tracks or fewer, since the shelves hide most people, and for about a second, 53 s in, six for four people: a person seen around a corner briefly becomes two. The mean error of the tracked velocity against the true one is about 0.14 m/s, and the speed planner yields four times and escalates to a replan twice. The mission reaches all five goals in about 120 s with one contact (counted up to Mission complete): a 0.55 m overlap at 52 s, a person walking down the central cross aisle into the robot's side as it slows and turns.
Shows: Tracks from lidar are good enough to drive by and never clean. The doubles and the velocity error are the price of inferring motion from positions 0.1 s apart. The contact is not a tracking failure: that person had been tracked for eight seconds, but the speed planner can only slow down along the path, and a person crossing into the robot's side is not avoided by slowing. Compare a track's prediction line with the person's actual motion when someone turns around: the line follows about half a second later.
Predict: A person reaches the end of their walk and turns back. Where does their track's prediction line point just after the turn?
- Still the old way, for about half a second: the velocity is inferred from positions, so it lags
- The new way at once: the lidar sees the person turn
- Nowhere: the track is dropped and a new one starts
Answer: 0

## Try: Ground truth tracks
cfg: {"sim":true,"level":4,"set":{"agents":"truth"},"tab":"per"}
Setup: The same run with the tracker replaced by the simulator's true positions and velocities: no detection, no association, no lag.
See: The velocity error is zero and exactly four tracks exist. The run is not simply better: no contact instead of one, but at 57 s, turning away from a person crossing its aisle, the robot clips the end of a shelf and stays stuck against it; it replans three times (once for the person, twice as stuck), skips goal 3, and reaches four of five goals in about 127 s.
Shows: The difference between the two runs is what tracking costs, and it is smaller than the difference between two seeds: over seeds 2 to 5, 8 and 11, ground truth gives no contact or one where the tracker gives one (three on seed 11), and on two of those seeds it too pins the robot against a shelf and ends a goal short. Perfect tracks make the speed planner's decisions sharper, not the floor less crowded; a sharp yield next to a shelf end can still leave the robot pinned against it. Tracking quality is one term in the contact count, and on this level not the dominant one.
Predict: Replace the tracker with the simulator's true positions and velocities. What changes for certain?
- The tracks: exactly four, with no velocity error; the mission itself is not reliably better
- The contacts: with perfect tracks the robot never touches a person
- Nothing: the tracker was already perfect
Answer: 0

## Try: Prediction frozen
cfg: {"sim":true,"level":4,"set":{"agPred":"static"},"tab":"per","plot":"st"}
Setup: The lidar tracker again, but the planner is handed each person's current position with zero velocity and a constant radius. The ST graph shows the result.
See: The dashed prediction circles collapse onto the track and the prediction line vanishes. The speed planner reacts only once a person is already on the path, so it brakes late: three contacts during the mission, against the tracker's one, with the same five goals reached (two or three on seeds 2 to 5, against one). In the ST graph the blocked regions are horizontal bars (a person in one place for the whole horizon) instead of the sloping bands of a moving one.
Shows: Prediction is worth exactly the reaction time it buys. Without it the planner is a reflex, and a reflex at 0.8 m/s against people at 0.9 m/s loses. The constant-velocity extrapolation is crude, and crude is enough here: people walk in straight lines for the 4 s that matter.
Predict: Hand the planner each person's current position with zero velocity. What happens to the contact count?
- It rises: the planner brakes late
- It stays the same: the speed planner reacts to position anyway
- It falls: a wrong velocity was misleading the planner
Answer: 0

## Code: agTrack, the constant-velocity filter
snippet: ag-track
focus: t.y += t.vy * dt; // predict
focus: A.tracks = A.tracks.filter
example: pred/cv
Note: The predict line moves each track by its velocity; the filter line coasts a confirmed track through one second without hits and drops a tentative one after a quarter. Edit and run: the predictor example receives these tracks; make it ignore vx, vy (the standing-still example does) and see what the speed planner loses.

## Think about
Q: Why is velocity so much harder than position for this tracker?
A: Position is measured directly every 0.1 s with 10 cm noise. Velocity is the difference of two such positions divided by 0.1 s: a 10 cm noise becomes a 1 m/s noise, larger than the walking speed. The filter averages that down over many updates, which is where the lag comes from. A sensor that measured velocity (Doppler radar) changes the problem completely.
Q: What does raising $\sigma_a$ do, and what would you set it to for a sprinting child?
A: It tells the filter that velocity can change a lot between updates, so it trusts recent innovations more: the track follows a turn faster and jitters more in between. For a child, raise it until the lag is acceptable and accept the jitter, or better, grow the predicted radius faster to cover the uncertainty rather than chase it.
Q: A track is confirmed after three hits and coasts for one second. Why those numbers?
A: Three hits at 10 Hz is 0.3 s, long enough that a single stray cluster or a wall corner never becomes a person, short enough that a person stepping out from behind a pillar is tracked before they reach the path. One second of coasting is about one occluding pillar at walking speed; longer and a person who really left keeps blocking the planner.

## Check yourself
Q: A track's predicted position variance $P_{pp}$ is 0.03 m² and the measurement noise is $\sigma_z = 0.1$ m. What is the position gain $k_p$?
Answer: 0.75
Tolerance: 0.02
Unit: 
How: $k_p = P_{pp}/(P_{pp} + \sigma_z^2) = 0.03/(0.03 + 0.01) = 0.75$: three quarters of the innovation goes into the position
