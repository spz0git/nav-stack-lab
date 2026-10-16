/* ============================================================
   Small neural networks in plain JavaScript: the forward pass of the learned blocks whose weights the build inlines
   from src/models/*.json (MODELS). A 1D convolution over the lidar beams with circular padding, ReLU and sigmoid: a
   few thousand parameters, a fraction of a millisecond per scan. No training here (training/).
   ============================================================ */
// @code nn-forward | nnForward: the forward pass, one circular 1D convolution per layer
function nnForward(model, x, n) {
  // x: Float32Array of n positions × cin channels, channel-minor (x[pos * cin + c]); returns the last layer's output
  let cur = x,
    cin = model.layers[0].cin;
  for (const L of model.layers) {
    const {cout, k, w, b} = L,
      p = k >> 1,
      out = new Float32Array(n * cout);
    for (let i = 0; i < n; i++)
      for (let o = 0; o < cout; o++) {
        let s = b[o];
        for (let j = 0; j < k; j++) {
          const ii = (i + j - p + n) % n, // circular: beam 119 neighbours beam 0
            base = (o * cin + 0) * k + j;
          for (let c = 0; c < cin; c++) s += w[base + c * k] * cur[ii * cin + c];
        }
        out[i * cout + o] = L.act === 'relu' ? (s > 0 ? s : 0) : L.act === 'sigmoid' ? 1 / (1 + Math.exp(-s)) : s;
      }
    cur = out;
    cin = cout;
  }
  return cur;
}
// @end
