# Execute

## Full frontend route

```text
request
  -> preflight
  -> customer-journey -> [FLOW APPROVAL]
  -> page-model
  -> state
  -> layout          -> [LAYOUT APPROVAL]
  -> grammar-convergence
  -> source-fit
  -> principle-compile
  -> request-emission? -- grammar gap --> BLOCKED
  -> implementation
  -> product-seed
  -> test/unit
  -> test/e2e
  -> test/ui        -- real browser + test account
  -> product-proof -- in-boundary repair --> implementation
                   -- boundary drift ----> layout approval
                   -- pass --------------> COMPLETE
```

`customer-journey` owns the end-to-end task path. `page-model` divides it into pages and one shared journey-progress block where needed. `state` combines block responsibility with business evidence. `layout` turns each page model into purposeful blocks and composes those blocks by information weight, hierarchy, persistence, and responsive behavior.

## Routing protocol

1. Validate the current envelope.
2. Evaluate every route guard in `graph.json` without loading operation instructions.
3. Stop on zero matches or more than one match.
4. If the target is an operation, open only its `operation.json` and verify that the route guard appears in `accepts`.
5. Bind its `input.schema.json`, then run the selected operation's `validate-input.mjs`. On failure, stop before instructions or side effects are loaded.
6. For each `knowledgeRefs` ID, retrieve a compact record with `python .claude/scripts/design-knowledge-query.py query --kind operation-knowledge --text "<knowledge-id> <current structural facts>"`. Require an exact returned `data.knowledgeId`; never load the whole knowledge shelf.
7. Read that operation's `input.md`, `execute.md`, and `output.md`; execute it once using only the retrieved records.
8. Bind `output.schema.json`, then run its `validate-output.mjs`. On failure, discard the result and stop at that operation.
9. Only a validated output may replace the envelope and route again.
10. A wait target returns control for an explicit approval. A terminal target ends the run.

Do not preload all operations. Do not skip either approval. Do not turn implementation feedback into a new creative checkpoint: classify it as an in-boundary repair or return it to the existing layout checkpoint.

## Ownership boundaries

- Business evidence owns domain facts and domain states.
- Product Blocks own business meaning and map it to neutral presentation states.
- Grammar owns generic visual structure and neutral treatment only; it contains no business element.
- `@starci/ui/common` plus exactly one routed `@starci/grammar/<id>` owns reusable lower tiers.
- App code normally owns Blocks, layouts, pages, product data, and state. Lower-tier local code requires a declared extension axis; a missing reusable owner is a grammar gap.
- `global.css` may change color-token values only.
