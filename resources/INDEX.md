# Resources

The operator's `resources` assignment selects one role; `agents/profiles/<runtime>.json` selects
the model and permitted tool modes. [Interaction](interaction.md) owns user communication and
[identity](identity.md) owns provider custody. An operator's tool grant remains narrower than model capability.

## Role and runtime binding

| Role | OpenAI profile / model | Claude profile / model |
| --- | --- | --- |
| Reasoning, planning and evidence review | `sol-reviewer` / `gpt-5.6-sol` | `fable` / `claude-fable-5-1` |
| Implementation, content and operational work | `sol-fresh` / `gpt-5.6-sol` | `opus` / `claude-opus-5` |

Sol serves both roles with separate contexts and grants. A reviewer writes its own evidence and
decisions, and hands repair to the owning operator. Fresh workers inherit only the declared inputs;
the reviewer does not inherit the producer's rationale. Each invocation records boundProfile and
ranProfile, resolved by `orchestrator.json#profileEquivalents`; a missing model is not silently replaced.
Retired `astra` and `fable-legacy` profiles only resolve historical receipts. Current packages cannot bind them.

Standing web, Grammar and image behavior is declared by each operator's tool modes and bound knowledge.
An image must serve the declared content or task; a blank area alone is not evidence that artwork is needed.
Grammar owners and reference interpretation are published under [the family knowledge](../knowledge/grammars).

## Process matrix

This table mirrors operator.json and is checked by validate-resources. The scheduler and isolation
law live in orchestrator.json; a mode does not create a second user session or a separate parallel allowance.

| Operator | Profile | Grammar | Tools | Mode | Why |
| --- | --- | --- | --- | --- | --- |
| `api.verify` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Reasoning and evidence review within the operator boundary |
| `architecture.decide` | sol-reviewer | no | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html` | isolated | Reasoning and evidence review within the operator boundary |
| `backend.generate` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands` | isolated | Execution within the assigned write and effect boundary |
| `backend.plan` | sol-reviewer | no | `fileread:context-aliases`, `git:read` | isolated | Reasoning and evidence review within the operator boundary |
| `business.decide` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded` | isolated | Reasoning and evidence review within the operator boundary |
| `business.reconcile` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read` | isolated | Reasoning and evidence review within the operator boundary |
| `content.generate` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `websearch:bounded`, `imagegen:required`, `objectstorage:read` | isolated | Execution within the assigned write and effect boundary |
| `data.plan` | sol-reviewer | no | `fileread:context-aliases`, `git:read` | isolated | Reasoning and evidence review within the operator boundary |
| `data.seed` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `secrets:resolve-by-name`, `http:probe`, `database:namespaced-write` | inline | Execution within the assigned write and effect boundary |
| `environment.preflight` | sol-reviewer | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `container:read` | inline | Reasoning and evidence review within the operator boundary |
| `git.publish` | sol-fresh | no | `fileread:context-aliases`, `git:merge-and-push`, `shell:declared-commands`, `ci:read` | inline | Execution within the assigned write and effect boundary |
| `identity.provision` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `sourcewrite:declared-write-set`, `browsercontrol:required` | inline | Execution within the assigned write and effect boundary |
| `interface.audit` | sol-reviewer | yes | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `host:loopback`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Reasoning and evidence review within the operator boundary |
| `interface.fix` | sol-fresh | yes | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `shell:declared-commands`, `git:commit-session-branch` | inline | Execution within the assigned write and effect boundary |
| `interface.generate` | sol-fresh | yes | `fileread:context-aliases`, `git:commit-session-branch`, `websearch:bounded`, `imagegen:judged`, `visualize:html`, `host:loopback`, `print:decision-points`, `registry:read`, `sourcewrite:declared-write-set`, `shell:declared-commands` | isolated | Execution within the assigned write and effect boundary |
| `interface.plan` | sol-reviewer | yes | `fileread:context-aliases`, `git:read` | isolated | Reasoning and evidence review within the operator boundary |
| `knowledge.repair` | sol-fresh | no | `fileread:context-aliases`, `git:read-write`, `sourcewrite:declared-paths` | isolated | Execution within the assigned write and effect boundary |
| `library.update` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands`, `registry:publish`, `secrets:resolve-by-name` | isolated | Execution within the assigned write and effect boundary |
| `migration.release` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Execution within the assigned write and effect boundary |
| `quality.verify` | sol-reviewer | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe` | inline | Reasoning and evidence review within the operator boundary |
| `release.deploy` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `container:operate`, `ci:read`, `secrets:resolve-by-name` | inline | Execution within the assigned write and effect boundary |
| `runtime.serve` | sol-fresh | no | `fileread:context-aliases`, `git:merge-into-integration-branch`, `shell:declared-commands`, `http:probe`, `container:operate`, `secrets:resolve-by-name` | inline | Execution within the assigned write and effect boundary |
| `service.operate` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `container:operate`, `http:probe`, `secrets:resolve-by-name` | inline | Execution within the assigned write and effect boundary |
| `uat.plan` | sol-reviewer | no | `fileread:context-aliases` | isolated | Reasoning and evidence review within the operator boundary |
| `uat.verify` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `secrets:resolve-by-name`, `database:namespaced-write`, `print:decision-points` | isolated | Reasoning and evidence review within the operator boundary |
| `workspace.bind` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Execution within the assigned write and effect boundary |

## Changes

Profile changes update this table, the package assignments and their corresponding mirrors together.
The resource gate rejects unknown/retired assignments, unsupported grants and drift from the declared mode.
