# Proof by contrast: a green check is not proof

`machineVerify` re-runs the checks an operation declares and refuses a `done` the kernel cannot reproduce.
That settles one thing only: the checks pass at the operation's head. It does not show the behavior changed.
An operation that writes `assert.equal(typeof double,'function')` and wires it into its check list is green
forever, on the pre-change code as well as the new. The missing half of the proof is the contrast: the spec the
operation added must **fail before the change and pass after it**.

`scripts/gates/proof.mjs` supplies that half. It never edits the operation's worktree, never commits, and
never checks anything out there.

## Scope of the run (owner policy 2026-09-29)

An operation that writes or changes code writes or updates the unit specs of that code, and what it runs is only those
specs plus the specs that import the changed source, with lint, codegen and typecheck scoped by the op gate (`gate.mjs`). No
operation, kernel, supervisor lane, land or `.claude` upgrade runs the whole suite (`config.yaml specs.harness`, default
false = touching-only: the land gate runs `--specs touching` and refuses `--specs all`). The whole unit suite belongs to two
places: `unit.verify` (`npm test` at the app root, dispatched only when the goal or the owner asks for the full unit run) and the
`/push-git` flow (`scripts/supervisor/push-git.mjs`: the `.claude` suite and each bound app's full unit,
typecheck, lint, build and canon-scan, then the push). e2e runs only when the goal or the owner asks, and `e2e.verify` then
runs the full e2e suite. The contrast proof below judges the specs an operation added.

## The plan

`proofPlan(op,{changedFiles})` reads the operation's real changed files (from `changedFiles`, which comes from
`git status --porcelain` filtered to the allowlist - never from `report.files`) and keeps the ones matching
`/\.(spec|test|e2e-spec)\.[cm]?[jt]sx?$/`. Then it keeps the declared checks that actually run
one of those specs: the command names the path, or names the file, or the check's `scope` covers it.

The plan is `mode:'fail-before'` only when `PROOF_POLICY` asks for the contrast for this operation kind
(`backend.implement` and `interface.implement` today, everything else `checks-only`), there is at least one
changed spec, and some check runs it. Otherwise it is `mode:'checks-only'` with a `reason`, so a downgrade is
recorded rather than assumed.

The declared checks of a routine operation are unit + typecheck + lint + canon + build. E2E runs manually only
(owner ruling 2026-09-29): an `*.e2e-spec.ts` is re-run only by an operation that explicitly owns e2e
(`e2e.verify`, or `uat.*` for UAT), never by the routine proof of `backend.implement` or `interface.implement`.

Live integration verification (`integration.verify`: real OAuth/IdP, SMTP, payment or provider exchange with real
credentials) follows the same rule (owner ruling 2026-09-29): it runs only on an explicit request ("integration test",
the Vietnamese phrase for "integration test", "verify OAuth/SMTP/payment live", "live verification") or before release. The planner adds the leg only
when the goal asks; an already-approved leg the goal did not ask for settles `deferred` at once (never dispatched, no
attempt spent, nothing waits on it), and `starci kernel run-deferred-tests --workflow <wf> --kind integration` runs it when the owner wants it.

## The base worktree

`runAtBase` builds the "before" out of git, not out of a stash:

1. The runtime worktree API (`createWorktree` in `scripts/machine/worktrees.mjs`, kind `land-scratch`) adds a detached
   worktree at `<baseHead>` in a fresh `mkdtemp` directory, so the base is a real
   checkout of the commit the operation started from, beside the live worktree rather than inside it.
2. Only the changed **spec** files are copied into it - the new tests against the pre-change code. Nothing else from the
   operation's work crosses over; a spec that no longer exists is recorded in `missing`.
3. The proof commands run there (cwd = the temporary worktree), then the same commands run in the operation's
   worktree at `opHead`. Each result carries `exitCode`, a `tail` of the output and `timedOut`; `timeoutMs`
   defaults to 20 minutes per command.
4. In a `finally`, whatever happened above, `safeRemoveWorktree` (`scripts/machine/worktree-git.mjs`) removes every link
   inside the temporary worktree as a link, then the tree, and prunes its registration; never a forced `git worktree remove`,
   which would follow a junction into the live tree.

Paths are normalized with forward slashes and rejoined natively, so the same code drives Windows and POSIX.

## The verdicts

| verdict | what happened | what the kernel does |
| --- | --- | --- |
| `proven` | a proof command fails at base (not by timeout) and every command is green at head | accept the slice; the contrast belongs in the evidence manifest next to the re-run checks |
| `weak` | head is green but base is green too - the spec does not discriminate | accept, and carry `proofFinding(result)` into `open[]`/findings so a repair operation can sharpen the test. Not a hard failure |
| `contradiction` | a proof command fails at head | the slice is not done: the operation's own checks do not pass in its own worktree |
| `checks-only` | no changed spec, or a kind whose policy is `checks-only`, or no check runs the spec | `machineVerify` alone decides; nothing is run twice |

A base worktree that cannot be built is also `weak`, with `error` set: an unproven claim, never a silent pass.
A base command that only timed out does not count as a discriminating failure either - the contrast is
unknown, so the verdict stays `weak` and says why.

`proofFinding(result)` returns the single sentence for `open[]` - e.g. *the added spec `lib.spec.mjs` also
passes at base 5412ae012548: it does not prove the change* - and `null` for `proven` and `checks-only`.

## Evidence binding check

The contrast above proves a change at the moment it lands. `scripts/work/validate/check-evidence-binding.mjs` asks
the later question a recorded tree owes: does a `state: done` leaf's proof still bind to the source it claims
to prove? It walks record -> sibling `evidence.yaml` -> the source bytes that evidence names, reads only, and
prints one finding per line as `CODE  <record id>  <detail>`.

```sh
starci work evidence-binding --work <.starciwork root> [--json]
```

Every path a proof hashes is app-relative (`be/...`, `fe/...`) and resolves under the app root. `--json` emits `{findings:[{code,node,path,detail}]}` instead of lines.

| code | what it refuses |
| --- | --- |
| `EVIDENCE_PATH_MISSING` | the proof hashes a source file that is not on disk any more |
| `EVIDENCE_DIGEST_MISMATCH` | a hashed source file's bytes are no longer the bytes that were proven |
| `EVIDENCE_OLDER_THAN_SOURCE` | owned source the proof never hashed moved after the capture - after the record's own `revision` where git resolves it, otherwise after `provenance.capturedAt` by commit time, otherwise by file mtime. The finding names which clock answered |
| `EVIDENCE_ASSERTED_NOT_OBSERVED` | a `done` leaf rests on `verificationSource: authored-claim`, so nothing observed it. The three schemas `modules/schemas/work-layout.yaml` declares true by authorship - `work/data@1`, `work/brand@1`, `work/policy-decision@1` - are exempt |

Exit 0 is clean, 1 reports findings, 2 means invalid arguments or an unreadable declared input - the
convention the other read-only checks use.

Evidence that carries `stale: true` is passed over: it has already said it no longer describes the current
product, and refusing it for pointing at the past would punish the tree for being honest. Declared artifacts
- record `assets[]`, `ui.assets[]`, evidence `assets[]`, receipts and run manifests - are
`scripts/work/validate/check-work-artifacts.mjs`'s ground, and `recordDigest` plus the aggregate `codeDigest.digest`
are `scripts/work/validate/check-example-work.mjs`'s; this check opens neither.
