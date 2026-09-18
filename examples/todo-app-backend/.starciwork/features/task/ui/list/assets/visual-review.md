# Visual review: ui.task.list / ADDENDUM 2

Reviewed by Codex on 2026-09-18T14:41:21.685Z. Accepted as proposed direction, with implementation/render proof still separate.

Before: White nested field, black primary label, custom danger outlines and larger component scale.

Corrected: Reference-scale shell, grey composer input, white Add task label, neutral Delete outline and raised list body with external label/count/footer.

## Anatomy sources

- [tasks-screen.png](../../../../../brand/assets/grammar-reference/tasks-screen.png) - actual render; SHA256 e9ea01cbbecb7a5b6f19328184fa5a0eca7e37f4a411351e8582491dde5024d5
- [primitives.png](../../../../../brand/assets/grammar-reference/primitives.png) - actual render; SHA256 21fe46c116fa5ede07ff044c4fbdf5f1600686cbd8b955f2d3d82cc9e0f8ba91

The exact prompt cites brand/index.yaml rev 3, these real-render PNGs and ANATOMY-1/2/3/4. Grey secondary Input interiors, actual field-error treatment, white primary ink, blue secondary ink and neutral outlines come from real captures. The workspace follows tasks-screen.png; auth follows sign-in-screen.png without an outer raised form card.

## Composition and state

The record declares layout, native task/choice controls, breadcrumb/account content and applicable empty/occurrence groups as application-owned regions. Business inputs and all 8 state/screen/viewport entries remain bound. Mobile is a derived specification, not a captured screen.

The new empty-state.png shows shell, heading, zero count and a blank raised list body. It does not visibly show EmptyNotice content, turtle or composer. StaticStateRow and Progress are not rendered by this four-image set. Those names no longer claim a proven visual anatomy: empty/occurrence content is app-owned composition of referenced primitives, and usage uses text instead of a bar. Loading skeleton and alternate viewport/state appearances remain unproven until actual captures exist.

## Authority and provenance

ADDENDUM 2 explicitly requires white primary label ink and actual component anatomy. This supersedes earlier agent-derived black label, dark Input-error, custom disabled, danger-outline and auth-card treatments. Brand rev 3 stays byte-identical; its conflicting foreground/contrast prescriptions are recorded as unresolved specification differences, not used to recolour component internals. No accessibility contrast pass is claimed.

Selected PNG: assets/list-many-tasks.png (1536 x 1024), SHA256 1451e63520ca2d95023480a82f6eb13381d2b897d7ca9ebab50016d1dd895dbe. Exact prompt: assets/list-many-tasks.prompt.txt, SHA256 3eb1cb932e4297b9bf93392fb08951eeab8dbb3e1fadf0dd4120473a191ef99c. Tool: image_gen.imagegen; no model field exposed. One focused corrective edit followed the first full-screen generation; both exact prompt/input pairs are retained.

The coordinator knowledge file was read from C:/Users/Hi/orca/workspaces/.claude/ex-lint/knowledge/ui/proof/anatomy-source.yaml; its exact bytes are retained at examples/todo-app-backend/.starciwork/features/task/ui/list/assets/anatomy-source.accepted.yaml.txt because the canonical file is absent in this checkout. All four current reference files are versioned at their existing brand asset owner. The former reference set and previous selected direction are pinned to Git revision 41471a63; historical prompts are not current instructions.

This generated PNG is manually reviewed design input, not an exact browser capture, pixel-level contrast certification, keyboard proof or API evidence. Later implementation must render real components and obtain browser/UAT evidence.
