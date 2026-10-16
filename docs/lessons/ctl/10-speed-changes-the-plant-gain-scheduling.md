group: ctl
title: Speed changes the plant: gain scheduling

<p><b>Why this matters.</b> A vehicle is not one plant; it is a family of plants indexed by speed. The same steering angle turns the car twice as fast at twice the speed, and the same heading error grows the lateral error twice as fast. A controller tuned at 10 m/s is a different loop at 30 m/s, with a different crossover and different margins. Gain scheduling, changing the controller with speed so the loop stays the same, is the standard answer, and pure pursuit contains a built-in version of it.</p>
<p><b>The idea.</b> The plant gain is <i>v</i>₀ for the diff-drive and <i>v</i>₀²/<i>L</i> for the car: both the turn rate (<i>v</i> tan δ/<i>L</i>) and the lateral rate (<i>v</i>θ<sub>e</sub>) scale with speed. Fixed gains therefore give a loop whose crossover rises with speed, and a crossover that rises walks into the delay limit. Pure pursuit schedules itself: L_d = L<sub>0</sub> + k·v₀ grows with speed, so ω<sub>c</sub> = 2.2 <i>v</i>₀/<i>L</i><sub>d</sub> levels off at 2.2/<i>k</i> as speed rises. Rear-wheel feedback works in curvature, so its turn-rate gain is <i>v</i> times the curvature gain and its crossover grows roughly in proportion to speed unless the gains are scheduled.</p>
<p><b>Where it comes from.</b> With ω<sub>n</sub> = <i>v</i>₀√(<i>g</i><i>K</i><sub>e</sub>) and <i>K</i><sub>e</sub> = 2<i>v</i>₀/<i>L</i><sub>d</sub>² for pure pursuit, ω<sub>n</sub> = √2 <i>v</i>₀/<i>L</i><sub>d</sub>; put <i>L</i><sub>d</sub> = <i>L</i>₀ + <i>k</i><i>v</i>₀ and the ratio tends to √2/<i>k</i> as <i>v</i>₀ grows. <a class="chref" href="#notes=ch6/2-pure-pursuit-is-a-pd-controller-in-disguise">Derivation: chapter 6 §2</a> · what else changes with speed in the vehicle itself: <a class="chref" href="#notes=ch1/5-understeer-the-characteristic-speed-and-stability">chapter 1 §5</a></p>
<p><b>What the lab does.</b> The operating speed of the analysis is the cruise speed (capped by <i>v</i><sub>max</sub>), both in the Control tab. The buttons change the cruise speed with the lookahead's speed term off and on. The kinematic vehicle here never loses grip, so the plant gain keeps growing with speed without limit; chapter 1 describes what a real vehicle does instead, and the car with tyre slip (Vehicle tab) does it: <a class="lsref" href="#lesson=ctl:16">Gain scheduling breaks above v_ch</a> repeats these buttons on it.</p>

## Try: PP, k = 0, v = 0.4
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0,"vcruise":0.4}}
Setup: Pure pursuit with a fixed 0.5 m lookahead (no speed term) at 0.4 m/s.
See: Crossover 1.76 rad/s (2.2 × 0.4/0.5), phase margin 63°, delay margin 0.63 s.
Shows: At low speed a fixed lookahead gives a slow, comfortable loop. Note the plant gain: v₀ = 0.4 enters K_e = 2v₀/L_d² directly.
Predict: A fixed 0.5 m lookahead at 0.4 m/s: roughly what crossover?
- About 0.4 rad/s
- About 1.8 rad/s
- About 7 rad/s
Answer: 1

## Try: PP, k = 0, v = 1.6
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0,"vcruise":1.6,"vmax":1.6}}
Setup: The same fixed lookahead at four times the speed.
See: Crossover 7.03 rad/s, four times higher, phase margin 55.5°, delay margin 0.14 s, gain margin 19.5 dB. The loop has moved most of the way to its delay limit without a single controller setting changing.
Shows: Speed is a gain. With the lookahead fixed, the crossover is proportional to v₀, the delay budget inversely, and a loop that had 0.63 s of budget at walking pace has 0.14 s at running pace. On a real vehicle this is the difference between a lane-keeping loop that is fine in town and one that rings on the motorway.
Predict: The same fixed lookahead at four times the speed: what happens to the crossover and the delay margin?
- Crossover ×4, delay margin about ÷4
- Crossover unchanged: the lookahead sets it
- Crossover ×2, since the plant gain goes as √v
Answer: 0

## Try: PP, k = 0.5, v = 1.6
cfg: {"level":0,"set":{"ctl":"pp","ppL0":0.5,"ppK":0.5,"vcruise":1.6,"vmax":1.6}}
Setup: The lookahead's speed term restored: L_d = 0.5 + 0.5 × 1.6 = 1.3 m at 1.6 m/s.
See: Crossover 2.7 rad/s, phase margin 61.7°, delay margin 0.40 s: nearly the low-speed loop back, at four times the speed.
Shows: The speed term is a gain schedule. L_d growing with v keeps 2.2 v₀/L_d bounded by 2.2/k = 4.4 rad/s however fast the robot goes, and the margin stays where the tuning put it. Rear-wheel feedback and PID need the same treatment explicitly, gains divided by speed; MPC gets it from its model, which has the speed in it.
Predict: Restoring the speed term, L_d = 0.5 + 0.5v, at 1.6 m/s: where will the loop land?
- Faster still: a longer lookahead at speed adds gain
- Unchanged from the k = 0 run at 1.6 m/s
- Near the low-speed loop: crossover under 3 rad/s, margin above 60°
Answer: 2

## Think about
Q: Why does the crossover level off at 2.2/k rather than keep falling?
A: ω_c = 2.2 v₀/(L₀ + k v₀); as v₀ grows the L₀ becomes negligible and the ratio tends to 2.2/k. The loop's bandwidth becomes a constant set by k alone, which is the designer's choice of how fast the loop should be at speed.
Q: How would you schedule rear-wheel feedback?
A: Its loop has ω_n = v₀√k_e and ζ = k_θ/(2√k_e), so dividing k_e by v₀² and k_θ by v₀ keeps both constant. In practice the gains are tabulated against speed and interpolated, which is what gain scheduling means on a production vehicle, with the table checked at every breakpoint by exactly the analysis in this view.
Q: The kinematic plant gain grows with speed without limit. What stops it on a real car?
A: The tyres. Above a characteristic speed the lateral force needed for a given curvature exceeds what the tyres supply linearly, the vehicle understeers, and the steering-to-yaw gain falls instead of rising. The kinematic model used here is valid at low lateral acceleration; chapter 1 derives the dynamic bicycle model that takes over.

## Check yourself
Q: Pure pursuit with L_d = L₀ + k·v₀, L₀ = 1 m and k = 0.6 s, at v₀ = 20 m/s: what is the crossover ω_c ≈ 2.2 v₀/L_d, in rad/s?
Answer: 3.385
Tolerance: 0.07
Unit: rad/s
How: L_d = 1 + 0.6 × 20 = 13 m; ω_c = 2.2 × 20/13 = 3.385 rad/s.
