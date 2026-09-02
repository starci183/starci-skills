# Stop codes

Every code an operator may stop with: the shared ones from `errors/errors.json` and the operator-local ones from `operators/<id>/errors.json`, merged by `scripts/errors-registry.mjs` and rendered by `scripts/generate-errors-doc.mjs`; `--check` runs inside `npm test`. A code has exactly one disposition: **terminate** ends the step blocked; **fallback** performs the named action, records it under `## Fallbacks taken` in `response.md`, and continues. `unless` names the one Requirements param whose value flips the disposition. `domain` is the `routing.json` domain the stop hands to; `self` is the emitting operator's own domain, a resume. A code an operator names that is not here fails `validate-operator`; a runtime meeting an unlisted code terminates with `UNKNOWN_STOP`.

| Code | Scope | Domain | Disposition | Meaning | Fallback | Unless | Resume |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `EVIDENCE_MISSING` | `*` | `self` | terminate | A claim about the system has no file, line, or head behind it. | — | — | Add the evidence. |
| `INVALID_INPUT` | `*` | `caller` | terminate | input.json or request.md fails the gate or the operator's Requirements. | — | — | Correct request.md. |
| `NO_PROGRESS` | `*` | `caller` | terminate | A resume adds no evidence, constraint, inventory, or approval delta. | — | — | Bring a real delta. |
| `SOURCE_DRIFT` | `*` | `workspace` | terminate | The observed checkout head differs from the head input.json froze. | — | — | The orchestrator freezes the head again. |
| `UNKNOWN_STOP` | `*` | `caller` | terminate | The runtime met a code the merged registry does not list. | — | — | Register the code or fix the operator. |
| `BUSINESS_AUTHORITY_REQUIRED` | `architecture.decide` | `business` | terminate | The published business head the architecture must keep is missing or stale. | — | — | Run business.decide first. |
| `CHOICE_REQUIRED` | `architecture.decide` | `caller` | fallback | Several alternatives remain material after assessment. | Select the alternative with the highest score across tradeoffAxes; on a tie, the one that changes the fewest stack components; record the score table under ## Decision. | `selectionPolicy` = `approval-required` → terminate | The person supplies approval. |
| `COMPATIBILITY_UNVERIFIED` | `architecture.decide` | `self` | fallback | A retained stack component has no compatibility evidence on at least one axis. | Mark the component replaced-candidate in the stack delta and list the unverified axes under Handoff as unknown. | — | Add the compatibility evidence. |
| `CONSTRAINT_CONTRADICTION` | `architecture.decide` | `caller` | terminate | Two fixed-intent constraints cannot both hold. | — | — | A person resolves the constraints. |
| `CRITIQUE_UNRESOLVED` | `architecture.decide` | `self` | terminate | An attack on the selected alternative has no resolution. | — | — | Resolve the attack or select differently. |
| `CURRENT_STATE_UNOBSERVED` | `architecture.decide` | `workspace` | terminate | The system today could not be read at the frozen head. | — | — | Fix the route or the checkout. |
| `DATA_OWNERSHIP_UNASSIGNED` | `architecture.decide` | `self` | terminate | A physical store has no owning boundary. | — | — | Assign the owner. |
| `NO_VIABLE_ALTERNATIVE` | `architecture.decide` | `caller` | terminate | No alternative survives the frozen constraints, or the only alternative fails an attack. | — | — | Relax a constraint or stop. |

