group: per
title: Sonar: one number for a whole cone

<p><b>Why this matters.</b> Most robots that carry a lidar also carry a ring of ultrasonic sensors, and many cheap robots carry nothing else. A sonar costs a fraction of a lidar, has no moving parts, and on a real robot it hears glass doors, mirrors and dark or shiny surfaces that a laser can pass through or fail to see. It also fails in ways a lidar does not, and those failures decide what it can be trusted with. This lesson takes the lab's three uses of a range sensor (building the map, the safety stop, localizing against a prior map) and gives each one the sonar ring instead of the lidar.</p>
<p><b>The idea.</b> A sonar sends a ping and times the first echo. What comes back is <i>one range for a whole cone</i>, about 30° wide: the distance to the nearest surface somewhere in the cone that sent the echo back, with no bearing. Three things can stop the echo. A smooth surface met at a slant reflects the sound away like a mirror (a specular miss), so a flat wall is heard only within about 45° of square-on. An echo from very close arrives while the transducer is still ringing from its own ping and is lost (the dead zone). And a sonar can hear a neighbour's ping and report it as its own (crosstalk). The ring fires in turn, so each sonar reads only every 0.4 s. On the map, a reading becomes an arc: something on it echoed, nothing before it did.</p>
$$l_\text{arc}(n) = \ln\frac{n + 1}{n - 1} \approx \frac{2}{n} \qquad l_\text{free} = -0.2$$
<p>Each of the $n$ arc cells that could have echoed gets $l_\text{arc}$, each cell inside the cone before the arc gets $l_\text{free}$, and a reading at maximum range marks nothing.</p>
<p><b>Where it comes from.</b> With no bearing, each of the $n$ arc cells is the echo with probability $1/n$; a cell is occupied if it is the echo, or otherwise with the prior one half, so $p = (n + 1)/2n$, and the log-odds is $l_\text{arc}$. At 2 m an arc covers about 15 cells and each gets 0.13, so a wall cell needs four readings where one lidar hit was enough. Only cells the map does not already know to be free count in $n$, so the evidence gathers on the wall as the robot drives. For localizing, the particle filter compares each reading with the nearest obstacle the prior map puts inside that sonar's cone. <a class="chref" href="#notes=ch3/11-sonar-one-range-for-a-whole-cone">Derivation, the cone likelihood and the measured table: chapter 3 §11</a></p>
<p><b>What the lab does.</b> Perceive → Ultrasonic ring (off by default): 8 sonars round the hull, cones 30° wide with 15° unseen between neighbours, a reach of 4 m, a dead zone of 0.2 m from the hull, 1 cm of range noise, specular beyond 30° from square-on, 2 % crosstalk, one ping every 50 ms. Perceive → What builds the map picks lidar, sonar or both; Control → The safety stop reads, the same; Localize → Also weight particles by the sonar ring adds the cone likelihood to the particle filter. The Sonar ring layer draws each cone where it was measured: a green arc where an echo came back, the cone dashed where none did (orange for a specular miss, red for the dead zone), rose for a neighbour's echo. The lab does not model materials: every surface reflects the laser and the sound alike, so the sonar's advantages over a lidar never show here, only its failures.</p>

## Try: Sonar only: the unknown building
cfg: {"sim":true,"level":3,"set":{"sonar":true,"mapSrc":"sonar"},"tab":"per"}
Setup: L4, the unknown building of lesson 1, the EKF on beacons for the pose as before, the ultrasonic ring on and the map built from the sonars alone. Perceive tab; the Sonar ring layer and the true-map ghost are on.
See: The robot heads north for the first door and turns towards the path beyond it. At 8.6 s it drives into the wall just right of the door: it met that wall at a slant, and the cones facing it are dashed orange. It backs off, replans through the same wall, hits it again at 21.4 s, and gives up on each goal in turn: no goal reached, 2 collisions, Floor seen stuck at 14 % (lesson 1's lidar map ends at 96 %). Of the ring's readings, 31 % are specular misses and 22 % dead-zone misses, from the minutes spent pressed against the wall. The map is a few strokes of wall and wedges of free floor around the start.
Shows: A cone hears a flat wall only within about 45° of square-on, and a planner that counts unseen space as free routes straight through what no sonar heard. Once against the wall, the dead zone hides it too. Seeds 3 and 11 end the same way: no goal, 5 and 2 collisions.
Predict: The same mission as lesson 1, with the map built from the sonars alone. What happens?
- The same four goals, more slowly, on a blurrier map
- The robot hits a wall it met at a slant, which no sonar heard
- The robot will not move: it has seen too little free floor
Answer: 1

## Try: Rough walls: specular beyond 50°
cfg: {"sim":true,"level":3,"set":{"sonar":true,"mapSrc":"sonar","sonSpec":50},"tab":"per"}
Setup: The same, with the surfaces made rougher: a ray's echo now comes back up to 50° from square-on, so a cone hears a wall up to about 65° off its axis.
See: Far fewer dashed orange cones (11 % of the readings are specular misses). Walls appear as thick, broken strokes, smeared along themselves past their ends, with wedges of free floor between the cones; the boxes in the rooms come out as fragments. The robot reaches all four goals by 89 s, with 2 collisions (23.2 s and 79.6 s) and 15 replans against the lidar's 3. Floor seen 67 %. Against the truth, 88 % of the cells the map calls occupied have an obstacle within a cell (lidar 100 %), and it holds 75 % of the obstacle cells it has seen (lidar 96 %).
Shows: With the walls heard, the map is the arc model's: right on average, blurred by the quarter of the range the arc spreads to either side. The mission is fragile: at seeds 3 and 11 the robot reaches one goal of four, with 3 collisions each, still finding the walls it is pressed against by hitting them.
Predict: Rougher walls, sonar map. Compare the map with the true-map ghost: where do they differ most?
- The walls are thick, broken strokes and the boxes are fragments
- The walls are doubled, as with dead reckoning in lesson 1
- Nowhere: it is as sharp as the lidar's
Answer: 0

## Try: The warehouse aisles with sonar only
cfg: {"sim":true,"level":1,"set":{"per":"mapping","sonar":true,"mapSrc":"sonar"},"tab":"per"}
Setup: L2, the warehouse aisles, with no prior map: the map is built as the robot drives, from the sonars alone (the walls smooth again).
See: The shelf faces that look at the cones are mapped as clean lines. At 3.6 s the robot clips the end of the first shelf, whose long face it was passing at a slant, and is stuck there for about 15 s; it reaches 1 goal of 4, with Floor seen 28 %. Built by the lidar, the same map is complete (99 %) and the robot reaches all four goals without a contact. Seeds 3 and 11: 1 goal of 4 as well.
Shows: Aisles are the sonar's worst case: long faces passed at a slant, square ends the size of a cone's arc. The sonar ring is the cheap proximity sensor under a robot's bumper, not a mapping sensor.

## Try: Safety stop on the lidar, people who react
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}
Setup: L5, the busy floor: the warehouse aisles with four walkers, here reacting to the robot. Agent tracking is off and the response to agents is Ignore, so nothing but the lidar safety stop protects them. The robot drives up and back the cross aisle at x = 12 m, where the walkers of two aisles cross its path and a third walks along it.
See: No contact. The event log shows "Safety stop: lidar points … ahead" as walkers step into the arc the tracker commands, and the closest approach is 0.03 m. With the safety stop off, the same run has 2 contacts, at 21.5 s and 43.9 s.
Shows: The stop works for people who also step aside: it slows the robot, and they do the rest. (Scripted walkers that never react walk into it whatever it does; that is lesson 5's point.)

## Try: Safety stop on the sonar ring
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar"},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}
Setup: The same run, with the ultrasonic ring on and the safety stop reading the sonars instead of the lidar. It treats every point of a returned arc as an obstacle, since the echo could have come from anywhere on it.
See: 2 contacts, at 21.5 s and 43.9 s, as if there were no safety stop at all. Each time the walker is nearly dead ahead, inside the front cone, and that cone is drawn dashed red: as the walker came within 0.2 m of the hull, the front sonar's reading became a dead-zone miss, it replaced the echo that was there, and the stop forgot the walker at the moment it mattered. Seeds 3 and 11: 2 contacts each, against none with the lidar.
Shows: The nearest obstacle is the one a sonar cannot hear. A stop that keeps only each sonar's latest reading is blind exactly when it is needed; a real ring holds the last close echo for a while.
Predict: The safety stop on the sonar ring instead of the lidar. How many contacts with the walkers?
- None, like the lidar's
- The same two as with no safety stop
- More than with no safety stop: the stop gets in the way
Answer: 1

## Try: The sonar stop without its dead zone
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar","sonMin":0},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}
Setup: The same, with the dead zone set to 0 (Perceive → Ultrasonic ring), a transducer that stops ringing at once.
See: No contact at seed 7 (one at seed 3, none at seed 11): the front cone now hears the walker all the way in, and the stop slows the robot as the lidar's did.
Shows: The diagnosis: the dead zone, not the slow ring or the 30° cone, is what the sonar stop missed people by.

## Try: A sonar-only particle filter
cfg: {"sim":true,"level":2,"set":{"loc":"pf","pfLidar":false,"sonar":true,"pfSonar":true,"bOff":"all"},"tab":"loc","plot":"pos","layers":{"belief":true}}
Setup: L3 with its noisy odometry and its prior map, every beacon switched off, the particle filter's lidar likelihood off and the cone likelihood on: the ring against the map is all it has. Localize tab, Position error plot.
See: All five goals, no collision. The error wanders between a few centimetres and about 20 cm, pose RMS 0.13 m, and the filter's σ stays between 8 and 16 cm, so the 2σ band of the plot is about twice as wide as with the lidar. The error is inside the band 77 % of the time: the filter is overconfident. With nothing at all (the cone likelihood off too) the robot is lost within half a minute and reaches no goal.
Shows: A cone's nearest range pins the distance to a wall, and a ring of them against a map is enough to localize, from about 20 numbers a second against the lidar's 120. Seeds 3 and 11: five goals of five, RMS 0.13 and 0.07 m, with one brush against a shelf at seed 3.
Predict: Every beacon off, no lidar likelihood, the sonar ring against the prior map. How good is the estimate?
- Lost within a minute: eight numbers per cycle are too few
- Localized, with about twice the lidar's error and a wider band
- As good as the lidar's: a few centimetres
Answer: 1

## Try: The lidar alone, for comparison
cfg: {"sim":true,"level":2,"set":{"loc":"pf","bOff":"all"},"tab":"loc","plot":"pos","layers":{"belief":true}}
Setup: The same filter with the lidar's likelihood field instead of the cone likelihood, every beacon off.
See: Pose RMS 0.06 m, the error between 3 and 7 cm, σ between 4 and 6 cm, inside the 2σ band 91 % of the time; all five goals.
Shows: A bearing for every number: the lidar's 24 beams at 5 Hz each say where the wall is, not only how far.

## Try: Crosstalk turned up to 30 %
cfg: {"sim":true,"level":2,"set":{"loc":"pf","pfLidar":false,"sonar":true,"pfSonar":true,"bOff":"all","sonXt":30},"tab":"loc","plot":"pos","layers":{"belief":true}}
Setup: The sonar-only particle filter again, with nearly a third of the readings a neighbour's echo.
See: Rose arcs everywhere on the ring. The filter holds: five goals of five, pose RMS 0.13 m as before, one brush with a shelf at seed 7 (none at seeds 3 and 11, RMS 0.12 and 0.10 m).
Shows: The floor in the likelihood is what makes a filter robust: a reading the map cannot explain, a crosstalk echo or a person, costs a particle a bounded factor instead of zeroing it. On the map, crosstalk does more harm (chapter 3 §11: with rough walls, the share of mapped cells that are real falls from 88 % to 42 %).
Predict: The sonar-only filter with 30 % crosstalk. What happens to the estimate?
- It loses the robot: a third of its readings are wrong
- It holds: the error stays about where it was
- It improves: more echoes, more evidence
Answer: 1

## Code: integrateSonar
snippet: sonar-arc
focus: const cand = arc.filter
focus: lArc = n > 1
focus: lo[idx] = clamp(lo[idx] + L_SFREE, -L_CLAMP, L_CLAMP);
Note: The cells in the cone's bounding box are sorted into the arc (within 0.07 m of the range) and the free region before it. The arc's evidence is shared over the cells not already known free: that is the line that makes walls emerge as the robot drives. Change L_KNOWN to -99 (every arc cell counts) and the rough-wall run hits walls twice as often (chapter 3 §11); change L_SFREE and watch how fast the arcs painted in front of walls are erased. The sensor itself is sonarSense and sonEcho in core/sensors.js; the cone likelihood is pfSonarUpdate in core/localization.js. Your localizer and your predictor in the Code tab get the readings as obs.sonar.

## Think about
Q: Why does a reading at maximum range mark nothing, when a lidar beam at maximum range marks its whole line free?
A: Because a sonar reading at maximum range has two explanations that the sensor cannot tell apart: the cone is empty, or every surface in it was met at a slant and sent the echo away. Marking the cone free would erase walls the robot passes at an angle, which is most walls in an aisle. A lidar beam that returns nothing really went through.
Q: A real ring keeps the last close echo for a moment instead of letting a dead-zone miss replace it. What would that fix here, and what would it cost?
A: It would fix the sonar safety stop's two contacts: the walker who came within 0.2 m would still be in the stop's view. The cost is stale obstacles: a person who stepped away keeps the robot stopped until the memory expires, and on a ring that updates every 0.4 s the memory has to last at least a cycle. Every safety layer trades missed obstacles against phantom ones.
Q: A glass door in a corridor. What would each sensor see on a real robot, and what does the lab show?
A: The laser would mostly pass through the glass and report the corridor beyond; the sonar would hear the door as a wall. A stop reading both (Control → The safety stop reads → Both) stops for it; one reading the lidar alone drives into it. The lab models no materials, so its glass would reflect both, and Both behaves like the lidar alone. That is the sonar's real case, and it is the one thing this lesson cannot show.
Q: Why is the sonar-only filter overconfident (inside its 2σ band only 77 % of the time)?
A: Its expected reading ignores the specular rule, since the map stores no surface normals, so every specular miss is scored by the 0.3 term instead of being predicted; and successive readings of the same wall are not independent, which the tempering by 0.5 only partly accounts for. Both make the weights sharper than the evidence, so the particles cluster more tightly than the error warrants.

## Check yourself
Q: A sonar reading at 2 m puts 15 cells on its arc, none of them known to be free. What log-odds does each of them get from this reading?
Answer: 0.13
Tolerance: 0.01
Unit: 
How: $l_\text{arc} = \ln\frac{n + 1}{n - 1} = \ln\frac{16}{14} = 0.134$; it takes four such readings to pass the occupied threshold of 0.5, where a single lidar hit adds 0.85.
