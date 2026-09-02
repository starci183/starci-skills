# StarCi Skills 1.0.0

This tree is the runtime. Read [SKILL.md](SKILL.md) next; it is the single entry that freezes a
mission's scope, selects the one operator that owns the outcome, and routes between operators on
typed results.

## Load order

1. `SKILL.md` — entry, routing loop, and the authority statement.
2. `routing.json` — the closed map from every operator's `failure.owningDomain` to its next step. It
   is validated against the operators' own schemas, so a missing route is a build failure.
3. `resources/` — which execution profile runs each operator role, which runtime grants it may use,
   and its standing answers on web search, Grammar binding, and image generation. Also validated.
4. The one operator the mission needs: its `operator.json`, `context.md`, `input.md`, `execute.md`.
5. Only the knowledge topics that operator binds.

Do not preload the tree. An operator binds the smallest set of topics its decision needs, each with
its fingerprint and complete rule inventory, and may emit no identifier outside that inventory.

## Layout

```text
SKILL.md                 one entry, fourteen operators, one routing map
routing.json             14 operators, 76 routes, four kinds: operator | resume | user | external
resources/               agents/profiles/{codex,claude}.json (6 profiles); each operator.json binds one of them under resources; validated
operators/<id>/          fifteen files each; operator.json carries resources; self-test.mjs must pass
knowledge/
  ui/composition/        what a tree must contain, before it exists   -> fe.direction.decide
  ui/presentation/       which CSS value an app-owned boundary takes  -> fe.presentation.resolve
  ui/proof/              what is only true once rendered              -> fe.surface.audit
  patterns/fe, be        code conventions extracted from the two live sources
  grammars/<family>/     one visual family's realization of Common
scripts/                 validate-routing.mjs, validate-resources.mjs, validate-knowledge-citations.mjs, run-operator-self-tests.mjs;
                         device-state.mjs and workspace-portable.mjs (+ specs), which the backend package.json calls
readiness/               workspaces/ schemas that the portable and hydrated route declarations name as $schema
audits/<version>/        dry-run records with their validated input and output artifacts
```

`npm test` runs the routing validation, the resources validation, the knowledge citation check, every operator self-test, and the two script specs. It is green at the published
head or the head is not publishable.

## Rules that hold everywhere

- An operator performs one job in one linear pass. It never calls another operator, routes a
  workflow, pauses internally, or returns free-form control instructions. The parent alone maps a
  validated output to the next transition.
- Only a validated field routes. Prose in a receipt, a narrated outcome, or an output that failed its
  validator does not route.
- Authority lives in operator schemas, not in this file or in `SKILL.md`. `git.publish` cannot
  express a force push; `release.deploy` cannot run without its declared authorization;
  `uat.verify` has no field that can hold a credential.
- English `.md` files are the only runtime authority. Same-stem `.vi.md` files are human mirrors and
  never enter a context manifest, dependency list, validator input, or operator binding.
- Rule IDs are stable public addresses. Append; never renumber, reuse, or silently change meaning.

## Lineage

This tree replaced the v7.6 runtime on 2026-09-02. The complete v7.6 tree, including its 13 skills,
113 operators, templates, and runtime contracts, is preserved on the `v7` branch of this repository.
A v8 document that cites a v7-only file names that branch.
