Owner: modules/models/code-patterns.yaml
# Code pattern enforcement

`modules/models/code-patterns.yaml` is the executable inventory for the fixed StarCi NestJS and Next.js code profiles. The authored manifest, not every rule exported by an installed lint package, decides which code obligations apply. The runtime reads this authored manifest directly.

## Command and operation

The lint of a repository is `starci app lint` (the ESLint canon plus `starci app check`, one `starci/lint@1` report); a code-writing op
runs it over its changed files through `starci gate run --root <app> --changed <files...>` (ops name it
`starci-gate`). The layout and public owners come from `hfs.json` and the slot manifest. The gate prints one
`starci/gate@1` JSON report: exit `0` clean, `1` findings new against the base, `2` a tool could not run.
`review.verify` in `lint` mode runs the whole-repository `starci app lint --format json` plus the selected Work/stack checks and
any additional project checks. The manifest `modules/models/code-patterns.yaml` is the rule inventory the check-hfs-rules
parity gate and canon-scan read. Finding an issue
settles only a measurement; repairing source and completing delivery retain their
own authority and evidence.

## Result contract

Each obligation has a stable ID, source knowledge rule IDs, path applicability, a mechanical requirement, its exact machine, and any remaining semantic review. `status` has only three values:

- `implemented`: the named machine exists. A pass still requires the exact target files, config and source revision to be checked cleanly.
- `missing`: the requirement is mechanical but its named checker is not implemented. Code-pattern conformance must fail.
- `conflict`: an available checker implements a different or obsolete rule. Code-pattern conformance must fail until the rule and manifest are repaired coherently.

`semanticOnly` is reserved for decisions that cannot be answered from syntax, resolved dependencies or repository metadata. It names the reason and guidance. A rule with any mechanically decidable clause remains in `obligations`; moving it to `semanticOnly` is not a waiver.

## Machine kinds

### ESLint

The checker loads the target-local canon package, verifies the exact package name, version and deterministic content digest, then resolves each manifest rule ID. The digest sorts included files by POSIX-relative path and hashes each UTF-8 path, a null byte, raw file bytes and another null byte in sequence; the manifest declares its include/exclude globs and expected file count. HFS checks the exact managed config render and rejects extra local tool configuration or flags; the pinned canon factories own required levels, options and inline-config policy. The actual lint report must cover the selected production files without warning or error. This is not a separate effective-config audit of every possible file. A repository-private rule cannot satisfy a canon ID.

The manifest may select a subset of a package's exported toolbox. An extra export is not automatically law. Conversely, an obligation does not disappear because the package recommendation omits or disables its rule.

### Architecture

Architecture obligations bind a `starci/architecture-check@1` result from `starci runtime architecture <app>/<side>` (`starci app check` runs it over `be/` and `fe/`). The direct architecture result exposes checked-rule coverage. `starci app check` runs the machine in process and records its status, files, kinds and sides; the lint aggregate retains its findings count. Those aggregates do not themselves bind a separate architecture-report digest or all required rule IDs. Record the actual direct result and applicable coverage before claiming those obligations are proved; missing, invalid or non-clean required coverage is not conformance. Static dependency checks do not prove dependency-injection lifetime, authorization or behavior; the obligation's semantic companion states the remaining review.

There is no third machine kind: every obligation is judged by a canon rule or the architecture machine, or is not part
of the locked convention; `require-public-member-jsdoc` (R109), `replacement-throw-carries-cause` (R108) and
`props-fields-readonly` (R110) are canon rules at error.

## Coverage and remaining work

The manifest is the current implementation inventory; inspect each obligation's
status and actual result instead of treating this prose as a frozen count.
Installed rules that contradict the adopted standard must be off while their
replacement obligations remain required. That update does not waive an
unimplemented replacement. Private Academy rules do not become shared canon
merely because their names occur in a local config. This inventory does not
authorize product rewrites or lint-package publication.

The architecture adapters keep their guides beside this file:
[Nest contract and readonly boundary](nest-contract-check.md) and
[Next data lifecycle](next-data-lifecycle-check.md). The direct architecture result records
`frontendDataLifecycle` coverage independently of its rule IDs. A proven absence
of SWR is not applicable; selecting SWR without a supported contract is
unavailable.

## Comment and executable verification obligations

**REF-COMMENT-1 — Caller contracts and decision rationale.** Public APIs carry non-empty English
JSDoc describing responsibility and caller-visible constraints, results and effects. Non-obvious
helper contracts document constraints that signatures and code do not reveal. Inline comments
above important decisions explain the invariant, reason and consequence. TypeScript keeps types
in signatures; parameter and return descriptions add constraints rather than repeat names or
types. JavaScript JSDoc may express API types. Apply R89, R91 and R109 without relaxing them.
Empty blocks, restated names, misleading or stale claims, and missing important rationale fail
review. Straightforward code needs no per-line, every-helper or comment-density quota.

`scripts/checks/check-runtime-public-docs.mjs` checks adjacent descriptions at runtime API calls
and explicit CLI callable bindings. The product canon owns export and public-member checks.
These machines establish description presence only. Review accuracy and important rationale
against source, callers and relevant tests, and record mechanical and semantic proof separately.

**REF-VERIFY-1 — Complete applicable executable coverage.** Run checks for every applicable
code-pattern rule and selected production file. Missing checkers, unavailable tools, ignored
files, disabled required rules or unsupported required syntax block conformance; agent review
cannot replace a missing machine. Review design and edge cases using the applicable Markdown
guide and real behavior evidence. Record coverage, design findings and limitations separately
in existing evidence, including disabled rules, directives and structural omissions.

**REF-VERIFY-2 — No bypass.** Do not manufacture conformance with lint or TypeScript suppressions,
lower rule severity, wider ignores, source moved to test or generated lanes, any or casts,
forbidden-dependency aliases, or renamed forbidden facades. Verify the exact production files
were included in real checks. Existing suppressions and tool blind spots grant no bypass. A
legitimate tool defect needs a narrow reviewed correction and regression coverage; product
conformance remains unproved until the underlying convention is independently verified.

## Evidence limits

A complete code-pattern result proves only the declared mechanical obligations over the recorded files and tool identities. Agents still review responsibility, cohesion, state/effect ownership and edge cases using `docs/architecture.md`. Applicable typecheck, boot, contract, concurrency, recovery and rendered behavior evidence remains separate.

## Coding evidence chain

This trace joins the existing operation, tool and settlement owners. It does not
add writer authority or turn a selected check into whole-product completion.
Follow the supported owning profile: application checks use the actual app
install; runtime and other source use their declared checks. An unavailable
applicable tool leaves the criterion unjudged, as REF-VERIFY-1 requires.

```mermaid
flowchart LR
  A[Approved goal and context] --> B[Dispatch authority and READ]
  B --> C[CODE within owned paths]
  C --> D[Canon, HFS, lint, typecheck and asked tests]
  D --> E[Merge guard and semantic review]
  E --> F[REPORT and immutable proofs]
  F --> G[Independent checks and settle]
  G --> H[Scoped checkpoint]
  H --> I[Integrated L3 and release L4]
```

| Boundary | Owning source | Evidence and refusal | Owning behavior specs |
| --- | --- | --- | --- |
| Goal and reviewed context | `scripts/goal/define-goal.mjs`; `scripts/context/pack.mjs`; `scripts/kernel/op-prompt.mjs` | The entry skill presents the assessed op chain for the owner's exact approval before persistence. The filed goal, op parameters, current SRS/SDS and selected knowledge define authority and inputs; code or a green tool cannot redefine product intent. A changed goal needs the existing revision approval. The prompt/context packet carries the selected operation, not every possible quality leg. | `tests/repo/define-goal-plan.spec.mjs`; `tests/kernel-verbs-shared/goal-entry.spec.mjs`; `tests/repo/context-pack.spec.mjs` |
| Write admission | `scripts/kernel/verbs/dispatch.mjs`; `scripts/kernel/target-repo.mjs`; `scripts/kernel/workflow-worktree.mjs`; `scripts/kernel/cli.mjs#opGuardLaunch` | Dispatch rechecks the op, workflow phase, repository, grants and registered placement before launch. Path leases and the filed attempt bind its write set, base and dispatch identity. CODE stays within that set. A queued instruction or a passing checker cannot widen it. | `tests/kernel/workflow-checkpoint.spec.mjs`; `tests/kernel/grant-parents.spec.mjs` |
| Admitted inputs and READ | `scripts/kernel/input-digests.mjs#opInputPaths`/`recordInputs`; `scripts/kernel/dispatch-admission.mjs`; `scripts/gates/gate-input.mjs#gateInputSnapshot`; `scripts/gates/read-digest.mjs`; `scripts/kernel/gate-settle.mjs#judgeLoop` | Input identities include declared top-level and selected mode reads. READ records topic/example identities, not proof that a human understood them. Missing required READ coverage refuses. `inputDrift` distinguishes Source advisory drift from committed Work changes owing follow-up; it is not a universal current-byte freshness gate. New legs qualified by the recorded policy identity capture their owned target baseline before launch; a missing required baseline refuses. CHECK binds that owned range and required READ inputs, not an unrelated clean slice. | `tests/kernel/stale-input.spec.mjs`; `tests/gates/op-gate-loop.spec.mjs` |
| Installed canon and static code laws | `scripts/gates/gate.mjs#installedCanonFindings`; `packages/hfs/lint/run.mjs`; `packages/hfs/sync/managed.mjs`; `scripts/hfs/check.mjs` | The exact installed canon version/content identity, managed config render, selected file coverage and actual linter results matter. ESLint/stylelint and HFS measure separate laws; a tool failure is not a clean measurement. Runtime layout/layer laws are measured by its own HFS runtime check. The obligation inventory above remains authoritative. | `tests/gates/op-gate-loop.spec.mjs`; `tests/packages-hfs/hfs-lint.spec.mjs`; `tests/packages-hfs/hfs-lint-bound.spec.mjs` |
| Owning TypeScript programs | `scripts/gates/gate.mjs#headTsc`/`baseTsc`/`newTscFindings`; `scripts/machine/ladder-typecheck.mjs` | Record the actual owning tsconfig and bounded target-local install. Compiler diagnostics compare the same declared base and current program; existing base errors are reported as debt. An absent install or unreadable required program is unavailable. Syntax checking runtime JavaScript is distinct from app TypeScript conformance. | `tests/gates/op-gate-loop.spec.mjs`; `tests/machine/ladder-typecheck.spec.mjs` |
| Codegen and build | `scripts/gates/gate.mjs#prepareTypes`; the owning app/package manifest scripts | Gate preparation runs declared root codegen and dist-exposing workspace prerequisite builds. It does not run every app build or prove boot/readiness. The operation separately declares and records its applicable actual app build; the build output and its input identity must be current. | `tests/gates/op-gate-loop.spec.mjs`; the changed app's owning build/boot specs |
| Required tests and layer proofs | `scripts/gates/gate.mjs#runTests`; `scripts/gates/unit-run.mjs`; `scripts/gates/test-world-run.mjs`; `scripts/kernel/gate-settle.mjs#judgeUnitRun`/`judgeTestWorld` | Preserve real process status, the selected scope, counters and failed assertions/suites. A required zero, skipped, pending/todo, interrupted, malformed or inconsistent run is not a pass. Omitting optional `--tests` does not manufacture test evidence. Unit coverage/kit and integration/e2e/contract test-world ownership are additional criteria. The accepted goal and op select these layers; ordinary code edits do not automatically run all of them or UAT. | `tests/gates/test-run-receipts.spec.mjs`; `tests/gates/op-mechanism-proofs.spec.mjs` |
| Applicable Sonar judgment | `knowledge/sonar-gate.yaml`; `scripts/gates/sonar-local.mjs`; `scripts/gates/sonar-gate.mjs#judgeSummary`; `scripts/kernel/sonar-settle.mjs#judgeJob`/`recordSonarJudgment` | Only the gate's enforced operations owe this summary. Settle judges it under current owner settings rather than trusting a summary's claimed mode. Red or missing proof blocks done; unavailable scanning records an explicit non-pass and runtime incident. Coverage debt and owner-selected modes retain their own declared limits. | `tests/gates/sonar-local.spec.mjs`; `tests/kernel/sonar-settle.spec.mjs` |
| Merge preservation | `scripts/gates/gate.mjs#mergeGuard`/`droppedMainChanges` | Recompute qualifying two-parent merges in `base..HEAD` using the actual main-side parent. Dropping main's changes is always a new finding. A range with no qualifying merge, or no main tip to compare, is not a general proof of merge or product correctness. | `tests/gates/op-gate-loop.spec.mjs` |
| Architecture and comment meaning | `docs/architecture.md`; `docs/code-pattern-enforcement.md#comment-and-executable-verification-obligations`; `modules/ops/ops/review.verify.yaml`; `scripts/kernel/gate-settle.mjs#judgeReviewDefects` | Review responsibility, dependencies, state/effect ownership, caller constraints and important rationale against source, callers and behavior tests. REF-COMMENT-1 requires useful contracts, not comment quotas. `runtime-public-docs` measures adjacent descriptions on runtime API/explicit CLI boundaries only; product R89/R91/R109 retain their own canon scope. A failing or unjudged required semantic criterion cannot receive a passing review. The runtime checks defect classification, not the truth of an agent's judgment. | `tests/checks/runtime-public-docs.spec.mjs`; `tests/gates/op-mechanism-proofs.spec.mjs` |
| REPORT, integrity and independent checks | `scripts/kernel/verbs/report.mjs`; `scripts/kernel/verbs/shared/report-evidence.mjs`; `scripts/kernel/verbs/record-checks.mjs`; `scripts/kernel/settle/job-settle.mjs#verifyDeclared`; `scripts/kernel/proof-integrity.mjs#verifyProofs` | A report must bind the real dispatched attempt, owned paths and current delivery inputs. Scratch attachments enter content-addressed storage; immutable filing and hash/chain verification protect retained evidence. Re-verifiable checks run again; an unreproducible green claim stays declared and cannot supply independent green checks. Content integrity does not itself prove scope, freshness or behavior. | `tests/gates/op-mechanism-proofs.spec.mjs`; `tests/kernel/proof-integrity-spill.spec.mjs`; `tests/kernel/verify-reliability.spec.mjs` |
| Verdict and checkpoint | `scripts/kernel/verbs/settle.mjs`; `workflow-checkpoint.mjs`; `workflow-checkpoint-state.mjs`; `workflow-rebase.mjs` | Pass requires the filed outcome and independent green checks plus applicable READ/gate, mechanism, cut and owner gates. The same workflow lock protects acceptance and scoped effects. A changed owned delta creates its checkpoint; no-change reuses the SHA. Prepared effects retain dispatch attribution for recovery, with conflicting newer bytes held visibly. Tested HEAD, checkpoint SHA and later landed HEAD are separate identities. | `tests/kernel/workflow-checkpoint.spec.mjs`; `tests/kernel/workflow-rebase-milestone.spec.mjs` |

The detailed proof policy remains in [verify-proof](verify-proof.md). Head-green
checks alone do not prove that a test discriminates the change. The legacy
`runAtBase` path reports a base-green, failed-to-build or timed-out contrast as
`weak`, which its existing policy accepts with a finding; that is not a proven
fail-before result. The sealed protected-oracle path has its own stricter
applicability and verdicts. Report the actual path and verdict rather than
promoting one into the other.

New mandatory evidence fields follow their owning contract change and recorded
admission snapshot, including any withheld or released changes; a newer Source
revision alone does not assign them to every in-flight leg. The input-binding
owner freezes that contract context before launch. Existing well-formed receipts
with the same ABI may be rejudged for actual errors, but an older receipt is not
promised acceptance: missing, skipped, inconsistent or stale applicable proof
remains non-pass. Do not infer an exemption or a qualification from a date label.

## Runtime qualification scope

[Source process](source-process.md) owns the ladder. `ladder-test.mjs` selects
owning/dependent whole spec files; explicit `--spec` is limited to L1. L2/L3
require a clean tree containing local main, run full runtime checks before
selected specs, and L3 adds affected IO boundary specs. L1 runtime self-checks
are selected by changed checker implementations; unchanged checks are not
implicitly proved by a green L1. Its explicit owning run therefore does not
replace the final L3. App gate baseline debt remains reported: a clean delta is
not a claim that the complete existing app has no findings.

L2/L3 retain an initial red run and one serial retry as separate evidence. A
retry-green flake is recorded as a flake; its retry counters describe that subset,
not the entire original selection. Native test concurrency may be selected from
CPU/RAM, but scope and acceptance criteria do not change with concurrency.

`scripts/supervisor/release-l4.mjs` owns the release-wide suite, example installs,
builds and required proofs; `release-linux-parity.mjs` owns the corresponding
Linux light jobs and host-skipped test leg. Missing steps or tooling refuse the
release. A skipped test needs the actual alternate passing leg, subject only to
the existing named browser-conditional policy. L3 does not establish L4, Linux,
publication, live integration, rendered UI or final delivery completion.

Use the actual retained receipt's Source/tool identity, scope, raw exits, counts,
base/current input identities and limitation fields. A diagram, declared command,
source inspection, selected spec count or an old green receipt is not execution
evidence for the current cut.

For example, a clean JSON test report followed by an unexplained exit 7 is a tool
failure; a required pending scenario is not executed coverage. A changed package,
tsconfig, generated prerequisite or source deletion must refresh the impacted
compiler programs even when Git's dirty status has not changed. A valid report
hash proves retained bytes, while a changed input still owes fresh applicable
judgment. Independent operation verification, supervisor land, release and final
delivery reconciliation each retain their separate authorities and receipts.
