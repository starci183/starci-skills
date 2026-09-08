# Consuming @starci/grammar 0.4.12 in nivo-fe on StarCi Skills 2.1.4

Session `20260905-170300-nivo-environment.preflight`, run by one processor (bound profile per
operator, ran profile `fable`, recorded on every receipt as `boundProfile`/`ranProfile`) on the
runtime at 2.1.4 (`d396668c`, the head of `origin/main` at the time; nothing newer to pull at the
end of the session). Frontend only: the mission consumed the family release 0.4.12 in `nivo-fe`,
served it, audited it, walked it and published it. Backend, schema, dark mode and the production
deploy stayed out, as the prompt said.

The confirmed goal is the dispatch prompt as stated (`goal:…:v1`, `selectedBy: user`, `sourceRef`
the prompt). All six done-when lines are evidenced; the sixth was published on the second push
after the repository's own hook refused the first, which is the story worth keeping below.

## Mission table

| # | Done-when line | Verdict | Where | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 0 | `library.update` consume `@starci/grammar` 0.4.12 on a session branch from main `e2f4968f` | **DONE** | `c1e87320` on `session/20260905-170300-nivo-environment.preflight`, cut from main and carrying the regression spec `64a19de0` | `apps/app/package.json` pins `0.4.12` (exact) and the lockfile moves only that package's entries; the consumer regression `GrammarFamilyOverflow.spec.tsx` fails before (exit 1: no `data-grammar-overflow` stamp, body claims `OVERFLOW-1 OVERFLOW-2`) and passes after; typecheck, lint, test and build green; the before-audits are the 0.4.9 gap audit (`20260905-074125…/step-12/parallel-2`) and the 0.4.11 heading audit (`20260905-130417…/step-13/parallel-2`), the after-audit is this session's `step-5` | `step-3/parallel-1/` |
| 1 | `runtime.serve` `nivo/fe` on 3067 at the session head under the lease | **DONE** | `uat` merge `a9758e09` (contains `c1e87320`), gates typecheck/lint-check/test-ci/build green on the merged head, served on 3067 replacing `293e56e3`; `nivo/be` on 3068 at `9693eee1` untouched | the three conflicting hunks against the held 0.4.11 state (manifest 16-16, lockfile 42-42 and 62-74) resolved `incoming-session-owned`; `apps/app` resolves 0.4.12, the root hoist stays 0.4.11 | `step-4/parallel-1/` |
| 2 | `interface.audit` playwright on the control centre and the Setup page at 0.4.12 | **DONE** | `step-5/parallel-1` (control centre, 636 claims) and `step-5/parallel-2` (Setup, 593 claims), four captures each at 1441x1000 and 390x844 | the three claims the mission named are closed: `OVERFLOW-3` on the shell region, `OVERFLOW-2` and `PADDING-4` on the frameless SurfaceCard body no longer stand, the family now stamps `OVERFLOW-4` / `OVERFLOW-1 + PADDING-0` and renders them; `FONT-4` measures 20px/600/28px and `FONT-3` 16px/600/24px on every capture, so the 0.4.11 heading regression is closed; **zero application-owned failures on both surfaces**; the one failure left is family-owned (below) | `step-5/parallel-1/`, `step-5/parallel-2/` |
| 3 | `quality.verify` green at the session head | **DONE** (gate verdict `pass`; scorecard `blocked` as the audit's rows carry) | `c1e87320` in the session worktree | six required gates pass in forced runs: format and lint as forced turbo eslint runs with the architecture check (zero warnings), typecheck, build, unit-coverage 89.21/88.17/87.68/89.21 against 80/80/80/75 (166 files, 744 tests; patch coverage not applicable — no changed production file), presentation sweep over the two manifest paths (0 files scanned, clean); worktree clean after the gates | `step-6/parallel-1/` |
| 4 | `uat.verify` `module-setup`, two cases at the new head, run appended | **DONE** | run `20260905-175907-c1e8732` on 3067 at `a9758e09`, backend `793eaad8` on 3068 | `setup-loads-owned-fixture` (1441x1000) and `setup-compact-390` (390x844) both 10/10 steps by pressing from the Setup deep link, the seeded installation heading observed; behavior pass; ui carries the audit's one family-owned failure; experience `fix-first` at mean 3.9091 — the same eleven scores as the run before it at `e2f4968`, with `UX-9` passing (the send action sits at y=764 inside the 844 frame). Appended under `agentos-modules/module-setup/runs/`, `latest.json` and `history.md` moved; findings and unchecked ledgers recorded | `step-7/parallel-1/` |
| 5 | `git.publish` `nivo-fe` main through `.husky/pre-push` | **DONE on the second push** | fast-forward `e2f4968f → c1e87320` (two commits: the spec and the consume), pushed non-force to `origin` (`starci-lab/nivo-fe`) | the first push was refused by the hook — see below; after `npm ci --ignore-scripts` the second push passed `lint:check` and `test:unit` (166 files, 744 tests) inside the push; no `--no-verify`, no force, no reset, no stash; session worktree and branch removed | `step-8/parallel-1/` |

## What the hook taught

The `pre-push` hook of `nivo-fe` runs `lint:check && test:unit` in the checkout that pushes — the
canonical `D:/Repositories/nivo-fe`, not the session worktree that ran the gates. After the
fast-forward that checkout's lockfile pinned 0.4.12 but its installed `apps/app/node_modules` still
held 0.4.9, so the new regression spec failed there exactly as the consume proof's `consumer-before`
run had predicted (`push-attempt-1.log`: 1 file, 2 tests failing, 742 passing). That is the hook
doing its job on a dependency change: the spec is the very thing that makes a stale install visible.
The repair was `npm ci --ignore-scripts` in the canonical checkout (`install.log`: the lockfile is
never written by `npm ci`; the checkout stayed clean; `apps/app` resolves 0.4.12, the root hoist
0.4.8), and the second push went through with the hook green.

Two things to carry into `git.publish` for a dependency change:

- The publish preflight should compare the canonical checkout's installed version of every package
  the change record moves against the lockfile it is about to fast-forward onto, and reinstall
  before the push rather than let the hook discover it. The receipt now names the two pushes and
  the install as evidence; the contract's `Hooks` table only admits `passed|failed`, so the story
  lives in prose beside it.
- The remote answered the accepted push with its own notice that three required status checks were
  bypassed for `refs/heads/main` — a GitHub ruleset the pushing account is allowed past. The receipt
  records it as the remote's statement; it is not a hook of the repository and the operator did
  nothing to bypass it. Whether main should require the checks to land first is the owner's
  question, not the runtime's.

## What stayed open

- **`VerticalScrollRegion` `OVERFLOW-3`** (region "Tin nhắn thiết lập" on the Setup page): the
  family stamps `OVERFLOW-3` and renders `overflow: auto` on both axes at 0.4.12, so the claim fails
  on all four Setup captures. It is the one failing claim on both audited surfaces, routed
  `grammar-gap` to the family owner, recorded in `brief.blocked` and in the findings ledger. Neither
  0.4.11 nor 0.4.12 touched it. The taste lens on the Setup page also keeps `TASTE-6` and `TASTE-12`
  failing at mean 3.33 as it did at 0.4.9 and 0.4.11 — unchanged by the family version.
- **Three manifests stay at 0.4.8.** The consume validator requires one pinned base version across
  every declared manifest, and the release lacks a `family` field for the audit-shaped consume, so
  only `apps/app` moved; `expert`, `landing` and `ui` still declare 0.4.8 and resolve the root hoist.
  Reported as an exclusion on the consume receipt.
- **The experience lens is `fix-first`, not `ship`,** for the same reason as the run before it: two
  criteria (a wrong input's recovery, sub-second feedback on the initiator) are not exercised by the
  two-case walk and hold the neutral midpoint, which keeps the mean below four. No criterion moved
  with the consume.

## Runtime defects and detours worth a rule

- `install.mjs release` (the tarball path) writes `file:` specs into the manifest, so the consume
  installed from the registry with `--save-exact --workspace apps/app --ignore-scripts`; npm then
  dropped seven `peer: true` flags and rewrote CRLF→LF in the lockfile, which the metadata gate
  refused as "lock changed another dependency" until the flags, key order and line endings were
  restored by hand (final lock delta: 5 lines, all the package's own entries).
- Importing `20260905-130417…/step-13/parallel-2` as a producer was refused ("origin is not the
  named completed producer": stale step metadata), so the 0.4.11 heading audit is cited by path.
- `host-artifacts.mjs --stop` exits 13 with a top-level-await warning after succeeding.
- The `quality.verify` format and lint gates must pass turbo's `--force` before the `--`, otherwise
  the flag reaches eslint and the gate fails on an unknown option; and the coverage receipt reads the
  `Statements/Branches/Functions/Lines : n%` summary, not an `All files` row, from `vitest --coverage`.
- A `uat-walk` file's `run.cases` must start its order at 1 inside its own walk; the capture record's
  `order` is then aligned to the frozen snapshot's order (the compact case is 2) as the previous run
  did.

## Heads at the end

| What | Where | Head |
| --- | --- | --- |
| `nivo-fe` main (origin) | `starci-lab/nivo-fe` | `c1e87320dc5cb6a3a11211654ccb363b9881e1ba` |
| `nivo/fe` served on 3067 | `.worktrees/nivo/uat` (`uat`) | `a9758e0965134c2d72f5613119ebb5abab5e82b2` |
| `nivo/be` served on 3068 | `.worktrees/runtime/nivo-be` | `9693eee1` (contains main `793eaad8`) |
| UAT run | `.worktrees/uat/agentos-modules/module-setup/runs/20260905-175907-c1e8732` | `result.json`, `snapshot.json`, `run.md` |
