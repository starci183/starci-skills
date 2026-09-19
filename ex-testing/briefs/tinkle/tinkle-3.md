# tinkle-3 — schemas/ consolidation map

Read tinkle/_common.md. Source: `.claude/.dist/schemas/*.schema.{json,yaml}` (15+ pairs) — check whether a non-dist source dir exists (`schemas/`, `src/schemas/`, anywhere schemas are authored BEFORE .dist generation — find it).

Produce `.claude/schemas/`:
- IF a canon source exists outside .dist: symlink/copy is NOT the answer — write `index.yaml` mapping each schema id → its authoritative source path + its .dist artifact + what it governs (work records, ops, stacks, evidence...). 
- IF .dist IS the only source: still write `index.yaml` cataloging each schema with {id, title, governs, usedBy} — the business analysis is "which parts of the system this schema binds".
- Add `relationships.yaml`: schema→schema edges (who references whom), schema→subsystem edges (gate, ops, work tree, runtime).
- Do NOT duplicate schema bodies into modules — catalog + analysis only.
