group: plan
title: Space-time A*: planning with time as a coordinate

<p><b>Why this matters.</b> A route through a crowd needs a schedule as well as a line. A doorway can be free now and blocked in two seconds. The right plan may then be to wait, and a planner that works in space alone has no way to express waiting. Adding time to the search state is the simplest way to plan with predictions. It also forces a decision that every planner working around people has to make: how far ahead to trust a prediction, and what the plan should assume beyond that.</p>
<p><b>The idea.</b> The state is a cell and a time step. Moving to a neighbour takes the time needed to cross a cell at the reference speed. Waiting is a move that takes one time step and goes nowhere. A cell is blocked at a given time if a predicted person covers it at that time. So the obstacles are different in every time slice, and a corridor can be free at step 5 and blocked at step 8. Beyond the prediction horizon, all times are treated as one, and the search is plain A* on the static map. The result is a path with the waits built into it. The speed planner then keeps to the schedule and reacts when the prediction turns out wrong.</p>
$$\text{state } (i, j, k), \qquad k = t / \Delta t, \qquad \Delta t = \text{cell} / v_0$$
$$\text{blocked}(i, j, k)\ \text{ if }\ \|c_{ij} - p_a(k\Delta t)\| < r_a(k\Delta t) + r_{\text{robot}} + \text{margin}\ \text{ for any agent } a$$
<p>with the tracker's constant-velocity prediction</p>
$$p_a(t) = p_a + v_a t, \qquad r_a(t) = r_a + g\,t$$
<p>and the costs</p>
$$\text{move cost} = \Delta t\,(1 \text{ or } \sqrt{2}) + 0.3\,\Delta t \cdot \text{penalty}, \qquad \text{wait} = 1.2\,\Delta t, \qquad h = \text{octile distance in cells} \cdot \Delta t$$
<p><b>Where it comes from.</b> The search is A* with an extra coordinate. Its heuristic is the octile distance in units of time, which assumes free space and no waiting. The heuristic is therefore admissible, and the path is optimal in time on the discretized problem. The blocked test uses the predicted disc from the tracking lesson, grown by the robot's radius and a clearance margin. A diagonal move is checked at both the step it leaves and the step it arrives in, so it cannot pass through a person on the way. <a class="chref" href="#notes=ch4/7-space-time-a-time-as-a-coordinate">Derivation: chapter 4 §7</a></p>
<p><b>What the lab does.</b> Cells are 0.2 m. That is coarser than the spatial grid, to keep the search affordable with the extra time dimension. The time step is 0.2 m divided by the cruise speed, which is 0.25 s at 0.8 m/s. The horizon is set by the prediction horizon slider, 4 s by default. Waiting costs 1.2 times a move, so the planner waits only when it has to. The search is capped at 60 000 expansions. The ST graph in the plot area (distance along the path against time) shows the speed planner's view of the same predictions along the chosen path.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses. The chip under the map then plays the search one expansion at a time: ◀ and ▶ step, ▷ plays, and the slider scrubs. The newest node is drawn in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: Space-time A*
cfg: {"sim":true,"level":4,"set":{"plan":"stastar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L5, the busy floor, with the space-time planner and the search layer on.
See: There are seven plans, with 200 to 3 500 expansions each. That is fewer than plain A* needs on the same legs, because the cells are twice as large. Once, at 106 s, there is an agent-blocking replan, and the planner then reports "no space-time route within the horizon". The mission retries two seconds later and carries on. The robot reaches five goals in 128 s, with one contact, at 108 s, in the same encounter that filled the horizon. Plain A* with the agent layer (the next experiment) also makes one contact, but in a different encounter, at 52 s. Space-time A* passes that encounter without a contact.
Shows: The prediction covers the encounter at 52 s. Space-time A* routes around that person's predicted positions from the start, and it makes that contact on no seed. The encounter at 108 s is of the other kind. The person moves within the planner's reaction time and away from what was predicted, so the horizon fills and no route is found. No planner that works from predictions can plan around that. The number of contacts varies from run to run. On this seed each planner makes one. On seeds 2 to 5 and 8, space-time A* makes none and A* still makes its one at 52 s. On seeds 9 and 10 it is the other way round: A* makes none, and space-time A* makes one or two later in the run. One run cannot tell you which planner touches fewer people. Space-time A* changes the route where the route is the problem, in doorways and narrow aisles with a person coming the other way. Elsewhere the speed planner was already resolving most encounters by slowing down. When the planner reports no route within the horizon, the report is correct: the horizon was full.
Predict: Around 52 s the robot meets a person whose walk the prediction covers; plain A*, which leaves the people to the speed planner, touches them there. What does space-time A* do in that encounter?
- It routes around the person's predicted positions, and that contact does not happen
- It meets the same person: both planners work from the same prediction
- It touches the person earlier: the schedule is stale by the time the robot arrives
Answer: 0

## Try: A* with the agent layer
cfg: {"sim":true,"level":4,"set":{"plan":"astar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: Plain A* on the same floor. People enter the costmap only when the speed planner escalates.
See: There are five plans, of 1 400 to 5 900 expansions, and two agent-blocking replans. The robot reaches five goals in 121 s, with one contact, at 52 s. The route is planned in space only. The speed planner handles every encounter until it gives up and asks for a replan.
Shows: The mission is faster, and on this seed there are as many contacts. Compare every new planner with the simpler one in this way. A more complex planner is worth it only where the simpler one fails. Here the simpler one fails at 52 s, on six of the ten seeds 1 to 10. Space-time A* avoids that contact but costs mission time: A* finishes 5 s or more sooner on every seed tried. On this floor, with wide aisles and few people, the gain is small for what it costs. With narrower aisles or more people the ranking changes. The lab cannot set that up yet, which is a known limit.
Predict: Plain A* on the same floor, with people entering the costmap only on escalation: how does the mission time compare with space-time A*?
- Shorter
- About the same
- Longer: it has to stop and replan at every person
Answer: 0

## Try: Space-time A*, reactive people
cfg: {"sim":true,"level":4,"set":{"plan":"stastar","people":"reactive"},"tab":"plan"}
Setup: The space-time planner, with people who step aside for the robot.
See: There are no contacts, and the closest approach is 0.59 m. The robot reaches five goals in 132 s. Around 73 s the particle filter briefly loses the robot. The mission replans six times in about a second while the estimate settles, the log shows "relocalized", and the robot carries on.
Shows: This run looks best because it gets the most help. The planner has predictions it can trust, and the people make up for the remaining errors by stepping aside. The relocalization has nothing to do with the planner. The same floor and seed with scripted people has none, with either planner. The result of a run depends on everything in the stack, and the planner is only one part of it.
Predict: Space-time A* against reactive people: what will the contact count be?
- Still one: the planner, not the people, sets the floor
- Higher: the planner and the person dodge into each other
- Zero
Answer: 2

## Code: stAstar, time as a coordinate
snippet: stastar
focus: // agent discs per time slice
focus: if (di === 0 && dj === 0 && vk >= nt) continue; // waiting past the horizon is pointless
Note: The people's predicted discs are stamped into one lethal grid per time slice. The search runs over (cell, time), with waiting as a move, except past the horizon, where waiting changes nothing. The planner slot has no time dimension. A space-time planner of your own would need the predictions, and only the predictor slot sees them.

## Think about
Q: Why are the space-time cells 0.2 m when the spatial grid is 0.1 m?
A: A time axis multiplies the state space by the number of time steps, 17 at the default horizon. The grid is made coarser to keep the search small enough. A grid of 0.2 m cells has a quarter as many cells, and the budget of 60 000 expansions is still enough. The cost is a coarser route, which the tracker smooths.
Q: What should the planner assume about people beyond the prediction horizon?
A: There are two simple answers. The planner can assume they are not there, which is what the lab does by treating all times after the horizon as one. Or it can assume they are everywhere they could reach, which would block most of the map. Neither is right. A better model is an uncertainty that grows with time, which the planner treats as a soft cost. The speed planner's growing radius approximates this, and the space-time search does not.
Q: Waiting costs 1.2 times a move. What happens at 1.0 and at 3.0?
A: At 1.0, waiting costs the same as moving. The planner may then wait in place even when a detour of the same length would have made progress towards the goal, because ties are broken arbitrarily. At 3.0, the planner detours around people it could have waited for, and takes longer routes to avoid a one-second pause. The factor sets how much the mission prefers making progress to waiting.

## Check yourself
Q: $\Delta t = 0.25$ s. What does a diagonal move into a cell with inflation penalty 0.5 cost, using $\text{move cost} = \Delta t\sqrt{2} + 0.3\,\Delta t \cdot \text{penalty}$?
Answer: 0.391
Tolerance: 0.01
Unit: s
How: $0.25 \times 1.414 + 0.3 \times 0.25 \times 0.5 = 0.354 + 0.0375 = 0.39$ s, against $1.2 \times 0.25 = 0.30$ s for a wait
