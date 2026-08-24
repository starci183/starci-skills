---
name: fe-design-layout-v6
description: Turn a frontend product request into approved user flows, page and state models, approved layouts, grammar-converged implementation, seeded business states, and browser proof. Use for full frontend design-layout execution where customer journey and multi-page coherence matter.
---

# FE Design Layout V6

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@graph` | `graph.json` | file | deterministically select one operation, wait, or terminal route |
| `@route-app` | `scripts/route-app.mjs` | script | route before loading an operation and refuse zero or ambiguous matches |
| `@validate-app` | `scripts/validate-app.mjs` | script | prove operation shape, guards, imports and two approval checkpoints |

Run the frontend app as a graph of typed operations.

1. Read `input.md` and validate the incoming envelope with the app contract.
2. Follow `execute.md`. Route with `graph.json`; never guess the next operation.
3. Load only the selected operation folder.
4. Bind the selected operation's `input.schema.json`, then run `validate-input.mjs` before reading execution instructions or allowing side effects.
5. Retrieve only its declared `operation.json.knowledgeRefs` from the V5 Qdrant design-knowledge index.
6. Bind `output.schema.json`, then run `validate-output.mjs` before accepting its result or routing again.
7. Finish only with an artifact described by `output.md` and valid against the app output contract.

The app has exactly two creative approval checkpoints: user-flow direction and layout direction. Revisions return to the same checkpoint; they do not create a third one. Delivery closes only after `operations/test/unit`, `operations/test/e2e`, and `operations/test/ui`; UI proof opens the app in a browser with an approved test account and follows the journey as a normal user.
