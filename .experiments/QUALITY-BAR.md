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

## 2. interface.draw — "vẽ đẹp", not placeholder-grade

- [ ] Design tokens real: spacing scale, type ramp, elevation, radius — from the
      project's design system, not ad-hoc px
- [ ] Grammar-adherent renders via `packages/grammar` — shots are generated
      from the grammar, not hand-mocked
- [ ] Real copy and real data shapes — no lorem, no `Item 1`
- [ ] All breakpoints: mobile / tablet / desktop shots as evidence
- [ ] Dark + light where the system supports both
- [ ] Composition quality reviewed against reference renders
      (`packages/grammar/reference-renders/`) — not "it rendered", but "it looks
      right"
- [ ] Density, rhythm, alignment pass — no orphaned labels, clipped text,
      misaligned grids

## 3. UX completeness — "nuột"

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

## 4. Code quality — sát design, bám grammar

- [ ] Implementation matches the SDS/draw contract — drift between design and
      code is a failed check, not a style note
- [ ] StarCi patterns only: module boundaries, naming, file layout per
      `knowledge/` conventions — no invented structure
- [ ] No dead code, no TODO-debt, no commented-out blocks in landed code
- [ ] Typed at every boundary (API contracts, events, state); errors are
      taxonomy'd, not stringly
- [ ] Tests are real journeys: TestingModule / real clients; no stub theater;
      branch coverage target met (error paths included)
- [ ] No secrets in code/logs; inputs validated at boundary
- [ ] Performance: no N+1, no unbounded queries, budgets respected

## 5. Evidence — proof, not assertion

- [ ] Render evidence: shots per breakpoint, per theme, generated via grammar
- [ ] UAT: video (webm) per journey INCLUDING failure paths, not only happy path
- [ ] Freshness: evidence younger than the code it proves; code change after
      evidence → re-verify leg auto-issued
- [ ] Every `done` claim resolves to artifact paths that exist and match content
      digests

## 6. Process integrity

- [ ] 1 op = 1 agent; ownership boundaries enforced; conflicts self-resolved by
      the op agent
- [ ] Token/model allocation from `modules/models/selection.yaml` — centralized,
      deterministic, cited
- [ ] Wrong business flow → re-run from owning Business/SRS boundary with fresh
      evidence — never relabeled as debt
- [ ] `practices/` entry written after each fleet wave — what was practiced,
      observed, derived
