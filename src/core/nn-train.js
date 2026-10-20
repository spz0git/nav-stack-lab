/* ============================================================
   Training the learned blocks in the page (Tools → Train): backpropagation for the two layer types nn.js runs (a
   circular 1D convolution over the beams, a dense layer), Adam, and the losses the Python trainers use
   (training/detector: class-weighted binary cross-entropy per beam; training/predictor and training/policy: the
   negative log-likelihood of a mixture, over futures or candidate paths). Plain loops over Float32Arrays, no dependency. A model is the same JSON as src/models/*.json, so a model
   trained here runs through nnForward / mlpForward unchanged.
   The work is split so that it can run in several workers: nnGrad sums the gradient over a list of samples, the caller
   adds the workers' sums and takes the Adam step (ui/train.js; tests/node/train.test.mjs runs it in one process).
   ============================================================ */
// The network presets of the Train tab. Detector: conv layers [channels, kernel], the last one a 1-channel sigmoid
// added by nnInit. Policy: hidden widths of the MLP. 'builtin' is the shape the shipped model was trained with.
const NN_ARCH = {
  detector: [
    [
      'builtin',
      'Built-in shape',
      [
        [24, 7],
        [24, 7],
        [24, 5]
      ],
      'three convolutions, 24 channels, kernels 7, 7, 5: what the shipped detector is'
    ],
    [
      'small',
      'Small',
      [
        [12, 5],
        [12, 5]
      ],
      'two convolutions of 12 channels: a tenth of the parameters'
    ],
    [
      'wide',
      'Wide context',
      [
        [32, 9],
        [32, 9],
        [32, 7],
        [32, 5]
      ],
      'four wider convolutions that see 27 beams (22°) at once'
    ],
    [
      'beam',
      'Per beam (no context)',
      [
        [32, 1],
        [32, 1]
      ],
      'kernel 1: each beam judged on its own six numbers, no neighbours; shows what the context buys'
    ]
  ],
  predictor: [
    ['builtin', 'Built-in shape', [64, 64], 'two hidden layers of 64: what the shipped predictor is'],
    ['small', 'Small', [24, 24], 'two hidden layers of 24: a sixth of the parameters'],
    ['wide', 'Wide', [128, 128], 'two hidden layers of 128'],
    ['linear', 'Linear (no hidden layer)', [], 'the inputs straight to the outputs: a linear correction to constant velocity']
  ],
  policy: [
    ['builtin', 'Built-in shape', [256, 256], 'two hidden layers of 256: what the shipped policy is'],
    ['small', 'Small', [64, 64], 'two hidden layers of 64: a fifteenth of the parameters'],
    ['deep', 'Deep', [128, 128, 128], 'three hidden layers of 128'],
    ['wide', 'One wide layer', [512], 'a single hidden layer of 512']
  ]
};
const NN_IN = {
  detector: {beams: NBEAM, channels: DET_CH, order: ['range/8', 'previous range/8', 'change (±1)', 'hit', 'v/1.5', 'w/2', 'map evidence']},
  predictor: {
    features: PRED_NF,
    order: [
      '5 past positions (x, y) at 0.2…1 s ago, m',
      'velocity (x, y), m/s',
      'robot position /4',
      'robot velocity, m/s',
      '8 rays of free space /4'
    ]
  },
  policy: {
    features: NBEAM + 19,
    order: ['120 ranges/8', '12 sector minima/8', 'goal dx/10', 'goal dy/10', 'distance/10', 'cos bearing', 'sin bearing', 'v/1.5', 'w/2']
  }
};
// A fresh model: PyTorch's default initialization (weights and biases uniform in ±1/√fan-in), seeded
function nnInit(block, hidden, seed) {
  const u = mulberry32((seed || 1) >>> 0),
    uni = (n, lim) => Float32Array.from({length: n}, () => (2 * u() - 1) * lim),
    layers = [];
  if (block === 'detector') {
    let cin = NN_IN.detector.channels;
    const spec = [...hidden, [1, 1]];
    spec.forEach(([cout, k], i) => {
      const lim = 1 / Math.sqrt(cin * k);
      layers.push({
        type: 'conv1d',
        cin,
        cout,
        k,
        pad: 'circular',
        act: i < spec.length - 1 ? 'relu' : 'sigmoid',
        w: uni(cout * cin * k, lim),
        b: uni(cout, lim)
      });
      cin = cout;
    });
  } else {
    let nin = NN_IN[block].features;
    const spec = [...hidden, block === 'predictor' ? PRED_NO : POLICY_K * (1 + 2 * POLICY_N)];
    spec.forEach((nout, i) => {
      const lim = 1 / Math.sqrt(nin);
      layers.push({type: 'dense', nin, nout, act: i < spec.length - 1 ? 'relu' : 'none', w: uni(nout * nin, lim), b: uni(nout, lim)});
      nin = nout;
    });
  }
  return {name: block, input: NN_IN[block], params: nnCount(layers), layers};
}
const nnCount = layers => layers.reduce((a, L) => a + L.w.length + L.b.length, 0);
// All weights and biases in one flat vector (layer by layer, w then b) and back: what the workers exchange
function nnFlat(model) {
  const out = new Float32Array(nnCount(model.layers));
  let o = 0;
  for (const L of model.layers) {
    out.set(L.w, o);
    o += L.w.length;
    out.set(L.b, o);
    o += L.b.length;
  }
  return out;
}
function nnUnflat(model, flat) {
  let o = 0;
  const layers = model.layers.map(L => {
    const w = flat.slice(o, o + L.w.length);
    o += L.w.length;
    const b = flat.slice(o, o + L.b.length);
    o += L.b.length;
    return {...L, w, b};
  });
  return {...model, layers};
}
// Three matrix loops do all the work, blocked by four so that each weight or input loaded serves four products.
// Rows r < R of x (ni wide, contiguous), weights w [no][ni]:
//   mmFwd:   out[r][o] = b[o] + Σ_q w[o][q] x[r][q]
//   mmBackW: gw[o][q] += Σ_r dz[r][o] x[r][q], gb[o] += Σ_r dz[r][o]
//   mmBackX: dx[r][q]  = Σ_o dz[r][o] w[o][q]
function mmFwd(x, R, ni, w, b, no, out) {
  let r = 0;
  for (; r + 3 < R; r += 4) {
    const x0 = r * ni,
      x1 = x0 + ni,
      x2 = x1 + ni,
      x3 = x2 + ni;
    for (let o = 0; o < no; o++) {
      const wo = o * ni;
      let a0 = b[o],
        a1 = a0,
        a2 = a0,
        a3 = a0;
      for (let q = 0; q < ni; q++) {
        const wq = w[wo + q];
        a0 += wq * x[x0 + q];
        a1 += wq * x[x1 + q];
        a2 += wq * x[x2 + q];
        a3 += wq * x[x3 + q];
      }
      out[r * no + o] = a0;
      out[(r + 1) * no + o] = a1;
      out[(r + 2) * no + o] = a2;
      out[(r + 3) * no + o] = a3;
    }
  }
  for (; r < R; r++)
    for (let o = 0; o < no; o++) {
      const wo = o * ni,
        xr = r * ni;
      let a = b[o];
      for (let q = 0; q < ni; q++) a += w[wo + q] * x[xr + q];
      out[r * no + o] = a;
    }
}
function mmBackW(dz, R, no, x, ni, gw, gb) {
  for (let o = 0; o < no; o++) {
    const go = o * ni;
    let r = 0;
    for (; r + 3 < R; r += 4) {
      const d0 = dz[r * no + o],
        d1 = dz[(r + 1) * no + o],
        d2 = dz[(r + 2) * no + o],
        d3 = dz[(r + 3) * no + o];
      if (d0 === 0 && d1 === 0 && d2 === 0 && d3 === 0) continue; // ReLU zeros: common
      gb[o] += d0 + d1 + d2 + d3;
      const x0 = r * ni,
        x1 = x0 + ni,
        x2 = x1 + ni,
        x3 = x2 + ni;
      for (let q = 0; q < ni; q++) gw[go + q] += d0 * x[x0 + q] + d1 * x[x1 + q] + d2 * x[x2 + q] + d3 * x[x3 + q];
    }
    for (; r < R; r++) {
      const d = dz[r * no + o];
      if (d === 0) continue;
      gb[o] += d;
      const xr = r * ni;
      for (let q = 0; q < ni; q++) gw[go + q] += d * x[xr + q];
    }
  }
}
function mmBackX(dz, R, no, w, ni, dx) {
  dx.fill(0, 0, R * ni);
  for (let r = 0; r < R; r++) {
    const xr = r * ni,
      zr = r * no;
    let o = 0;
    for (; o + 3 < no; o += 4) {
      const d0 = dz[zr + o],
        d1 = dz[zr + o + 1],
        d2 = dz[zr + o + 2],
        d3 = dz[zr + o + 3];
      if (d0 === 0 && d1 === 0 && d2 === 0 && d3 === 0) continue;
      const w0 = o * ni,
        w1 = w0 + ni,
        w2 = w1 + ni,
        w3 = w2 + ni;
      for (let q = 0; q < ni; q++) dx[xr + q] += d0 * w[w0 + q] + d1 * w[w1 + q] + d2 * w[w2 + q] + d3 * w[w3 + q];
    }
    for (; o < no; o++) {
      const d = dz[zr + o];
      if (d === 0) continue;
      const wo = o * ni;
      for (let q = 0; q < ni; q++) dx[xr + q] += d * w[wo + q];
    }
  }
}
// conv weights are stored [cout][cin][k] (PyTorch's order); the loops want [cout][k][cin], so that one beam's window
// of the input (k neighbours × cin channels, channel-minor) is a row of the window matrix and a convolution is mmFwd
function convT(L, src, dst, back) {
  const {cin, cout, k} = L;
  for (let o = 0; o < cout; o++)
    for (let c = 0; c < cin; c++)
      for (let j = 0; j < k; j++) {
        const a = (o * cin + c) * k + j,
          b = (o * k + j) * cin + c;
        if (back) dst[a] += src[b];
        else dst[b] = src[a];
      }
}
// The window matrix of a circular convolution: row i holds the inputs at beams i − p … i + p (wrapping), and back
function im2col(x, n, cin, k, col) {
  const p = k >> 1,
    K = k * cin;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k; j++) {
      const ii = (i + j - p + n) % n; // circular: beam 119 neighbours beam 0
      col.set(x.subarray(ii * cin, ii * cin + cin), i * K + j * cin);
    }
}
function col2im(dcol, n, cin, k, dx) {
  const p = k >> 1,
    K = k * cin;
  dx.fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < k; j++) {
      const ii = (i + j - p + n) % n,
        src = i * K + j * cin;
      for (let c = 0; c < cin; c++) dx[ii * cin + c] += dcol[src + c];
    }
}
const NN_CHUNK = 32; // the MLP runs this many samples at a time through each layer
// Scratch buffers per layer, reused across calls: a convolution works on one scan (n beams) at a time, a dense
// layer on NN_CHUNK samples
function nnWork(model, n) {
  return model.layers.map(L =>
    L.type === 'conv1d'
      ? {
          col: new Float32Array(n * L.k * L.cin),
          dcol: new Float32Array(n * L.k * L.cin),
          wt: new Float32Array(L.w.length),
          gwt: new Float32Array(L.w.length),
          z: new Float32Array(n * L.cout),
          dz: new Float32Array(n * L.cout)
        }
      : {z: new Float32Array(NN_CHUNK * L.nout), dz: new Float32Array(NN_CHUNK * L.nout)}
  );
}
// the loss summed over the outputs and its gradient with respect to the last layer's pre-activation z.
// 'bce': the last layer is a sigmoid, dL/dz = σ(z)(w y + 1 − y) − w y with w the positive weight; 'mse': 2 (z − y)
function nnLoss(task, z, y, m, dz) {
  let loss = 0;
  if (task.loss === 'bce') {
    const pw = task.posW;
    for (let q = 0; q < m; q++) {
      const zz = z[q],
        t = y[q],
        sp = Math.log1p(Math.exp(-Math.abs(zz))); // log(1 + e^−|z|), no overflow
      loss -= pw * t * (Math.min(zz, 0) - sp) + (1 - t) * (Math.min(-zz, 0) - sp); // log σ(z), log(1 − σ(z))
      dz[q] = (pw * t + 1 - t) / (1 + Math.exp(-zz)) - pw * t;
    }
  } else
    for (let q = 0; q < m; q++) {
      const d = z[q] - y[q];
      loss += d * d;
      dz[q] = 2 * d;
    }
  return loss;
}
// 'mix', the predictor's and the policy's: R samples, each with the K logits and K futures (or candidate paths) of ny
// numbers in z (nout = K + K ny wide) and its true future (the expert's route) in y (ny wide). The loss is the negative log-likelihood of a mixture of K Gaussians with a fixed σ,
//   L = −log Σ_k π_k exp(−|y − μ_k|² / 2σ²),  π = softmax(logits)
// and with γ_k the responsibilities (π_k exp(·) normalized: how well future k explains y),
//   ∂L/∂μ_k = γ_k (μ_k − y) / σ²,   ∂L/∂logit_k = π_k − γ_k
// so each future moves towards the outcomes it explains best and each probability towards how often it does.
// @code mix-loss | mixLoss: the mixture's negative log-likelihood and its gradient
function mixLoss(task, z, y, R, nout, dz) {
  const K = task.K,
    ny = task.ny,
    s2 = task.sigma * task.sigma,
    a = new Float64Array(K),
    pi = new Float64Array(K);
  let loss = 0;
  for (let r = 0; r < R; r++) {
    const zr = r * nout,
      yr = r * ny;
    let mx = -Infinity,
      ma = -Infinity;
    for (let k = 0; k < K; k++) mx = Math.max(mx, z[zr + k]);
    let zs = 0;
    for (let k = 0; k < K; k++) zs += pi[k] = Math.exp(z[zr + k] - mx);
    for (let k = 0; k < K; k++) {
      pi[k] /= zs;
      let d2 = 0;
      for (let q = 0; q < ny; q++) {
        const d = z[zr + K + k * ny + q] - y[yr + q];
        d2 += d * d;
      }
      a[k] = Math.log(pi[k] + 1e-30) - d2 / (2 * s2);
      ma = Math.max(ma, a[k]);
    }
    let as = 0;
    for (let k = 0; k < K; k++) as += Math.exp(a[k] - ma);
    loss -= ma + Math.log(as);
    for (let k = 0; k < K; k++) {
      const g = Math.exp(a[k] - ma) / as; // γ_k
      dz[zr + k] = pi[k] - g;
      for (let q = 0; q < ny; q++) dz[zr + K + k * ny + q] = (g * (z[zr + K + k * ny + q] - y[yr + q])) / s2;
    }
  }
  return loss;
}
// @end
const reluMask = (dz, x, m) => {
  for (let q = 0; q < m; q++) if (x[q] <= 0) dz[q] = 0;
};
const relu = (z, m) => {
  for (let q = 0; q < m; q++) if (z[q] < 0) z[q] = 0;
};
// @code nn-backprop | nnGrad: the forward pass, the loss and backpropagation, summed over samples
// The gradient of the loss summed over the samples idx (not averaged: workers' sums are added, then divided by the
// count), with the summed loss. task.loss 'bce': X is [samples][beams][channels], Y one 0/1 label per beam, positive
// beams weighted by task.posW; 'mse': X is [samples][features], Y the targets. Hidden layers are ReLU.
function nnGrad(model, X, Y, idx, task) {
  const Ls = model.layers,
    nL = Ls.length,
    conv = Ls[0].type === 'conv1d',
    n = conv ? task.n : 1,
    nin = conv ? Ls[0].cin : Ls[0].nin,
    nout = conv ? Ls[nL - 1].cout : Ls[nL - 1].nout,
    wk = task.work || (task.work = nnWork(model, n)),
    g = Ls.map(L => ({w: new Float32Array(L.w.length), b: new Float32Array(L.b.length)}));
  let loss = 0;
  if (conv) {
    for (let l = 0; l < nL; l++) {
      convT(Ls[l], Ls[l].w, wk[l].wt, false);
      wk[l].gwt.fill(0);
    }
    for (const s of idx) {
      const x0 = X.subarray(s * n * nin, (s + 1) * n * nin);
      let x = x0;
      for (let l = 0; l < nL; l++) {
        const {cin, cout, k} = Ls[l],
          W = wk[l];
        im2col(x, n, cin, k, W.col);
        mmFwd(W.col, n, k * cin, W.wt, Ls[l].b, cout, W.z);
        if (l < nL - 1) relu(W.z, n * cout); // the last layer's z stays before its sigmoid, for the loss
        x = W.z;
      }
      loss += nnLoss(task, wk[nL - 1].z, Y.subarray(s * n * nout, (s + 1) * n * nout), n * nout, wk[nL - 1].dz);
      for (let l = nL - 1; l >= 0; l--) {
        const {cin, cout, k} = Ls[l],
          W = wk[l];
        mmBackW(W.dz, n, cout, W.col, k * cin, W.gwt, g[l].b);
        if (!l) break;
        mmBackX(W.dz, n, cout, W.wt, k * cin, W.dcol);
        col2im(W.dcol, n, cin, k, wk[l - 1].dz);
        reluMask(wk[l - 1].dz, wk[l - 1].z, n * cin);
      }
    }
    for (let l = 0; l < nL; l++) convT(Ls[l], wk[l].gwt, g[l].w, true);
  } else {
    const ny = task.ny || nout, // the targets per sample: the outputs, or the mixture's one future
      xb = task.xb || (task.xb = new Float32Array(NN_CHUNK * nin)),
      yb = task.yb || (task.yb = new Float32Array(NN_CHUNK * ny));
    for (let c0 = 0; c0 < idx.length; c0 += NN_CHUNK) {
      const R = Math.min(NN_CHUNK, idx.length - c0);
      for (let r = 0; r < R; r++) {
        const s = idx[c0 + r];
        xb.set(X.subarray(s * nin, (s + 1) * nin), r * nin);
        yb.set(Y.subarray(s * ny, (s + 1) * ny), r * ny);
      }
      let x = xb;
      for (let l = 0; l < nL; l++) {
        const L = Ls[l];
        mmFwd(x, R, L.nin, L.w, L.b, L.nout, wk[l].z);
        if (l < nL - 1) relu(wk[l].z, R * L.nout);
        x = wk[l].z;
      }
      loss +=
        task.loss === 'mix'
          ? mixLoss(task, wk[nL - 1].z, yb, R, nout, wk[nL - 1].dz)
          : nnLoss(task, wk[nL - 1].z, yb, R * nout, wk[nL - 1].dz);
      for (let l = nL - 1; l >= 0; l--) {
        const L = Ls[l],
          xin = l ? wk[l - 1].z : xb;
        mmBackW(wk[l].dz, R, L.nout, xin, L.nin, g[l].w, g[l].b);
        if (!l) break;
        mmBackX(wk[l].dz, R, L.nout, L.w, L.nin, wk[l - 1].dz);
        reluMask(wk[l - 1].dz, xin, R * L.nin);
      }
    }
  }
  const flat = new Float32Array(nnCount(Ls));
  let o = 0;
  for (const G of g) {
    flat.set(G.w, o);
    o += G.w.length;
    flat.set(G.b, o);
    o += G.b.length;
  }
  // the losses are means over every output (beams × samples, or waypoint coordinates × samples), as in PyTorch; the
  // mixture's over the samples
  return {g: flat, loss, count: task.loss === 'mix' ? idx.length : idx.length * n * nout};
}
// @end
// Adam (PyTorch's defaults: β₁ 0.9, β₂ 0.999, ε 1e-8), in place on the flat parameter vector
function adamInit(n) {
  return {m: new Float32Array(n), v: new Float32Array(n), t: 0};
}
function adamStep(A, w, g, lr) {
  A.t++;
  const b1 = 0.9,
    b2 = 0.999,
    c1 = 1 - Math.pow(b1, A.t),
    c2 = 1 - Math.pow(b2, A.t);
  for (let i = 0; i < w.length; i++) {
    const gi = g[i];
    A.m[i] = b1 * A.m[i] + (1 - b1) * gi;
    A.v[i] = b2 * A.v[i] + (1 - b2) * gi * gi;
    w[i] -= (lr * (A.m[i] / c1)) / (Math.sqrt(A.v[i] / c2) + 1e-8);
  }
}
// The outputs for samples 0 … ns − 1 (the detector's after its sigmoid): the forward pass of nnGrad, the same numbers
// as nnForward / mlpForward but several times faster, for the held-out numbers after every epoch
function nnPredict(model, X, ns, n) {
  const Ls = model.layers,
    nL = Ls.length,
    conv = Ls[0].type === 'conv1d',
    m = conv ? n : 1,
    nin = conv ? Ls[0].cin : Ls[0].nin,
    nout = conv ? Ls[nL - 1].cout : Ls[nL - 1].nout,
    wk = nnWork(model, m),
    out = new Float32Array(ns * m * nout);
  if (conv) {
    for (let l = 0; l < nL; l++) convT(Ls[l], Ls[l].w, wk[l].wt, false);
    for (let s = 0; s < ns; s++) {
      let x = X.subarray(s * m * nin, (s + 1) * m * nin);
      for (let l = 0; l < nL; l++) {
        const {cin, cout, k} = Ls[l];
        im2col(x, m, cin, k, wk[l].col);
        mmFwd(wk[l].col, m, k * cin, wk[l].wt, Ls[l].b, cout, wk[l].z);
        if (l < nL - 1) relu(wk[l].z, m * cout);
        x = wk[l].z;
      }
      for (let q = 0; q < m * nout; q++) out[s * m * nout + q] = Ls[nL - 1].act === 'sigmoid' ? 1 / (1 + Math.exp(-x[q])) : x[q];
    }
  } else
    for (let c0 = 0; c0 < ns; c0 += NN_CHUNK) {
      const R = Math.min(NN_CHUNK, ns - c0);
      let x = X.subarray(c0 * nin, (c0 + R) * nin);
      for (let l = 0; l < nL; l++) {
        mmFwd(x, R, Ls[l].nin, Ls[l].w, Ls[l].b, Ls[l].nout, wk[l].z);
        if (l < nL - 1) relu(wk[l].z, R * Ls[l].nout);
        x = wk[l].z;
      }
      out.set(x.subarray(0, R * nout), c0 * nout);
    }
  return out;
}
// How a model does on a set of samples, the numbers the Python trainers print: the detector's precision and recall at
// its threshold (per beam), the policy's RMS error per waypoint in metres (of its best-scoring candidate, and of the
// best of its K: the candidate nearest the expert's route)
function nnEvaluate(model, X, Y, block) {
  if (block === 'detector') {
    const n = NBEAM,
      ns = Y.length / n,
      thr = model.threshold || DET_THR,
      p = nnPredict(model, X, ns, n);
    let tp = 0,
      fp = 0,
      fn = 0;
    for (let q = 0; q < p.length; q++) {
      const hit = p[q] > thr,
        t = Y[q];
      if (hit && t) tp++;
      else if (hit) fp++;
      else if (t) fn++;
    }
    const precision = tp / Math.max(1, tp + fp),
      recall = tp / Math.max(1, tp + fn);
    return {precision, recall, f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0, samples: ns};
  }
  if (block === 'predictor') return predEvaluate(model, X, Y);
  const ny = 2 * POLICY_N,
    ns = Y.length / ny,
    K = policyK(model),
    NO = K > 1 ? K * (1 + ny) : ny,
    out = nnPredict(model, X, ns, 1),
    se = new Float64Array(POLICY_N), // the best-scoring candidate's squared error per waypoint, summed over samples
    sb = new Float64Array(POLICY_N), // the same for the candidate nearest the route
    e2 = new Float64Array(K * POLICY_N);
  for (let s = 0; s < ns; s++) {
    const z = s * NO;
    let top = 0,
      best = 0,
      bestSum = Infinity;
    for (let k = 1; k < K; k++) if (out[z + k] > out[z + top]) top = k;
    for (let k = 0; k < K; k++) {
      const o = z + (K > 1 ? K + k * ny : 0);
      let sum = 0;
      for (let i = 0; i < POLICY_N; i++) {
        const dx = (out[o + 2 * i] - Y[s * ny + 2 * i]) * 4,
          dy = (out[o + 2 * i + 1] - Y[s * ny + 2 * i + 1]) * 4;
        sum += e2[k * POLICY_N + i] = dx * dx + dy * dy;
      }
      if (sum < bestSum) [best, bestSum] = [k, sum];
    }
    for (let i = 0; i < POLICY_N; i++) {
      se[i] += e2[top * POLICY_N + i];
      sb[i] += e2[best * POLICY_N + i];
    }
  }
  const perWp = Array.from(se, v => Math.sqrt(v / Math.max(1, ns))),
    bestWp = Array.from(sb, v => Math.sqrt(v / Math.max(1, ns))),
    rmsOf = a => Math.sqrt(a.reduce((q, v) => q + v * v, 0) / POLICY_N);
  return {perWp, rms: rmsOf(perWp), bestWp, best: rmsOf(bestWp), K, samples: ns};
}
// The predictor's numbers: the error at 1 s and 2 s of its most probable future (top), of the best of its K (best),
// and of constant velocity (a zero correction: the label itself), in metres
function predEvaluate(model, X, Y) {
  const NH = PRED_H.length,
    ny = 2 * NH,
    ns = Y.length / ny,
    NO = model.layers[model.layers.length - 1].nout,
    K = (NO / (1 + ny)) | 0,
    out = nnPredict(model, X, ns, 1),
    acc = {top: [0, 0], best: [0, 0], cv: [0, 0]};
  for (let s = 0; s < ns; s++) {
    const z = s * NO,
      y = s * ny;
    let top = 0;
    for (let k = 1; k < K; k++) if (out[z + k] > out[z + top]) top = k;
    [1, 3].forEach((h, i) => {
      const yx = Y[y + 2 * h],
        yy = Y[y + 2 * h + 1];
      let best = Infinity;
      for (let k = 0; k < K; k++) {
        const o = z + K + k * ny + 2 * h,
          e = hyp(out[o] - yx, out[o + 1] - yy);
        if (k === top) acc.top[i] += e;
        best = Math.min(best, e);
      }
      acc.best[i] += best;
      acc.cv[i] += hyp(yx, yy);
    });
  }
  const m = a => a.map(v => v / Math.max(1, ns));
  return {top: m(acc.top), best: m(acc.best), cv: m(acc.cv), samples: ns};
}
// The training loop. opts: model (initial weights), nTrain (samples), epochs, batch, lr, seed, and three callbacks:
// grad(flat, idx) → {g, loss, count} (async: workers), evaluate(model) → numbers on the held-out samples,
// onEpoch(info) → false to stop. Returns the trained model; a stop keeps the weights of the last finished epoch.
async function nnTrain(opts) {
  const {nTrain, epochs, batch, lr} = opts,
    u = mulberry32((opts.seed || 1) >>> 0),
    w = nnFlat(opts.model),
    A = adamInit(w.length),
    perm = new Int32Array(nTrain);
  let best = opts.model;
  for (let ep = 0; ep < epochs; ep++) {
    const t0 = Date.now();
    for (let i = 0; i < nTrain; i++) perm[i] = i;
    for (let i = nTrain - 1; i > 0; i--) {
      const j = Math.floor(u() * (i + 1)),
        t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    let lsum = 0,
      lcount = 0,
      stopped = false;
    for (let i = 0; i < nTrain; i += batch) {
      const r = await opts.grad(w, perm.subarray(i, Math.min(nTrain, i + batch)));
      for (let q = 0; q < r.g.length; q++) r.g[q] /= r.count;
      adamStep(A, w, r.g, lr);
      lsum += r.loss;
      lcount += r.count;
      if (opts.shouldStop && opts.shouldStop()) {
        stopped = true;
        break;
      }
      if (opts.onStep) opts.onStep(ep + Math.min(1, (i + batch) / nTrain));
    }
    if (stopped) break;
    best = nnUnflat(opts.model, w);
    const ev = await opts.evaluate(best),
      go = opts.onEpoch ? opts.onEpoch({epoch: ep + 1, loss: lsum / Math.max(1, lcount), ev, ms: Date.now() - t0, model: best}) : true;
    if (go === false) break;
  }
  best.params = nnCount(best.layers);
  return best;
}
