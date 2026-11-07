group: intro
title: The loop a robot runs
level: 1

<p><b>Why this matters.</b> A mobile robot does not think once and then drive. It runs the same short loop many times a second, and everything it does comes out of that loop. When a robot misbehaves, the first useful question is which step of the loop went wrong. This lab draws every step on the screen, so you can watch the loop work before you study any one step.</p>
<p><b>The idea.</b> Every 50 ms, one <i>tick</i>, the robot runs five steps. <i>Sense</i>: read the wheel encoders, the lidar and the beacons. <i>Localize</i>: work out where it is. The result is its <i>estimate</i> of its position and heading. <i>Perceive</i>: turn the readings into a map of obstacles and people. <i>Plan</i>: find a path from the estimate to the goal. <i>Control</i>: pick a speed and a turn rate that keep the robot on that path. The motors carry out that command, the robot moves a little, and the loop starts again. Each step only uses what the step before it produced. Together the steps are called the navigation stack.</p>
<p>On L1 two steps are made easy on purpose. The robot is told its true position (ground truth), and it is given the true map, so Localize and Perceive cannot make mistakes. The planner draws a straight line to each goal. That leaves Plan and Control to watch.</p>
<p><b>What the lab does.</b> L1, the open floor, is 24 × 16 m with four pillars, a box and four numbered goals. The status strip above the map shows the mission state (READY before the run, DRIVE while driving, DONE at the end), the time <i>t</i>, the goals reached, the pose (“known” on L1) and the collisions. Next to it are four health lights, one per step: Localize, Perceive, Plan and Control. Green means working, amber degraded, red failing, grey idle; click a light to see its checks. The Metrics list beside the event log shows the Last plan (which planner, how long the path is, how long it took) and the Cross-track RMS, the robot's average sideways distance from its path.</p>
<p><b>Where it comes from.</b> The tick is short compared with how fast the robot moves. At the cruise speed of 0.8 m/s, one tick moves the robot</p>
$$v\,\Delta t = 0.8\ \text{m/s} \times 0.05\ \text{s} = 0.04\ \text{m}$$
<p>so each pass of the loop sees a world that has changed by a few centimetres. Go deeper: <a class="lsref" href="#lesson=plan:4">Replanning and the behaviour layer</a> (the state machine that decides when to plan) · <a class="chref" href="#notes=ch4/5-the-mission-layer">the mission layer: chapter 4 §5</a></p>

## Try: Run L1: the whole loop
cfg: {"sim":true,"level":0,"tab":"plan","plot":"cte"}
Setup: L1 with the true pose and the true map. The Plan tab and the Cross-track plot open, and the run starts.
See: Before the robot moves, the map already shows a straight path to goal 1, and the Last plan reads “Straight · 12.8 m · 0 ms”. Then the strip changes to DRIVE and the robot follows the line. At each goal a new straight plan appears: 10.3, 7.3 and 14.8 m long. The mission completes at 57.8 s with no collisions. Localize stays grey (there is nothing to estimate) and the other three lights stay green. On the Cross-track plot the error sits near zero along each line and jumps at each corner, up to 0.41 m; the Cross-track RMS ends at 0.105 m.
Shows: Plan runs once per goal, and Control runs every tick. The planner draws the path, and the controller has to make the robot follow it. The corners are where the controller is tested: the path turns sharply, and the robot, which cannot turn on the spot at full speed, takes a moment to get back onto the new line.
Predict: You press the button. Which comes first?
- The robot starts to move, and the path is drawn behind it
- The path to goal 1 appears, and only then does the robot move
- Nothing is drawn until the robot reaches goal 1
Answer: 1

## Try: The same loop among shelves (L2)
cfg: {"sim":true,"level":1,"tab":"plan","layers":{"cost":true}}
Setup: L2, the warehouse. The pose and the map are still known, but the floor is full of shelves, and the planner is now A*, which searches a grid for the cheapest path. The cost layer shades the space next to the shelves.
See: The first path bends around the shelves and stays in the aisles. The Last plan reads “A* · 8.6 m” with 1 258 expansions, the grid cells the search looked at. The four paths are 8.6, 13.0, 12.9 and 26.1 m long, and each one takes a few milliseconds to compute. The mission completes at 78.3 s with no collisions, and the health lights stay as on L1.
Shows: The loop is the same; only the planner's job got harder. A straight line would run into a shelf, so the planner has to search. Every later lesson in this group opens up one step of this loop.
Predict: On the warehouse floor, what does the first path look like?
- A straight line to the goal, through the shelves, as on L1
- A line that bends around the shelves and keeps to the aisles
- There is no path until the robot has explored the floor
Answer: 1

## Think about
Q: The planner runs once per goal, but the controller runs every tick. Why not plan every tick too?
A: On L1 and L2 nothing changes while the robot drives, so a new plan would be the same as the old one. Planning also costs more than control: A* looked at thousands of cells for one path. Real stacks plan again when something changes (a new obstacle, a person, the robot drifting off its path), and the lesson on replanning shows when.

## Check yourself
Q: Open the lesson again and press the first experiment. Before the robot has moved, how long is the first path, according to Last plan in the Metrics list?
Answer: 12.8
Tolerance: 0.1
Unit: m
How: The Last plan reads “Straight · 12.8 m”. The robot starts at (2, 2) and goal 1 is at (10, 12), so the straight line is $\sqrt{8^2 + 10^2} = 12.8$ m.
