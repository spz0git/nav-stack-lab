group: ctl
title: Gain scheduling breaks above v_ch
extra: true

<p><b>Why this matters.</b> The gain-scheduling lesson (<a class="lsref" href="#lesson=ctl:10">Speed changes the plant</a>) showed pure pursuit's lookahead schedule keeping the loop the same at every speed. That works because the kinematic plant gain is <i>v</i>/<i>L</i>, known exactly. With tyres the plant gain is <i>v</i>/(<i>L</i> + <i>K</i><sub>us</sub><i>v</i>²): it rises, peaks at the characteristic speed, and falls, and the car's own yaw mode adds a lag that the kinematic model does not have. A schedule designed for the kinematic plant mis-schedules above <i>v</i><sub>ch</sub>, and a tracker tuned on it can lose its margin entirely.</p>
<p><b>The idea.</b> Two things change with the tyres. The plant gain falls below <i>v</i>/<i>L</i> by the factor <i>L</i>/(<i>L</i> + <i>K</i><sub>us</sub><i>v</i>²), which lowers the crossover; and the yaw mode, two poles of the car's own, costs phase near the crossover, more so as it slows and loses damping with speed. Pure pursuit's damping, ζ ≈ 0.71 at every speed on the kinematic car, is no longer fixed. A tracker with a high crossover, like rear-wheel feedback with its default gains, can have its phase margin eaten whole.</p>
<div class="eq">kinematic:  θ̇ₑ = (v/L)·δ                 with tyres:  r/δ = G_r(s),   G_r(0) = v/(L + K_us·v²)
yaw mode on the slippery floor:  1 m/s: −9.2, −17.9 1/s     2 m/s: ω_n 7.5 rad/s, ζ 0.90     4 m/s: ω_n 5.5, ζ 0.62
G_r(0) ÷ (v/L):  0.87 at 1 m/s,  0.63 at 2,  0.43 at 3,  0.30 at 4</div>
<p><b>Where it comes from.</b> The steady gain is chapter 1 §5's formula; the yaw mode is the eigenvalues of the 2 × 2 model of §4, overdamped at low speed and underdamped above about 1.5 m/s on this floor. The Analyze view puts that model between the steering and the heading: θ̇ₑ = <i>r</i>, and the lateral error grows at <i>v</i>θₑ plus the rear axle's sideways slide. <a class="chref" href="#notes=ch1/5-understeer-the-characteristic-speed-and-stability">Chapter 1 §5</a> · what the extra poles do to a loop: <a class="chref" href="#notes=ch6/3-the-open-loop-l-s-with-the-clock-in-it">chapter 6 §3</a></p>
<p><b>What the lab does.</b> These buttons open Analyze on L1 with the car. With the car with tyre slip selected, the analysis uses the linear tyre model at the operating speed: the vehicle paragraph gives the yaw gain against <i>v</i>/<i>L</i>, the transfer function shows <i>G</i><sub>r</sub>(<i>s</i>), and the step test runs the full nonlinear car. The schedule is pure pursuit's own, <i>L</i><sub>d</sub> = 0.5 + 0.5·<i>v</i>.</p>

## Try: Kinematic car, scheduled PP, 4 m/s
cfg: {"level":0,"set":{"veh":"car","ctl":"pp","ppL0":0.5,"ppK":0.5,"vmax":4,"vcruise":4}}
Setup: The kinematic car at 4 m/s with pure pursuit and its speed schedule (L_d = 2.5 m).
See: Crossover 3.52 rad/s, phase margin 60.5°, ζ 0.71, overshoot 4.3 %. At 1 m/s the same schedule gives 2.20 rad/s, 62.4° and the same 4.3 %.
Shows: On the kinematic plant the schedule works: four times the speed, the same loop.
Predict: Scheduled pure pursuit on the kinematic car at 4 m/s versus 1 m/s: what changes?
- Crossover rises fourfold with the speed
- Roughly the same loop: ζ 0.71, about 60° of margin
- Damping falls as the lookahead grows
Answer: 1

## Try: Slippery floor, scheduled PP, 1 m/s
cfg: {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"pp","ppL0":0.5,"ppK":0.5,"vmax":4,"vcruise":1}}
Setup: The car with tyre slip on the slippery floor at 1 m/s, below v_ch.
See: The yaw gain is 87 % of v/L; crossover 1.86 rad/s, phase margin 46°, ζ 0.59, overshoot 9.9 %. The open-loop poles of the yaw mode sit at −9.2 and −17.9 1/s.
Shows: Even below the characteristic speed the tyres cost 16° of phase margin: the yaw mode is only a decade above the crossover.
Predict: The slippery car at 1 m/s, below v_ch: will the tyres cost margin?
- No: below v_ch the car is kinematic
- Yes, the loop goes unstable even here
- About 15° of phase margin, the yaw mode only a decade above crossover
Answer: 2

## Try: Slippery floor, scheduled PP, 4 m/s
cfg: {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"pp","ppL0":0.5,"ppK":0.5,"vmax":4,"vcruise":4}}
Setup: The same schedule at 4 m/s, above v_ch = 2.62 m/s.
See: The yaw gain is 30 % of v/L; crossover 1.33 rad/s, lower than at 1 m/s; phase margin 27°, M_s 2.1, ζ 0.25, overshoot 46 %, settling 11.6 s.
Shows: The schedule assumed a plant gain rising with v and got one falling, plus a yaw mode at 5.5 rad/s with ζ 0.62 right above the crossover. The loop is slower and much less damped: the opposite of what the schedule was for.
Predict: The same schedule at 4 m/s, above v_ch: what happens to crossover and damping?
- Crossover rises and ζ holds 0.71
- Crossover rises but ζ falls below 0.5
- Crossover falls below its 1 m/s value and ζ drops to about 0.25
Answer: 2

## Try: Rear-wheel feedback at 2 m/s
cfg: {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"rwf","vmax":4,"vcruise":2},"test":"step","stepKind":"offset","stepAmp":0.05}
Setup: Rear-wheel feedback with its default gains (k_e 6, k_θ 3) on the slippery car at 2 m/s, and a 5 cm step test in the simulator.
See: Phase margin 0.3°, M_s 102, ζ 0.003: on the edge of instability. The step overshoots 87 % predicted and 85 % measured and rings for 16 s. The kinematic car with the same gains at the same speed has 50° and 9.9 %.
Shows: Rear-wheel feedback's high crossover (6.9 rad/s on the kinematic car) puts it right on the yaw mode, whose lag takes the whole margin. A controller tuned on the kinematic model is not slightly worse on the real car; it can be unusable.
Predict: Rear-wheel feedback with its default gains on the slippery car at 2 m/s: how much margin is left?
- Roughly the kinematic 50°
- About 25°: underdamped but usable
- Almost none: on the edge of instability
Answer: 2

## Try: Re-tuned for the tyres: k_e 1.5, k_θ 2.5
cfg: {"level":0,"set":{"veh":"dyn","mass":10,"Iz":0.9,"lf":0.27,"Cf":40,"Cr":90,"mu":0.25,"ctl":"rwf","rwKe":1.5,"rwKth":2.5,"vmax":4,"vcruise":2},"test":"step","stepKind":"offset","stepAmp":0.05}
Setup: The same car and speed with a softer lateral gain and more heading damping, found by dragging the dominant pole in the pole plot.
See: Phase margin 40°, crossover 2.9 rad/s, ζ 0.65; the step overshoots 5.7 % predicted and 5.6 % measured and settles in 2.6 s.
Shows: The fix is a lower crossover, below the yaw mode, and more damping, designed on the model with the tyres in it. That is gain scheduling done properly: gains tabulated against speed, each checked on the dynamic model at that speed.
Predict: Softer k_e = 1.5 and k_θ = 2.5 on the same car: what will the step show?
- A few per cent overshoot, settling in a few seconds
- Still ringing: lower gains cannot fix a plant problem
- Overdamped and very slow, tens of seconds
Answer: 0

## Code: dynLin, the car linearized
snippet: dyn-lin
focus: A: [ … B: [
Note: The 2×2 state matrix of the lateral dynamics at speed v, in v_y and r; its eigenvalues are the tyre poles the lesson tracks with speed, and the characteristic speed is where the understeer gradient makes the steady-state gain peak.

## Think about
Q: Why does the crossover fall with speed above v_ch, when on the kinematic car it rises?
A: Pure pursuit's gains fall as 1/v (K_e = 2v/L_d², with L_d growing as v), and on the kinematic car the plant gain v/L rises as v, so the loop gain levels off. With tyres the plant gain v/(L + K_us v²) falls as 1/v above v_ch, so the product falls as 1/v² and the crossover with it.
Q: How would you schedule rear-wheel feedback for this car?
A: Pick the closed-loop poles you want at each speed, below the yaw mode, and compute the gains that place them on the dynamic model at that speed (the Analyze what-if does exactly this when you drag a pole). Tabulate them against speed and check each breakpoint for margin. Dividing by v and v² as on the kinematic car keeps the poles where they were, which is now too close to the yaw mode.
Q: Would MPC fix this?
A: Not with its default prediction model, the kinematic car: it schedules itself on the wrong plant just as pure pursuit does. With Control → Tyre model in the prediction ticked, the MPC predicts with the dynamic bicycle model, and its gains, now also on v_y and r, come from the plant it is really driving: on the moose test at 3.5 m/s the dominant poles go from ζ 0.22 to 0.70 (<a class="lsref" href="#lesson=ctl:17">The moose test: an MPC that knows the tyres</a>). That is what vehicle-dynamics MPC in production cars does.

## Check yourself
Q: A car with L = 2.7 m and K_us = 0.00375 rad/(m/s²) at v = 30 m/s: what is its steady yaw gain G_r(0) = v/(L + K_us·v²) as a fraction of the kinematic v/L?
Answer: 0.444
Tolerance: 0.01
Unit: 
How: L/(L + K_us v²) = 2.7/(2.7 + 0.00375 × 900) = 2.7/6.075 = 0.444.
