# Interaction

[interaction.json](interaction.json) owns the communication policy. The entry reads it before
dispatch. Operator Ask columns, workflow `asks`, missing defaults and route names identify inputs
or owners; they do not independently authorize a question or an action.

A proposed question is typed as `response.json.interaction`: `kind`, a stable `decisionId`, and
options with distinct `id`, `label` and `tradeoff`. Visual alternatives retain the existing rendered
evidence. The response gate checks this record before the question is sent. Legacy `reason` prose
is diagnostic evidence, not a question to forward automatically.

Record an actual answer in `state.json.choices[decisionId]` with `selected`, `selectedBy` and
`sourceRef` pointing to the user's message. A continuation request carries `decisionId` and
`selectedOption`; its gate checks them against that record. Recommendations are not user choices.
Do not create a new decision id merely to ask the same question again. A mission without a material
choice needs no choice record.

A `goal-confirm` question is asked once, at the start of a mission that will write routed source or
touch a runtime, and never for read-only work: the orchestrator prints the block `state.json.mission`
holds — goal, inclusions and exclusions, the done-when lines — as at most four lines in the person's
language with one question, and records the answer at `state.json.choices["goal:<sessionId>:v<version>"]`.
`corrected` writes the next version and asks again; only a latest version selected `as-stated` lets
anything run (`scripts/validate-request.mjs#missionGateErrors`, `scripts/validate-session.mjs`). Whether
a mission writes or touches a runtime is read from the tools its operators declare, never from a list
of operator ids.

After every transition of a mission the orchestrator prints to the root chat exactly the two lines
`interaction.json#transitionLog` declares — the branch's goal, then its outcome with the count of
evidenced done-when lines, the artifact paths and the next cell — and records `logged: true` on the
transition, which `scripts/validate-session.mjs` requires on every transition of a session that
carries a mission. `scripts/validate-interaction.mjs#transitionLogErrors` checks a printed pair
against the declared shape, compiled from the policy rather than copied. Full outputs stay in the
session folder; the person who wants them reads the ledger.

The standalone `scripts/validate-interaction.mjs <branch>` gate and the generic response gate check
proposed questions. These gates validate communication only; passing them authorizes no operation.

Sources: [Interaction evidence](../tests/evidence/20260904-interaction.md).
