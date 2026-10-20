#!/usr/bin/env python3
"""The end-to-end policy: a multilayer perceptron from the lidar scan, the odometry and the goal in the robot frame
(139 numbers) to K = 4 candidate paths of eight waypoints each (16 numbers per candidate, robot frame, in units of
4 m) and a score per candidate, trained by behaviour cloning on training/data/ from tools/collect-policy.mjs: the
expert's path ahead while the executed commands were perturbed (noise injection), so the policy also learns to come
back to the path.

Where the demonstrations went either way around an obstacle, a single path fitted by least squares is the average of
the two, a path through the obstacle. So the loss is the people predictor's (training/predictor/train.py): the
negative log-likelihood of a mixture of K Gaussians with a fixed σ,

    L = -log Σ_k π_k N(y; μ_k, σ² I),   π = softmax(scores)

whose gradient moves each candidate towards the routes it explains best (its responsibility, nearly
winner-takes-all at a small σ) and each score towards how often it does: one candidate can learn "left of the
shelf", another "right of it". The defaults reproduce src/models/policy.json (training seeds 0 and 1 drive a little worse
in the lessons' runs, all three far better than a single path). The page takes the best-scoring candidate whose segments clear the costmap.
The first dataset's last run is held out; the error of the best-scoring candidate and of the best of K is reported
per waypoint in metres. Writes src/models/policy.json.

    python3 training/policy/train.py [--epochs 100] [--K 4] [--sigma 0.05] [--seed 2]
"""
import json, sys, time
from pathlib import Path
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'training' / 'data'
# every tagged dataset in training/data/ (expert demonstrations, DAgger rollouts); the first one's last run is held out
metas = [json.load(open(f)) for f in sorted(D.glob('policy-*.json'))]
NF, NW = metas[0]['features'], metas[0]['waypoints']
NY = 2 * NW
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
epochs, K, SIG, H, SEED = arg('--epochs', 100), arg('--K', 4), arg('--sigma', 0.05), arg('--hidden', 256), arg('--seed', 2)
Xs, Ys = [], []
for m in metas:
    Xs.append(np.fromfile(D / f"policy-{m['tag']}-x.f32", dtype=np.float32).reshape(m['samples'], NF))
    Ys.append(np.fromfile(D / f"policy-{m['tag']}-y.f32", dtype=np.float32).reshape(m['samples'], NY))
n_hold = metas[0]['runs'][-1]['samples']
Xte, Yte = Xs[0][-n_hold:], Ys[0][-n_hold:]
Xtr = np.concatenate([Xs[0][:-n_hold]] + Xs[1:]); Ytr = np.concatenate([Ys[0][:-n_hold]] + Ys[1:])
print('datasets:', ', '.join(f"{m['tag']} ({m['mode']}, {m['samples']})" for m in metas), f'→ {len(Xtr)} train, {len(Xte)} held out')
meta = metas[0]
torch.manual_seed(SEED)
net = nn.Sequential(nn.Linear(NF, H), nn.ReLU(), nn.Linear(H, H), nn.ReLU(), nn.Linear(H, K + K * NY))

def mix_nll(z, y):
    # z: [N, K + K·16] (scores, then each candidate's 16 numbers); y: [N, 16]. Mean over samples of
    # -log Σ_k softmax(z)_k exp(-|y - μ_k|² / 2σ²), the Gaussian's constant left out (it does not move the gradient)
    logit, mu = z[:, :K], z[:, K:].reshape(-1, K, NY)
    d2 = ((mu - y[:, None, :]) ** 2).sum(-1)
    return -(torch.logsumexp(F.log_softmax(logit, -1) - d2 / (2 * SIG * SIG), -1)).mean()

def errors(z, y):
    # RMS error per waypoint in metres of the best-scoring candidate and of the best of K (the one nearest the route),
    # and how often each candidate scores best
    mu = z[:, K:].reshape(-1, K, NW, 2); yy = y.reshape(-1, NW, 2)
    e2 = (((mu - yy[:, None]) * 4) ** 2).sum(-1)                 # [N, K, NW], m²
    top = z[:, :K].argmax(-1)
    rms = lambda a: a.mean(0).sqrt()
    best = e2.sum(-1).argmin(-1)
    ar = torch.arange(len(e2))
    return rms(e2[ar, top]), rms(e2[ar, best]), torch.bincount(top, minlength=K).float() / len(top)

opt = torch.optim.Adam(net.parameters(), lr=1e-3)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, epochs)
xt, yt, xe, ye = map(torch.tensor, (Xtr, Ytr, Xte, Yte))
fmt = lambda v: ' '.join(f'{x:.2f}' for x in v.tolist())
t0 = time.time()
for ep in range(epochs):
    net.train(); perm = torch.randperm(len(xt))
    for i in range(0, len(xt), 256):
        idx = perm[i:i + 256]
        loss = mix_nll(net(xt[idx]), yt[idx])
        opt.zero_grad(); loss.backward(); opt.step()
    sched.step()
    if ep % 10 == 9 or ep == epochs - 1:
        net.eval()
        with torch.no_grad():
            et, eb, share = errors(net(xe), ye)
        print(f'epoch {ep + 1}: loss {loss.item():.3f}  held-out RMS per waypoint [m], best-scoring: {fmt(et)}  best of {K}: {fmt(eb)}'
              f'  scored best: {fmt(share)}  ({time.time() - t0:.0f} s)')
layers = []
for i, l in enumerate([net[0], net[2], net[4]]):
    w = l.weight.detach().numpy(); b = l.bias.detach().numpy()
    layers.append({'type': 'dense', 'nin': w.shape[1], 'nout': w.shape[0], 'act': 'relu' if i < 2 else 'none',
                   'w': [round(float(v), 3) for v in w.flatten()], 'b': [round(float(v), 3) for v in b]})
n_params = sum(len(l['w']) + len(l['b']) for l in layers)
out = {'name': 'policy', 'input': {'features': NF, 'order': ['120 ranges/8', '12 sector minima/8', 'goal dx/10', 'goal dy/10', 'distance/10', 'cos bearing', 'sin bearing', 'v/1.5', 'w/2']},
       'output': f'{K} scores, then {K} candidate paths of {NW} waypoints {meta["step"]} m apart in the robot frame, units of 4 m',
       'K': K, 'sigma': SIG, 'params': n_params,
       'trained_on': {'samples': int(len(Xtr)), 'datasets': [{'tag': m['tag'], 'mode': m['mode'], 'samples': m['samples']} for m in metas]}, 'held_out': meta['runs'][-1], 'layers': layers}
(ROOT / 'src' / 'models').mkdir(exist_ok=True)
json.dump(out, open(ROOT / 'src' / 'models' / 'policy.json', 'w'), separators=(',', ':'))
print(f'wrote src/models/policy.json: {n_params} parameters, {(ROOT / "src" / "models" / "policy.json").stat().st_size // 1024} KB')
