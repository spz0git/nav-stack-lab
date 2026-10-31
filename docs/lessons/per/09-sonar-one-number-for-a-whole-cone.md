group: per
title: Sonar: one number for a whole cone

<p><b>Why this matters.</b> Most robots that carry a lidar also carry a ring of ultrasonic sensors, and many cheap robots carry nothing else. A sonar costs a fraction of a lidar and has no moving parts. On a real robot it hears glass doors, mirrors and dark or shiny surfaces that a laser can pass through or fail to see. It also fails in ways a lidar does not, and those failures decide what you can trust it with. This lesson takes the lab's three uses of a range sensor (building the map, the safety stop, localizing against a prior map) and gives each one the sonar ring instead of the lidar.</p>
<p><b>The idea.</b> A sonar sends a ping and times the first echo. What comes back is <i>one range for a whole cone</i> about 30° wide. It is the distance to the nearest surface in the cone that sent the echo back, and it has no bearing. Three things can go wrong. A smooth surface met at a slant reflects the sound away like a mirror. This is a specular miss, and it means a flat wall is heard only within about 45° of square-on. An echo from very close arrives while the transducer is still ringing from its own ping, and is lost; the range where this happens is the dead zone. And a sonar can hear a neighbour's ping and report it as its own, which is called crosstalk. The sonars in the ring fire in turn, so each one reads only every 0.4 s. On the map, a reading becomes an arc: something on the arc echoed, and nothing between the sonar and the arc did.</p>
$$l_\text{arc}(n) = \ln\frac{n + 1}{n - 1} \approx \frac{2}{n} \qquad l_\text{free} = -0.2$$
<p>Each of the $n$ arc cells that could have echoed gets $l_\text{arc}$. Each cell inside the cone between the sonar and the arc gets $l_\text{free}$. A reading at maximum range marks nothing.</p>
<p><b>Where it comes from.</b> With no bearing, each of the $n$ arc cells is the echo with probability $1/n$. A cell is occupied if it is the echo. If it is not, it is occupied with the prior probability of one half. So $p = (n + 1)/2n$, and the log-odds is $l_\text{arc}$. At 2 m an arc covers about 15 cells and each gets 0.13, so a wall cell needs four readings where one lidar hit was enough. Only cells that the map does not already know to be free count in $n$, so the evidence gathers on the wall as the robot drives. For localizing, the particle filter compares each reading with the nearest obstacle that the prior map puts inside that sonar's cone. <a class="chref" href="#notes=ch3/11-sonar-one-range-for-a-whole-cone">Derivation, the cone likelihood and the measured table: chapter 3 §11</a></p>
<p><b>What the lab does.</b> Sensors → Ultrasonic ring switches the ring on; it is off by default. It has 8 sonars round the hull, with cones 30° wide and 15° unseen between neighbours, a reach of 4 m and a dead zone of 0.2 m from the hull. The range noise is 1 cm, a ray more than 30° from square-on is a specular miss, crosstalk is 2 %, and there is one ping every 50 ms. Perceive → What builds the map picks lidar, sonar or both, and Control → The safety stop reads does the same for the stop. Localize → Also weight particles by the sonar ring adds the cone likelihood to the particle filter. The Sonar ring layer draws each cone where it was measured. The arc is green where an echo came back. The cone is dashed where none did, orange for a specular miss and red for the dead zone. A neighbour's echo is drawn in rose. The lab does not model materials, so every surface reflects the laser and the sound alike. You will see the sonar's failures here, and none of its advantages over a lidar.</p>

## Try: Sonar only: the unknown building
cfg: {"sim":true,"level":3,"set":{"sonar":true,"mapSrc":"sonar"},"tab":"per"}
Setup: L4, the unknown building of lesson 1, with the EKF on beacons for the pose as before. The ultrasonic ring is on and the map is built from the sonars alone. The Perceive tab is open, and the Sonar ring layer and the true-map ghost are on.
See: The robot heads north for the first door and turns towards the path beyond it. At 8.6 s it drives into the wall just right of the door. It met that wall at a slant, and the cones facing it are dashed orange. It backs off, replans through the same wall, and hits it again at 21.4 s. Then it gives up on each goal in turn. No goal is reached, there are 2 collisions, and Floor seen stays at 14 % (lesson 1's lidar map ends at 96 %). Of the ring's readings, 31 % are specular misses and 22 % are dead-zone misses, from the minutes spent pressed against the wall. The map is a few strokes of wall and wedges of free floor around the start.
Shows: A cone hears a flat wall only within about 45° of square-on. A planner that counts unseen space as free routes straight through a wall that no sonar heard. Once the robot is against the wall, the dead zone hides the wall as well. Seeds 3 and 11 end the same way, with no goal and 5 and 2 collisions.
Predict: The same mission as lesson 1, with the map built from the sonars alone. What happens?
- The same four goals, more slowly, on a blurrier map
- The robot hits a wall it met at a slant, which no sonar heard
- The robot will not move: it has seen too little free floor
Answer: 1

## Try: Rough walls: specular beyond 50°
cfg: {"sim":true,"level":3,"set":{"sonar":true,"mapSrc":"sonar","sonSpec":50},"tab":"per"}
Setup: The same run, with rougher surfaces. A ray's echo now comes back up to 50° from square-on, so a cone hears a wall up to about 65° off its axis.
See: There are far fewer dashed orange cones, and 11 % of the readings are specular misses. Walls appear as thick, broken strokes, smeared along their length past their ends, with wedges of free floor between the cones. The boxes in the rooms come out as fragments. The robot reaches all four goals by 89 s, with 2 collisions (at 23.2 s and 79.6 s) and 15 replans against the lidar's 3. Floor seen reaches 67 %. Against the truth, 88 % of the cells the map calls occupied have an obstacle within a cell (lidar 100 %), and the map holds 75 % of the obstacle cells it has seen (lidar 96 %).
Shows: Once the walls are heard, the map is what the arc model gives. It is right on average, and blurred because each arc spreads about a quarter of the range to either side. The mission is fragile. At seeds 3 and 11 the robot reaches one goal of four, with 3 collisions each, and it still finds the walls it is pressed against by hitting them.
Predict: Rougher walls, sonar map. Compare the map with the true-map ghost: where do they differ most?
- The walls are thick, broken strokes and the boxes are fragments
- The walls are doubled, as with dead reckoning in lesson 1
- Nowhere: it is as sharp as the lidar's
Answer: 0

## Try: The warehouse aisles with sonar only
cfg: {"sim":true,"level":1,"set":{"per":"mapping","sonar":true,"mapSrc":"sonar"},"tab":"per"}
Setup: L2, the warehouse aisles, with no prior map. The map is built from the sonars alone as the robot drives, and the walls are smooth again.
See: The shelf faces that face the cones are mapped as clean lines. At 3.6 s the robot clips the end of the first shelf, whose long face it was passing at a slant, and it is stuck there for about 15 s. It reaches 1 goal of 4, with Floor seen at 28 %. Built by the lidar, the same map is complete (99 %) and the robot reaches all four goals without a contact. Seeds 3 and 11 also reach 1 goal of 4.
Shows: Aisles are the worst case for a sonar. The robot passes long faces at a slant, and the square shelf ends are about the size of a cone's arc. A sonar ring is a cheap proximity sensor to fit under a robot's bumper; it should not be used to build the map.

## Try: Safety stop on the lidar, people who react
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}
Setup: L5, the busy floor, with four walkers in the warehouse aisles, here reacting to the robot. Agent tracking is off and the response to agents is Ignore, so only the lidar safety stop protects them. The robot drives up the cross aisle at x = 12 m and back. The walkers of two aisles cross its path there, and a third walks along it.
See: There is no contact. The event log shows "Safety stop: lidar points … ahead" when walkers step into the arc the tracker is about to drive, and the closest approach is 0.03 m. With the safety stop off, the same run has 2 contacts, at 21.5 s and 43.9 s.
Shows: The stop works for people who also step aside. It slows the robot, and they do the rest. Scripted walkers, who never react, walk into the robot whatever the stop does, as lesson 5 showed.

## Try: Safety stop on the sonar ring
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar"},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}
Setup: The same run, with the ultrasonic ring on and the safety stop reading the sonars instead of the lidar. It treats every point of a returned arc as an obstacle, since the echo could have come from anywhere on it.
See: There are 2 contacts, at 21.5 s and 43.9 s, as if there were no safety stop at all. Each time the walker is nearly dead ahead, inside the front cone, and that cone is drawn dashed red. When the walker came within 0.2 m of the hull, the front sonar's reading became a dead-zone miss. The miss replaced the echo that was there before, so the stop forgot the walker at the moment it mattered. Seeds 3 and 11 have 2 contacts each, against none with the lidar.
Shows: A sonar cannot hear an obstacle that is very close, and for a safety stop that is the obstacle that matters most. A stop that keeps only each sonar's latest reading goes blind when it is needed. A real ring holds the last close echo for a while.
Predict: The safety stop on the sonar ring instead of the lidar. How many contacts with the walkers?
- None, like the lidar's
- The same two as with no safety stop
- More than with no safety stop: the stop gets in the way
Answer: 1

## Try: The sonar stop without its dead zone
cfg: {"sim":true,"level":4,"set":{"agents":"off","spd":"none","people":"reactive","guard":true,"sonar":true,"guardSrc":"sonar","sonMin":0},"goals":[[12,1.6],[12,15],[12,1.6]],"tab":"ctl"}
Setup: The same run, with the dead zone set to 0 (Sensors → Ultrasonic ring). This models a transducer that stops ringing at once.
See: There is no contact at seed 7, one at seed 3 and none at seed 11. The front cone now hears the walker all the way in, and the stop slows the robot as the lidar's stop did.
Shows: So the sonar stop missed people because of the dead zone. The slow ring and the 30° cone were not the cause.

## Try: A sonar-only particle filter
cfg: {"sim":true,"level":2,"set":{"loc":"pf","pfLidar":false,"sonar":true,"pfSonar":true,"bOff":"all"},"tab":"loc","plot":"pos","layers":{"belief":true}}
Setup: L3 with its noisy odometry and its prior map. Every beacon is switched off, the particle filter's lidar likelihood is off and the cone likelihood is on, so the filter has only the ring against the map. The Localize tab is open, with the Position error plot.
See: All five goals are reached with no collision. The error wanders between a few centimetres and about 20 cm, with a pose RMS of 0.13 m. The filter's σ stays between 8 and 16 cm, so the 2σ band in the plot is about twice as wide as with the lidar. The error is inside the band 77 % of the time, so the filter is overconfident. With the cone likelihood off as well, the filter has nothing at all to correct with: the robot is lost within half a minute and reaches no goal.
Shows: A cone's nearest range pins the distance to a wall. A ring of cones read against a map is enough to localize, from about 20 numbers a second against the lidar's 120. Seeds 3 and 11 reach five goals of five, with RMS 0.13 and 0.07 m and one brush against a shelf at seed 3.
Predict: Every beacon off, no lidar likelihood, the sonar ring against the prior map. How good is the estimate?
- Lost within a minute: eight numbers per cycle are too few
- Localized, with about twice the lidar's error and a wider band
- As good as the lidar's: a few centimetres
Answer: 1

## Try: The lidar alone, for comparison
cfg: {"sim":true,"level":2,"set":{"loc":"pf","bOff":"all"},"tab":"loc","plot":"pos","layers":{"belief":true}}
Setup: The same filter, with the lidar's likelihood field instead of the cone likelihood and every beacon off.
See: The pose RMS is 0.06 m, with the error between 3 and 7 cm and σ between 4 and 6 cm. The error is inside the 2σ band 91 % of the time, and all five goals are reached.
Shows: Every lidar number comes with a bearing. Each of the lidar's 24 beams at 5 Hz says in which direction the wall is as well as how far away it is.

## Try: Crosstalk turned up to 30 %
cfg: {"sim":true,"level":2,"set":{"loc":"pf","pfLidar":false,"sonar":true,"pfSonar":true,"bOff":"all","sonXt":30},"tab":"loc","plot":"pos","layers":{"belief":true}}
Setup: The sonar-only particle filter again, now with nearly a third of the readings coming from a neighbour's echo.
See: There are rose arcs all round the ring. The filter holds, with five goals of five and a pose RMS of 0.13 m as before. There is one brush with a shelf at seed 7, and none at seeds 3 and 11 (RMS 0.12 and 0.10 m).
Shows: The likelihood has a floor, a minimum value it never drops below, and the floor keeps the filter stable. A reading the map cannot explain, such as a crosstalk echo or a person, then costs a particle a bounded factor instead of setting its weight to zero. Crosstalk does more harm to the map. With rough walls, the share of mapped cells that are real falls from 88 % to 42 % (chapter 3 §11).
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
Note: The cells in the cone's bounding box are sorted into the arc (within 0.07 m of the range) and the free region in front of it. The arc's evidence is shared over the cells not already known to be free, and that line is what makes walls emerge as the robot drives. Change L_KNOWN to -99, so that every arc cell counts, and the rough-wall run hits walls twice as often (chapter 3 §11). Change L_SFREE and watch how fast the arcs painted in front of walls are erased. The sensor itself is sonarSense and sonEcho in core/sensors.js, and the cone likelihood is pfSonarUpdate in core/localization.js. Your localizer and your predictor in the Code tab get the readings as obs.sonar.

## Think about
Q: Why does a reading at maximum range mark nothing, when a lidar beam at maximum range marks its whole line free?
A: A sonar reading at maximum range has two explanations that the sensor cannot tell apart. Either the cone is empty, or every surface in it was met at a slant and sent the echo away. Marking the cone free would erase walls that the robot passes at an angle, and in an aisle that is most walls. A lidar beam that returns nothing really went through.
Q: A real ring keeps the last close echo for a moment instead of letting a dead-zone miss replace it. What would that fix here, and what would it cost?
A: It would fix the sonar safety stop's two contacts, because the walker who came within 0.2 m would still be in the stop's view. The cost is stale obstacles. A person who has stepped away keeps the robot stopped until the memory expires, and on a ring that updates every 0.4 s the memory has to last at least one cycle. Every safety layer has to balance missed obstacles against phantom ones.
Q: A glass door in a corridor. What would each sensor see on a real robot, and what does the lab show?
A: The laser would mostly pass through the glass and report the corridor beyond it. The sonar would hear the door as a wall. A stop that reads both (Control → The safety stop reads → Both) stops for the door, and one that reads the lidar alone drives into it. The lab models no materials, so its glass would reflect both, and Both behaves like the lidar alone. Surfaces like glass are the main reason to fit a sonar ring, and this lesson cannot show them.
Q: Why is the sonar-only filter overconfident (inside its 2σ band only 77 % of the time)?
A: There are two reasons. Its expected reading ignores the specular rule, because the map stores no surface normals, so every specular miss is scored by the 0.3 term instead of being predicted. And successive readings of the same wall are not independent, which the tempering by 0.5 only partly accounts for. Both make the weights sharper than the evidence justifies, so the particles cluster more tightly than the error warrants.

## Check yourself
Q: A sonar reading at 2 m puts 15 cells on its arc, none of them known to be free. What log-odds does each of them get from this reading?
Answer: 0.13
Tolerance: 0.01
Unit: 
How: $l_\text{arc} = \ln\frac{n + 1}{n - 1} = \ln\frac{16}{14} = 0.134$. It takes four such readings to pass the occupied threshold of 0.5, where a single lidar hit adds 0.85.
