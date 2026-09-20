# Grit: what the first example's gates do and don't do for the second example

Written by the `starci183/ex-ms-be` lane while landing `examples/ecommerce-app-be` (the second
example product). Per the lane brief: gates that assume exactly one example are reported here,
not edited - `scripts/`, `scripts/checks/`, `.github/` and `tests/` are shared-file territory that lane
does not own. Findings #1-#5 and #7 are all about the shared surface; none of them is a defect in
the second example's own records or code. Section #6 records what each gate actually returned for
`examples/ecommerce-app-be`, including the two repo-wide gates that exit nonzero on the first
example's pre-existing staleness and the scoped-lint profile this lane leaves to its owner.

## 1. `.github/workflows/todo-app-example.yml` covers one example by path

The workflow's `records` job is actually multi-example-safe: `check-example-yaml.mjs` and
`check-example-work.mjs` walk every tree under `examples/`, so a second example's records are
gate-checked the moment they land. But the `backend`, `frontend`, `live` and `uat` jobs
hardcode `working-directory: examples/todo-app-backend` / `examples/todo-app-frontend` - the
second example's services get no compile/test/boot CI until someone adds the jobs (or
generalizes them into a matrix), which is a shared-file edit no example lane may make.

Also on `records`: at the time of writing it is RED from the first example's own pre-existing
rejections (stale `recordDigest`/`codeDigest` on two todo evidence files, one uat run missing
`videos/`, one stale `blockedBy` rev), and `scripts/checks/check-example-derived.mjs` refuses the todo
tree's stale `_derived`. Those are todo-tree facts from earlier lanes, untouched by
`ex-ms-be` (the boundary forbids editing `examples/todo-app-*`); they need a digest/derived
refresh pass on the todo tree by a lane that owns it.

## 2. `tests/build-entry.spec.mjs` hardcodes one example path

Line ~36 asserts every `.mjs` under `.dist` that does NOT start with `examples/todo-app-backend/`
is a declared runtime module. Today it is inert for any example, because
`scripts/build-workflows.mjs` deliberately excludes example `.mjs` from the mirror at all (the
kit `authored` whitelist is md/sh/ps1/conf/Dockerfile and the generic extension list has no
`.mjs`). But the assertion's prefix is a second copy of a fact the build no longer produces, and
the moment any future change mirrors example scripts, every non-todo example fails it by name.
A path list is doing a job the build already settles.

## 3. The prior owner ruling "examples/ keeps only the todo-app repositories"

Recorded in a comment in `tests/design-review.spec.mjs` (about the deleted
`examples/nested-business` fixture). This lane operates under a newer owner ruling delivered
with the `ex-ms-be` brief: a second example product lands at `examples/ecommerce-app-be`. The
design-review spec does not check examples content, so nothing breaks; noting it so the next
reader knows the comment is superseded, not violated.

## 4. Where the second example's ports live while the host registry catches up

`examples/ecommerce-app-be/metadata.json` is the resolved projection (offset 69: identity 5070,
order 6070, postgres 5501, redis 6448, FE landing/shop 3069/4069). The host registry
(`.workspaces/ports/`) has no `ecommerce-app.json` yet - writing it is a host action outside
every worktree lane's boundary, so the assignment is recorded in metadata.json's own
description. When the registry entry lands, it must agree with these numbers or the FE/BE lanes
drift - which is exactly the drift class the single-projection rule exists to prevent.

## 5. An installed second example breaks the shared build mirror and 61 of the suite's own tests

The example's own `Done means` starts with `cd examples/ecommerce-app-be && npm install`, and the
monorepo shape the brief asks for (`workspaces: ["apps/*"]`) makes npm publish its workspace links
under `examples/ecommerce-app-be/node_modules/@ecommerce-app-be/{identity,order}`. Two shared
surfaces then break, measured on this branch:

```
$ node scripts/ensure-build.mjs
Runtime reference cannot be a symlink: .../examples/ecommerce-app-be/node_modules/@ecommerce-app-be/identity
# exit 1, nothing written to .dist

$ npm test                      # with the example's dependencies installed
ℹ tests 2367   ℹ pass 2295   ℹ fail 66
```

61 of those 66 failures carry the same cause, named in their own error text -
`Runtime reference cannot be a symlink: .../ecommerce-app-be/node_modules/@ecommerce-app-be/identity`
(3 tests) or `Recursive option not enabled, cannot copy a directory:
\\?\...\ecommerce-app-be\node_modules/@ecommerce-app-be/identity/` (58 tests). They are
packaging, installer, CLI and doctor tests that copy or mirror the skill tree, so they die in
fixture setup on a link inside a gitignored directory; none reaches an assertion about this
example. The remaining 5 are not the install's either - re-run with this example's dependencies
removed and all 5 fail unchanged: one is the `json-exceptions` sorting defect #7 describes, and
four (`tests/workflow-kernel.spec.mjs`) abort on a host precondition,
`disk headroom below 1073741824 bytes: ... has 78544896` - this machine's temp volume sits under
the 1 GiB floor the kernel spec demands, which is about the box, not the branch.

Cause of the mirror throw, at `scripts/build-workflows.mjs`'s `docs`/`examples` walk:
`entry.isSymbolicLink()` throws on the first link it sees, and the only `node_modules` skip in that
block is guarded by `stackExample`, which matches just `.starcistacks/`, `scripts/`, `gateway/` and
the root `.gitignore` - not `node_modules/` at an example root. So an installed dependency tree is
walked like authored input, whatever it is named: renaming `node_modules` to `node_modules_off`
moved the error message (`...ecommerce-app-be\node_modules_off\@ecommerce-app-be\identity`) without
clearing it. The fs-copy helper behind the other 58 has the same blind spot with a different
failure (`recursive` not enabled on a linked directory).

Measured isolation (the dependency directory moved out of `examples/` entirely, then restored):
`ensure-build.mjs` exits 0 and reports `{"ok":true,"stale":[],"files":1467,"rebuilt":true}` with no
tracked file changed by the rebuild. So the second example's *authored* tree is mirror-clean; the
trigger is the install the brief mandates, not anything the example declares.

Why it is a finding and not a patch: `scripts/` and `tests/` are shared-file territory this lane
does not own. It is also latent in CI today - CI's example jobs `npm ci` at the repository root,
whose `node_modules` sits outside the `examples/` walk (`SKIP_DIR_NAMES` in
`check-json-exceptions.mjs` and the root `.gitignore` both already handle it), and no job installs
this example at all (finding #1). It bites every local run of `npm test`, `npm run build` and
`build:check` after someone follows this example's runbook, and it will bite CI the day someone
adds the install step finding #1 asks for. A lane that owns `scripts/` should skip dependency and
runtime directories at *every* example root, not only under the stack-kit prefixes, and pass
`recursive` where it copies.

## 6. What the second example's own gates actually measure

Recorded with numbers so "green" is checkable rather than asserted. Measured on this branch after
`npm install` (470 packages), both from the skill root and inside the example:

| gate | result |
| --- | --- |
| `npx tsc --noEmit` | exit 0, no output |
| `npx jest` | exit 0 - 6 suites, 18 tests, green with the dev stack stopped (they are true unit specs, no live dependency) |
| `npm run build` | exit 0 - `tsc -p tsconfig.build.json` |
| `scripts/checks/check-example-yaml.mjs` | exit 0 - "453 yaml file(s) under examples: all accepted" |
| `cli/main.mjs architecture check examples/ecommerce-app-be` | exit 0 - `ok: true`, `errors: []`, every coverage section `checked` or `not-applicable` |
| `compose --profile app config --quiet` | exit 0; `postgres` bound 5501, `redis` bound 6448, both `Up` |
| `scripts/live-proof.mjs` | exit 0 - 14/14 steps, both `/health` endpoints answering through real Postgres/Redis and order↔identity HTTP |
| `scripts/live-proof.mjs --expect-down` | exit 0 - "both services refuse, no answer was faked" |
| `node --test tests/example-work-gate.spec.mjs` | exit 0 - 23 pass, 0 fail |
| `scripts/checks/check-example-work.mjs` | **exit 1** - 4 refused, 15 warned; every line names `examples/todo-app-backend/...`, and no output line mentions `ecommerce-app-be` (grep-verified) |
| `scripts/checks/check-example-derived.mjs` | **exit 1** - "2 work tree(s) checked: 2 refused"; both refusals name `todo-app-backend/_derived`, from the counting in the gate itself (`problems.length`, not tree count) |
| `scripts/checks/check-scoped-lint.mjs --profile nest` | **exit 1** for both examples - see below |
| `scripts/checks/check-json-exceptions.mjs` | **exit 1** before visiting any example - see #7 |

The last four rows are the honest caveats on the brief's "Done means". The work and derived gates
are repo-wide: they exit nonzero on the first example's pre-existing staleness (finding #1), which
this lane may not touch. `examples/ecommerce-app-be` contributes nothing to either count - which
is what "the gate accepts your records" means here, and it is why the exit code alone cannot be
quoted as the example's result.

### The nest scoped-lint profile

Measured issue counts, same command for both trees:

| rule | `ecommerce-app-be` | `todo-app-backend` |
| --- | --- | --- |
| `NEST_IMPORT_FORMAT` (violations) | 207 | 1241 |
| `NEST_MEMBER_DOCUMENTATION` (violations) | 195 | 1013 |
| `NEST_COMMENT_FORM` (violations) | 1 | 20 |
| `ARCHITECTURE_VIOLATION` | 0 | 67 |
| `SCRIPT_INPUT_UNAVAILABLE` (`NEST_TEST_SUBJECT_FORM` + 3 contract shapes) | 24 | 6 |
| `ESLINT_UNAVAILABLE` | 1 | 1 |
| files with pattern violations | 59 | 390 |

Both report `status: unavailable`, and the two dominant violation classes are the same in each
tree, so this is the house profile's known red that CI already guards off with `if: false` and
lane `ex-be-nest` owns - not a second-example-specific gap. This lane deliberately did **not**
mass-reformat 59 files to shrink its column: the docblock rule asks for real per-member
responsibility prose, so filling 195 slots with generated filler would buy a quieter report and a
worse example, and a half-cleaned tree diverges from the sibling the brief says to model on.

Two lint items were fixed instead, both inside `examples/ecommerce-app-be/**`:

- `NEST_JEST_ALIAS_PARITY` ("the declared TypeScript project differs from the project used by
  ts-jest") was a real config defect and is gone - measured 425→424 issues, 60→59 files. The
  checker resolves `ts-jest`'s `tsconfig` string against `rootDir` itself, so the
  `<rootDir>/tsconfig.json` token the sibling example also uses reads as a different project
  (`.../ecommerce-app-be/<rootDir>/tsconfig.json`). Using the relative `tsconfig.json` names the
  same file in a form the checker can evaluate; jest stays green. The sibling carries the same
  token but never got checked for it - its metadata check aborts earlier on
  `Cannot find module 'jest/package.json'`, so this rule had never actually run against any
  example before this one.
- `.starcistacks/dev/infra/compose/compose.yaml` now declares `name: ecommerce-app-be-dev`. The
  runbook's commands passed no project name, so Compose fell back to the folder holding the file
  and the same runbook started a *second* stack (`compose-postgres-1`) that collided on 5501 with
  the named one (`Bind for 0.0.0.0:5501 failed: port is already allocated`). With the name
  declared, `ps`/`up`/`down` resolve to the stack the README actually means from any directory.

## 7. `schemas/json-exceptions.yaml` allowlists example JSON by exact todo-app path

The gate's contract is "fail if any authored `*.json` under the skill root is outside
`schemas/json-exceptions.yaml`", and the file lists the first example's JSON one path at a time -
`examples/todo-app-backend/{architecture.json, package.json, package-lock.json, tsconfig.json,
tsconfig.build.json, .starcistacks/dev/environment.json, .starciwork/ledger-anchor.json}` plus 41
UAT run artifacts. Every entry is prefixed `examples/todo-app-backend/`; nothing matches
`examples/ecommerce-app-be/`. This example carries 9 authored JSON files that the list cannot see:

```
examples/ecommerce-app-be/architecture.json          (todo analogue exists)
examples/ecommerce-app-be/package.json               (todo analogue exists)
examples/ecommerce-app-be/package-lock.json          (todo analogue exists)
examples/ecommerce-app-be/tsconfig.json              (todo analogue exists)
examples/ecommerce-app-be/tsconfig.build.json        (todo analogue exists)
examples/ecommerce-app-be/.starcistacks/dev/environment.json  (todo analogue exists)
examples/ecommerce-app-be/metadata.json              (no analogue: the resolved port projection)
examples/ecommerce-app-be/apps/identity/package.json (no analogue: the monorepo has per-app manifests)
examples/ecommerce-app-be/apps/order/package.json    (no analogue: the monorepo has per-app manifests)
```

Six are the same *kind* of file the todo example already declares, so they need six sibling
entries; three are new kinds this topology introduces (`metadata.json` as the single port
projection, and one `package.json` per workspace package), which is the interesting part - an
allowlist shaped like one repository's `src/` cannot name a monorepo's per-package manifests
without restating the pattern per app. A glob (`examples/*/package.json`, `examples/*/*/package.json`,
`examples/*/metadata.json`) is what the list wants to be; that is a shared-schema edit.

This is not visible as a refusal today, because the gate throws before it walks anything:
`node scripts/checks/check-json-exceptions.mjs` exits 1 with
`json-exceptions paths must be uniquely sorted (localeCompare)`, a self-consistency check of the
tracked `schemas/json-exceptions.yaml` itself. That ordering defect is **pre-existing on `main`**
(`git status` shows this lane modified no tracked file, and the throw happens while loading the
exceptions list, before any example is visited) and it also accounts for
`tests/json-exceptions.spec.mjs`'s "checker CLI succeeds only when the installed authored source is
clean" in the 66. Fix the ordering and this gate will start refusing the second example's nine
paths - so the two belong in the same fix, and neither is this lane's to make.
