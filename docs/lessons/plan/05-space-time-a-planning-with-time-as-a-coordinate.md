group: plan
title: Space-time A*: planning with time as a coordinate

<p><b>Why this matters.</b> A route through a crowd is not a line, it is a line with a schedule. The same doorway is free now and blocked in two seconds; the right plan may be to wait, which a spatial planner cannot even express. Adding time to the search state is the simplest way to plan with predictions, and it exposes the question that every planner around people has to answer: how far ahead can a prediction be trusted, and what should the plan assume beyond that?</p>
<p><b>The idea.</b> The state is a cell and a time step. Moving to a neighbour takes the time to cross a cell at the reference speed; waiting is a move that takes one step and goes nowhere. A cell is blocked at a time when a predicted person covers it then, so the obstacles are different in every time slice and a corridor can be free at step 5 and blocked at step 8. Beyond the prediction horizon all times collapse into one and the search is plain A* on the static map. The result is a path with waits folded in; the speed planner keeps the schedule and reacts to prediction error.</p>
$$\text{state } (i, j, k), \qquad k = t / \Delta t, \qquad \Delta t = \text{cell} / v_0$$
$$\text{blocked}(i, j, k)\ \text{ if }\ \|c_{ij} - p_a(k\Delta t)\| < r_a(k\Delta t) + r_{\text{robot}} + \text{margin}\ \text{ for any agent } a$$
<p>with the tracker's constant-velocity prediction</p>
$$p_a(t) = p_a + v_a t, \qquad r_a(t) = r_a + g\,t$$
<p>and the costs</p>
$$\text{move cost} = \Delta t\,(1 \text{ or } \sqrt{2}) + 0.3\,\Delta t \cdot \text{penalty}, \qquad \text{wait} = 1.2\,\Delta t, \qquad h = \text{octile distance in cells} \cdot \Delta t$$
<p><b>Where it comes from.</b> The search is A* with an extra coordinate; its heuristic, the octile distance in time units, assumes free space and no waiting, so it is admissible and the path is optimal in time on the discretized problem. The blocked test is the predicted disc of the tracking lesson, grown by the robot's radius and a clearance margin; diagonal moves are checked at their midpoint step as well, so a two-step move cannot pass through a person. <a class="chref" href="#notes=ch4/6-space-time-a-time-as-a-coordinate">Derivation: chapter 4 §6</a></p>
<p><b>What the lab does.</b> Cells are 0.2 m (coarser than the spatial grid, to pay for the time dimension), the time step is 0.2 m divided by the cruise speed, 0.25 s at 0.8 m/s, and the horizon is the prediction horizon slider, 4 s by default. Waiting costs 1.2 times a move so the planner waits only when it must. The search is capped at 60 000 expansions. The ST graph in the plot area shows the speed planner's view of the same predictions along the chosen path.</p>
<p><b>Step through it.</b> Each Try below loads the level, plans, and pauses: the chip under the map plays the search one expansion at a time (◀ ▶ step, ▷ plays, the slider scrubs), with the newest node in red and its way back to the start in blue. Press <b>Run</b> (or Done) to drive.</p>

## Try: Space-time A*
cfg: {"sim":true,"level":4,"set":{"plan":"stastar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: L5, the busy floor, with the space-time planner and the search layer on.
See: Seven plans with 200 to 3 500 expansions each, fewer than plain A* on the same legs because the cells are twice as large. Once, at 106 s, the planner escalates with an agent-blocking replan and then reports "no space-time route within the horizon"; the mission retries two seconds later and continues. Five goals in 128 s with one contact, at 108 s, in the same encounter that filled the horizon. Plain A* with the agent layer (the next experiment) makes one contact too, but in a different encounter, at 52 s, which space-time A* passes without one.
Shows: The encounter at 52 s is one the prediction covers: space-time A* routes around that person's predicted positions from the start, and on no seed does it make that contact. The one at 108 s is the other kind: a person who moves inside the planner's reaction time and away from what was predicted, so that the horizon fills and no route is found, and no planner that works from predictions can plan around that. How many contacts a run ends with varies from run to run: on this seed it is one for each planner; on seeds 2 to 5 and 8 space-time A* makes none and A* still makes its one at 52 s; on seeds 9 and 10 it is the other way round, A* none and space-time A* one or two later in the run. Which planner touches fewer people over a run is not something one run can tell. Space-time A* changes the route where the route is the problem, in doorways and narrow aisles with a person coming the other way; elsewhere the speed planner was already resolving most encounters by slowing. The failure to find a route within the horizon is honest: the horizon was full.
Predict: Around 52 s the robot meets a person whose walk the prediction covers; plain A*, which leaves the people to the speed planner, touches them there. What does space-time A* do in that encounter?
- It routes around the person's predicted positions, and that contact does not happen
- It meets the same person: both planners work from the same prediction
- It touches the person earlier: the schedule is stale by the time the robot arrives
Answer: 0

## Try: A* with the agent layer
cfg: {"sim":true,"level":4,"set":{"plan":"astar"},"tab":"plan","layers":{"search":true},"searchStep":true}
Setup: Plain A* on the same floor; people enter the costmap only when the speed planner escalates.
See: Five plans of 1 400 to 5 900 expansions, two agent-blocking replans, five goals in 121 s with one contact, at 52 s. The route is spatial only; every encounter is handled by the speed planner until it gives up and asks for a replan.
Shows: Faster mission, and on this seed as many contacts: the comparison that keeps a new planner honest. A richer planner is worth its complexity only where the simpler one fails. Here the simpler one fails at 52 s, on six of the ten seeds 1 to 10, and space-time A* buys that encounter with mission time: A* finishes 5 s or more sooner on every seed tried. On this floor, with wide aisles and few people, that is a small gain for the price. Narrow the aisles or add people and the ranking changes; the lab cannot do that yet, which is a known limit.
Predict: Plain A* on the same floor, with people entering the costmap only on escalation: how does the mission time compare with space-time A*?
- Shorter
- About the same
- Longer: it has to stop and replan at every person
Answer: 0

## Try: Space-time A*, reactive people
cfg: {"sim":true,"level":4,"set":{"plan":"stastar","people":"reactive"},"tab":"plan"}
Setup: The space-time planner against people who step aside.
See: No contacts, closest approach 0.59 m, five goals in 132 s. Around 73 s the particle filter briefly loses the robot and the mission replans six times in about a second as the estimate settles ("relocalized"), then carries on.
Shows: The combination that looks best is the one with the most help: predictions the planner can trust plus people who absorb the error. The relocalization episode is unrelated to the planner: the same floor and seed with scripted people has none, with either planner; a run is a sum of everything in the stack, and the planner is one term.
Predict: Space-time A* against reactive people: what will the contact count be?
- Still one: the planner, not the people, sets the floor
- Higher: the planner and the person dodge into each other
- Zero
Answer: 2

## Code: stAstar, time as a coordinate
snippet: stastar
focus: // agent discs per time slice
focus: if (di === 0 && dj === 0 && vk >= nt) continue; // waiting past the horizon is pointless
Note: The people's predicted discs are stamped into one lethal grid per time slice, and the search runs over (cell, time) with waiting as a move, except past the horizon, where waiting changes nothing. The planner slot gets no time dimension; a space-time planner of your own would need the predictions, which only the predictor slot sees.

## Think about
Q: Why are the space-time cells 0.2 m when the spatial grid is 0.1 m?
A: Adding a time axis multiplies the state space by the number of time steps (17 at the default horizon), so the grid is coarsened to keep the search tractable: 0.2 m cells have a quarter of the cells, and the budget of 60 000 expansions stays enough. The price is a coarser route that the tracker smooths.
Q: What should the planner assume about people beyond the prediction horizon?
A: That they are not there, which is what the lab does by collapsing time after the horizon, or that they are everywhere they could reach, which would block most of the map. Neither is right; the honest answer is a growing uncertainty the planner treats as a soft cost, which is what the speed planner's growing radius approximates and the space-time search does not.
Q: Waiting costs 1.2 times a move. What happens at 1.0 and at 3.0?
A: At 1.0 waiting and moving are equal, and the planner may wait in place even when a detour of the same length would have made progress toward the goal; ties resolve arbitrarily. At 3.0 the planner detours around people it could have waited for, taking longer routes to avoid a one-second pause. The factor encodes how much the mission values progress over patience.

## Check yourself
Q: $\Delta t = 0.25$ s. What does a diagonal move into a cell with inflation penalty 0.5 cost, using $\text{move cost} = \Delta t\sqrt{2} + 0.3\,\Delta t \cdot \text{penalty}$?
Answer: 0.391
Tolerance: 0.01
Unit: s
How: $0.25 \times 1.414 + 0.3 \times 0.25 \times 0.5 = 0.354 + 0.0375 = 0.39$ s, against $1.2 \times 0.25 = 0.30$ s for a wait
