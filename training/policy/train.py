#!/usr/bin/env python3
"""The end-to-end policy: a multilayer perceptron from the lidar scan, the odometry and the goal in the robot frame
(127 numbers) to eight waypoints over the next four seconds (16 numbers, robot frame, in units of 4 m), trained by
behaviour cloning on training/data/ from tools/collect-policy.mjs: the expert's path ahead while the executed
commands were perturbed (noise injection), so the policy also learns to come back to the path. The last run is held out and the waypoint error reported in metres. Writes src/models/policy.json.

    python3 training/policy/train.py [--epochs 100]
"""
import json, sys, time
from pathlib import Path
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'training' / 'data'
# every tagged dataset in training/data/ (expert demonstrations, DAgger rollouts); the first one's last run is held out
metas = [json.load(open(f)) for f in sorted(D.glob('policy-*.json'))]
NF, NW = metas[0]['features'], metas[0]['waypoints']
Xs, Ys = [], []
for m in metas:
    Xs.append(np.fromfile(D / f"policy-{m['tag']}-x.f32", dtype=np.float32).reshape(m['samples'], NF))
    Ys.append(np.fromfile(D / f"policy-{m['tag']}-y.f32", dtype=np.float32).reshape(m['samples'], 2 * NW))
n_hold = metas[0]['runs'][-1]['samples']
Xte, Yte = Xs[0][-n_hold:], Ys[0][-n_hold:]
Xtr = np.concatenate([Xs[0][:-n_hold]] + Xs[1:]); Ytr = np.concatenate([Ys[0][:-n_hold]] + Ys[1:])
print('datasets:', ', '.join(f"{m['tag']} ({m['mode']}, {m['samples']})" for m in metas), f'→ {len(Xtr)} train, {len(Xte)} held out')
meta = metas[0]
torch.manual_seed(0)
H = 256
net = nn.Sequential(nn.Linear(NF, H), nn.ReLU(), nn.Linear(H, H), nn.ReLU(), nn.Linear(H, 2 * NW))
epochs = int(sys.argv[sys.argv.index('--epochs') + 1]) if '--epochs' in sys.argv else 100
opt = torch.optim.Adam(net.parameters(), lr=1e-3)
xt, yt, xe, ye = map(torch.tensor, (Xtr, Ytr, Xte, Yte))
t0 = time.time()
for ep in range(epochs):
    net.train(); perm = torch.randperm(len(xt))
    for i in range(0, len(xt), 256):
        idx = perm[i:i + 256]
        loss = F.mse_loss(net(xt[idx]), yt[idx])
        opt.zero_grad(); loss.backward(); opt.step()
    if ep % 10 == 9 or ep == epochs - 1:
        net.eval()
        with torch.no_grad():
            err = (net(xe) - ye).reshape(-1, NW, 2) * 4   # metres
            per_wp = err.norm(dim=2).pow(2).mean(dim=0).sqrt()
        print(f'epoch {ep + 1}: loss {loss.item():.4f}  held-out RMS error per waypoint [m]: ' + ' '.join(f'{v:.2f}' for v in per_wp.tolist()) + f'  ({time.time() - t0:.0f} s)')
layers = []
for i, l in enumerate([net[0], net[2], net[4]]):
    w = l.weight.detach().numpy(); b = l.bias.detach().numpy()
    layers.append({'type': 'dense', 'nin': w.shape[1], 'nout': w.shape[0], 'act': 'relu' if i < 2 else 'none',
                   'w': [round(float(v), 3) for v in w.flatten()], 'b': [round(float(v), 3) for v in b]})
n_params = sum(len(l['w']) + len(l['b']) for l in layers)
out = {'name': 'policy', 'input': {'features': NF, 'order': ['120 ranges/8', '12 sector minima/8', 'goal dx/10', 'goal dy/10', 'distance/10', 'cos bearing', 'sin bearing', 'v/1.5', 'w/2']},
       'output': f'{NW} waypoints {meta["step"]} m apart in the robot frame, units of 4 m', 'params': n_params,
       'trained_on': {'samples': int(len(Xtr)), 'datasets': [{'tag': m['tag'], 'mode': m['mode'], 'samples': m['samples']} for m in metas]}, 'held_out': meta['runs'][-1], 'layers': layers}
(ROOT / 'src' / 'models').mkdir(exist_ok=True)
json.dump(out, open(ROOT / 'src' / 'models' / 'policy.json', 'w'), separators=(',', ':'))
print(f'wrote src/models/policy.json: {n_params} parameters, {(ROOT / "src" / "models" / "policy.json").stat().st_size // 1024} KB')
