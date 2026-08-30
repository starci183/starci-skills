# Action observer log — 2026-08-30

## Frozen boundary

- Runtime owner: `starci-self-upgrade`, `intentMode=upgrade`.
- Runtime target under observation: three concurrent `starci-fe-process` actions.
- Product fixtures are read-only. Product source mutation by this observer is forbidden.
- Runtime writes are limited to `.claude/`; evidence is rooted here.
- Backend/product edits, commit, push, and deploy are excluded.

## Baseline

- Runtime Source: `C:\Repositories\ac\starci-academy-backend`, branch `mtp`, head `2c84dd1e7a64b1665ff8534fecf51dda0977839c`.
- Personal Project fixture: branch `codex/personal-project-reconstruct`, initial head `4e571affa5880440df256dd7894273a06e692493`.
- CV fixture: branch `codex/cv-new`, initial head `4e571affa5880440df256dd7894273a06e692493`.
- Initial Personal Project live diff paths: `CoursePersonalProject/classNames.ts`, `CoursePersonalProject/component.tsx`, `CoursePersonalProjectPage/component.spec.tsx`.
- Initial CV live diff paths: `ProfilePublicCv/component.tsx`, `ProfilePublicCv/index.tsx`, `ProfileCvDocument/classNames.ts`, `ProfilePublicCvPage/component.spec.tsx`, `messages/en.json`, `messages/vi.json`, plus new `.artifacts/cv-new/` and `ProfilePublicCv/classNames.ts`.

## Acceptance contract

Observe direct outputs before actor rationale. Record product correctness, visible raster/review evidence, state transitions, proof completeness, elapsed/step/context/redundancy metrics where available, and product write count by this observer. Diagnose all eleven required layers only from direct evidence. Do not mutate runtime until the smallest reusable owner is proven by independent actions or a sufficiently systemic failure. An upgrade must pass focused validation, full release, and two fresh consecutive behavioral checks where possible.

## Observations

- 2026-08-30 baseline: both product actions have begun producing distinct in-scope diffs from the same FE head. No observer-originated product write occurred (`productWriteCount=0`).
- The original in-thread subagents were interrupted after the user required full Codex task isolation;
  their partial execution is not accepted as action evidence.
- Personal Project now runs in Codex task `01a051ba-39ec-7371-8942-03092987a124`.
- CV now runs in Codex task `01a051ba-4020-7f40-9f88-f882a5e7fd13`.
- Playground K8s–Docker–RAG now runs as the user-requested third fixture in Codex task
  `01a051c9-d1b2-7522-b881-8100ce33aafd` with its own planned FE worktree.
- The coordinator/self-upgrade task communicates through task reads, waits, and explicit follow-up
  messages. It aggregates evidence but cannot issue either product verdict.
- First task snapshot: both actors loaded the StarCi bootstrap and began route/scope validation;
  neither has emitted a terminal output, latest-source raster packet, or visual verdict yet.
- Actor terminal outputs, final rasters, review receipts, and timing/step/context traces are pending.
- Live snapshot after multi-task upgrade:
  - Personal Project reached neutral `fe/product-potential`; it is using one fresh isolated execution
    and has not issued a visual verdict.
  - CV capture preflight rejected viewport overrides that still produced a 1422x800 DOM and duplicate
    rasters. The actor correctly withheld the invalid packet and is recapturing on a real responsive
    browser surface; this currently supports the existing fail-closed evidence rule rather than a new
    runtime defect.
  - Playground compiled successfully and is creating the authorized isolated worktree after proving
    its path and branch do not already exist.
- A later CV snapshot exposed a second harness boundary: container reflow proved the CV owner but did
  not trigger profile-tab media queries, while the nested-browser viewport attempt failed. The
  supervisor requested preservation of expected/actual viewport values, stale/duplicate raster
  fingerprints, failed tool receipt, and the no-product-mutation fact. This is a candidate
  `tool-model` or capture-execute finding, not yet an approved runtime repair.
- Playground's failed browser observation showed Turbopack rejecting a worktree `node_modules`
  junction outside its filesystem root; after the actor safely removed only that junction, `npm ci`
  exposed an existing package/lock mismatch. The supervisor prohibited manifest/lock mutation solely
  to heal the harness and requested a tracked-source-neutral fallback.
- CV later reproduced the same Turbopack outside-filesystem-root fingerprint with its own worktree and
  listener attempts. This is independent cross-case proof of one systemic runtime/worktree readiness
  gap, not a page-specific defect. CV's ineffective viewport override remains a second, capture-control
  gap: requested responsive changes left the observed content viewport at 1422x800 and produced
  duplicate rasters.
- No existing `.claude` owner required dependency containment, package/lock reproducibility, exact
  runtime-origin binding, or requested-versus-observed viewport equality before `runtime-observe` or
  `capture-preflight` could return success. Knowledge status is therefore `missing`, while the state,
  execute, input/output, validation, and proof layers were also incomplete.

## Runtime repair 001 — runtime/capture readiness

- Decision: `CHANGE` the smallest shared owners `fe/runtime-observe` and `fe/capture-preflight`; `ADD`
  reusable knowledge `fe.runtime-capture-readiness`; do not change product source or UI/Grammar laws.
- Runtime fingerprint: `sha256:87b15f8ff77082b9167e97eddcd76ddc5d725b47d3c34f8ef9d705bcc0d8d812`.
- Execute logic now rejects escaping dependency junctions, non-reproducible manifest/lock state,
  missing local export targets, unproven listener reuse, and ineffective viewport controls. It forbids
  manifest/lock mutation merely to heal an evidence harness.
- `fe/runtime-observe` output now requires structured runtime-readiness proof plus requested and
  observed viewport dimensions and distinct raster fingerprints.
- `fe/capture-preflight` now has 13 ordered deterministic checks, adding `runtime-origin-valid`,
  `dependency-graph-ready`, and `viewport-controls-effective` before data and raster checks.
- Regression proof rejects an escaped dependency root, requested/observed viewport mismatch,
  duplicate responsive rasters, and the old 10-check preflight contract.
- Focused operator suite: 101/101 passed. Self-upgrade suite: 6/6 passed. Skill validation: 13 public
  skills. Release validation: 13 skills, 149 operators, 78 knowledge records.
- Runtime proof created before this fingerprint is stale for the affected runtime-observe and
  capture-preflight states. Each actor must reload the changed owner set and resume at the nearest
  affected state; no actor is required to restart its whole product mission.
- Personal Project reload receipt: previous runtime fingerprint unknown; current fingerprint matches
  repair 001; all affected refs loaded; resumed at `runtime-observe` then `capture-preflight`; no
  product source changed during reload. Its production build completed successfully first, bound to
  product-source fingerprint `sha256:19a592d3c665eedf9f4b0c23c6eb638c026b02619ba74f8df0b35c237eeadfe0`.
- CV reload receipt: previous runtime fingerprint unknown; current fingerprint matches repair 001;
  all affected refs loaded through EOF; resumed at `runtime-observe/capture-preflight`; no product,
  manifest, lockfile, or backend source changed. The EADDRINUSE, outside-root junction, ineffective
  1422x800 viewport, duplicate rasters, and failed nested-browser receipts remain preserved.
- Playground reload receipt: previous runtime fingerprint unknown; current fingerprint matches repair
  001; all affected refs loaded completely; resumed at `runtime-observe/capture-preflight`; no product
  source changed. The outside-root junction, manifest/lock mismatch, missing Grammar export target,
  and browser-unavailable receipts remain preserved. The actor committed to a worktree-contained,
  tracked-source-neutral runtime path and fail-closed behavior otherwise.
- Personal Project current-fingerprint result: `fe/runtime-observe=blocked` and
  `fe/capture-preflight=blocked`. Direct receipts are stored under
  `.worktrees/sessions/starci-fe-personal-project-20260830/evidence/`. The actor proved PID 41316,
  exact worktree, origin `http://localhost:3015`, an ordinary contained `node_modules`, and a passing
  production build. `npm ci --ignore-scripts --dry-run` alone failed because two packages are absent
  from the lockfile; Node 24 also produced a jsdom engine warning. No manifests changed and no visual
  verdict was issued.
- Counterexample against repair 001: a contained, exact, production-buildable runtime may be visually
  observable even when repository reproducibility is independently degraded. Treating any lock drift
  as an unconditional capture blocker may optimize formal readiness while preventing the required
  product output. Hold this as a candidate overconstraint until CV and Playground return comparable
  current-fingerprint results.

## Runtime repair 002 — separate capture readiness from repository reproducibility

- Independent proof: Personal Project had a contained exact runtime and passing production build but
  was blocked only by lock drift; CV reproduced the same lock drift using both the current npm and
  npm 11.6.2. This proved repair 001 overconstrained output execution.
- Decision: keep escaping dependency roots and failed target build/load as capture blockers, but record
  manifest/lock drift as a separate repository-reproducibility finding. Drift blocks clean-install or
  release proof; it does not alone block pixels from a contained runtime that builds and loads the
  frozen target.
- Runtime fingerprint: `sha256:7b55339279194a10ab6c61127906a6335a9b5ee6cc6f0b63d5cd9eb2c4bb8953`.
- Runtime-observe now accepts `manifestLockStatus=drift-recorded` only with its evidence ref while still
  requiring contained dependencies, passing runtime load, exact target evidence, and effective distinct
  responsive rasters.
- Capture preflight now has 14 ordered checks. `dependency-graph-ready` proves the contained build/load
  path, while `repository-reproducibility-recorded` preserves clean-install drift without collapsing it
  into the capture verdict.
- Regression proof accepts recorded drift with a proven runtime, while continuing to reject escaped
  dependencies, ineffective viewport controls, duplicate rasters, and legacy readiness matrices.
- Focused suite: 15/15 passed. Full operator suite: 101/101 passed. Self-upgrade: 6/6 passed. Release:
  13 skills, 149 operators, 78 knowledge records.
- Playground repair-001 result independently strengthened the counterexample: its worktree-local
  `node_modules` was a real contained directory, Next ran from the routed worktree on port 3014, and
  the exact target GET returned 200. Its only preflight blocker was the same unchanged manifest/lock
  drift. Typed blocked receipts validated and product source remained clean at FE head
  `4e571affa5880440df256dd7894273a06e692493`.
- All three actors returned corrective reload receipts from repair-001 fingerprint
  `sha256:87b15f8ff77082b9167e97eddcd76ddc5d725b47d3c34f8ef9d705bcc0d8d812`
  to repair-002 fingerprint `sha256:7b55339279194a10ab6c61127906a6335a9b5ee6cc6f0b63d5cd9eb2c4bb8953`.
  Each loaded the changed readiness knowledge, runtime-observe/capture-preflight contracts, schemas,
  validator, and 14-check sequence; each resumed at `runtime-observe/capture-preflight`; none changed
  product source during reload. CV will attempt only a worktree-contained untracked dependency setup
  that leaves package.json/package-lock unchanged.
- Playground initially classified its responsive control as failed because raw override values and
  `window.innerWidth/innerHeight` differed by exactly 1.25. Supervisor required unit disambiguation
  before accepting the blocker. The actor proved the capability consumes DPR-scaled physical values:
  with DPR about 0.8, overrides 1152x720, 768x640, and 312x624 yield CSS content viewports 1440x900,
  960x800, and 390x780. The old blocked receipt remains historical counterevidence but is not the final
  verdict. Classification: existing `requested=observed content viewport` knowledge was `misapplied`,
  not missing; no repair-003 runtime mutation is justified.
- CV bounded diagnosis under repair 002: contained untracked dependency install, unchanged manifest
  and lock hashes, production build, exact route load, 1400/1024/390 requested=observed viewports,
  no horizontal overflow, distinct rasters, focused tests 3/3, and typecheck all passed. The original
  localhost:3001 endpoint was an unrelated mock GraphQL listener. Running the unchanged backend on
  3031 and rebuilding FE against it made the exact target settle to localized `Không tìm thấy hồ sơ
  này` / `Khám phá nội dung` at all viewports. Typed route is `backend-required`: the exact profile/CV
  data is absent. No reviewer was called on loading or not-found pixels.
- Personal Project repair-002 result: `fe/runtime-observe=observed` with exact 1440x900, 1024x900,
  and 390x844 CSS viewports, distinct fresh rasters, restored page scroll, and restored bounded roadmap
  scroll. `fe/capture-preflight=blocked` only at `zoom-restored`: the in-app Browser exposes no zoom
  capability and content shortcuts are inert; Codex-host UI automation is forbidden. One bounded
  Chromium/Playwright fallback failed before launch and was not repeated. This is `tool-model`, not UI
  or product source. No Sol reviewer or visual PASS was produced.

## Runtime repair 003 — contract-fixture visual proof with backend handoff

- Independent proof: CV and Playground both passed contained install/build/load/responsive checks but
  lacked exact backend-owned records. CV settled to missing profile; Playground's fresh reviewer could
  see only error/retry and correctly refused to infer catalog/setup/session/result visuals.
- Prior state machine forced a false binary: stop without the requested UI output, or hide backend
  absence behind invented/live-looking data and risk false completion. Knowledge and execute support for
  a bounded frontend visual fixture was missing.
- Decision: allow one content-addressed, contract-derived `visual-evidence-only` fixture outside product
  source for frontend-only `new`/`reconstruct` missions with frozen backend/API scope. The live backend
  gap remains mandatory and the fixture cannot prove integration, backend behavior, quality, UAT, or
  completion.
- Runtime fingerprint: `sha256:6068dbab0bcf9a995dfa1581bf835ea51c742d8c12b1256b9a8049c8b139b6f1`.
- `capture-preflight`, `render-capture`, and `visual-fidelity` now propagate a typed `dataEvidence`
  contract. Invocation binding prevents substitution between preflight, raster packet, and reviewer
  result. Live visual `passed` routes to quality; `fixture-passed` routes directly to backend handoff.
- Regression proof accepts a complete fixture contract, rejects a fixture without `backendGapRef`, and
  proves the two visual outcomes route to different terminals.
- Full operator suite: 101/101 passed. Self-upgrade: 6/6 passed. Release: 13 skills, 149 operators,
  78 knowledge records.

### Repair-003 actor reload and fresh-output evidence

- CV reloaded from repair-002 fingerprint
  `sha256:7b55339279194a10ab6c61127906a6335a9b5ee6cc6f0b63d5cd9eb2c4bb8953` to
  `sha256:6068dbab0bcf9a995dfa1581bf835ea51c742d8c12b1256b9a8049c8b139b6f1`.
  It loaded the readiness knowledge, capture-preflight/render-capture/visual-fidelity contracts and
  schemas, strict validator, invocation binding, and FE machine through EOF. It resumed at
  capture-preflight without changing product source and retained its original backend-gap receipt.
- Playground returned the same bounded reload receipt, resumed at capture-preflight, preserved the
  live no-data review as counterevidence, and made no product mutation during the reload.
- CV built a content-addressed fixture outside product source from frozen GraphQL types and localized
  message authorities. Fresh preflight then passed three distinct responsive viewports, horizontal
  overflow, zoom restore, page-scroll restore, bounded-CV-scroll restore, and retry pending-to-ready.
  Its schema receipt, raster matrix, reviewer verdict, full fixture hash, and second fresh pass remain
  pending; no visual verdict is recorded yet.
- Playground derived its fixture from the frozen `PlaygroundSummary`, `Playground`,
  `PlaygroundStep`, and `PlaygroundSession` frontend contracts plus lifecycle tests. Before blind
  review, fresh self-inspection found a real product-layout defect: the fourth session child,
  `Verification activity`, fell into an implicit 1/12 grid column and collapsed into a narrow strip.
  The actor correctly classified this as product source rather than fixture/backend evidence, rejected
  every raster from that source fingerprint, and began a bounded owner-selector repair followed by
  test/build/fingerprint/recapture. This is positive behavioral evidence that repair 003 does not let a
  fixture force a pass or conceal a source defect.
- Supervisor required each actor to perform a second fresh behavioral verification on its own final
  source fingerprint. Per-actor streaks must remain separate; no CV and Playground result may be mixed
  into one consecutive-pass claim. Fixture success can terminate only as `fixture-passed` with a
  retained backend handoff, never as live integration or COMPLETE.

## Runtime repair 004 — capability-aware zoom evidence

- Independent proof: Personal Project had already failed capture-preflight because the in-app Browser
  exposed no effective zoom control. Playground independently repeated the same tool-model boundary
  after a real source repair: DOM zoom mutation was rejected by the read-only browser evaluator, then
  one bounded fresh-tab/native-controls retry produced a duplicate zoom raster. The actor correctly
  failed closed and did not call the blind reviewer.
- Playground source repair itself is valid and remains separate from the tool blocker. It fixed the
  wide-session implicit-grid defect, then passed typecheck, focused 21/21 tests, and production build.
  Product fingerprint is
  `sha256:283789106e9cc978af3cb4eb9a5a81c32d03182e44ddfbab4834742a8a364370`.
  Its post-repair 14-state x 3-viewport matrix contains 42/42 unique rasters at exact CSS
  1440x900, 960x800, and 390x780; matrix fingerprint is
  `sha256:2b4b7a8ec40ea1ee743c5242f214d44ff22102c09d5d4542f30676f3c10f29e2`.
- Playground fixture fingerprint is
  `sha256:931c12797624fc158c75edbbf19ba09009f41a467ac280452f23976f90f4a860`.
  Tool failure receipts are
  `sha256:aadee0cd2012869274fd92c5fbf261db54ba181050eef91e5e84182fff1a066d`
  and `sha256:3b6cf237d906b3a68b73bfa49c3ea014089349aac9544d6d4ce1fa7b0b5f0281`.
  The historical blocked capture-preflight receipt is
  `sha256:980e54836dc3fdeaaf905bfbbc0123a6aeb762de32bdee476705a185a404d346`.
- Knowledge classification: `missing`. Existing runtime knowledge separated viewport effectiveness,
  backend gaps, and repository reproducibility, but did not distinguish an unsupported capture-tool
  capability from a product interaction failure. The strict validator also forced three applicable
  zoom rasters even when the tool could not create them.
- Decision: `CHANGE` the smallest shared capture owners. Only `zoom-restored` may now be
  `not-applicable`, and only after one native attempt plus one fresh-context confirmation bound by an
  exact `capability://zoom/...` receipt. Zoom-in, zoom-out, and restored cells remain in canonical
  order as `tool-capability-unavailable` with null rasters. Every other readiness check and applicable
  probe remains mandatory. This exception does not prove zoom behavior and cannot be used by another
  category, partially, or with renamed/duplicate rasters.
- Runtime fingerprint:
  `sha256:5f69fbc776736c8e55736479c4d103cc6b54ce21fdb778df53fbd3987b4f6a83`.
- Regression proof accepts one complete unsupported-zoom lifecycle and rejects a non-zoom exception,
  missing capability receipt, partial unsupported lifecycle, raster-backed unsupported lifecycle, and
  the previous false requirement that unavailable zoom must suppress all other visual review.
- Focused strict UI suite: 15/15 passed. Full active operator suite: 115/115 passed. Self-upgrade:
  6/6 passed. Skill validation: 13 public skills. Release: 13 skills, 149 operators, 78 knowledge
  records.
- All prior capture-preflight/render-capture/visual-fidelity proof is stale for the affected owners.
  Playground must reload repair 004 and resume from capture-preflight using its preserved post-repair
  source/matrix/fixture evidence. CV must reload only if its current packet requires the changed zoom
  disposition; its independent pixel verdict and source binding may not be silently reinterpreted.

### Fresh actor outcomes under repair 004

- CV reloaded repair 004 and kept zoom as genuinely `passed` because its three phases had distinct
  fresh rasters. Final source fingerprint is
  `sha256:2240601369a0e662997e78df899045e380de514e736b936b1cab572c6ebc2515`;
  fixture fingerprint is
  `sha256:13bb79cab892edefdb01d203b5e79f2ff1ba9be6b8e3dce45058984bbcc60b93`.
- CV's repair-004 round-2 reviewer rejected seven short-state rasters where the username appeared
  clipped under the fixed header. Classification proved a capture defect: the seven cells inherited
  harness auto-scroll, while a fresh page-top baseline on the same product source rendered the full
  hero. The actor fixed only harness alignment, invalidated the packet, and used the final round as
  regression; product source did not change for this finding.
- CV final packet fingerprint is
  `sha256:bca1cd5b61649892ac5e129b0b0fdaf74d9d12104804ec8905bbf9ccfabd9f20`.
  One fresh isolated Sol reviewer passed 38/38 unique rasters, 19/19 applicable probes, retained three
  exact not-applicable probes, and returned no uncertainty. Two independent behavioral receipts then
  passed 15/15 each on the same final runtime/source fingerprint. Final disposition is
  `fixture-passed + backend-handoff`, never COMPLETE/live integration. Focused tests 3/3, typecheck,
  production build, and diff check passed; no commit, push, or deploy occurred.
- Playground reloaded repair 004 and produced a schema/semantic/invocation-valid packet with 59 unique
  rasters: 42 state/responsive, 16 applicable probes, and one host sentinel. All three zoom cells stayed
  canonical with null rasters and `tool-capability-unavailable`.
- Playground's first repair-004 reviewer inspected 59/59 and returned REPAIR for an apparently missing
  loading shell and missing keyboard focus indicator. Fresh native browser classification proved both
  were capture defects: loading inherited nonzero page scroll even though its source shell was present
  at scrollY=0, and the focus probe left BODY active whereas real sequential keyboard focus on Enter
  workspace showed the existing two-layer purple focus ring. Only affected evidence cells and the
  shared host sentinel are being recaptured; product source fingerprint remains unchanged.

## Interim disposition

- ADD: adopt `fe.runtime-capture-readiness` from independent CV/Playground evidence.
- CHANGE: adopt the runtime-observe and capture-preflight contract repair under fingerprint
  `sha256:87b15f8ff77082b9167e97eddcd76ddc5d725b47d3c34f8ef9d705bcc0d8d812`.
- REMOVE: pending evidence.
- Product-output verdicts and per-actor two-pass stability remain pending. This runtime repair is
  validated but not yet behaviorally closed.

## Runtime repair 005 — Grammar Core DNA, mandatory UI laws, and pre-mutation compile

- Triggering counterevidence: Personal Project and Playground could follow the procedural FE chain
  while still producing rough, generic, poorly owned layouts. The runtime treated Grammar as a final
  token pass, mixed package recipes into universal UI knowledge, and allowed visual review without a
  product-family comparison packet. Correct state transitions therefore did not guarantee the
  requested StarCi-quality output.
- Smallest-owner diagnosis:
  - `ADD` packaged Core primitives/compositions and StarCi visual DNA in `@starci/grammar/core`;
  - `CHANGE` `fe.ui` into mandatory durable laws only;
  - `CHANGE` the FE machine and operator contracts so UI-law/detail/layout/Grammar bindings precede
    mutation and remain immutable through apply and proof;
  - `REMOVE` token-only/post-layout Grammar treatment, package recipes from `ui.md`, and image
    generation justified only by empty space.
- Three independent Sol agents owned disjoint write roots: Grammar package, UI laws, and FE process.
  Supervisor cross-review found and repaired three integration contradictions before closure:
  reuse-versus-generate asset precedence, incomplete media purpose roles, and `ui-detail-freeze`
  running after Grammar compilation.
- Final state order:
  `principle/UI laws -> ui-detail-freeze -> responsive layout -> Grammar Core -> contract freeze ->
  mutation -> capture -> blind family-aware review`.
- Media rule: a sound, content-complete composition may reserve a purposeful media slot. Reuse an
  approved asset when it already serves the role; otherwise freeze purpose, owner/placement, brief,
  responsive crop/contain, alt intent, and fallback before generating a bitmap. Empty space alone,
  weak hierarchy, missing content, or a layout defect is rejected as filler.
- Grammar package fingerprint (48 source/package files, excluding build and dependency output):
  `sha256:2b2d198b322fae288346a36a14d0ef57f8814c2561e700455842339668047795`.
- Runtime contract fingerprint (86 exact UI-law/FE-process/operator files):
  `sha256:05dda07ca17dc5f0247f042421cf238d03b84438987dc9b06e5911a1c046b792`.
- UI-law fingerprint:
  `sha256:30c57ba5365ed02a69fc38696f7afed3f287229ec54990056655c49e60a724d3`.
- Independent supervisor verification:
  - Grammar typecheck/build plus 5 Node and 29 Vitest tests passed;
  - all 124 active operator specs passed;
  - self-upgrade 6/6 passed;
  - Source-wide `.claude` test passed;
  - release valid with 13 mission skills, 149 atomic operators, and 78 knowledge records.
- Product-source boundary: no Personal Project, CV, Playground, or other page was changed, committed,
  pushed, or deployed by repair 005. The next FE `new`/`reconstruct` action must materialize the new
  URI bindings and benchmark raster packet; this repair does not retroactively convert prior product
  output into a visual PASS.

## Historical contract audit: live multi-task supervision before repair 001

The findings below record the pre-repair baseline and are retained as causal evidence; they do not
describe the final repair-005 runtime.

At that baseline, the self-upgrade contract was sufficient for one static workflow failure, but it did not
model this live two-task observation mission completely:

- `fixtureRefs` can point at tasks only as opaque artifacts; there is no typed actor/task identity,
  phase, cursor, runtime fingerprint, communication receipt, or terminal evidence cell.
- The machine enters one flat integration baseline immediately. It has no collect/wait, per-action
  validation, cross-case comparison, follow-up, runtime-reload, or correlated resume states.
- Attempts and consecutive-pass accounting are global. They cannot prove that Personal Project and CV
  each passed twice, and mixed case ordering could produce a misleading aggregate streak.
- `knowledge` is a required diagnostic layer, but the output does not classify `missing`, `not-loaded`,
  `contradictory`, `stale`, or `misapplied`, nor bind the selected smallest knowledge/Grammar owner.
- After a runtime mutation, no contract invalidates proofs produced under the old runtime fingerprint
  or requires each active actor to reload and resume from an exact state.
- Existing regression tests exercise one synthetic output lifecycle, not two live actors with partial,
  asymmetric, delayed, version-skewed, or contradictory results.

The coordination repair described above was implemented earlier in this observer run. Runtime repair
001 is a separate evidence-driven correction discovered while supervising the product actors. Both
remain open until fresh actor results under their current fingerprints satisfy per-actor stability.

## Runtime repair 006 — backend proof cannot be skipped; UI laws regain a routed directory

- Triggering counterevidence: Playground capture preflight correctly emitted `backend-required`, but
  the later fixture path proceeded without a canonical `starci-backend-process` CALL/RETURN. The final
  round-3 block therefore reported visual and fixture contradictions while the earlier backend
  obligation disappeared from the executable chain.
- Block ownership is now explicit:
  - cells 033, 052, and 054 are frontend clipping defects;
  - the completed/failed fixture copy contradictions are frontend state-truth defects;
  - round 3 is only the circuit breaker that stops a fourth blind repair round;
  - unsupported zoom is not a product block when the exact capability receipt is retained, but it is
    still untested and cannot be claimed;
  - missing routed Playground records are backend runtime/data readiness and must enter the Backend
    Skill even when backend mutation is frozen.
- Backend source already contains Playground resolvers, sessions, agents, and verification paths. The
  first peer action is therefore `starci-backend-process` with `intentMode=prove`, not speculative
  implementation. The local `.mount/data/courses/2-devops-mastery/playgrounds/` seed source is absent,
  so the Backend Skill decides from evidence whether the gap is data/seed/runtime readiness or actual
  implementation and returns to the same FE mission.
- Contract-fixture mode now requires `backendProofReceiptRef`, the exact consumed Backend Skill prove
  RETURN. `backend-required` is invalid without a typed prove handoff. That receipt is copied unchanged
  through preflight, capture, blind packet, and visual result; visual failure or the circuit breaker
  cannot erase it.
- User counterevidence also proved repair 005 flattened the former principles tree incorrectly into
  one `knowledge/ui.md`. The active authority is now `knowledge/ui/INDEX.md` plus eight progressively
  routed law records: render truth, hierarchy, ownership/composition, boundaries/spacing, responsive,
  states/affordance, media, and evidence. Grammar Core still exclusively owns packaged components,
  tokens, recipes, and visual DNA.
- Focused FE/backend-routing and UI-law regressions: 44/44 passed. Full active operator suite: 124/124
  passed. Self-upgrade/runtime suite: 39/39 passed. Release: 13 mission skills, 149 operators, 86
  knowledge records.
- All prior preflight/capture/visual evidence is stale for these owners. The next Playground run must
  reload this runtime, issue Backend `prove`, consume RETURN, then resume FE from `apply` or
  capture-preflight. No product source, backend source, commit, push, or deployment is claimed here.
