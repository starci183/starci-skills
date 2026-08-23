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
| Archetype | one reusable dominant-task, region-graph and responsive page topology | product components, visual classes or business facts |
| Generate/brainstorm | one complete baseline by default; 3–4 targeted alternatives only on explicit request | implementation |
| Compiler | one deterministic answer from an accepted shape | alternatives |
| Gate | pass or a refusal with exact evidence | advice |

The result is not merely a suggested design or plan. Selected decisions remain traceable inside the current
session to the source state they were made against; the same invocation implements them, and execution stops
when that evidence is stale or incomplete.

## The twenty skills

### Environment and trust

| Skill | Use it for | Writes |
|---|---|---|
| [`starci-init`](./skills/starci-init) | Establish SOPS+age identity; compile, hydrate or publish portable workspace declarations; prepare bootstrap, durable worktrees and disposable sessions | bounded readiness state and approved portable workspace commit |
| [`starci-cloudflare-tunnel-set`](./skills/starci-cloudflare-tunnel-set) | Reuse or capture the encrypted Source-wide multi-project Cloudflare credential and reconcile one declared HTTP(S) tunnel/DNS route | encrypted control-plane custody plus Cloudflare state |
| [`starci-deploy`](./skills/starci-deploy) | Adopt, set up, deploy, monitor, recover or roll back a routed product from its declared `.stacks` contract | approved product/provider state plus ignored `.infra` execution evidence |
| [`starci-setup-mcp`](./skills/starci-setup-mcp) | Build one routed, read-only source-context MCP and publish `mcp.<zone>` for users | generated local state, shared MCP runtime and Cloudflare state |
| [`starci-setup-sonar`](./skills/starci-setup-sonar) | Build one shared Docker SonarQube under Compose project `starci`, onboard projects and publish `sonar.<zone>` | shared `starci` runtime and Cloudflare state |
| [`starci-stale-list`](./skills/starci-stale-list) | Measure every workspace staleness category, including local gates and frontend or backend assurance, and name its owner | ignored local check output only; no tracked or external mutation |
| [`starci-diagnose`](./skills/starci-diagnose) | Trace another skill against the real machine and identify its first correct stop | nothing |
| [`starci-repair`](./skills/starci-repair) | Return a red or incompletely assured checkout to clean gates and a complete frontend or backend delivery fence | approved repository and external enforcement paths |

### Frontend design and maintenance

| Skill | Use it for | Approval boundary |
|---|---|---|
| [`starci-fe-design-layout`](./skills/starci-fe-design-layout) | Generate one complete long page/full flow with every block and state; brainstorm alternatives only on request; orchestrate frozen HTML, approved code, seed and proof through bounded workers | `OK #1` freezes direction/page anatomy; `OK #2` authorizes exact source and seed paths |
| [`starci-fe-design-block`](./skills/starci-fe-design-block) | Audit/correct a Layout-generated block in its full page; brainstorm anatomies only on request; orchestrate complete-parent HTML, approved code and proof | `OK #1` freezes block direction; `OK #2` authorizes exact FE/test paths |
| [`starci-fe-design-refactor`](./skills/starci-fe-design-refactor) | Apply any UI/user-flow feedback to source first, prove it, then persist the design-learning request | proportional source boundary; request remains open for authority learning |
| [`starci-fe-design-resolve`](./skills/starci-fe-design-resolve) | Audit queued source attempts, record rejects before replacement, then update grammar/principles and close with proof | `OK` binds the request, authority and proof boundary |
| [`starci-fe-ui-reconcile`](./skills/starci-fe-ui-reconcile) | Challenge consistency across a closed set of existing UI surfaces, distinguish local drift from systemic grammar/principle gaps, then align the approved impact cone | exact `OK` authorizes the displayed authority, FE consumer and proof boundary |
| [`starci-grammar-refresh-references`](./skills/starci-grammar-refresh-references) | Refresh stale optional immutable grammar provenance without changing durable authority | routed grammar reference sidecar only |

Frontend design keeps review evidence temporary and makes source the durable result:

```text
legacy/current baseline + business + archetype + grammar + StarCi MASTER + contract + current source
                    ↓
       one complete static HTML page/full flow
                    ↓ one OK selects baseline + exact source boundary
          implement source in the same invocation
                    ↓
             gates + browser proof
```

After the owner accepts the baseline enough to request exploration, a targeted brainstorm may generate 3–4
alternatives for one region/axis. “80%” is an owner signal, not a numeric gate. Review output is static HTML;
there is no separate React/Vite viewer build.

MASTER fixes pattern, density, token roles, spacing rhythm, shape, depth, motion and anti-patterns once. Profiles
override declared roles only; pages record deviations only. Candidate digests are cache keys, and principles
resolve only visual deltas left unanswered by archetype, baseline, MASTER, grammar and source. Current source
proves product facts and capability, not that its macro layout is correct; archetype conflicts are reported as
`layout-drift` and corrected unless binding business truth or an owner-approved exception requires them.

### Cross-system analysis

| Skill | Use it for | Writes |
|---|---|---|
| [`starci-architecture-analyze`](./skills/starci-architecture-analyze) | Analyze a difficult cross-system decision for human readers, compare viable solutions and hand frozen context to planning | no product code or authority |

### Backend change

| Skill | Use it for | Writes |
|---|---|---|
| [`starci-be-plan`](./skills/starci-be-plan) | Name the exact files, schema evidence, sibling shape, boundaries, and tests before code exists | no product code |
| [`starci-be-approve`](./skills/starci-be-approve) | Challenge one exact backend revision until the owner approves it, then implement and prove only that revision | approved backend paths |

### Agent orchestration

All twenty physical skills resolve one machine-validated entry in `orchestration/profiles.json`. The selected
skill keeps its own `PIPELINE`, approvals and proof law; orchestration only partitions accepted work into bounded
Claude or Codex tasks. Read-only and authority/provider work may remain coordinator-sequential, while independent
evidence, approved disjoint repository changes, tests and proof can run through workers. The machine rejects a
missing skill map, stale step order, overlapping writer target or mutation without the selected skill's exact
approval. Every skill defaults to `manual` and supports exact `mode=auto`, bound to one immutable invocation and
unable to widen scope or manufacture permission for credentials, destructive loss or external publication.

## What the machine refuses

- a stale or unresolved workspace route;
- a visual direction that invents a reused token or hides a fake duplicate behind different labels;
- a durable `directionHash` or design head;
- layout candidates that embed different recommended directions;
- a block review that is not embedded in its exact current source parent;
- a design invocation that ends after approval without implementing and proving source;
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
configuration and index manifests stay under `.workspaces/local/state/source-context/mcp/`.
