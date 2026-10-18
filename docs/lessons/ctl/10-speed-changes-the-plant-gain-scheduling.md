group: ctl
title: Speed changes the plant: gain scheduling

<p><b>Why this matters.</b> A vehicle is not one plant; it is a family of plants indexed by speed. The same steering angle turns the car twice as fast at twice the speed, and the same heading error grows the lateral error twice as fast. A controller tuned at 10 m/s is a different loop at 30 m/s, with a different crossover and different margins. Gain scheduling, changing the controller with speed so the loop stays the same, is the standard answer, and pure pursuit contains a built-in version of it.</p>
<p><b>The idea.</b> The plant gain is $v_0$ for the diff-drive and $v_0^2/L$ for the car: both the turn rate ($v\tan\delta/L$) and the lateral rate ($v\theta_e$) scale with speed. Fixed gains therefore give a loop whose crossover rises with speed, and a crossover that rises walks into the delay limit. Pure pursuit schedules itself: $L_d = L_0 + k\,v_0$ grows with speed, so $\omega_c = 2.2\,v_0/L_d$ levels off at $2.2/k$ as speed rises. Rear-wheel feedback works in curvature, so its turn-rate gain is $v$ times the curvature gain and its crossover grows roughly in proportion to speed unless the gains are scheduled.</p>
<p><b>Where it comes from.</b> With $\omega_n = \sqrt{g K_e v_0}$ and $K_e = 2v_0/L_d^2$ for pure pursuit, $\omega_n = \sqrt2\,v_0/L_d$; put $L_d = L_0 + k\,v_0$ and the ratio tends to $\sqrt2/k$ as $v_0$ grows. <a class="chref" href="#notes=ch6/2-pure-pursuit-is-a-pd-controller-in-disguise">Derivation: chapter 6 §2</a> · what else changes with speed in the vehicle itself: <a class="chref" href="#notes=ch1/5-understeer-the-characteristic-speed-and-stability">chapter 1 §5</a></p>
<p><b>What the lab does.</b> The operating speed of the analysis is the cruise speed (capped by $v_{\max}$), both in the Control tab. The buttons change the cruise speed with the lookahead's speed term off and on. The kinematic vehicle here never loses grip, so the plant gain keeps growing with speed without limit; chapter 1 describes what a real vehicle does instead, and the car with tyre slip (Vehicle tab) does it: <a class="lsref" href="#lesson=ctl:16">Gain scheduling breaks above v_ch</a> repeats these buttons on it.</p>

## Try: PP, k = 0, v = 0.4
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0,"vcruise":0.4}}
Setup: Pure pursuit with a fixed 0.5 m lookahead (no speed term) at 0.4 m/s.
See: Crossover 1.76 rad/s ($2.2 \times 0.4/0.5$), phase margin 63°, delay margin 0.63 s.
Shows: At low speed a fixed lookahead gives a slow, comfortable loop. Note the plant gain: $v_0 = 0.4$ enters $K_e = 2v_0/L_d^2$ directly.
Predict: A fixed 0.5 m lookahead at 0.4 m/s: roughly what crossover?
- About 0.4 rad/s
- About 1.8 rad/s
- About 7 rad/s
Answer: 1

## Try: PP, k = 0, v = 1.6
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0,"vcruise":1.6,"vmax":1.6}}
Setup: The same fixed lookahead at four times the speed.
See: Crossover 7.03 rad/s, four times higher, phase margin 55.5°, delay margin 0.14 s, gain margin 19.5 dB. The loop has moved most of the way to its delay limit without a single controller setting changing.
Shows: Speed is a gain. With the lookahead fixed, the crossover is proportional to $v_0$, the delay budget inversely, and a loop that had 0.63 s of budget at walking pace has 0.14 s at running pace. On a real vehicle this is the difference between a lane-keeping loop that is fine in town and one that rings on the motorway.
Predict: The same fixed lookahead at four times the speed: what happens to the crossover and the delay margin?
- Crossover ×4, delay margin about ÷4
- Crossover unchanged: the lookahead sets it
- Crossover ×2, since the plant gain goes as $\sqrt v$
Answer: 0

## Try: PP, k = 0.5, v = 1.6
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0.5,"vcruise":1.6,"vmax":1.6}}
Setup: The lookahead's speed term restored: $L_d = 0.5 + 0.5 \times 1.6 = 1.3$ m at 1.6 m/s.
See: Crossover 2.7 rad/s, phase margin 61.7°, delay margin 0.40 s: nearly the low-speed loop back, at four times the speed.
Shows: The speed term is a gain schedule. $L_d$ growing with $v$ keeps $2.2\,v_0/L_d$ bounded by $2.2/k = 4.4$ rad/s however fast the robot goes, and the margin stays where the tuning put it. Rear-wheel feedback and PID need the same treatment explicitly, gains divided by speed; MPC gets it from its model, which has the speed in it.
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
Note: The gains are read by driving the bench at the operating speed and perturbing it: the controller is linearized numerically, which is why gain scheduling shows up as gains that change with v0. Edit and run: the pure-pursuit example; make its look-ahead independent of speed and the schedule flattens.

## Think about
Q: Why does the crossover level off at $2.2/k$ rather than keep falling?
A: $\omega_c = 2.2\,v_0/(L_0 + k\,v_0)$; as $v_0$ grows the $L_0$ becomes negligible and the ratio tends to $2.2/k$. The loop's bandwidth becomes a constant set by $k$ alone, which is the designer's choice of how fast the loop should be at speed.
Q: How would you schedule rear-wheel feedback?
A: Its loop has $\omega_n = v_0\sqrt{k_e}$ and $\zeta = k_\theta/(2\sqrt{k_e})$, so dividing $k_e$ by $v_0^2$ and $k_\theta$ by $v_0$ keeps both constant. In practice the gains are tabulated against speed and interpolated, which is what gain scheduling means on a production vehicle, with the table checked at every breakpoint by exactly the analysis in this view.
Q: The kinematic plant gain grows with speed without limit. What stops it on a real car?
A: The tyres. Above a characteristic speed the lateral force needed for a given curvature exceeds what the tyres supply linearly, the vehicle understeers, and the steering-to-yaw gain falls instead of rising. The kinematic model used here is valid at low lateral acceleration; chapter 1 derives the dynamic bicycle model that takes over.

## Check yourself
Q: Pure pursuit with $L_d = L_0 + k\,v_0$, $L_0 = 1$ m and $k = 0.6$ s, at $v_0 = 20$ m/s: what is the crossover $\omega_c \approx 2.2\,v_0/L_d$, in rad/s?
Answer: 3.385
Tolerance: 0.07
Unit: rad/s
How: $L_d = 1 + 0.6 \times 20 = 13$ m; $\omega_c = 2.2 \times 20/13 = 3.385$ rad/s.
