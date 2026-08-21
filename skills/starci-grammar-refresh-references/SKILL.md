---
name: starci-grammar-refresh-references
description: Audit and immediately refresh stale optional immutable Git references for one explicitly routed durable grammar. Runs the whole bounded repair in one invocation and never changes facts, rules, profiles, capsules, founder rulings, cases, templates, or product source.
---

# starci-grammar-refresh-references

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared execution and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve the exact grammar/profile selected by the project role |
| `@grammar` | `grammars/context.md` | context | durable grammar authority that optional refs may not change |
| `@audit-references` | `skills/starci-grammar-refresh-references/scripts/audit-reference-sidecar.mjs` | script | verify optional reference identity and immutability |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove durable grammar authority stayed byte-identical and valid |

## NESTED SKILLS

None.

## Run

Read `@skill-shape`, resolve the exact project role, and require its explicit grammar/profile pair. This is one
continuous audit-and-repair run; it does not stop at plan, preview or a second approval.

1. Snapshot hashes of `facts.json`, `grammar.json`, `capsules.json`, every case, profile and template.
2. Run `@audit-references <grammar-root>`. A missing `references.json` means no optional provenance and is complete.
3. For each stale entry, require `git+https://...@<40-char-commit>:<path>`. Fetch/read only enough immutable source
   to compare behavior against the bound capsule invariants and counterexamples.
4. Replace only a stale reference that still demonstrates the same behavior. Remove a dead optional reference when
   no faithful immutable replacement exists; do not weaken or regenerate authority to preserve provenance.
5. Re-run the reference audit and `@validate-grammar`, then prove every durable hash from step 1 is unchanged.

## Stops

- The workspace route does not explicitly select an existing grammar/profile.
- A candidate ref is mutable, inaccessible, or behaviorally different from its capsule.
- Any durable grammar artifact changes during the run.

## Output

Report the grammar/profile, stale refs refreshed or removed, immutable replacements and validation proof in concise
prose. If no sidecar or no stale entries exist, say so directly. Do not print a status table.
