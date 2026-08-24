# Frontend V6

V6 models frontend design as a small app composed from typed operations.

- `operations/fe/` contains frontend composition and delivery units.
- `operations/test/` contains reusable unit, E2E, and real-browser UI proof units.
- `knowledge/references/` binds immutable StarCi FE/BE source precedent and Qdrant virtual roots.
- `apps/fe-design-layout/` connects those units with deterministic routes.
- Each operation explains its input, output, execution, and machine-readable schema.
- The app loads only the operation selected by the current artifact envelope.

An operation owns a transformation. A node is one use of an operation in an app graph. The app is the graph, not another reasoning layer.
