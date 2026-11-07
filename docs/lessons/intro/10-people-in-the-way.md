group: intro
title: People in the way
level: 1

<p><b>Why this matters.</b> Shelves stay where they are; people do not. A robot that shares a floor with people has to notice them, guess where they are going, and change what it does in time. Getting this wrong is not a slower mission but a person hit by a machine. This lesson puts the whole loop of the earlier lessons on a floor with people and shows the simplest useful response: slow down and let them pass.</p>
<p><b>The idea.</b> Perception finds people in the lidar scan: hits that the map of shelves cannot explain, grouped into clusters. A tracker follows each cluster from scan to scan and estimates its velocity. From that velocity it predicts where the person will be over the next few seconds, assuming they keep walking the same way. The robot then keeps its path but chooses its speed: if it would arrive where a person is predicted to be at the same moment, it slows down or waits until the way is clear. This is a <i>speed planner</i>. It cannot steer around anyone; it can only change when the robot gets there.</p>
<p><b>What the lab does.</b> L5, the busy floor: a warehouse with five goals and four people who walk their own routes at 0.6 to 0.9 m/s, regardless of the robot. The tracker draws each person it follows as a ring with dashed circles where it predicts them over the next seconds. The ST graph in Telemetry shows the speed planner's view: distance along the path up, time across, each predicted person as a shaded block, and the planned speed as a line that must pass the blocks. The Control tab's Response to agents switches between Speed planning (the default here) and Ignore. The Metrics list shows the Collisions, the Closest to a person and the Contacts by speed: each contact's relative speed and its class, a touch below 0.3 m/s, a bump up to 1 m/s and a strike above that.</p>
<p><b>Where it comes from.</b> For a person predicted to cross the path at distance $s$ ahead, the robot at speed $v$ arrives after</p>
$$t_\text{arrive} = \frac{s}{v}$$
<p>If the person is predicted there at that time, the planner picks a lower speed so the robot arrives after they have passed. The ST graph does this for every distance and time at once. Go deeper: <a class="lsref" href="#lesson=per:3">Tracking people: from lidar hits to tracks</a> · <a class="chref" href="#notes=ch4/6-speed-planning-the-st-graph">speed planning and the ST graph: chapter 4 §6</a></p>

## Try: Speed planning
cfg: {"sim":true,"level":4,"tab":"ctl","plot":"st"}
Setup: L5 with the lidar tracker and the speed planner. The Control tab and the ST graph open.
See: When a person's predicted path crosses the robot's, a block appears on the ST graph, the planned speed line bends under it, and the robot slows or stops on its path. The event log reports “Speed planner: yielding” four times. All five goals are reached at 121 s. There is one contact, at 52 s, at 0.73 m/s (a bump): a person walks to the end of their route, turns back towards the robot, and walks into it while it is down to a crawl.
Shows: Slowing for predicted people works most of the time. The contact shows its limit: the tracker needs most of a second to notice the person has turned, and a robot that can only slow down cannot get out of the way of someone walking into it. On seeds 2 to 4 the pattern is the same: five or six yields and one contact.
Predict: A person is about to cross the robot's path ahead. What does the robot do?
- Steers around the person, off its path
- Slows or stops on its path until the person has passed
- Keeps its speed; people are expected to step aside
Answer: 1

## Try: Ignore the people
cfg: {"sim":true,"level":4,"set":{"spd":"none"},"tab":"ctl","plot":"st"}
Setup: The same floor with Response to agents set to Ignore. The robot still tracks the people, but drives its path at cruise speed as if the floor were empty.
See: No yields appear in the event log. The robot drives through people on the map, and the Collisions count climbs to 3, at 51, 54 and 79 s. Contacts by speed lists them as strikes, at 1.36, 1.40 and 1.60 m/s. The mission completes sooner, at 106 s.
Shows: Fifteen seconds faster, and three strikes instead of one bump. The people here never step aside, so everything the robot does not do, nobody does. On seeds 2 to 4 the run is the same three strikes. Yielding costs time and saves contacts; deciding how much of each is acceptable is what the safety lessons are about.
Predict: With the people ignored, what happens to the collisions count in the status strip?
- It stays at 0: the people step out of the way
- It rises: the robot drives into people at full speed
- The robot refuses to drive while people are tracked
Answer: 1

## Think about
Q: The speed planner yields to people, yet still had a contact. Why could the robot not avoid it?
A: The person turned back towards the robot, and the tracker's velocity took most of a second to follow the turn. By the time the prediction said “coming at you”, the robot had slowed almost to a stop, but it can only slow along its path, not back away or step aside. Avoiding that contact needs a planner that can change the path, or a robot that keeps more distance.

## Check yourself
Q: In the second experiment (Ignore), what is the fastest contact listed in Contacts by speed in the Metrics list?
Answer: 1.6
Tolerance: 0.05
Unit: m/s
How: 1.60 m/s, the strike at 79 s. With speed planning on, the only contact was 0.73 m/s.
