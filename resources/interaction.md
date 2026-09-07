# Interaction

For frontend creation/redesign, `interface.draw` follows the `artDirection` policy: one concept-grounded PNG by default, displayed inline before code and continued without a choice question. Only an explicit user comparison request enables two or three PNGs and the actual user choice. The frozen business brief, Grammar and per-region imagery plan travel with the prompt and selected PNG. `node scripts/art-direction.mjs present <branch>` produces the native image sheet; emit it unchanged and use `shown` to retain its actual display source. A comparison uses `answer` for the actual user selection. The displayed PNG cannot prove source behavior or UAT, and technical green alone cannot claim the applied surface visually complete.

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
and before operator work. Display the draft with `interaction.json#scopePresentation`, using
`node scripts/session-open.mjs preview <session>`. The answer is recorded at
`state.json.choices["goal:<sessionId>:v<version>"]` and bound again in `mission.confirmation`.
When the opening prompt already states and authorizes exactly that scope, its message reference is
reused as `as-stated`; no routine second question is sent. A correction creates the next draft version.
Rejection or no answer leaves lifecycle `draft`, which cannot dispatch. Follow-ups and replans under
the confirmed goal reuse the same host binding and ask nothing.

After every transition preserve the machine record declared by `interaction.json#transitionLog` in the session ledger. Its two dense lines are internal; do not duplicate them in chat. The existing validator still checks that record.

The visible result follows `interaction.json#outcomePresentation`: **Operator Result**, the compact Step/Status/Result/Next table, selected native image embeds, short details, then original-image and full-artifact links. For an accepted done receipt run `scripts/render-outcome.mjs <branch>` after the existing gates and emit its Markdown/media. Record `logged: true` after the visible block is shown and the internal record is retained. An accepted check does not mean its subject passed; preserve actual findings, mode, limits and next action. Blocked, waiting and mismatched attempts show their truthful state without an accepted-completion claim.

The standalone `scripts/validate-interaction.mjs <branch>` gate and the generic response gate check
proposed questions. These gates validate communication only; passing them authorizes no operation.

The examples are guidance, not a format assigned to every job. Read the operator contract and mode: show expected versus actual, scope coverage and the next action alongside the chosen result. The selected result is useful for judging the outcome, including diagnostic failures. A verifier may be done while its subject fails. Dry-run is proposed; reuse/no-op is an observed unchanged state; rollback is restoration. The full result summary must remain visible even when only one representative artifact is embedded.

Sources: [Interaction evidence](../tests/evidence/20260904-interaction.md), [Delegated restatement review](../tests/evidence/20260907-delegated-restatement-review.md).

## Restatement identity

A restatement choice belongs to its operator, confirmed mission version and exact rendered reading.
After writing `response/restatement.md`, run `node scripts/restatement-choice.mjs <branch>` to derive
the decision id; use that exact id in the blocked interaction. The digest normalizes line endings
only. Record an actual answer through `node scripts/restatement-choice.mjs answer <blocked-branch> <actual-answer.json>`, which verifies the accepted blocked
receipt and its evidence inventory before retaining the answer. A resumed request names that blocked
branch and its choice; it cannot reuse a reading from another mission version. The former choice and
receipt stay unchanged. The invocation context preserves the choices available when it opened, so
an answered historical question is not mistaken for a new request to ask again.

An actual user may explicitly delegate review of unchanged in-scope readings to a named coordinator.
Record that grant with `node scripts/restatement-choice.mjs delegate <session> <grant.json>`,
using [restatement-delegation.schema.json](../templates/kinds/restatement-delegation.schema.json):
the actual user statement and source reference, exact consumer session and confirmed scope hash/version,
coordinator session identity, and permitted restatement operators. Scope approval or an agent role alone
is not a grant; the consumer cannot grant authority to itself. The named coordinator may be identified
by its draft coordinated session when the actual user grant supplies this review authority.

The coordinator reviews every rendered line against hashed clauses of that approved scope and records
every exclusion, with no material new effect, using
`node scripts/restatement-choice.mjs delegated-review <blocked-branch> <review.json>` and
[restatement-delegated-review.schema.json](../templates/kinds/restatement-delegated-review.schema.json).
This binds the grant id, exact sealed request and reading bytes, mission hash/version, and reviewer
identity. The choice says `selectedBy: coordinator`, with its review source and retained basis;
it is an `as-stated` technical decision, never represented as the user's answer to that reading.
Line-to-scope equivalence is the reviewer's explicit judgment, not a semantic fact proved by hashes.
An unanswered material change still goes to the user. This path cannot change goals, effects,
ownership, verification tiers or budget. The `answer` command remains user-only.

The normal resume request consumes the retained decision. Fresh admission rechecks the current grant
and reviewer identity; accepted history retains its opening authority and sealed evidence, including
after a later scope correction. Old scope decisions cannot authorize fresh current work.
