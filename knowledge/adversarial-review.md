# Adversarial review authority

| Field | Value |
| --- | --- |
| Knowledge ID | `global.adversarial-review` |
| Operators | `all terminal-producing operators` |
| Search tags | `adversarial review, neutrality, falsification, counterevidence, implementation bias, infrastructure bias, defect owner` |
| Dependencies | exact domain authority and direct reproduced evidence |

Every StarCi Skill judges an outcome independently of the implementation that produced it. Existing
source, infrastructure, framework choices, tests, measurements, prior PASS text, and reviewer intent
are evidence and cost constraints; they are never truth merely because they already exist.

## AI execution boundary

Every material open-ended AI brainstorm, critique, or review is completed end to end by one atomic fresh-context `gpt-5.6-sol` execution with `forkTurns=none`. Do not reuse the producer context, and do not let an operator route internally. The parent Skill freezes the smallest evidence packet, invokes the Sol boundary, validates its typed product, then routes it. Deterministic compilation and mechanical validation do not call AI merely to satisfy a quota.

When `config.yaml` has `debug=true`, every AI `CALL`, `RETURN`, and `TRANSITION` must be printed to the terminal with the normalized input, expected output, actual output, evidence fingerprints, findings, uncertainty, and verdict. Visual review additionally prints one inspection block for every raster. Missing debug records make the execution incomplete. Redact secrets and omit hidden reasoning; debug records expose contracts and observations, not chain of thought.

Use this order whenever a Skill is about to accept, publish, or rely on a material claim:

1. **Observe without defense.** Inspect the direct product, runtime, business, architecture, code, or
   delivery evidence before reading the producer's rationale. State what is actually observable.
2. **Try to falsify it.** Attack the claim with counterexamples, boundary cases, alternative causal
   hypotheses, failure/recovery states, and at least one materially different solution model. The
   purpose is to discover a contradiction, not to confirm the current approach.
3. **Consult authority after the observation.** Compare each observed contradiction with business
   authority, contracts, principles, Grammar, architecture boundaries, and explicit constraints.
   Authority explains what should change; it may not erase a contradiction already visible in the
   evidence.
4. **Classify the owning defect.** Assign every confirmed contradiction to exactly one smallest
   owner: implementation, reusable rule/knowledge/Grammar, frozen product or business authority,
   architecture/infrastructure assumption, or external constraint. Current infrastructure is a
   candidate design, not the default owner of truth.
5. **Repair the owner, then restart observation.** A mutation invalidates the evidence that preceded
   it. Reproduce the result and rerun the adversarial review from step 1 without carrying the earlier
   defense forward.

A terminal `PASS`, `ready`, `proved`, `complete`, or equivalent is invalid while counterevidence,
unclassified findings, missing attacks, contradictory structured fields, or an untested alternative
hypothesis remains. Green tests prove only what they exercise. They cannot prove product fitness,
visual quality, business truth, architectural neutrality, or the absence of a better bounded design.

Domain-specific gates add their own direct evidence and attacks. For frontend visual work, pixels are
the primary observation and `knowledge/ui-render-review.md` defines the required falsification loop.
For backend and architecture work, compare the current infrastructure against contracts, failure
modes, ownership, operability, reversibility, and at least one viable alternative before accepting it.
