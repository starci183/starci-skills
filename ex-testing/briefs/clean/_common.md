# CLEAN wave — shared rules

Working dir: `.claude` repo root (this IS a nested git repo at `D:\Repositories\starci-academy-backend\.claude`; all paths below are relative to it).

## Mission

Repo root still carries ~20 dirs from the old JSON-workflow era (`cli/`, `contracts/`, `execution/`, `sites/`, ...). Goal: every top-level entry is either **canon** (stays), **legacy** (`git mv` into `legacy/`), or **junk** (deleted). Target root after this wave:

```
SKILL.md VERSION README.md INDEX.yaml package.json
modules/ kernel/ core/ scripts/ schemas/ sqlite/ knowledge/
packages/ examples/ tests/ fixtures/ hosts/ bin/
.experiments/ ex-testing/ legacy/ node_modules/ .github/ .git/
```

(dirs not listed = your job to triage.)

## Classification rules

- **CANON — never move:** `modules/`, `kernel/`, `core/`, `knowledge/`, `packages/`, `examples/`, `tests/`, `fixtures/`, `schemas/`, `sqlite/`, `scripts/checks/`, `scripts/route/`, `.experiments/`, `ex-testing/`, `legacy/`, `bin/` (starci CLI entry), `hosts/` (orca launcher — dispatch-op uses it). Confirm `bin/`+`hosts/` live before assuming; if your probe shows a file is dead you may still move its DEAD siblings only.
- **LEGACY:** referenced only by `legacy/` or superseded by `modules/*` equivalents (e.g. old `model/` patterns). Move with `git mv <path> legacy/<name>` (preserve history). If the dir is untracked, `mv` then it's just a move.
- **JUNK:** accidental artifacts — dirs named `--help`, `0`, `m[1]).join('/')` etc. created by shell quoting bugs. Delete only if contents are empty or clearly garbage; if it contains real work, keep and report instead.
- **Unsure → LIVE:** when in doubt leave it and write the doubt in your report. A false-negative move breaks the runtime.

## Process

1. For each owned path: grep who imports/references it (`grep -rn "dirname" --include="*.mjs" .` excluding node_modules/.git/legacy itself). `kernel/`, `bin/`, `scripts/`, `tests/`, `package.json` `files`/`exports`, `SKILL.md` refs = live evidence.
2. `git mv` dead dirs to `legacy/`; then `grep -rn` the old path and fix every broken import within YOUR scope. Cross-scope breakage → record in report's `needed_elsewhere`, don't touch foreign files.
3. After moves: `node --check` any edited file; run the closest spec (`node --test tests/<name>.spec.mjs`).
4. Verify no new `.dist/` created; `knowledge/` untouched; **no commit**.

## Output

`ex-testing/lint/c<N>-REPORT.md` with a per-path verdict table (path → live/legacy/junk + evidence) and `touch ex-testing/lint/done/c<N>.done`. Blocked → `c<N>-BLOCKED.md` naming the exact blocker.
