# Nav Stack Lab

A robot navigation simulator that runs in your browser. It is one HTML file: nothing to install, works offline,
works on a phone.

**Try it:** download [`dist/nav-stack-lab.html`](dist/nav-stack-lab.html) and open it in a browser. (The demo at
https://spz0git.github.io/nav-stack-lab/ goes live when GitHub Pages is turned on; see `docs/maintaining.md`.)

![The busy floor level: a particle filter tracks the robot while the speed planner yields to people](docs/readme/hero.png)

## What it does

A small robot drives missions on seven floors, from an empty room to a parking lot and a moose test. You choose how
it localizes (dead reckoning, EKF, particle filter, EKF-SLAM), how it maps (known map or lidar occupancy), how it
plans (A*, RRT*, Hybrid A*, space-time A*) and how it steers (pure pursuit, Stanley, rear-wheel feedback, PID, DWA,
MPC). You can also write your own controller, planner, localizer or predictor in JavaScript and drop it in. There
are people walking around, another vehicle, sensor noise, latency, and a car model with tyre slip.

The page has three modes:

- **Simulate** is the lab itself. The map, a timeline you can scrub back through, plots of any signal, an event log,
  health lights per subsystem, and runs you can keep and compare.
- **Analyze** linearizes the steering loop and shows you Bode and Nyquist plots, step responses and poles you can
  drag, then checks the linear model against the real simulation.
- **Learn** has 41 lessons and eight chapters. Each lesson has buttons that set the lab up and run the experiment
  for you, and shows the code behind what it teaches: the page's own function, with the lesson's lines marked, and an
  "Edit and run" button that puts a plain version of it in the Code tab for you to change. The numbers in the lessons
  come from the simulator, not from a textbook. A learning track has begun: a learned people detector and an
  end-to-end driving policy, both trained in PyTorch on the simulator's own ground truth (`training/`) and run in the page
  as plain JavaScript, with lessons that measure where each works and where it does not.

It is meant for students and engineers who want to see localization, perception, planning and control interact,
change one thing, and watch what happens. Design notes, known limits and what comes next are in
[docs/roadmap.md](docs/roadmap.md).

## Run it locally

```sh
git clone https://github.com/spz0git/nav-stack-lab.git
cd nav-stack-lab
./build.sh
open dist/nav-stack-lab.html
```

You need Node 18 or newer. There are no other dependencies.

## Tests

```sh
npm test                    # Node only, about 10 s
python3 tests/run_all.py    # drives the page in a headless browser, about 3 min
```

The browser tests need Playwright and a Chromium once:
`python3 -m venv .venv && source .venv/bin/activate && pip install playwright && playwright install chromium`.
What each test checks is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains what kind of change fits and the
tests every PR runs; [docs/good-first-issues.md](docs/good-first-issues.md) has a few small ones to start with;
[src/README.md](src/README.md) is the map of the source.

If you use the lab in a course or a paper, [CITATION.cff](CITATION.cff) has the citation.

## Licence

MIT, see [LICENSE](LICENSE). The embedded fonts and the vendored TeX converter keep their own licences, listed in
[NOTICE](NOTICE).
