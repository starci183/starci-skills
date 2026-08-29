# Analyze frontend UX-flow input

Require fresh business capability refs, an exact primary task, known states, and optional current-experience evidence. UX flow precedes UI direction. Identify meaningful interaction jobs and likely validation/failure/recovery edges, but do not choose visual composition or containers during input analysis. Do not load Grammar object detail or implementation context. Enter fixed state `model`; the state machine must pass the modeled flow through `containers` before review.

Normalize this capability to exactly one approved journey or flow identity: actor, trigger, meaningful
outcome, and the closed transition and state set including applicable escape, recovery, resume and exit.
If a feature or product branch contains multiple independently completable outcomes, return to global
analysis to select one journey or declare separate flow identities. Never treat the current page or one
happy path as the complete flow.
