group: plan
title: Replanning and the behaviour layer

<p><b>Why this matters.</b> A plan rests on assumptions. It assumes that the map is right, that the estimate of the robot's pose is right, that the people will be where they were predicted, and that the robot will make progress. Each of these fails often in normal work. The behaviour layer is the small piece of logic that notices a failure and decides what to do about it: plan again, wait, or give up on this goal. It is tiny compared with the planners it supervises, yet it decides most of what a user sees the robot do. The Mission tab draws it live, so that you can watch it work.</p>
<p><b>The idea.</b> On this grid a plan takes milliseconds. So the policy is to replan whenever an assumption behind the current plan breaks, instead of trying to make one plan that copes with everything. The behaviour layer is a state machine with a handful of states: PLAN, DRIVE, NO_PATH, LOST and DONE. Triggers move it between them. The triggers are a lethal cell on the path ahead, the estimate too far from the path, no progress in five seconds, a timer, and a report from the speed planner that slowing down will not get the robot past a person. Each trigger carries a reason, which the event log prints, so the log records which assumptions broke and when.</p>
$$\begin{aligned} \text{DRIVE} &\to \text{PLAN} && \text{on: path blocked} \cdot \text{off path} \cdot \text{stuck} \cdot \text{periodic} \cdot \text{agent blocking} \\ \text{PLAN} &\to \text{NO\_PATH} \xrightarrow{\ 2\ \text{s}\ } \text{PLAN} && \text{skip after 3} \end{aligned}$$
<p><b>Where it comes from.</b> There is nothing to derive here. The machine is a design, and the design choices are its thresholds. The path is checked 6 m ahead every 0.5 s. The robot counts as off the path at 1 m. It must make 0.15 m of progress in 5 s. A goal is skipped after three failures. Only the "agent blocking" trigger has a mechanism behind it. For that one plan, the discs where people are predicted to be over the next 2 s are stamped into the costmap as lethal, so the new route avoids the places where they will be. Afterwards the costmap is rebuilt without them. <a class="chref" href="#notes=ch4/5-the-mission-layer">The machine, the thresholds and goal ordering: chapter 4 §5</a></p>
<p><b>What the lab does.</b> The Mission tab draws the state machine, with the current state lit and the last transition highlighted. The event log gives the reason for each transition. The order of the goals (in order, greedy or optimal) is decided once, at the start of the mission, from distances in the costmap. The periodic replan slider adds a timer trigger. Its replans are not logged, to keep the log readable, and they pre-empt the other triggers. A reached goal gets a tick on the map. A skipped goal stays grey with no tick, and its hover card says skipped.</p>

## Try: Discover the building
cfg: {"sim":true,"level":3,"tab":"mis"}
Setup: L4, the unknown building, which the robot maps as it drives. There is no periodic replan. Mission tab.
See: The log shows three "Replan (path blocked)" events, at 4.3, 13.2 and 31.2 s. Each is a wall that appeared across the planned route when the lidar reached it. There are also four fresh plans, one at each goal. Each replan takes between sixty and a few thousand expansions, in under 10 ms. The robot reaches all four goals in 67 s.
Shows: With cheap replanning, optimistic planning is a complete strategy for an unknown map. The planner treats unknown cells as free, and replans as soon as the map shows something in the way. Watch the state machine flick DRIVE → PLAN → DRIVE at each wall. The robot hardly slows, because the new plan is ready before the next tick.
Predict: Driving into the unknown building with optimistic planning, how many "path blocked" replans will the log show?
- None: the planner only plans through seen space
- A few, one per wall discovered across the route
- Dozens: every new scan changes the costmap
Answer: 1

## Try: Periodic replan every 1 s
cfg: {"sim":true,"level":3,"set":{"replan":1},"tab":"mis"}
Setup: The same level, with a periodic replan every 1 s.
See: About seventy plans run during the mission, and the log shows four of them, the fresh plans at the goals. There is no "path blocked" replan this time. Each time a wall appeared across the route, a periodic plan ran before the next path check (one every half-second), and that plan already went around the wall. Periodic plans are not logged. The route is the same, and the mission takes 70 s instead of 67. The plan is rebuilt from the current estimate every second, and each rebuild starts the path slightly differently under the tracker.
Shows: Replanning on a timer is a simple way to keep a plan up to date, and here it costs little, about 5 % of the mission time. On a real vehicle the cost is different. Each new plan can differ from the last by a lane's width, and a tracker that follows a path that keeps moving oscillates. Event-triggered replanning changes the plan only when something has changed. Periodic replanning changes it whether anything has changed or not. Whether the timer or the path check catches a new wall depends on which comes first. On this seed the timer is first every time. On other seeds one or two "path blocked" lines still appear (seeds 1 and 2 have two each). The number of plans, about seventy, is the same on every seed.
Predict: Add a 1 s periodic replan. How many plans will the mission run, and how many will the log show?
- About seventy, one a second, but the log shows only a handful: periodic plans are not logged
- About seven, as before: the timer only fires when no other trigger has
- About seventy, each with its own line in the log
Answer: 0

## Try: Agent-blocking replans
cfg: {"sim":true,"level":4,"tab":"mis"}
Setup: L5, the busy floor. The speed planner reports the people it cannot get past. Mission tab.
See: The speed planner yields four times over the run. Twice, at 51 s and 99 s, it escalates, and the log shows "Replan (agent blocking)". The new paths, of 13.6 m and 16.7 m, go around the person's predicted positions instead of waiting behind them. The robot reaches five goals in 121 s, with one contact, at 52 s, half a second after the first new path.
Shows: The layers share the work. The trajectory layer, which sets the speed, handles most people by slowing down. The route changes only when slowing cannot resolve the conflict. Each escalation costs a full replan, with 2 s of the people's predicted positions stamped into the costmap. That is cheap here, and the new route is right if the prediction was right. The contact shows the limit. A person who does not do what was predicted is in the costmap where they were going to be, which is not where they are. This person had been tracked for seconds and still made contact.
Predict: On the busy floor, how often will the speed planner escalate from slowing to an "agent blocking" replan?
- At every encounter with a person
- Never: slowing always resolves a conflict in a wide aisle
- Two or three times in the whole run
Answer: 2

## Code: missionTick, the replan triggers
snippet: mission-tick
focus: F.pendingReason = 'off path';
focus: F.pendingReason = 'path blocked';
focus: F.pendingReason = 'stuck';
Note: The three marked lines are three of the lesson's triggers. Each sets a reason and sends the machine to PLAN, and the event log prints the reason. The thresholds (1 m off the path, 6 m look-ahead, 0.15 m in 5 s) are a few lines above each one. The behaviour layer has no code slot of its own. What you can replace is the planner it calls.

## Think about
Q: Why skip a goal after three failures instead of trying forever?
A: Some goals cannot be reached. A goal may be walled off, or in unknown space treated as lethal with no seen floor leading to it, or occupied by someone who will not move. Trying forever on such a goal would stall the whole mission. On this floor, three attempts over about 6 s are enough to tell a passing blockage from a permanent one. The right number depends on how often the world changes.
Q: The "off path" trigger fires when the estimate is 1 m from the path. What happens if the estimate is wrong?
A: The robot replans from a pose it is not at. It then drives the new path from where it really is, ends up off the path again, and fires the trigger again. The kidnapped-EKF run in the localization lessons shows this: a loop of off-path replans around a pose the robot is not at. The behaviour layer can act only on the estimate. Recovering the estimate is the estimator's job, and the lost guard lets the estimator ask for time to do it.
Q: The lab finds the optimal goal order by an exact search. Why can that not scale?
A: The search goes through the possible orders. 8 goals have 40 320 orders, and 15 goals have over a trillion. Branch-and-bound prunes most of them, but not enough. Real fleets use heuristics, such as nearest neighbour and 2-opt improvements, and accept a few percent of extra distance in return for an answer in milliseconds.

## Check yourself
Q: The path-blocked check looks 6 m ahead along the path. At the cruise speed of 0.8 m/s, how many seconds of driving does that look-ahead cover?
Answer: 7.5
Tolerance: 0.15
Unit: s
How: $6\ \text{m} / 0.8\ \text{m/s} = 7.5$ s of warning for a wall that appears at the far end of the look-ahead
