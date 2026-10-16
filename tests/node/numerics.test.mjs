// Unit tests for the core's closed-form numerics, on the built worker core (dist/core-worker.js). `npm test`.
// Each case has an answer that can be checked by hand: a matrix times its inverse, a Cholesky solve of a known
// system, a box QP with a separable Hessian, the distance transform of one cell, Reeds–Shepp lengths of a straight
// line and a half turn, A* on a free straight line, and the textbook properties of one EKF update.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCore} from './core.mjs';
loadCore();
const C = globalThis.__core;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} ± ${tol}, got ${a}`);

test('m3inv: A · inv(A) = I, and a singular matrix gives null', () => {
  const A = [4, 1, 0.5, 1, 3, 0.2, 0.5, 0.2, 2];
  const I = C.m3mul(A, C.m3inv(A));
  for (let i = 0; i < 9; i++) near(I[i], i % 4 === 0 ? 1 : 0, 1e-12, `entry ${i}`);
  assert.equal(C.m3inv([1, 2, 3, 2, 4, 6, 0, 0, 1]), null);
});

test('cholSolve: L Lᵀ x = b recovers x', () => {
  const n = 3,
    L = [2, 0, 0, 1, 3, 0, 0.5, -1, 1.5]; // lower triangular, row major
  const A = new Float64Array(n * n),
    x = [1, -2, 0.5],
    b = new Float64Array(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) A[i * n + j] += L[i * n + k] * L[j * n + k];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b[i] += A[i * n + j] * x[j];
  const s = C.cholSolve(A, b, n);
  for (let i = 0; i < n; i++) near(s[i], x[i], 1e-10, `x[${i}]`);
});

test('boxQP: a separable problem lands on the clamped unconstrained minimum', () => {
  // ½ h z² + g z per coordinate → z = −g/h, clamped to the box
  const H = new Float64Array([2, 0, 0, 0, 4, 0, 0, 0, 1]),
    g = new Float64Array([-6, 2, 0.5]); // minima at 3, -0.5, -0.5
  const z = C.boxQP(H, g, new Float64Array([-1, -1, -1]), new Float64Array([1, 1, 1]), 3);
  near(z[0], 1, 1e-6, 'clamped at the upper bound');
  near(z[1], -0.5, 1e-6, 'interior');
  near(z[2], -0.5, 1e-6, 'interior');
});

test('distanceTransform: one occupied cell, 8-connected distances at and above Euclidean', () => {
  const occ = new Uint8Array(C.NC),
    ci = 120,
    cj = 80;
  occ[cj * C.GW + ci] = 1;
  const d = C.distanceTransform(occ);
  assert.equal(d[cj * C.GW + ci], 0);
  near(d[cj * C.GW + ci + 3], 3 * C.RES, 1e-6, 'three cells east');
  near(d[(cj + 3) * C.GW + ci + 3], 3 * Math.SQRT2 * C.RES, 1e-6, 'three cells diagonal');
  const far = d[(cj + 3) * C.GW + ci + 7],
    eu = Math.hypot(7, 3) * C.RES;
  assert.ok(far >= eu - 1e-9 && far <= 1.09 * eu, `octile within 8 % above Euclidean: ${far} vs ${eu}`);
});

test('Reeds–Shepp: a straight line costs its length, a half turn costs πR, and the sample ends at the goal', () => {
  const R = 1.2;
  const st = C.RS.solve([1, 1, 0], [6, 1, 0], R)[0];
  near(st.len * R, 5, 1e-6, 'straight line');
  const half = C.RS.solve([0, 0, 0], [0, 2 * R, Math.PI], R)[0];
  near(half.len * R, Math.PI * R, 1e-6, 'half turn');
  const segs = C.RS.sample([0, 0, 0], half, R, 0.05), // legs by gear, each {dir, pts: [[x, y, θ], …]}
    last = segs[segs.length - 1].pts,
    end = last[last.length - 1];
  near(end[0], 0, 1e-3, 'end x');
  near(end[1], 2 * R, 1e-3, 'end y');
});

test('A*: on a free straight line the path length is the distance; an obstacle makes it longer', () => {
  C.loadLevel(0); // L1: the open floor, prior map
  const a = C.astar(2, 2, 2, 6); // along the west edge, nothing in the way
  assert.ok(a.ok, 'a path');
  const len = p => {
    let s = 0;
    for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return s;
  };
  const pts = a.segs ? a.segs.flat() : a.path || a.pts;
  near(len(pts), 4, 0.25, 'free line of 4 m');
  const b = C.astar(2, 2, 22, 14); // across the floor, round the pillars
  assert.ok(b.ok && len(b.segs ? b.segs.flat() : b.path || b.pts) >= Math.hypot(20, 12) - 1e-6, 'never shorter than the straight line');
});

test('EKF update: a correct reading moves the estimate toward the truth and shrinks the covariance, symmetric', () => {
  C.loadLevel(2); // L3: beacons with known IDs
  C.setParam('loc', 'ekf', false);
  const S = C.S,
    r = S.robot;
  S.est = {x: r.x + 0.4, y: r.y - 0.3, th: r.th + 0.05};
  S.Pc = [0.2, 0, 0, 0, 0.2, 0, 0, 0, 0.02];
  const lm = S.beacons[0],
    range = Math.hypot(lm.x - r.x, lm.y - r.y),
    bearing = C.wrap(Math.atan2(lm.y - r.y, lm.x - r.x) - r.th);
  const e0 = Math.hypot(S.est.x - r.x, S.est.y - r.y),
    tr0 = S.Pc[0] + S.Pc[4] + S.Pc[8];
  C.ekfUpdate([{id: 0, r: range, b: bearing}]);
  const e1 = Math.hypot(S.est.x - r.x, S.est.y - r.y),
    tr1 = S.Pc[0] + S.Pc[4] + S.Pc[8];
  assert.ok(e1 < e0, `error ${e1} < ${e0}`);
  assert.ok(tr1 < tr0, `trace ${tr1} < ${tr0}`);
  near(S.Pc[1], S.Pc[3], 1e-12, 'symmetric');
  near(S.Pc[2], S.Pc[6], 1e-12, 'symmetric');
  assert.ok(S.Pc[0] > 0 && S.Pc[4] > 0 && S.Pc[8] > 0, 'positive diagonal');
});
