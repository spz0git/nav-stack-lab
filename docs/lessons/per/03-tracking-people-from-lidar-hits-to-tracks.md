group: per
title: Tracking people: from lidar hits to tracks

<p><b>Why this matters.</b> Everything that moves has to be found, followed and predicted. The planner needs to know where a person will be, and the hits only say where the person is now. On a real robot there is no ground truth to compare against. There is only a chain of four steps: detection (which hits the map does not explain), association (which detection belongs to which person), tracking (a filter for each person) and prediction. Each step has a well-known way to fail. For a speed planner the one that matters most is velocity. The lidar never measures it, so the tracker has to infer it from positions, and the result is late and noisy. The prediction built on it points the wrong way for a second after every change of pace.</p>
<p><b>The idea.</b> A person is a cluster of lidar hits that the static map cannot explain. Each confirmed person gets a constant-velocity Kalman filter. Its state is position and velocity, its prediction moves the position by the velocity, and its only measurement is a position. Detections are matched to the predicted tracks by Mahalanobis distance inside a gate, nearest first. Three hits confirm a track. A confirmed track coasts on its prediction for a second when the person is hidden. The prediction handed to the planner extrapolates the velocity and inflates the person's radius with time, to cover the error in a velocity that was only inferred.</p>
$$\begin{aligned} x &= [p_x,\ p_y,\ v_x,\ v_y]^\top \qquad x' = F x \qquad R \text{ from white acceleration } \sigma_a \\ d^2 &< 9.21 \ \text{(the gate)} \qquad p(t) = p + v\,t \qquad r(t) = r + g\,t \ \text{(the prediction)} \end{aligned}$$
$$F = \begin{bmatrix} I & \Delta t\,I \\ 0 & I \end{bmatrix} \qquad R = \sigma_a^2 \begin{bmatrix} \tfrac{\Delta t^4}{4} I & \tfrac{\Delta t^3}{2} I \\ \tfrac{\Delta t^3}{2} I & \Delta t^2 I \end{bmatrix} \qquad z = p + \text{noise} \qquad H = \begin{bmatrix} I & 0 \end{bmatrix} \qquad Q = \sigma_z^2 I$$
$$d^2 = \frac{\lVert z - \hat p \rVert^2}{P_{pp} + \sigma_z^2} \qquad k_p = \frac{P_{pp}}{P_{pp} + \sigma_z^2} \qquad k_v = \frac{P_{pv}}{P_{pp} + \sigma_z^2}$$
<p>Here $\Delta t$ is the time since the last scan (0.1 s), $z$ the centre of a detection, $\hat p$ the track's predicted position, and $P_{pp}$, $P_{pv}$ the position variance and position–velocity covariance, which both axes share. The update adds $k_p(z - \hat p)$ to the position and $k_v(z - \hat p)$ to the velocity.</p>
<p><b>Where it comes from.</b> Integrating a random acceleration $a$ over $\Delta t$ adds $\tfrac{\Delta t^2}{2} a$ to position and $\Delta t\,a$ to velocity, so $R$ is $\sigma_a^2$ times the outer product of $[\Delta t^2/2,\ \Delta t]$. When only the position is measured, the Kalman gain settles to the steady state of an $\alpha$–$\beta$ filter. One number sets that steady state, the tracking index $\lambda = \sigma_a \Delta t^2 / \sigma_z$, which is 0.08 here. About a third of each innovation goes into the position, and the velocity error decays with a time constant of about 0.5 s. <a class="chref" href="#notes=ch3/5-tracking-a-constant-velocity-kalman-filter">Derivation: chapter 3 §5</a> · detection: <a class="chref" href="#notes=ch3/4-finding-people-in-a-scan">§4</a> · prediction: <a class="chref" href="#notes=ch3/6-prediction-and-why-the-radius-grows">§6</a></p>
<p><b>What the lab does.</b> A hit is unexplained when the known map has nothing within 0.25 m of it, or, on a map the robot builds, when no well-seen occupied cell is next to it. Clusters are grown over consecutive beams, allowing a jump of 0.45 m and a gap of one beam. A cluster wider than 1.2 m is discarded. The centroid is pushed away from the robot, because the lidar sees only the near side of a person. The tracker runs at the lidar rate, 10 Hz, with $\sigma_z = 0.1$ m and the process noise slider $\sigma_a$ (0.8 m/s² by default). Prediction uses a 4 s horizon and inflates the radius by 0.1 m/s. The ST graph in the plot area (distance along the path against time) shows the speed planner's view of the predictions along the path.</p>

## Try: Lidar tracker
cfg: {"sim":true,"level":4,"tab":"per"}
Setup: L5, the busy floor, with four people walking at 0.6 to 0.9 m/s, unlabeled beacons, and the lidar tracker feeding the speed planner. The Perceive tab is open.
See: A confirmed track is drawn as a solid ring, with a line to its predicted position and dashed, fading circles one second apart ahead of it. A tentative track is dotted. For most of the run the Agent tracks line in the metrics shows two confirmed tracks or fewer, because the shelves hide most people. For about a second, 53 s in, it shows six tracks for four people, because a person seen around a corner briefly becomes two. The tracked velocity is off from the true one by about 0.14 m/s on average. The speed planner yields four times and twice escalates to a replan. The mission reaches all five goals in about 120 s with one contact, counted up to Mission complete. The contact is a 0.55 m overlap at 52 s: a person walks down the central cross aisle into the robot's side as the robot slows and turns.
Shows: Tracks from lidar are good enough to drive by, but they are never clean. The doubled tracks and the velocity error come from inferring motion from positions 0.1 s apart. The contact was not a tracking failure, since that person had been tracked for eight seconds. The speed planner can only slow down along the path, and slowing down does not avoid a person who walks into the robot's side. When someone turns around, compare their track's prediction line with how they actually move. The line follows about half a second later.
Predict: A person reaches the end of their walk and turns back. Where does their track's prediction line point just after the turn?
- Still the old way, for about half a second: the velocity is inferred from positions, so it lags
- The new way at once: the lidar sees the person turn
- Nowhere: the track is dropped and a new one starts
Answer: 0

## Try: Ground truth tracks
cfg: {"sim":true,"level":4,"set":{"agents":"truth"},"tab":"per"}
Setup: The same run, with the tracker replaced by the simulator's true positions and velocities. There is no detection, no association and no lag.
See: The velocity error is zero and there are four tracks, one per person. There is no contact with a person, against one with the tracker. But at 57 s, while turning away from a person crossing its aisle, the robot clips the end of a shelf and is stuck against it. At 63 s it backs off to clear floor and replans, and it reaches all five goals in about 127 s.
Shows: The difference between the two runs is what tracking costs, and it is smaller than the difference between two seeds. Over seeds 2 to 5, 8 and 11, the tracker gives one contact on each seed except seed 11, which has three, and ground truth gives none or one. On two of those seeds ground truth also pins the robot against a shelf, and the robot backs off and still reaches every goal. Perfect tracks make the speed planner's decisions sharper, but the floor is just as crowded, and a sharp yield next to the end of a shelf can still put the robot against it. Tracking quality is one cause of contacts, and on this level it is not the main one.
Predict: Replace the tracker with the simulator's true positions and velocities. What changes for certain?
- The tracks: exactly four, with no velocity error; the mission itself is not reliably better
- The contacts: with perfect tracks the robot never touches a person
- Nothing: the tracker was already perfect
Answer: 0

## Try: Prediction frozen
cfg: {"sim":true,"level":4,"set":{"agPred":"static"},"tab":"per","plot":"st"}
Setup: The lidar tracker again, but the planner is handed each person's current position with zero velocity and a constant radius. The ST graph shows the result.
See: The dashed prediction circles collapse onto the track, and the prediction line disappears. The speed planner reacts only once a person is already on the path, so it brakes late. There are three contacts during the mission, against one with the prediction, and the same five goals are reached. On seeds 2 to 5 there are two or three, against one. In the ST graph the blocked regions are horizontal bars, which mean a person standing in one place for the whole horizon. A moving person gives a sloping band.
Shows: Prediction gives the planner time to react. Without it the planner can only respond to what is already on the path, and at 0.8 m/s against people walking at 0.9 m/s that comes too late. The constant-velocity extrapolation is crude, but it is good enough here, because over the 4 s horizon people walk in straight lines.
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
Note: The predict line moves each track by its velocity. The filter line keeps a confirmed track for one second without hits, and drops a tentative one after a quarter of a second. In Edit and run, the predictor example receives these tracks. Make it ignore vx and vy, as the standing-still example does, and see what the speed planner loses.

## Think about
Q: Why is velocity so much harder than position for this tracker?
A: Position is measured directly every 0.1 s, with 10 cm of noise. Velocity is the difference of two such positions divided by 0.1 s, so 10 cm of noise becomes 1 m/s of noise, more than the walking speed. The filter averages that down over many updates, and the averaging causes the lag. A sensor that measures velocity, such as a Doppler radar, changes the problem completely.
Q: What does raising $\sigma_a$ do, and what would you set it to for a sprinting child?
A: It tells the filter that the velocity can change a lot between updates, so the filter trusts recent innovations more. The track follows a turn faster and jitters more in between. For a child you could raise it until the lag is acceptable and live with the jitter. A better option is to grow the predicted radius faster, so that the prediction covers the uncertainty instead of chasing it.
Q: A track is confirmed after three hits and coasts for one second. Why those numbers?
A: Three hits at 10 Hz take 0.3 s. That is long enough that a single stray cluster or a wall corner never becomes a person, and short enough that a person stepping out from behind a pillar is tracked before they reach the path. One second of coasting is about the time a walking person spends hidden behind one pillar. With a longer coast, a person who has really left would keep blocking the planner.

## Check yourself
Q: A track's predicted position variance $P_{pp}$ is 0.03 m² and the measurement noise is $\sigma_z = 0.1$ m. What is the position gain $k_p$?
Answer: 0.75
Tolerance: 0.02
Unit: 
How: $k_p = P_{pp}/(P_{pp} + \sigma_z^2) = 0.03/(0.03 + 0.01) = 0.75$, so three quarters of the innovation goes into the position.
