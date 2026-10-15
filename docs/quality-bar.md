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
- <a id="r270"></a>**R270 HFS_DOC_FRESH:** Product README, docs and stack runbooks must cite current product facts. `HFS_DOC_PATH_MISSING` names an absent repository path, `HFS_DOC_COMMAND_UNKNOWN` an unknown command, `HFS_DOC_ENV_UNKNOWN` an undeclared environment key, and `HFS_DOC_RULE_UNKNOWN` an unknown rule ID.
- <a id="r272"></a>**R272 BE_APP_BOOT_PROOF_MISSING:** Lite must prove each app's Nest module graph compiles with doubles and rejects missing or circular providers; a missing or failed proof is refused. Full keeps its real-app e2e boot proof.
- <a id="r273"></a>**R273 HFS_COVERAGE_BELOW:** Supplied back-end lcov evidence must meet the measured per-file coverage policy below, with unmeasured feature, CLI and webhook paths listed separately.
- <a id="r274"></a>**R274 RT_RULING_STALE_CITE:** A superseded ruling citation must identify its successor in the same paragraph; stale ruling text must not prescribe the former behavior.
- <a id="r280"></a> **R280 HFS_UNUSED_SYMBOL:** Exported symbols, enum members, queue constants, error codes and catalog keys must have consumers.
- <a id="r282"></a> **R282 HFS_ASSET_BUDGET:** `HFS_ASSET_OVERSIZE` refuses a back-end asset above its per-file size budget; `HFS_ASSET_KIND` refuses an unsupported tracked asset kind. Large and user media belong in object storage.
- <a id="r283"></a> **R283 HFS_APP_LEXICON:** Source and docs must exclude product vocabulary declared in `hfs.json lexicon.removed`.
- <a id="r284"></a> **R284 BE_LITE_PROOF_LANE_MISSING:** Lite must keep its declared event-bus, queue, webhook, realtime, fenced-job, projection and saga proofs in a runnable integration-spec lane; the existing `BE_PATTERN_SPEC_MISSING` code names a missing scenario. Full retains its existing proof lanes.
- <a id="r285"></a> **R285 FE_SWR_FAMILY:** `FE_SWR_OUTSIDE_FAMILY` confines SWR calls to `hooks/swr`; `FE_OP_OUTSIDE_SWR_HOOK` confines API operation imports and calls to those wrappers. Components and other hook families consume the wrapper hooks.
- <a id="r286"></a> **R286 FE_COPY_AND_GLYPH:** `FE_COPY_IN_CALL` requires toast and validation arguments to come from i18n; `FE_NO_ALERT` refuses browser alerts; `FE_ICON_INLINE_SVG` confines inline SVG to a declared brand-mark leaf.
- <a id="r287"></a> **R287 FE_CALLBACK_SHAPE:** An auth callback exchanges the PKCE code and redirects only, with cookie writes confined to the Supabase helper.
- <a id="r288"></a> **R288 FE_STACK_ALLOWLIST:** `FE_STACK_UNLISTED` requires each front-end dependency to have a catalog entry or a reasoned `fe.extraPackages` declaration; `FE_STACK_CORE_MISSING` requires product apps to declare the core runtime packages, with the full marketing app exempt. GraphQL tagged templates must match the schema and SWR keys must carry operation identity by default.
- <a id="r291"></a> **R291 HFS_FUNCTION_BUDGET:** A back-end or front-end function, method or arrow body has at most 80 physical lines, including comments and blank lines, in both editions.
- <a id="r292"></a> **R292 HFS_FEATURE_FILE_BUDGET:** A feature owner has at most 250 tracked files, including nested files, in both editions.
<a id="coverage-matrix"></a>

R247 reports `RT_COVERAGE_MATRIX` when its inventory cannot be parsed. For an
applicable rule and edition, `RT_COVERAGE_NO_ENFORCER` identifies an absent
running enforcer, `RT_COVERAGE_NO_SPEC` a missing named proof header,
`RT_COVERAGE_NO_WITNESS` a missing mutation or dated unreachable explanation,
and `RT_COVERAGE_NO_DOC` a missing owning document that explains the code.
`RT_COVERAGE_NO_TEMPLATE` identifies missing template coverage and
`RT_COVERAGE_NO_EXAMPLE` a missing example construct.
`RT_COVERAGE_EDITION_ASYMMETRY` requires an existing ruling for edition differences;
`RT_COVERAGE_SCHEMA_NO_RECORD` requires a full example record for an authored Work
schema; `RT_COVERAGE_GATE_LIE` refuses gate claims unsupported by actual commands.
`RT_COVERAGE_SUPERSEDED_CITE` identifies stale ruling references,
`RT_COVERAGE_SURFACE_UNMAPPED` identifies missing slot and rule surface mappings,
and `RT_COVERAGE_REQUIREMENT_UNLEDGERED` identifies a hard documentation
requirement without a valid ledger entry or owning rule anchor.

`RT_COVERAGE_PROOF_VACUOUS` refuses proof that only mentions a code, has empty
valid or invalid fixtures, or lacks both a passing and a violating assertion for
the applicable edition. Edition loops, table-driven tests and local assertion
helpers count when their assertions resolve to that code and edition. Each
enforcer needs proof for the code it emits; one code cannot prove unrelated
enforcers. `RT_COVERAGE_CODE_UNROUTED` identifies a machine code routed to lint
when its profile's ESLint plugin has no enforcer that handles it.

A rule with no scaffolded surface may declare `templateNa` with a reason instead
of citing an unrelated template. Required and managed slot templates still need
their own evidence.

<a id="r112"></a>

Rules before R247 without any coverage metadata remain warnings in the legacy
backlog. Adding any of `editions`, `docs`, `exemplifiedBy`, `proves` or `witness`
adopts a rule into the coverage gate. R247 onward is always gated, including
witness and example evidence. The older rules that already declare editions
also owe their complete chains: full-only R112 `BE_INTEGRATION_SPEC_MISSING`
requires a provider integration world spec with the integration's error codes
and an outage; R167 `BE_ASYNC_SPEC_MISSING` requires consumed-event e2e proofs
that publish, read effects and redeliver, including compensation events; R173
`BE_SAGA_E2E_MISSING` requires a compensation e2e proof under an injected fault.

### Measured coverage scope

Product back-end coverage has one derivation: `scripts/hfs/coverage-scope.mjs`
reads the `coverage: required|none` fields and `ruleParams.be.logicRoles` of
`knowledge/hfs/slots.yaml`. In both editions, only files with those logic-role
suffixes inside required slots are measured: `be.domain`, `be.platform`,
`be.integrations` and `be.projections`, subject to declared
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

<a id="r48"></a>
### Behavioral spec quality

`BE_SPEC_QUALITY` requires specs to assert results or persisted state with exact values. Build a unit subject through a providers-only `TestingModule`, obtain it from the module reference, and supply infrastructure doubles from the test kit. Avoid source-reading assertions, module mocks, constructing the subject directly, sleeps and model calls in end-to-end flows. Enter end-to-end scenarios through production transport and read the persisted effect back. Specs must run without skip, focus, todo or conditional runner selection; the test-world library alone may skip a contract sandbox when its configuration is absent.

<a id="r155"></a>
### Declared pattern scenario proofs

R155 reports `BE_PATTERN_SPEC_MISSING` when a back end declares a pattern in
`hfs.json sides.be.patterns` but lacks a test titled `<pattern>/<scenario>: ...`
for one of that pattern's required scenario ids in `ruleParams.be.patternScenarios`.
Full accepts tracked e2e or integration specs under `be/src/tests`; lite requires
runnable tests in tracked `be/src/tests/integration/*.integration-spec.ts` files,
including nested folders. Adding the missing scenario proof clears the finding.
