group: per
title: Radar: speed from the echo

<p><b>Why this matters.</b> The lidar tracker of lesson 3 never measures a person's velocity: it infers it from positions a tenth of a second apart, so it is late, and after every turn the prediction points the wrong way for most of a second. A radar measures one component of velocity directly, from the Doppler shift of the echo, and its millimetre waves pass through fog that blinds a lidar. Every car with automatic emergency braking carries one for these two reasons. It is also coarse in bearing, merges targets that stand close together, sees ghosts by bouncing off walls, and gives one point per target with no shape. This lesson adds a radar to the robot, fuses it into the people tracker, and measures what each sensor is good for.</p>
<p><b>The idea.</b> Each radar detection is a range $r$, a bearing $b$ and a radial velocity $v_r$: the part of the relative velocity along the line of sight, negative when closing. The tracker's state is the same $[p_x, p_y, v_x, v_y]$ as lesson 3's, and the radar's reading is a nonlinear function of it, so the update is an extended Kalman filter step: predict the three numbers from the track, linearize with the Jacobian $H$, correct.</p>
$$\begin{aligned} d &= p - \hat p_{\text{robot}}, \quad \rho = \lVert d \rVert, \quad w = v - v_{\text{robot}} \\ h(x) &= \Big[\ \rho - b_0,\ \ \operatorname{atan2}(d_y, d_x) - \hat\theta,\ \ \frac{d \cdot w}{\rho}\ \Big] \qquad z = [r,\ b,\ v_r] \end{aligned}$$
$$H = \begin{bmatrix} d_x/\rho & d_y/\rho & 0 & 0 \\ -d_y/\rho^2 & d_x/\rho^2 & 0 & 0 \\ (w_x - v_r d_x/\rho)/\rho & (w_y - v_r d_y/\rho)/\rho & d_x/\rho & d_y/\rho \end{bmatrix}$$
<p>Here $b_0$ = 0.24 m is the distance from the track's centre to the echoing surface, $\hat\theta$ the robot's heading estimate, and $v_{\text{robot}}$ the robot's own velocity, which the radar measures too: everything static closes at $v\cos b$, so the static echoes give the robot's speed. The last row's velocity part is the unit vector along the line of sight: Doppler measures the velocity in exactly one direction, and nothing across it.</p>
<p><b>Where it comes from.</b> Differentiating $\rho$, the angle and $d \cdot w / \rho$ with respect to the four states gives $H$; its bottom-left entries are the tangential relative velocity divided by the range, because moving the track sideways turns the line of sight that the velocity is projected on. The covariance stops being the same in $x$ and $y$ (lesson 3's filter keeps one for both axes), so the radar tracker carries all sixteen numbers. Detections are paired with tracks by a χ² gate on range and bearing only, nearest first: a gate on the Doppler as well would reject exactly the echo of a person who has just turned around, whose radial velocity is many σ from what the filter expected. <a class="chref" href="#notes=ch3/12-radar-range-bearing-and-doppler">Derivation, the measured table and where the radar is worse: chapter 3 §12</a></p>
<p><b>What the lab does.</b> Perceive → Radar: a forward radar, 120° wide and 20 m deep, 10 Hz, range σ 0.1 m, bearing σ 3°, radial velocity σ 0.1 m/s. A person gives one echo (missed one scan in ten), a wall a few where it faces the radar; two echoes closer than 8° in bearing, 0.4 m in range and 0.25 m/s in radial velocity become one detection; half a false detection per scan on average; one person's echo in twenty also comes back off a wall as a ghost. The map shows each detection as a diamond with an arrow of 0.5 s of radial velocity, inside the radar's wedge, and the metrics show what it saw and the nearest detection ahead with its closing speed. <i>Tracker inputs</i> chooses lidar, radar, or both; with both, a track the radar can see is confirmed only once the radar has seen it too, or after six lidar hits. <i>Weather</i> sets fog or rain, which the lidar feels and the radar does not. The radar has its own random numbers, so turning it on changes nothing else in a run. The numbers below are L5 at seed 7, read at Mission complete, and checked at seeds 2 and 3.</p>

## Try: Lidar tracker, radar watching
cfg: {"sim":true,"level":4,"set":{"radar":true},"tab":"per","layers":{"agents":true,"radar":true}}
Setup: The busy floor as in lesson 3, the lidar tracker feeding the speed planner, with the radar on but not used by the tracker. Perceive tab; the metrics are under the map.
See: The run is lesson 3's to the tick: Mission complete at 121 s with one contact, at 52 s, and a prediction error at 1 s of 0.23 m. The radar's wedge sweeps ahead of the robot with about five detections a scan: four on walls and shelf ends, half a false one, and a person in a quarter of the scans, because the shelves hide people from a sensor that only looks forward. While the robot drives, every wall echo has an arrow pointing back at it. At 50 s a person in the bottom aisle, 2.3 m ahead, turns around and walks back at the robot: the lidar track's prediction line keeps pointing away for 0.7 s, and the contact follows at 52 s.
Shows: The wall echoes are the radar reading the robot's own motion: a static object closes at the robot's speed times the cosine of its bearing, and the radar's Doppler on them measures that speed better than one tick of the wheel odometry does. The person's echo carries a different radial velocity, and that difference is what marks it as something moving.
Predict: The robot drives straight at 0.8 m/s toward a wall. What closing speed does the metrics' Radar, nearest ahead line show for the wall?
- About 0.8 m/s: the wall stands still, so all of the closing speed is the robot's own
- Zero: the wall does not move
- About 1.6 m/s: the echo travels there and back
Answer: 0

## Try: Lidar + radar
cfg: {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both"},"tab":"per","layers":{"agents":true,"radar":true}}
Setup: The same run with Tracker inputs set to Lidar + radar: radar detections that move against the static world, or that the map does not explain, update the tracks with the extended Kalman filter, and may start tracks of their own.
See: The person who turns around at 50 s is followed in 0.1 s (0.2 and 0.3 s at seeds 2 and 3, against 0.7 s with lidar alone on all three): the prediction line flips on the next scan and the speed planner stops the robot and asks for a new path at 50.6 s. The person, scripted, does not stop: they walk into the standing robot at 51.7 s, which the event log reports as such and the metrics count as a contact; a second contact comes at 100 s, and Mission complete is at 119 s. In a track's first half second in the radar's view its velocity is off by 0.46 m/s on average instead of 0.63 (0.40 against 0.48 and 0.36 against 0.47 at seeds 2 and 3). The prediction error at 1 s in the metrics hardly moves: 0.23 m, as with lidar alone (0.29 against 0.24 at seed 2, 0.22 against 0.23 at seed 3).
Shows: A direct measurement beats an inferred one where the inference has not had time to average: in a track's first moments, and right after a person turns, if the turn is along the line of sight. The turn at 83 s, across the line of sight, is followed in 0.8 s either way. Once a track is a second old, the lidar's inferred velocity is as good as the radar's along the line of sight and better across it, so the error averaged over a whole run, which old tracks dominate, barely changes. On this floor the radar sees a person in only a quarter of its scans; in an open hall or on a road it would carry most of the tracking.
Predict: A person a few metres ahead turns around and walks straight back at the robot. With the radar in the tracker, how long until the track's prediction line points the new way?
- A scan or two: the next echo's radial velocity has the new sign
- About half a second, as with the lidar: velocity always has to be averaged
- It never does: the gate rejects an echo that far from the prediction
Answer: 0

## Try: Fog, lidar only
cfg: {"sim":true,"level":4,"set":{"radar":true,"weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}
Setup: Weather set to Fog: the lidar's returns fade beyond about 4 m of its 8, one beam in seven returns nothing, the ranges are noisier, and now and then a beam returns from the fog itself under 2 m out. The tracker uses the lidar only; the radar, unaffected, is drawn.
See: The amber lidar hits shrink to a ring of about 4 m round the robot, with stray hits in the air inside it. People farther out walk without a track while the radar's diamonds sit on them; the person who comes down the aisle toward the robot at 43 s, 6.6 m ahead, gets a ring only at 4.7 m, more than two seconds later. Over the run, a person in the radar's view, within 8 m and in line of sight, has no confirmed track 12 % of the time (15 % and 12 % at seeds 2 and 3, against 2–3 % in clear air). Stray hits that land near each other in three scans become tracks of nobody, 19 in the run, and the speed planner yields to them 4 times (6 and 3 at seeds 2 and 3). The prediction error at 1 s rises to 0.37 m. Mission complete at 121 s with one contact.
Shows: Fog takes three things from a lidar: reach, so people are found late; beams, so tracks break and restart with no velocity; and clean air, so the air itself returns hits that a rule built on "hits the map cannot explain" calls people. The robot stops for things that are not there and finds the people who are later than it should.
Predict: Now put the radar into the tracker, still in fog. Which people get a track?
- Those in the radar's wedge, out to its reach and in line of sight; to the sides and behind only within about 4 m, as before
- Everyone within 20 m all round: the radar sees through fog
- Nobody beyond 4 m: the tracker still needs the lidar to confirm
Answer: 0

## Try: Fog, lidar + radar
cfg: {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both","weather":"fog"},"tab":"per","layers":{"agents":true,"radar":true,"lidar":true}}
Setup: The same fog with Tracker inputs set to Lidar + radar.
See: Rings come back on the people ahead, out to where the shelves hide them; to the sides and behind, the fog still decides. The person coming down the aisle at 43 s has a ring from 6.3 m. A person in the radar's view goes without a track 4 % of the time (7 % at seed 2; at seed 3 the robot is stuck against a shelf end for a while and it is 19 %). Tracks of nobody drop to 12, and the speed planner yields to them once (twice at seeds 2 and 3). Mission complete at 123 s with one contact, at 53 s. The prediction error at 1 s is not better, 0.39 m: the radar keeps tracks of people far down the aisles that the fogged lidar never had, with positions a 3° bearing makes coarse, and they are scored too.
Shows: Two sensors that fail differently cover for each other: the radar keeps the people ahead, and cross-sensor confirmation keeps the fog's stray hits from becoming people the robot stops for, since the fog returns no radar echo. Fusion does not make the lidar any better: the tracker still believes its fogged clusters are good to 0.1 m (the turn at 50 s is followed in 0.5 s, not 0.1), because nothing told it the weather changed. Real stacks estimate each sensor's health and reweigh it; here the lesson is that the noise a filter assumes has to follow the conditions.
Predict: Turn the radar's false detections up to ten per scan, in clear air, with both sensors in the tracker. What do you see?
- Tracks of nobody, a few at a time, which the speed planner sometimes yields to; but nearly all the false detections never become tracks
- A track on every false detection: ten new people a scan
- Nothing: the lidar must confirm every track
Answer: 0

## Try: Clutter turned up
cfg: {"sim":true,"level":4,"set":{"radar":true,"trkIn":"both","radClutter":10},"tab":"per","layers":{"agents":true,"radar":true}}
Setup: Clear air, both sensors, and ten false radar detections per scan on average, anywhere in the wedge with random radial velocities.
See: The wedge fills with diamonds and the metrics' Radar line shows about fifteen detections a scan, ten of them nothing. Rings appear on empty floor, mostly far out where the bearing noise makes the gates wide: 221 tracks of nobody over the run (206 and 203 at seeds 2 and 3), out of about 15 000 false detections. The speed planner yields to them 25 times (22 and 14), and Mission complete comes at 131 s instead of 119 (134 against 127 and 129 against 119 at seeds 2 and 3), with one contact.
Shows: The gate and the three-hit confirmation do almost all the work: 98.5 % of the false detections never become a track, because a random echo seldom lands inside a gate three scans running. The 1.5 % that do are where cross-sensor confirmation cannot help: far out, beyond the lidar's reach, the radar alone vouches for a track. Nearest-neighbour association has a second weakness that the counts do not show: when a person's own echo is missing for a scan, a false one inside their gate is taken as theirs and pulls the track. Probabilistic data association weighs every echo in the gate instead of trusting the nearest; the lab does not implement it.
Predict: The moose test (L7): the car drives at 3.5 m/s straight at a box. What closing speed does the radar read on the box?
- About 3.5 m/s: the box stands still, so the closing speed is the car's own
- Zero: the box does not move
- Nothing: a radar only sees moving things
Answer: 0

## Try: The moose test, read by the radar
cfg: {"sim":true,"level":6,"set":{"radar":true},"tab":"per","layers":{"radar":true}}
Setup: L7 as it loads (the car with tyre slip on the slippery floor, 3.5 m/s, the MPC with its kinematic model, which control lesson 17 shows hitting the first box), with the radar on. Pause at 1.5 s and step.
See: At 1.55 s the radar's nearest detection ahead is the first box, 3.6 m away, closing at 3.5 m/s: contact in 1.0 s (3.0 m and 0.9 s at seed 2, 3.7 m and 1.0 s at seed 3). The car hits the box at 2.4 s.
Shows: Range divided by closing speed is the time to contact, and one radar detection gives it without any tracking, map or classification: it is what automatic emergency braking reads. At 1.55 s there was still room: braking at the slippery floor's grip, about 2.5 m/s², stops a car from 3.5 m/s in 2.5 m, less than the 3.6 m left. A controller that steers a car it does not understand into a box is the control group's lesson; the radar's is that a warning a second ahead, from one number per echo, is often enough to stop.

## Code: radarH and radarTrack, the radar's update
snippet: radar-update
focus: z: [rho - RAD.body, wrap(Math.atan2(dy, dx) - e.th), vr],
focus: [(wx - (vr * dx) / rho) / rho, (wy - (vr * dy) / rho) / rho, dx / rho, dy / rho]
focus: G = kfInnov(t, h.H.slice(0, 2), y.slice(0, 2), Rm.slice(0, 2)); // the gate: range and bearing only
focus: kfUpdate(t, H, y, Rm, I);
Note: radarH is $h(x)$ and $H$ of the lesson, line for line; radarTrack gates every candidate against every track on range and bearing, pairs them nearest first and applies the full three-row update (kfUpdate, Joseph's form), then starts tentative tracks from the detections left over, with the radial velocity known and the tangential one not. The predictor slot in the Code tab now receives this scan's radar detections as obs.radar, so your own predictor can read the Doppler.

## Think about
Q: Why does the radar gate on range and bearing only, and what would gating on the radial velocity too buy and cost?
A: A three-number gate is tighter and would keep out more clutter, since a false echo must then also have the right Doppler. But the filter's velocity is confident, so when a person turns around, their own echo's radial velocity is many σ from the prediction and a three-number gate throws it away; the track then coasts on the old velocity, exactly the failure the radar was meant to fix. Measured on the busy floor, gating on all three made the velocity of tracks older than two seconds worse than with lidar alone (0.18 against 0.11 m/s at seed 7). Gating on position and updating with everything is the standard compromise for targets that manoeuvre.
Q: Two people walk side by side, 0.5 m apart, at the same speed, 10 m ahead. What does the radar report?
A: One detection. At 10 m an 8° angular resolution is 1.4 m across the line of sight, and they are in the same range and Doppler cell, so their echoes merge into one at the average bearing. The lidar, with 3° between beams and centimetre ranges, sees two clusters. Radar separates targets by range and by Doppler much better than by angle; two people moving differently are told apart by their speeds, two walking together are not.
Q: A person stands still half a metre from a shelf, 6 m ahead. Does the radar track them?
A: Probably not. Standing, their echo has the static world's Doppler, so it is a candidate only if the map does not explain it, and at 6 m a 3° bearing smears it over ±0.6 m: within that of the shelf, it is filed as shelf. This is the classic blind spot of Doppler processing (stationary targets near structure), and why the lab's fused tracker still confirms a track from six lidar hits without the radar.
Q: Where would the lidar still win if the radar were perfect in range and Doppler?
A: In shape and in angle. A radar gives one point per target and a coarse bearing, so it cannot build a map, tell a person from a post that is equally still, see the gap between two people, or measure velocity across its line of sight. A lidar gives the outline, centimetre positions all round the robot, and a map; the radar gives speed now and sight through weather. That is why vehicles carry both.

## Check yourself
Q: A radar detection 8 m away at bearing 0 reads a radial velocity of −1.0 m/s while the robot drives straight ahead at 0.6 m/s. How fast is the target itself moving along the line of sight, in m/s (negative: toward the robot)?
Answer: -0.4
Tolerance: 0.02
Unit: m/s
How: The static world would read $-0.6\cos 0 = -0.6$ m/s; the target's own radial speed is the reading minus that: $-1.0 - (-0.6) = -0.4$ m/s, walking toward the robot at 0.4 m/s
