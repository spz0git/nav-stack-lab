group: intro
title: Keep your distance: the costmap
level: 1

<p><b>Why this matters.</b> A map says where the walls are. A planner needs more than that: it needs to know where the robot may go, and where it would rather not. A robot is not a point, its position is never exact, and scraping along a shelf is bad even when it does not hit it. The costmap is where all of that becomes numbers. It decides how close to the shelves the robot will drive.</p>
<p><b>The idea.</b> Start from the map, and give every cell its distance to the nearest obstacle. Then apply two rules. A cell closer than the robot's radius plus a safety margin is <i>lethal</i>: the robot's centre may never enter it, because its body would overlap the obstacle. Beyond the lethal cells lies the <i>inflation band</i>, where entering a cell costs extra, most next to the lethal cells and fading to nothing at the band's outer edge. The planner looks for the cheapest path, so the band makes it prefer the middle of an aisle without forbidding the sides. A wider band pushes harder; no band at all lets the path run right along the lethal edge.</p>
<p><b>What the lab does.</b> L2, the warehouse, with the map known. The robot's radius is 0.3 m and the margin 0.1 m, so cells within 0.4 m of a shelf are lethal. The band's width is the inflation slider in the Perceive tab, 0.6 m by default. The cost layer draws the lethal cells dark and the band as a fading tint. The Metrics list shows the Wall clearance: the smallest gap between the robot's body and a shelf or wall so far.</p>
<p><b>Where it comes from.</b> With $d$ a cell's distance to the nearest obstacle and $w$ the band's width, the lab charges a move into a cell its length times $1 + 3 \cdot \text{penalty}$, with</p>
$$\text{penalty} = \left(\frac{0.4 + w - d}{w}\right)^2 \quad \text{for } 0.4\ \text{m} \le d < 0.4\ \text{m} + w$$
<p>So a step at the inner edge of the band costs four times its length, and a step at the outer edge costs its length. Go deeper: <a class="lsref" href="#lesson=per:2">Costmap: lethal cells and the inflation band</a> · <a class="chref" href="#notes=ch3/3-the-costmap-distance-transform-and-inflation">the distance transform and inflation: chapter 3 §3</a></p>

## Try: No band
cfg: {"sim":true,"level":1,"set":{"infl":0},"layers":{"cost":true},"tab":"per"}
Setup: L2 with the inflation band set to 0 m. Only the dark lethal collars are left around the shelves.
See: The event log shows a “Replan (costmap changed)” at once, and the new path runs close along the dark collars and cuts the corners tight. The four paths are 8.2, 12.8, 12.6 and 25.2 m long, and the mission completes at 76.0 s. The Wall clearance ends at 0.08 m: at one point the robot's body passes 8 cm from a shelf.
Shows: Without a band, the cheapest path is the shortest one, and the shortest path hugs the obstacles. The lethal rule keeps the robot's centre 0.4 m away, but the robot never drives exactly on its path, so its body comes much closer. This floor has no randomness that changes the path, so other seeds give the same run.
Predict: With no inflation band, where does the path run along an aisle?
- Down the middle of the aisle
- Close along the shelves, just outside the dark lethal collars
- It cannot be planned: the planner needs the band
Answer: 1

## Try: The default band, 0.6 m
cfg: {"sim":true,"level":1,"layers":{"cost":true},"tab":"per"}
Setup: The same floor with the band back at its default, 0.6 m. The tint now fills most of each aisle, leaving a clear channel down the middle.
See: The paths run down the clear channels and enter the tint only at corners. They are 8.6, 13.0, 12.9 and 26.1 m long, 3 % longer in total, and the mission takes 78.3 s instead of 76.0 s. The Wall clearance ends at 0.27 m, more than three times the gap without a band.
Shows: The band buys distance from the shelves for a few extra metres of driving. It is a preference, not a rule: where a detour would cost more than the penalty, the path still cuts into the band, which is why the closest pass is at a corner.
Predict: With the default band, how does the closest pass to a shelf compare?
- About the same, 8 cm: the lethal rule decides it
- Clearly larger, because the path keeps to the middle of the aisles
- Zero: the robot now touches a shelf
Answer: 1

## Think about
Q: Why not make every cell within 1 m of a shelf lethal, to be safe?
A: Many aisles are less than 2 m wide, so no cell in them would be allowed and the planner would find no path. Lethal cells are a hard rule for what the robot's body cannot do; the band is a soft preference that gives way when it has to. Keeping the two separate lets the robot use narrow aisles and still prefer wide ones.

## Check yourself
Q: In the first experiment (no band), what does Wall clearance read at the end of the mission?
Answer: 0.08
Tolerance: 0.02
Unit: m
How: 0.08 m: the robot's body came within 8 cm of a shelf. With the default band it was 0.27 m.
