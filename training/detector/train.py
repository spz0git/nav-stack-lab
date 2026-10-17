#!/usr/bin/env python3
"""The learned people detector: a small 1D convolutional network over the 120 lidar beams (circular padding) that
labels each beam "person" or "static". Input: 6 channels per beam (range/8, previous range/8, their difference,
hit flag, and the odometry's v and ω broadcast); output: one logit per beam. Trained on training/data/ from
tools/collect-detector.mjs, with the last run held out, class-weighted BCE for the 3 % of positive beams.
Writes src/models/detector.json: the layers as flat weight lists the page's nn.js runs.

    python3 training/detector/train.py [--epochs 40]
"""
import json, sys, time
from pathlib import Path
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'training' / 'data'
meta = json.load(open(D / 'detector.json'))
NB, CH = meta['beams'], meta['channels']
X = np.fromfile(D / 'detector-x.f32', dtype=np.float32).reshape(meta['scans'], NB, CH).transpose(0, 2, 1)  # [N, C, B]
Y = np.fromfile(D / 'detector-y.u8', dtype=np.uint8).reshape(meta['scans'], NB).astype(np.float32)
# hold the last run out (a seed and level the network has not seen)
n_hold = meta['runs'][-1]['scans']
Xtr, Ytr, Xte, Yte = X[:-n_hold], Y[:-n_hold], X[-n_hold:], Y[-n_hold:]
torch.manual_seed(0)

class CircConv(nn.Module):
    def __init__(self, cin, cout, k):
        super().__init__(); self.c = nn.Conv1d(cin, cout, k); self.k = k
    def forward(self, x):
        p = self.k // 2
        if p == 0: return self.c(x)
        return self.c(torch.cat([x[..., -p:], x, x[..., :p]], dim=-1))   # circular: beam 119 neighbours beam 0

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.l = nn.ModuleList([CircConv(CH, 24, 7), CircConv(24, 24, 7), CircConv(24, 24, 5), CircConv(24, 1, 1)])
    def forward(self, x):
        for i, l in enumerate(self.l):
            x = l(x)
            if i < len(self.l) - 1: x = F.relu(x)
        return x[:, 0]

net = Net()
epochs = int(sys.argv[sys.argv.index('--epochs') + 1]) if '--epochs' in sys.argv else 40
opt = torch.optim.Adam(net.parameters(), lr=2e-3)
pos_w = torch.tensor(float(np.sqrt((1 - Ytr.mean()) / Ytr.mean())))   # the square root of the class ratio: recall without drowning in false beams
xt, yt = torch.tensor(Xtr), torch.tensor(Ytr)
xe, ye = torch.tensor(Xte), torch.tensor(Yte)
t0 = time.time()
for ep in range(epochs):
    net.train(); perm = torch.randperm(len(xt))
    for i in range(0, len(xt), 128):
        idx = perm[i:i + 128]
        loss = F.binary_cross_entropy_with_logits(net(xt[idx]), yt[idx], pos_weight=pos_w)
        opt.zero_grad(); loss.backward(); opt.step()
    if ep % 5 == 4 or ep == epochs - 1:
        net.eval()
        with torch.no_grad():
            p = (torch.sigmoid(net(xe)) > 0.6).float()   # the page's threshold
            tp = (p * ye).sum().item(); fp = (p * (1 - ye)).sum().item(); fn = ((1 - p) * ye).sum().item()
        print(f'epoch {ep + 1}: loss {loss.item():.3f}  held-out precision {tp / max(1, tp + fp):.3f} recall {tp / max(1, tp + fn):.3f}  ({time.time() - t0:.0f} s)')
# export: each layer's weights as [cout][cin][k] flattened row-major, biases, kernel size, activation
layers = []
for i, l in enumerate(net.l):
    w = l.c.weight.detach().numpy(); b = l.c.bias.detach().numpy()
    layers.append({'type': 'conv1d', 'cin': w.shape[1], 'cout': w.shape[0], 'k': w.shape[2], 'pad': 'circular',
                   'act': 'relu' if i < len(net.l) - 1 else 'sigmoid',
                   'w': [round(float(v), 5) for v in w.flatten()], 'b': [round(float(v), 5) for v in b]})
n_params = sum(len(l['w']) + len(l['b']) for l in layers)
out = {'name': 'detector', 'input': {'beams': NB, 'channels': CH, 'order': ['range/8', 'previous range/8', 'change (±1)', 'hit', 'v/1.5', 'w/2']},
       'output': 'probability per beam that its hit lies on a person', 'params': n_params,
       'trained_on': {'scans': int(len(Xtr)), 'runs': meta['runs'][:-1]}, 'held_out': meta['runs'][-1], 'layers': layers}
(ROOT / 'src' / 'models').mkdir(exist_ok=True)
json.dump(out, open(ROOT / 'src' / 'models' / 'detector.json', 'w'), separators=(',', ':'))
print(f'wrote src/models/detector.json: {n_params} parameters, {(ROOT / "src" / "models" / "detector.json").stat().st_size // 1024} KB')
