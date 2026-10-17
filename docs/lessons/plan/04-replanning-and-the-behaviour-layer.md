group: plan
title: Replanning and the behaviour layer

<p><b>Why this matters.</b> A plan is a promise built on assumptions: the map is right, the estimate is right, the people will be where they were predicted, the robot will make progress. Every one of those breaks, routinely. The behaviour layer is the small piece of logic that notices and decides what to do: plan again, wait, give up on this goal. It is tiny compared with the planners it supervises and it determines most of what a user sees the robot do. The Mission tab draws it live because it is the part of the stack most worth watching.</p>
<p><b>The idea.</b> Plans are cheap, milliseconds on this grid, so the policy is to replan whenever an assumption behind the current plan breaks rather than to make the plan robust to everything. The machine has a handful of states, PLAN, DRIVE, NO_PATH, LOST and DONE, and a set of triggers that move between them: a lethal cell on the path ahead, the estimate too far from the path, no progress in five seconds, a timer, a report from the speed planner that a person cannot be got past by slowing. Each trigger carries a reason, which the event log prints, so the log is a trace of which assumptions broke and when.</p>
<div class="eq">DRIVE → PLAN on: path blocked · off path · stuck · periodic · agent blocking
PLAN → NO_PATH → (2 s) PLAN, skip after 3</div>
<p><b>Where it comes from.</b> There is nothing to derive; it is a design, and the design choices are the thresholds: a 6 m look-ahead on the path checked every 0.5 s, 1 m off the path, 0.15 m of progress in 5 s, three failures. The one trigger with a mechanism behind it is "agent blocking": for that single plan, the people's predicted discs over the next 2 s are stamped into the costmap as lethal, so the new route avoids where they will be, and the costmap is rebuilt clean afterwards. <a class="chref" href="#notes=ch4/5-the-mission-layer">The machine, the thresholds and goal ordering: chapter 4 §5</a></p>
<p><b>What the lab does.</b> The Mission tab draws the state machine with the current state lit and the last transition highlighted; the event log carries each transition's reason. Goal ordering (in order, greedy, optimal) is decided once at mission start from costmap distances. The periodic replan slider adds a timer trigger; its replans are not logged, to keep the log readable, and they pre-empt the other triggers. A reached goal gets a tick on the map; a skipped one stays greyed without it, and its hover card says skipped.</p>

## Try: Discover the building
cfg: {"sim":true,"level":3,"tab":"mis"}
Setup: L4, the unknown building, mapping as it drives, no periodic replan. Mission tab.
See: Three "Replan (path blocked)" events at 4.3, 13.2 and 31.2 s, each a wall that appeared across the planned route as the lidar reached it, and four fresh plans at the goals. Every replan is from sixty to a few thousand expansions and under 10 ms. All four goals in 67 s.
Shows: Optimistic planning plus cheap replanning is a complete strategy for an unknown map: plan through the unknown as if it were free, and correct the moment the map disagrees. Watch the state machine flicker DRIVE → PLAN → DRIVE at each wall; the robot barely slows, because the plan is back before the next tick.
Predict: Driving into the unknown building with optimistic planning, how many "path blocked" replans will the log show?
- None: the planner only plans through seen space
- A few, one per wall discovered across the route
- Dozens: every new scan changes the costmap
Answer: 1

## Try: Periodic replan every 1 s
cfg: {"sim":true,"level":3,"set":{"replan":1},"tab":"mis"}
Setup: The same level with a 1 s periodic replan.
See: The log shows no "path blocked" replans at all, because the periodic plan, which is silent, always arrives first; about seventy plans run during the mission. The route is the same and the mission takes 70 s instead of 67: the plan is rebuilt from the current estimate every second, and each rebuild restarts the path slightly differently under the tracker.
Shows: Replanning on a timer is the simple way to keep a plan fresh and it is almost free here, about 5 % of the mission time. On a real vehicle the cost is different: each new plan can differ from the last by a lane's width, and a tracker following a path that keeps moving oscillates. Event-triggered replanning changes the plan only when something changed; periodic replanning changes it whether or not anything did.
Predict: Add a 1 s periodic replan. What happens to the "path blocked" replans in the log?
- They disappear: the silent timer plan always arrives first
- They double: each wall is caught by both triggers
- Unchanged: the timer only adds plans between them
Answer: 0

## Try: Agent-blocking replans
cfg: {"sim":true,"level":4,"tab":"mis"}
Setup: L5, the busy floor, with the speed planner reporting people it cannot get past. Mission tab.
See: The speed planner yields four times over the run, and twice, at 51 s and 99 s, it escalates: "Replan (agent blocking)", and the new path, 13.6 m and 16.7 m, goes around the person's predicted positions instead of waiting behind them. Five goals in 121 s with one contact, at 52 s, half a second after the first new path.
Shows: The layered design: the trajectory layer (speed) handles most people by slowing, and only when slowing cannot resolve the conflict does the route change. Each escalation costs a full replan with the people stamped into the costmap for 2 s of prediction, cheap here, and the result is a route that is right if the prediction was. The contact shows the limit: a new route is only as good as the prediction stamped into it, and a person who does not do what was predicted is in the costmap where they were going to be, not where they are: this one had been tracked for seconds and still made contact.
Predict: On the busy floor, how often will the speed planner escalate from slowing to an "agent blocking" replan?
- At every encounter with a person
- Never: slowing always resolves a conflict in a wide aisle
- A couple of times in the whole run
Answer: 2

## Code: missionTick, the replan triggers
snippet: mission-tick
focus: F.pendingReason = 'off path';
focus: F.pendingReason = 'path blocked';
focus: F.pendingReason = 'stuck';
Note: The three marked lines are three of the triggers of the lesson; each sets a reason and sends the machine to PLAN, and the event log prints the reason. The thresholds (1 m off the path, 6 m look-ahead, 0.15 m in 5 s) are a few lines above each. The behaviour layer has no code slot; your planner is what it calls.

## Think about
Q: Why skip a goal after three failures instead of trying forever?
A: A goal that cannot be reached, because it is walled off, in unknown space treated as lethal, or occupied by someone who will not move, would otherwise stall the whole mission. Three attempts over about 6 s is enough to tell a transient blockage from a permanent one on this floor; the right number depends on how often the world changes.
Q: The "off path" trigger fires when the estimate is 1 m from the path. What happens if the estimate is wrong?
A: The robot replans from a pose it is not at, drives the new path from where it actually is, and fires the trigger again, which is what the kidnapped-EKF run in the localization lessons shows: a loop of off-path replans around a phantom pose. The behaviour layer can only act on the estimate; recovering the estimate is the estimator's job, and the lost guard is the hook that lets it ask for time.
Q: Optimal goal ordering is solved exactly here. Why can that not scale?
A: It enumerates orders: 8 goals is 40 320, 15 goals is over a trillion. Branch-and-bound prunes most of them but not enough. Real fleets use heuristics (nearest neighbour, 2-opt improvements) and accept a few percent of extra distance for an answer in milliseconds.

## Check yourself
Q: The path-blocked check looks 6 m ahead along the path. At the cruise speed of 0.8 m/s, how many seconds of driving does that look-ahead cover?
Answer: 7.5
Tolerance: 0.15
Unit: s
How: 6 m / 0.8 m/s = 7.5 s of warning for a wall that appears at the far end of the look-ahead
