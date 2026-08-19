---
title: StarCi Skills
---

# StarCi Skills

Turn a loose product request into reviewed decisions, bounded source changes, and machine-checkable proof.

> **Agent runtime loads compact context records.** A skill starts from its binding `SKILL.md`. Whenever
> that skill reaches a paired module, it loads `context.md`. The complete `en.md` and `vi.md` records
> are published for human review and never supply runtime instructions.

## What this tree does

StarCi separates work by what each stage may return:

| Stage | Returns | Does not return |
|---|---|---|
| Context | verified read and write locations | product decisions |
| Brainstorm | 3–4 evidence-backed candidates | implementation |
| Compiler | one deterministic answer from an accepted shape | alternatives |
| Gate | pass or a refusal with exact evidence | advice |

The result is not merely a suggested design or plan. Accepted decisions remain traceable to the source
state they were made against, and execution stops when that evidence is stale or incomplete.

## The fourteen skills

### Environment and trust

| Skill | Use it for | Writes |
|---|---|---|
| [`starci-init`](./skills/starci-init) | Establish the SOPS+age identity, then prepare Source bootstrap, workspace routes, or worktree state | bounded Source-local readiness state |
| [`starci-cloudflare-tunnel-set`](./skills/starci-cloudflare-tunnel-set) | Reuse or capture the encrypted Source-wide multi-project Cloudflare credential and reconcile one declared HTTP(S) tunnel/DNS route | encrypted control-plane custody plus Cloudflare state |
| [`starci-deploy`](./skills/starci-deploy) | Adopt, set up, deploy, monitor, recover or roll back a routed product from its declared `.stacks` contract | approved product/provider state plus ignored `.infra` execution evidence |
| [`starci-setup-mcp`](./skills/starci-setup-mcp) | Build one routed, read-only source-context MCP and publish `mcp.<zone>` for users | generated cache, shared MCP runtime and Cloudflare state |
| [`starci-setup-sonar`](./skills/starci-setup-sonar) | Build one shared Docker SonarQube under Compose project `starci`, onboard projects and publish `sonar.<zone>` | shared `starci` runtime and Cloudflare state |
| [`starci-stale-list`](./skills/starci-stale-list) | Measure every workspace staleness category, including local gates and frontend or backend assurance, and name its owner | ignored local check output only; no tracked or external mutation |
| [`starci-diagnose`](./skills/starci-diagnose) | Trace another skill against the real machine and identify its first correct stop | nothing |
| [`starci-repair`](./skills/starci-repair) | Return a red or incompletely assured checkout to clean gates and a complete frontend or backend delivery fence | approved repository and external enforcement paths |

### Frontend design and maintenance

| Skill | Use it for | Approval boundary |
|---|---|---|
| [`starci-fe-design-layout`](./skills/starci-fe-design-layout) | Recommend one of 3–4 visual directions, then generate structural layouts without pausing | one `layoutHash` approval binds the recommended direction and skeleton |
| [`starci-fe-design-block`](./skills/starci-fe-design-block) | Design or revise one region's anatomy, states, repetition, and data ownership | an independent `blockHash`, linked to its accepted `layoutHash` |
| [`starci-fe-design-execute`](./skills/starci-fe-design-execute) | Implement the accepted design in real frontend source | starts only when every currently reachable hash is accepted |
| [`starci-fe-minor-fix`](./skills/starci-fe-minor-fix) | Correct one existing block, composite, or leaf without changing its contract, ownership, or public shape | one clean component folder, at most two production files, two tests, and 40 production changed lines |

Frontend design keeps the page skeleton and block detail separate:

```text
3–4 directions → evidence-backed recommendation → 3–4 layouts
                                                    ↓ one OK accepts layoutHash + embedded direction
                               design each region → accept blockHash
                                                    ↓
                               verify current graph → execute source
```

A direction has no separate approval hash or approval checkpoint. The evidence-backed recommended object
is embedded unchanged in each layout candidate; one `OK` accepts the layout hash and both decisions it
binds. A block remains independently hashable so one block can be redesigned without reopening
the page layout; the block head records which accepted layout makes that block reachable.

### Backend change

| Skill | Use it for | Writes |
|---|---|---|
| [`starci-be-plan`](./skills/starci-be-plan) | Name the exact files, schema evidence, sibling shape, boundaries, and tests before code exists | no product code |
| [`starci-be-approve`](./skills/starci-be-approve) | Challenge one exact backend revision until the owner approves it, then implement and prove only that revision | approved backend paths |

## What the machine refuses

- a stale or unresolved workspace route;
- a visual direction that invents a reused token or hides a fake duplicate behind different labels;
- a separate `directionHash`;
- layout candidates that embed different recommended directions;
- a block decision without its parent `layoutHash` dependency;
- execution while a currently reachable layout or block is unaccepted;
- classes outside the closed contract vocabulary;
- a finding made green by disabling or weakening the gate.

## Runtime reading rule

The compact context record is authoritative for agents:

1. Load the selected skill's `SKILL.md` completely.
2. Follow its `LOADS` table and numbered steps.
3. For every reached paired module, load `context.md` only.
4. Do not combine `en.md` or `vi.md` with runtime instructions.
5. Treat `en.md` and `vi.md` as complete published records for human readers.

Browse the detailed modules from the sidebar when you need the underlying laws, schemas, compilers, or
gates. The landing page stays brief; the binding details remain in their owning records.

## Operator runbooks

[`Runbooks`](./runbooks) are the executable operations shelf for the platform around those skills. They
cover the complete local stack and the external providers StarCi already references: secrets/SOPS,
PostgreSQL, Redis, Elasticsearch, Qdrant, Kafka, MinIO, NATS, Keycloak, Google/GitHub OAuth, cAdvisor,
Prometheus, Grafana Cloud, Codecov, SonarQube Cloud, payments, mail, AI pools, S3 and GCP. Each page names
the real repository command, encrypted owner, verification signal, safe stop, rotation boundary and
provider documentation; no credential value is published.

## Readiness registries

[`Initialization`](./readiness/initialization) owns identity, bootstrap, workspace and worktree setup.
[`Staleness`](./readiness/staleness) is the single category source shared by `starci-stale-list` and
`starci-repair`. Each module owns both its read-only evidence and approved inventory/apply/proof contract,
so the two skills cannot drift into separate definitions of `why`, assurance, formatter, lint-machine,
retired-structure or remnant staleness.

## MCP context

[`MCP context`](./mcp) turns verified workspace routes into optional semantic source context. Each role is
indexed below `/<role>/<project>/` in one Source-wide Qdrant collection and exposed by the official Qdrant
MCP core in read-only mode. Tracked records contain no machine path or credential; generated client
configuration and index manifests stay under `.worktrees/source-context/cache/mcp/`.
