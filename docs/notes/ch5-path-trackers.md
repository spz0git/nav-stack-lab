id: ch5
num: 5
sys: ctl
summary: The derivations behind the path trackers in the Control tab: path coordinates and the shared speed profile, pure pursuit from its circle geometry to its gains, rear-wheel feedback from the Frenet equations, Stanley from the front axle, PID on the bearing, DWA as a local planner, and what happens on curves.

# The path trackers

Every path tracker in the Control tab answers the same question at 20 Hz: given where the robot is relative to the path, what should it steer and how fast should it go? This chapter derives each tracker from its own idea, in the order the Control lessons meet them: the path frame and the speed profile they all share (§1), pure pursuit (§2), rear-wheel feedback (§3), Stanley (§4), PID (§5), DWA (§6) and what changes on a curve (§7). Chapter 6 takes the gains derived here and analyzes the loop they close; chapter 7 covers MPC. The blue numbers follow your settings: the tracker is **{{live:ctl}}**, the operating speed $v_0$ = {{live:v0}} m/s, the lookahead $L_d$ = {{live:Ld}} m, the rear-wheel gains $k_e$ = {{live:rwKe}}, $k_\theta$ = {{live:rwKth}}, the Stanley gain {{live:stanK}}, and the lateral acceleration cap {{live:alat}} m/s².

## 1. Path coordinates and the speed profile

**Where am I relative to the path.** The path is a polyline with arc length $s$, heading $\theta_p(s)$ and curvature $\kappa(s)$ at every point. The robot's position is projected onto it to get the progress $s$, the signed lateral error $e$ (positive to the left of the path) and the heading error $\theta_e = \theta - \theta_p$. Those two errors evolve by the Frenet equations, which hold for any vehicle whose velocity points along its heading:

$$
\dot e = v \sin\theta_e, \qquad \dot\theta_e = \omega - v\,\kappa\,\frac{\cos\theta_e}{1 - \kappa e}
$$

The first says the lateral error grows at the sideways component of the velocity. The second says the heading error changes at the robot's turn rate minus the path's own turn rate, which is $v\kappa$ on the path and slightly different beside it (the $1 - \kappa e$ term: a point inside a curve traverses it faster). For small errors on a straight path both reduce to the two integrators of chapter 6 §1: $\dot e = v_0\theta_e$, $\dot\theta_e = \omega$. On a reverse leg the trackers work in a virtual frame with the heading flipped and the steering sign reversed, which for the rear-axle reference point is exact.

**The speed every tracker uses.** Except for MPC and DWA, no tracker measures speed and corrects it; they all command $v$ from the same profile:

$$
v = \min\!\Big(v_{\text{cruise}},\ v_{\max},\ \sqrt{a_{\text{lat}} / \kappa_{\text{peak}}},\ \sqrt{2\,a\,(d_{\text{goal}} - d_0)}\Big)
$$

The third term caps the lateral acceleration $v^2\kappa$ at {{live:alat}} m/s² using the largest curvature over the next 0.8 m of path, which is the lab's stand-in for tyre grip (chapter 1 §5 says why that is the right quantity); the fourth is a braking ramp into the goal with deceleration $a$. The speed "loop" is therefore open: what the Speed plot shows is the actuator chain following the profile, latency, then lag, then the acceleration limit, which is the subject of the speed-loop lesson. MPC is the exception, because its model has speed as a state and its cost penalizes speed error, so it closes a loop through its acceleration input.

## 2. Pure pursuit

**The geometry.** Pick the point on the path a lookahead distance ahead, the carrot, at distance $L$ from the robot and bearing $\alpha$ from its heading. Among all circles tangent to the heading at the robot, exactly one passes through the carrot. Its chord is $L$, and the angle between chord and tangent is $\alpha$, so by the inscribed-angle theorem the chord subtends $2\alpha$ at the centre and $L = 2R\sin\alpha$:

$$
\kappa = \frac{1}{R} = \frac{2\sin\alpha}{L}
$$

The diff-drive robot commands $\omega = v\kappa$; the car commands the steering angle that gives that curvature on the bicycle model, $\delta = \arctan(L_{wb}\,\kappa)$. The lookahead itself is scheduled with speed, $L_d = L_0 + k\,v$, so a faster robot looks further ahead; the carrot is taken at arc length $s + L_d$ along the path, so on a curve it is slightly nearer than $L_d$ in a straight line.

**Linearization: the hidden PD.** Near a straight path with small errors, the carrot sits at $(L_d, 0)$ in path coordinates and the robot at $(0, e)$ with heading $\theta_e$, so the bearing to the carrot is $\alpha \approx -\theta_e - e/L_d$. With $\sin\alpha \approx \alpha$ and $L \approx L_d$:

$$
\omega = v\kappa \approx \frac{2v}{L_d}\left(-\theta_e - \frac{e}{L_d}\right) = -K_e\,e - K_\theta\,\theta_e, \qquad K_e = \frac{2v}{L_d^2},\ K_\theta = \frac{2v}{L_d}
$$

Feedback on $e$ and on $\theta_e$, and since $\theta_e = \dot e / v$ on a straight path, that is proportional-derivative control of the lateral error with the derivative gain fixed by geometry. Substitute into the two integrators: $\ddot e = v\,\dot\theta_e = v\omega = -K_e v\, e - K_\theta\,\dot e$, a second-order system with

$$
\omega_n = \sqrt{K_e v} = \frac{\sqrt2\, v}{L_d}, \qquad \zeta = \frac{K_\theta}{2\omega_n} = \frac{1}{\sqrt2}
$$

The damping ratio is 0.707 whatever the lookahead or the speed: pure pursuit has one knob, $L_d$, and it sets the bandwidth, never the damping. With your settings that is $K_e$ = {{live:Ke0}}, $K_\theta$ = {{live:Kth0}}, $\omega_n$ = {{live:wn0}} rad/s. The Analyze view reads the gains from the code by finite differences and shows {{live:Ke}} and {{live:Kth}}; chapter 6 §2 continues from here into the delay, the margins and the actual poles.

**Limits built into the code.** If the carrot is behind the robot ($|\alpha| > 90°$), the diff-drive stops and turns in place and the car creeps at full lock. If the curvature would ask for more than $\omega_{\max}$, the speed is reduced to keep the curvature rather than the turn rate clipped, so the robot stays on its circle. And the speed cap $\sqrt{a_{\text{lat}}/\kappa}$ uses the commanded curvature itself, so a large error slows the robot down as it turns to correct.

[try: Lookahead 0.4 m | {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0.375}}] [try: Lookahead 2 m | {"level":0,"set":{"ctl":"pp","ppL0":1.6}}]

## 3. Rear-wheel feedback

**The law.** Rear-wheel feedback (Samson's controller, in the form of Paden et al. 2016) commands a curvature from the path curvature and the two errors:

$$
\kappa_{\text{cmd}} = \frac{\kappa\,\cos\theta_e}{1 - \kappa e} \;-\; k_\theta\,\theta_e \;-\; k_e\,\frac{\sin\theta_e}{\theta_e}\,e
$$

The first term is feedforward: it is exactly the curvature that keeps $\dot\theta_e = 0$ in the Frenet equation of §1, so on a curve with zero error the controller already steers the curve and the feedback has nothing to do. The other two are feedback on heading and lateral error, with the $\sin\theta_e/\theta_e$ factor (1 near zero) making the lateral term vanish gracefully when the robot is facing across the path.

**Why it converges.** Substitute $\omega = v\kappa_{\text{cmd}}$ into the Frenet equations; the feedforward cancels the curvature term and what is left is

$$
\dot e = v\sin\theta_e, \qquad \dot\theta_e = -v\,k_\theta\,\theta_e - v\,k_e\,\frac{\sin\theta_e}{\theta_e}\,e
$$

Take $V = \tfrac12 k_e e^2 + \tfrac12\theta_e^2$. Its derivative is $k_e e\, v\sin\theta_e + \theta_e(-v k_\theta\theta_e - v k_e e \sin\theta_e/\theta_e) = -v k_\theta \theta_e^2 \le 0$: the "energy" never increases, and it stops decreasing only when $\theta_e = 0$, from where the lateral term pushes $\theta_e$ away unless $e = 0$ too. So the errors converge for any $v > 0$ and any positive gains, not only for small errors, which pure pursuit cannot claim. Linearizing gives the mass-spring-damper of chapter 6 §5:

$$
\ddot e + v k_\theta\,\dot e + v^2 k_e\, e = 0, \qquad \omega_n = v\sqrt{k_e} = \text{{{live:wnRwf}} rad/s}, \quad \zeta = \frac{k_\theta}{2\sqrt{k_e}} = \text{{{live:zetaRwf}}}
$$

Two knobs, so bandwidth and damping are set independently: $k_e$ is the spring and $k_\theta$ the damper, which is the whole content of the poles-and-damping lesson. The lab reads the feedforward curvature 0.2 m ahead rather than at the projection, a fixed preview that covers the steering-rate lag of the car.

[try: k_θ = 1, light damping | {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":1},"test":"step","stepKind":"offset","stepAmp":0.2}] [try: k_θ = 6, heavy damping | {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":6},"test":"step","stepKind":"offset","stepAmp":0.2}]

## 4. Stanley

**The law.** Stanley (the Stanford DARPA Grand Challenge controller, Hoffmann et al. 2007) measures the cross-track error at the front axle, $e_f$, and steers the front wheel to point back at the path:

$$
\delta = -\theta_e - \arctan\frac{k\,e_f}{k_{\text{soft}} + v}
$$

with $e_f$ positive to the left and $\delta$ positive to the left. The heading term cancels the heading error so the wheel points along the path; the arctangent term turns it toward the path by an angle that grows with the error and shrinks with speed. $k_{\text{soft}}$ = 0.5 m/s keeps the law finite at standstill.

**Why the front axle.** The front wheel's velocity points along $\theta + \delta$, so the front-axle cross-track error evolves as $\dot e_f = v\sin(\theta_e + \delta)$. Substitute the law: the heading error cancels and, with $\arctan x \approx x$ and $\sin x \approx x$,

$$
\dot e_f \approx -v \cdot \frac{k\,e_f}{k_{\text{soft}} + v} \approx -k\,e_f \quad (v \gg k_{\text{soft}})
$$

The front-axle error decays exponentially at rate $k$, independent of speed, and the heading follows because the wheel is on the path. That is the point of measuring at the front axle: the error the steering acts on directly is the one the law regulates, and the nonlinear arctangent makes the same law work for large errors, where it saturates at the steering limit and the car drives straight at the path. In the loop of chapter 6 Stanley reads as a pair of gains on $e$ and $\theta_e$ like the others, which the Analyze view reads by finite differences when Stanley is selected.

**What it lacks.** There is no curvature feedforward, so on a curve the law needs a standing error to produce the standing steering angle: the offset chip in the Analyze view reports it (4.5 cm on the 4 m circle in the curves lesson). It is forward-only, so the lab hands reverse legs to pure pursuit.

[try: Car, Stanley | {"level":5,"set":{"ctl":"stanley"}}]

## 5. PID on the bearing

The PID tracker takes the bearing error to the carrot, the same carrot as pure pursuit, and applies the textbook law:

$$
u = k_p\,\epsilon + k_i\!\int\epsilon\,dt + k_d\,\dot\epsilon, \qquad \epsilon = \operatorname{atan2}(\text{carrot} - \text{robot}) - \theta
$$

with $u$ the turn rate (diff-drive) or the steering angle (car), the integral clamped at ±1 rad·s, and the derivative taken as the finite difference of $\epsilon$ over one tick. Near the path $\epsilon \approx -\theta_e - e/L_d$ as in §2, so the proportional term alone is pure pursuit with a different gain scale, the derivative term adds feedback on $\dot\epsilon$, which contains $\dot\theta_e$ (the turn rate itself) and $\dot e/L_d$, and the integral term is what none of the other trackers have. An integrator in the loop removes the steady-state error that a constant actuator bias otherwise leaves, $e_{ss} = d/K_e$ in chapter 6 §5, because the integral keeps growing until the error is gone. The price is phase: $1/s$ costs 90° at low frequency, and too much $k_i$ erodes the margin and adds a slow overshoot, which the integral-action lesson measures (settling 4.3 s with $k_i$ = 0, 16 s with $k_i$ = 0.4). The speed is scaled by $\cos^2\epsilon$ so the robot slows when it is pointed away from the carrot.

[try: PID, k_i = 0 | {"level":5,"set":{"ctl":"pid","kp":2,"ki":0,"kd":0.15},"stepKind":"bias","test":"step"}] [try: PID, k_i = 0.4 | {"level":5,"set":{"ctl":"pid","kp":2,"ki":0.4,"kd":0.15},"stepKind":"bias","test":"step"}]

## 6. DWA: a local planner in the tracker's seat

The dynamic window approach is not a path tracker but it sits in the same slot. Every tick it samples 7 speeds and 15 turn rates (or steering angles) inside the window the robot can reach in 0.25 s given its acceleration limits, simulates each pair forward for 1.6 s against the lidar points and the predicted people, discards any trajectory that comes within 5 cm of something or could not stop before it, and scores the rest:

$$
J = w_g\,(d_{\text{carrot}} + 0.3\,|\Delta\theta|) + w_o\,\frac{1}{\min(\text{clearance}, 3)} + w_v\,(v_{\text{top}} - v)
$$

The best pair is applied. There is no path-tracking law, only a goal 1.6 m ahead on the path; the behaviour emerges from the costs, which is why DWA avoids obstacles the path did not know about and also why it has no loop analysis in the Analyze view: there is no linear law to read gains from. It is the method of choice for reactive obstacle avoidance on slow robots, and a poor path tracker, because nothing in the cost asks it to be on the path, only to approach the carrot.

## 7. Curves: the operating point moves

On a circle of radius $R$ the robot must hold a steady turn rate $v/R$, and each tracker produces it differently. Pure pursuit measures its carrot along the path, so on a constant-curvature arc the circle through the carrot is the path's own circle: it follows a circle with no steady error and its gains barely move. Rear-wheel feedback carries the curvature as feedforward and also settles with no offset. Stanley and PID have no feedforward and have to generate the steady steering from a standing error, so they settle beside the path, inside the turn, at an offset the Analyze view reports; the step response is then measured about that offset. The Analyze view reads the gains by finite differences about the settled state on the circle, and because the Frenet equations keep the same two-integrator form about any operating point, the same Bode and Nyquist plots apply. What does change on the car is saturation: on a 4 m circle the steering-rate limit of 1.5 rad/s is reached during the step test, which the message under the experiments reports, and the measured response then stops matching the linear prediction, which is chapter 6 §7.

[try: Pure pursuit, R = 2 m | {"level":0,"set":{"ctl":"pp"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}] [try: Car, Stanley, R = 4 m | {"level":5,"set":{"ctl":"stanley"},"curveR":4,"test":"step","stepKind":"offset","stepAmp":0.2}]

## 8. What to carry into the next chapters

Every tracker here reduces, near the path, to two gains on $e$ and $\theta_e$, and that is what chapter 6 works with: the gains become an open-loop transfer function, the clock in the loop adds delay, and the margins and poles follow. The two things that do not reduce to gains are the limits, the steering lock and rate, the turn-rate cap, the lateral-acceleration cap, and chapter 1 §5 is where those come from in the vehicle. Chapter 7 then replaces the law with an optimization and asks what, if anything, that changes.
