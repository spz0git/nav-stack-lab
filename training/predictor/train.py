#!/usr/bin/env python3
"""The learned people predictor: a multilayer perceptron from a tracked person's last second (in the person's frame),
the robot's position and velocity, and eight rays of free space, to K = 3 futures over the next 3 s (six points each,
0.5 s apart) with a probability each. It outputs the correction to constant velocity: zeros are constant velocity.
Trained on training/data/ from tools/collect-pred.mjs, with the held-out runs at the end (the last two seeds of each
level), by the negative log-likelihood of a mixture of K Gaussians with a fixed σ:

    L = -log Σ_k π_k N(y; μ_k, σ² I)

whose gradient moves each mode towards the futures it explains best (its responsibility) and each probability towards
that responsibility. Adam with a cosine learning-rate decay. Writes src/models/predictor.json: the dense layers as flat
weight lists the page's nn.js runs (mlpForward), with K, the horizon and σ.

    python3 training/predictor/train.py [--epochs 60] [--sigma 0.3]
"""
import json, sys, time, math
from pathlib import Path
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'training' / 'data'
meta = json.load(open(D / 'predictor.json'))
NF, NY = meta['features'], meta['outputs']
K, H = 3, [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
NH = len(H)
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
epochs, SIG, HID = arg('--epochs', 60), arg('--sigma', 0.3), arg('--hidden', 64)
X = np.fromfile(D / 'predictor-x.f32', dtype=np.float32).reshape(meta['samples'], NF)
Y = np.fromfile(D / 'predictor-y.f32', dtype=np.float32).reshape(meta['samples'], NY)
n_hold = sum(r['samples'] for r in meta['held_out'])
Xtr, Ytr, Xte, Yte = X[:-n_hold], Y[:-n_hold], X[-n_hold:], Y[-n_hold:]
torch.manual_seed(0)

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.l = nn.ModuleList([nn.Linear(NF, HID), nn.Linear(HID, HID), nn.Linear(HID, K + K * NY)])
    def forward(self, x):
        for i, l in enumerate(self.l):
            x = l(x)
            if i < len(self.l) - 1: x = F.relu(x)
        return x

def mix_nll(z, y):
    # z: [N, K + K·12] (logits, then each mode's 12 numbers); y: [N, 12]. Mean over samples of
    # -log Σ_k softmax(z)_k exp(-|y - μ_k|² / 2σ²), the Gaussian's constant left out (it does not move the gradient)
    logit, mu = z[:, :K], z[:, K:].reshape(-1, K, NY)
    d2 = ((mu - y[:, None, :]) ** 2).sum(-1)
    return -(torch.logsumexp(F.log_softmax(logit, -1) - d2 / (2 * SIG * SIG), -1)).mean()

def errors(z, y):
    # the most probable mode's error at 1 s and 2 s, the best mode's (min over K), and constant velocity's (zero correction)
    mu = z[:, K:].reshape(-1, K, NH, 2); yy = y.reshape(-1, NH, 2)
    e = ((mu - yy[:, None]) ** 2).sum(-1).sqrt()                # [N, K, NH]
    top = z[:, :K].argmax(-1)
    et = e[torch.arange(len(e)), top]                            # [N, NH]
    eb = e.min(1).values
    ecv = (yy ** 2).sum(-1).sqrt()
    return {k: (v[:, 1].mean().item(), v[:, 3].mean().item()) for k, v in (('cv', ecv), ('top', et), ('best', eb))}

net = Net()
opt = torch.optim.Adam(net.parameters(), lr=2e-3)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, epochs)
xt, yt, xe, ye = map(torch.tensor, (Xtr, Ytr, Xte, Yte))
t0 = time.time()
for ep in range(epochs):
    net.train(); perm = torch.randperm(len(xt))
    for i in range(0, len(xt), 256):
        idx = perm[i:i + 256]
        loss = mix_nll(net(xt[idx]), yt[idx])
        opt.zero_grad(); loss.backward(); opt.step()
    sched.step()
    if ep % 5 == 4 or ep == epochs - 1:
        net.eval()
        with torch.no_grad():
            ze = net(xe); E = errors(ze, ye); le = mix_nll(ze, ye).item()
        print(f"epoch {ep + 1}: loss {loss.item():.3f} held-out {le:.3f}  at 1 s / 2 s: constant velocity {E['cv'][0]:.3f} / {E['cv'][1]:.3f} m,"
              f" most probable mode {E['top'][0]:.3f} / {E['top'][1]:.3f}, best of {K} {E['best'][0]:.3f} / {E['best'][1]:.3f}  ({time.time() - t0:.0f} s)")
net.eval()
o = 0
with torch.no_grad():
    for r in meta['held_out']:
        sl = slice(o, o + r['samples']); o += r['samples']
        E = errors(net(xe[sl]), ye[sl])
        print(f"held out {r['level']} seed {r['seed']} ({r['people']}, {r['spd']}): at 1 s / 2 s constant velocity {E['cv'][0]:.3f} / {E['cv'][1]:.3f} m,"
              f" learned {E['top'][0]:.3f} / {E['top'][1]:.3f}, best of {K} {E['best'][0]:.3f} / {E['best'][1]:.3f}")
    pk = F.softmax(net(xe)[:, :K], -1).mean(0).numpy()
    print('mean mode probabilities on the held-out runs:', ' '.join(f'{v:.2f}' for v in pk))
layers = []
for i, l in enumerate(net.l):
    w = l.weight.detach().numpy(); b = l.bias.detach().numpy()
    layers.append({'type': 'dense', 'nin': w.shape[1], 'nout': w.shape[0], 'act': 'relu' if i < len(net.l) - 1 else 'none',
                   'w': [float(f'{v:.4g}') for v in w.flatten()], 'b': [float(f'{v:.4g}') for v in b]})
n_params = sum(len(l['w']) + len(l['b']) for l in layers)
out = {'name': 'predictor',
       'input': {'features': NF, 'order': ['5 past positions (x, y) at 0.2…1 s ago, m', 'velocity (x, y), m/s', 'robot position /4', 'robot velocity, m/s', '8 rays of free space /4']},
       'output': f'{K} logits, then for each mode 6 points (0.5…3 s) of (x, y) minus the constant-velocity point, m, in the person frame',
       'K': K, 'horizon': H, 'sigma': SIG, 'params': n_params,
       'trained_on': {'samples': int(len(Xtr)), 'runs': meta['runs'][:len(meta['runs']) - len(meta['held_out'])]}, 'held_out': meta['held_out'], 'layers': layers}
json.dump(out, open(ROOT / 'src' / 'models' / 'predictor.json', 'w'), separators=(',', ':'))
print(f'wrote src/models/predictor.json: {n_params} parameters, {(ROOT / "src" / "models" / "predictor.json").stat().st_size // 1024} KB')
