group: intro
title: Where am I? Odometry drifts
level: 1

<p><b>Why this matters.</b> Before a robot can plan a path, it has to know where it is. The cheapest way to find out is to count how far its wheels have turned, which every wheeled robot can do. That count is never exact, and its small errors add up as the robot drives. Knowing how fast they add up tells you how long a robot can manage on its wheels alone.</p>
<p><b>The idea.</b> Encoders on the wheels report the robot's speed and turn rate every tick. This is called odometry. Adding up those small moves, one tick after another, gives a position and a heading. This is dead reckoning, the method sailors used before satellites. The trouble is that each reading is slightly wrong. Some errors are random: one reading a little high, the next a little low. Others are a <i>bias</i>: a wheel slightly smaller than the robot believes makes every reading wrong in the same direction. Dead reckoning has nothing to compare against, so it never notices either kind, and the error keeps growing. That growth is called <i>drift</i>.</p>
<p>The heading error does the most damage. If the robot believes it points 2° to the left of where it really points, every metre it drives puts it about 3.5 cm further to the side. The sideways error keeps growing as long as the heading is wrong.</p>
<p><b>What the lab does.</b> The experiments use L3 with the shelves removed (an empty floor with only the outer walls). The robot drives laps of an 8 × 5 m rectangle in the middle and keeps going until you stop it. The map draws two trails: a dashed one for the lap the robot believes it drives, from its estimate, and a solid one for the lap it really drives. The Position error plot in Telemetry draws the distance between the two positions. Its shaded band is the robot's own guess of how large that error could be, which the lesson on uncertainty explains. The Sensors tab holds the odometry noise and calibration bias sliders.</p>
<p><b>Where it comes from.</b> For a small heading error $\delta\theta$ in radians, the sideways error after driving a distance $d$ is about</p>
$$e_\perp \approx d\,\delta\theta$$
<p>With $\delta\theta = 2° = 0.035$ rad, that is 3.5 cm per metre. The heading error itself grows too, so the sideways error grows faster than the distance. Go deeper: <a class="lsref" href="#lesson=loc:1">Dead reckoning drifts, and knows it</a> · <a class="chref" href="#notes=ch2/2-the-motion-model-and-its-jacobians">the motion model: chapter 2 §2</a></p>

## Try: Dead reckoning on noisy wheels
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"loc","plot":"pos"}
Setup: L3 with an empty floor. The odometry has noise ×1 and calibration bias ×1, and the robot uses dead reckoning only. The Localize tab and the Position error plot open, and the laps start.
See: Within seconds the two trails separate. The believed lap is drawn again and again on the same rectangle, while the true lap turns a little further about the middle of the floor every time round. The position error is 0.8 m at 40 s and about 5 m at 90 s; over the first two minutes the curve peaks at 5.5 m. Because the lap is closed, the error rises and falls as the robot goes round instead of growing steadily.
Shows: The controller steers by the estimate, so the believed lap is always the rectangle the robot was asked to drive. The true lap is what the wheels' errors make of it. Nothing on the robot can see the gap, because the robot only knows its estimate. On seeds 1 to 4 the peak in the first two minutes is between 3.4 and 5.9 m.
Predict: Watch the two trails for a minute. Which lap stays a neat rectangle?
- The lap the robot believes it drives
- The lap the robot really drives
- Both, because the robot corrects itself at each corner
Answer: 0

## Try: Calibrated wheels
cfg: {"sim":true,"level":2,"set":{"loc":"dr","map":"empty","misLoop":true,"odoB":0},"goals":[[8,5.5],[16,5.5],[16,10.5],[8,10.5]],"tab":"sen","plot":"pos"}
Setup: The same laps with the calibration bias at ×0 (Sensors tab, Odometry; the Sensors tab is in Advanced). Only the random noise is left.
See: The true lap still wanders away from the believed one. Over the first two minutes the position error peaks at 2.6 m, against 5.5 m with the bias. On seeds 1 to 4 the peak is 1.7 to 4.1 m: never zero, and not always smaller than with the bias.
Shows: Calibration removes the bias, but not the noise. Random errors partly cancel, but never completely, and what is left still adds up. Dead reckoning alone always drifts. To stop the drift the robot needs something outside itself to measure against, which is the next lesson.
Predict: With the bias removed, what does the true lap do?
- It stays on the believed lap: no bias, no drift
- It still drifts away, because the random noise adds up
- It drifts off the floor within one lap
Answer: 1

## Think about
Q: The robot reports the same rectangle lap after lap. If you were standing on the floor, how could you tell that it is lost?
A: Only by comparing it with something outside the robot: a mark on the floor, a wall it should be next to, or a sensor that measures position directly. The robot's own numbers agree with each other perfectly; that is exactly why dead reckoning cannot detect its own drift.

## Check yourself
Q: In the first experiment, read the Position error plot. What is the largest position error in the first two minutes?
Answer: 5.5
Tolerance: 0.5
Unit: m
How: The curve peaks at about 5.5 m between 90 and 100 s, then falls as the lap brings the robot back towards the middle. Seeds other than 7 peak elsewhere, between 3.4 and 5.9 m.
