id: ch5
num: 5
sys: ctl
summary: The derivations behind the path trackers in the Control tab: path coordinates and the shared speed profile, pure pursuit from its circle geometry to its gains, rear-wheel feedback from the Frenet equations, Stanley from the front axle, PID on the bearing, DWA as a local planner, and what happens on curves.

# The path trackers

Every path tracker in the Control tab runs at 20 Hz. On each tick it gets the robot's position relative to the path, and it decides how to steer and how fast to go. This chapter derives each tracker from the idea behind it, in the order the Control lessons meet them. §1 covers the path frame and the speed profile that all of them share. Then come pure pursuit (§2), rear-wheel feedback (§3), Stanley (§4), PID (§5) and DWA (§6), and §7 covers what changes on a curve. Chapter 6 takes the gains derived here and analyzes the loop they close, and chapter 7 covers MPC. The blue numbers follow your settings. The tracker is **{{live:ctl}}**, the operating speed is $v_0$ = {{live:v0}} m/s and the lookahead is $L_d$ = {{live:Ld}} m. The rear-wheel gains are $k_e$ = {{live:rwKe}} and $k_\theta$ = {{live:rwKth}}, the Stanley gain is {{live:stanK}}, and the lateral acceleration cap is {{live:alat}} m/s².

## 1. Path coordinates and the speed profile

**Where am I relative to the path.** The path is a polyline with arc length $s$, heading $\theta_p(s)$ and curvature $\kappa(s)$ at every point. Projecting the robot's position onto it gives the progress $s$, the signed lateral error $e$ (positive to the left of the path) and the heading error $\theta_e = \theta - \theta_p$. The two errors evolve by the Frenet equations, which hold for any vehicle whose velocity points along its heading:

$$
\dot e = v \sin\theta_e, \qquad \dot\theta_e = \omega - v\,\kappa\,\frac{\cos\theta_e}{1 - \kappa e}
$$

The first says that the lateral error grows at the sideways component of the velocity. The second says that the heading error changes at the robot's turn rate minus the path's own turn rate. On the path that rate is $v\kappa$. Beside the path it is slightly different, and the $1 - \kappa e$ term accounts for that, since a point on the inside of a curve goes round it faster. For small errors on a straight path, both equations reduce to the two integrators of chapter 6 §1, $\dot e = v_0\theta_e$ and $\dot\theta_e = \omega$. On a reverse leg the trackers work in a virtual frame with the heading flipped and the steering sign reversed. For the rear-axle reference point this is exact.

**The speed every tracker uses.** No tracker except MPC and DWA measures the speed and corrects it. The others all command $v$ from the same profile:

$$
v = \min\!\Big(v_{\text{cruise}},\ v_{\max},\ \sqrt{a_{\text{lat}} / \kappa_{\text{peak}}},\ \sqrt{2\,a\,(d_{\text{goal}} - d_0)}\Big)
$$

The third term caps the lateral acceleration $v^2\kappa$ at {{live:alat}} m/s², using the largest curvature over the next 0.8 m of path. This cap is the lab's stand-in for tyre grip, and chapter 1 §6 explains why lateral acceleration is the right quantity to cap. The fourth term is a braking ramp into the goal with deceleration $a$. The speed "loop" is therefore open. The Speed plot shows the actuator chain following the profile, with the latency first, then the lag, then the acceleration limit. The speed-loop lesson looks at that chain. MPC is the exception. Its model has speed as a state and its cost penalizes speed error, so it closes a loop through its acceleration input.

## 2. Pure pursuit

**The geometry.** Pick the point on the path a lookahead distance ahead of the robot. This point is called the carrot. It lies at distance $L$ from the robot and at bearing $\alpha$ from the robot's heading. Of all the circles tangent to the heading at the robot, only one passes through the carrot. The chord from the robot to the carrot has length $L$, and the angle between chord and tangent is $\alpha$. By the inscribed-angle theorem the chord then subtends $2\alpha$ at the centre, so $L = 2R\sin\alpha$:

$$
\kappa = \frac{1}{R} = \frac{2\sin\alpha}{L}
$$

The diff-drive robot commands $\omega = v\kappa$. The car commands the steering angle that gives that curvature on the bicycle model, $\delta = \arctan(L_{wb}\,\kappa)$, where $L_{wb}$ is the wheelbase. The lookahead itself is scheduled with speed, $L_d = L_0 + k\,v$, so a faster robot looks further ahead. The carrot is taken at arc length $s + L_d$ along the path, so on a curve it is slightly nearer than $L_d$ in a straight line.

**Linearization: the hidden PD.** Take a straight path and small errors. In path coordinates the carrot sits at $(L_d, 0)$ and the robot at $(0, e)$ with heading $\theta_e$. The bearing to the carrot is then $\alpha \approx -\theta_e - e/L_d$. With $\sin\alpha \approx \alpha$ and $L \approx L_d$:

$$
\omega = v\kappa \approx \frac{2v}{L_d}\left(-\theta_e - \frac{e}{L_d}\right) = -K_e\,e - K_\theta\,\theta_e, \qquad K_e = \frac{2v}{L_d^2},\ K_\theta = \frac{2v}{L_d}
$$

This is feedback on $e$ and on $\theta_e$. On a straight path $\theta_e = \dot e / v$, so it is proportional-derivative control of the lateral error, with the derivative gain fixed by the geometry. Substituting into the two integrators gives $\ddot e = v\,\dot\theta_e = v\omega = -K_e v\, e - K_\theta\,\dot e$. This is a second-order system with

$$
\omega_n = \sqrt{K_e v} = \frac{\sqrt2\, v}{L_d}, \qquad \zeta = \frac{K_\theta}{2\omega_n} = \frac{1}{\sqrt2}
$$

The damping ratio is 0.707 for any lookahead and any speed. Pure pursuit has one knob, $L_d$, and it sets the bandwidth but never the damping. With your settings $K_e$ = {{live:Ke0}}, $K_\theta$ = {{live:Kth0}} and $\omega_n$ = {{live:wn0}} rad/s. The Analyze view reads the gains from the code by finite differences: it nudges each error by a small amount and measures how the command changes. It shows {{live:Ke}} and {{live:Kth}}. Chapter 6 §2 continues from here with the delay, the margins and the actual poles.

**Limits built into the code.** If the carrot is behind the robot ($|\alpha| > 90°$), the diff-drive robot stops and turns in place, and the car creeps at full lock. If the curvature would need a turn rate above $\omega_{\max}$, the code lowers the speed and keeps the curvature, instead of clipping the turn rate. The robot then stays on its circle. The speed cap $\sqrt{a_{\text{lat}}/\kappa}$ also uses the commanded curvature itself, so a large error slows the robot down while it turns to correct.

[try: Lookahead 0.4 m | {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0.375}}] [try: Lookahead 2 m | {"level":0,"set":{"ctl":"pp","ppL0":1.6}}]

## 3. Rear-wheel feedback

**The law.** Rear-wheel feedback (Samson's controller, in the form of Paden et al. 2016) commands a curvature from the path curvature and the two errors:

$$
\kappa_{\text{cmd}} = \frac{\kappa\,\cos\theta_e}{1 - \kappa e} \;-\; k_\theta\,\theta_e \;-\; k_e\,\frac{\sin\theta_e}{\theta_e}\,e
$$

The first term is feedforward. It is the curvature that keeps $\dot\theta_e = 0$ in the Frenet equation of §1. So on a curve with zero error the controller already steers along the curve, and the feedback has nothing to do. The other two terms are feedback on the heading error and the lateral error. The $\sin\theta_e/\theta_e$ factor is 1 near zero, and it makes the lateral term fade out smoothly when the robot is facing across the path.

**Why it converges.** Substitute $\omega = v\kappa_{\text{cmd}}$ into the Frenet equations. The feedforward cancels the curvature term, and what is left is

$$
\dot e = v\sin\theta_e, \qquad \dot\theta_e = -v\,k_\theta\,\theta_e - v\,k_e\,\frac{\sin\theta_e}{\theta_e}\,e
$$

Take $V = \tfrac12 k_e e^2 + \tfrac12\theta_e^2$ as a measure of the total error, a kind of energy. Its derivative is $k_e e\, v\sin\theta_e + \theta_e(-v k_\theta\theta_e - v k_e e \sin\theta_e/\theta_e) = -v k_\theta \theta_e^2 \le 0$, so the "energy" never increases. It stops decreasing only when $\theta_e = 0$. From there the lateral term pushes $\theta_e$ away again, unless $e = 0$ as well. So the errors converge for any $v > 0$ and any positive gains, and this holds for large errors as well as small ones. Pure pursuit has no such guarantee. Linearizing gives the mass-spring-damper of chapter 6 §5:

$$
\ddot e + v k_\theta\,\dot e + v^2 k_e\, e = 0, \qquad \omega_n = v\sqrt{k_e} = \text{{{live:wnRwf}} rad/s}, \quad \zeta = \frac{k_\theta}{2\sqrt{k_e}} = \text{{{live:zetaRwf}}}
$$

There are two knobs, so the bandwidth and the damping can be set independently. The spring is $k_e$ and the damper is $k_\theta$, and the poles-and-damping lesson is built on this. The lab reads the feedforward curvature 0.2 m ahead of the projection point instead of at it. This fixed preview covers the steering-rate lag of the car.

[try: k_θ = 1, light damping | {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":1},"test":"step","stepKind":"offset","stepAmp":0.2}] [try: k_θ = 6, heavy damping | {"level":0,"set":{"ctl":"rwf","rwKe":6,"rwKth":6},"test":"step","stepKind":"offset","stepAmp":0.2}]

## 4. Stanley

**The law.** Stanley (the Stanford DARPA Grand Challenge controller, Hoffmann et al. 2007) measures the cross-track error at the front axle, $e_f$, and steers the front wheel to point back at the path:

$$
\delta = -\theta_e - \arctan\frac{k\,e_f}{k_{\text{soft}} + v}
$$

Here $e_f$ and $\delta$ are both positive to the left. The heading term cancels the heading error, so the wheel points along the path. The arctangent term then turns the wheel towards the path, by an angle that grows with the error and shrinks with speed. The softening constant $k_{\text{soft}}$ = 0.5 m/s keeps the law finite at standstill.

**Why the front axle.** The front wheel's velocity points along $\theta + \delta$, so the front-axle cross-track error evolves as $\dot e_f = v\sin(\theta_e + \delta)$. Substitute the law. The heading error cancels, and with $\arctan x \approx x$ and $\sin x \approx x$ what is left is

$$
\dot e_f \approx -v \cdot \frac{k\,e_f}{k_{\text{soft}} + v} \approx -k\,e_f \quad (v \gg k_{\text{soft}})
$$

The front-axle error decays exponentially at rate $k$, independent of speed. The heading follows, because the wheel is on the path. Measuring at the front axle means that the law regulates the error the steering acts on directly. The nonlinear arctangent lets the same law work for large errors too. There it saturates at the steering limit, and the car drives straight at the path. In the loop of chapter 6, Stanley is a pair of gains on $e$ and $\theta_e$ like the others. The Analyze view reads them by finite differences when Stanley is selected.

**What it lacks.** There is no curvature feedforward. On a curve the law therefore needs a standing error to produce the steady steering angle that the curve requires. The offset chip in the Analyze view reports that error (4.5 cm on the 4 m circle in the curves lesson). Stanley only works forwards, so the lab hands reverse legs to pure pursuit.

[try: Car, Stanley | {"level":5,"set":{"ctl":"stanley"}}]

## 5. PID on the bearing

The PID tracker takes the bearing error to the carrot (the same carrot as pure pursuit's) and applies the textbook law:

$$
u = k_p\,\epsilon + k_i\!\int\epsilon\,dt + k_d\,\dot\epsilon, \qquad \epsilon = \operatorname{atan2}(\text{carrot} - \text{robot}) - \theta
$$

Here $u$ is the turn rate (diff-drive) or the steering angle (car). The integral is clamped at ±1 rad·s, and the derivative is the finite difference of $\epsilon$ over one tick. Near the path $\epsilon \approx -\theta_e - e/L_d$, as in §2. So the proportional term alone is pure pursuit with a different gain scale. The derivative term adds feedback on $\dot\epsilon$, which contains $\dot\theta_e$ (the turn rate itself) and $\dot e/L_d$. None of the other trackers has the integral term. A constant actuator bias otherwise leaves a steady-state error, $e_{ss} = d/K_e$ in chapter 6 §5. An integrator in the loop removes it, because the integral keeps growing until the error is gone. The cost is phase. The integrator $1/s$ costs 90° of phase at low frequency, and too much $k_i$ erodes the margin and adds a slow overshoot. The integral-action lesson measures this. Settling takes 4.3 s with $k_i$ = 0 and 16 s with $k_i$ = 0.4. The speed is scaled by $\cos^2\epsilon$, so the robot slows when it is pointed away from the carrot.

[try: PID, k_i = 0 | {"level":5,"set":{"ctl":"pid","kp":2,"ki":0,"kd":0.15},"stepKind":"bias","test":"step"}] [try: PID, k_i = 0.4 | {"level":5,"set":{"ctl":"pid","kp":2,"ki":0.4,"kd":0.15},"stepKind":"bias","test":"step"}]

## 6. DWA: a local planner in the tracker's seat

The dynamic window approach is a local planner, not a path tracker, but it sits in the same slot. On every tick it samples 7 speeds and 15 turn rates (or steering angles). They are taken inside the window of commands the robot can reach in 0.25 s with its acceleration limits. DWA simulates each pair forward for 1.6 s against the lidar points and the predicted people. It discards any trajectory that comes within 5 cm of something, or that could not stop before it, and scores the rest:

$$
J = w_g\,(d_{\text{carrot}} + 0.3\,|\Delta\theta|) + w_o\,\frac{1}{\min(\text{clearance}, 3)} + w_v\,(v_{\text{top}} - v)
$$

The first term pulls towards the carrot and towards its direction, the second pushes away from obstacles, and the third rewards speed. The pair with the lowest cost is applied. There is no path-tracking law, only a goal 1.6 m ahead on the path, and the behaviour comes out of the costs. So DWA avoids obstacles that the path did not know about. For the same reason it has no loop analysis in the Analyze view, since there is no linear law to read gains from. DWA is the method of choice for reactive obstacle avoidance on slow robots. It is a poor path tracker, because nothing in the cost asks it to stay on the path, only to approach the carrot.

## 7. Curves: the operating point moves

On a circle of radius $R$ the robot has to hold a steady turn rate $v/R$, and each tracker produces it in its own way. Pure pursuit measures its carrot along the path. On an arc of constant curvature, the circle through the carrot is then the path's own circle. So pure pursuit follows the circle with no steady error, and its gains barely move. Rear-wheel feedback carries the curvature as feedforward and also settles with no offset. Stanley and PID have no feedforward. They have to generate the steady steering from a standing error, so they settle beside the path, on the inside of the turn, at an offset that the Analyze view reports. The step response is then measured about that offset. The Analyze view reads the gains by finite differences about the settled state on the circle. The Frenet equations keep the same two-integrator form about any operating point, so the same Bode and Nyquist plots apply. On the car, saturation does change things. On a 4 m circle the steering-rate limit of 1.5 rad/s is reached during the step test, and the message under the experiments says so. The measured response then stops matching the linear prediction. Chapter 6 §7 covers this case.

[try: Pure pursuit, R = 2 m | {"level":0,"set":{"ctl":"pp"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}] [try: Car, Stanley, R = 4 m | {"level":5,"set":{"ctl":"stanley"},"curveR":4,"test":"step","stepKind":"offset","stepAmp":0.2}]

## 8. What to carry into the next chapters

Near the path, every tracker here reduces to two gains, one on $e$ and one on $\theta_e$. Chapter 6 works with those gains. They become an open-loop transfer function, the clock in the loop adds delay, and the margins and poles follow from that. The limits do not reduce to gains. They are the steering lock and rate, the turn-rate cap and the lateral-acceleration cap, and chapter 1 §6 explains where they come from in the vehicle. Chapter 7 then replaces the law with an optimization and asks what that changes, if anything.
