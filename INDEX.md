# StarCi Skills

This repository is an executable skill system. Start with the selected skill; do not preload the full tree.

## Runtime route

```text
request
  -> skills/<starci-skill>/SKILL.md
  -> validate-input.mjs
  -> analyze-input.md
  -> machine.json
  -> operators/<domain>/<operation>/
  -> validate-output.mjs
  -> choice | wait | loop | terminal
```

## Load order

1. Read only the selected `skills/<id>/SKILL.md`.
2. Validate the closed input envelope with that skill's `validate-input.mjs`.
3. Follow `analyze-input.md` to select the initial machine branch.
4. Execute only the operator named by the current state in `machine.json`.
5. For that operator, read `execute.md`; retrieve only its declared `knowledgeRefs` from Qdrant.
6. Validate every operator result before routing on `decision`, `stage`, or `status`.
7. Stop at waits and terminal states. Follow declared loops; do not invent implicit transitions.

## Authority

| Path | Owns |
| --- | --- |
| `skills/` | User-facing capability selection and state-machine composition |
| `operators/` | Atomic, single-responsibility execution contracts |
| `orchestration/` | Provider-neutral execution modes and provider model mappings |
| `knowledge/` | Durable operator knowledge retrieved lazily through Qdrant |
| `runtime/knowledge-runtime/` | Local knowledge indexing and retrieval |
| `scripts/` | Repository-level validation and query entry points |

Inputs and outputs are closed JSON Schema Draft 2020-12 contracts. Knowledge is advisory until an operator binds it to an evidenced decision. A skill may mutate source or external state only when its current operator and approval boundary explicitly allow that action.

Operator inputs, outputs, loaded bindings, worker observations, patch plans, and receipts are ephemeral task-session objects. They are never written to a run directory and are purged when the parent skill reaches any terminal state. Only explicitly approved product-source or external mutations survive.

## Repository checks

Run `npm test` before release. It validates operators, skills, routes, release structure, and the Qdrant knowledge runtime.
