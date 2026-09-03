# StarCi Skills 1.2.0

This tree is the runtime. Read [SKILL.md](SKILL.md) next; it is the single entry that freezes a
mission's scope, selects the one operator that owns the outcome, and routes between operators on
typed results.

## Load order

1. `SKILL.md` — entry, routing loop, and the authority statement.
2. `routing.json` — the closed map from every domain a stop code hands to (see the Stop codes table of
   `operators/INDEX.md`) to its next step. It is validated against the operators' Stops tables, so a
   missing route is a build failure. `workflows/` holds the example chains the entry reuses.
3. `resources/` — which execution profile runs each operator role, which runtime grants it may use,
   and its standing answers on web search, Grammar binding, and image generation. Also validated.
4. The one operator the mission needs: its `operator.md` (Job, Context, Inputs, Requirements, Steps,
   Outputs, Stops, Next) plus `operator.json` (id, domain, resources). Stop codes resolve through the
   Stop codes table of `operators/INDEX.md`.
5. Only the knowledge topics that operator binds.

Do not preload the tree. An operator binds the smallest set of topics its decision needs, each with
its fingerprint and complete rule inventory, and may emit no identifier outside that inventory.

## Layout

```text
SKILL.md                 one entry, fourteen operators, one routing map
routing.json             14 operators, 68 routes, four kinds: operator | resume | user | external
alias/                   alias.json (machine registry: location, scheme, binding, writers, zone) + INDEX.md (generated map by zone); every operator reads by alias only
resources/               tools.json (the closed tool registry: modes and per-runtime support, addressed as @tools/<id>) + agents/profiles/{openai,claude}.json (6 profiles, permits per tool) + orchestrator.json (one agent per operator, max 3, profile equivalents); validated
workflows/               example chains (steps of parallel branches, loops, presets) the entry reuses when a request matches their when; otherwise it composes its own under the same rules; validated
operators/INDEX.md       generated: what each operator reads, which kinds it consumes and produces, its steps, and every stop code with its disposition; operators/errors.json holds the codes several operators share
operators/<id>/          operator.md (+vi) one authored file per operator, operator.json (id, domain, resources), errors.json (its own codes), validate.mjs, self-test.mjs
knowledge/
  ui/composition/        what a tree must contain, before it exists   -> frontend.direction.decide
  ui/presentation/       which CSS value an app-owned boundary takes  -> frontend.presentation.resolve
  ui/proof/              what is only true once rendered              -> frontend.surface.audit
  patterns/fe, be        code conventions extracted from the two live sources
  grammars/<family>/     one visual family's realization of Common
templates/               one template per document kind; each carries the json template-contract the tree is checked against;
                         kinds/ types every file that crosses between steps (<kind>.contract.json + <kind>.skeleton.md for markdown, <kind>.schema.json for data); step/ holds the request.json and response.json gates
scripts/                 validate-routing.mjs, validate-resources.mjs, validate-knowledge-citations.mjs, validate-alias.mjs, validate-templates.mjs, validate-operator.mjs, validate-workflows.mjs, validate-request.mjs, validate-response.mjs, validate-step.mjs, run-operator-self-tests.mjs;
                         device-state.mjs and workspace-portable.mjs (+ specs), which the backend package.json calls
readiness/               workspaces/ schemas that the portable and hydrated route declarations name as $schema
```

`npm test` runs the routing validation, the resources validation, the knowledge citation check, the template check, every operator self-test, and the script specs. It is green at the published
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

1.2.0 (2026-09-03): the second test round (tests/) and its fixes: state.json has a schema and the resume linkage is checked; a workflow declares asks; response.next must be offered by the Next table; UNKNOWN_STOP is emittable; the architecture decision publishes the operations the backend plan consumes and cites coverage-matrix dimensions instead of BA-<n>; uat.verify accepts its own lawful refusal; a radius topic.

1.1.0 (2026-09-03): the tree ships as the npm package @starci/skills; npx @starci/skills init installs it as a repository's .claude runtime with the CLAUDE.md and AGENTS.md bootstraps, update keeps local edits, doctor runs the validators on the installed copy; @starci/grammar 0.4.2 (the core entry re-exports Common).

1.0.3 (2026-09-03): a tools registry replaces grants and policies (resources/tools.json, @tools/<id> in Steps, per-runtime support, profile equivalents); every operator binds an OpenAI profile for the Codex processor; the first test round (tests/) and its fixes; docs/ and sites/ return.

1.0.2 (2026-09-03): every operator is one authored operator.md with a request/response branch layout, JSON kind contracts, an errors registry with dispositions, example workflows, and the frontend.*/backend.source.apply names; 1.0.1 was the dry-run round that exposed the old shape.


This tree replaced the v7.6 runtime on 2026-09-02. The complete v7.6 tree, including its 13 skills,
113 operators, templates, and runtime contracts, is preserved on the `v7` branch of this repository.
A v8 document that cites a v7-only file names that branch.
