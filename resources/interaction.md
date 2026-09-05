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
Do not create a new decision id merely to ask the same question again. Every v2.2 mission version
has one confirmation record; an already explicit and authorized prompt can be that record.

`scripts/session-open.mjs` opens or reuses the user session from the first prompt, before confirmation
and before operator work. The draft is shown as a table with Goal, Target, In scope, Out of scope,
Outputs, Done when, Verification reach and Example. The answer is recorded at
`state.json.choices["goal:<sessionId>:v<version>"]` and bound again in `mission.confirmation`.
When the opening prompt already states and authorizes exactly that scope, its message reference is
reused as `as-stated`; no routine second question is sent. A correction creates the next draft version.
Rejection or no answer leaves lifecycle `draft`, which cannot dispatch. Follow-ups and replans under
the confirmed goal reuse the same host binding and ask nothing.

After every transition of a mission the orchestrator prints the two-line transition record to the root chat that
`interaction.json#transitionLog` declares — the branch's goal, then its outcome with the count of
evidenced done-when lines, the artifact paths and the next cell — and records `logged: true` on the
transition, which `scripts/validate-session.mjs` requires on every transition of a session that
carries a mission. `scripts/validate-interaction.mjs#transitionLogErrors` checks a printed pair
against the declared shape, compiled from the policy rather than copied.

For an accepted v2.2 done result, also run `scripts/render-outcome.mjs <branch>` and emit the returned
Markdown and media directly in the root chat under **The best outcome** before marking the transition
logged. `response.json.outcome` identifies the selected reviewable result and its evidence; the shared
gate and [operator presentation map](outcomes.json) check it before acceptance. UI generation shows the
actual selected render as an embedded image. Code, plans and checks show the readable source/diff,
diagram/table/document or measured result appropriate to that operator, with links to full proof.
Do not replace visible output with a filename, a raw JSON dump or the sentence “the file is ready”.
Failed, waiting and mismatched attempts keep their actual status and next repair step; they do not
pretend to have a successful best outcome. Full outputs and prior attempts stay in the session folder.

The standalone `scripts/validate-interaction.mjs <branch>` gate and the generic response gate check
proposed questions. These gates validate communication only; passing them authorizes no operation.

The examples are guidance, not a format assigned to every job. Read the operator contract and mode: show expected versus actual, scope coverage and the next action alongside the chosen result. “Best” means most useful for judging the outcome, including diagnostic failures. A verifier may be done while its subject fails. Dry-run is proposed; reuse/no-op is an observed unchanged state; rollback is restoration. The full result summary must remain visible even when only one representative artifact is embedded.

Sources: [Interaction evidence](../tests/evidence/20260904-interaction.md).
