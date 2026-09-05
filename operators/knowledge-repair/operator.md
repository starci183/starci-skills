# knowledge.repair

## Job

Repair one challenged UI knowledge rule at its canonical owner from concrete evidence, publish a new exact manifest, and return the originating operation to the same surface and reference.

## Done when

Done when the challenged rule's applicability was validated, the smallest canonical English knowledge file changed on the session branch with stable ids and its same-stem Vietnamese mirror, the `knowledge-repair-receipt` binds before and after manifests and concrete evidence, and retry names the originating operator, surface and new manifest.

## One bounded owner repair

This operator owns teacher knowledge, not the application and not Grammar source. It changes the existing rule when that rule is wrong or too narrow. A new rule is appended only for a concept with no home and at least two independent consumer surfaces. A numeric threshold is never invented from one screen. Universal semantics and anatomy stay in Common; family style stays in the family owner; product facts stay out of knowledge.

## Boundary

The operator writes only the challenged canonical English file and its Vietnamese mirror under `@knowledge/ui` or `@knowledge/grammars/<family>`, plus its own response. It preserves rule ids, does not patch a consumer, does not edit generated DNA, Grammar source, routing, aliases or profiles, and does not declare its own result visually correct. The originating operator must rerun on the same surface and reference.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@knowledge/ui` | the complete UI authority and canonical owner of a universal rule | yes |
| `@knowledge/grammars/<family>` | the concrete family authority and canonical home of family style and gaps | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `knowledge-question` | the UI or library operation that observed the mismatch and validated applicability | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `manifest` | object | — | The exact pre-repair manifest frozen before the write |
| `resume` | token | null | The blocked branch token when re-entering |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the question, applicability, evidence and frozen manifest | `manifest`, `resume` | `request/request.json`, input `knowledge-question`, @knowledge/ui, @knowledge/grammars/<family> | — | `INVALID_INPUT`, `KNOWLEDGE_EVIDENCE_MISSING`, `NO_PROGRESS` |
| 2 | Find the one owner and decide repair-existing before append-new | — | the challenged rule and Case, UPDATE.md, the family understanding brief | — | `KNOWLEDGE_SCOPE_REJECTED` |
| 3 | Repair the canonical English file and its mirror with stable ids inside the declared write set | — | the owner file and evidence | @knowledge/ui or @knowledge/grammars/<family> on the session branch, @tools/sourcewrite | `KNOWLEDGE_SCOPE_REJECTED` |
| 4 | Commit the bounded owner repair once, rebuild the exact manifest and emit the typed retry | — | changed files, the before manifest, @tools/git | the session-branch commit, `knowledge-repair-receipt`, `response/response.json` | — |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `knowledge-repair-receipt` | `response/data/knowledge-repair.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `KNOWLEDGE_EVIDENCE_MISSING` | terminate |
| `KNOWLEDGE_SCOPE_REJECTED` | terminate |
| `NO_PROGRESS` | terminate |

## Next

| When | Operator |
| --- | --- |
| the manifest was rebound and the same surface/reference must be retried | `interface.plan` |
| the manifest was rebound and the same surface/reference must be retried | `interface.generate` |
| the manifest was rebound and the same finding must be retried | `interface.fix` |
| the manifest was rebound and the same rendered surface must be audited again | `interface.audit` |
| the manifest was rebound and the same library plan must be retried | `library.update` |
