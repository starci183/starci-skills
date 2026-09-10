# Work defines the target; code is the implementation to evaluate

For product intent and target design, use the current accepted, effectively done
Business/SRS and Architecture/SDS in the bound backend's `.starciwork`. Resolve
their actual canonical nodes and dependencies before answering design questions
or choosing implementation scope. A prior chat summary, draft outside the tree
or raw stored `done` on changed inputs is not a replacement for the current Work.

Existing code is legacy implementation relative to that target, never the source
of requirements or design authority. This remains true of newly written code and
green tests: they demonstrate only the behavior actually exercised. Code is
useful for implementation mapping, migration planning and observing a mismatch;
its presence cannot approve a feature, establish a policy or limit the target to
what already happens to exist.

A correct implementation of the wrong Business or Architecture is not successful
delivery. During coding, keep checking the intended outcome and significant
behavior against the current SRS/SDS, especially at integration boundaries and
when actual results differ from expectations. Do not wait until final UAT or
protect a design mistake because substantial code already exists. Preserve useful
work while repairing the real cause; this rule is not permission to delete code.

When the user asks how the product should work, answer from SRS (observable
behavior) and SDS (the chosen design). Do not substitute a call graph, describe
legacy behavior as the approved design, or declare a requirement absent just
because code lacks it. When asked about actual implementation, label observations
separately and compare them against those same canonical requirements.

## Root contracts for downstream work

SRS and SDS are upstream contracts, not documentation appended after coding:

```text
Business / SRS ──> Architecture / SDS ──> BE and FE implementation
       │                    │                       │
       ├──> UI journeys <── technical constraints   │
       │         └──────────────────────────────> FE│
       └──> UAT expected outcomes <── compare actual behavior
```

UI derives user journeys, actions and outcomes from SRS, applies relevant SDS
constraints and the selected design Grammar, and feeds implementation. UAT
expectations derive from SRS acceptance; SDS supplies relevant technical checks,
while running code supplies actual observations, never the expected answer.
Test/journey planning can begin before code exists. This is a dependency model,
not permission to skip a workflow gate or force every project into one waterfall.

Bind actual canonical Work inputs through supported refs/dependencies and
workflow handoffs. A material root change requires impact review of importing
design, UI, implementation and acceptance scenarios; update and reverify affected
branches before their result is accepted. Do not erase unrelated completed work,
blindly rerun the whole project, or retain stale green results on affected inputs.
Completion of a downstream node cannot repair a known-invalid upstream contract.

## Recording a current design review

For current `work/node@2` Business overview, split SRS leaves and code-map SDS
leaves, keep the review inside `completion.review` on the owning `index.yaml`;
do not create an evidence directory or a second specification copy. The legacy
cohesive SRS@2 and source-independent SDS@3 formats remain reviewable while they
are migrated. `completion.inputDigest` binds the reviewed semantic inputs,
including ancestors and declared imports.
The review has schema `starci/design-review@1`, declared reviewer and actual
authority provenance, ISO `reviewedAt`, one concrete passing observation for each
required node assertion, and an explicit `limitations` list. It is a current
review record, not another Work node, external manifest or workflow history.

Resolve blocking decisions and set a split leaf's status to `accepted` only after
real review; legacy specifications use `pass`. Check `previewCompletion` before
recording `state: done`; unaccepted prerequisites still block completion. Inspect the returned
`effectiveState`, never only the stored flag. Changing semantic inputs invalidates
this review exactly as it invalidates other completion bindings. The validator
checks consistency and coverage; it does not authenticate a reviewer or prove the
truth of prose. Do not invent an authority message or generic observations.

This design-only record cannot complete implementation, UI or UAT. Their actual
code checks, runtime observations and media remain distinct obligations; the
legacy transport remains readable during its separately scoped migration.

## Author carefully; keep the contract current throughout delivery

Apply careful analysis to every new or revised SRS/SDS, not only after a user reports a gap.
Treat the documents as a contract another implementer must be able to follow
without guessing material behavior. Begin with accepted intent, actors and scope;
trace complete journeys across the actual responsibility boundaries. Distinguish
the customer's interaction with the product from the product acting on someone
else's behalf. Include who initiates work, who receives results or questions and
what each participant sees while the outcome is pending or uncertain.

For each significant journey, challenge the ordinary path with relevant denied
access, invalid input, cancellation, repetition, concurrency, partial failure,
lost observations and recovery. In SRS settle observable behavior, business rules
and acceptance. In SDS settle the mechanisms, connections, authoritative data,
owners and failure handling that realize those requirements. Explain why a
material branch or concern is inapplicable instead of omitting it silently.

Before presenting a first result as done, walk the complete affected scope as
both a user and an implementer: can they tell what happens, who is responsible,
what changes, what remains uncertain and what the next permitted action is?
Check consistency across shared imports and consumer contracts. Challenge a
design with a genuinely simpler alternative and resolve material contradictions
within authority. Neither populated template sections nor passing schema checks
prove this analysis happened. Record concrete review findings and their resolved
outcomes; unresolved material decisions prevent completion. Review depth follows
the risk and actual scope, not document length or a fixed number of edge cases.

This is not a demand for perfect foresight or a frozen specification. A missing
case may be found during review, implementation, testing, operation or later
customer feedback. Treat that discovery as input to the same scoped repair loop
below. Do not dismiss it because the document was already done, or require a
whole-project redesign before an otherwise bounded change. Customer feedback is
input to evaluate, not automatic authority to change another owner's policy.

## Close specification gaps instead of carrying them into implementation

Within an authorized delivery or design-repair scope, whenever a relevant gap is discovered:

1. Trace the significant case to the owning SRS requirement/flow/acceptance and
   SDS view/runtime path. Inspect ancestor scope and shared imports before
   declaring it missing. Distinguish implementation mismatch, missing elaboration,
   an invalid design assumption and a genuinely undecided business choice.
2. If implementation alone is wrong, repair it. If SRS or SDS does not adequately
   cover the case, revise the affected canonical owner; do not merely leave a
   warning and continue dependent effects, or rewrite expectations to make code
   pass. Complete observable actors, guards, outcomes, alternatives/exceptions
   and acceptance in SRS; mechanisms, ownership, contracts and failure behavior
   belong in SDS.
3. Resolve elaboration and technical choices within delegated authority. Do not
   ask the user to approve every technical detail again. A new business policy,
   changed product scope or reserved external effect still needs the actual
   authorized decision maker; never fabricate that decision to obtain `done`.
4. Review the revised specification against the full affected journey, shared
   consumers and relevant failure cases, not only the test that exposed the gap.
   Validate structure, links and completeness, then re-establish current design
   acceptance and `done` for the corrected scope through the applicable protocol.
   Marking `done` is the outcome of review, not the repair itself. Preserve useful
   assets and unrelated completed branches; an already-done node is editable.
5. Rebind affected implementation goals to the accepted revision and verify the
   actual result. Dependent work waits for its required design; independent work
   can continue. A completed design does not prove implemented behavior or UAT.

Do not promise to cover every imaginable case. Cover the cases required by the
accepted outcome and significant boundaries, make assumptions and residual risks
explicit, and keep unresolved material gaps from earning completion.

## Example: specify the form of restoration

For a system whose accepted scope includes disaster recovery, "supports restore"
is not an adequate SDS. State the selected form (for example, restoring a
consistent full backup into replacement infrastructure), the recovery source and
destination, which authoritative stores/objects/runtime state/configuration/keys
are required, how consistency is obtained, compatibility prerequisites and the
restore order. Explain validation, partial failure, old-writer fencing, current
authority checks and reconciliation before effects resume. State the recovery
point and unverified limits without inventing numerical guarantees.

The corresponding SRS describes what the customer can recover, what is unavailable
during recovery, visible missing/uncertain results and conditions for resuming
work. It does not prescribe Kubernetes, PVCs, database engines or backup tools.
Reinstalling a module or regenerating its configuration is not evidence that
customer history and work were restored. Implementation later chooses source
changes and demonstrates the designed recovery with an appropriate drill.
