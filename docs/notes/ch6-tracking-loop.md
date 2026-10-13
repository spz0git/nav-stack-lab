id: ch6
num: 6
sys: ctl
summary: Where every chip in the Analyze view comes from: the linear loop behind pure pursuit, its margins, poles and responses, with live numbers from your current settings.

# The lateral tracking loop

The Analyze view shows a phase margin, a delay margin, $M_s$ and a pair of dominant poles the moment you open it. Everything on that screen follows from one linear model with two states, derived here. The numbers in this chapter are live: they are computed from the parameters you have set now (controller **{{live:ctl}}**, $v_0$ = {{live:v0}} m/s), so change a slider in the Control or Vehicle tab and read again.

## 1. The vehicle in path coordinates

Near a path the robot is described by two numbers, the lateral error $e$ and the heading error $\theta_e$, and two first-order equations connect them to what the controller commands.

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

Rewrite the pose relative to the path. Let $s$ be the arc length of the foot of the perpendicular from the robot to the path, $\theta_p(s)$ the path tangent angle and $\kappa_p(s)$ its curvature. With $e$ the signed distance to the left of the path and $\theta_e = \theta - \theta_p$, the Frenet form of the kinematics is

$$
\dot e = v\sin\theta_e,\qquad \dot\theta_e = \dot\theta - \kappa_p\,\dot s,\qquad \dot s = \frac{v\cos\theta_e}{1-\kappa_p e}
$$

On a straight path $\kappa_p = 0$ and the second equation is just $\dot\theta_e = \dot\theta$. Linearize about $e = 0$, $\theta_e = 0$, $v = v_0$ (small angles) and write $u$ for the steering input, $\omega$ for the unicycle or $\delta$ for the bicycle:

$$
\dot e = v_0\,\theta_e,\qquad \dot\theta_e = g\,u,\qquad g = 1\ \text{(unicycle)}\ \ \text{or}\ \ g = \frac{v_0}{L}\ \text{(bicycle)}
$$

In the Laplace domain this is a chain of two integrators from the input to the lateral error:

$$
\theta_e(s) = \frac{g}{s}\,u(s),\qquad e(s) = \frac{g\,v_0}{s^2}\,u(s)
$$

The double integrator fixes the shape of every Bode plot in the app before any controller is chosen: −40 dB per decade of magnitude and −180° of phase at every frequency. A controller has to add phase back, which is what the heading term does in the next section.

The operating speed is $v_0 = \min(v_{cruise}, v_{max})$, {{live:v0}} m/s now. The Curve R 4 m and Curve R 2 m buttons in the Analyze view change the operating point to a circle: $\dot\theta_e = \omega - v_0/R$ then carries a constant the controller must cancel, the loop settles on the circle before the gains are read, and the offset chip reports the steady $e$ the settled loop keeps.

## 2. Pure pursuit is a PD controller in disguise

Linearized about the path, pure pursuit commands $\omega = -K_e\,e - K_\theta\,\theta_e$ with $K_e = 2v_0/L_d^2$ and $K_\theta = 2v_0/L_d$. With your lookahead $L_d$ = {{live:Ld}} m and $v_0$ = {{live:v0}} m/s that is $K_e$ = {{live:Ke0}} and $K_\theta$ = {{live:Kth0}}; the Analyze view, which reads the gains from the code, shows {{live:Ke}} and {{live:Kth}}.

[try: Pure pursuit, L1 defaults | {"level":0,"set":{"ctl":"pp"}}] [try: Lookahead 0.4 m | {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0.375}}] [try: Lookahead 2 m | {"level":0,"set":{"ctl":"pp","ppL0":1.6}}]

The controller as the app runs it (`ctlPP` in `core/controllers.js`): take the path point a lookahead distance $L_d$ beyond the foot of the perpendicular, the carrot; measure the angle $\alpha$ from the heading to the carrot and the straight-line distance $\ell$ to it; drive along the circular arc through the robot that is tangent to the heading and passes through the carrot. The chord $\ell$ subtends $2\alpha$ at that circle's centre, so its curvature is

$$
\kappa = \frac{2\sin\alpha}{\ell},\qquad \omega = v\,\kappa\ \text{(unicycle)},\qquad \delta = \arctan(L\,\kappa)\ \text{(bicycle)}
$$

The lookahead grows with speed, $L_d = L_0 + k_v|v|$, so faster driving looks further ahead and turns more gently. The speed is also capped by lateral acceleration, $v \le \sqrt{a_{lat}/|\kappa|}$, and by the yaw-rate limit; both are inactive near the path, so the linear model ignores them.

To linearize, put the robot at $(0, e)$ in path coordinates with heading $\theta_e$. The foot is at the origin and the carrot at $(L_d, 0)$, so the direction to it is $\operatorname{atan2}(-e, L_d) \approx -e/L_d$ and

$$
\alpha = -\frac{e}{L_d} - \theta_e,\qquad \ell = \sqrt{L_d^2+e^2}\approx L_d,\qquad \kappa \approx \frac{2\alpha}{L_d} = -\frac{2e}{L_d^2} - \frac{2\theta_e}{L_d}
$$

Multiplying by $v_0$ gives the yaw-rate law and its two gains:

$$
\omega = -K_e\,e - K_\theta\,\theta_e,\qquad K_e = \frac{2v_0}{L_d^2},\qquad K_\theta = \frac{2v_0}{L_d}
$$

Since $\dot e = v_0\theta_e$, the heading term is a derivative term on the lateral error: $\omega = -K_e e - (K_\theta/v_0)\,\dot e$. Pure pursuit is a PD controller on $e$ whose gains are set by one knob, the lookahead. A shorter $L_d$ raises both gains; the proportional gain rises as $1/L_d^2$, the derivative gain only as $1/L_d$, so shortening the lookahead trades damping for stiffness. That is the whole reason a short lookahead oscillates.

Closing the loop on the double integrator of section 1, without any delay, gives the characteristic equation and the textbook second-order parameters:

$$
s^2 + g K_\theta\,s + g K_e v_0 = 0
$$

$$
\omega_n = \sqrt{g K_e v_0} = \frac{\sqrt 2\,v_0}{L_d},\qquad \zeta = \frac{g K_\theta}{2\omega_n} = \frac{1}{\sqrt 2}
$$

For the unicycle the damping ratio is $1/\sqrt 2 = 0.707$ whatever the lookahead or the speed; only the natural frequency moves, $\omega_n$ = {{live:wn0}} rad/s with your settings. The app reports $\zeta$ = {{live:zeta}} and $\omega_n$ = {{live:wn}} rad/s: the difference is the sample-and-hold delay of section 3, which the exact discrete model includes.

The app does not use these formulas. `anGains` reads the gains from the controller code itself: it places the robot at $e = \pm h$ and $\theta_e = \pm h$ ($h = 10^{-3}$) in a sandboxed copy of the simulator, runs one controller step, and takes the central difference $K_e = -\Delta\omega/\Delta e$, $K_\theta = -\Delta\omega/\Delta\theta_e$. The two methods agree to three digits for pure pursuit; the numerical route also works for rear-wheel feedback, Stanley and the MPC, whose closed-form gains are less tidy. For the car-like robot the same differences are taken on $\delta$ and $g = v_0/L$ enters the plant instead.

## 3. The open loop L(s), with the clock in it

The loop transfer function the app plots is the PD law times the double integrator, with three delay-like factors that come from running at 20 Hz: a half-sample hold delay, an optional command latency, and an optional first-order actuator lag. The margins depend on these factors more than on anything else.

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

The controller runs every $T$ = 50 ms and its output is held constant until the next tick, so the continuous vehicle sees a staircase. A zero-order hold has the transfer function $(1 - e^{-sT})/(sT)$; up to well past the crossover frequency this behaves like a pure delay of half a sample, which is what the app uses on the frequency plots:

$$
H(s) = \frac{1-e^{-sT}}{sT} \approx e^{-sT/2}
$$

Two elements run inside the 20 Hz loop as difference equations. The actuator lag in `vehicle.js` is $w_a[k] = w_a[k-1] + a\,(w_c[k] - w_a[k-1])$ with $a = 1 - e^{-T/\tau}$, the discrete-time equivalent of a first-order lag with time constant $\tau$; a latency of $n_L$ samples is a queue of $n_L$ commands. Their transfer functions are rational in $z$, and on the frequency axis a discrete element is evaluated exactly by substituting $z = e^{sT}$, since a delay of one sample is exactly $e^{-sT}$. The app does this rather than approximating the lag by $1/(\tau s + 1)$, so the Bode plot is exact up to the Nyquist frequency $\omega_N = \pi/T$ = 62.8 rad/s, where the plots stop.

$$
A(z) = z^{-n_L}\,\frac{a}{1-(1-a)\,z^{-1}},\qquad a = 1-e^{-T/\tau},\qquad z = e^{sT}
$$

Putting the pieces together, with the controller's two gains acting on $\theta_e = g u/s$ and $e = g v_0 u/s^2$:

$$
L(s) = A\!\left(e^{sT}\right)\, e^{-sT/2}\, g\,\frac{K_e v_0 + K_\theta\, s}{s^2}
$$

This is what `Lparts` in `analysis/model.js` evaluates at $s = j\omega$ for 700 frequencies between 0.01 rad/s and $\omega_N$. The numerator $K_e v_0 + K_\theta s$ has a zero at $s = -K_e v_0/K_\theta = -v_0/L_d$ ({{live:zero}} rad/s now), and that zero is the controller's only source of phase lead: below it the loop is a pure double integrator at −180°, above it the heading term lifts the phase toward −90°, and the delays pull it back down as $\omega$ grows. Where the magnitude crosses 1 in that window decides the phase margin.

[try: Add 0.3 s of latency | {"level":0,"set":{"ctl":"pp","latency":0.3}}] [try: Actuator lag 0.3 s | {"level":0,"set":{"ctl":"pp","lag":0.3}}] [try: Both | {"level":0,"set":{"ctl":"pp","latency":0.2,"lag":0.3}}]

For the time responses and the poles the app does not use $L(s)$ at all. It builds the exact discrete closed loop at the simulation rate (`stepLin`): with the input held over one sample, the double integrator advances by

$$
\theta_e[k+1] = \theta_e[k] + g\,T\,u[k]
$$

$$
e[k+1] = e[k] + v_0\Big(T\,\theta_e[k] + \tfrac12 g\,T^2 u[k]\Big)
$$

with the lag state, the latency queue and the controller's one-tick-old readings of $e$ and $\theta_e$ as further states. The state vector steps forward as $x[k+1] = A_{cl}\,x[k]$, and the closed-loop poles are the eigenvalues $z_i$ of $A_{cl}$, mapped back to continuous time by $s_i = \ln(z_i)/T$. The step and bias responses are that recursion run for a few seconds. Because this discrete model includes the hold exactly, its poles differ slightly from the $e^{-sT/2}$ approximation; the two agree to the precision shown in the view.

## 4. Reading the margins

Every chip in the first row of the Analyze view is a property of $L(j\omega)$ near the point −1: how far the loop is from the gain or the phase that would make $1 + L(j\omega) = 0$ and the closed loop ring forever.

The closed loop from a path offset $r$ to the error $e$ is $L/(1+L)$, and the sensitivity $S = 1/(1+L)$ describes how a disturbance at the output is attenuated. Both blow up where $L(j\omega) = -1$, so the distance of the curve $L(j\omega)$ from −1 is the whole story. The chips measure it in four ways.

**Crossover and phase margin.** The crossover frequency $\omega_c$ is where $|L(j\omega_c)| = 1$, and the phase margin is how much phase lag could be added there before the curve passed through −1:

$$
|L(j\omega_c)| = 1,\qquad \text{PM} = 180^\circ + \arg L(j\omega_c)
$$

For the pure-pursuit loop with only the hold delay, $|L| = \sqrt{(K_e v_0)^2 + (K_\theta\omega)^2}/\omega^2$, so $\omega_c$ solves $\omega^4 - K_\theta^2\omega^2 - (K_e v_0)^2 = 0$: {{live:wc0}} rad/s with your gains. The phase there is −180° from the two integrators, plus the lead of the zero, $\arctan(K_\theta\omega_c/K_e v_0)$ = {{live:lead0}}°, minus the hold delay $\omega_c T/2$ = {{live:holdlag0}}°: PM = {{live:pm0}}°. The Analyze view, which also carries your latency and lag, says $\omega_c$ = {{live:wc}} rad/s and PM = {{live:pm}}°. The app finds $\omega_c$ by interpolating the sampled $|L|$ across 1 on a log scale and takes the smallest margin if the magnitude crosses 1 more than once.

**Delay margin.** A pure delay $T_d$ subtracts $\omega T_d$ radians of phase at every frequency without changing the magnitude, so the loop reaches −1 when $\omega_c T_d$ equals the phase margin:

$$
T_{d,\max} = \frac{\text{PM (rad)}}{\omega_c}
$$

{{live:dm}} s with your settings. This is the most useful chip for a robot: it says how much extra latency, in seconds, the loop can absorb before it rings without stopping. Setting Latency in the Vehicle tab to that value and watching the Nyquist curve touch −1 is the experiment lesson 5 of the control-loop group runs.

[try: Latency at the delay margin | {"level":0,"set":{"ctl":"pp","latency":0.55}}]

**Gain margin.** The gain margin is the factor by which the loop gain can grow before the magnitude reaches 1 at the frequency $\omega_{180}$ where the phase is −180°:

$$
\arg L(j\omega_{180}) = -180^\circ,\qquad \text{GM} = -20\log_{10}|L(j\omega_{180})|\ \text{dB}
$$

With only the hold delay, the phase returns to −180° where the lead of the zero equals the delay lag, $\arctan(K_\theta\omega/K_e v_0) = \omega T/2$, which happens near the Nyquist frequency; the view reports GM = {{live:gm}} dB at $\omega_{180}$ = {{live:w180}} rad/s. A margin that large means the gain is not what limits this loop; the delay is. When the app finds the loop unstable (an encirclement, below) it reports a negative gain margin instead, the reduction needed to recover stability.

**Sensitivity peak** $M_s$. The phase and gain margins each probe one point of the curve. The sensitivity peak probes all of it:

$$
M_s = \max_\omega \frac{1}{|1 + L(j\omega)|}
$$

$1/M_s$ is the radius of the largest circle about −1 the Nyquist curve stays outside, drawn on the Nyquist plot. It bounds both classical margins, $\text{GM} \ge M_s/(M_s - 1)$ and $\text{PM} \ge 2\arcsin(1/2M_s)$, and a value under about 1.5 is the usual target for a well-damped loop; $M_s$ = {{live:ms}} now. On the compressed Nyquist plot the app rescales the radius as $\log_2(1 + |L|)$ so the low-frequency part, which runs off to infinity for a double integrator, fits on the page while −1 and the unit circle stay where they are.

**The Nyquist count.** The margins only mean what they say if the closed loop is stable to begin with, and the Nyquist criterion settles that. Let $P$ be the number of open-loop poles in the right half-plane ($P = 0$ here: the two integrators sit on the axis, not in the right half-plane) and $N$ the number of clockwise encirclements of −1 by $L(s)$ as $s$ runs up the imaginary axis and around the right half-plane. The number of unstable closed-loop poles is

$$
Z = N + P
$$

The two poles at the origin need an indentation: the app walks $s$ along a small semicircle of radius $10^{-3}$ around the origin into the right half-plane, then up the axis to $10^5$ rad/s, and accumulates the change of $\arg(1 + L)$ along the way (`anFreq`). The lower half of the contour is the mirror image, so the total is twice the upper half plus the arc, and $N$ is that total divided by −2π. The chip prints $N$, $P$ and $Z$; $Z = 0$ means stable, and then the poles of section 5 all sit in the left half-plane. With your settings: {{live:nyq}}.

## 5. Poles, damping and the shape of the response

The second row of chips comes from the closed-loop poles, a dominant pair at $s$ = {{live:dom}} with your settings, which is $\zeta$ = {{live:zeta}} and $\omega_n$ = {{live:wn}} rad/s, and from running the discrete loop forward in time.

**From eigenvalues to poles.** The closed-loop matrix $A_{cl}$ of section 3 has one eigenvalue per state: the two vehicle integrators, the actuator state, and one per sample of delay. Each eigenvalue $z_i$ maps to a continuous pole by $s_i = \ln(z_i)/T$, so $|z_i| < 1$ is the same test as $\operatorname{Re} s_i < 0$. The app marks the loop unstable when any $|z_i|$ exceeds 1. The delay states contribute eigenvalues at or near zero (poles far to the left); the dominant pole is the one with the largest real part among those that are not pure delays, and for a complex pair the app reports

$$
\omega_n = |s_i|,\qquad \zeta = -\frac{\operatorname{Re} s_i}{\omega_n}
$$

Without the delays the characteristic equation of section 2 gives $\omega_n = \sqrt 2\,v_0/L_d$ = {{live:wn0}} rad/s and $\zeta = 1/\sqrt 2$ exactly. The hold delay moves the pair a little and leaves the damping at 0.707 to the precision shown; latency and lag move it a lot.

**Overshoot and settling.** The time-response plot shows $e(t)$ after a lateral offset with the heading aligned, $e(0) = 1$, $\theta_e(0) = 0$. For a second-order loop that initial condition gives

$$
e(t) = e^{-\zeta\omega_n t}\Big(\cos\omega_d t + \frac{\zeta}{\sqrt{1-\zeta^2}}\sin\omega_d t\Big),\quad \omega_d = \omega_n\sqrt{1-\zeta^2}
$$

Its first minimum is at $\omega_d t = \pi$, where $e = -\exp(-\pi\zeta/\sqrt{1-\zeta^2})$: {{live:os0}}% of the initial offset at $\zeta$ = {{live:zeta}}; the app's overshoot chip says {{live:os}}%. The 2% settling time is where $|e|$ last leaves a ±0.02 band; the envelope $e^{-\zeta\omega_n t}$ alone would put it at $4/(\zeta\omega_n)$ = {{live:settle0}} s, and the exact recursion says {{live:settle}} s. Both app numbers are read off the simulated response, not from the formulas, so they stay right for the PID and MPC loops where the second-order picture is only approximate.

[try: Run the step test | {"level":0,"set":{"ctl":"pp"},"test":"step","stepKind":"offset","stepAmp":0.2}]

**Steady error under a bias.** The second time response adds a constant disturbance $b$ at the plant input, one motor slightly weaker than the other for the unicycle (0.1 rad/s of unwanted yaw rate) or a wheel misalignment for the car (2°). In steady state nothing moves, so $\theta_e = 0$ and the controller must hold $u = -K_e e$ against the bias:

$$
g\,(-K_e\,e_{ss} + b) = 0\quad\Rightarrow\quad e_{ss} = \frac{b}{K_e}
$$

{{live:ess}} cm for 0.1 rad/s with your $K_e$. Pure pursuit has no integrator, so it drives along with a permanent offset of $b L_d^2/(2v_0)$. A longer lookahead makes it worse, quadratically. The PID controller with $k_i > 0$ adds an integrator and removes it; the MPC, whose rate input is itself an integrator, removes it too, which is what the $e_{ss}$ chip shows when you switch controllers.

[try: Bias response, pure pursuit | {"level":0,"set":{"ctl":"pp"},"test":"step","stepKind":"bias"}] [try: Same with PID, ki = 0.5 | {"level":0,"set":{"ctl":"pid","ki":0.5},"test":"step","stepKind":"bias"}]

**The root locus.** The locus plot answers one question: what happens to the poles if the whole controller is scaled by a factor $k$? The app recomputes the eigenvalues for 49 values of $k$ from 0.06 to 16 (`clMatrix(M, L, k)`) and plots each set in the $s$-plane, so the dots are the paths the poles follow as the gain grows. For the loop with no delay the classical result reads straight off the characteristic equation $s^2 + k g K_\theta s + k g K_e v_0 = 0$:

$$
s = -\frac{k g K_\theta}{2} \pm \sqrt{\Big(\frac{k g K_\theta}{2}\Big)^2 - k g K_e v_0}
$$

The poles start at the origin ($k \to 0$, the open-loop double integrator), leave it as a complex pair, come back to the real axis at $k = 4K_e v_0/(gK_\theta^2)$ = 2 for pure pursuit and then split: one runs to the zero at $-v_0/L_d$, the other to −∞. With the delays in the model the high-gain branch does not go to −∞; it bends into the right half-plane, which is the shaded region in the app and the reason a lookahead short enough to multiply the gain by ten makes the simulated robot weave.

[try: Lookahead 0.3 m, step test | {"level":0,"set":{"ctl":"pp","ppL0":0.3,"ppK":0},"test":"step","stepKind":"offset","stepAmp":0.2}]

## 6. Worked example: what moves what

With the formulas of sections 2 to 5 every chip on the Analyze screen can be reproduced by hand. The first table does it for your current settings; for pure pursuit on the diff-drive robot without latency or lag the two columns agree to the digit shown, and when they do not, the difference is the latency, the lag or a controller whose gains are not the pure-pursuit ones.

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

The second table is what the app reports from the L1 defaults when one parameter moves at a time. Each row has a button that sets it up, so the chips and the first table show the same numbers live.

| Change | $\omega_c$ rad/s | PM | $T_{d,\max}$ s | $M_s$ | $\zeta$ | $\omega_n$ rad/s | OS | $t_s$ s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Defaults [try: Set | {"level":0,"set":{"ctl":"pp"}}] | 1.95 | 63° | 0.56 | 1.05 | 0.71 | 1.29 | 4% | 4.7 |
| Lookahead 0.4 m [try: Set | {"level":0,"set":{"ctl":"pp","ppL0":0.1,"ppK":0.375}}] | 4.40 | 59° | 0.24 | 1.11 | 0.71 | 2.98 | 4% | 2.1 |
| Lookahead 2.0 m [try: Set | {"level":0,"set":{"ctl":"pp","ppL0":1.6}}] | 0.88 | 64° | 1.28 | 1.02 | 0.71 | 0.57 | 4% | 10.5 |
| Speed 1.5 m/s [try: Set | {"level":0,"set":{"ctl":"pp","vcruise":1.5,"vmax":1.6}}] | 2.64 | 62° | 0.41 | 1.06 | 0.71 | 1.75 | 4% | 3.5 |
| Latency 0.3 s [try: Set | {"level":0,"set":{"ctl":"pp","latency":0.3}}] | 1.95 | 29° | 0.26 | 2.30 | 0.52 | 2.24 | 8% | 3.2 |
| Latency 0.5 s [try: Set | {"level":0,"set":{"ctl":"pp","latency":0.5}}] | 1.95 | 7° | 0.06 | 10.1 | 0.08 | 2.05 | 41% | 19.8 |
| Actuator lag 0.3 s [try: Set | {"level":0,"set":{"ctl":"pp","lag":0.3}}] | 1.76 | 35° | 0.35 | 1.75 | 0.47 | 1.78 | 9% | 3.7 |

Three things to read in it. The lookahead and the speed move the crossover without touching the damping: $\zeta$ stays at 0.707 and the overshoot at 4% because, as section 2 showed, pure pursuit's two gains move together. Latency leaves $\omega_c$ alone (it changes no magnitude) and eats the phase margin at $\omega_c T_{lat}$ radians: 0.3 s costs 1.95 × 0.3 rad = 34°, and the table shows 63° falling to 29°. At 0.5 s the loop is 7° from a limit cycle and $M_s$ = 10 says a disturbance is amplified tenfold at one frequency; the simulated robot weaves at about $\omega_n$ = 2 rad/s, one cycle every 3 s. An actuator lag is in between: it lowers the magnitude too, so the crossover drops a little and the margin loss is milder than for the same latency.

The view also checks itself against the full nonlinear simulator. **Run step test** kidnaps the robot 0.2 m to one side of a straight path and records $e(t)$; its overshoot and settling time are printed beside the linear prediction, and the two agree when the yaw-rate limit (1.8 rad/s) and the steering-rate limit are not hit, which is why the step is small. **Measure L(jω)** injects a sinusoid $u_p = A\sin\omega t$ at the plant input, between the controller and the actuator, lets the loop respond, and extracts the controller's output $U_c$ at the same frequency by lock-in (multiplying by sin and cos and averaging over whole cycles). Since the controller sees only the plant's response to the sum, $L(j\omega) = -U_c/U_p$, and the measured points land on the model's Bode curve within 0.1 dB and 1° for all five linearizable controllers. Where they do not, the **large sine** setting shows the answer: a bigger injection runs into the rate limits and the measured gain drops, which is the describing-function view of the same nonlinearity.

[try: Measure L(jω), small sine | {"level":0,"set":{"ctl":"pp"},"test":"inj","injAmp":"small"}] [try: Large sine | {"level":0,"set":{"ctl":"pp"},"test":"inj","injAmp":"large"}]

## 7. Where the model stops

The linear loop is exact for small errors on a straight path with a known pose. Each of the app's extensions relaxes one of those three conditions, and two controllers fall outside the model altogether.

**Large errors.** The linearization drops $\sin\theta_e \approx \theta_e$, $\ell \approx L_d$ and the saturations: the yaw-rate limit $\omega_{max}$ = 1.8 rad/s, the steering limit 32° and the steering rate 1.5 rad/s. Once a limit is active the loop gain is effectively lower than the model says, which is stabilizing for a loop with good margins and destabilizing for one near a limit cycle: a rate limit adds phase lag of its own. The large-sine injection and the step test are the app's way of showing the difference, and lesson 9 of the control-loop group (linear vs nonlinear) is built on it.

**Curved paths.** On a circle of radius $R$ the plant equation picks up a constant, $\dot\theta_e = g u - v_0/R$, and the controller must supply a steady $u = v_0/(gR)$ just to follow. For a law with no feedforward that steady command comes from a steady error, so the loop settles with the robot off the path by a fixed offset. The app runs the loop to that settled state before reading the gains (`benchSettle`), reads them about the settled point, and reports the offset in the $e_{ss}$ chip. Rear-wheel feedback adds the feedforward term $\kappa_{ref}\cos\theta_e/(1 - \kappa_{ref}e)$ and settles with no offset; pure pursuit measures its lookahead along the path and follows a circle almost exactly; the MPC, which previews the reference, settles with none.

[try: PID on a 2 m circle | {"level":0,"set":{"ctl":"pid"},"curveR":2,"test":"step","stepKind":"offset","stepAmp":0.2}]

**The estimator in the loop.** The model assumes the controller sees the true $e$ and $\theta_e$. With an EKF or particle filter in the loop the controller sees an estimate with its own dynamics, and a slow estimator behaves like extra lag. The margin chips do not include it, by design; the **experiments use the estimator** switch runs the step test and the injection with the estimator active so the measured curve can be compared with the model's, and the gap is the estimator's contribution.

[try: EKF in the loop, measure L(jω) | {"level":0,"set":{"ctl":"pp","loc":"ekf","odoK":1},"useEst":true,"test":"inj"}]

**Other controllers the view linearizes.** Each of these gives a static law of the same form, so sections 3 to 5 apply with different $K_e$ and $K_\theta$:

| Controller | Law near the path | $K_e$ | $K_\theta$ | What is different |
| --- | --- | --- | --- | --- |
| Rear-wheel feedback | $\omega = v(\kappa_{ref} - k_\theta\theta_e - k_e e)$ | $v_0 k_e$ | $v_0 k_\theta$ | $\zeta = k_\theta/(2\sqrt{k_e})$ = 0.61 at the defaults, independent of speed; $\omega_n = v_0\sqrt{k_e}$ scales with speed, which is the gain-scheduling lesson |
| Stanley (car only) | $\delta = \theta_e + \arctan(k e/v)$ at the front axle | $k/v_0$ | 1 | Measured at the front axle, so the plant gains a zero; the app reads the gains numerically |
| PID on the pure-pursuit angle | $u = C(z)\,\alpha$, $\alpha = -(e/L_d + \theta_e)$ | $k_p v_0/L_d$ (+ integral) | $k_p$ | $C(z) = k_p + k_i T/(1 - z^{-1}) + k_d(1 - z^{-1})/T$, evaluated at $z = e^{sT}$; $k_i > 0$ adds a third integrator and removes the bias error |
| MPC | rate $\dot u = -(K_e e + K_\theta\theta_e + K_s s + K_c s_{cmd}) + K_u\dot u_{prev}$ | read numerically | read numerically | The rate input is an integrator $T/(1 - z^{-1})$, so the loop starts at −270°; the memory term $1/(1 - K_u z^{-1})$ and the lag-model switch change what the MPC assumes about the actuator |

[try: Rear-wheel feedback | {"level":0,"set":{"ctl":"rwf"}}] [try: PID | {"level":0,"set":{"ctl":"pid"}}] [try: MPC | {"level":0,"set":{"ctl":"mpc"}}] [try: Car, Stanley | {"level":5,"set":{"ctl":"stanley"}}]

For the MPC the five gains are read by the same central differences as for pure pursuit, applied to a converged solve (25 iterations instead of the 3 the simulator uses per tick), so the view analyses the MPC's local behaviour at the operating point rather than its receding-horizon logic. Chapter 7 derives the MPC itself.

**Outside the model.** The DWA samples velocities and scores rollouts; it is not a function of $e$ and $\theta_e$ that a finite difference could linearize, and the Analyze view says so. Code in the controller slot is treated the same way unless it is a static law, in which case the numerical gains work for it as well.
