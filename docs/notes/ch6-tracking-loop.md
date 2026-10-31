id: ch6
num: 6
sys: ctl
summary: Where every chip in the Analyze view comes from: the linear loop behind pure pursuit, its margins, poles and responses, with live numbers from your current settings.

# The lateral tracking loop

When you open the Analyze view it shows a phase margin, a delay margin, $M_s$ and a pair of dominant poles. All of them come from one linear model with two states, and this chapter derives it. The numbers in this chapter are live. They are computed from the parameters you have set now (controller **{{live:ctl}}**, $v_0$ = {{live:v0}} m/s). Change a slider in the Control or Vehicle tab and read them again.

## 1. The vehicle in path coordinates

Near a path, two numbers describe the robot: the lateral error $e$ and the heading error $\theta_e$. Two first-order equations connect them to what the controller commands.

<svg class="notes-fig" viewBox="0 0 760 300" role="img" aria-label="Path coordinates: lateral error e, heading error theta e, pure-pursuit angle alpha">
<defs><marker id="nf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker><marker id="nf-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--rose)"/></marker></defs>
<g stroke="var(--muted)"><line x1="60" y1="220" x2="700" y2="220" stroke-width="1.5" marker-end="url(#nf-arrow)"/><line x1="260" y1="208" x2="470" y2="208" stroke="var(--line)"/><line x1="260" y1="204" x2="260" y2="212" stroke="var(--line)"/><line x1="470" y1="204" x2="470" y2="212" stroke="var(--line)"/></g>
<text x="64" y="244" font-size="15" fill="var(--muted)">path (s increases →)</text>
<text x="365" y="202" text-anchor="middle" font-size="15" fill="var(--muted)">lookahead Ld</text>
<line x1="260" y1="140" x2="260" y2="220" stroke="var(--accent)" stroke-width="1.25" stroke-dasharray="4 4"/>
<text x="250" y="184" text-anchor="end" font-weight="600" font-size="17" fill="var(--ink)">e</text>
<line x1="260" y1="140" x2="330" y2="140" stroke="var(--line)" stroke-dasharray="2 4"/>
<text x="336" y="156" font-size="15" fill="var(--muted)">parallel to the path tangent</text>
<line x1="260" y1="140" x2="366" y2="112" stroke="var(--rose)" stroke-width="1.5" marker-end="url(#nf-arrow2)"/>
<text x="372" y="104" font-size="15" fill="var(--muted)">heading, speed v</text>
<circle cx="260" cy="140" r="9" fill="var(--accent)" fill-opacity="0.15" stroke="var(--accent)" stroke-width="2"/>
<path d="M300 140 A40 40 0 0 0 298.6 129.6" fill="none" stroke="var(--muted)"/><text x="312" y="126" font-weight="600" font-size="17" fill="var(--ink)">θe</text>
<line x1="260" y1="140" x2="470" y2="220" stroke="var(--muted)" stroke-dasharray="4 4"/>
<path d="M318 124.5 A60 60 0 0 1 316 161.4" fill="none" stroke="var(--muted)"/><text x="300" y="170" font-weight="600" font-size="17" fill="var(--ink)">α</text>
<circle cx="470" cy="220" r="5" fill="var(--accent)"/><text x="470" y="244" text-anchor="middle" font-size="15" fill="var(--muted)">carrot: Ld ahead of the foot</text>
<text x="24" y="282" font-size="14" fill="var(--muted)">e &gt; 0 to the left of the path · θe = heading − path tangent · α = angle from the heading to the carrot</text>
</svg>

The simulator integrates the unicycle for the differential-drive robot and the kinematic bicycle for the car-like one. The inputs are the commanded speed $v$ and either the yaw rate $\omega$ or the front steering angle $\delta$ (wheelbase $L$):

$$
\dot x = v\cos\theta,\qquad \dot y = v\sin\theta,\qquad \dot\theta = \omega\ \text{(unicycle)}\ \ \text{or}\ \ \dot\theta = \frac{v\tan\delta}{L}\ \text{(bicycle)}
$$

Now write the pose relative to the path. Drop a perpendicular from the robot to the path. Let $s$ be the arc length along the path to its foot, $\theta_p(s)$ the angle of the path's tangent there and $\kappa_p(s)$ the path's curvature. Let $e$ be the robot's signed distance to the left of the path, and $\theta_e = \theta - \theta_p$. In these path (Frenet) coordinates the kinematics are

$$
\dot e = v\sin\theta_e,\qquad \dot\theta_e = \dot\theta - \kappa_p\,\dot s,\qquad \dot s = \frac{v\cos\theta_e}{1-\kappa_p e}
$$

On a straight path $\kappa_p = 0$, and the second equation reduces to $\dot\theta_e = \dot\theta$. Linearize about $e = 0$, $\theta_e = 0$, $v = v_0$, which means treating the angles as small. Write $u$ for the steering input, which is $\omega$ for the unicycle and $\delta$ for the bicycle:

$$
\dot e = v_0\,\theta_e,\qquad \dot\theta_e = g\,u,\qquad g = 1\ \text{(unicycle)}\ \ \text{or}\ \ g = \frac{v_0}{L}\ \text{(bicycle)}
$$

In the Laplace domain this is a chain of two integrators from the input to the lateral error:

$$
\theta_e(s) = \frac{g}{s}\,u(s),\qquad e(s) = \frac{g\,v_0}{s^2}\,u(s)
$$

The double integrator sets the shape of every Bode plot in the app before any controller is chosen. Its magnitude has a slope of −40 dB per decade, and its phase is −180° at every frequency. A controller has to add phase back. In the next section the heading term does this.

The operating speed is $v_0 = \min(v_{cruise}, v_{max})$, {{live:v0}} m/s now. The Curve R 4 m and Curve R 2 m buttons in the Analyze view move the operating point onto a circle. Then $\dot\theta_e = \omega - v_0/R$ has a constant term that the controller must cancel. The app lets the loop settle on the circle before it reads the gains, and the offset chip reports the steady $e$ that remains.

## 2. Pure pursuit is a PD controller in disguise

Linearized about the path, pure pursuit commands $\omega = -K_e\,e - K_\theta\,\theta_e$ with $K_e = 2v_0/L_d^2$ and $K_\theta = 2v_0/L_d$. With your lookahead $L_d$ = {{live:Ld}} m and $v_0$ = {{live:v0}} m/s that is $K_e$ = {{live:Ke0}} and $K_\theta$ = {{live:Kth0}}. The Analyze view reads the gains from the code and shows {{live:Ke}} and {{live:Kth}}.

[try: Pure pursuit, L1 defaults | {"level":0,"set":{"ctl":"pp"}}] [try: Lookahead 0.4 m | {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0.375}}] [try: Lookahead 2 m | {"level":0,"set":{"ctl":"pp","ppL0":1.6}}]

The controller as the app runs it (`ctlPP` in `core/controllers.js`) has three steps. First it takes the path point a lookahead distance $L_d$ beyond the foot of the perpendicular. This point is called the carrot. Then it measures the angle $\alpha$ from the heading to the carrot, and the straight-line distance $\ell$ to it. Last, it drives along the circular arc that starts at the robot, is tangent to its heading and passes through the carrot. The angle between a tangent and a chord is half the angle the chord subtends at the centre. So the chord $\ell$ subtends $2\alpha$ at the circle's centre, and the arc's curvature is

$$
\kappa = \frac{2\sin\alpha}{\ell},\qquad \omega = v\,\kappa\ \text{(unicycle)},\qquad \delta = \arctan(L\,\kappa)\ \text{(bicycle)}
$$

The lookahead grows with speed, $L_d = L_0 + k_v|v|$, so at higher speed the robot looks further ahead and turns more gently. The speed is also capped by a lateral-acceleration limit, $v \le \sqrt{a_{lat}/|\kappa|}$, and by the yaw-rate limit. Neither cap is reached near the path, so the linear model leaves them out.

To linearize, put the robot at $(0, e)$ in path coordinates with heading $\theta_e$. The foot is at the origin and the carrot is at $(L_d, 0)$. Seen from the robot, the carrot lies in the direction $\operatorname{atan2}(-e, L_d) \approx -e/L_d$. Subtracting the heading gives $\alpha$, and the distance and curvature follow:

$$
\alpha = -\frac{e}{L_d} - \theta_e,\qquad \ell = \sqrt{L_d^2+e^2}\approx L_d,\qquad \kappa \approx \frac{2\alpha}{L_d} = -\frac{2e}{L_d^2} - \frac{2\theta_e}{L_d}
$$

Multiplying by $v_0$ gives the yaw-rate law and its two gains:

$$
\omega = -K_e\,e - K_\theta\,\theta_e,\qquad K_e = \frac{2v_0}{L_d^2},\qquad K_\theta = \frac{2v_0}{L_d}
$$

Since $\dot e = v_0\theta_e$, the heading term acts on the derivative of the lateral error, $\omega = -K_e e - (K_\theta/v_0)\,\dot e$. So pure pursuit is a PD controller on $e$, and one knob, the lookahead, sets both of its gains. A shorter $L_d$ raises both. The proportional gain rises as $1/L_d^2$ and the derivative gain only as $1/L_d$. Shortening the lookahead therefore trades damping for stiffness, and this is why a short lookahead oscillates.

Closing the loop around the double integrator of section 1, with no delay, gives the characteristic equation below. Matching it to $s^2 + 2\zeta\omega_n s + \omega_n^2$ gives the textbook second-order parameters:

$$
s^2 + g K_\theta\,s + g K_e v_0 = 0
$$

$$
\omega_n = \sqrt{g K_e v_0} = \frac{\sqrt 2\,v_0}{L_d},\qquad \zeta = \frac{g K_\theta}{2\omega_n} = \frac{1}{\sqrt 2}
$$

For the unicycle the damping ratio is $1/\sqrt 2 = 0.707$ for any lookahead and any speed. Only the natural frequency moves. With your settings it is $\omega_n$ = {{live:wn0}} rad/s. The app reports $\zeta$ = {{live:zeta}} and $\omega_n$ = {{live:wn}} rad/s. The difference comes from the sample-and-hold delay of section 3, which the app's exact discrete model includes.

The app does not use these formulas. `anGains` reads the gains from the controller code itself. It places the robot at $e = \pm h$ and $\theta_e = \pm h$ ($h = 10^{-3}$) in a sandboxed copy of the simulator and runs one controller step. The gains are the central differences $K_e = -\Delta\omega/\Delta e$ and $K_\theta = -\Delta\omega/\Delta\theta_e$. For pure pursuit the two methods agree to three digits. The numerical route also works for rear-wheel feedback, Stanley and the MPC, whose gains are harder to write in closed form. For the car-like robot the same differences are taken on $\delta$, and the plant gets $g = v_0/L$ instead of 1.

## 3. The open loop L(s), with the clock in it

The loop transfer function that the app plots is the PD law times the double integrator, times three factors that act like delays. All three are modelled at the loop's rate of 20 Hz. They are a half-sample hold delay, an optional command latency and an optional first-order actuator lag. The margins depend on these factors more than on anything else.

<svg class="notes-fig" viewBox="0 0 760 276" role="img" aria-label="The linear loop: controller, latency and actuator lag, hold, two integrators">
<defs><marker id="nf-arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
<g fill="none" stroke="var(--muted)" stroke-width="1.25" marker-end="url(#nf-arrow3)"><path d="M24 116H52"/><path d="M84 116H110"/><path d="M270 116H280"/><path d="M430 116H438"/><path d="M502 116H522"/><path d="M608 116H628"/><path d="M712 116H740"/><path d="M618 116V206H210V141"/><path d="M726 116V240H68V133"/></g>
<circle cx="68" cy="116" r="16" fill="none" stroke="var(--muted)" stroke-width="1.25"/><text x="68" y="122" text-anchor="middle" font-size="18" fill="var(--ink)">Σ</text><text x="80" y="148" font-size="15" fill="var(--muted)">−</text>
<text x="24" y="104" font-size="15" fill="var(--muted)">r</text>
<rect x="110" y="92" width="160" height="48" rx="8" fill="var(--accent)" fill-opacity="0.12" stroke="var(--accent)" stroke-width="2"/><text x="190" y="121" text-anchor="middle" font-weight="600" font-size="16" fill="var(--ink)">Controller</text>
<rect x="280" y="92" width="150" height="48" rx="8" fill="none" stroke="var(--muted)" stroke-width="1.25"/><text x="355" y="121" text-anchor="middle" font-weight="600" font-size="16" fill="var(--ink)">Latency, actuator</text>
<rect x="438" y="92" width="64" height="48" rx="8" fill="none" stroke="var(--muted)" stroke-width="1.25"/><text x="470" y="121" text-anchor="middle" font-weight="600" font-size="16" fill="var(--ink)">Hold</text>
<rect x="522" y="92" width="86" height="48" rx="8" fill="none" stroke="var(--muted)" stroke-width="1.25"/><text x="565" y="121" text-anchor="middle" font-weight="600" font-size="16" fill="var(--ink)">Heading</text>
<rect x="628" y="92" width="84" height="48" rx="8" fill="none" stroke="var(--muted)" stroke-width="1.25"/><text x="670" y="121" text-anchor="middle" font-weight="600" font-size="16" fill="var(--ink)">Lateral</text>
<text x="734" y="104" font-size="15" fill="var(--muted)">e</text>
<g font-size="14" fill="var(--ink)" text-anchor="middle"><text x="190" y="166">u = −(Ke·e + Kθ·θe)</text><text x="355" y="166">z^−nL · a/(1 − (1−a)z⁻¹)</text><text x="470" y="166">e^−sT/2</text><text x="565" y="166">g / s</text><text x="670" y="166">v₀ / s</text></g>
<text x="414" y="200" text-anchor="middle" font-size="14" fill="var(--muted)">θe, read by the controller one tick later</text>
<text x="397" y="260" text-anchor="middle" font-size="14" fill="var(--muted)">e, read by the controller one tick later</text>
</svg>

The controller runs every $T$ = 50 ms and holds its output constant until the next tick, so the continuous vehicle sees a staircase. This zero-order hold has the transfer function $(1 - e^{-sT})/(sT)$. Up to well past the crossover frequency it behaves like a pure delay of half a sample, and the app uses that delay on the frequency plots:

$$
H(s) = \frac{1-e^{-sT}}{sT} \approx e^{-sT/2}
$$

The actuator lag and the latency run inside the 20 Hz loop as difference equations. The actuator lag in `vehicle.js` is $w_a[k] = w_a[k-1] + a\,(w_c[k] - w_a[k-1])$ with $a = 1 - e^{-T/\tau}$. This is the discrete-time equivalent of a first-order lag with time constant $\tau$. A latency of $n_L$ samples is a queue of $n_L$ commands. Both have transfer functions that are rational in $z$. A delay of one sample is $e^{-sT}$, so substituting $z = e^{sT}$ evaluates a discrete element on the frequency axis with no approximation. The app does this instead of approximating the lag by $1/(\tau s + 1)$. The Bode plot is therefore exact up to the Nyquist frequency $\omega_N = \pi/T$ = 62.8 rad/s, where the plots stop.

$$
A(z) = z^{-n_L}\,\frac{a}{1-(1-a)\,z^{-1}},\qquad a = 1-e^{-T/\tau},\qquad z = e^{sT}
$$

Putting the pieces together, with the controller's two gains acting on $\theta_e = g u/s$ and $e = g v_0 u/s^2$:

$$
L(s) = A\!\left(e^{sT}\right)\, e^{-sT/2}\, g\,\frac{K_e v_0 + K_\theta\, s}{s^2}
$$

`Lparts` in `analysis/model.js` evaluates this at $s = j\omega$ for 700 frequencies between 0.01 rad/s and $\omega_N$. The numerator $K_e v_0 + K_\theta s$ has a zero at $s = -K_e v_0/K_\theta = -v_0/L_d$ ({{live:zero}} rad/s now). That zero is the controller's only source of phase lead. Below it the loop is a pure double integrator at −180°. Above it the heading term lifts the phase towards −90°, and the delays pull it back down as $\omega$ grows. The phase margin depends on where in that range the magnitude crosses 1.

[try: Add 0.3 s of latency | {"level":0,"set":{"ctl":"pp","latency":0.3}}] [try: Actuator lag 0.3 s | {"level":0,"set":{"ctl":"pp","lag":0.3}}] [try: Both | {"level":0,"set":{"ctl":"pp","latency":0.2,"lag":0.3}}]

For the time responses and the poles the app does not use $L(s)$ at all. It builds the exact discrete closed loop at the simulation rate (`stepLin`). With the input held for one sample, the double integrator advances by

$$
\theta_e[k+1] = \theta_e[k] + g\,T\,u[k]
$$

$$
e[k+1] = e[k] + v_0\Big(T\,\theta_e[k] + \tfrac12 g\,T^2 u[k]\Big)
$$

with the lag state, the latency queue and the controller's one-tick-old readings of $e$ and $\theta_e$ as further states. The state vector steps forward as $x[k+1] = A_{cl}\,x[k]$. The closed-loop poles are the eigenvalues $z_i$ of $A_{cl}$, mapped back to continuous time by $s_i = \ln(z_i)/T$. The step and bias responses are this recursion run for a few seconds. The discrete model includes the hold without approximation, so its poles differ slightly from those of the $e^{-sT/2}$ approximation. The difference is smaller than the precision the view shows.

## 4. Reading the margins

Every chip in the first row of the Analyze view describes $L(j\omega)$ near the point −1. Each says how far the loop is from a gain or a phase that would make $1 + L(j\omega) = 0$. At that point the closed loop would ring forever.

The closed loop from a path offset $r$ to the error $e$ is $L/(1+L)$. The sensitivity $S = 1/(1+L)$ says how much a disturbance at the output is attenuated. Both become infinite where $L(j\omega) = -1$, so what matters is how far the curve $L(j\omega)$ stays from −1. The chips measure that distance in four ways.

**Crossover and phase margin.** The crossover frequency $\omega_c$ is where $|L(j\omega_c)| = 1$. The phase margin is how much phase lag could be added there before the curve passed through −1:

$$
|L(j\omega_c)| = 1,\qquad \text{PM} = 180^\circ + \arg L(j\omega_c)
$$

For the pure-pursuit loop with only the hold delay, $|L| = \sqrt{(K_e v_0)^2 + (K_\theta\omega)^2}/\omega^2$, so $\omega_c$ solves $\omega^4 - K_\theta^2\omega^2 - (K_e v_0)^2 = 0$. With your gains that gives {{live:wc0}} rad/s. The phase there has three parts. The two integrators give −180°. The zero adds a lead of $\arctan(K_\theta\omega_c/K_e v_0)$ = {{live:lead0}}°. The hold delay takes away $\omega_c T/2$ = {{live:holdlag0}}°. So PM = {{live:pm0}}°. The Analyze view also includes your latency and lag, and it reports $\omega_c$ = {{live:wc}} rad/s and PM = {{live:pm}}°. The app finds $\omega_c$ by interpolating the sampled $|L|$ across 1 on a log scale. If the magnitude crosses 1 more than once, it reports the smallest margin.

**Delay margin.** A pure delay $T_d$ subtracts $\omega T_d$ radians of phase at every frequency without changing the magnitude. So the loop reaches −1 when $\omega_c T_d$ equals the phase margin:

$$
T_{d,\max} = \frac{\text{PM (rad)}}{\omega_c}
$$

{{live:dm}} s with your settings. For a robot this is the most useful chip. It says how many seconds of extra latency the loop can take before it rings without stopping. Lesson 5 of the control-loop group runs the experiment. It sets Latency in the Vehicle tab to this value, and the Nyquist curve touches −1.

[try: Latency at the delay margin | {"level":0,"set":{"ctl":"pp","latency":0.55}}]

**Gain margin.** The gain margin is the factor by which the loop gain can grow before the magnitude reaches 1. It is read at the frequency $\omega_{180}$ where the phase is −180°:

$$
\arg L(j\omega_{180}) = -180^\circ,\qquad \text{GM} = -20\log_{10}|L(j\omega_{180})|\ \text{dB}
$$

With only the hold delay, the phase returns to −180° where the lead of the zero equals the lag of the delay, $\arctan(K_\theta\omega/K_e v_0) = \omega T/2$. This happens near the Nyquist frequency. The view reports GM = {{live:gm}} dB at $\omega_{180}$ = {{live:w180}} rad/s. With a gain margin this large, the gain does not limit this loop. The delay does. When the app finds the loop unstable (an encirclement, see below), it reports a negative gain margin instead. That is how far the gain must be reduced to make the loop stable again.

**Sensitivity peak** $M_s$. The phase margin and the gain margin each test one point of the curve. The sensitivity peak tests the whole curve:

$$
M_s = \max_\omega \frac{1}{|1 + L(j\omega)|}
$$

$1/M_s$ is the radius of the largest circle around −1 that the Nyquist curve stays outside. The Nyquist plot draws this circle. It gives a lower bound for both classical margins, $\text{GM} \ge M_s/(M_s - 1)$ and $\text{PM} \ge 2\arcsin(1/2M_s)$. The usual target for a well-damped loop is a value under about 1.5. Now $M_s$ = {{live:ms}}. On the compressed Nyquist plot the app rescales the radius as $\log_2(1 + |L|)$. For a double integrator the low-frequency part of the curve runs off to infinity, and the rescaling brings it onto the page. A point with $|L| = 1$ keeps its radius, so −1 and the unit circle stay where they are.

**The Nyquist count.** The margins only mean something if the closed loop is stable in the first place, and the Nyquist criterion checks that. Let $P$ be the number of open-loop poles in the right half-plane. Here $P = 0$, because the two integrators sit on the imaginary axis, not in the right half-plane. Let $N$ be the number of clockwise encirclements of −1 by $L(s)$ as $s$ runs up the imaginary axis and around the right half-plane. The number of unstable closed-loop poles is

$$
Z = N + P
$$

The contour has to pass around the two poles at the origin. The app (`anFreq`) moves $s$ along a small semicircle of radius $10^{-3}$ around the origin, on the side of the right half-plane, and then up the axis to $10^5$ rad/s. Along the way it adds up the change in $\arg(1 + L)$. The lower half of the contour is the mirror image of the upper half, so the total is twice the upper half plus the arc. $N$ is that total divided by −2π. The chip prints $N$, $P$ and $Z$. $Z = 0$ means the closed loop is stable, and then the poles of section 5 all lie in the left half-plane. With your settings: {{live:nyq}}.

## 5. Poles, damping and the shape of the response

The second row of chips comes from two sources. One is the closed-loop poles. With your settings the dominant pair is at $s$ = {{live:dom}}, which means $\zeta$ = {{live:zeta}} and $\omega_n$ = {{live:wn}} rad/s. The other source is the discrete loop, run forward in time.

**From eigenvalues to poles.** The closed-loop matrix $A_{cl}$ of section 3 has one eigenvalue per state. The states are the two vehicle integrators, the actuator state, and one state per sample of delay. Each eigenvalue $z_i$ maps to a continuous pole by $s_i = \ln(z_i)/T$, so $|z_i| < 1$ is the same test as $\operatorname{Re} s_i < 0$. The app marks the loop unstable when any $|z_i|$ exceeds 1. The delay states give eigenvalues at or near zero, which are poles far to the left. The dominant pole is the one with the largest real part among those that are not pure delays. For a complex pair the app reports

$$
\omega_n = |s_i|,\qquad \zeta = -\frac{\operatorname{Re} s_i}{\omega_n}
$$

Without the delays the characteristic equation of section 2 gives $\omega_n = \sqrt 2\,v_0/L_d$ = {{live:wn0}} rad/s and $\zeta = 1/\sqrt 2$ exactly. The hold delay moves the pair a little and leaves the damping at 0.707 to the precision shown. Latency and lag move it a lot.

**Overshoot and settling.** The time-response plot shows $e(t)$ after a lateral offset with the heading aligned, $e(0) = 1$, $\theta_e(0) = 0$. For a second-order loop that initial condition gives

$$
e(t) = e^{-\zeta\omega_n t}\Big(\cos\omega_d t + \frac{\zeta}{\sqrt{1-\zeta^2}}\sin\omega_d t\Big),\quad \omega_d = \omega_n\sqrt{1-\zeta^2}
$$

Its first minimum is at $\omega_d t = \pi$, where $e = -\exp(-\pi\zeta/\sqrt{1-\zeta^2})$. At $\zeta$ = {{live:zeta}} that is an overshoot of {{live:os0}}% of the initial offset, and the app's overshoot chip says {{live:os}}%. The 2% settling time is the moment $|e|$ last leaves a ±0.02 band. The envelope $e^{-\zeta\omega_n t}$ alone would put it at $4/(\zeta\omega_n)$ = {{live:settle0}} s, since $e^{-4} \approx 0.02$. The exact recursion gives {{live:settle}} s. The app reads both of its numbers off the simulated response, not from the formulas. They therefore stay right for the PID and MPC loops, where the second-order picture is only approximate.

[try: Run the step test | {"level":0,"set":{"ctl":"pp"},"test":"step","stepKind":"offset","stepAmp":0.2}]

**Steady error under a bias.** The second time response adds a constant disturbance $b$ at the plant input. For the unicycle it is one motor slightly weaker than the other (0.1 rad/s of unwanted yaw rate). For the car it is a wheel misalignment (2°). In steady state the errors no longer change. Then $\dot e = 0$ gives $\theta_e = 0$, and the controller must hold $u = -K_e e$ against the bias:

$$
g\,(-K_e\,e_{ss} + b) = 0\quad\Rightarrow\quad e_{ss} = \frac{b}{K_e}
$$

{{live:ess}} cm for 0.1 rad/s with your $K_e$. Pure pursuit has no integrator, so it keeps a permanent offset of $b L_d^2/(2v_0)$ as it drives. On the car the same equation holds, with $u$ the steering angle and $b$ a steering misalignment (Analyze uses 2°, $b$ = 0.0349 rad). There $g = v_0/L$ cancels, and $e_{ss} = b/K_e$ with $K_e$ in radians of steering per metre. For pure pursuit that is $b L_d^2/(2L)$. The offset grows with the square of the lookahead. The PID controller with $k_i > 0$ adds an integrator, which removes the offset. The MPC's rate input is itself an integrator, so the MPC removes it too. The $e_{ss}$ chip shows this when you switch controllers.

[try: Bias response, pure pursuit | {"level":0,"set":{"ctl":"pp"},"test":"step","stepKind":"bias"}] [try: Same with PID, ki = 0.5 | {"level":0,"set":{"ctl":"pid","ki":0.5},"test":"step","stepKind":"bias"}]

**The root locus.** The locus plot shows what happens to the poles when the whole controller is scaled by a factor $k$. The app recomputes the eigenvalues for 49 values of $k$ from 0.06 to 16 (`clMatrix(M, L, k)`) and plots each set in the $s$-plane. The dots trace the paths the poles follow as the gain grows. For the loop with no delay, the classical result follows directly from the characteristic equation $s^2 + k g K_\theta s + k g K_e v_0 = 0$:

$$
s = -\frac{k g K_\theta}{2} \pm \sqrt{\Big(\frac{k g K_\theta}{2}\Big)^2 - k g K_e v_0}
$$

The poles start at the origin ($k \to 0$, the open-loop double integrator) and leave it as a complex pair. They return to the real axis at $k = 4K_e v_0/(gK_\theta^2)$ = 2 for pure pursuit and then split. One runs to the zero at $-v_0/L_d$ and the other to −∞. With the delays in the model, the high-gain branch bends into the right half-plane instead of going to −∞. The app shades that region. A lookahead short enough to multiply the gain by ten puts the poles there, and the simulated robot weaves.

[try: Lookahead 0.3 m, step test | {"level":0,"set":{"ctl":"pp","ppL0":0.3,"ppK":0},"test":"step","stepKind":"offset","stepAmp":0.2}]

## 6. Worked example: what moves what

With the formulas of sections 2 to 5 you can reproduce every chip on the Analyze screen by hand. The first table does this for your current settings. For pure pursuit on the diff-drive robot with no latency or lag, the two columns agree to the digit shown. When they differ, the cause is the latency, the lag, or a controller whose gains are not the pure-pursuit ones.

| Quantity | By hand, your settings | Analyze view |
| --- | --- | --- |
| $K_e = 2v_0/L_d^2$ | {{live:Ke0}} | {{live:Ke}} |
| $K_\theta = 2v_0/L_d$ | {{live:Kth0}} | {{live:Kth}} |
| $\omega_c$ from $\omega^4 - K_\theta^2\omega^2 - (K_e v_0)^2 = 0$ | {{live:wc0}} rad/s | {{live:wc}} rad/s |
| PM = $\arctan(K_\theta\omega_c/K_e v_0) - \omega_c T/2$ | {{live:pm0}}° | {{live:pm}}° |
| Delay margin PM/$\omega_c$ | {{live:dm0}} s | {{live:dm}} s |
| $\omega_n = \sqrt 2\,v_0/L_d$, $\zeta$ | {{live:wn0}} rad/s, 0.707 | {{live:wn}} rad/s, {{live:zeta}} |
| Overshoot $\exp(-\pi\zeta/\sqrt{1-\zeta^2})$ | {{live:os0}}% | {{live:os}}% |
| 2% settling ≈ $4/(\zeta\omega_n)$ | {{live:settle0}} s | {{live:settle}} s |
| $e_{ss} = b/K_e$ for $b$ = 0.1 rad/s | {{live:ess0}} cm | {{live:ess}} cm |

The second table gives what the app reports when one parameter at a time is moved away from the L1 defaults. Each row has a button that sets it up, and the chips and the first table then show the same numbers live.

| Change | $\omega_c$ rad/s | PM | $T_{d,\max}$ s | $M_s$ | $\zeta$ | $\omega_n$ rad/s | OS | $t_s$ s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Defaults [try: Set | {"level":0,"set":{"ctl":"pp"}}] | 1.95 | 63° | 0.56 | 1.05 | 0.71 | 1.29 | 4% | 4.7 |
| Lookahead 0.4 m [try: Set | {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0.375}}] | 4.40 | 59° | 0.24 | 1.11 | 0.71 | 2.98 | 4% | 2.1 |
| Lookahead 2.0 m [try: Set | {"level":0,"set":{"ctl":"pp","ppL0":1.6}}] | 0.88 | 64° | 1.28 | 1.02 | 0.71 | 0.57 | 4% | 10.5 |
| Speed 1.5 m/s [try: Set | {"level":0,"set":{"ctl":"pp","vcruise":1.5,"vmax":1.6}}] | 2.64 | 62° | 0.41 | 1.06 | 0.71 | 1.75 | 4% | 3.5 |
| Latency 0.3 s [try: Set | {"level":0,"set":{"ctl":"pp","latency":0.3}}] | 1.95 | 29° | 0.26 | 2.30 | 0.52 | 2.24 | 8% | 3.2 |
| Latency 0.5 s [try: Set | {"level":0,"set":{"ctl":"pp","latency":0.5}}] | 1.95 | 7° | 0.06 | 10.1 | 0.08 | 2.05 | 41% | 19.8 |
| Actuator lag 0.3 s [try: Set | {"level":0,"set":{"ctl":"pp","lag":0.3}}] | 1.76 | 35° | 0.35 | 1.75 | 0.47 | 1.78 | 9% | 3.7 |

The table shows three things. First, the lookahead and the speed move the crossover but not the damping. $\zeta$ stays at 0.707 and the overshoot at 4%, because pure pursuit's two gains move together (section 2). Second, latency leaves $\omega_c$ alone, since it changes no magnitude, and takes $\omega_c T_{lat}$ radians off the phase margin. For 0.3 s that is 1.95 × 0.3 rad = 34°, and the table shows 63° falling to 29°. At 0.5 s the loop is 7° from a limit cycle. $M_s$ = 10 means that a disturbance at one frequency is amplified tenfold, and the simulated robot weaves at about $\omega_n$ = 2 rad/s, one cycle every 3 s. Third, an actuator lag costs less margin than a latency of the same length. It also lowers the magnitude, so the crossover drops a little and less phase is lost there.

The view also checks itself against the full nonlinear simulator. **Run step test** kidnaps the robot 0.2 m to one side of a straight path and records $e(t)$. It prints the measured overshoot and settling time beside the linear prediction. The two agree as long as the robot stays within the yaw-rate limit (1.8 rad/s) and the steering-rate limit, and the step is kept small for that reason. **Measure L(jω)** injects a sinusoid $u_p = A\sin\omega t$ at the plant input, between the controller and the actuator, and lets the loop respond. It then extracts the controller's output $U_c$ at the same frequency by lock-in: it multiplies the output by sin and by cos and averages over whole cycles. The controller sees only the plant's response to the sum, so $L(j\omega) = -U_c/U_p$. For all five linearizable controllers the measured points land on the model's Bode curve to within about 0.2 dB and 0.5°. The **large sine** setting shows where that agreement ends. On the diff-drive the measured gain is up to about 0.5 dB low at the lowest frequencies. On the car it is 2 to 3.5 dB low at every frequency. A 0.2 rad sine trips the trackers' dry-steering rule, which slows the car while the wheels are more than 0.1 rad from the commanded angle. A slower car means a smaller plant gain. The 1.5 rad/s steering-rate limit adds about 30° of lag, at the top frequency only. A gain that depends on the amplitude of the input is how the describing-function method treats a nonlinearity.

[try: Measure L(jω), small sine | {"level":0,"set":{"ctl":"pp"},"test":"inj","injAmp":"small"}] [try: Large sine | {"level":0,"set":{"ctl":"pp"},"test":"inj","injAmp":"large"}] [try: Large sine, car | {"level":5,"set":{"ctl":"rwf"},"test":"inj","injAmp":"large"}]

## 7. Where the model stops

The linear loop is exact for small errors on a straight path with a known pose. Each of the app's extensions drops one of these three conditions. Two controllers fall outside the model altogether.

**Large errors.** The linearization assumes $\sin\theta_e \approx \theta_e$ and $\ell \approx L_d$, and it leaves out the saturations: the yaw-rate limit $\omega_{max}$ = 1.8 rad/s, the steering limit 32° and the steering rate 1.5 rad/s. Once a limit is active, the loop gain is effectively lower than the model says. For a loop with good margins that is stabilizing. For a loop near a limit cycle it is destabilizing, because a rate limit adds phase lag of its own. The large-sine injection and the step test show the difference in the app, and lesson 9 of the control-loop group (linear vs nonlinear) is built on it.

**Curved paths.** On a circle of radius $R$ the plant equation gains a constant term, $\dot\theta_e = g u - v_0/R$. The controller must supply a steady $u = v_0/(gR)$ only to stay on the circle. A law with no feedforward can produce that steady command only from a steady error, so the loop settles with the robot off the path by a fixed offset. The app runs the loop to that settled state before reading the gains (`benchSettle`), reads them about the settled point, and reports the offset in the $e_{ss}$ chip. Rear-wheel feedback adds the feedforward term $\kappa_{ref}\cos\theta_e/(1 - \kappa_{ref}e)$ and settles with no offset. Pure pursuit measures its lookahead along the path and follows a circle with almost no offset. The MPC previews the reference and also settles with no offset.

[try: PID on a 2 m circle | {"level":0,"set":{"ctl":"pid"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}]

**The estimator in the loop.** The model assumes the controller sees the true $e$ and $\theta_e$. With an EKF or a particle filter in the loop, the controller sees an estimate that has dynamics of its own. A slow estimator acts like extra lag. The margin chips leave the estimator out on purpose. The **experiments use the estimator** switch runs the step test and the injection with the estimator active, so you can compare the measured curve with the model's. The gap between them is the estimator's contribution.

[try: EKF in the loop, measure L(jω) | {"level":0,"set":{"ctl":"pp","loc":"ekf","odoK":1},"useEst":true,"test":"inj"}]

**Other controllers the view linearizes.** Each of these gives a static law of the same form, so sections 3 to 5 apply with different $K_e$ and $K_\theta$:

| Controller | Law near the path | $K_e$ | $K_\theta$ | What is different |
| --- | --- | --- | --- | --- |
| Rear-wheel feedback | $\omega = v(\kappa_{ref} - k_\theta\theta_e - k_e e)$ | $v_0 k_e$ | $v_0 k_\theta$ | $\zeta = k_\theta/(2\sqrt{k_e})$ = 0.61 at the defaults, independent of speed; $\omega_n = v_0\sqrt{k_e}$ scales with speed, which is the gain-scheduling lesson |
| Stanley (car only) | $\delta = -\theta_e - \arctan\big(k e_f/(0.5 + v)\big)$ with the front-axle offset $e_f \approx e + L\theta_e$ | $k/(0.5 + v_0)$ | $1 + kL/(0.5 + v_0)$ | The 0.5 m/s softening keeps the gain finite at low speed, and the front-axle offset adds $kL/(0.5+v_0)$ to the heading gain; the app reads the gains numerically |
| PID on the pure-pursuit angle | $u = C(z)\,\alpha$, $\alpha = -(e/L_d + \theta_e)$ | $k_p/L_d$ (+ integral) | $k_p$ | $C(z) = k_p + k_i T/(1 - z^{-1}) + k_d(1 - z^{-1})/T$, evaluated at $z = e^{sT}$; $k_i > 0$ adds a third integrator and removes the bias error |
| MPC | rate $\dot u = -(K_e e + K_\theta\theta_e + K_s s + K_c s_{cmd}) + K_u\dot u_{prev}$ | read numerically | read numerically | The rate input is an integrator $T/(1 - z^{-1})$, so the loop starts at −270°; the memory term $1/(1 - K_u z^{-1})$ and the lag-model switch change what the MPC assumes about the actuator |

[try: Rear-wheel feedback | {"level":0,"set":{"ctl":"rwf"}}] [try: PID | {"level":0,"set":{"ctl":"pid"}}] [try: MPC | {"level":0,"set":{"ctl":"mpc"}}] [try: Car, Stanley | {"level":5,"set":{"ctl":"stanley"}}]

For the MPC the five gains are read by the same central differences as for pure pursuit, applied to a converged solve (25 iterations instead of the 3 the simulator uses per tick). The view analyses the MPC's local behaviour at the operating point, not its receding-horizon logic. Chapter 7 derives the MPC itself.

**Outside the model.** The DWA samples velocities and scores rollouts. It is not a function of $e$ and $\theta_e$ that a finite difference could linearize, and the Analyze view says so. Code in the controller slot is treated the same way. It runs as a black box in a worker, and the Analyze view does not linearize it, even when it is a static law whose numerical gains would exist.

## 8. Placing the poles on purpose: pole placement and LQR

Dragging a pole in the Analyze view and reading off the gains is pole placement done by hand. The textbook methods do the same from numbers. For the loop with two integrators, both pole placement and LQR have closed-form solutions. Take the delay-free loop of §1 with a law of the same form as rear-wheel feedback, $u = -K_e e - K_\theta \theta_e$. Its characteristic polynomial is

$$
s^2 + g K_\theta\, s + g v_0 K_e = 0 .
$$

**Pole placement.** Ask for a pair with damping $\zeta$ and natural frequency $\omega_n$, whose polynomial is $s^2 + 2\zeta\omega_n s + \omega_n^2$, and match the coefficients:

$$
K_e = \frac{\omega_n^2}{g v_0}, \qquad K_\theta = \frac{2\zeta\omega_n}{g} .
$$

There are two gains for two coefficients, so the answer is unique. Rear-wheel feedback has two independent gains and can put its pair anywhere. A tracker with one knob can only move its pair along a curve (§2). The answer holds only for the delay-free loop. The hold, the latency and the actuator lag add phase lag. The pair the full loop actually has therefore sits to the right of the one asked for, with less damping. The faster the pair, the larger the shift. This is §4's delay margin seen on the pole plot. The design row under the pole plot does this computation and then shows where the pair actually lands.

**LQR.** The linear-quadratic regulator starts from a cost instead of from poles, and the poles follow from the cost. For the plant $\dot x = Ax + Bu$ with $x = (e, \theta_e)$,

$$
A = \begin{pmatrix} 0 & v_0 \\ 0 & 0 \end{pmatrix}, \quad B = \begin{pmatrix} 0 \\ g \end{pmatrix}, \quad J = \int_0^\infty q_e e^2 + q_\theta \theta_e^2 + r u^2\, \mathrm dt,
$$

the optimal feedback is $u = -R^{-1}B^{\mathsf T}P\,x$. Here $Q = \operatorname{diag}(q_e, q_\theta)$ and $R = r$ are the weights of the cost, and $P$ is the symmetric solution of the algebraic Riccati equation $A^{\mathsf T}P + PA - PBR^{-1}B^{\mathsf T}P + Q = 0$. Write $P = \begin{pmatrix} p_1 & p_2 \\ p_2 & p_3 \end{pmatrix}$. The Riccati equation then becomes three scalar equations:

$$
-\frac{g^2}{r} p_2^2 + q_e = 0, \qquad v_0 p_1 - \frac{g^2}{r} p_2 p_3 = 0, \qquad 2 v_0 p_2 - \frac{g^2}{r} p_3^2 + q_\theta = 0 ,
$$

The first gives $p_2 = \sqrt{q_e r}/g$, and the third then gives $p_3 = \sqrt{r(2 v_0 p_2 + q_\theta)}/g$. Both take the positive root, so that $P$ is positive definite. The gains $K = (g/r)(p_2, p_3)$ are

$$
K_e = \sqrt{\frac{q_e}{r}}, \qquad K_\theta = \sqrt{\frac{q_\theta}{r} + \frac{2 v_0}{g}\sqrt{\frac{q_e}{r}}} .
$$

The formulas show three things. First, only the ratios $q_e/r$ and $q_\theta/r$ matter, so scaling the whole cost changes nothing. Second, with $q_\theta = 0$ the damping is $\zeta = 1/\sqrt 2$ for any weights. You can check this by substituting the gains into the polynomial. Pure pursuit has the same damping and cannot change it. The reason is a general result: a double integrator with the cheapest possible control always settles on the Butterworth pair, $\zeta = 1/\sqrt 2$, with 4.3 % overshoot. Third, a smaller $r$ (cheaper control) raises $\omega_n$ only as $(q_e/r)^{1/4}$. Halving the settling time doubles $\omega_n$, and that takes a $q_e/r$ sixteen times larger. For the delay-free plant, LQR guarantees a phase margin of at least 60° and an infinite gain margin. The delays take some of that back, in the same way as for a placed pair, so the margins that §4 computes are the ones to believe.

Compared with pole placement, LQR gives a reason for the pair it picks. The pair comes from a trade between tracking error and steering effort, stated as weights you can argue about. LQR knows nothing about the delays, the saturation or the curvature. Those are still handled in §4, §5 and §7.

