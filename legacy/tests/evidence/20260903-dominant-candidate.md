# Evidence — a choice whose answer was already known, 2026-09-03

The print law (release 1.7.3) settled the form a design choice takes when it reaches a person:
rendered candidates, a capture per viewport, one question. The occurrences below are the case it left
open: whether the choice should reach the person at all. The owner's ruling, in their words: "trừ khi
có nhiều ý bắt chọn, còn không thì auto chọn" and "chạy long-running task mà bắt thầy confirm chi
trong khi 100% say yes rồi" — a choice goes to a person only when the candidates are genuinely level,
and a confirmation whose answer is already known is never a stop.

## Occurrence 1 — the direction that rendered three and asked

A blind session under `approval-required` rendered three candidates, printed them at both viewports
as the law requires, and stopped with `DIRECTION_CHOICE_REQUIRED`. The candidates had already been
falsified and the taste criteria the audit measures were available to score them; the run scored
nothing and asked. The owner opened the sheet, saw one candidate plainly ahead, and objected to being
asked at all.

## Occurrence 2 — the audit that asked a yes/no it could compute

A surface audit closed its taste lens `fix-first` on the density criterion: a console band measured
against three seeded rows. It exhausted its direction laps and stopped with a yes/no for the person —
accept as data-bound, or seed first. The tree already answered it: a missing UAT record is created,
not reported (release 1.6.0), so the data gap was the runtime's to fill, not the person's to waive.
After seeding to the flow's representative volume (twelve rows) the density still measured about
fourteen percent at the wide viewport, because the band is bounded by the chosen row shape — and the
person had already chosen that exact candidate from the printed sheet with its scores visible.

## What the two settle

| # | What the occurrences show | Where it now lives |
| --- | --- | --- |
| 1 | Several survivors are scored against the bound proof rubric per printed viewport; the dominant one is selected under either policy; only a tie the scores prove reaches a person | the decision paragraphs of `frontend.direction.decide`; `## Scores` in `templates/kinds/frontend-direction-decision.contract.json`; `rankCandidates` in the operator's `validate.mjs`; the `decision-points` mode of `@tools/print` |
| 2 | Dominant means the highest mean and no lower score on any criterion any candidate failed, at the same viewport; equal top means are the rubric's own resolution and a tie | the same paragraph; `DIRECTION_CHOICE_REQUIRED` in the operator's `errors.json` |
| 3 | The audit never closes a composition or taste verdict by asking; it hands to direction, which scores or proves the tie | the route paragraph of `frontend.surface.audit`; its validator refuses a `user` route over an open composition or taste topic |
| 4 | A criterion that depends on data volume is measured at the flow's representative seeded volume, routes to `seed` below it, and is `data-bound` when it still fails there | `TASTE-9` Case 5 and 6, `TASTE-13` Case 6; the `seed` route in `templates/kinds/verdicts.schema.json` and the audit contract; the seed template |
| 5 | A choice the person took from a printed sheet closes the criteria it was shown failing; the rubric never overturns a decision the person took on its own evidence | `TASTE-13` Case 7; the print paragraph of `frontend.direction.decide`; the route paragraph of `frontend.surface.audit` and its validator |

## The `user` routes of routing.json, read against the ruling

Every route of kind `user` and the stop codes that reach it, with whether the tree already holds the
answer. Only the first row changed; the rest are a person's own decision or a thing only a person can
supply.

| Operator → domain | Codes | Can the answer be known from a declaration, a rubric or the session's evidence? | Ruling |
| --- | --- | --- | --- |
| `frontend.direction.decide` → caller | `DIRECTION_CHOICE_REQUIRED` | Yes: the proof rubric scores every rendered candidate; a dominant one is computable | Changed: the operator scores and decides; only a proven tie stops |
| `frontend.surface.audit` → caller | `NO_PROGRESS` over an open composition or taste topic | Yes: direction's rubric, or the seed for a density below volume, or the person's own earlier choice | Changed: a `user` route with the topic open is refused; the topic routes to direction or to seed |
| `architecture.decide` → caller | `CHOICE_REQUIRED` under `approval-required` | Partly: the fallback already ranks by `tradeoffAxes`, but the assessment has no per-criterion pass/fail the dominance test needs | Left as is; the same treatment fits once the critique carries comparable scores |
| `architecture.decide` → caller | `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE` | No: two fixed-intent constraints the person set cannot both hold; only the person relaxes one | Left: a scope decision |
| `backend.source.apply` → contract | `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED` | No: the contract owner reopens and refreezes a boundary | Left: a scope decision |
| `business.decide` → caller | `CONTRADICTION_UNRESOLVED`, `LIFECYCLE_TRANSITION_INVALID`, `APPROVAL_REQUIRED` | No: two claims about behaviour disagree, or a lifecycle transition needs an owner's approval | Left: the business owner's decision |
| `content.generate` → curriculum, engineering, caller | `BRIEF_UNBOUND`, `IMAGE_UNAVAILABLE`, `REVIEW_ROUNDS_EXHAUSTED` | No: missing curriculum evidence, a generator that is down, or a review budget the workflow declared and spent | Left: extending a declared budget is a person's |
| `frontend.direction.decide` → grammar, caller | `GRAMMAR_REQUIRED`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `REFERENCE_EVIDENCE_EXHAUSTED`, `NO_VIABLE_DIRECTION` | No: a component only a person publishes, a scope only the person freezes, an authority only the person supplies | Left |
| `frontend.presentation.resolve` → grammar, knowledge, caller | `GRAMMAR_UNPUBLISHED`, `KNOWLEDGE_UNBOUND`, `RULE_MISSING`, `OWNER_CONFLICT` | No: a package to publish, a rule to write, an owner authority to correct | Left: a rule change is a person's |
| `frontend.source.apply` → caller | `WRITE_REJECTED`, `SESSION_MISSING`, `OWNER_CONFLICT` | No: the write set or the owner authority must be widened by whoever owns it | Left |
| `git.publish` → caller | `APPROVAL_MISSING` | No: completion proof is not approval; a publication is approved by a person | Left: a release-grade decision |
| `platform.operate` → product, caller | `PORT_CONFLICT`, `INTEGRATION_FAILED`, `AUTHORITY_DRIFT`, `CAPABILITY_MISSING`, `EFFECT_UNAUTHORIZED` | No: another session holds the port, a red gate on a merged head, an effect outside the approved set | Left (and outside this change's write scope) |
| `quality.verify` → caller | `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `DEBT_UNAPPROVED` | No: a debt is accepted by its owner, never computed | Left: a debt acceptance |
| `release.deploy` → approval, caller | `AUTHORIZATION_MISSING`, `RECOVERY_EXHAUSTED`, `MANIFEST_INVALID`, `APPROVAL_REQUIRED` | No: a production release and its rollback authority | Left: a production release |
| `uat.verify` → caller | `FIXTURE_VIOLATION` | No: a seed that would create the outcome under test is corrected by the flow's author | Left |
| every operator → caller | `INVALID_INPUT`, `NO_PROGRESS`, `UNKNOWN_STOP` | The caller corrects its own request; `NO_PROGRESS` reports a wall, and where the wall was a computable choice the operator's own validator now refuses it (rows 1 and 2) | Left as codes |
| the entry (`SKILL.md`) | a request naming no owner, or two whose scopes differ | No: scope is the person's | Left |
