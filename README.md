# StarCi Skills

Release-grade agent skills composed as validated state machines.

StarCi Skills turns one natural-language request into a small, explicit execution graph. Global input analysis selects the earliest missing specialized capability from cheap metadata; typed handoffs advance or temporarily branch the objective without loading a lifecycle-sized skill. Each capability loads only the operators required by its current state, validates every boundary, and emits evidence before the next capability may run.

```text
request -> global analysis -> selected skill -> operator -> validated result
                                      ^           |
                                      |--- loop ---|
                                             |
                                  choice / wait / terminal
```

## Why this shape

- **Small context:** skills compose; operators do one thing; knowledge loads only when referenced.
- **Deterministic routing:** `machine.json` declares every branch and loop.
- **Typed boundaries:** every skill and operator has closed input/output schemas and fail-closed validators.
- **Traceable decisions:** transitions use contract-owned decisions or stage/status emissions.
- **Safe extension:** add an operator or machine branch without copying a second policy tree.
- **Composable depth:** each skill does one capability deeply; typed sequential and side-branch handoffs compose the complete outcome.

## Included skills

| Skill | Capability |
| --- | --- |
| `starci-workspace-ready` | Initialize, hydrate, or verify workspace identity and routes |
| `starci-device-checkpoint` | Checkpoint proven source and encrypted local service state for another trusted device |
| `starci-workflow-handoff` | Pause one coding mission in Git and resume its exact continuation on another device |
| `starci-tech-stack` | Define observed and target runtime, microservice, persistence, and operations topology |
| `starci-business-authority` | Model, approve, and publish one business feature head |
| `starci-business-reconcile` | Reconcile immutable delivery proof with business truth |
| `starci-frontend-ui-direction` | Deeply brainstorm and visualize materially different UI directions |
| `starci-frontend-design-critique` | Challenge a frontend proposal using fresh evidence |
| `starci-frontend-ux-flow` | Define complete interaction, navigation, recovery, and completion flows |
| `starci-product-potential` | Discover business and UX opportunities exposed by the proposed flow |
| `starci-frontend-ui-detail` | Convert an approved direction and flow into implementation-level screen detail |
| `starci-frontend-contract-plan` | Freeze component, Grammar, state, and responsive contracts |
| `starci-frontend-implementation` | Implement only an approved frontend contract |
| `starci-frontend-visual-fidelity` | Compare rendered source with approved visuals and route drift |
| `starci-product-uat` | Prove the complete user journey and business outcome |
| `starci-architecture-discover` | Build an evidence-backed current-system model |
| `starci-data-ownership-model` | Bind data ownership, write authority, consistency, and migration boundaries |
| `starci-architecture-option-design` | Produce materially different architecture options |
| `starci-architecture-critique` | Falsify an architecture recommendation independently |
| `starci-architecture-realization` | Bind approved architecture to code and deployment topology |
| `starci-backend-solution-design` | Design backend behavior before contracts or code |
| `starci-backend-contract-plan` | Specify exact API, event, transaction, and persistence contracts |
| `starci-backend-contract-critique` | Challenge a backend contract before mutation |
| `starci-backend-implementation` | Implement one frozen backend boundary with conformance checks |
| `starci-backend-proof` | Prove backend semantics, quality, and architectural conformance |
| `starci-frontend-block-reconcile` | Reconcile one block and its consumers across every affected role, then join proof |
| `starci-frontend-maintenance-apply` | Apply one approved product correction across affected roles, join proof, then record learning |
| `starci-frontend-learning-resolve` | Resolve one queued learning into durable authority; consumer application remains a reconcile delivery |
| `starci-frontend-surface-reconcile` | Align a closed surface set and every affected contract on durable authority, then join proof |
| `starci-workflow-diagnose` | Diagnose one workflow without mutation |
| `starci-quality-readiness` | Inventory and close measured readiness findings |
| `starci-quality-finding-repair` | Repair one approved quality finding |
| `starci-quality-debt-repay` | Repay one declared quality-debt item |
| `starci-rule-binding-audit` | Audit executable rule ownership and binding |
| `starci-coding-preflight` | Bind implementation references and defer bounded static gates until commit |
| `starci-static-quality-gates` | Run lint, typecheck, and Sonar for one exact revision |
| `starci-deployment` | Adopt and deploy one immutable release |
| `starci-deployment-monitor` | Monitor one existing rollout to proof |
| `starci-deployment-recover` | Recover one observed failed rollout |
| `starci-deployment-rollback` | Roll back one declared release identity |
| `starci-tunnel-reconcile` | Reconcile one tunnel and DNS route |
| `starci-source-index-publish` | Index and optionally publish generated context |
| `starci-sonar-service-reconcile` | Reconcile shared Sonar enforcement |
| `starci-observability-reconcile` | Reconcile shared metrics and remote write |
| `starci-conversation-record` | Append one redacted provenance snapshot |
| `starci-conversation-query` | Query one bounded provenance identity |

The v6.2 release contains 48 small state-machine skills and 125 atomic operators. Requests are normalized against an explicit multilingual scope record, substantial UI directions require rendered evidence, and source mutation is preceded by coding preflight with commit-triggered static gates.

Approval waits remain the default. Explicit `bypass` mode binds the displayed revision to an ephemeral authorization receipt and continues only through the declared bypass target; it never masquerades as human approval.

## Install

Requirements:

- Node.js 20 or newer
- Python 3.11 or newer

Clone this repository as the chosen Source host's `.claude` directory:

```bash
git clone https://github.com/starci183/starci-skills.git .claude
cd .claude
npm ci
python -m pip install -r runtime/knowledge-runtime/requirements.txt
```

Point that Source repository's `AGENTS.md` or equivalent bootstrap at `.claude/INDEX.md`. One logical workspace has one Source-owned runtime; repositories and Git worktrees reached through its workspace routes follow this runtime and do not install their own `.claude`. Codex discovers Source-local skills from `.claude/skills`; each `SKILL.md` contains concise selection instructions while its supporting files remain local to that skill.

## Use

Describe the work normally; global analysis selects the narrowest matching skill. For example:

```text
Design and implement the complete VPS creation journey from plan selection through provisioning success.
```

At runtime:

1. The host reads global `analyze-input.md` and only the metadata in `skills/catalog.json`.
2. Global analysis emits one ephemeral skill selection or asks one focused clarification.
3. The host reads only the selected `SKILL.md`; `validate-input.mjs` rejects malformed or mismatched input.
4. The skill's local `analyze-input.md` validates and normalizes scope, then enters its fixed first state.
5. `machine.json` routes to an atomic operator.
6. The operator retrieves only its `knowledgeRefs`, executes, and validates its output.
7. The machine advances, waits for approval, loops, hands off, or terminates.

See [INDEX.md](INDEX.md) for the binding load order.

## Repository layout

```text
analyze-input.md              global intent-to-skill selection
skills/catalog.json           generated pre-load skill metadata
skills/                       user-facing state-machine skills
operators/<domain>/<name>/    atomic execution contracts
orchestration/                execution modes and provider mappings
knowledge/                    Qdrant-indexed operator knowledge
runtime/knowledge-runtime/    embedded index and retrieval runtime
scripts/                      query and release validation commands
```

Every operator contains exactly:

```text
execute.md
input.md
input.schema.json
operator.json
output.md
output.schema.json
validate-input.mjs
validate-output.mjs
```

Every skill adds `SKILL.md`, `analyze-input.md`, `machine.json`, and `agents/openai.yaml` around the same validated input/output boundary.

## Knowledge retrieval

Frontend delivery uses two canonical, project-scoped sources before source files are opened:

- approved business truth at `.worktrees/<project>/businesses/`;
- deterministic component contracts at `.worktrees/<project>/coding-context/frontend/`.

The frontend exporter hashes the source revision, exporter, schema, and configuration. An unchanged generation is reused; a changed generation is atomically published and indexed. Qdrant is a candidate cache only: every selected result is rebound to its canonical JSON record before use. Grammar retrieval loads `common` plus exactly one selected grammar (`core` or `offset-pop`) and never carries business semantics.

Generate or reuse the frontend coding context:

```bash
node scripts/build-frontend-coding-context.mjs \
  --project <project> \
  --source <frontend-source> \
  --output-root <host-repository>
```

Build and query the embedded index without a network service:

```bash
python scripts/knowledge-query.py build
python scripts/knowledge-query.py status
python scripts/knowledge-query.py query \
  --kind frontend-coding-context \
  --project <project> \
  --text "SurfaceCard external label nested list state" \
  --top-k 3
```

The persisted index is local runtime state under `.workspaces/local/knowledge/` and is not committed.

## Validate

```bash
npm test
```

The release gate validates all operator contracts, all skill machines and routes, repository shape, generated metadata, and the Python Qdrant runtime. To regenerate deterministic contracts before testing:

```bash
npm run materialize
npm test
```

## Versioning and support

This project uses Semantic Versioning. Machine/schema compatibility is tied to the major release. See [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md).

## License

MIT © 2026 StarCi. See [LICENSE](LICENSE).
