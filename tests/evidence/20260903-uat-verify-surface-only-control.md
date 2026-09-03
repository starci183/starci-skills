# Evidence — a walk is evidence only for what it pressed, 2026-09-03

## Occurrence 1 — a session that caught itself

A `uat.verify` run's first attempt at its sign-in case called the product's sign-in mutation from page
context instead of filling and submitting the rendered sign-in form. `knowledge/ui/proof/ux.md`
already forbade this: `UX-1` Case 2 requires every step to be chosen from a visible label, with no
step driven by a URL typed by hand, a console command, or a hint from the flow author. The session
noticed the mismatch on its own and rewrote the run to drive the rendered form before publishing
anything.

Nothing in `operators/uat-verify/operator.md`, the `uat-flow-verification` contract, or
`operators/uat-verify/validate.mjs` would have refused the first version. The receipt shape is
identical either way: a capture names an `assertionId`, a `lane`, what was `observed`, an
`evidenceRef` and an `outcome`, whichever way the outcome was produced. The gap was not a missing
rule — `UX-1` Case 2 already states the law — it was that no field in the run record carried the one
fact that would let a validator tell the two versions apart: which rendered control, if any, produced
the observation. The evidence for the criterion about the form would have been fabricated in effect,
because a reader of the published receipt could not have told a pressed form from a called mutation.

## Occurrence 2 — the gap generalizes to any step-level action taken outside the rendered surface

The same absence covers every other way a run could reach the product without the surface: a script
seeding a record the flow claims a step created, a fixture answering a query the UI is supposed to
answer, or a directly-issued request substituting for a submit press anywhere in a multi-step case, not
only at sign-in. In every one of these the receipt a person reads carries a plausible `observed`
sentence and a `pass` outcome with nothing that could ever falsify it, because falsifying it requires
naming the one thing the walk actually did — the control it pressed — and no field held that name.

## Fix

`templates/kinds/uat-capture.schema.json` adds a required `control` field to every scored assertion,
identified the same way `templates/kinds/capture.schema.json` already identifies a rendered node (a
path into the rendered tree). The shared step check
(`scripts/validate-response.mjs` → the generic kind-schema pass) already validates every published
`uat-capture` file against its schema, so a capture whose assertion carries no control fails the same
way a capture that cannot say the login field was masked already failed: no new validator logic, no
new stop code. The existing `EVIDENCE_UNAVAILABLE` stop — the run's own stop for a criterion this
operator cannot evidence — is the one that answers a step reaching past the surface; there is no
`SURFACE_ONLY` or similar code, because none is needed.
