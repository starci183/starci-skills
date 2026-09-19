# Lane v6-3 — CRITICAL AUDIT: is the examples' .starciwork rigorous, correctly topologized, non-contradictory?

READ-ONLY AUDIT. Do not edit any file except your report: `.claude/ex-testing/lint/v6-3-REPORT.md`. You may run `node .claude/scripts/check-example-work.mjs` and any read commands.

## Scope
`.claude/examples/todo-app-backend/.starciwork` + `.claude/examples/ecommerce-app-be/.starciwork` — the work trees AND the code they describe (`src/` in each app). Schemas: `.claude/schemas/work-*.yaml`. Gate: `.claude/scripts/check-example-work.mjs`.

## Questions to answer (all must be answered with EVIDENCE, not impressions)

1. **Topology correctness**: does `features/` structure mirror the actual product? Every capability in `src/modules/bussiness/*` and `src/features/*` should trace to a feature record, and vice versa — list orphans both directions (records for code that doesn't exist; code capabilities no record covers).
2. **Contradictions**: read enough br/fr/decision records to find actual conflicts — two rules that can't both hold, a decision contradicting a rule, ac contradicting its br's statements, events declared but never emitted in code (grep the code for the event), contracts where provider/consumer disagree.
3. **Id/ref integrity beyond the gate**: the gate checks dangling refs syntactically — audit SEMANTICALLY: do `dependsOn`/`refs`/`proves`/`acceptanceCriteria` point at the record that actually means what the depender needs? Sample ~20 edges and read both ends.
4. **Coverage honesty**: which `state: done` records have NO evidence and no `proves` chain — is done-without-proof actually enforced? Count authored-claim schemas vs proof-required schemas and verify the enforcement is real.
5. **business-rules/ root dir + _derived/ + _resources/**: sanctioned or drift? Check the gate's verdict and whether content there duplicates what should be feature-owned (contract says shared things need ONE accountable feature owner, not a parallel root tree).
6. **The catalog**: root `index.yaml` work/catalog vs actual feature dirs — complete, consistent?

## Output
Report answers each question with: verdict (strict / has-gaps / broken), concrete file evidence (paths+ids), and a severity. End with a numbered list of real findings ordered by severity. This is a critique — the goal is finding what's wrong, not confirming it works.
