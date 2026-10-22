---
description: Regenerate docs/PROJECT-SUMMARY.md in the shared project-summary format (format 1)
---

Regenerate `docs/PROJECT-SUMMARY.md` for this repository. A master planning vault reads this file at the start of every session, one-way, alongside the summaries of Spy's other projects, so every project uses exactly the same format.

## Sources

Read, in this order: the existing `docs/PROJECT-SUMMARY.md` (keep what is still true), the repo's own planning and status docs (PRD, PLAN, STATUS, roadmap, CHANGELOG, OPERATIONS, or whatever this repo has), `git log` since the last summary update, and open PRs and issues if `gh` is available. State only what these sources support; mark anything you inferred as such.

## Format rules

- Use the template below exactly: the same frontmatter keys, and the same ten `## ` headings with the same numbers, words and order. A script checks them.
- Never drop a section. If it has nothing, write "None".
- Frontmatter values are single lines with no comments. `updated` is today's date. `commit` is the short hash of `HEAD` before this commit.
- `next_action` is the single most useful next step. `blocked_on` is "nothing" if nothing blocks it.
- Do not add a priority field or rank this project against others; that happens in the master vault.
- Aim for about 1,500 words. Point to files in section 10 rather than repeating them.
- Absolute dates only (2026-10-22, not "last week").
- Describe the current state. History belongs in the repo's own changelog or decision log.

## Template

```markdown
---
format: 1
project: <registry key, e.g. team-app>
title: <display name>
kind: <code | practice | content>
source: <~/Repos/x, a GitHub URL, or "claude.ai project: X">
commit: <short HEAD hash when written; "-" if not a repo>
updated: <YYYY-MM-DD>
status: <active | paused | blocked | done>
stage: <one line: where it stands>
next_action: <one line: the single next thing to do>
blocked_on: <one line, or "nothing">
confidential: <true | false>
---

# <Title>

## 1. Identity
What it is, for whom, where it lives (repo, links), the one-line pitch, and any hard rules a plan must keep.

## 2. Current state
Where it stands now, health (tests, CI), last activity, running cost if any.

## 3. What exists
Capabilities or assets, at most 10 bullets. Stack in one line if code.

## 4. Plan
| Phase | What | State |
|---|---|---|

## 5. Next steps
Ordered. Each: **what** — who (Spy / Claude / external) · size · trigger or deadline.

## 6. Decisions waiting on Spy
| Decision | Blocks | Notes |
|---|---|---|

## 7. Risks and known issues

## 8. Success metrics
Targets and the current reading, or "None yet".

## 9. Links to other projects
Use the other projects' registry keys (team-app, coaching-app, nav-stack-lab, steps, ...).

## 10. Where to look
Files or docs that hold the detail.
```

## Before you finish

1. Check the file: frontmatter starts on line 1 with `---`, all twelve keys are present, and all ten headings appear exactly as above.
2. Commit it. If this session also changed code, include the summary in that commit; otherwise commit it alone as `docs: refresh project summary`. The vault reads the committed version on the main branch, so an uncommitted or unmerged summary is not what the master sees.
3. Reply with the `stage` and `next_action` lines and anything you were unsure about.
