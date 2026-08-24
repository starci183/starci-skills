# StarCi Skills

Release-grade agent skills composed as validated state machines.

StarCi Skills turns one user request into a small, explicit execution graph. A skill analyzes the closed input, loads only the operators needed by the selected branch, retrieves operator knowledge lazily from local Qdrant Edge, validates every boundary, and follows declared choices, approvals, loops, or terminal states.

```text
request -> skill analysis -> operator -> validated result
                      ^          |
                      |-- loop --|
                           |
                  choice / wait / terminal
```

## Why this shape

- **Small context:** skills compose; operators do one thing; knowledge loads only when referenced.
- **Deterministic routing:** `machine.json` declares every branch and loop.
- **Typed boundaries:** every skill and operator has closed input/output schemas and fail-closed validators.
- **Traceable decisions:** transitions use contract-owned decisions or stage/status emissions.
- **Safe extension:** add an operator or machine branch without copying a second policy tree.

## Included skills

| Skill | Capability |
| --- | --- |
| `starci-workspace-ready` | Initialize, hydrate, or verify workspace identity and routes |
| `starci-business-authority` | Refresh, publish, or reconcile business truth |
| `starci-architecture-decide` | Analyze difficult cross-system choices without source writes |
| `starci-backend-delivery` | Plan, approve, implement, test, repair, and reconcile backend work |
| `starci-frontend-design-delivery` | Deliver journeys, pages, layouts, blocks, maintenance, and design learning |
| `starci-quality-readiness` | Diagnose, inventory, repair, and measure delivery quality |
| `starci-deployment` | Adopt, deploy, monitor, recover, or roll back a release |
| `starci-platform-services` | Reconcile tunnel, MCP/Qdrant, Sonar, and observability services |
| `starci-conversation-provenance` | Record or query redacted conversation provenance |

The release currently contains 80 atomic operators across 10 domains and 33 operator-knowledge records.

## Install

Requirements:

- Node.js 20 or newer
- Python 3.11 or newer

Clone this repository as the target project's `.claude` directory:

```bash
git clone https://github.com/starci183/starci-skills.git .claude
cd .claude
npm ci
python -m pip install -r runtime/knowledge-runtime/requirements.txt
```

Point the host repository's `AGENTS.md` or equivalent bootstrap at `.claude/INDEX.md`. Codex discovers repo-local skills from `.claude/skills`; each `SKILL.md` contains concise selection instructions while its supporting files remain local to that skill.

## Use

Invoke the narrowest matching skill, for example:

```text
Use $starci-frontend-design-delivery to design and implement this customer journey.
```

At runtime:

1. The host reads only the selected `SKILL.md`.
2. `validate-input.mjs` rejects malformed or extra input.
3. `analyze-input.md` selects one declared mode.
4. `machine.json` routes to an atomic operator.
5. The operator retrieves only its `knowledgeRefs`, executes, and validates its output.
6. The machine advances, waits for approval, loops, or terminates.

See [INDEX.md](INDEX.md) for the binding load order.

## Repository layout

```text
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

Build and query the embedded index without a network service:

```bash
python scripts/knowledge-query.py build
python scripts/knowledge-query.py status
python scripts/knowledge-query.py query --text "nested surface complex case" --top-k 3
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
