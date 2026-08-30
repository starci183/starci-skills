# Multi-task supervision

Use this mode when the runtime must be observed through two or three independent Codex product-action
tasks. The self-upgrade mission remains the supervisor and runtime mutation owner; each actor remains
the product mutation and product-proof owner for its exact worktree.

## Actor policy

- Start with two primary actors whose scopes exercise materially useful runtime behavior.
- Use full Codex tasks/sessions with independent contexts, not in-thread subagents.
- A third actor is allowed only when the user explicitly names a third fixture or when results are
  asymmetric/inconclusive and a discriminator is required.
- Freeze each actor's action, Skill, source/worktree, product authority, acceptance, runtime
  fingerprint, and expected evidence before launch.
- Register the returned task id. Never treat a planned prompt as a running actor receipt.

## Supervision loop

1. Launch/register actors into a pre-mutation phase only. Each actor must run its expected Skill's
   existing runtime/capture observation gate and return a validated receipt proving the required
   browser/capture surface is accessible. Do not release product mutation merely because the user has
   authorized it: authority does not prove that output can be rendered or reviewed.
2. If any required capture surface is denied or unavailable, stop that actor before product mutation,
   record the tool-model blocker, and do not spend implementation, build, or review work on an
   output that cannot be observed. Release actors to product work only after all required preflight
   receipts validate.
3. Communicate only bounded evidence requirements, genuine authority resolutions, runtime reloads,
   and exact resume requests. Do not micromanage product layout or leak a suspected runtime answer.
4. Collect each actor's source/runtime fingerprints, state, output, tests, durable raster/reviewer
   proof, metrics when observable, repair rounds, and terminal receipt. Bind these into one actor proof
   packet. Inline screenshots, reconstructed scores, producer self-ratings, narration-only results,
   invisible terminals, and a recovery/error raster substituted for the requested business state are
   missing evidence, not a pass.
5. Validate every actor independently. Missing evidence is blocked for that actor; pass from another
   actor cannot compensate.
6. Compare cases and classify the result as `systemic`, `product-specific`, `mixed`, or
   `inconclusive`. One strong structural contradiction may prove a runtime defect; two similar
   failures strengthen it but are not a voting rule.
7. For a knowledge-layer finding, classify `missing`, `not-loaded`, `misapplied`, `contradictory`, or
   `stale` before selecting a knowledge, Grammar, input, prompt, execute, machine, validator, or proof
   owner.
8. Apply only the smallest approved runtime repair. Product-specific defects return to their actor and
   never become a general `.claude` law.
9. A runtime change invalidates actor proof made under the old runtime fingerprint. Notify every
   affected actor, require reload, and resume/rerun from the exact recorded state.
10. Complete only when every required actor independently achieves the configured consecutive passes
   under the same final runtime fingerprint and unchanged acceptance.

## Fail-closed conditions

- Fewer than two primary actors in multi-task mode.
- More than three actors, or an unjustified discriminator.
- Shared task context, shared product write root, or missing separate product authority.
- Product mutation before a validated actor-specific runtime/capture observation receipt.
- Aggregate pass produced by mixing attempts from different actors.
- Runtime repair classified only from actor narration without direct output evidence.
- Actor pass without a visible typed Skill result, durable raster, validated direction-screen receipt,
  and independent review receipt for every visual acceptance.
- Completion while any actor is missing, blocked, stale, below its pass count, or running an old
  runtime fingerprint.
