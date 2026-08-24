# StarCi Skills

This repository is an executable skill system. Start with the selected skill; do not preload the full tree.

## Runtime route

```text
request
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

1. Read root `analyze-input.md`; inspect only the active request and `skills/catalog.json` metadata.
2. Emit and validate exactly one ephemeral skill selection. If selection is ambiguous, clarify before loading any skill.
3. Read only the selected `skills/<id>/SKILL.md`.
4. Validate the closed input envelope and global selection with that skill's `validate-input.mjs`.
5. Follow the selected skill's local `analyze-input.md` to validate and normalize scope, then enter its single fixed first state.
6. Execute only the operator named by the current state in `machine.json`.
7. For that operator, read `execute.md`; retrieve only its declared `knowledgeRefs` from Qdrant.
8. Validate every operator result before routing on `decision`, `stage`, or `status`.
9. Stop at waits and terminal states. Follow declared loops; do not invent implicit transitions.

## Authority

| Path | Owns |
| --- | --- |
| `analyze-input.md` | Global natural-language intent analysis and one-skill selection |
| `skills/catalog.json` | Cheap pre-load skill metadata generated from the skill source |
| `skills/` | User-facing capability contracts and state-machine composition |
| `operators/` | Atomic, single-responsibility execution contracts |
| `orchestration/` | Provider-neutral execution modes and provider model mappings |
| `knowledge/` | Durable operator knowledge retrieved lazily through Qdrant |
| `runtime/knowledge-runtime/` | Local knowledge indexing and retrieval |
| `scripts/` | Repository-level validation and query entry points |

Inputs and outputs are closed JSON Schema Draft 2020-12 contracts. Knowledge is advisory until an operator binds it to an evidenced decision. A skill may mutate source or external state only when its current operator and approval boundary explicitly allow that action.

Operator inputs, outputs, loaded bindings, worker observations, patch plans, and receipts are ephemeral task-session objects. They are never written to a run directory and are purged when the parent skill reaches any terminal state. Only explicitly approved product-source or external mutations survive.

## Repository checks

Run `npm test` before release. It validates operators, skills, routes, release structure, and the Qdrant knowledge runtime.
