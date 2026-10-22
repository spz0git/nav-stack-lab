id: ch9
num: 9
sys: 
summary: One table of the symbols the lessons and chapters share, the conventions behind them, the letters that mean two things, and the books and papers the material draws on.

# Notation and references

The lessons, the chapters and the Symbols tab use one set of symbols. This page collects them, says which conventions were chosen where textbooks differ, and lists the references. The Symbols tab under Reference has the full list with units and is searchable; this page is the short version with the reasons.

## 1. Conventions

- **Frames and angles.** The pose is $(x, y, \theta)$ in the world frame, $\theta$ counter-clockwise from $+x$. For the car the pose is the rear-axle centre. Formulas use radians; the interface shows degrees where people think in degrees (steering lock, heading error, phase margin).
- **Truth and estimate.** The true pose has no decoration; the estimate is $\mu$ (its mean) with covariance $\Sigma$, and in text "the estimate". A predicted quantity wears a hat: $\hat z$ is the reading the filter expects.
- **Noise.** Three covariances appear and they are kept apart: $M = \mathrm{diag}(\sigma_v^2, \sigma_\omega^2)$ is the odometry (input) noise, $Q = \mathrm{diag}(\sigma_r^2, \sigma_b^2)$ the measurement noise of a beacon reading, and $R$, where a chapter needs it, is process noise added directly to the state. This follows *Probabilistic Robotics* (Thrun, Burgard and Fox), where $R$ is motion noise and $Q$ measurement noise; much of the control literature swaps the two letters, so check which convention a book uses before comparing formulas.
- **Beacon readings.** A reading is $z = (r, b)$: range $r$ and bearing $b$ relative to the heading, with $\sigma_r$ and $\sigma_b$. Older versions of the Symbols tab wrote the bearing as $\varphi$; the lessons use $b$ throughout.
- **Errors in the tracking loop.** $e$ is the lateral (cross-track) error, positive to the left of the path, and $\theta_e$ the heading error, both measured from the estimate, not the truth. The trackers' gains are $K_e$ and $K_\theta$ in the loop analysis; rear-wheel feedback's own knobs are $k_e$ and $k_\theta$ in lower case because they are not the same numbers (chapter 5 §3 relates them).
- **Sampling.** The control tick is $T = 0.05$ s (20 Hz); the lidar scans at 10 Hz and the beacons at 5 Hz. In the loop analysis the tick appears as a zero-order hold, $e^{-sT/2}$ on average, and discrete elements are evaluated at $z = e^{sT}$.

## 2. Letters that mean two things

A letter is reused when the two meanings never meet in one formula. These are the ones worth knowing:

| Letter | In one place | In another |
|---|---|---|
| $g$ | the plant gain from command to heading rate (chapter 6: 1 for the unicycle, $v_0/L$ for the car) | the motion model $g(\mu, u)$ (chapter 2); gravity in $\mu g$ (chapter 1) |
| $r$ | the range to a beacon (chapter 2) | the yaw rate of the car with tyre slip (chapter 1); a radius |
| $s$ | the Laplace variable (chapter 6) | arc length along the path (chapters 4, 5); the steering state of the MPC (chapter 7) |
| $L$ | the wheelbase (chapters 1, 5) | the open loop $L(s)$ (chapter 6) |
| $L_d$, $L_0$ | pure pursuit's lookahead and its constant part | — |
| $k$ | pure pursuit's speed gain in $L_d = L_0 + k v$ | a time index $x_k$; Stanley's gain |
| $K$ | the Kalman gain (chapter 2) | a controller gain $K_e$, $K_\theta$ (chapter 6); the understeer gradient $K_{us}$ (chapter 1) |
| $\alpha$ | a tyre slip angle $\alpha_f$, $\alpha_r$ (chapter 1) | the angular-acceleration limit of the unicycle (Vehicle tab); a particle's injection fraction (chapter 2) |
| $\sigma$ | a standard deviation | the steering or turn-rate state in the MPC's $u = [a, \dot s]$ is written $s$, not $\sigma$ |
| $T$ | the control tick | the complementary sensitivity $T(s) = L/(1+L)$ (chapter 6); the prediction horizon $T_p$ of the speed planner |
| $Q$ | measurement noise (chapter 2) | the MPC's state-error weights $Q_{lat}, Q_{lon}, \dots$ (chapter 7) |
| $S$ | the innovation covariance $H \Sigma H^{\mathsf T} + Q$ (chapter 2) | the sensitivity $S(s) = 1/(1+L)$ (chapter 6) |

## 3. The symbols by area

| Symbol | Meaning | Unit |
|---|---|---|
| $x, y, \theta$ | pose: position of the reference point, heading | m, m, rad |
| $v, \omega$ | speed along the heading, yaw rate | m/s, rad/s |
| $\delta, \delta_{max}$ | steering angle and its lock (car) | rad |
| $L, l_f, l_r$ | wheelbase, distances from the centre of mass to the front and rear axles | m |
| $\tau$ | first-order actuator lag | s |
| $\beta, r, v_y$ | sideslip angle, yaw rate and lateral velocity of the dynamic bicycle model | rad, rad/s, m/s |
| $\alpha_f, \alpha_r, C_f, C_r$ | slip angles and cornering stiffnesses of the front and rear tyres | rad, N/rad |
| $\mu, \mu g$ | friction coefficient and the lateral acceleration it allows | —, m/s² |
| $K_{us}, v_{ch}, v_{crit}$ | understeer gradient, characteristic speed, critical speed | rad/(m/s²), m/s, m/s |
| $\mu, \Sigma$ | the estimate's mean and covariance (3 × 3 for a pose) | — |
| $u = (v, \omega)$ | the odometry input of one tick | — |
| $G, V$ | Jacobians of the motion model with respect to the pose and to $u$ | — |
| $M$ | odometry noise covariance $\mathrm{diag}(\sigma_v^2, \sigma_\omega^2)$ | — |
| $z = (r, b), \hat z, \nu$ | a beacon reading, its prediction, the innovation $z - \hat z$ | m, rad |
| $h, H$ | the measurement model and its Jacobian | — |
| $Q, S, K$ | measurement noise, innovation covariance, Kalman gain | — |
| NEES | normalized estimation error squared $e^{\mathsf T}\Sigma^{-1}e$, about 3 when consistent | — |
| $w^{[i]}, N_{eff}$ | a particle's weight and the effective sample size $1/\sum w^2$ | — |
| $l, l_{occ}, l_{free}$ | a cell's log-odds and the two update increments | — |
| $d$ | distance to the nearest lethal cell (the distance transform) | m |
| $g, h, f = g + \varepsilon h$ | cost so far, heuristic, and the priority of weighted A* | m |
| $\kappa, R_{min}$ | path curvature and the car's tightest turning radius | 1/m, m |
| $e, \theta_e$ | lateral and heading error in path coordinates | m, rad |
| $K_e, K_\theta$ | the tracker's gains on $e$ and $\theta_e$ as the analysis reads them | 1/(m·s), 1/s |
| $L_d = L_0 + k v$ | pure pursuit's lookahead | m |
| $k_e, k_\theta$ | rear-wheel feedback's gains | — |
| $k_p, k_i, k_d$ | PID gains | — |
| $L(s), S(s), T(s)$ | open loop, sensitivity, complementary sensitivity | — |
| $\omega_c$, PM, GM, DM, $M_s$ | crossover, phase margin, gain margin, delay margin PM/$\omega_c$, peak sensitivity | rad/s, °, dB, s, — |
| $\zeta, \omega_n$ | damping ratio and natural frequency of the dominant poles | —, rad/s |
| $N_p, N_c, \Delta t$ | the MPC's prediction horizon, control horizon and step | —, —, s |
| $T_p$ | the speed planner's and predictor's horizon | s |

## 4. References

What the lab takes from each, in one line. The inline citations in the lessons point here.

- Thrun, Burgard and Fox, *Probabilistic Robotics* (MIT Press, 2005). The EKF and particle-filter derivations of chapter 2, log-odds mapping and the inverse sensor model of chapter 3, and the noise notation above.
- Bar-Shalom, Li and Kirubarajan, *Estimation with Applications to Tracking and Navigation* (Wiley, 2001). Mahalanobis gating, NEES as a consistency test, and the constant-velocity tracker of chapter 3.
- LaValle, *Planning Algorithms* (Cambridge, 2006). Configuration space, A* and sampling-based planning as chapter 4 presents them.
- Hart, Nilsson and Raphael, "A formal basis for the heuristic determination of minimum cost paths", *IEEE Trans. Systems Science and Cybernetics* 4(2), 1968. A* and the admissibility argument.
- Karaman and Frazzoli, "Sampling-based algorithms for optimal motion planning", *IJRR* 30(7), 2011. RRT* and the rewiring radius.
- Dolgov, Thrun, Montemerlo and Diebel, "Path planning for autonomous vehicles in unknown semi-structured environments", *IJRR* 29(5), 2010. Hybrid A* with the Reeds–Shepp expansion and the two heuristics.
- Reeds and Shepp, "Optimal paths for a car that goes both forwards and backwards", *Pacific J. Math.* 145(2), 1990. The 48 path words.
- Coulter, "Implementation of the pure pursuit path tracking algorithm", CMU-RI-TR-92-01, 1992. Pure pursuit as the lab runs it.
- Hoffmann, Montemerlo, Dahlkamp and Thrun, "Autonomous automobile trajectory tracking for off-road driving", *American Control Conference*, 2007. The Stanley law.
- Paden, Čáp, Yong, Yershov and Frazzoli, "A survey of motion planning and control techniques for self-driving urban vehicles", *IEEE Trans. Intelligent Vehicles* 1(1), 2016. The map of planners and trackers chapters 4 and 5 follow.
- Åström and Murray, *Feedback Systems* (Princeton, 2008; free online). Bode, Nyquist, margins, sensitivity and the delay-margin argument of chapter 6.
- Rajamani, *Vehicle Dynamics and Control* (Springer, 2nd ed. 2012). The dynamic bicycle model, understeer gradient and characteristic speed of chapter 1.
- Rawlings, Mayne and Diehl, *Model Predictive Control: Theory, Computation, and Design* (Nob Hill, 2nd ed. 2017). The MPC formulation and terminal-cost reasoning of chapter 7.
- Bertsekas, *Constrained Optimization and Lagrange Multiplier Methods* (Academic Press, 1982). The augmented Lagrangian the MPC uses for its obstacle and agent constraints.
- Helbing and Molnár, "Social force model for pedestrian dynamics", *Physical Review E* 51(5), 1995. The reactive pedestrians of L5 and L6.
- Bresenham, "Algorithm for computer control of a digital plotter", *IBM Systems Journal* 4(1), 1965. The ray traversal of the lidar model and the mapper.
