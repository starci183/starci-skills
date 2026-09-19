# v8-1 lane report — `scripts/check-work-replay.mjs` (evidence replay engine)

Scope: one new file, `.claude/scripts/check-work-replay.mjs`, plus its fixture spec
`tests/work-replay.spec.mjs`. No existing script, record or `.starciwork` tree was edited.

## What it checks

Walks every `evidence.yaml` across the example `.starciwork` trees (or `--tree <path>`) and turns
each assertion `command` into an executable spec `{command, cwd}`:

- **cwd resolution order** (per brief): `assertion.cwd` → `evidence.cwd` → the record's
  `repository` via `repoRootFor` → the backend root. Reaching the last step emits SUSPECT
  `ASSERTION_NO_CWD` (once per evidence file, with the affected assertion count).
- **Dry-run verdicts** (default, side-effect-free): per assertion `REPLAYABLE` or
  `NOT_REPLAYABLE`. A command is dead when its executable is missing (literal path under cwd,
  cwd-local file, or PATH lookup via `where`/`which`), when `npm run <s>` names a script absent
  from the resolved repo's `package.json`, when `npx <tool>` finds the tool in no
  `node_modules/.bin` up the tree nor on PATH, or when a path token resolves nowhere.
- **Test-runner semantics**: positional args of jest/vitest commands (and of `npm run` scripts
  whose body invokes a runner, including tokens after `--`) are matched as patterns — literal
  path, then basename-prefix / normalized-substring over the repo file list — not as literal
  paths. This is what separates `buyer.controller.spec` (matches `buyer.controller.spec.ts`,
  replayable) from `tasks/complete` (matches nothing, dead).
- **Real shell decomposition**: `cd X && …` folds into the effective cwd; `KEY=V` prefixes are
  peeled into spawn env; `bash -c "…"` payloads are analyzed recursively; `docker exec` args past
  the container name are not host paths and are skipped.
- **`--run <recordId|--all>`**: executes via `child_process.spawn` — argv-direct where the plan is
  a single simple command (resolved to a real `.exe` on Windows), `cmd /c` for `.cmd`/extensionless
  shims (npm/npx) and for any plan still carrying pipes/sequencing. Reports `REPLAY_PASS` /
  `REPLAY_FAIL` / `REPLAY_TIMEOUT` (default 120s, `--timeout <s>`; SIGTERM then SIGKILL after 2s)
  with the tail of captured output. A `REPLAY_FAIL` on an assertion recorded `pass` is REFUSE-tier;
  one recorded `fail` that still fails is INFO-consistent.
- **`--record <id>`** filters the surveyed set. Summary line: `N replayable, M dead, K executed
  (P pass / F fail)` plus the refuse/suspect/info counts; exit code non-zero on any REFUSE.

## Design decisions

- **Read-only is enforced structurally, not promised**: `>`/`>>` redirect targets are stripped
  from the executed command and stdout is captured into the report instead. Several real
  assertions end in `> assets/direction-check.txt` — replaying verbatim would silently overwrite
  the captured artifact the evidence cites. Re-capture is `example-evidence.mjs`'s job.
- **Severity follows the cwd's confidence, not the miss itself**: dead-under-stamped-cwd is
  deterministic → REFUSE; dead under the backend-root fallback is a verdict resting on a guess →
  SUSPECT (paired with `ASSERTION_NO_CWD`). Today that means every dead finding is SUSPECT,
  because no evidence file in the tree stamps `cwd`/`repository`/`commit` yet — which is itself
  the audit's point.
- **Alternate-base probing** turns a bare "dead" into "dead under `examples/X` — resolves under
  `.` instead, so the recorded cwd was probably there." The spec's cwd chain is kept strict; the
  diagnostic is what makes the missing stamp actionable.
- **Replayability is host-relative**: `which`/`where` is a real lookup. `cat`, `bash`, `findstr`,
  `docker` all resolve on this host via Git/System32; on a host without them those assertions are
  genuinely not replayable and the verdict says so.
- Sequential execution in `--run`: assertions share ports/databases/temp dirs; parallel replay
  would manufacture failures the evidence never claimed.

## Live findings (snapshot — v7 lanes are churning records)

`node scripts/check-work-replay.mjs` (both trees, dry-run):

```
265 replayable, 26 dead, 0 executed (0 pass / 0 fail)
0 refused, 118 suspect, 267 info
```

Per tree: todo-app-backend — 105 evidence files, 257 assertions, `246 replayable, 11 dead`;
ecommerce-app-be — 13 evidence files, 34 assertions, `19 replayable, 15 dead`.

Every dead verdict is SUSPECT (all sit under a guessed cwd). Verbatim representatives:

- Toolkit-rooted commands (ui/brand records — the scripts live under `.claude`, the resolution
  lands on the backend root):
  `…/features/task/ui/list/evidence.yaml: assertion direction-assets-inputs-coverage
  NOT_REPLAYABLE - path examples/todo-app-backend/.starciwork/features/task/ui/list/assets/verify-direction.mjs
  not found under examples/todo-app-backend - resolves under . instead, so the recorded cwd was
  probably there`
- Record-dir-relative command (`journey.login.first-sign-in`, hand-written evidence):
  `…/journey/first-sign-in/evidence.yaml: assertion uat-login-sign-in-run NOT_REPLAYABLE - path
  ../../uat/sign-in/runs/20260918T090054Z-240aa95e/result.md not found under
  examples/todo-app-backend - resolves under …/journey/first-sign-in instead`
- Dead jest passthrough filters (`npm run test:e2e -- tasks/complete` — the dir is
  `src/tests/e2e/task/`, singular; jest exits 1 on an empty pattern, so these are genuinely dead
  today):
  `…/task/fr/complete/evidence.yaml: assertion e2e NOT_REPLAYABLE - passthrough pattern
  "tasks/complete" matches no path or file under examples/todo-app-backend`

`--run` was exercised for real (execution is opt-in; `--run --all` was deliberately not fired —
it would spend minutes in jest suites and hit live-proof scripts that need servers):

- `--run impl.plan.todo-app-backend.plan`: `8 executed (8 pass / 0 fail)` — real `npx jest` runs
  against `src/modules/bussiness/plan/*`.
- `--run journey.login.first-sign-in`: `REPLAY_FAIL`, exit 1, tail verbatim:
  `/usr/bin/cat: ../../uat/sign-in/runs/20260918T090054Z-240aa95e/result.md: No such file or
  directory` — the wrong-cwd replay fails exactly as the dry-run verdict predicted.

## False-positive rate observed

Zero REFUSE on the live trees; all 26 dead verdicts are SUSPECT by the guessed-cwd rule and every
one of them is a true positive in the sense the lane cares about: the assertion cannot be replayed
*as recorded* because its cwd is unrecoverable from the file. The two `tasks/*` filter misses are
the only content-level dead commands and they reproduce check-work-deep's PROOF_FILTER_EMPTY
territory from the executable side. Host-dependence caveat: `docker`, `curl.exe` and the Git-bash
tools resolved on this host; a minimal-CI host would report more dead executables — correctly.

## Deliberately not checked

- **No `evidence.repository`/`evidence.commit` stamps**: the brief's cwd order is
  assertion.cwd → evidence.cwd → record.repository → backend root; `evidence.repository` is
  recognized by check-work-deep as a context stamp but is not in the chain, so it is not consulted.
- **No `-t`/name-filter resolution** (`PROOF_FILTER_EMPTY` belongs to check-work-deep); no
  outcome-versus-codeDigest comparison; no rewriting of `exit`/`outcome` — replay never mutates
  `evidence.yaml`.
- **`docker exec` inner argv** is not host-checked (container namespace); **`npx` package
  fetchability** is treated as dead rather than "would download" (a fetched binary is not the
  pinned tool).
- **Exit-code ≠ recorded-exit comparison** beyond pass/fail: a recorded `exit: 1` that replays as
  `exit: 2` is reported as consistent-fail INFO, not a mismatch — the granularity is the verdict,
  not the integer.

## Fixture test

`tests/work-replay.spec.mjs` — 8 tests, all passing (`node --test tests/work-replay.spec.mjs`):
repository-stamped cwd resolution, REFUSE-tier dead npm script, fallback downgrade +
`ASSERTION_NO_CWD`, alt-base "resolves under" diagnostics, stamp precedence, plan parsing
(env/redirect/cd-fold), real `runAssertion` pass/fail/timeout + redirect-strip safety, and the
no-command verdict. Convention matched: `node:test`, fixtures under `<drive>/starci-tmp`.
