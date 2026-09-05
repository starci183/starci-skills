# Resources

Questions and recorded choices follow [interaction](interaction.md).
Identity provisioning follows [provider-bound custody](identity.md).

Who runs each operator, with what, and under which standing policies. Two closed places carry it:

- `agents/profiles/<runtime>.json` — one file per runtime (`openai.json`, `claude.json`); the file owns
  its provider, a profile carries model, isolation, what the model can do here
  (`capabilities`), and what an operator on that profile is allowed to use (`permits`).
- `operators/<id>/operator.json` → `resources` — inside each operator: the one profile that runs it
  end to end, which grants it actually requires, and its answers to the three standing questions.
  Each operator's `operator.md` names the same aliases in its Context table. There is no central assignment file.

`scripts/validate-resources.mjs` runs inside `npm test`. It rejects an operator whose `operator.json` declares no
`resources`, an operator bound to an unknown profile, a required grant no assigned profile permits, a profile that permits
what its model cannot do, a policy answer that
contradicts the grants, a model an operator's own schema pins that is not its profile's model, and a row of the
process matrix below that disagrees with the operator it summarises. The registry, the operators,
and this summary therefore cannot drift apart silently.

## Binding rule

An operator binds exactly one profile and runs on it end to end, never per invocation and never
split across profiles: a critique, review, or judgement inside an operator is a step of that one
execution, and a second model for it would be a workflow. The profile decides the model and the
isolation; the operator's `operator.md` Steps decide the work; `resources.requires` decides which grants that
work may touch. A grant absent from `requires` is unavailable to the operator even if the profile
would permit it. Capability is a fact about the model; permission is a policy about the
operator: `gpt-5.6-sol` can search, draw, drive a browser, and write source, so `sol-fresh` may use all
four, while `astra` (Astra 6, the reader and judge) is permitted no image generation and no object store, because a reviewer that
produces is no longer a reviewer. Material brainstorms and reviews are always one fresh execution with no inherited
turns, and a reviewer receives artifacts and claims, never the producer's rationale.

## The three standing questions

**Does it search the web when the tree holds no reference?** Only where `policy.webSearch` is
`bounded`: the decision operators and the content brief. Research is bounded by the exact gap it must
close, records what it used, and never copies a page, brand, palette, or component anatomy. A
presentation value the knowledge does not publish is `RULE_MISSING`, never a research task.

**Is it bound to published Grammar?** Where `policy.grammarBound` is true: the four frontend
operators. Direction binds Grammar compositions; presentation resolves only against Grammar's owned
relationships; apply writes only resolved classes; audit judges against the same law. A missing
reusable capability is `GRAMMAR_REQUIRED` or `COMMON_CAPABILITY_MISSING`, never a local imitation.

**Does it generate images?** `required` only in content generation, where an image is made to a
stated claim and inspected for fidelity to it. `authority-only` in frontend direction: the direction
itself renders an inspectable page, and product artwork is generated only when product authority
names it. Everywhere else, `never`.

## Process matrix

A summary of what each `operator.json` declares; the validator rejects a row that disagrees. Mode is `inline` when the orchestrator runs the operator's steps itself in the chat under the operator's validators, `isolated` when one new agent with an empty context is created for it and sees only what its request names, and `dispatch` when an inline operator is raised, at most one at a time, to a forked agent that inherits the orchestrator's transcript (`resources/orchestrator.json#modes`).

| Operator | Profile | Grammar | Tools | Mode | Why |
| --- | --- | --- | --- | --- | --- |
| `environment.preflight` | astra | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `container:read` | inline | Reads declarations, checkouts, custody, the registry and the host once and reports every wall together; repairs nothing |
| `workspace.bind` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Reads canonical files and a registry; no judgement |
| `business.decide` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded` | isolated | An unfamiliar business model may need reference research before coverage can be frozen |
| `architecture.decide` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html` | isolated | Alternatives and compatibility need evidence beyond the repo; schema pins the model |
| `interface.plan` | astra | yes | `fileread:context-aliases`, `git:read` | isolated | Reads the reference, the source and the promise once and names every page and modal with one shell; decides nothing inside a unit |
| `interface.generate` | sol-fresh | yes | `fileread:context-aliases`, `git:commit-session-branch`, `websearch:bounded`, `imagegen:judged`, `visualize:html`, `host:loopback`, `print:decision-points`, `registry:read`, `sourcewrite:declared-write-set`, `shell:declared-commands` | isolated | One blind agent forms, renders and prints the candidates, resolves against the closed inventory and writes the tree once |
| `interface.audit` | astra | yes | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `host:loopback`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Browser only, no source write: the auditor cannot repair what it measures, and it signs in by credential name to reach a guarded route |
| `interface.fix` | sol-fresh | yes | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `shell:declared-commands`, `git:commit-session-branch` | inline | One finding, one small commit from the generator's inventory; bigger is FIX_TOO_LARGE |
| `library.update` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands`, `registry:publish`, `secrets:resolve-by-name` | isolated | Repairs the owner package with before/after proof, packs the release, publishes it to the registry its manifest names and consumes it in exact consumer metadata; `mode` runs both halves (`full`), the owner half alone ending at the published release (`publish`) or the consumer half alone against a bound release (`consume`), so two repositories are two routes |
| `backend.plan` | astra | no | `fileread:context-aliases`, `git:read` | isolated | Reads the frozen contract and the source once and groups its operations into modules with their proofs, migrations and order; fills nothing |
| `backend.generate` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands` | isolated | Writes inside a frozen contract following patterns/be, in full or as a fix |
| `identity.provision` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `sourcewrite:declared-write-set`, `browsercontrol:required` | inline | Creates the flow's account at the declared provider with the credential resolved by name and proves sign-in; writes only names |
| `data.plan` | astra | no | `fileread:context-aliases`, `git:read` | isolated | Reads the goal, the UAT plan, the map and the stores once and names one seed unit per flow or data family with its own namespace and targets; places nothing |
| `data.seed` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `secrets:resolve-by-name`, `http:probe`, `database:namespaced-write` | inline | Writes and applies a flow's seed under the isolation law, every row attributable, with its rollback |
| `runtime.serve` | sol-fresh | no | `fileread:context-aliases`, `git:merge-into-integration-branch`, `shell:declared-commands`, `http:probe`, `container:operate`, `secrets:resolve-by-name` | inline | Merges a session into the integration branch, restarts the one server by head, attests the entry, holds the lease |
| `service.operate` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `container:operate`, `http:probe`, `secrets:resolve-by-name` | inline | Runs the declared command of one declared auxiliary service, proves the state from its own probe, records the holder, holds the lease |
| `migration.release` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Applies the declared migration set once through the source-owned runner with the journal preserved |
| `business.reconcile` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read` | isolated | Compares the published promise head against the delivered source and records every discrepancy |
| `quality.verify` | astra | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe` | inline | Runs gates, repairs nothing |
| `uat.plan` | astra | no | `fileread:context-aliases` | isolated | Reads the goal and the map once and names one flow per journey with its own alias and namespace; walks nothing |
| `api.verify` | astra | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Runs the delivery's own end-to-end suite as a client against the served runtime and may write no source; the cases are the runner's, the lanes are judged apart |
| `uat.verify` | astra | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `secrets:resolve-by-name`, `database:namespaced-write`, `print:decision-points` | isolated | Drives the real journey in a browser and may write nothing; fresh verdict per lane |
| `release.deploy` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `container:operate`, `ci:read`, `secrets:resolve-by-name` | inline | Immutable image release under declared authorization, with probes and rollback |
| `content.generate` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `websearch:bounded`, `imagegen:required`, `objectstorage:read` | isolated | Researches the brief within bounds, then writes, codes, and draws to a claim; the schema pins this model |
| `git.publish` | sol-fresh | no | `fileread:context-aliases`, `git:merge-and-push`, `shell:declared-commands`, `ci:read` | inline | Non-force publication; destructive operations are unrepresentable |

## Profiles

### Runtime `openai` (provider `openai`)

| Profile | Model | Capabilities | Permits | Used for |
| --- | --- | --- | --- | --- |
| `sol-fresh` | `gpt-5.6-sol` | web, images, browser, source | web, images, browser, source | Decisions and direction, end to end |
| `astra` | `gpt-6-astra` | web, images, browser, source | browser | Audits and UAT; observes, never writes |

### Runtime `claude` (provider `anthropic`)

| Profile | Model | Capabilities | Permits | Used for |
| --- | --- | --- | --- | --- |
| `opus` | `claude-opus-5` | web, browser, source | browser, source | Heavy authoring and high-stakes mutation |
| `fable` | `claude-fable-5-1` | web, browser, source | source | Source-grounded extraction and audits |

`fable` is registered for the audit and extraction work that produced `patterns/`; no operator binds
it today.

## What may change here

A profile's model or grants, an operator's profile, and any policy answer are owner decisions.
Changing one is an edit in the profile file or the operator's `operator.json`, the matching line in
its `operator.md`, and a green `npm test`. Adding a grant kind means adding
it to every profile explicitly, because the validator refuses a profile that leaves a grant unstated.
