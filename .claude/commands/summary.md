---
description: Regenerate docs/PROJECT-SUMMARY.md, the short summary Spy's master vault reads (format 2)
argument-hint: "[write-only]"
---

<!-- This command is managed from Spy's vault (~/Work/.claude/project-feeds/summary-command.md).
     Edit it there and run /refresh; a copy edited here is overwritten on the next refresh. -->

Write `docs/PROJECT-SUMMARY.md` for this repository. Spy's master vault reads it, together with the summaries of his other projects, to know what he is working on and to plan what comes next. It is a briefing, not documentation: short, current, and the same shape in every project.

## Sources

Read the repo's own planning and status docs (README, PRD, PLAN, STATUS, roadmap, design, CHANGELOG: whatever this repo has), `src/version.json` or the package version if there is one, `git log` since the date in the existing summary's `updated` field, and open PRs (`gh pr list`) if `gh` works. State only what these sources support. Do not copy the previous summary forward without checking it.

## Format

Fill in this template exactly: the same frontmatter keys and the same four `## ` headings, in this order. A script checks them.

```markdown
---
format: 2
project: <registry key: the repository name>
title: <display name>
kind: <code | practice | content>
source: <GitHub URL>
commit: <short hash of origin/main when written>
updated: <YYYY-MM-DD>
status: <active | paused | blocked | done>
stage: <one line: where it stands, with the version or milestone>
next_action: <one line: the single most useful next step>
blocked_on: <one line, or "nothing">
confidential: <true | false>
---

# <Title>

## What it is
<2–4 sentences: what it is, for whom, where it lives (live page or deployment if any).>

## Status
<3–6 bullets: where it stands, the latest release or milestone with its date, health (tests, CI), what is waiting on Spy.>

## Features and scope
<Up to 10 bullets: what exists today, one line each.>
<Then one line: "Out of scope: ..." for what the project deliberately does not do.>

## Next big items
<Up to 5, in order. Each: the item — who (Spy / Claude / external) · rough size.>
```

Rules:
- 250–450 words, not counting the frontmatter. Pick what matters for planning across projects; detail stays in the repo's own docs.
- Frontmatter values are single lines, no comments. Absolute dates only (2026-10-22, not "yesterday").
- Never drop a section; write "None" if one is empty.
- No priority field and no ranking against other projects: the vault does that.

## Delivery

- If the arguments include `write-only`: write the file and stop. Do not commit, push or open a PR; the caller does that.
- Otherwise, if you are on a branch other than `main`: commit the summary on that branch so it lands with the branch's PR.
- Otherwise, on `main`: if this repo's CLAUDE.md says work goes through PRs, put the summary on a branch `docs/summary-<date>`, push it, open a PR and merge it (documentation only: no gate, version or republish). If not, commit to `main` and push.

Finish by replying with the `stage` and `next_action` lines and anything the sources left unclear.
