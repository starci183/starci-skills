# Execute page model

1. Run `validate-input.mjs <input.json>`, then validate the approval receipt. The selected id and direction-batch hash must match the approved flow artifact.
2. Read the selected flow and its business evidence. Do not blend rejected candidates into it.
3. Split the flow at real changes of user intent, commitment, system responsibility or recoverability. Do not force a capability into one page merely to simplify rendering.
4. Give each page one dominant task, clear entry and completion conditions, and ordered product Blocks.
5. Normalize raw content into Blocks. Name the responsibility and owned information instead of naming a visual component.
6. When the journey is linear and crosses pages, create exactly one global journey-progress Block. Every page references it; no page owns a second progress truth.
7. Use tabs only when one page contains mutually exclusive peer panels. Never use tabs as a substitute for journey steps.
8. Check that every approved flow step is owned by a page and every page Block has a purpose and evidence reference.
9. Hash and persist the page model, then run `validate-output.mjs <output.json>`. Emit `state.generate / ready` with `page-model-ready` only after it passes.

Stop if approval identity drifts, a flow step has no owner, multiple progress owners appear, or structural decisions require facts absent from business evidence.

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@page-model` | `fe.page-model` | qdrant | normalize the approved journey into purposeful page, Block and global-ref ownership |
