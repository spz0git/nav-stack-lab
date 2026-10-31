group: ctl
title: Speed changes the plant: gain scheduling

<p><b>Why this matters.</b> To the controller, a vehicle at each speed is a different plant. The same steering angle turns the car twice as fast at twice the speed, and the same heading error grows the lateral error twice as fast. A controller tuned at 10 m/s gives a different loop at 30 m/s, with a different crossover and different margins. The usual answer is gain scheduling, which changes the controller's gains with speed so that the loop stays the same. Pure pursuit has a version of it built in.</p>
<p><b>The idea.</b> The plant gain is $v_0$ for the diff-drive and $v_0^2/L$ for the car. Both the turn rate ($v\tan\delta/L$) and the lateral rate ($v\theta_e$) scale with speed. With fixed gains the loop's crossover therefore rises with speed, and as it rises it comes closer to the limit the delay sets. Pure pursuit schedules itself. Its lookahead $L_d = L_0 + k\,v_0$ grows with speed, so the crossover $\omega_c = 2.2\,v_0/L_d$ levels off at $2.2/k$ as speed rises. Rear-wheel feedback works in curvature, so its turn-rate gain is $v$ times its curvature gain. Its crossover grows roughly in proportion to speed unless its gains are scheduled.</p>
<p><b>Where it comes from.</b> For pure pursuit, $\omega_n = \sqrt{g K_e v_0}$ with $K_e = 2v_0/L_d^2$, which gives $\omega_n = \sqrt2\,v_0/L_d$. Put in $L_d = L_0 + k\,v_0$, and the ratio tends to $\sqrt2/k$ as $v_0$ grows. <a class="chref" href="#notes=ch6/2-pure-pursuit-is-a-pd-controller-in-disguise">Derivation: chapter 6 §2</a>. What else changes with speed in the vehicle itself is in <a class="chref" href="#notes=ch1/5-understeer-the-characteristic-speed-and-stability">chapter 1 §5</a>.</p>
<p><b>What the lab does.</b> The analysis runs at the cruise speed, capped by $v_{\max}$. Both are set in the Control tab. The buttons change the cruise speed, first with the lookahead's speed term off and then with it on. The kinematic vehicle here never loses grip, so its plant gain grows with speed without limit. Chapter 1 describes what a real vehicle does instead, and the car with tyre slip (Vehicle tab) behaves that way. The lesson <a class="lsref" href="#lesson=ctl:16">Gain scheduling breaks above v_ch</a> repeats these buttons on that car.</p>

## Try: PP, k = 0, v = 0.4
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0,"vcruise":0.4}}
Setup: Pure pursuit with a fixed 0.5 m lookahead (no speed term) at 0.4 m/s.
See: The crossover is 1.76 rad/s ($2.2 \times 0.4/0.5$), the phase margin 63° and the delay margin 0.63 s.
Shows: At low speed a fixed lookahead gives a slow, comfortable loop. The plant gain $v_0 = 0.4$ enters $K_e = 2v_0/L_d^2$ directly.
Predict: A fixed 0.5 m lookahead at 0.4 m/s: roughly what crossover?
- About 0.4 rad/s
- About 1.8 rad/s
- About 7 rad/s
Answer: 1

## Try: PP, k = 0, v = 1.6
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0,"vcruise":1.6,"vmax":1.6}}
Setup: The same fixed lookahead at four times the speed.
See: The crossover is 7.03 rad/s, four times higher. The phase margin is 55.5°, the delay margin 0.14 s and the gain margin 19.5 dB. The loop has moved most of the way to its delay limit, and no controller setting has changed.
Shows: Speed acts as a gain. With the lookahead fixed, the crossover is proportional to $v_0$ and the delay budget is inversely proportional to it. The loop had 0.63 s of delay budget at walking pace and has 0.14 s at running pace. On a real vehicle, this is how a lane-keeping loop can work well in town and still ring on the motorway.
Predict: The same fixed lookahead at four times the speed: what happens to the crossover and the delay margin?
- Crossover ×4, delay margin about ÷4
- Crossover unchanged: the lookahead sets it
- Crossover ×2, since the plant gain goes as $\sqrt v$
Answer: 0

## Try: PP, k = 0.5, v = 1.6
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0.5,"vcruise":1.6,"vmax":1.6}}
Setup: The lookahead's speed term restored: $L_d = 0.5 + 0.5 \times 1.6 = 1.3$ m at 1.6 m/s.
See: The crossover is 2.7 rad/s, the phase margin 61.7° and the delay margin 0.40 s. At four times the speed, this is nearly the low-speed loop again.
Shows: The speed term is a gain schedule. Because $L_d$ grows with $v$, the crossover $2.2\,v_0/L_d$ stays below $2.2/k = 4.4$ rad/s however fast the robot goes, and the margin stays where the tuning put it. Rear-wheel feedback and PID need the same schedule written in, with their gains divided by speed. MPC gets it from its model, which has the speed in it.
Predict: Restoring the speed term, $L_d = 0.5 + 0.5\,v$, at 1.6 m/s: where will the loop land?
- Faster still: a longer lookahead at speed adds gain
- Unchanged from the $k = 0$ run at 1.6 m/s
- Near the low-speed loop: crossover under 3 rad/s, margin above 60°
Answer: 2

## Code: anGains, the operating point
snippet: an-gains
focus: B.robot.v = v0;
focus: B.odo = {v: v0, w};
example: ctl/pp
Note: The analysis reads the gains by running the controller on a bench at the operating speed and perturbing it. The controller is linearized numerically, so a gain schedule shows up as gains that change with v0. Edit and run loads the pure-pursuit example. Make its look-ahead independent of speed, and the schedule flattens.

## Think about
Q: Why does the crossover level off at $2.2/k$ instead of rising with speed?
A: The crossover is $\omega_c = 2.2\,v_0/(L_0 + k\,v_0)$. As $v_0$ grows, the $L_0$ term becomes negligible and the ratio tends to $2.2/k$. At speed the loop's bandwidth is then a constant set by $k$ alone, so in choosing $k$ the designer chooses how fast the loop should be at speed.
Q: How would you schedule rear-wheel feedback?
A: Its loop has $\omega_n = v_0\sqrt{k_e}$ and $\zeta = k_\theta/(2\sqrt{k_e})$. Dividing $k_e$ by $v_0^2$ and $k_\theta$ by $v_0$ keeps both constant. On a production vehicle the gains are kept in a table against speed and interpolated between its breakpoints. The table is checked at every breakpoint with the same analysis as in this view.
Q: The kinematic plant gain grows with speed without limit. What stops it on a real car?
A: The tyres. Above a characteristic speed, the lateral force needed for a given curvature is more than the tyres supply in their linear range. The vehicle understeers, and the gain from steering to yaw rate falls instead of rising. The kinematic model used here holds at low lateral acceleration. Chapter 1 derives the dynamic bicycle model that takes over above it.

## Check yourself
Q: Pure pursuit with $L_d = L_0 + k\,v_0$, $L_0 = 1$ m and $k = 0.6$ s, at $v_0 = 20$ m/s: what is the crossover $\omega_c \approx 2.2\,v_0/L_d$, in rad/s?
Answer: 3.385
Tolerance: 0.07
Unit: rad/s
How: $L_d = 1 + 0.6 \times 20 = 13$ m, so $\omega_c = 2.2 \times 20/13 = 3.385$ rad/s.
