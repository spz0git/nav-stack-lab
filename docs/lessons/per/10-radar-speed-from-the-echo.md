group: per
title: Radar: speed from the echo

<p><b>Why this matters.</b> The lidar tracker of lesson 3 never measures a person's velocity. It infers it from positions a tenth of a second apart, so the velocity is late, and after every turn the prediction points the wrong way for most of a second. A radar measures one component of velocity directly, from the Doppler shift of the echo, and its millimetre waves pass through fog that blinds a lidar. Every car with automatic emergency braking carries a radar for these two reasons. A radar also has weaknesses. Its bearing is coarse, it merges targets that stand close together, it sees ghosts when the signal bounces off walls, and it gives one point per target with no shape. This lesson adds a radar to the robot, fuses it into the people tracker, and measures what each sensor is good for.</p>
<p><b>The idea.</b> Each radar detection is a range $r$, a bearing $b$ and a radial velocity $v_r$. The radial velocity is the part of the relative velocity along the line of sight, and it is negative when the two are closing. The tracker's state is the same $[p_x, p_y, v_x, v_y]$ as in lesson 3. The radar's reading is a nonlinear function of that state, so the update is an extended Kalman filter step. The filter predicts the three numbers from the track, linearizes with the Jacobian $H$, and corrects.</p>
$$\begin{aligned} d &= p - \hat p_{\text{robot}}, \quad \rho = \lVert d \rVert, \quad w = v - v_{\text{robot}} \\ h(x) &= \Big[\ \rho - b_0,\ \ \operatorname{atan2}(d_y, d_x) - \hat\theta,\ \ \frac{d \cdot w}{\rho}\ \Big] \qquad z = [r,\ b,\ v_r] \end{aligned}$$
$$H = \begin{bmatrix} d_x/\rho & d_y/\rho & 0 & 0 \\ -d_y/\rho^2 & d_x/\rho^2 & 0 & 0 \\ (w_x - v_r d_x/\rho)/\rho & (w_y - v_r d_y/\rho)/\rho & d_x/\rho & d_y/\rho \end{bmatrix}$$
<p>Here $b_0$ = 0.24 m is the distance from the track's centre to the echoing surface, $\hat\theta$ is the robot's heading estimate, and $v_{\text{robot}}$ is the robot's own velocity. The radar measures that too, because everything static closes at $v\cos b$, so the static echoes give the robot's speed. The velocity part of the last row is the unit vector along the line of sight. Doppler measures the velocity in that one direction and nothing across it.</p>
<p><b>Where it comes from.</b> Differentiating $\rho$, the angle and $d \cdot w / \rho$ with respect to the four states gives $H$. Its bottom-left entries are the tangential relative velocity divided by the range. They are there because moving the track sideways turns the line of sight onto which the velocity is projected. The covariance is no longer the same in $x$ and $y$ (lesson 3's filter keeps one for both axes), so the radar tracker carries all sixteen numbers. Detections are paired with tracks by a χ² gate on range and bearing only, nearest first. A gate on the Doppler as well would reject the echo of a person who has just turned around, because that echo's radial velocity is many σ from what the filter expected. <a class="chref" href="#notes=ch3/12-radar-range-bearing-and-doppler">Derivation, the measured table and where the radar is worse: chapter 3 §12</a></p>
<p><b>What the lab does.</b> Sensors → Radar adds a forward radar, 120° wide and 20 m deep, at 10 Hz. Its noise (σ) is 0.1 m in range, 3° in bearing and 0.1 m/s in radial velocity. A person gives one echo, which is missed one scan in ten. A wall gives a few echoes where it faces the radar. Two echoes closer than 8° in bearing, 0.4 m in range and 0.25 m/s in radial velocity become one detection. There is half a false detection per scan on average. One person's echo in twenty also comes back off a wall as a ghost. The map shows each detection inside the radar's wedge as a diamond, with an arrow for 0.5 s of radial velocity. The metrics show what the radar saw, and the nearest detection ahead with its closing speed. <i>Tracker inputs</i> chooses lidar, radar, or both. With both, a track the radar can see is confirmed only once the radar has seen it too, or after six lidar hits. <i>Weather</i> sets fog or rain, which affect the lidar and not the radar. The radar has its own random numbers, so turning it on changes nothing else in a run. The numbers below are for L5 at seed 7, read at Mission complete, and checked at seeds 2 and 3.</p>

## Try: Lidar tracker, radar watching
cfg: {"sim":true,"level":4,"set":{"radar":true},"tab":"per","layers":{"agents":true,"radar":true}}
Setup: The busy floor as in lesson 3, with the lidar tracker feeding the speed planner. The radar is on, but the tracker does not use it. The Perceive tab is open, and the metrics are under the map.
See: The run is the same as lesson 3's, tick for tick. Mission complete comes at 121 s with one contact, at 52 s, and the prediction error at 1 s is 0.23 m. The radar's wedge sweeps ahead of the robot with about five detections a scan. Four are on walls and shelf ends, there is half a false one on average, and a person appears in a quarter of the scans, because the shelves hide people from a sensor that only looks forward. While the robot drives, every wall echo has an arrow pointing back towards the robot. At 50 s a person in the bottom aisle, 2.3 m ahead, turns around and walks back towards the robot. The lidar track's prediction line keeps pointing away for 0.7 s, and the contact follows at 52 s.
Shows: In the wall echoes the radar is reading the robot's own motion. A static object closes at the robot's speed times the cosine of its bearing, and the Doppler on those echoes measures that speed better than one tick of the wheel odometry does. The person's echo has a different radial velocity, and the difference marks it as something moving.
Predict: The robot drives straight at 0.8 m/s toward a wall. What closing speed does the metrics' Radar, nearest ahead line show for the wall?
- About 0.8 m/s: the wall stands still, so all of the closing speed is the robot's own
- Zero: the wall does not move
- About 1.6 m/s: the echo travels there and back
Answer: 0

## Try: Lidar + radar
cfg: {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both"},"tab":"per","layers":{"agents":true,"radar":true}}
Setup: The same run with Tracker inputs set to Lidar + radar. Radar detections that move against the static world, or that the map does not explain, update the tracks through the extended Kalman filter, and they can start tracks of their own.
See: The tracker follows the person who turns around at 50 s at once. The prediction line flips on the next scan, and the speed planner stops the robot and asks for a new path at 50.6 s. The person is scripted and does not stop. They walk into the standing robot at 51.7 s; the event log reports it as such, and the metrics count it as a contact. A second contact comes at 100 s, and Mission complete is at 119 s. The table compares lidar + radar against lidar alone, with the velocity error averaged over a track's first half second in the radar's view:
| Seed | Turn followed (s) | Velocity error (m/s) | Prediction error at 1 s (m) |
|---|---|---|---|
| this run | 0.1 against 0.7 | 0.46 against 0.63 | 0.23 against 0.23 |
| seed 2 | 0.2 against 0.7 | 0.40 against 0.48 | 0.29 against 0.24 |
| seed 3 | 0.3 against 0.7 | 0.36 against 0.47 | 0.22 against 0.23 |
Look at the first two columns, where the radar helps on every seed. The last one, the prediction error at 1 s in the metrics, hardly moves.
Shows: A direct measurement beats an inferred one where the inference has not had time to average. That is in a track's first moments, and right after a person turns, if the turn is along the line of sight. The turn at 83 s is across the line of sight, and it is followed in 0.8 s either way. Once a track is a second old, the lidar's inferred velocity is as good as the radar's along the line of sight, and better across it. Old tracks dominate the error averaged over a whole run, so that average barely changes. On this floor the radar sees a person in only a quarter of its scans. In an open hall or on a road it would carry most of the tracking.
Predict: A person a few metres ahead turns around and walks straight back at the robot. With the radar in the tracker, how long until the track's prediction line points the new way?
- A scan or two: the next echo's radial velocity has the new sign
- About half a second, as with the lidar: velocity always has to be averaged
- It never does: the gate rejects an echo that far from the prediction
Answer: 0

## Try: Fog, lidar only
cfg: {"sim":true,"level":4,"set":{"radar":true,"weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}
Setup: Weather is set to Fog. The lidar's returns fade beyond about 4 m of its 8, one beam in seven returns nothing, the ranges are noisier, and now and then a beam returns from the fog itself, less than 2 m out. The tracker uses the lidar only. The fog does not affect the radar, and its detections are drawn.
See: The amber lidar hits shrink to a ring of about 4 m round the robot, with stray hits in the air inside it. People farther out walk without a track, while the radar's diamonds sit on them. The person who comes down the aisle toward the robot at 43 s, 6.6 m ahead, gets a ring only at 4.7 m, more than two seconds later. Stray hits that land near each other in three scans become tracks of nobody, 19 in the run. The table shows how often over the run a person in the radar's view, within 8 m and in line of sight, has no confirmed track:
| Seed | Person untracked (% of the time) | Yields to tracks of nobody |
|---|---|---|
| this run | 12 | 4 |
| seed 2 | 15 | 6 |
| seed 3 | 12 | 3 |
Compare the first column with 2–3 % in clear air. The prediction error at 1 s rises to 0.37 m. Mission complete comes at 121 s with one contact.
Shows: Fog does three things to a lidar. It shortens the reach, so people are found late. It loses beams, so tracks break and restart with no velocity. And it makes the air itself return hits, which a rule built on "hits the map cannot explain" calls people. The robot stops for things that are not there, and finds the people who are there later than it should.
Predict: Fog cuts the lidar's reach to about 4 m. With only the lidar in the tracker, which people get a track?
- Only those within about 4 m; farther out they walk without a ring while the radar's diamonds sit on them
- Everyone within the lidar's 8 m: the tracker coasts across the gaps
- Nobody: the fog hides every person
Answer: 0

## Try: Fog, lidar + radar
cfg: {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both","weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}
Setup: The same fog with Tracker inputs set to Lidar + radar.
See: Rings come back on the people ahead, out to where the shelves hide them. To the sides and behind, the fog still limits what gets tracked. The person coming down the aisle at 43 s has a ring from 6.3 m. Tracks of nobody drop to 12. The table shows how often over the run a person in the radar's view goes without a track:
| Seed | Person untracked (% of the time) | Yields to tracks of nobody |
|---|---|---|
| this run | 4 | once |
| seed 2 | 7 | twice |
| seed 3 | 19 | twice |
Compare with the fog run on lidar alone. At seed 3 the robot is stuck against a shelf end for a while. Mission complete comes at 123 s with one contact, at 53 s. The prediction error at 1 s is no better, at 0.39 m. The radar keeps tracks of people far down the aisles that the fogged lidar never had, and those tracks are scored too. Their positions are coarse, because of the 3° bearing.
Shows: Two sensors that fail in different ways cover for each other. The radar keeps the people ahead. Cross-sensor confirmation stops the fog's stray hits from becoming people the robot stops for, since fog returns no radar echo. Fusion does not make the lidar any better. The tracker still believes its fogged clusters are good to 0.1 m, because nothing told it the weather changed, and the turn at 50 s is followed in 0.5 s instead of 0.1. Real stacks estimate each sensor's health and change its weight to match. The noise a filter assumes has to change with the conditions.
Predict: Now put the radar into the tracker, still in fog. Which people get a track?
- Those in the radar's wedge, out to its reach and in line of sight; to the sides and behind only within about 4 m, as before
- Everyone within 20 m all round: the radar sees through fog
- Nobody beyond 4 m: the tracker still needs the lidar to confirm
Answer: 0

## Try: Clutter turned up
cfg: {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both","radClutter":10},"tab":"per","layers":{"agents":true,"radar":true}}
Setup: Clear air, both sensors in the tracker, and ten false radar detections per scan on average, anywhere in the wedge and with random radial velocities.
See: The wedge fills with diamonds, and the Radar line in the metrics shows about fifteen detections a scan, ten of them nothing. Rings appear on empty floor, mostly far out, where the bearing noise makes the gates wide. The run has about 15 000 false detections and one contact. The Mission complete column gives the time with clutter against without:
| Seed | Tracks of nobody | Yields to them | Mission complete (s) |
|---|---|---|---|
| this run | 221 | 25 | 131 against 119 |
| seed 2 | 206 | 22 | 134 against 127 |
| seed 3 | 203 | 14 | 129 against 119 |
In the last column, the clutter costs time on every seed.
Shows: The gate and the three-hit confirmation do almost all the work. Of the false detections, 98.5 % never become a track, because a random echo seldom lands inside a gate three scans running. The 1.5 % that do are where cross-sensor confirmation cannot help: far out, beyond the lidar's reach, where the radar alone vouches for a track. Nearest-neighbour association has a second weakness that the counts do not show. When a person's own echo is missing for a scan, a false echo inside their gate is taken as theirs and pulls the track off. Probabilistic data association weighs every echo in the gate instead of trusting the nearest one. The lab does not implement it.
Predict: Turn the radar's false detections up to ten per scan, in clear air, with both sensors in the tracker. What do you see?
- Tracks of nobody, a few at a time, which the speed planner sometimes yields to; but nearly all the false detections never become tracks
- A track on every false detection: ten new people a scan
- Nothing: the lidar must confirm every track
Answer: 0

## Try: The moose test, read by the radar
cfg: {"sim":true,"level":6,"set":{"radar":true},"tab":"per","layers":{"radar":true}}
Setup: L7 as it loads, with the radar on. This is the car with tyre slip on the slippery floor at 3.5 m/s, driven by the MPC with its kinematic model, which control lesson 17 shows hitting the first box. Pause at 1.5 s and step forward.
See: At 1.55 s the radar's nearest detection ahead is the first box, closing at 3.5 m/s:
| Seed | Distance to the box (m) | Contact in (s) |
|---|---|---|
| this run | 3.6 | 1.0 |
| seed 2 | 3.0 | 0.9 |
| seed 3 | 3.7 | 1.0 |
The car hits the box at 2.4 s. In the last column, the radar gives 0.9 to 1.0 s of warning on all three seeds.
Shows: Range divided by closing speed is the time to contact. One radar detection gives it without any tracking, map or classification, and automatic emergency braking works from this number. At 1.55 s there was still room. Braking at the slippery floor's grip, about 2.5 m/s², stops a car from 3.5 m/s in 2.5 m, less than the 3.6 m left. Why the controller, whose model does not match the car, steers into the box is a matter for the control lessons. What this run shows about the radar is that a warning a second ahead, from one number per echo, is often enough to stop.
Predict: The moose test (L7): the car drives at 3.5 m/s straight at a box. What closing speed does the radar read on the box?
- About 3.5 m/s: the box stands still, so the closing speed is the car's own
- Zero: the box does not move
- Nothing: a radar only sees moving things
Answer: 0

## Code: radarH and radarTrack, the radar's update
snippet: radar-update
focus: z: [rho - RAD.body, wrap(Math.atan2(dy, dx) - e.th), vr],
focus: [(wx - (vr * dx) / rho) / rho, (wy - (vr * dy) / rho) / rho, dx / rho, dy / rho]
focus: G = kfInnov(t, h.H.slice(0, 2), y.slice(0, 2), Rm.slice(0, 2)); // the gate: range and bearing only
focus: kfUpdate(t, H, y, Rm, I);
Note: radarH computes $h(x)$ and $H$ of the lesson, line for line. radarTrack gates every candidate against every track on range and bearing, pairs them nearest first and applies the full three-row update (kfUpdate, in Joseph's form). It then starts tentative tracks from the detections left over, with the radial velocity known and the tangential one unknown. The predictor slot in the Code tab now receives this scan's radar detections as obs.radar, so your own predictor can read the Doppler.

## Think about
Q: Why does the radar gate on range and bearing only, and what would gating on the radial velocity too buy and cost?
A: A three-number gate is tighter and would keep out more clutter, since a false echo would then also need the right Doppler. But the filter is confident about the velocity. When a person turns around, their own echo's radial velocity is many σ from the prediction, and a three-number gate throws it away. The track then coasts on the old velocity, which is the failure the radar was meant to fix. Measured on the busy floor, gating on all three made the velocity of tracks older than two seconds worse than with lidar alone (0.18 against 0.11 m/s at seed 7). For targets that manoeuvre, the standard compromise is to gate on position and update with all three numbers.
Q: Two people walk side by side, 0.5 m apart, at the same speed, 10 m ahead. What does the radar report?
A: One detection. At 10 m an 8° angular resolution is 1.4 m across the line of sight, and the two people are in the same range and Doppler cell, so their echoes merge into one at the average bearing. The lidar, with 3° between beams and centimetre ranges, sees two clusters. A radar separates targets by range and by Doppler much better than by angle. It can tell two people apart by their speeds when they move differently, but not when they walk together.
Q: A person stands still half a metre from a shelf, 6 m ahead. Does the radar track them?
A: Probably not. A person standing still has the same Doppler as the static world, so their echo is a candidate only if the map does not explain it. At 6 m a 3° bearing smears the echo over ±0.6 m, and the shelf is within that distance, so the echo is filed as shelf. This is the well-known blind spot of Doppler processing: stationary targets near structures. It is also the reason the lab's fused tracker still confirms a track from six lidar hits without the radar.
Q: Where would the lidar still win if the radar were perfect in range and Doppler?
A: In shape and in angle. A radar gives one point per target and a coarse bearing. It cannot build a map, tell a person from a post that is equally still, see the gap between two people, or measure velocity across its line of sight. A lidar gives the outline, centimetre positions all round the robot, and a map. The radar gives the speed at once and sees through weather. Vehicles carry both for these reasons.

## Check yourself
Q: A radar detection 8 m away at bearing 0 reads a radial velocity of −1.0 m/s while the robot drives straight ahead at 0.6 m/s. How fast is the target itself moving along the line of sight, in m/s (negative: toward the robot)?
Answer: -0.4
Tolerance: 0.02
Unit: m/s
How: The static world would read $-0.6\cos 0 = -0.6$ m/s. The target's own radial speed is the reading minus that, $-1.0 - (-0.6) = -0.4$ m/s, so the target walks toward the robot at 0.4 m/s.
