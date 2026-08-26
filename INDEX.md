# StarCi Skills

This repository is an executable skill system. Resolve the requested Source route first, then start with the selected skill; do not preload the full tree.

## Workspace and worktree vocabulary

These names are not interchangeable:

| Term | Meaning | Authority |
| --- | --- | --- |
| **Source** | The repository that owns this `.claude` runtime and the root bootstrap files. It is the routing host, not automatically the repository named by a request. | The host-provided Source root |
| **workspace** | The logical set of project-and-role routes known to one Source. A workspace is not a Git checkout and is not synonymous with the current working directory. | `<Source>/.workspaces/config.json` |
| **portable workspace route** | The committed, machine-independent declaration for exactly one `project + role`. It identifies the intended directory, origin, branch and optional Grammar. | `<Source>/.workspaces/projects/<project>/<role>.json` |
| **hydrated local route** | The machine-local resolution of one portable route to an absolute checkout root and observed Git state. It is derived state and never replaces portable authority. | `<Source>/.workspaces/local/routes/<project>/<role>/config.json` |
| **repository checkout** | The actual directory selected by the resolved route. Git and source actions run here only after route identity is verified. | The hydrated route plus observed Git origin and branch |
| **Git worktree** | An additional checkout created by `git worktree` that shares Git object storage with a repository but has its own working tree and checked-out branch. It is not a workspace, portable route or local route unless a portable route explicitly selects it. | `git worktree list --porcelain` for the resolved repository |

## Single runtime invariant

One declared workspace has exactly one Source that owns `.claude`, `AGENTS.md` and `CLAUDE.md`. A
repository checkout or Git worktree reached through a workspace route follows that Source runtime; it
does not become another Source merely because product work runs there.

The absence of `<checkout>/.claude/INDEX.md` is therefore expected and is never evidence that the
runtime, bootstrap or route is missing. Do not clone, copy or rediscover `.claude` inside a routed
checkout. Resolve `<Source>` from the host-provided Source identity, then use its portable and hydrated
routes to select the checkout. Never infer `<Source>` from the current working directory or by walking
upward from the target checkout.

The invariant is `project + role -> portable route -> hydrated local route -> verified checkout`. Similar directory names, a nearby clone, the Source root and the current working directory are never routing evidence. For example, a request for a project's `fe` role must resolve that project's `fe.json`; a sibling repository with the project name is not a substitute.

## Runtime route

```text
request
  -> resolve project + role route when the request names source
  -> analyze-input.md
  -> skills/catalog.json metadata
  -> skills/<starci-skill>/SKILL.md
  -> validate-input.mjs
  -> analyze-input.md
  -> machine.json
  -> operators/<domain>/<operation>/
  -> validate-output.mjs
  -> choice | wait | loop | terminal
```

## Load order

1. Read root `analyze-input.md`; inspect only the active request, the exact workspace route needed by that request and `skills/catalog.json` metadata.
2. When the request names a project and role for any Git or source action, resolve and verify that exact route before selecting a skill or continuing without one.
3. Emit and validate exactly one ephemeral skill selection. For multi-capability work, select only the earliest missing capability. If selection is ambiguous, clarify before loading any skill.
4. Read only the selected `skills/<id>/SKILL.md`.
5. Validate the closed input envelope and global selection with that skill's `validate-input.mjs`.
6. Follow the selected skill's local `analyze-input.md` to validate and normalize scope, then enter its single fixed first state.
7. Execute only the operator named by the current state in `machine.json`.
8. For that operator, read `execute.md`; retrieve only its declared `knowledgeRefs` from Qdrant.
9. Validate every operator result before routing on `decision`, `stage`, or `status`.
10. Stop at waits and terminal states. Follow declared loops; do not invent implicit transitions.
11. At a handoff terminal, resolve only the validated `handoffRef`. Sequential handoffs advance the objective; side branches must declare a resume capability. Acknowledge consumed artifacts before terminal cleanup.

## Authority

| Path | Owns |
| --- | --- |
| `analyze-input.md` | Global natural-language intent analysis and one-skill selection |
| `<Source>/.workspaces/projects/` | Portable project-and-role route authority |
| `<Source>/.workspaces/local/routes/` | Derived machine-local route state; never portable authority |
| `skills/catalog.json` | Cheap pre-load skill metadata generated from the skill source |
| `skills/` | User-facing capability contracts and state-machine composition |
| `operators/` | Atomic, single-responsibility execution contracts |
| `orchestration/` | Provider-neutral execution modes and provider model mappings |
| `knowledge/` | Durable operator knowledge retrieved lazily through Qdrant |
| `runtime/knowledge-runtime/` | Local knowledge indexing and retrieval |
| `scripts/` | Repository-level validation and query entry points |
| `readiness/initialization/workspaces/commit-policy.json` | Canonical multi-device Git boundary for portable workspace intent, local hydration, worktrees, references and master identity |

Inputs and outputs are closed JSON Schema Draft 2020-12 contracts. Knowledge is advisory until an operator binds it to an evidenced decision. A skill may mutate source or external state only when its current operator and approval boundary explicitly allow that action.

Operator inputs, outputs, loaded bindings, worker observations, patch plans, and receipts are ephemeral task-session objects. They are never written to a run directory and are purged when the parent skill reaches any terminal state. Only explicitly approved product-source or external mutations survive.

## Repository checks

From the Source root, run `npm --prefix .claude run check:source-readiness` before product work. It reports `runtime`, `bootstrap`, `workspaces` and `worktrees` independently and returns ready only when every module is current. Use `npm --prefix .claude run upgrade:source-readiness` for a read-only upgrade plan; an actual mutation requires `node .claude/scripts/source-readiness.mjs upgrade --source-root . --apply`.

Run `npm test` before release. It validates operators, skills, source readiness, routes, release structure, and the Qdrant knowledge runtime.

## Multi-device reconstruction

Git carries portable intent and encrypted authority only. After a pull, each trusted device proves its out-of-band master identity, then rebuilds routes, worktrees, reference checkouts, decrypted twins and indexing/runtime state locally. The complete commit/no-commit classification lives only in `readiness/initialization/workspaces/commit-policy.json`; run `node .claude/scripts/workspace-commit-policy.mjs check --source-root .` to enforce it. Never copy that classification into bootstrap files.

When the user explicitly pauses an active coding mission to continue on another device, route to `starci-workflow-handoff`. It pushes only mission-owned Git heads and an annotated continuation tag containing the next capability and durable artifact refs; it never persists prompts, reasoning, generated context or session scratch. Resume verifies the exact tag, routes and heads before continuing.

When the user explicitly needs local Docker service state transferred too, route instead to `starci-device-checkpoint`. That heavier mission first requires every mission-owned checkout to be clean, proven and remote-current, then quiesces the Source-declared Docker volumes, streams encrypted archives, publishes checksum-bound chunks as private release assets, and proves the manifest. Restore never overwrites a non-empty volume without explicit replace approval.
