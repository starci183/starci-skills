# StarCi Skills 1.7.7

This tree is the runtime. Read [SKILL.md](SKILL.md) next; it is the single entry that freezes a
mission's scope, selects the one operator that owns the outcome, and routes between operators on
typed results.

## Load order

0. [`UPDATE.md`](UPDATE.md) — read before editing this tree, never to run a mission. It is the standard
   for updating a skills tree of this shape: the four questions asked in order, what may be added and
   what may not, how an id is modified and how one is retired, the evidence bar, the language rule,
   enforcement before advice, which files are generated, what a release means, and the pre-commit
   checklist. A change that has not been through it is not ready to commit.
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
  never enter a context manifest, dependency list, or operator binding; a parity validator reads them only to prove the mirror has not drifted, never as authority.
- Rule IDs are stable public addresses. Append; never renumber, reuse, or silently change meaning.

## Lineage

1.7.7 (2026-09-04): a walk is evidence only for what it pressed — every scored assertion of a UAT capture names the surface control the step acted on, so a step that makes something happen other than through the surface cannot be scored.
1.7.6 (2026-09-04): a score is a claim about the candidate it scores — a decision declares what each candidate does not carry, and a criterion declared unmet cannot be scored at the passing end nor left unscored.
1.7.5 (2026-09-04): a UAT run is triggered by need and authorised by the environment declaration for its seed and identity classes, not by a person named in the request; a state-reading topic — composition, accessibility, the taste lens — is blocked with its coverage gaps named when the matrix does not cover every state the direction declares, and a narrowed round cannot close a loop or exhaust a budget; the serve rung runs the delivery gates the product declares, patch coverage against the merged base included.
1.7.4 (2026-09-03): authority comes from the environment declaration — .stacks/<env>/environment.json marks each operation class declared or person, non-production defaults to declared for provisioning and runtime, production to person, and the approval field accepts the declaration reference with its hash; several rendered candidates are ranked by the proof rubric and the dominant one is taken, a person is asked only over a scored tie; a data-volume criterion is measured at the flow's representative seeded volume, routes to seed below it and is data-bound at it; a criterion the person's printed choice was known to fail is person-accepted and does not block quality or uat.
1.7.3 (2026-09-03): a decision handed to a person is printed as rendered candidates — one per option, at least three for composition or taste, a capture per viewport, a one-line question — and the direction and audit validators refuse a user route that prints fewer; the family binds by the route's grammarId as @knowledge/grammars/<family>; Steps rows state the job and the kind, mechanisms live in the kind contracts; UPDATE.md carries the two writing principles (nothing specific, no errata) and the tree is swept for both.
1.7.2 (2026-09-03): a restart is not a rebuild — scripts/serve-runtime.mjs records the served head and a digest of the route's manifests and lockfiles, clears the framework build cache when they moved, the previous head is unknown or --clean is asked, and stops the whole process tree of a server, verifying by connecting that the port is free; the platform-operation receipt requires a cache row and the validator refuses a kept cache over an unknown previous head.
1.7.1 (2026-09-03): INTEGRATION_CONFLICT retired into INTEGRATION_FAILED — serve resolves a merge conflict under a closed four-rule set, records each resolution on the merge, runs the delivery gates on the merged head before restarting, and stops only on a red gate; the audit's Served surface names the family version observed and the version the delivery was resolved against, and states the drift in the evidence of any verdict it could flip.
1.7.0 (2026-09-03): the runtime is each product's uat integration branch on the fixed projected port — platform.operate climbs the whole ladder (stack-up → locate → start-role → serve → attest), serve merges the session branch into uat and restarts idempotently by head, servers run detached with pid and log (scripts/serve-runtime.mjs), the lease is the merge order, RUNTIME_BUSY and INTEGRATION_CONFLICT; workspace.bind binds by ancestry (the served head contains the pinned commit); the audit takes a route input and a Served surface section; UAT snapshots carry isolation; the two-sessions-one-product law lives in one place; a ports projection schema with sessionSlots defaulting to 0.

1.6.1 (2026-09-03): @tools/print — direction prints every candidate URL and a capture per viewport before the decision is written, the audit prints the sheet, the worst capture per topic and the Verdict table, UAT prints the step-capture summary; receipts carry a ## Printed table and validators refuse a decision the person never saw.

1.6.0 (2026-09-03): a missing UAT record is created, not reported — platform.operate provisions the account at the registry's identity provider with the sealed shared password and seeds the data; the runtime registry is keyed <project>/<role> (owner.schema.json) and carries identity; the audit signs in as the flow's account and IDENTITY_MISSING hands to provisioning; the UAT flow folder (flow.md, accounts.<env>.json, seed, golden snapshots, append-only runs, latest.json, history.md) is a contract; env on uat, audit and platform; the staging-uat example workflow.

1.5.4 (2026-09-03): the host probes a port by connecting before binding (Windows lets two servers bind one loopback port); 1.5.3 shipped with that spec red.

1.5.3 (2026-09-03): @tools/host ships its server (scripts/host-artifacts.mjs) so no session writes one for the occasion; .gitattributes pins LF.

1.5.2 (2026-09-03): the direction decision declares the surface class (coverage.surfaceClass and a ## Surface class row read from COVERAGE-1); the audit copies it from the decision instead of declaring one.

1.5.1 (2026-09-03): the contrast topic's verdict rule takes the topic's own prefix (CONTRAST-1); COLOR-6 is retired and points at it.

1.5.0 (2026-09-03): UPDATE.md, the neutral standard for changing a skills tree, first in the load order and shipped with the installer; session-first and SESSION_MISSING; git.publish demands receipts; every example workflow is a long flow (bind runtime → screenshot audit → quality → uat → publish); the taste (TASTE) and experience (UX) lenses conclude inside their own topics and the final verdict is a table in quality.verify's receipt; @tools/host serves candidates per viewport; the consolidation pass took the day's concepts from 44 places to 19 and retired ui.md and FE-TEST-7.

1.3.0 (2026-09-03): a mechanical presentation sweep (scripts/sweep-presentation.mjs: APP_OVERRIDE, APP_REIMPLEMENTATION, OFF_SCALE, SHELL_GEOMETRY) wired into frontend.source.apply and quality.verify; resolve scope covers every app-owned leaf/branch folder; twin, paired-spec and deployment-constant rules; rules are written product-agnostic.

1.2.0 (2026-09-03): the second test round (tests/) and its fixes: state.json has a schema and the resume linkage is checked; a workflow declares asks; response.next must be offered by the Next table; UNKNOWN_STOP is emittable; the architecture decision publishes the operations the backend plan consumes and cites coverage-matrix dimensions instead of BA-<n>; uat.verify accepts its own lawful refusal; a radius topic.

1.1.0 (2026-09-03): the tree ships as the npm package @starci/skills; npx @starci/skills init installs it as a repository's .claude runtime with the CLAUDE.md and AGENTS.md bootstraps, update keeps local edits, doctor runs the validators on the installed copy; @starci/grammar 0.4.2 (the core entry re-exports Common).

1.0.3 (2026-09-03): a tools registry replaces grants and policies (resources/tools.json, @tools/<id> in Steps, per-runtime support, profile equivalents); every operator binds an OpenAI profile for the Codex processor; the first test round (tests/) and its fixes; docs/ and sites/ return.

1.0.2 (2026-09-03): every operator is one authored operator.md with a request/response branch layout, JSON kind contracts, an errors registry with dispositions, example workflows, and the frontend.*/backend.source.apply names; 1.0.1 was the dry-run round that exposed the old shape.


This tree replaced the v7.6 runtime on 2026-09-02. The complete v7.6 tree, including its 13 skills,
113 operators, templates, and runtime contracts, is preserved on the `v7` branch of this repository.
A v8 document that cites a v7-only file names that branch.
