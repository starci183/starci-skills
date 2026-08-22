# Source gates

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@stale-debts` | `readiness/staleness/debts/context.md` | context | scoped, measured, expiring owner debt |

## Stale signature

The repository's own declared gate contract is absent, incomplete, fails, or is not executable for every
routed role. The mandatory order is **format → lint → typecheck → build → unit coverage → E2E → Sonar**.
Lint passes only with exactly 0 errors and 0 warnings. A command the repository does not declare is an
absent gate, not a pass.

Unit coverage must report statements/lines (S/L), functions (F) and branches: S/L/F ≥80%, branches ≥75%,
and every patch/new-code metric ≥90%. E2E must name a declared entrypoint that exists, contain real tests,
and pass all tests. `skip`, `todo`, `only`, `passWithNoTests`, zero-test runs, or a focused/check substitute are rejects.
Sonar is the final gate and must pass for every routed role. No gate may be weakened or reordered.
Unit is the sole coverage producer for Codecov and Sonar; E2E is an independent behavioral lane and may
neither mutate nor contribute to that coverage, and E2E files are excluded from the Sonar scanner scope.
E2E and Sonar verdicts never imply or relabel each other.
Across frontend and backend, unit files are colocated beside their production owner and use `.spec.`.
Only backend E2E may occupy a separate test tree; a frontend `src/tests`/`e2e` bucket or any unit `.test.` file is stale.
Patch/new-code is explicitly `not applicable` only when a base-SHA diff proves there is no changed
authored production code; an empty working-tree diff, missing base SHA or missing coverage entry is not N/A.

An active `@stale-debts` record may classify only project coverage, patch coverage or Sonar as `debt`.
The measured gate remains red/unmeasured and never supports `ready`; delivery alone may continue. Lint,
typecheck, build, unit execution and E2E remain blocking and cannot be debt.

## Lane separation

Unit coverage and E2E are independent gates. The unit lane is the only coverage producer: it emits the
LCOV and four-metric summaries consumed by Codecov and Sonar. The E2E lane proves deployed or integrated
behavior only; it must not generate, merge, overwrite, delete or improve unit coverage evidence, and its
files are excluded from Sonar analysis and coverage. E2E pass cannot imply Sonar pass, Sonar pass cannot imply E2E
pass, and a failure in one lane must be reported under that lane rather than relabelled as the other.

## List evidence

Read the manifest and list declared primary entrypoints for every routed role. Run every gate in the
mandatory order above; do not skip E2E or Sonar because they are expensive. Generated caches and ignored
output are allowed; tracked source mutation is not. Record command, exit code, lint errors/warnings,
coverage metrics, E2E entrypoint/test/pass counts and Sonar verdict. A missing prerequisite, entrypoint,
real test, coverage report or external Sonar evidence is `unmeasured`/`absent` and cannot support `ready`.
Read `.worktrees/<project>/debts/<role>.md` after the route verifies and report accepted findings separately.

## Repair inventory

Read the manifest before running anything. Do not invent commands. Run existing declared gates in the
mandatory order: format, lint, typecheck, build, unit coverage, E2E, Sonar. Record exact errors, warnings,
coverage metrics, failing-suite/test counts, entrypoint existence and Sonar status before the first source
write. A missing mandatory gate is a finding, never permission to continue.

## Apply

Classify findings before repair:

| Class | Apply |
|---|---|
| `format` | one mechanical ESLint-owned formatting pass |
| `mechanical` | safe autofix, then read every hunk |
| `defect` | smallest hand repair, one file owner at a time |
| `decision` | return to owner; never weaken a gate |

Formatting, mechanical changes and defects are separate commits. Never add disables, lower severity,
remove a rule, skip a test or add `any` merely to buy green.

## Proof

Run the exact original gates again, in the same order, and report before/after counts and metrics. Zero is
valid only with the same commands, checkout revision and machine, without suppression. A ready verdict
requires format pass; lint 0 errors/0 warnings; typecheck/build pass; unit S/L/F ≥80%, branches ≥75% and
patch/new metrics ≥90%; declared real E2E entrypoint with all tests passing; and final Sonar pass.
Verdict `debt` may allow delivery under `@stale-debts`; it is not a ready verdict or a gate pass.
