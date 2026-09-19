# EXUP wave — upgrade examples toward production bar

Read `.claude/SKILL.md` + `OPENSOURCE-GOAL.md` (repo root) first. Target: `.claude/examples/` must become a template good enough to open-source — real infra, real seeds, real tests, real evidence.

## Ground truth (measured)
- todo-app-backend: 117 unit specs, ~13 e2e journeys, coverage lines 94% / branches **55%** (weak), seeds = 2 sql files (thin), 242 UAT artifacts (png+webm), compose infra at `.starcistacks/dev/infra/compose`
- todo-app-frontend: only 23 specs (thin)
- `.repo/fullstack-mastery-module-*` has reference material (file-upload module 12 etc.)

## Rules
- Respect OWNERSHIP in your brief — other lanes own other dirs; cross-dir needs go in report "needed elsewhere"
- All work stays inside `.claude/examples/todo-app-backend` or `todo-app-frontend` unless your brief says otherwise
- Tests must be real journeys (TestingModule, real clients) — no stub theater
- Evidence must be fresh artifacts, not assertions
- Marker `.claude/ex-testing/lint/done/exup-<n>.done` + report `.claude/ex-testing/lint/exup-<n>-REPORT.md`
