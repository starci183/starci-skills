---
name: canon-tmp-triage
description: Classification table for the 214 files in `_canon_tmp`. Use when you need to know which files go into the library, which get merged, which stay as reference.
status: WAITING FOR THE TEACHER TO MARK — no file moved yet
---

# Phase 0 — Inventory of `_canon_tmp`

## Done

| Task | Result |
|---|---|
| Backed up outside the repo | `D:\Repositories\_backup\canon_tmp_2026-07-30` — **244/244 files · 1,186.2 KB · matched** |
| Confirmed gitignore | `.gitignore:89` → `.claude/_canon_tmp/` · 0 files tracked in the backend repo |

## Finding — corrects an assumption in PLAN

`_canon_tmp` is **not a temp folder**. It's a **nested clone** of the private canon repo:

```
origin  https://github.com/starci183/starci-claude-canon
branch  master … origin/master   (no unpushed commits)
dirty   19 files
```

**The atomics/frames/composites library DOES EXIST** — 214 files, all three tiers present. Finding A in `PLAN.md` is wrong: the library isn't missing, it's **sitting in the wrong repo**. `.claude/fe/` has only kept `principles/` since commit `0afc910b`.

## Risk still live

19 uncommitted files, of which **8 are new and have never been tracked**:

| File | KB |
|---|---:|
| `fe/prototypes/flashcard-quiz.html` | 28.5 |
| `fe/prototypes/rewards-and-quests.html` | 14.2 |
| `fe/proposals/flashcard-quiz.proposal.md` | 11.4 |
| `fe/proposals/streak-coin-and-daily-quest.proposal.md` | 11.1 |
| `fe/proposals/mock-interview-history-stats.proposal.md` | 10.3 |
| `fe/proposals/mock-interview-time-limit-and-typewriter.proposal.md` | 9.4 |
| `fe/patterns/setup-screen-tabs-for-history-stats.md` | 3.7 |
| `fe/features/rewards.md` | 2.7 |

Plus 11 modified-but-uncommitted files (+172 −18 lines), the heaviest being `fe/prototypes/mock-interview.html` (+114).

**Not pushing is an outside action — I don't do that on my own.** The backup already covers the risk of losing the disk.

---

## Mapping onto the teacher's three tiers

| `_canon_tmp` folder | Files | Tier | Action |
|---|---:|---|---|
| `fe/foundations/` | 12 | **foundation tokens** | → `kho/foundations/` |
| `fe/components/` | 32 | **atomics** | → `kho/atoms/` |
| `fe/patterns/` | 17 | **frames** | → `kho/frames/` |
| `fe/layouts/` | 15 | **composites** | → `kho/composites/` |
| `fe/features/` | 24 | business logic | kept separate, not library |
| `fe/engineering/` | 16 | engineering rules | → merge into the existing `patterns/fe/` |
| `fe/product/` | 9 | product rules | kept separate |
| `fe/principles/` | 22 | **collision** | see below |
| `fe/proposals/` | 7 | decision history | kept for reference |
| `fe/prototypes/` | 5 | HTML for human eyes | kept, not loaded into context |
| `be/concepts/` | 25 | — | → merge into `patterns/be/` |
| `be/rules/` | 17 | — | → merge into `patterns/be/` |
| `skills/` | 8 | old-generation skills | see below |

---

## Two collisions — need the teacher's decision

### Collision 1 — two generations of `principles/`

| Aspect | `_canon_tmp/fe/principles/` | `.claude/fe/principles/` |
|---|---|---|
| File count | 22 | 15 |
| Type | standalone rules by topic | 15 fixed axes, each axis with `context.md` + `example.html` |
| Example | `accent-system.md` 7.3 KB · `landing-marketing.md` 12.3 KB · `persuasion-psychology.md` 4.8 KB · `no-emoji.md` · `no-uppercase-text.md` | `color/` · `text/` · `frame/` · `seam/` · `prominence/` … |

Seven files on the old side have **no corresponding slot** in the 15 axes: `persuasion-psychology`, `landing-marketing`,
`content-voice`, `grounded-in-data`, `progressive-disclosure`, `design-restraint`,
`advanced-tech-flexes-capability-not-decoration`.

**Three paths:** (a) open axis 16+ for the uncovered part · (b) push it down into `references/` of the nearest axis ·
(c) split it into its own `principles/product/`, since these talk about persuasion/content, not visuals.

### Collision 2 — 8 old-generation skills

`starci-doc-audit` · `starci-fe-block-apply` · `starci-fe-block-brainstorm` ·
`starci-fe-consolidate-components-apply` · `starci-fe-consolidate-components-scan` ·
`starci-fe-layout-brainstorm` · `starci-fe-skeleton-apply` · `starci-fe-ux-apply`

`.claude/skills/` currently only has the 3 new-generation skills left. Are these eight **dead or dormant?** If dormant,
`starci-fe-consolidate-components-scan` and `starci-fe-skeleton-apply` are exactly what Phase 1 needs.

---

## No file classified as "DROP"

Inventory of the 214 files is done: no junk drafts found. The "drop" column in the original plan is **empty**. Phase 0's
job shifts from *rescuing from the trash* to *putting things in their right place*.

---

## Waiting on the teacher

1. Collision 1 — pick (a), (b), or (c)?
2. Collision 2 — 8 old skills: which to revive, which to bury?
3. 19 uncommitted files in the private canon repo — will the teacher push them, or do you want me to draft the commit for you to hit the button on?
4. Is `.claude-max-pro-vip` **a new `.claude` built in parallel**, or just **a folder of planning docs**?
