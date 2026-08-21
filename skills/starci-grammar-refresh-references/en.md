---
title: starci-grammar-refresh-references · English
---

# starci-grammar-refresh-references

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared execution and reporting boundary |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve the exact grammar/profile selected by the project role |
| `@grammar` | `compilers/grammars` | module | durable grammar authority that optional refs may not change |
| `@audit-references` | `skills/starci-grammar-refresh-references/scripts/audit-reference-sidecar.mjs` | script | verify optional reference identity and immutability |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove durable grammar authority stayed byte-identical and valid |

## NESTED SKILLS

None.

## Run

Resolve the declared project role and its explicit grammar/profile. Snapshot every durable grammar artifact, audit
the optional sidecar, and repair stale immutable refs in the same run. A missing sidecar is a valid `none` result.
Only `git+https://...@<40-char-commit>:<path>` is accepted. Compare a replacement with capsule invariants and
counterexamples, update only provenance, rerun both audits, and prove all durable hashes stayed unchanged.

## Stops

- The route does not select an existing grammar/profile.
- A ref is mutable, inaccessible or behaviorally different.
- Any fact, rule, profile, capsule, ruling, case or template changes.

## Output

State the grammar/profile, refs refreshed or removed, immutable replacements and proof in concise prose. No status table.
