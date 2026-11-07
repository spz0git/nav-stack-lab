group: intro
title: Why controllers wobble: delay
level: 1

<p><b>Why this matters.</b> Every real robot acts a little late. The camera needs time to expose, the computer to process, the message to travel, the motor to respond. A controller that works perfectly in a simulation without delays can shake itself off the path on the real robot. Delay is the most common reason a well-tuned robot starts to wobble, and the cure is usually to make the controller gentler, not smarter.</p>
<p><b>The idea.</b> Picture steering a car while seeing the road 0.2 s late. You notice you are left of the lane and steer right. By the time the correction shows, you have already crossed the centre, but your eyes still report “left”, so you steer right some more. Now you are well right, you notice it late, and steer left too hard. The corrections arrive out of step with the errors, and the car swings back and forth: an oscillation. A gentle controller makes small, slow corrections, so a little lateness hardly matters. A stiff controller makes big, fast ones, and the same lateness puts it out of step. The short lookahead of the last lesson is exactly such a stiff controller.</p>
<p><b>What the lab does.</b> L1 with pure pursuit and the lookahead gain <i>k</i> at 0, as in the last lesson. The Control latency slider in the Vehicle tab delays every command by whole ticks of 50 ms; both experiments set it to 0.2 s, four ticks. The Steering plot in Telemetry shows the turn rate the robot actually drives; the robot's limit is 1.8 rad/s each way.</p>
<p>You do not have to find the limit by trial. The loop analysis (Control tab → Analyze this loop, or the Analyze switch at the top) models the tracking loop and reports its <i>delay margin</i>: how much extra delay it can take before it starts to oscillate. For a 0.2 m lookahead it is 0.105 s; for a 1 m lookahead, 0.63 s. The control group of lessons is built on that analysis.</p>
<p><b>Where it comes from.</b> The analysis measures how far the loop is from oscillating as an angle, the phase margin PM, at the frequency $\omega_c$ where it responds most (the crossover). A delay $\Delta T$ shifts that angle by $\omega_c \Delta T$, so the loop can absorb</p>
$$\text{DM} = \frac{\text{PM}}{\omega_c}$$
<p>A short lookahead raises $\omega_c$ (8.8 rad/s at 0.2 m, 1.8 rad/s at 1 m), so it leaves less room for delay. Go deeper: <a class="lsref" href="#lesson=ctl:5">Delay margin: the latency budget</a> · <a class="chref" href="#notes=ch6/4-reading-the-margins">reading the margins: chapter 6 §4</a></p>

## Try: Short lookahead, 0.2 s of delay
cfg: {"sim":true,"level":0,"set":{"ppL0":0.2,"ppK":0,"latency":0.2},"tab":"veh","plot":"turn"}
Setup: L1, pure pursuit with a 0.2 m lookahead, and 0.2 s of control latency (Vehicle tab). The Steering plot opens.
See: Within seconds the steering swings from one limit to the other, +1.8 to −1.8 rad/s, again and again, and the trail on the map becomes a zigzag. The robot still makes progress, slowly: it reaches goal 1 at 27 s instead of 16 s, and the mission completes at 98.8 s instead of 58.2 s without delay.
Shows: The delay is twice this loop's margin of 0.105 s, and the loop oscillates. The turn-rate limit keeps the swing from growing further, so the robot weaves instead of spinning out. Nothing is broken and no sensor is wrong: the controller is simply too fast for the delay. L1 has no randomness that changes this, so every seed gives the same run.
Predict: With 0.2 s of delay and the short lookahead, what does the Steering plot do?
- It stays smooth, as without delay
- It swings back and forth between the limits, again and again
- It drops to zero and the robot stops
Answer: 1

## Try: Long lookahead, same delay
cfg: {"sim":true,"level":0,"set":{"ppL0":1,"ppK":0,"latency":0.2},"tab":"veh","plot":"turn"}
Setup: The same 0.2 s of latency with a 1 m lookahead.
See: The steering is smooth: one turn at each corner, and between corners it stays near zero, never above 1.3 rad/s. The mission completes at 58.6 s, against 57.9 s for the same lookahead with no delay. The Cross-track RMS is 0.122 m, larger than the short lookahead's 0.018 m without delay, because the corners are rounder.
Shows: The gentler controller has a margin of 0.63 s and absorbs 0.2 s easily. Delay tolerance and tightness trade against each other. The usual engineering order is: measure the robot's delay, then choose the stiffest controller whose margin still covers it.
Predict: The delay stays at 0.2 s and the lookahead goes up to 1 m. What happens?
- The weave gets worse, since the robot is still late
- The steering is smooth again; the corners are rounder
- The robot cannot reach the goals any more
Answer: 1

## Think about
Q: A camera upgrade adds 0.1 s of processing delay to a robot that was tuned with a very short lookahead. What would you check first?
A: Its delay margin. If the old margin was less than the old delay plus 0.1 s, the robot will start to wobble. The cure is to lengthen the lookahead (or otherwise slow the loop) until the margin covers the new delay with some room to spare, and to accept slightly rounder corners.

## Check yourself
Q: In the first experiment, at what time does the event log report Mission complete?
Answer: 98.8
Tolerance: 2
Unit: s
How: 98.8 s, against 58.2 s for the same lookahead without delay: the weaving costs 40 s on a 45 m mission.
