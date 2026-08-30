# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 7.2.1 - 2026-08-30

### Changed

- Added deterministic `fe/capture-preflight` before capture and Sol review, including ten readiness
  checks for data/state identity, controls, scroll/zoom restoration, probe completeness, raster
  uniqueness, and the handoff host.
- Froze owner-partitioned visual packets so repairs recapture affected owners and shared sentinels while
  reusing only partitions with explicit dependency proof.
- Bound visual review to discovery, verification, and regression rounds; remaining round-three findings
  block for diagnosis instead of opening an unbounded loop.
- Classified complete fingerprinted finding batches and repaired each batch once before recapture.
- Added terminal debug records for visual phase, packet, matrix, round, partition counts, and findings.

## 7.2.0 - 2026-08-30

### Changed

- Standardized material AI orchestration on one fresh Sol execution: every activity is completed by one
  fresh `gpt-5.6-sol` across every provider mapping, including legacy balanced/parallel modes.
- Made router acceptance depend on canonical input and output validators, a non-null expected-output
  contract, the exact owning Skill, and runtime-issued peer receipts.
- Content-addressed every visual raster and bound the blind packet to the exact ordered host + render
  matrix + lifecycle-probe capture. Substitution, reordering, mutable filenames, and unproduced images fail.
- Expanded exact phase coverage to breakpoint edges, long/short content, overlay-open, drag-limit,
  keyboard focus, skeleton/loading/steady, zoom restoration, and scroll terminals.
- Integrated post-completion counterevidence into terminal routing: closure requires a causal failure
  record, canonical same-mission/same-Skill ERROR→RESUME chain, and a fresh ordered
  CALL→RETURN→TRANSITION proof lifecycle descended from that RESUME and covering every affected
  evidence reference. A backend proof cannot close a reopened frontend verdict.
- Bound every routed operator result to its canonical output validator, canonical `RETURN` receipt,
  exact current input/output fingerprints, invocation identity, and single-use consumption; stale or
  narrated results cannot advance a machine.
- Bound frontend visual output to the exact input packet fingerprint, complete supplied raster set,
  final screenshot, reviewer execution, and review policy. Opaque raster/probe identifiers and
  runtime-attested distinct principals close rationale and alias channels.
- Material AI `CALL`, `RETURN`, and `TRANSITION` receipts require one fresh `gpt-5.6-sol` execution
  and always emit debug activity. A visual repair can no longer be reclassified as `clean` to bypass
  fresh capture and review.
- Replaced narrated operator transitions with validator-issued, invocation-bound RETURN envelopes;
  a raw `{ outcome: "passed" }` can no longer advance any operator state.
- Standardized every material AI brainstorm and review on one fresh-context `gpt-5.6-sol` execution;
  same-context self-review is not a fallback path.
- Made frontend visual proof raster-only for the reviewer, with uncropped host context, focused surface
  captures, lifecycle/probe rasters, and exactly one final post-mutation screenshot controlling PASS.
- Added mandatory terminal debug output for AI CALL/RETURN/TRANSITION contracts and human-readable
  inspection records per raster; missing records, uncertainty, stale capture, or any finding blocks PASS.
- Made public Skill inputs reject schema-valid cloned/fabricated receipts, and made render-state and
  adversarial-probe binding order-sensitive so a reordered capture cannot impersonate the request.
- Replaced raw WAIT resumption with a canonical, state/mission/Skill/input-bound RESUME envelope that
  is consumed once. Forged, cloned, retargeted, and replayed RESUME objects fail closed.
- Made post-completion proof accept only route-issued transitions from declared owning-Skill review
  operators, with single-use lifecycle closure; relabeling a backend operator as frontend is rejected.
- Made neutral add/change/remove consideration executable at every Skill analysis boundary and in
  terminal quality proof, with a required evidence-backed disposition for all three directions.
- Consolidated frontend visual closure into one fresh-Sol pass bound one-to-one to the complete ordered
  raster/probe packet. That Sol performs the whole adversarial visual verdict before quality handoff.
- Made public FE/Feature/UAT return receipts runtime-issued and single-use, made each active WAIT
  identity issue at most one RESUME resolution, and made quality PASS reject prose-only, empty,
  invented, or unbound evidence.

## 7.1.0 - 2026-08-30

### Changed

- Made the frontend audit chain fail-closed: runtime observation now returns structured surface,
  interaction, and responsive-state inventories; semantic, UX, and UI aggregate `passed` requires
  every evidence-bound check to pass.
- Added an executable behavior-preservation contract. Every observed interaction must be preserved or
  explicitly removed/replaced with authority and rationale before source mutation can begin.
- Bound source apply and repair to the frozen behavior-contract fingerprint so a visual direction
  cannot silently delete product behavior.
- Added semantic validators for complete viewport matrices and all ten adversarial probe categories;
  duplicated probes no longer satisfy coverage.
- Made visual-fidelity and independent-review aggregates reject any underlying repair, finding, or
  contradiction, and added regression tests for the false-PASS failures demonstrated by live UI work.

## 7.0.1 - 2026-08-29

### Changed

- Added `.claude/scope.yaml` as the mission-scope protocol and made every public Skill input require
  a complete, frozen, multidimensional scope with explicit targets, inclusions, exclusions, mutation
  boundaries, completion proof, extensible dimensions, and no unresolved ambiguity.
- Required global analysis to ask one focused boundary question before Skill selection or target-source
  inspection whenever a material scope dimension is unresolved.
- Added the conditional `frontend.ux-ui.change-level` scope dimension with `refine`, `reconstruct`,
  and `new`; this dimension remains one small part of the complete frontend mission scope.
- Added release validation that all 12 public Skill schemas conform to the same scope protocol.

## 7.0.0 - 2026-08-29

### Changed

- Replaced the phase-sized public catalog with 12 mission-owning Skills that compose through typed
  `CALL`, `RETURN`, and executable `RESUME` receipts.
- Made every operator a strict one-job `(context + input) -> typed output` contract and retained 148
  atomic operators across 14 domains.
- Added the sole `.claude/config.yaml` runtime config with redacted full trace output under
  `debug: true`; debug changes visibility without changing execution.
- Replaced generated coding-context and Qdrant lookup with default search against exact routed source.
- Made project backends own flat `.worktrees/{_templates,businesses,uat,sessions,debts}` authority, with
  canonical UAT at `uat/<feature>/<flow>/{snapshot.json,result.json}`.
- Added strong critical-agency and no-progress rules: continue with the dominant reversible action,
  ask only when no valid next step exists, and render 3–4 choices only when selection is necessary.
- Replaced state-by-state UAT inflation with product-level decision-branch coverage: loading and ordinary refresh normally remain happy-case checkpoints, while component-local empty, error, validation and render permutations delegate only with exact lower-level proof and no wiring or recovery risk.
- Made visible Browser case execution sequential and predeclared. Every run now binds execution order, account or anonymous identity, fixture namespace, precondition, expected outcome, Browser session and declaration receipt before product action.
- Added fixture constraint preflight and explicit support for run-namespaced related-table/service seeds needed for meaningful rendering before the journey; post-journey outcome manufacturing remains forbidden.
- Decoupled Behavior and UX proof from missing UI detail, and made UI aggregate `fe.ui` and Grammar verdicts independently so one authority failure cannot be hidden by `SUSPENSE` in the other.
- Scoped product readiness to the exact routed project; unrelated workspace and worktree findings remain diagnostics instead of blocking the active product target.

### Breaking

- The 49 prior public Skills are retired from discovery and preserved under `migration/v6/retired-skills/`.
- The v6 UAT review tree and generated frontend coding-context are retired under `migration/v6/`.
- UAT authority is now exactly one frozen `snapshot.json` plus one published `result.json` per
  feature/flow.
- Product UAT no longer uses conflict-aware parallel case groups for visible Browser execution.

## 6.3.0 - 2026-08-29

### Added

- Four atomic UAT lenses: flow-coverage compiler, Behavior audit, UX journey audit, and UI render audit.
- Canonical `.uat/reviews/<feature>/<flow>/review.md` structure with machine review schema, case template, immutable run evidence, screenshot checkpoints, user feedback, SUSPENSE and REQUIRE_USER_ACTION registers, root-cause index, and retest gate.
- Conflict-aware parallel case-run isolation across fresh account, agent-bound browser-session lease, origin, mailbox/query namespace, fixture namespace, artifact directory, and resource locks.

### Changed

- Upgraded Product UAT to compile a separate happy case and equivalence-safe unhappy cases before independent Behavior, UX, and UI verdicts.
- Restricted unhappy-case merging to a six-field recovery-equivalence signature and required recoverable failures to continue through success.
- Made fixture verification read-only, forbade post-journey result manufacturing, and required cleanup by `is_uat=true` plus exact case namespace.
- Restricted `SUSPENSE` to finite unresolved UI-authority questions and required user decision, authority promotion, repair, and fresh rerun before closure; added non-pass `REQUIRE_USER_ACTION` with exact browser/device handoff and resume evidence.

## 6.2.1 - 2026-08-27

### Fixed

- Bound every HTML visual-review delivery to the portable `visualize-directive.mjs` helper so Windows paths are normalized to JSON-safe forward slashes instead of silently suppressing previews.
- Made UI-direction review handoffs fail closed unless one validated interactive preview covers every direction, the closed surface set, all responsive states, and exact hash-bound approval commands.
- Added regression checks that forbid handwritten visualize JSON and forbid requesting UI-direction approval before the preview is visibly rendered in the same response.

## 6.2.0 - 2026-08-27

### Added

- Multilingual request vocabulary and normalized scope records for product branches, journeys, surfaces, blocks, components, cases, and common cross-domain ambiguities.
- Rendered visual-evidence contracts and validation for substantial frontend UI-direction and architecture comparison approval gates.
- Dedicated coding-preflight and static-quality-gates skills, including an atomic preflight operator and commit-or-explicit lint, typecheck, coverage, and Sonar activation.
- Shared product-runtime coordination rules that reuse healthy listeners and prevent unrelated process restarts.
- Portable visualize-directive generation with Windows-path normalization and regression tests.

### Changed

- Added explicit `gated` and `bypass` execution modes to global selection, skill schemas, machine waits, and protocol validation; bypass receipts remain ephemeral and are never represented as human approval.
- Extended frontend direction, critique, UX-flow, UI-detail, contract, implementation, fidelity, and UAT machines to preserve closed feature-branch surface coverage from design through proof.
- Inserted coding preflight before approved frontend and backend source mutation and strengthened exact-boundary, handoff, and no-progress behavior across delivery workflows.
- Hardened local input analysis so material scope ambiguity returns for one focused clarification instead of silently collapsing to the current page or repository context.
- Raised the release baseline to 48 skills, 125 operators, and 72 knowledge records.

## 6.1.0 - 2026-08-26

### Added

- Specialized frontend direction, critique, UX-flow, UI-detail, contract, implementation, fidelity, and UAT skills.
- Specialized architecture discovery, data-ownership, option, critique, and realization skills.
- Specialized backend solution, contract, critique, implementation, and proof skills.
- Operational tech-stack modeling and typed sequential or side-branch handoffs with acknowledgement and resume semantics.

### Changed

- Removed the legacy frontend-layout, architecture-decision, backend-delivery, and backend-repair lifecycle machines; global analysis now selects specialized capabilities directly.
- Made source an observed claim rather than automatic design authority and added independent critique capabilities.
- Accepted real-world v6.1 feedback as the evidence base for the next minor release.

## 6.0.0 - 2026-08-24

### Added

- Twenty-six one-flow `starci-*` skills expressed as validated state machines.
- Global prompt analysis with a generated metadata catalog and schema-validated ephemeral skill selection.
- Eighty-five atomic operators across frontend, backend, business, architecture, quality, deployment, platform, source, test, and workspace domains.
- Closed input and output schemas plus fail-closed validators for every skill and operator.
- Seventy recursively discovered knowledge records, including independent Grammar Common, Core, and Offset Pop contracts and complex cases.
- Deterministic frontend contract export to project-scoped plain JSON with hash reuse and atomic publication.
- Project-scoped Qdrant Edge indexing for operator knowledge and frontend component contracts.
- Business-staleness, frontend-context synchronization, and coding-scope freeze operators.
- Backend repair prerequisite and coding-scope freeze operators that forbid raw source before an approved exact-file boundary.
- Release validation and continuous integration.

### Changed

- Promoted the release tree to the repository root for direct skill discovery.
- Split unrelated entry modes into narrowly discoverable skills; each skill now has one fixed first state while retaining explicit choices, approvals, loops, and terminals inside its flow.
- Made Qdrant a candidate cache rather than authority: selected frontend records are rebound to canonical JSON before source access.
- Restricted Grammar runtime context to Common plus exactly one selected grammar and prohibited business semantics from Grammar.
- Added per-domain context matrices to every materialized skill so each phase declares allowed and forbidden context.
- Made quality debt closure independently proved, finding repair one-finding scoped, and deployment monitoring bounded by attempt/deadline/backoff metadata.
- Preserved rollback as a distinct `rolled-back` terminal that bypasses successful-release business reconciliation.

### Removed

- The V5 context/compiler/facade tree, bilingual mirrors, and monolithic preload route.
