// Unit tests for the Analyze tab's numerics (src/analysis/num.js): complex arithmetic, polynomials, polynomial roots,
// eigenvalues, the matrix exponential and a complex linear solve, each against an answer known in closed form. `npm test`.
// num.js is not in the worker build (dist/core-worker.js), so it is read from the source and run in its own vm context:
// it uses nothing but Math, and its top-level declarations are returned by an expression appended to the source.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {ROOT} from './core.mjs';
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'analysis', 'num.js'), 'utf8');
const N = vm.runInNewContext(SRC + '\n;({Cx, pMul, pAdd, pScale, pEval, expm, cxSolve, pRoots, eig});', {}, {filename: 'num.js'});
// arrays made in the vm context have its Array.prototype: copied into this realm before a deepEqual
const plain = x => JSON.parse(JSON.stringify(x));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} ± ${tol}, got ${a}`);
const nearC = (z, w, tol, msg) => assert.ok(Math.hypot(z[0] - w[0], z[1] - w[1]) <= tol, `${msg || ''} expected ${w} ± ${tol}, got ${z}`);
// every expected value matched to a distinct computed one, nearest first (the order of roots and eigenvalues is free)
function sameSet(got, want, tol, msg) {
  assert.equal(got.length, want.length, `${msg}: count`);
  const left = got.slice();
  for (const w of want) {
    let bi = 0;
    for (let i = 1; i < left.length; i++)
      if (Math.hypot(left[i][0] - w[0], left[i][1] - w[1]) < Math.hypot(left[bi][0] - w[0], left[bi][1] - w[1])) bi = i;
    nearC(left[bi], w, tol, msg);
    left.splice(bi, 1);
  }
}
const matNear = (A, B, tol, msg) => A.forEach((r, i) => r.forEach((v, j) => near(v, B[i][j], tol, `${msg} [${i}][${j}]`)));

test('Cx: complex arithmetic as [re, im]', () => {
  nearC(N.Cx.mul([1, 2], [3, -1]), [5, 5], 1e-15, '(1+2i)(3−i)');
  nearC(N.Cx.div([5, 5], [3, -1]), [1, 2], 1e-15, '(5+5i)/(3−i)');
  nearC(N.Cx.sqrt([3, 4]), [2, 1], 1e-15, '√(3+4i)');
  nearC(N.Cx.sqrt([-4, 0]), [0, 2], 1e-15, '√−4, principal branch');
  nearC(N.Cx.sqrt([3, -4]), [2, -1], 1e-15, '√(3−4i), the lower half plane');
  nearC(N.Cx.exp([0, Math.PI]), [-1, 0], 1e-15, 'e^{iπ}');
  nearC(N.Cx.log([-1, 0]), [0, Math.PI], 1e-15, 'log −1');
  near(N.Cx.abs([3, 4]), 5, 0, '|3+4i|');
  near(N.Cx.arg([0, 2]), Math.PI / 2, 1e-15, 'arg 2i');
});

test('polynomials in ascending powers: product, sum, scale, evaluation', () => {
  assert.deepEqual(plain(N.pMul([1, 1], [1, -1])), [1, 0, -1], '(1+s)(1−s) = 1 − s²');
  assert.deepEqual(plain(N.pAdd([1, 2], [0, 0, 3])), [1, 2, 3]);
  assert.deepEqual(plain(N.pScale([1, -2], 3)), [3, -6]);
  nearC(N.pEval([1, 0, 1], [0, 1]), [0, 0], 1e-15, '1 + s² at s = i');
  nearC(N.pEval([5, 2, 1], [-1, 2]), [0, 0], 1e-14, 's² + 2s + 5 at −1 + 2i');
  nearC(N.pEval([-6, 11, -6, 1], [4, 0]), [6, 0], 1e-14, '(s−1)(s−2)(s−3) at 4');
});

test('pRoots: known real, complex, repeated-at-zero roots and a padded leading coefficient', () => {
  const cases = [
    [
      '(s−1)(s−2)(s−3)',
      [-6, 11, -6, 1],
      [
        [1, 0],
        [2, 0],
        [3, 0]
      ]
    ],
    [
      's² + 2s + 5',
      [5, 2, 1],
      [
        [-1, 2],
        [-1, -2]
      ]
    ],
    [
      '(s+1)(s² + 2s + 5)',
      [5, 7, 3, 1],
      [
        [-1, 0],
        [-1, 2],
        [-1, -2]
      ]
    ],
    [
      's²(s+4): zero roots split off',
      [0, 0, 4, 1],
      [
        [0, 0],
        [0, 0],
        [-4, 0]
      ]
    ],
    [
      '2(s−1)(s−2) with a zero s³ coefficient',
      [4, -6, 2, 0],
      [
        [1, 0],
        [2, 0]
      ]
    ],
    [
      's⁴ − 1',
      [-1, 0, 0, 0, 1],
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]
    ]
  ];
  for (const [name, p, want] of cases) sameSet(N.pRoots(p), want, 1e-9, name);
  for (const r of N.pRoots([-6, 11, -6, 1])) assert.equal(r[1], 0, 'a real root comes back with an exact zero imaginary part');
  assert.deepEqual(plain(N.pRoots([3])), [], 'a constant has no roots');
});

test('eig: 2×2 and 3×3 matrices with known eigenvalues, including a complex pair', () => {
  const cases = [
    [
      'symmetric 2×2',
      [
        [2, 1],
        [1, 2]
      ],
      [
        [3, 0],
        [1, 0]
      ]
    ],
    [
      'companion of (s+1)(s+2)',
      [
        [0, 1],
        [-2, -3]
      ],
      [
        [-1, 0],
        [-2, 0]
      ]
    ],
    [
      'rotation generator',
      [
        [0, -1],
        [1, 0]
      ],
      [
        [0, 1],
        [0, -1]
      ]
    ],
    [
      'damped oscillator −1 ± 2i',
      [
        [-1, -2],
        [2, -1]
      ],
      [
        [-1, 2],
        [-1, -2]
      ]
    ],
    [
      'upper triangular 3×3',
      [
        [1, 5, -2],
        [0, 4, 7],
        [0, 0, -3]
      ],
      [
        [1, 0],
        [4, 0],
        [-3, 0]
      ]
    ],
    [
      'companion of (s+1)(s² + 2s + 5)',
      [
        [0, 1, 0],
        [0, 0, 1],
        [-5, -7, -3]
      ],
      [
        [-1, 0],
        [-1, 2],
        [-1, -2]
      ]
    ],
    [
      'block 3×3: 1 ± 2i and 3',
      [
        [1, -2, 0],
        [2, 1, 0],
        [0, 0, 3]
      ],
      [
        [1, 2],
        [1, -2],
        [3, 0]
      ]
    ]
  ];
  for (const [name, A, want] of cases) sameSet(N.eig(A), want, 1e-9, name);
  // a similarity transform keeps the eigenvalues: T⁻¹ diag-block T with T = [[1,1,0],[0,1,1],[1,0,1]] (det 2)
  const B = [
      [1, -2, 0],
      [2, 1, 0],
      [0, 0, 3]
    ],
    T = [
      [1, 1, 0],
      [0, 1, 1],
      [1, 0, 1]
    ],
    Ti = [
      [0.5, -0.5, 0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5]
    ],
    mm = (X, Y) => X.map(r => Y[0].map((_, j) => r.reduce((s, x, l) => s + x * Y[l][j], 0)));
  matNear(
    mm(T, Ti),
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ],
    1e-15,
    'T · T⁻¹'
  );
  sameSet(
    N.eig(mm(mm(Ti, B), T)),
    [
      [1, 2],
      [1, -2],
      [3, 0]
    ],
    1e-9,
    'similar to the block 3×3'
  );
  for (const z of N.eig([
    [2, 1],
    [1, 2]
  ]))
    assert.equal(z[1], 0, 'a real eigenvalue has an exact zero imaginary part');
});

test('expm: a diagonal matrix, a rotation generator, a nilpotent matrix and zero against the closed form', () => {
  const E = N.expm([
    [1, 0, 0],
    [0, -2, 0],
    [0, 0, 0.5]
  ]);
  matNear(
    E,
    [
      [Math.E, 0, 0],
      [0, Math.exp(-2), 0],
      [0, 0, Math.exp(0.5)]
    ],
    1e-12,
    'exp diag(1, −2, 0.5)'
  );
  for (const th of [0.3, 2.5, 10]) {
    const R = N.expm([
        [0, -th],
        [th, 0]
      ]),
      c = Math.cos(th),
      s = Math.sin(th);
    matNear(
      R,
      [
        [c, -s],
        [s, c]
      ],
      1e-11,
      `exp of the rotation generator, θ = ${th}`
    );
  }
  matNear(
    N.expm([
      [0, 1],
      [0, 0]
    ]),
    [
      [1, 1],
      [0, 1]
    ],
    1e-15,
    'exp [[0,1],[0,0]] = I + N'
  );
  matNear(
    N.expm([
      [0, 0],
      [0, 0]
    ]),
    [
      [1, 0],
      [0, 1]
    ],
    0,
    'exp 0 = I'
  );
  // a double integrator with time step t: exp([[0, t],[0, 0]]) and a damped one, exp(−a t) on the diagonal
  matNear(
    N.expm([
      [-0.5, 0.1],
      [0, -0.5]
    ]),
    [
      [Math.exp(-0.5), 0.1 * Math.exp(-0.5)],
      [0, Math.exp(-0.5)]
    ],
    1e-14,
    'Jordan block'
  );
});

test('cxSolve: complex systems against hand-computed answers, including a zero pivot', () => {
  // [[1+i, 2], [−i, 3]] x = [6+2i, 5+2i] has x = [1−i, 2+i]: (1+i)(1−i) + 2(2+i) = 6+2i, −i(1−i) + 3(2+i) = 5+2i
  const x = N.cxSolve(
    [
      [
        [1, 1],
        [2, 0]
      ],
      [
        [0, -1],
        [3, 0]
      ]
    ],
    [
      [6, 2],
      [5, 2]
    ]
  );
  nearC(x[0], [1, -1], 1e-14, 'x₀');
  nearC(x[1], [2, 1], 1e-14, 'x₁');
  // a zero in the top-left corner needs the row swap: [[0,1,0],[1,0,0],[0,0,2i]] x = [3, 4, 4i] → x = [4, 3, 2]
  const y = N.cxSolve(
    [
      [
        [0, 0],
        [1, 0],
        [0, 0]
      ],
      [
        [1, 0],
        [0, 0],
        [0, 0]
      ],
      [
        [0, 0],
        [0, 0],
        [0, 2]
      ]
    ],
    [
      [3, 0],
      [4, 0],
      [0, 4]
    ]
  );
  [
    [4, 0],
    [3, 0],
    [2, 0]
  ].forEach((w, i) => nearC(y[i], w, 1e-15, `y[${i}]`));
  // the inputs are left as they were
  const A = [[[2, 0]]],
    b = [[4, 2]];
  nearC(N.cxSolve(A, b)[0], [2, 1], 1e-15, '(4+2i)/2');
  assert.deepEqual([A, b], [[[[2, 0]]], [[4, 2]]]);
});
