Owner: knowledge/hfs/rules.yaml
# QUALITY BAR — what ".claude produces a high-quality project" means

> **Status: DRAFT** — aspiration list. An item is only real once a check, an op
> brief requirement, or a gate exists that can fail it. Unchecked items are
> targets for future `scripts/checks/` work, not enforceable rules yet.

Every project built through this runtime must satisfy this bar. Each item names
how it is *proven* — declaration never counts, evidence does.

## 1. Kernel dynamism (goal mutates, chain adapts)

- [ ] Goal revision mid-flight → kernel re-derives `S*`, invalidates affected
      legs, keeps unaffected in-flight ops, re-plans from the boundary
- [ ] In-flight op against a superseded goal revision → cancelled via lease
      revocation, its partial evidence marked superseded (not deleted)
- [ ] Verdict that falsifies `S₀` assumptions → state invalidated → re-chain,
      never patched around
- [ ] Order ambiguity resolved by kernel with assumptions recorded in the goal;
      identity ambiguity → owner escalation, never guessed
- [ ] Every re-plan emits a ledger event: what changed, why, which legs died

## 2. interface.draw — beautiful, not placeholder-grade

- [ ] Design tokens real: spacing scale, type ramp, elevation, radius — from the
      project's design system, not ad-hoc px
- [ ] Grammar-adherent renders via `packages/grammar` — shots are generated
      from the grammar, not hand-mocked
- [ ] Real copy and real data shapes — no lorem, no `Item 1`
- [ ] All breakpoints: mobile / tablet / desktop shots as evidence
- [ ] Dark + light where the system supports both
- [ ] Composition quality reviewed against reference renders — not "it
      rendered", but "it looks right"
- [ ] Density, rhythm, alignment pass — no orphaned labels, clipped text,
      misaligned grids

## 3. UX completeness — smooth

- [ ] Loading: skeleton screens for content regions (not page-wide spinner);
      spinners only for short indeterminate actions
- [ ] Error: inline field errors, form-level errors, retry affordance, no dead
      screens
- [ ] Empty: designed empty states with next-action, not blank boxes
- [ ] Validation: inline on blur/submit, async uniqueness checks debounced,
      server errors mapped back to fields
- [ ] Mutation UX: optimistic update + rollback on failure; destructive actions
      confirm + undo window where feasible
- [ ] Motion: transitions on state changes, no layout jump, respecting
      reduced-motion
- [ ] Lists: pagination/virtualization past threshold; pull-refresh/reconnect
      behavior defined
- [ ] Async boundaries: permission-denied, offline, rate-limited, session-expired
      — each has a designed state
- [ ] Accessibility: focus order, keyboard operability, aria on interactive
      custom widgets, contrast ratio
- [ ] i18n-ready strings; vi/en per project convention

## 4. Code quality — close to the design, faithful to the grammar

- [ ] Implementation matches the SDS/draw contract — drift between design and
      code is a failed check, not a style note
- [ ] StarCi patterns only: module boundaries, naming, file layout per
      `knowledge/` conventions — no invented structure
- [ ] No dead code, no TODO-debt, no commented-out blocks in landed code
- [ ] Typed at every boundary (API contracts, events, state); errors are
      taxonomy'd, not stringly
- [ ] Back-end tests use TestingModule / real clients as their lane requires;
      measured logic meets the per-file coverage policy (error paths included)
- [ ] No secrets in code/logs; inputs validated at boundary
- [ ] Performance: no N+1, no unbounded queries, budgets respected

## 5. Evidence — proof, not assertion

The section's own premise is enforced by
`scripts/work/validate/check-evidence-binding.mjs` (EVIDENCE_ASSERTED_NOT_OBSERVED),
which refuses a `done` leaf resting on `verificationSource: authored-claim`.

- [ ] Render evidence: shots per breakpoint, per theme, generated via grammar
- [ ] UAT: video (webm) per journey INCLUDING failure paths, not only happy path
- [x] Freshness: evidence younger than the code it proves — enforced by
      scripts/work/validate/check-evidence-binding.mjs (EVIDENCE_OLDER_THAN_SOURCE)
- [ ] Code change after evidence → re-verify leg auto-issued (the check above
      reports the drift; nothing schedules the re-verification)
- [x] Every `done` claim resolves to artifact paths that exist and match content
      digests — enforced by scripts/work/validate/check-evidence-binding.mjs
      (EVIDENCE_PATH_MISSING, EVIDENCE_DIGEST_MISMATCH)

## 6. Process integrity

- [ ] 1 op = 1 agent; ownership boundaries enforced; conflicts self-resolved by
      the op agent
- [ ] Token/model allocation from `modules/models/selection.yaml` — centralized,
      deterministic, cited
- [ ] Wrong business flow → re-run from owning Business/SRS boundary with fresh
      evidence — never relabeled as debt
- [ ] `practices/` entry written after each wave — what was practiced,
      observed, derived

## 7. Alpha.15 requirements

These requirements apply to lite and full. They state the standard; their presence
here does not prove that each checker or CLI option is implemented in this
checkout. The draft checklist above keeps its existing status.

- **R247 RT_COVERAGE_MATRIX:** Every applicable edition needs linked rule, enforcer, spec, witness, owning doc, template and example evidence for each surface; edition differences need a reason and gate declarations must match their execution.
- **R270 HFS_DOC_FRESH:** Product README, docs and stack runbooks must cite existing paths, catalogued commands, declared environment keys and known rule IDs.
- **R272 BE_APP_BOOT_PROOF:** Lite must prove each app's Nest module graph compiles with doubles and rejects missing or circular providers; full keeps its real-app e2e boot proof.
- **R273 HFS_COVERAGE_BELOW:** Supplied back-end lcov evidence must meet the measured per-file coverage policy below, with unmeasured feature, CLI and webhook paths listed separately.
- **R274 RT_RULING_SUPERSEDED:** A superseded ruling citation must identify its successor in the same paragraph; stale ruling text must not prescribe the former behavior.
- **R280 HFS_UNUSED_SYMBOL:** Exported symbols, enum members, queue constants, error codes and catalog keys must have consumers.
- **R282 HFS_ASSET_BUDGET:** Back-end assets must obey their declared per-file size and allowed-kind budgets; large and user media belong in object storage.
- **R283 HFS_APP_LEXICON:** Source and docs must exclude product vocabulary declared in `hfs.json lexicon.removed`.
- **R284 BE_PATTERN_PROOF_LANE:** Lite must prove declared event-bus, queue, webhook, realtime, fenced-job, projection and saga scenarios in its integration-spec lane; full retains its existing proof lanes.
- **R285 FE_SWR_FAMILY:** SWR calls and data-operation access belong in `hooks/swr`; components and other hook families consume those wrappers.
- **R286 FE_COPY_AND_GLYPH:** User copy, including toast and validation arguments, comes from i18n; alerts are forbidden and inline SVG is confined to a declared brand-mark leaf.
- **R287 FE_CALLBACK_SHAPE:** An auth callback exchanges the PKCE code and redirects only, with cookie writes confined to the Supabase helper.
- **R288 FE_STACK_ALLOWLIST:** Front-end dependencies need a catalog entry or a reasoned `fe.extraPackages` declaration; GraphQL tagged templates must match the schema and SWR keys must carry operation identity by default.

### Measured coverage scope

Product back-end coverage has one derivation: `scripts/hfs/coverage-scope.mjs`
reads the `coverage: required|none` fields and `ruleParams.be.logicRoles` of
`knowledge/hfs/slots.yaml`. In both editions, only files with those logic-role
suffixes inside required slots are measured, currently under
`be/src/modules/{domain,platform,integrations,projections}/`, subject to declared
provider slots and excluded subtrees. Each measured file owes 100% lines,
branches, functions and statements. The managed Jest thresholds, Sonar coverage
exclusions and Codecov configuration render that same scope; it is not a
whole-application percentage.

The feature tier, CLI commands, webhook doors, gateways, handlers and saga steps
outside those measured slots, declaration and composition files, and tests are
outside this denominator. A logic role such as `webhook` or `saga-step` inside a
required module slot is measured. Front ends have no tests under R97
`FE_NO_TESTS` and are excluded from coverage. Static app checking and linting do
not run the unit project or establish that coverage passed. R273 requires
supplied lcov evidence; the current app-check command catalog does not yet expose
the alpha.15 coverage-input option.

Runtime coverage is separate: `scripts/hfs/runtime-coverage-scope.mjs` derives
measured `.mjs` files from required slots in `knowledge/hfs/runtime-slots.yaml`,
excluding none slots, specs and declared generated output. Its
`coverage/lcov.info` report is distinct from a product's `be/coverage/lcov.info`.
R247's coverage matrix concerns links across the standard, not a code-coverage
percentage.
